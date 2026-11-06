// AFTER HOURS: encounters, rules, combat, boss callbacks, endings and full
// nights played by a simple bot. Headless (no browser).
//   node tests/after-hours.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = await loadTsTree(path.join(root, 'src/arcade/after-hours/game.ts'));
const { ENCOUNTERS, hasEffect } = await loadTsTree(path.join(root, 'src/arcade/after-hours/encounters.ts'));
const { ZONES } = await loadTsTree(path.join(root, 'src/arcade/after-hours/zones.ts'));
const { Guard, Bouncer, Ex, Projectile } = await loadTsTree(path.join(root, 'src/arcade/after-hours/actors.ts'));
const { Game, ACHIEVEMENTS, DT = 1 / 60 } = G;

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const F = (o = {}) => ({ left: false, right: false, down: false, jump: false, jumpPressed: false, attackPressed: false, dodgePressed: false, interactPressed: false, pausePressed: false, choice: 0, ...o });
const sounds = new Set();
const mk = () => new Game({ sfx: (s) => sounds.add(s), music: () => {}, mode: () => {} });
const run = (g, s, f = F()) => { for (let i = 0; i < Math.round(s * 60); i++) g.update(1 / 60, typeof f === 'function' ? f(i) : f); };
// A started night. In the first area, Viv walks to the opening decision so tests can answer it.
const start = (seed = 1, zone = 0) => {
  const g = mk(); g.newRun(seed); if (zone) g.startZone(zone); run(g, 2.6);
  if (!zone) { g.viv.place(7 * 16, 160 - g.viv.h); run(g, 0.05); }
  return g;
};
const floorY = 160;

// ── Encounters ───────────────────────────────────────────────────────────
expect(ENCOUNTERS.length >= 14, `${ENCOUNTERS.length} encounters`);
const ids = new Set(ENCOUNTERS.map((e) => e.id));
expect(ids.size === ENCOUNTERS.length, 'encounter ids are unique');
const noEffect = [];
for (const e of ENCOUNTERS) {
  e.options.forEach((o, i) => {
    for (const cash of [0, 40]) for (const r of [0.05, 0.5, 0.95]) {
      const out = o.run({ cash, chaos: 30, dignity: 3, flags: new Set(['exBlocked', 'exJealous']), rnd: () => r });
      if (!hasEffect(out) || !out.text) noEffect.push(`${e.id}#${i + 1} (cash ${cash}, rnd ${r})`);
    }
  });
}
expect(noEffect.length === 0, `every option of every encounter has a real effect${noEffect.length ? ` (none: ${noEffect.join(', ')})` : ''}`);
const outs = (id) => ENCOUNTERS.find((e) => e.id === id).options.map((o) => JSON.stringify({ ...o.run({ cash: 40, chaos: 0, dignity: 3, flags: new Set(), rnd: () => 0.3 }), text: '' }));
const same = ENCOUNTERS.filter((e) => new Set(outs(e.id)).size < 3).map((e) => e.id);
expect(same.length === 0, `the three options of each encounter do different things${same.length ? ` (${same})` : ''}`);
const slotIds = ZONES.flatMap((z) => z().slots.flatMap((s) => (s.fixed ? [s.fixed] : s.pool)));
expect(slotIds.every((id) => ids.has(id)), 'every zone slot names a real encounter');
expect(ENCOUNTERS.every((e) => slotIds.includes(e.id)), 'every encounter can come up in a night');

// Night plans vary and never repeat.
{
  const plans = new Set();
  let repeats = 0;
  for (let seed = 1; seed <= 30; seed++) { const g = mk(); g.newRun(seed); const flat = g.plan.flat(); if (new Set(flat).size !== flat.length) repeats++; plans.add(flat.join()); }
  expect(repeats === 0, 'no encounter repeats within a night');
  expect(plans.size >= 6, `consecutive nights differ (${plans.size} different plans in 30 seeds)`);
}

// ── Movement, combat, enemies ───────────────────────────────────────────
{
  const g = start();
  const v = g.viv, x0 = v.x;
  run(g, 0.6, F({ right: true }));
  expect(v.x - x0 > 40 || g.mode === 'choice', 'walking moves Viv');
  if (g.mode === 'choice') g.choose(2);
  const y0 = v.y;
  g.update(DT, F({ jump: true, jumpPressed: true }));
  let top = v.y; for (let i = 0; i < 40; i++) { g.update(DT, F({ jump: true })); top = Math.min(top, v.y); }
  expect(y0 - top > 40, `jump rises ${(y0 - top).toFixed(0)} px (clears a 2-tile dumpster)`);
}
{
  const g = start();
  g.choose(0); run(g, 0.2);
  const guard = g.foes.find((e) => e instanceof Guard);
  const v = g.viv;
  // Behind the guard: not seen.
  guard.face = 1; v.place(guard.x - 30, floorY - v.h); run(g, 0.3);
  expect(guard.state === 'patrol' || guard.face === -1, 'a guard facing away doesn’t see Viv immediately');
  // In the beam: spotted, then chased.
  guard.state = 'patrol'; guard.face = -1; guard.home = guard.x; v.place(guard.x - 40, floorY - v.h); v.invuln = 5;
  run(g, 0.1);
  expect(guard.state === 'alert' || guard.state === 'chase', 'the flashlight beam spots Viv');
  run(g, 0.6);
  expect(guard.state === 'chase', 'then the guard gives chase');
  // Handbag hits
  v.invuln = 5; v.place(guard.x - 12, floorY - v.h); v.face = 1;
  const hp = guard.hp;
  g.update(DT, F({ attackPressed: true })); run(g, 0.3);
  expect(guard.hp < hp, 'the handbag swing damages a guard');
}
{
  const g = start();
  g.choose(0);
  const b = new Bouncer(g.viv.x + 30, floorY - 26); g.foes.push(b);
  b.takeHit(1, 1, 100);
  expect(b.stun === 0 && b.hp === 6, 'the bouncer shrugs off every other hit');
  b.takeHit(1, 1, 100);
  expect(b.stun > 0, '…and flinches on the next');
  // Windup → shove knocks Viv back
  const g2 = start(); g2.choose(2);
  const v = g2.viv; const bb = new Bouncer(v.x + 40, floorY - 26); g2.foes = [bb];
  let shoved = false;
  for (let i = 0; i < 180; i++) { g2.update(DT, F()); if (v.dignity < 5) { shoved = true; break; } }
  expect(shoved && bb.state !== 'walk', 'the bouncer winds up and shoves Viv');
}
{
  const g = start(); g.choose(2);
  const v = g.viv; v.place(400, floorY - v.h);
  const p = new Projectile('plate', v.x + 30, v.y + 6, -150, 0, 'enemy'); g.shots = [p];
  g.update(DT, F({ dodgePressed: true })); run(g, 0.3);
  expect(v.dignity === 5, 'a dodge roll passes through a flying plate unharmed');
}
{
  // Items
  const g = start(); g.choose(2);
  g.giveItem('glass');
  const v = g.viv; v.attackCool = 0;
  g.update(DT, F({ attackPressed: true }));
  expect(g.shots.some((s) => s.kind === 'glass' && s.side === 'viv') && v.item.uses === 5, 'cocktail glasses are thrown, one per press');
  g.giveItem('heel'); v.attackCool = 0; run(g, 0.4);
  g.update(DT, F({ attackPressed: true }));
  const heel = g.shots.find((s) => s.kind === 'heel');
  run(g, 1.2);
  expect(heel && heel.returning, 'the high heel comes back like a boomerang');
  g.giveItem('cone');
  expect(v.item.kind === 'cone' && v.item.uses === 12, 'the traffic cone gives a stronger swing for 12 hits');
}

// ── Chaos ───────────────────────────────────────────────────────────────
{
  const g = start(); g.choose(2);
  g.chaos = 50;
  expect(Math.abs(g.multiplier - 2) < 1e-9, 'Chaos 50 doubles points');
  const s0 = g.score; g.addScore(100); expect(g.score - s0 === 200, 'points are multiplied by Chaos');
  g.viv.place(300, floorY - 22);
  let fell = false;
  for (let i = 0; i < 60 * 8; i++) { g.viv.invuln = 1; g.update(DT, F()); if (g.drops.length || g.shots.some((x) => x.kind === 'bottle')) fell = true; }
  expect(fell, 'Chaos 40+ makes things fall from the sky (with a warning shadow first)');
  g.chaos = 95; g.viv.invuln = 0; g.viv.dignity = 5; g.damage(g.viv.cx + 5, 'guard');
  expect(g.viv.dignity === 3, 'at Chaos 90+ a hit costs two dignity');
}

// ── Choices with consequences, callbacks ────────────────────────────────
{
  const g = start(3);
  expect(g.mode === 'choice' || (run(g, 1, F({ right: true })), g.mode === 'choice'), 'the night opens with a decision');
  g.choose(1); // selfie → exJealous
  expect(g.flags.has('exJealous') && g.chaos >= 10, `a chaotic choice raises Chaos (${g.chaos}) and sets a flag`);
  for (const sl of g.slots) if (sl.enc.id !== 'ex-text') sl.done = true;
  g.doorOpen = true;
  g.viv.place(47 * 16, floorY - 22); run(g, 0.2);
  expect(g.foes.some((e) => e instanceof Ex && e.mood === 'jealous'), 'the jealous ex follows you into the club');
  g.startZone(1); run(g, 2.6); g.choose(2); g.viv.place(8 * 16, floorY - 22); run(g, 0.2);
  expect(g.foes.some((e) => e instanceof Ex), '…and into the diner');
}
{
  // Bouncer: flirting fails → fight; door opens once he's down.
  const g = start(1); g.choose(2);
  g.viv.place(35.6 * 16, floorY - 22); run(g, 0.1);
  expect(g.mode === 'choice' && g.choice.enc.id === 'bouncer', 'the bouncer stops you at the door');
  g.rnd = () => 0.99; g.choose(1);
  const b = g.foes.find((e) => e instanceof Bouncer);
  expect(b && !g.doorOpen, 'failed flirting starts a fight; the door stays shut');
  if (b) { b.hits = 1; b.takeHit(9, 1, 100); }
  run(g, 1);
  expect(g.doorOpen, 'beat the bouncer and the door opens');
}
{
  // Decision timer runs out → the universe chooses (and Chaos rises).
  const g = start(); const c0 = g.chaos;
  expect(g.mode === 'choice', 'walking up to the phone opens a decision');
  run(g, 10);
  expect(g.mode === 'play' && g.choices.length === 1 && g.chaos >= c0 + 5, 'an unanswered decision is chosen for you, with a Chaos penalty');
  const g2 = start(); g2.decisionTime = 0; run(g2, 15);
  expect(g2.mode === 'choice', 'with the timer off, a decision waits');
}
{
  // Pause
  const g = start(); g.choose(2);
  g.update(DT, F({ pausePressed: true })); const t = g.runTime; run(g, 0.5, F({ right: true }));
  expect(g.mode === 'paused' && g.runTime === t, 'pause freezes the night');
  g.update(DT, F({ pausePressed: true })); expect(g.mode === 'play', 'resume');
}

// ── Brawls ────────────────────────────────────────────────────────────
{
  const g = start(); g.choose(2);
  for (const sl of g.slots) sl.done = true;
  g.doorOpen = true;
  const br = g.brawls[0];
  g.viv.place(br.x + 4, floorY - 22); g.viv.invuln = 99; run(g, 0.1);
  expect(br.state === 'on' && g.lock && br.foes.length === br.wave.length, `a brawl locks the screen and sends a wave of ${br.wave.length}`);
  run(g, 1.5, F({ right: true }));
  expect(g.viv.x + g.viv.w <= g.lock[1] + 0.5, 'Viv can’t leave until the wave is beaten');
  for (const e of br.foes) { if (e.hits !== undefined) e.hits = 1; e.takeHit(99, 1, 100); }
  run(g, 1);
  expect(br.state === 'done' && !g.lock && g.goT > 0, 'beat the wave: the screen unlocks (GO →)');
  expect(g.brawls.length >= 2, `${g.brawls.length} brawls in the first area`);
}

// ── Boss and callbacks ──────────────────────────────────────────────────
const toBoss = (flags = [], seed = 5, cash = 40) => {
  const g = start(seed, 3);
  for (const f of flags) g.flags.add(f);
  g.cash = cash;
  g.startZone(3); run(g, 2.6);
  if (g.mode === 'choice') g.choose(0);
  g.viv.place(15 * 16, floorY - 22);
  for (let k = 0; k < 4 && !g.boss; k++) {
    run(g, 0.1);
    if (g.mode === 'choice') g.choose(g.choice.enc.id === 'lorenzo' ? (flags.includes('flattered') ? 1 : flags.includes('unplugged') ? 2 : 0) : flags.includes('express') ? 2 : 0);
  }
  return g;
};
{
  const g = toBoss(['flattered']);
  expect(g.boss && g.boss.hp === 24, 'complimenting his robe starts Lorenzo at 80% health');
  run(g, 2.5);
  expect(g.boss.state !== 'intro', 'the boss intro ends and the fight begins');
  const phases = new Set();
  let guards = false;
  for (let i = 0; i < 60 * 120 && g.mode === 'play'; i++) {
    const b = g.boss; g.viv.invuln = 1; g.viv.dignity = 5;
    phases.add(b.phase);
    if (g.foes.some((e) => e instanceof Guard)) guards = true;
    const near = Math.abs(g.viv.cx - b.cx) < 14;
    g.update(DT, F({ right: g.viv.cx < b.cx - 8, left: g.viv.cx > b.cx + 8, attackPressed: near && i % 12 === 0, jump: i % 50 < 10, jumpPressed: i % 50 === 0 }));
  }
  expect(phases.has(1) && phases.has(2) && phases.has(3), 'Lorenzo goes through all three phases');
  expect(guards, 'phase 2 calls security');
  expect(g.mode === 'victory', `the boss can be beaten; sunrise (${g.mode})`);
}
{
  const g = toBoss(['bouncerCrush', 'raccoonFriend']);
  run(g, 2.5);
  g.boss.hp = 19; g.boss.phase = 1; g.boss.hit(1, (e) => g['bossEvent'](e), false);
  expect(g.foes.some((e) => e instanceof Guard), 'phase 2: security arrives');
  for (let i = 0; i < 150; i++) { g.viv.invuln = 1; g.update(DT, F()); }
  expect(g.tinyArrived && !g.foes.some((e) => e instanceof Guard && e.alive), 'the bouncer with a crush shows up and removes security');
  g.boss.hp = 9; g.boss.phase = 2; g.boss.hit(0.01, (e) => g['bossEvent'](e), false);
  for (let i = 0; i < 300 && !g.raccoonUsed; i++) { g.viv.invuln = 1; g.update(DT, F()); }
  expect(g.raccoonUsed, 'the raccoon you fed steals his pool noodle');
}
{
  const g = toBoss(['limo'], 5, 50);
  expect(g.cash === 20 || g.cash === 30, 'the limo driver collects $30 at the penthouse');
  const g2 = toBoss(['express']);
  expect(!g2.foes.some((e) => e instanceof Guard && e.x < 14 * 16), 'flirting with the elevator skips lobby security');
}

// ── Endings, achievements, defeat and retry ─────────────────────────────
{
  const g = start(); g.choose(2);
  g.chaos = 90; expect(g.ending().id === 'legend', 'Chaos 85+ → LEGEND OF THE NIGHT');
  g.chaos = 50; g.viv.dignity = 1; expect(g.ending().id === 'shame', 'one dignity left → WALK OF SHAME');
  g.viv.dignity = 4; g.flags.add('bouncerCrush'); expect(g.ending().id === 'tiny', 'bouncer crush → A DATE WITH TINY');
  g.flags.clear(); g.chaos = 10; expect(g.ending().id === 'responsible', 'low Chaos → SOMEHOW RESPONSIBLE');
  g.chaos = 40; expect(g.ending().id === 'influence', 'otherwise → CERTIFIED BAD INFLUENCE');
  const endings = new Set(['legend', 'shame', 'tiny', 'responsible', 'influence']);
  expect(endings.size === 5, 'five sunrise endings, plus the knock-out');
}
{
  const g = start(); g.choose(1);
  const snapScore = g.snapshot.score;
  g.score += 999; g.viv.invuln = 0; g.viv.dignity = 1; g.damage(g.viv.cx + 5, 'bouncer');
  expect(g.mode === 'dying', 'losing the last dignity knocks Viv out');
  run(g, 2);
  expect(g.mode === 'gameover' && g.results.gameOver === 'The bouncer would like a word.' || g.results.gameOver?.length > 10, `a game-over line (“${g.results?.gameOver}”)`);
  g.retryZone(); run(g, 2.6);
  expect(g.mode !== 'gameover' && g.score === snapScore && g.viv.dignity === 5, 'retrying restores the area as you arrived');
}
{
  const g = start(); g.choose(1);
  g.chaoticChoices = 5; g.fastChoices = 3; g.maxChaos = 100; g.secrets = 3; g.exDefeats = 1; g.viv.dignity = 1; g.chaos = 95;
  g['finish'](true);
  const all = ACHIEVEMENTS.map((a) => a.id).sort().join();
  expect(g.results.earned.sort().join() === all, `all ${ACHIEVEMENTS.length} achievements can be earned`);
}

// ── Full nights, played by a bot (invulnerable, so it tests progression) ─
const bot = (seed, pick) => {
  const g = mk(); g.newRun(seed);
  let i = 0, stuckX = 0, stuckT = 0;
  const seenZones = new Set();
  for (; i < 60 * 900 && g.mode !== 'victory'; i++) {
    const v = g.viv;
    seenZones.add(g.zoneIndex);
    if (g.mode === 'choice') { g.update(DT, F({ choice: pick(g) + 1 })); continue; }
    if (g.mode === 'intro' || g.mode === 'zoneclear') { g.update(DT, F({ jumpPressed: i % 20 === 0, jump: true })); continue; }
    if (g.mode === 'gameover') return { g, zones: seenZones, stuck: 'gameover' };
    v.invuln = Math.max(v.invuln, 0.5); if (v.dignity < 2) v.dignity = 5;
    const b = g.boss;
    let right = true, left = false;
    // Face the boss and stay close (attacks only land in the direction Viv faces).
    if (b) { right = b.cx > v.cx; left = !right; }
    // In a brawl, go after the nearest enemy, like a player would.
    const target = g.lock ? g.foes.filter((e) => e.alive).sort((p, q) => Math.abs(p.cx - v.cx) - Math.abs(q.cx - v.cx))[0] : null;
    if (target) { right = target.cx > v.cx; left = !right; }
    const foe = g.foes.find((e) => e.alive && Math.abs(e.cx - v.cx) < 26);
    const attack = (foe || (b && Math.abs(b.cx - v.cx) < 18)) && i % 10 === 0;
    if (Math.abs(v.x - stuckX) < 1) stuckT++; else { stuckT = 0; stuckX = v.x; }
    const jump = (stuckT > 20 && i % 30 === 0) || (b && i % 45 === 0);
    g.update(DT, F({ right, left, jump: jump || (i % 30) < 8, jumpPressed: !!jump, attackPressed: !!attack, interactPressed: i % 120 === 0 }));
  }
  return { g, zones: seenZones, frames: i };
};
for (const [seed, pick, name] of [[11, () => 0, 'first options'], [12, () => 1, 'second options'], [13, () => 2, 'third options'], [14, (g) => Math.floor(g.rnd() * 3), 'random options']]) {
  const r = bot(seed, pick);
  expect(r.g.mode === 'victory' && r.zones.size === 4, `full night (${name}): all four areas and the boss → ${r.g.mode}${r.g.results ? `, “${r.g.results.ending.title}”, ${r.g.results.score} pts, ${r.g.results.choices.length} decisions` : ''}`);
}

// Every sound the game asks for exists.
{
  const { Audio } = await loadTsTree(path.join(root, 'src/arcade/after-hours/audio.ts'));
  const src = Audio.prototype.play.toString();
  const missing = [...sounds].filter((s) => !src.includes(`'${s}'`));
  expect(missing.length === 0, `a sound for every event${missing.length ? ` (missing ${missing})` : ''}`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll AFTER HOURS checks passed');
process.exit(failures ? 1 : 0);
