// PATCH QUEST: level checks, physics and rules, simulated headlessly.
//   node tests/patch-quest.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { Game } = await loadTsTree(path.join(root, 'src/game/game.ts'));
const { LEVELS, Tile } = await loadTsTree(path.join(root, 'src/game/levels.ts'));
const { PHYS, TILE, DT, PLAYER } = await loadTsTree(path.join(root, 'src/game/config.ts'));
const { Player } = await loadTsTree(path.join(root, 'src/game/player.ts'));
const { Grid } = await loadTsTree(path.join(root, 'src/game/physics.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const F = (o = {}) => ({ left: false, right: false, down: false, jump: false, jumpPressed: false, action: false, actionPressed: false, pausePressed: false, ...o });
const sounds = [];
const newGame = () => new Game({ sfx: (s) => sounds.push(s), music: () => {}, mode: () => {} });
const run = (g, seconds, frame = F()) => { for (let i = 0; i < Math.round(seconds / DT); i++) g.update(DT, typeof frame === 'function' ? frame(i) : frame); };
const play = (g, level = 0) => { g.newRun(); if (level) g.startLevel(level); run(g, 2.4); };

// ── Levels: shape, objectives, placement ─────────────────────────────────
for (const make of LEVELS) {
  const lv = make();
  const at = (x, y) => (x < 0 || x >= lv.w ? Tile.Solid : y < 0 || y >= lv.h ? Tile.Empty : lv.tiles[y * lv.w + x]);
  const solidish = (t) => t === Tile.Solid || t === Tile.OneWay;
  const ents = (type) => lv.ents.filter((e) => e.type === type);
  expect(lv.tiles.length === lv.w * lv.h, `${lv.name}: tile grid ${lv.w}×${lv.h}`);
  expect(solidish(at(lv.spawn.x, lv.spawn.y + 1)) && at(lv.spawn.x, lv.spawn.y) === Tile.Empty, `${lv.name}: spawn stands on ground`);
  expect(ents('exit').length === 1, `${lv.name}: one exit`);
  expect(ents('terminal').length >= 3, `${lv.name}: ${ents('terminal').length} terminals`);
  const grounded = lv.ents.filter((e) => ['terminal', 'checkpoint', 'exit', 'glitch', 'turret'].includes(e.type));
  const floating = grounded.filter((e) => !solidish(at(e.x, e.y + 1)) || at(e.x, e.y) === Tile.Solid);
  expect(floating.length === 0, `${lv.name}: terminals, checkpoints, exits, glitches and turrets stand on ground${floating.length ? ` (${floating.map((e) => `${e.type}@${e.x},${e.y}`)})` : ''}`);
  const buried = lv.ents.filter((e) => 'y' in e && e.type !== 'mover' && e.type !== 'arc' && at(e.x, e.y) === Tile.Solid);
  expect(buried.length === 0, `${lv.name}: nothing placed inside solid tiles${buried.length ? ` (${buried.map((e) => `${e.type}@${e.x},${e.y}`)})` : ''}`);

  // Reachability with a conservative jump envelope (from the real physics):
  // up to 3 rows up within 2 columns, 2 rows within 4, level within 5, any drop within 7.
  const stand = (x, y) => at(x, y) === Tile.Empty && solidish(at(x, y + 1));
  const ride = new Set();
  for (const m of ents('mover')) {
    for (let k = 0; k <= 20; k++) {
      const mx = m.x + Math.round((m.dx * k) / 20), my = m.y + Math.round((m.dy * k) / 20);
      for (let i = 0; i < m.w; i++) ride.add(`${mx + i},${my - 1}`);
    }
  }
  const ok = (x, y) => x >= 0 && x < lv.w && y >= 0 && (stand(x, y) || ride.has(`${x},${y}`));
  const seen = new Set([`${lv.spawn.x},${lv.spawn.y}`]);
  const queue = [[lv.spawn.x, lv.spawn.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (let dy = -3; dy <= lv.h; dy++) {
      const reach = dy <= -3 ? 2 : dy <= -2 ? 4 : dy <= 0 ? 5 : 7;
      for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx, ny = y + dy;
        const k = `${nx},${ny}`;
        if (!seen.has(k) && ok(nx, ny)) { seen.add(k); queue.push([nx, ny]); }
      }
    }
  }
  const near = (e, dx = 1) => { for (let i = -dx; i <= dx; i++) for (let j = -1; j <= 1; j++) if (seen.has(`${e.x + i},${e.y + j}`)) return true; return false; };
  const lost = lv.ents.filter((e) => ['terminal', 'checkpoint', 'exit', 'kit'].includes(e.type) && !near(e));
  expect(lost.length === 0, `${lv.name}: every terminal, checkpoint, kit and the exit can be reached${lost.length ? ` (not: ${lost.map((e) => `${e.type}@${e.x},${e.y}`)})` : ''}`);
}

// Real physics: the easiest route to every objective, each hop simulated
// with the actual player controller (run-up, jump timing, steering).
for (const make of LEVELS) {
  const lv = make();
  const grid = new Grid(lv);
  const at = (x, y) => grid.at(x, y);
  const solidish = (t) => t === Tile.Solid || t === Tile.OneWay;
  const stand = (x, y) => x >= 0 && x < lv.w && at(x, y) === Tile.Empty && at(x, y - 1) !== Tile.Solid && solidish(at(x, y + 1));
  const key = (x, y) => `${x},${y}`;
  // Moving platforms: their stops count as places to stand; hops onto and off them are trusted.
  const ride = new Set();
  for (const m of lv.ents.filter((e) => e.type === 'mover')) for (let k = 0; k <= 20; k++) for (let i = 0; i < m.w; i++) ride.add(key(m.x + i + Math.round((m.dx * k) / 20), m.y - 1 + Math.round((m.dy * k) / 20)));
  // Dijkstra over standing spots; long or high hops cost more, so routes prefer easy moves.
  const dist = new Map([[key(lv.spawn.x, lv.spawn.y), 0]]), prev = new Map();
  const open = [[0, lv.spawn.x, lv.spawn.y]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = open.shift();
    if (d > (dist.get(key(x, y)) ?? Infinity)) continue;
    for (let dy = -3; dy <= lv.h; dy++) {
      const reach = dy <= -3 ? 2 : dy <= -2 ? 4 : dy <= 0 ? 5 : 7;
      for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!(stand(nx, ny) || ride.has(key(nx, ny))) || (dx === 0 && dy === 0)) continue;
        const cost = d + 1 + Math.abs(dx) * 0.3 + (Math.abs(dx) >= 3 ? 4 : 0) + (dy <= -2 ? 4 : 0) + (dy > 0 ? dy * 0.1 : 0);
        if (cost < (dist.get(key(nx, ny)) ?? Infinity)) { dist.set(key(nx, ny), cost); prev.set(key(nx, ny), [x, y]); open.push([cost, nx, ny]); }
      }
    }
  }
  const hop = (fx, fy, tx, ty) => {
    const dir = Math.sign(tx - fx);
    const runs = [0, 1, 2, 3, 4].filter((r) => { for (let i = 1; i <= r; i++) if (!stand(fx - dir * i, fy)) return false; return true; });
    for (const run of runs) for (let jumpAt = -run; jumpAt <= Math.max(1, Math.abs(tx - fx)); jumpAt++) for (const steer of [true, false]) for (const noJump of dy0(fy, ty) ? [false, true] : [false]) {
      const p = new Player();
      p.place((fx - dir * run) * TILE + 3, (fy + 1) * TILE - p.h);
      const cmd = { left: false, right: false, down: false, jump: false, jumpPressed: false };
      let jumped = false, left = false;
      for (let i = 0; i < 240; i++) {
        const cx = p.cx / TILE;
        const past = dir === 0 || (dir > 0 ? cx >= fx + 0.5 + jumpAt : cx <= fx + 0.5 - jumpAt);
        const wantJump = !noJump && !jumped && (dir === 0 || past);
        cmd.jumpPressed = wantJump; cmd.jump = wantJump || (jumped && p.vy < 0);
        if (wantJump) jumped = true;
        // Before take-off, run towards the target; after it, steer for the target's centre.
        const d = tx + 0.5 - cx;
        if (steer && (jumped || noJump) && (!past || jumped || Math.abs(d) < 1.5)) { cmd.right = d > 0.15; cmd.left = d < -0.15; }
        else { cmd.right = dir > 0; cmd.left = dir < 0; }
        p.update(DT, cmd, grid, [], () => {});
        if (!p.onGround) left = true;
        if (p.y > lv.h * TILE) break;
        if ((left || noJump) && p.onGround) {
          const ft = Math.floor((p.y + p.h + 1) / TILE) - 1;
          if (ft === ty && Math.floor(p.cx / TILE) === tx) return true;
          if (Math.abs(p.vx) < 1 && i > 20) break;
        }
      }
    }
    return false;
  };
  const dy0 = (fy, ty) => ty >= fy;
  const bad = [];
  for (const e of lv.ents.filter((x) => ['terminal', 'checkpoint', 'exit', 'kit'].includes(x.type))) {
    let k = key(e.x, e.y);
    if (!dist.has(k)) { for (const dx of [-1, 1]) if (dist.has(key(e.x + dx, e.y))) k = key(e.x + dx, e.y); }
    while (prev.has(k)) {
      const [x, y] = k.split(',').map(Number);
      const [px, py] = prev.get(k);
      const easy = Math.abs(x - px) <= 1 && y >= py;
      if (!easy && !ride.has(k) && !ride.has(key(px, py)) && !hop(px, py, x, y)) bad.push(`${px},${py}→${x},${y}`);
      k = key(px, py);
    }
  }
  expect(bad.length === 0, `${lv.name}: every hop on the way to each objective works with the real physics${bad.length ? ` (failed: ${[...new Set(bad)].join(' ')})` : ''}`);
}

// The envelope above must match the real jump.
{
  const g = newGame(); play(g);
  const p = g.player; const y0 = p.y; let top = y0;
  run(g, 0.05);
  g.update(DT, F({ jump: true, jumpPressed: true }));
  for (let i = 0; i < 60; i++) { g.update(DT, F({ jump: true })); top = Math.min(top, p.y); }
  const full = y0 - top;
  expect(full >= 3 * TILE && full < 3.6 * TILE, `full jump rises ${full.toFixed(1)} px (clears 3 tiles)`);
  run(g, 1);
  const y1 = p.y; top = y1;
  g.update(DT, F({ jump: true, jumpPressed: true }));
  for (let i = 0; i < 60; i++) { g.update(DT, F({ jump: i < 4 })); top = Math.min(top, p.y); }
  expect(y1 - top < full * 0.6, `short tap gives a lower hop (${(y1 - top).toFixed(1)} px)`);
}

// Walking turns into running.
{
  const g = newGame(); play(g);
  run(g, 0.2, F({ right: true }));
  const walk = g.player.vx;
  run(g, 0.5, F({ right: true }));
  expect(walk <= PHYS.walk + 1 && g.player.vx > PHYS.walk + 20, `walk ${walk.toFixed(0)} → run ${g.player.vx.toFixed(0)} px/s`);
}

// Coyote time and jump buffer.
{
  const g = newGame(); play(g);
  const p = g.player;
  // Level 1: ground ends at column 18; walk off the ledge, then jump a moment later.
  p.place(17 * TILE, 12 * TILE - p.h); run(g, 0.05);
  let left = -1;
  for (let i = 0; i < 120 && left < 0; i++) { g.update(DT, F({ right: true })); if (!p.onGround) left = i; }
  g.update(DT, F({ right: true }));
  g.update(DT, F({ right: true, jump: true, jumpPressed: true }));
  expect(p.vy < -PHYS.jump * 0.8, 'coyote time: a jump just after leaving a ledge still works');

  p.place(5 * TILE, 8 * TILE); p.vy = 200; // falling, about 4 tiles above the ground
  let landed = false;
  for (let i = 0; i < 120; i++) {
    const dist = 12 * TILE - (p.y + p.h);
    const press = !landed && dist < 18 && dist > 4;
    g.update(DT, F({ jump: true, jumpPressed: press }));
    if (press) landed = true;
    if (landed && p.vy < -PHYS.jump * 0.8) break;
  }
  expect(p.vy < -PHYS.jump * 0.8, 'jump buffer: pressing jump just before landing jumps on landing');
}

// Terminals, exit, level clear.
{
  const g = newGame(); play(g);
  const p = g.player;
  expect(g.mode === 'play' && g.required.length === 3 && !g.exit.open, 'level 1: three terminals, exit locked');
  for (const t of g.required) {
    p.place(t.x + 3, t.y + t.h - p.h); run(g, 0.1);
    g.update(DT, F({ action: true, actionPressed: true }));
    expect(g.repairing === t, `repair starts at terminal x=${t.x / TILE}`);
    run(g, 0.9);
    expect(t.repaired, 'terminal repaired after holding still');
  }
  expect(g.exit.open, 'all terminals repaired → exit opens');
  const before = g.score;
  p.place(g.exit.x + 3, g.exit.y + g.exit.h - p.h); run(g, 0.1);
  expect(g.mode === 'clear' && g.score > before && g.tally.length >= 3, `exit → level clear with tally (${g.tally.map((t) => `${t.label}:${t.points}`).join(', ')})`);
  run(g, 1.3); g.update(DT, F({ jumpPressed: true, jump: true }));
  expect(g.levelIndex === 1 && g.mode === 'intro' && g.level.name === 'CIRCUIT CITY', 'next: level 2');
}

// Enemies, damage, stomping, pulse, invulnerability.
{
  const g = newGame(); play(g);
  const p = g.player;
  const gl = g.glitches[0];
  p.place(gl.x, gl.y - 2); p.vy = 0; run(g, 0.02);
  g.update(DT, F());
  expect(p.hp === PLAYER.maxHp - 1 && p.invuln > 1, 'touching a glitch costs one health and gives brief invulnerability');
  const hp = p.hp;
  p.place(gl.x, gl.y - 2); run(g, 0.05);
  expect(p.hp === hp, 'no extra damage while invulnerable');

  const g2 = newGame(); play(g2);
  const q = g2.player, en = g2.glitches[0];
  q.place(en.x + 2, en.y - 30); q.vy = 150;
  const s0 = g2.score;
  run(g2, 0.25);
  expect(!en.alive && g2.score >= s0 + 100 && q.hp === PLAYER.maxHp, 'stomping a glitch defeats it without damage');

  const g3 = newGame(); play(g3);
  const r = g3.player, e3 = g3.glitches[0];
  r.place(e3.x - 22, e3.y - 3); run(g3, 0.05);
  g3.update(DT, F({ action: true, actionPressed: true }));
  expect(!e3.alive && g3.pulseT > 0, 'pulse defeats a nearby glitch');
}

// Hazards: spikes, pits, checkpoints, lives, game over.
{
  const g = newGame(); play(g);
  const p = g.player;
  p.place(46 * TILE + 3, 12 * TILE - p.h); run(g, 0.05);
  expect(p.hp < PLAYER.maxHp, 'spikes hurt');
  const g2 = newGame(); play(g2);
  const q = g2.player;
  const cp = g2.checkpoints[0];
  q.place(cp.x, cp.y + cp.h - q.h); run(g2, 0.1);
  expect(cp.active, 'checkpoint activates on touch');
  q.place(20 * TILE, 13 * TILE); q.invuln = 0;
  run(g2, 1.5);
  expect(q.hp === PLAYER.maxHp - 1 && Math.abs(q.x - cp.x) < 2, 'falling into a pit costs health and returns Patch to the checkpoint');
  const lives = g2.lives;
  q.hp = 1; q.invuln = 0; g2.damage(q.cx + 10);
  expect(g2.mode === 'dying' && g2.lives === lives - 1, 'losing all health costs a life');
  run(g2, 1.5);
  expect(g2.mode === 'play' && q.hp === PLAYER.maxHp && Math.abs(q.x - cp.x) < 2, 'respawn at the checkpoint with full health');
  g2.score = 999; g2.lives = 1; q.hp = 1; q.invuln = 0; g2.damage(q.cx + 10); run(g2, 1.5);
  expect(g2.mode === 'gameover', 'no lives left → game over');
  g2.retryLevel(); run(g2, 2.4);
  expect(g2.mode === 'play' && g2.lives === PLAYER.lives && g2.score === g2.levelStartScore, 'retry restarts the level with lives restored');
}

// Pause.
{
  const g = newGame(); play(g);
  g.update(DT, F({ pausePressed: true }));
  const x = g.player.x, t = g.runTime;
  run(g, 0.5, F({ right: true }));
  expect(g.mode === 'paused' && g.player.x === x && g.runTime === t, 'paused: nothing moves, the clock stops');
  g.update(DT, F({ pausePressed: true }));
  expect(g.mode === 'play', 'resume');
}

// Moving platforms carry Patch.
{
  const g = newGame(); play(g, 1);
  const p = g.player, m = g.movers[0];
  p.place(m.x + 8, m.y - p.h - 1); run(g, 0.1);
  const x0 = p.x;
  run(g, 1);
  expect(p.onGround && p.platform === m && Math.abs(p.x - x0) > 4, 'standing on a moving platform carries Patch');
}

// Level 3: gate, arena, boss stages, victory.
{
  const g = newGame(); play(g, 2);
  const p = g.player;
  const gate = g.exit;
  p.place(gate.x - 30, gate.y + gate.h - p.h); run(g, 1, F({ right: true }));
  expect(p.x + p.w <= gate.x + 5, 'core gate blocks the way while locked');
  for (const t of g.required) t.repaired = true;
  const t0 = g.required[0]; t0.repaired = false;
  p.place(t0.x + 3, t0.y + t0.h - p.h); run(g, 0.1); g.update(DT, F({ actionPressed: true, action: true })); run(g, 1);
  expect(gate.open, 'repairing the level 3 terminals opens the gate');
  p.place(gate.x - 10, gate.y + gate.h - p.h); run(g, 1.6, F({ right: true }));
  expect(g.arena.active && g.boss.stage === 'intro', 'walking through the gate starts the boss fight');
  run(g, 2.5);
  expect(g.boss.stage === 'shielded', 'boss shielded');
  const pulseBoss = () => { p.place(g.boss.x - 5, g.boss.y + 8); p.vy = 0; p.invuln = 5; g.pulseCool = 0; g.update(DT, F({ actionPressed: true, action: true })); };
  const hp0 = g.boss.hp; pulseBoss();
  expect(g.boss.hp === hp0, 'pulse does nothing to the shielded boss');
  const repair = (n) => {
    const t = g.terminals.find((x) => x.boss === n);
    p.place(t.x + 3, t.y + t.h - p.h); p.vy = 0; p.invuln = 10; run(g, 0.05);
    g.update(DT, F({ actionPressed: true, action: true })); run(g, 0.9);
    return t;
  };
  expect(g.terminals.find((x) => x.boss === 3).hidden, 'centre terminal hidden at first');
  repair(1); repair(2);
  expect(g.boss.stage === 'unstable' && !g.terminals.find((x) => x.boss === 3).hidden, 'two side repairs → shield down, centre terminal appears');
  run(g, 0.5);
  repair(3);
  expect(g.boss.stage === 'exposed', 'centre repair → core exposed');
  run(g, 1.6);
  for (let i = 0; i < 12 && g.boss.hp > 0; i++) { pulseBoss(); run(g, 0.8); }
  expect(g.boss.stage === 'dying' || g.boss.stage === 'dead', 'six hits defeat the kernel');
  run(g, 3.2);
  expect(g.mode === 'victory' && g.score > 5000, `victory with score ${g.score}`);
}

// Every sound effect the game asks for exists.
{
  const { Audio } = await loadTsTree(path.join(root, 'src/game/audio.ts'));
  const src = Audio.prototype.play.toString();
  const missing = [...new Set(sounds)].filter((s) => !src.includes(`'${s}'`));
  expect(missing.length === 0, `sound effects defined for every event${missing.length ? ` (missing ${missing})` : ''}`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll PATCH QUEST checks passed');
process.exit(failures ? 1 : 0);
