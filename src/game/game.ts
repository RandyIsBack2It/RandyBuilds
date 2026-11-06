// PATCH QUEST — game state and rules. No DOM: render.ts draws this state,
// ui.ts shows the menus, audio.ts plays what `hooks.sfx` asks for. That
// keeps the whole simulation testable in Node (tests/patch-quest.mjs).
import { TILE, W, H, PLAYER, PULSE, REPAIR, SCORE } from './config';
import { loadLevel, levelCount, type LevelData, type Ent } from './levels';
import { Grid, overlaps, touchesSpike } from './physics';
import { Player, type PlayerEvent } from './player';
import { Glitch, Drone, Turret, Bullet, Mover, Arc, Terminal, Pickup, Checkpoint, Exit, Wave, type Box } from './entities';
import { Boss, type BossEvent } from './boss';
import { Particles } from './particles';
import type { Frame } from './input';
import type { Sfx } from './audio';

export type Mode = 'title' | 'intro' | 'play' | 'paused' | 'dying' | 'clear' | 'gameover' | 'victory';

export interface Hooks {
  sfx(name: Sfx): void;
  music(name: 'title' | 'boot' | 'city' | 'core' | 'boss' | 'victory' | null): void;
  mode(m: Mode, prev: Mode): void;
}

export interface Tally { label: string; points: number }

const COLORS = {
  spark: ['#47f3ff', '#eef3fb', '#ffe066'],
  glitch: ['#ff3df2', '#7a32e0', '#39ff88', '#eef3fb'],
  hurt: ['#ff4d6d', '#ff8c2e', '#eef3fb'],
  repair: ['#39ff88', '#47f3ff', '#eef3fb', '#ffe066'],
  boss: ['#ff4d6d', '#ff8c2e', '#ffe066', '#eef3fb', '#ff3df2'],
};

export class Game {
  mode: Mode = 'title';
  modeT = 0;
  pausedFrom: Mode = 'play';
  levelIndex = 0;
  level!: LevelData;
  grid!: Grid;
  player = new Player();
  glitches: Glitch[] = [];
  drones: Drone[] = [];
  turrets: Turret[] = [];
  bullets: Bullet[] = [];
  movers: Mover[] = [];
  arcs: Arc[] = [];
  terminals: Terminal[] = [];
  pickups: Pickup[] = [];
  checkpoints: Checkpoint[] = [];
  signs: { x: number; y: number; text: string }[] = [];
  waves: Wave[] = [];
  exit: Exit | null = null;
  boss: Boss | null = null;
  arena: { x0: number; x1: number; active: boolean } | null = null;
  particles = new Particles();

  score = 0;
  levelStartScore = 0;
  lives = PLAYER.lives;
  cells = 0;
  cellsTotal = 0;
  defeated = 0;
  runTime = 0;
  levelTime = 0;
  t = 0;
  respawn = { x: 0, y: 0 };
  cam = { x: 0, y: 0 };
  shake = 0;
  shakeOn = true;
  pulseT = 0;
  pulseCool = 0;
  repairing: Terminal | null = null;
  toast = { text: '', t: 0 };
  tally: Tally[] = [];
  flash = 0;
  /** Set by the page: what the action button is called in signs ("E" or "ACT"). */
  actLabel = 'E';

  constructor(public hooks: Hooks) {}

  setMode(m: Mode) {
    const prev = this.mode;
    this.mode = m;
    this.modeT = 0;
    this.hooks.mode(m, prev);
  }

  // ── Runs and levels ──────────────────────────────────────────────────
  newRun() {
    this.score = 0;
    this.lives = PLAYER.lives;
    this.runTime = 0;
    this.defeated = 0;
    this.startLevel(0);
  }

  startLevel(i: number) {
    this.levelIndex = i;
    this.levelStartScore = this.score;
    this.load(loadLevel(i));
    this.player.hp = PLAYER.maxHp;
    this.setMode('intro');
    this.hooks.music(null);
  }

  /** After a game over: the same level again, score as it was when the level began. */
  retryLevel() {
    this.score = this.levelStartScore;
    this.lives = PLAYER.lives;
    this.startLevel(this.levelIndex);
  }

  private load(lv: LevelData) {
    this.level = lv;
    this.grid = new Grid(lv);
    this.glitches = []; this.drones = []; this.turrets = []; this.bullets = []; this.movers = []; this.arcs = [];
    this.terminals = []; this.pickups = []; this.checkpoints = []; this.signs = []; this.waves = [];
    this.exit = null; this.boss = null; this.arena = null;
    this.particles.clear();
    this.cells = 0;
    this.levelTime = 0;
    this.t = 0;
    this.repairing = null;
    this.pulseT = 0; this.pulseCool = 0;
    this.toast.t = 0;
    const px = (x: number) => x * TILE;
    const feet = (y: number) => (y + 1) * TILE;
    for (const e of lv.ents) this.spawn(e, px, feet);
    this.cellsTotal = this.pickups.filter((p) => p.kind === 'cell').length;
    this.respawn = { x: px(lv.spawn.x) + 3, y: feet(lv.spawn.y) - PLAYER.h };
    this.player.place(this.respawn.x, this.respawn.y);
    this.player.face = 1;
    this.player.invuln = 0;
    this.snapCamera();
  }

  private spawn(e: Ent, px: (x: number) => number, feet: (y: number) => number) {
    switch (e.type) {
      case 'cell': case 'kit': this.pickups.push(new Pickup(px(e.x) + (e.type === 'cell' ? 4 : 3), feet(e.y) - (e.type === 'cell' ? 12 : 11), e.type)); break;
      case 'terminal': this.terminals.push(new Terminal(px(e.x), feet(e.y) - 22, e.boss ?? 0, e.boss === 3)); break;
      case 'checkpoint': this.checkpoints.push(new Checkpoint(px(e.x) + 3, feet(e.y) - 24)); break;
      case 'exit': this.exit = new Exit(px(e.x), feet(e.y) - 32, this.level.theme === 'core'); break;
      case 'glitch': this.glitches.push(new Glitch(px(e.x) + 1, feet(e.y) - 10)); break;
      case 'drone': this.drones.push(new Drone(px(e.x) + 2, px(e.y) + 3, e.rx * TILE, !!e.chase)); break;
      case 'turret': this.turrets.push(new Turret(px(e.x) + 1, feet(e.y) - 14, e.dir)); break;
      case 'mover': this.movers.push(new Mover(px(e.x), px(e.y), e.w, e.dx * TILE, e.dy * TILE, e.period, e.phase)); break;
      case 'arc': this.arcs.push(new Arc(px(e.x) + 8, px(e.y0), feet(e.y1), e.period, e.offset)); break;
      case 'sign': this.signs.push({ x: px(e.x), y: px(e.y), text: e.text }); break;
      case 'boss': {
        this.arena = { x0: px(e.arena[0]), x1: px(e.arena[1] + 1), active: false };
        this.boss = new Boss(px(e.x), px(e.y), this.arena.x0, this.arena.x1, feet(11));
        break;
      }
    }
  }

  /** Terminals that open the exit (the boss's own terminals don't). */
  get required() { return this.terminals.filter((t) => t.boss === 0); }
  get repairedCount() { return this.required.filter((t) => t.repaired).length; }

  // ── Main update ─────────────────────────────────────────────────────
  update(dt: number, input: Frame) {
    this.modeT += dt;
    if (this.toast.t > 0) this.toast.t -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (input.pausePressed) {
      if (this.mode === 'play' || this.mode === 'intro') { this.pause(); return; }
      if (this.mode === 'paused') { this.resume(); return; }
    }
    switch (this.mode) {
      case 'intro':
        this.particles.update(dt);
        if (this.modeT > 2.2 || (this.modeT > 0.6 && (input.jumpPressed || input.actionPressed))) this.beginPlay();
        return;
      case 'play': this.play(dt, input); return;
      case 'dying':
        this.particles.update(dt);
        this.updateShake(dt);
        if (this.modeT > 1.3) this.afterDeath();
        return;
      case 'clear':
        this.particles.update(dt);
        if (this.modeT > 1.2 && (input.jumpPressed || input.actionPressed)) this.nextLevel();
        return;
      case 'victory':
        // Fireworks of repair sparks over the restored core.
        if (Math.random() < dt * (this.particles.density < 1 ? 1.5 : 4)) {
          this.particles.emit(this.cam.x + 30 + Math.random() * (W - 60), this.cam.y + 30 + Math.random() * 80, 28, COLORS.repair, 90, { grav: 50, life: 1 });
        }
        this.particles.update(dt);
        return;
      case 'gameover': case 'title':
        this.particles.update(dt);
        return;
    }
  }

  private beginPlay() {
    this.setMode('play');
    this.hooks.music(this.arena?.active ? 'boss' : this.level.theme === 'boot' ? 'boot' : this.level.theme);
  }

  pause() {
    if (this.mode !== 'play' && this.mode !== 'intro') return;
    this.pausedFrom = this.mode;
    this.setMode('paused');
    this.hooks.music(null);
  }

  resume() {
    if (this.mode !== 'paused') return;
    if (this.pausedFrom === 'intro') { this.setMode('intro'); return; }
    this.beginPlay();
  }

  restartLevel() {
    this.score = this.levelStartScore;
    this.startLevel(this.levelIndex);
  }

  private play(dt: number, input: Frame) {
    this.t += dt;
    this.levelTime += dt;
    this.runTime += dt;
    this.heldJump = input.jump;
    const p = this.player;

    for (const m of this.movers) m.update(dt);

    const events = (e: PlayerEvent) => {
      if (e === 'jump') { this.hooks.sfx('jump'); this.particles.emit(p.cx, p.y + p.h, 4, '#9db0c4', 30, { grav: 60, life: 0.25 }); }
      if (e === 'land') { this.hooks.sfx('land'); this.particles.emit(p.cx, p.y + p.h, 6, '#9db0c4', 40, { grav: 80, life: 0.3, up: true }); }
      if (e === 'step') this.hooks.sfx('step');
    };
    p.update(dt, input, this.grid, this.movers, events);
    this.keepInLevel();

    // Action: repair a terminal when standing at one, otherwise pulse.
    if (this.pulseCool > 0) this.pulseCool -= dt;
    if (this.pulseT > 0) this.pulseT -= dt;
    if (input.actionPressed && !this.repairing && p.lock <= 0) {
      const term = this.terminalInReach();
      if (term && p.onGround) this.startRepair(term);
      else if (this.pulseCool <= 0) this.pulse();
    }
    if (this.repairing) this.updateRepair(dt);

    // Enemies and hazards
    const pcx = p.cx, pcy = p.cy;
    for (const g of this.glitches) g.update(dt, this.grid);
    for (const d of this.drones) d.update(dt, pcx, pcy);
    for (const tu of this.turrets) tu.update(dt, pcx, pcy, (b) => { this.bullets.push(b); if (this.onScreen(b)) this.hooks.sfx('shoot'); });
    for (const b of this.bullets) b.update(dt, this.grid);
    for (const w of this.waves) w.update(dt, this.grid);
    if (this.boss && this.arena?.active) this.boss.update(dt, pcx, pcy, (e) => this.bossEvent(e));
    this.glitches = this.glitches.filter((g) => !g.dead);
    this.drones = this.drones.filter((d) => !d.dead);
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.waves = this.waves.filter((w) => !w.dead);
    this.collide();

    // Pickups, checkpoints, exit
    for (const pk of this.pickups) {
      pk.t += dt;
      if (pk.taken || !overlaps(p, pk)) continue;
      pk.taken = true;
      if (pk.kind === 'cell') {
        this.cells++; this.score += SCORE.cell; this.hooks.sfx('cell');
        this.particles.emit(pk.x + 4, pk.y + 4, 8, COLORS.spark, 50, { grav: 0, life: 0.35 });
      } else {
        if (p.hp < PLAYER.maxHp) p.hp++; else this.score += 200;
        this.hooks.sfx('kit');
        this.particles.emit(pk.x + 5, pk.y + 5, 10, ['#ff4d6d', '#eef3fb'], 40, { grav: -30, life: 0.6 });
      }
    }
    for (const c of this.checkpoints) {
      c.t += dt;
      if (!c.active && overlaps(p, c)) {
        for (const o of this.checkpoints) o.active = false;
        c.active = true;
        this.respawn = { x: c.x, y: c.y + c.h - PLAYER.h };
        this.hooks.sfx('checkpoint');
        this.say('CHECKPOINT');
        this.particles.emit(c.x + 5, c.y + 4, 12, COLORS.spark, 50, { grav: 40, life: 0.6 });
      }
    }
    this.updateExit(dt);

    if (p.y > this.level.h * TILE + 24) this.fellOut();
    this.particles.update(dt);
    this.updateCamera(dt);
    this.updateShake(dt);
  }

  private keepInLevel() {
    const p = this.player;
    const min = this.arena?.active ? this.arena.x0 : 0;
    const max = (this.arena?.active ? this.arena.x1 : this.level.w * TILE) - p.w;
    if (p.x < min) { p.x = min; p.vx = 0; }
    if (p.x > max) { p.x = max; p.vx = 0; }
  }

  private onScreen(b: Box) { return b.x + b.w > this.cam.x && b.x < this.cam.x + W && b.y + b.h > this.cam.y && b.y < this.cam.y + H; }

  terminalInReach() {
    const p = this.player;
    return this.terminals.find((t) => !t.repaired && !t.hidden && Math.abs(p.cx - (t.x + t.w / 2)) < REPAIR.reach && p.y + p.h > t.y && p.y < t.y + t.h + 2) ?? null;
  }

  private startRepair(t: Terminal) {
    this.repairing = t;
    this.player.lock = REPAIR.time;
    this.player.vx = 0;
    this.player.face = this.player.cx < t.x + t.w / 2 ? 1 : -1;
    this.hooks.sfx('repair');
  }

  private updateRepair(dt: number) {
    const t = this.repairing!;
    t.progress = Math.min(1, t.progress + dt / REPAIR.time);
    if (Math.random() < dt * 30) this.particles.emit(t.x + 8, t.y + 7, 1, COLORS.repair, 40, { grav: -20, life: 0.4 });
    if (t.progress < 1) return;
    t.repaired = true;
    t.glow = 1;
    this.repairing = null;
    this.player.lock = 0;
    this.score += SCORE.terminal;
    this.hooks.sfx('repairDone');
    this.particles.emit(t.x + 8, t.y + 8, 26, COLORS.repair, 90, { grav: 60, life: 0.8 });
    this.addShake(2);
    if (t.boss && this.boss) {
      this.boss.nodeRepaired((e) => this.bossEvent(e));
      this.say(t.boss === 3 ? 'CORE EXPOSED! PULSE IT' : this.boss.nodes === 2 ? 'SHIELD DOWN' : 'NODE 1 OF 2 RESTORED');
    } else if (this.required.every((x) => x.repaired)) {
      if (this.exit) this.exit.open = true;
      this.hooks.sfx('open');
      this.say(this.exit?.gate ? 'CORE GATE OPEN' : 'EXIT OPEN >');
    } else this.say(`SYSTEM ${this.repairedCount}/${this.required.length} REPAIRED`);
  }

  private pulse() {
    const p = this.player;
    this.pulseT = PULSE.time;
    this.pulseCool = PULSE.cooldown;
    this.hooks.sfx('pulse');
    const cx = p.cx, cy = p.cy, r = PULSE.radius;
    const near = (b: Box, extra = 0) => {
      const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
      return Math.hypot(nx - cx, ny - cy) <= r + extra;
    };
    for (const g of this.glitches) if (g.alive && near(g)) this.defeat(g, g.x + 7, g.y + 5);
    for (const d of this.drones) if (d.alive && near(d)) this.defeat(d, d.x + 6, d.y + 5);
    for (const tu of this.turrets) {
      if (!tu.fixed && near(tu)) {
        tu.fixed = true; this.score += SCORE.turret; this.hooks.sfx('fixTurret');
        this.particles.emit(tu.x + 7, tu.y + 7, 14, COLORS.repair, 60, { life: 0.5 });
      }
    }
    for (const b of this.bullets) if (near(b)) { b.dead = true; this.score += 10; this.particles.emit(b.x + 3, b.y + 3, 4, COLORS.spark, 40, { grav: 0, life: 0.25 }); }
    if (this.boss && this.arena?.active && Math.hypot(this.boss.x - cx, this.boss.y - cy) <= r + this.boss.r) {
      if (this.boss.hit((e) => this.bossEvent(e))) this.bossDamaged();
      else if (this.boss.touchable) this.particles.emit(this.boss.x, this.boss.y, 6, '#47f3ff', 50, { grav: 0, life: 0.3 });
    }
  }

  private defeat(e: Glitch | Drone, x: number, y: number) {
    e.kill();
    this.defeated++;
    this.score += SCORE.enemy;
    this.hooks.sfx('defeat');
    this.particles.emit(x, y, 16, COLORS.glitch, 80, { life: 0.5 });
  }

  private collide() {
    const p = this.player;
    const hurtBox = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 1 };
    const stompable = (e: Box) => p.vy > 40 && p.y + p.h - e.y < 9;
    for (const g of this.glitches) {
      if (!g.alive || !overlaps(hurtBox, g)) continue;
      if (stompable(g)) { this.defeat(g, g.x + 7, g.y + 5); this.hooks.sfx('stomp'); p.bounce(this.heldJump); }
      else this.damage(g.x + g.w / 2);
    }
    for (const d of this.drones) {
      if (!d.alive || !overlaps(hurtBox, d)) continue;
      if (stompable(d)) { this.defeat(d, d.x + 6, d.y + 5); this.hooks.sfx('stomp'); p.bounce(this.heldJump); }
      else this.damage(d.x + d.w / 2);
    }
    for (const tu of this.turrets) if (!tu.fixed && overlaps(hurtBox, tu)) this.damage(tu.x + tu.w / 2);
    for (const b of this.bullets) if (overlaps(hurtBox, b)) { b.dead = true; this.damage(b.x + 3); }
    for (const w of this.waves) if (overlaps(hurtBox, w)) this.damage(w.x + w.w / 2);
    for (const a of this.arcs) if (a.state(this.t) === 'on' && overlaps(hurtBox, a.box())) this.damage(a.x);
    if (touchesSpike(this.grid, hurtBox)) this.damage(p.cx - p.face * 4, true);
    const boss = this.boss;
    if (boss && this.arena?.active && boss.touchable) {
      const nx = Math.max(p.x, Math.min(boss.x, p.x + p.w)), ny = Math.max(p.y, Math.min(boss.y, p.y + p.h));
      if (Math.hypot(nx - boss.x, ny - boss.y) < boss.r - 2) {
        if (boss.stage === 'exposed' && p.vy > 40 && p.y + p.h < boss.y) {
          if (boss.hit((e) => this.bossEvent(e))) this.bossDamaged();
          p.bounce(true);
          this.hooks.sfx('stomp');
        } else this.damage(boss.x);
      }
    }
  }

  heldJump = false;

  private bossDamaged() {
    const b = this.boss!;
    this.particles.emit(b.x, b.y, 22, COLORS.boss, 110, { life: 0.6 });
    if (b.hp > 0) this.say(`KERNEL ${'*'.repeat(b.hp)}`);
  }

  private bossEvent(e: BossEvent) {
    const b = this.boss!;
    switch (e.type) {
      case 'shoot': { const bl = new Bullet(e.x - 3, e.y - 3, e.vx, e.vy, e.big ? 'big' : 'bit'); bl.life = 5; this.bullets.push(bl); break; }
      case 'glitch': this.glitches.push(new Glitch(e.x - 7, e.y)); this.particles.emit(e.x, e.y, 10, COLORS.glitch, 50, { life: 0.4 }); break;
      case 'slam':
        this.hooks.sfx('slam');
        this.waves.push(new Wave(e.x - 18, e.y - 10, -120), new Wave(e.x + 6, e.y - 10, 120));
        this.particles.emit(e.x, e.y, 20, ['#ff8c2e', '#ffe066', '#9db0c4'], 90, { up: true, life: 0.5 });
        break;
      case 'sfx': this.hooks.sfx(e.name); break;
      case 'shake': this.addShake(e.power); break;
      case 'reveal': {
        const t3 = this.terminals.find((t) => t.boss === 3);
        if (t3) { t3.hidden = false; this.particles.emit(t3.x + 8, t3.y + 10, 20, COLORS.repair, 70, { life: 0.6 }); }
        break;
      }
      case 'dead':
        this.score += SCORE.boss;
        this.flash = 0.6;
        this.bullets = []; this.waves = [];
        for (const g of this.glitches) g.kill();
        this.finishLevel(true);
        break;
    }
    if (b.stage === 'dying' && Math.random() < 0.5) this.particles.emit(b.x + (Math.random() - 0.5) * 40, b.y + (Math.random() - 0.5) * 40, 8, COLORS.boss, 90, { life: 0.5 });
  }

  private updateExit(dt: number) {
    const ex = this.exit;
    if (!ex) return;
    ex.t += dt;
    if (ex.gate) {
      // Level 3: the gate blocks the way until opened, then shuts behind Patch in the arena.
      this.grid.blockers = !ex.open || this.arena?.active ? [{ x: ex.x + 4, y: 0, w: 8, h: ex.y + ex.h }] : [];
      if (ex.open && this.arena && !this.arena.active && this.player.x > this.arena.x0 + 8) this.enterArena();
      if (this.boss?.stage === 'dying' && Math.random() < dt * 20) {
        this.particles.emit(this.boss.x + (Math.random() - 0.5) * 36, this.boss.y + (Math.random() - 0.5) * 36, 6, COLORS.boss, 80, { life: 0.5 });
      }
      return;
    }
    if (ex.open && overlaps(this.player, { x: ex.x + 4, y: ex.y + 8, w: 8, h: ex.h - 8 })) this.finishLevel(false);
  }

  private enterArena() {
    const a = this.arena!;
    a.active = true;
    this.respawn = { x: a.x0 + 24, y: 12 * TILE - PLAYER.h };
    for (const c of this.checkpoints) c.active = false;
    this.say('THE KERNEL');
    this.hooks.music('boss');
    this.addShake(3);
  }

  private finishLevel(boss: boolean) {
    const p = this.player;
    const par = this.level.par;
    this.tally = [
      { label: boss ? 'KERNEL REPAIRED' : 'LEVEL CLEAR', points: 0 },
      { label: `HEALTH ${p.hp}x${SCORE.hpBonus}`, points: p.hp * SCORE.hpBonus },
      { label: `TIME ${fmtTime(this.levelTime)} / PAR ${fmtTime(par)}`, points: Math.max(0, Math.round((par - this.levelTime) * SCORE.timeBonus)) },
    ];
    if (this.cells === this.cellsTotal && this.cellsTotal > 0) this.tally.push({ label: 'ALL CELLS', points: SCORE.allCells });
    for (const t of this.tally) this.score += t.points;
    this.repairing = null;
    this.hooks.music(null);
    if (this.levelIndex === levelCount - 1) {
      this.hooks.music('victory');
      this.setMode('victory');
    } else {
      this.hooks.sfx('clear');
      this.setMode('clear');
    }
  }

  nextLevel() {
    if (this.mode !== 'clear') return;
    this.startLevel(this.levelIndex + 1);
  }

  damage(fromX: number, spike = false) {
    const p = this.player;
    if (p.invuln > 0 || this.mode !== 'play') return;
    if (this.repairing) { this.repairing = null; p.lock = 0; }
    p.hurt(fromX);
    if (spike) p.vy = -260;
    this.hooks.sfx('hurt');
    this.addShake(3);
    this.particles.emit(p.cx, p.cy, 12, COLORS.hurt, 70, { life: 0.4 });
    if (p.hp <= 0) this.die();
  }

  private fellOut() {
    const p = this.player;
    p.hp -= 1;
    this.hooks.sfx('hurt');
    if (p.hp <= 0) { this.die(); return; }
    p.place(this.respawn.x, this.respawn.y);
    p.invuln = PLAYER.invuln;
    this.snapCamera();
  }

  private die() {
    this.lives -= 1;
    this.repairing = null;
    this.hooks.sfx('die');
    this.hooks.music(null);
    this.particles.emit(this.player.cx, this.player.cy, 30, COLORS.hurt, 110, { life: 0.8 });
    this.setMode('dying');
  }

  private afterDeath() {
    if (this.lives <= 0) { this.setMode('gameover'); return; }
    const p = this.player;
    p.place(this.respawn.x, this.respawn.y);
    p.hp = PLAYER.maxHp;
    p.invuln = PLAYER.invuln;
    this.bullets = []; this.waves = [];
    this.snapCamera();
    this.beginPlay();
  }

  say(text: string) { this.toast = { text, t: 2.2 }; }

  // ── Camera ──────────────────────────────────────────────────────────
  private camTarget() {
    const p = this.player;
    const lw = this.level.w * TILE, lh = this.level.h * TILE;
    if (this.arena?.active) return { x: this.arena.x0, y: lh - H - 12 };
    const x = p.cx - W / 2 + p.face * 24;
    const y = p.cy - H * 0.58;
    return { x: Math.max(0, Math.min(lw - W, x)), y: Math.max(0, Math.min(lh - H, y)) };
  }
  snapCamera() { const t = this.camTarget(); this.cam.x = t.x; this.cam.y = t.y; }
  private updateCamera(dt: number) {
    const t = this.camTarget();
    this.cam.x += (t.x - this.cam.x) * Math.min(1, dt * 7);
    this.cam.y += (t.y - this.cam.y) * Math.min(1, dt * 5);
  }
  addShake(p: number) { if (this.shakeOn) this.shake = Math.max(this.shake, p); }
  private updateShake(dt: number) { this.shake = Math.max(0, this.shake - dt * 14); }
}

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), t = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${t}`;
};
