// AFTER HOURS: Bad Decisions — the night itself. No DOM: render.ts draws this
// state, main.ts shows menus and decisions, audio.ts plays what hooks ask for.
// Testable in Node (tests/after-hours.mjs).
import { W, H, TILE, VIV, ATTACK, CHAOS, SCORE } from './config';
import { ZONES, zoneCount, FLOOR_ROW, type ZoneData, type Theme } from './zones';
import { ENCOUNTERS, encounterById, type Encounter, type Outcome, type Flag, type Item } from './encounters';
import { Viv, Guard, Bouncer, Ex, Rat, Projectile, Steam, Pickup, hit, type Foe, type Cause, type Box, type VivEvent } from './actors';
import { Lorenzo, type BossEvent } from './boss';
import { Grid } from '../../game/physics';
import { Particles } from '../../game/particles';

export type Mode = 'title' | 'intro' | 'play' | 'choice' | 'paused' | 'dying' | 'zoneclear' | 'gameover' | 'victory';
export type Sfx =
  | 'jump' | 'land' | 'step' | 'swing' | 'hit' | 'bigHit' | 'throw' | 'shatter' | 'roll' | 'cash' | 'heal' | 'chaos' | 'secret'
  | 'item' | 'hurt' | 'ko' | 'choice' | 'decide' | 'door' | 'alert' | 'shove' | 'buzz' | 'steam' | 'plate' | 'courage' | 'down'
  | 'bossPop' | 'bossLunge' | 'bossLaugh' | 'disco' | 'splash' | 'bossHit' | 'bossDown' | 'sunrise' | 'gameover' | 'bottle';
export type Track = 'title' | 'street' | 'club' | 'diner' | 'alley' | 'boss' | 'victory';

export interface Hooks { sfx(s: Sfx): void; music(t: Track | null): void; mode(m: Mode, prev: Mode): void }

export interface Frame { left: boolean; right: boolean; down: boolean; jump: boolean; jumpPressed: boolean; attackPressed: boolean; dodgePressed: boolean; interactPressed: boolean; pausePressed: boolean; choice: number }

export interface Achievement { id: string; title: string; how: string }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'red-flag', title: 'Professional Red Flag', how: 'Make five chaotic choices in one night.' },
  { id: 'impulse', title: 'Poor Impulse Control', how: 'Answer three decisions in under two seconds each.' },
  { id: 'walk-of-shame', title: 'Walk of Shame', how: 'Reach sunrise with one dignity left.' },
  { id: 'bad-influence', title: 'Certified Bad Influence', how: 'Reach sunrise with Chaos at 50 or more.' },
  { id: 'still-alive', title: 'Somehow Still Alive', how: 'Reach sunrise with Chaos at 90 or more.' },
  { id: 'chaos-coordinator', title: 'Chaos Coordinator', how: 'Max out the Chaos meter.' },
  { id: 'disco', title: 'Disco Archaeologist', how: 'Find all three golden disco balls.' },
  { id: 'closure', title: 'Closure, Technically', how: 'Send your ex home crying.' },
];

export interface Ending { id: string; title: string; text: string }
export interface Choice { enc: Encounter; left: number; total: number; opened: number }

export interface Results {
  won: boolean; score: number; time: number; cash: number; chaos: number; dignity: number;
  ending: Ending; gameOver?: string; defeated: number; secrets: number;
  choices: { speaker: string; label: string }[]; earned: string[];
}

interface Slot { x: number; npcX: number; enc: Encounter; done: boolean }
interface Popup { x: number; y: number; text: string; color: string; t: number }
interface Drop { x: number; warn: number; kind: 'bottle' | 'shoe' }
interface Snapshot { score: number; cash: number; chaos: number; flags: Flag[]; item: Viv['item']; exDefeats: number }

const DEATH_LINES: Record<Cause, string> = {
  bouncer: 'The bouncer would like a word.',
  guard: 'Arrested for vibes.',
  ex: 'Your ex won. Again. He’s posting about it.',
  cook: 'Banned from Regret Diner. That takes effort.',
  rat: 'Defeated by rats. The raccoon is laughing.',
  hazard: 'Your dignity has left the chat.',
  boss: 'Lorenzo adds you to his podcast intro.',
  fall: 'Your dignity has left the chat.',
};
const GENERIC_DEATH = ['Congratulations. You’re somebody’s cautionary tale.', 'Even your bad decisions are disappointed.'];

/** Small seeded RNG, so tests can replay a night. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Game {
  mode: Mode = 'title';
  modeT = 0;
  pausedFrom: Mode = 'play';
  rnd: () => number = Math.random;
  zoneIndex = 0;
  zone!: ZoneData;
  grid!: Grid;
  viv = new Viv();
  foes: Foe[] = [];
  shots: Projectile[] = [];
  steam: Steam[] = [];
  pickups: Pickup[] = [];
  puddles: Box[] = [];
  plates: { x: number; dir: -1 | 1; period: number; t: number }[] = [];
  drops: Drop[] = [];
  slots: Slot[] = [];
  plan: string[][] = [];
  boss: Lorenzo | null = null;
  bossStarted = false;
  doorX = 0;
  doorOpen = true;
  doorFoe: Foe | null = null;
  exitX = 0;
  exitLabel = '';
  particles = new Particles();
  popups: Popup[] = [];
  caption = { text: '', t: 0 };
  bossLine = { text: '', t: 0 };
  choice: Choice | null = null;
  lastOutcome: Outcome | null = null;
  cam = { x: 0, y: 0 };
  shake = 0;
  shakeOn = true;
  hitstop = 0;
  t = 0;

  score = 0;
  cash = VIV.startCash;
  chaos = 0;
  maxChaos = 0;
  flags = new Set<Flag>();
  runTime = 0;
  defeated = 0;
  secrets = 0;
  exDefeats = 0;
  fastChoices = 0;
  chaoticChoices = 0;
  choices: { speaker: string; label: string }[] = [];
  snapshot!: Snapshot;
  results: Results | null = null;
  earned: string[] = [];
  /** Set by the page from storage: achievements already unlocked. */
  unlocked = new Set<string>();
  /** Decision timer (seconds); 0 turns it off (setting). */
  decisionTime = 9;
  deathCause: Cause = 'hazard';
  tinyArrived = false;
  raccoonUsed = false;
  ticketT = 0;
  hazardT = 4;
  unhingedSaid = false;
  exAppeared = false;
  brawls: { x: number; from: number; to: number; wave: string[]; state: 'wait' | 'on' | 'done'; foes: Foe[] }[] = [];
  /** Screen lock while a brawl is on: [min, max] px. */
  get lock() { const b = this.brawls.find((x) => x.state === 'on'); return b ? [b.from * TILE, (b.to + 1) * TILE] as const : null; }
  goT = 0;

  constructor(public hooks: Hooks) {}

  setMode(m: Mode) { const prev = this.mode; this.mode = m; this.modeT = 0; this.hooks.mode(m, prev); }

  // ── Runs and zones ───────────────────────────────────────────────────
  newRun(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.rnd = mulberry32(seed);
    this.score = 0; this.cash = VIV.startCash; this.chaos = 0; this.maxChaos = 0;
    this.flags = new Set(); this.runTime = 0; this.defeated = 0; this.secrets = 0; this.exDefeats = 0;
    this.fastChoices = 0; this.chaoticChoices = 0; this.choices = []; this.results = null; this.earned = [];
    this.tinyArrived = false; this.raccoonUsed = false; this.unhingedSaid = false;
    this.viv = new Viv();
    // Plan the night: fixed encounters, plus a random pick for each open slot (no repeats).
    const used = new Set<string>();
    this.plan = ZONES.map((make) => make().slots.map((s) => {
      if (s.fixed) { used.add(s.fixed); return s.fixed; }
      const options = s.pool!.filter((id) => !used.has(id));
      const id = options[Math.floor(this.rnd() * options.length)] ?? s.pool![0];
      used.add(id);
      return id;
    }));
    this.startZone(0);
  }

  startZone(i: number) {
    this.zoneIndex = i;
    this.zone = ZONES[i]();
    this.grid = new Grid(this.zone);
    this.foes = []; this.shots = []; this.steam = []; this.pickups = []; this.puddles = []; this.plates = []; this.drops = []; this.brawls = []; this.goT = 0;
    this.popups = []; this.boss = null; this.bossStarted = false; this.doorFoe = null; this.exAppeared = false;
    this.particles.clear();
    this.t = 0; this.ticketT = 2; this.hazardT = 5;
    const z = this.zone;
    const feet = (y: number) => (y + 1) * TILE;
    this.doorX = 0; this.doorOpen = true;
    for (const e of z.ents) {
      switch (e.type) {
        case 'cash': case 'cash20': case 'lipstick': case 'skull': case 'disco': case 'courage':
          this.pickups.push(new Pickup(e.x * TILE + 3, feet(e.y) - 12, e.type)); break;
        case 'item': this.pickups.push(new Pickup(e.x * TILE + 3, feet(e.y) - 12, e.item)); break;
        case 'guard':
          if (!(z.id === 4 && this.flags.has('express'))) this.foes.push(new Guard(e.x * TILE, feet(e.y) - 22, e.x * TILE, e.range * TILE, false));
          break;
        case 'cook': this.foes.push(new Guard(e.x * TILE, feet(e.y) - 22, e.x * TILE, e.range * TILE, false, 'cook')); break;
        case 'bouncer': this.foes.push(new Bouncer(e.x * TILE, feet(e.y) - 26)); break;
        case 'rat': this.foes.push(new Rat(e.x * TILE, feet(e.y) - 7)); break;
        case 'steam': this.steam.push(new Steam(e.x * TILE, e.period, e.offset)); break;
        case 'puddle': this.puddles.push({ x: e.x * TILE, y: FLOOR_ROW * TILE - 2, w: e.w * TILE, h: 4 }); break;
        case 'plates': this.plates.push({ x: e.x * TILE, dir: e.dir, period: e.period, t: 0 }); break;
        case 'exit': this.exitX = e.x * TILE; this.exitLabel = e.label; break;
        case 'brawl': this.brawls.push({ x: e.x * TILE, from: e.from, to: e.to, wave: e.wave, state: 'wait', foes: [] }); break;
      }
    }
    this.slots = z.slots.map((s, k) => ({ x: s.x * TILE, npcX: (s.npcX ?? s.x + 3) * TILE, enc: encounterById[this.plan[i][k]], done: false }));
    // The bouncer stands in the club door until his encounter is settled.
    const door = this.slots.find((s) => s.enc.id === 'bouncer');
    if (door) { this.doorX = door.npcX; this.doorOpen = false; }
    this.viv.place(z.spawn * TILE, FLOOR_ROW * TILE - this.viv.h);
    this.viv.face = 1;
    this.viv.dignity = Math.min(VIV.maxDignity, this.viv.dignity + (i > 0 ? 1 : 0));
    if (i === 0) this.viv.dignity = VIV.maxDignity;
    this.snapshot = { score: this.score, cash: this.cash, chaos: this.chaos, flags: [...this.flags], item: this.viv.item ? { ...this.viv.item } : null, exDefeats: this.exDefeats };
    // Callbacks from earlier choices
    if (z.id === 2 && this.flags.has('advice')) {
      this.say('The bride texts: “It worked. I’m marrying the caterer.” She left you lipstick.');
      this.pickups.push(new Pickup(6 * TILE, FLOOR_ROW * TILE - 12, 'lipstick'));
    }
    if (z.id === 3 && this.flags.has('djSecret')) this.popup(31 * TILE, 2 * TILE, 'LOOK UP', '#ffd23f', 4);
    if (z.id === 4 && this.flags.has('limo')) {
      if (this.cash >= 30) { this.cash -= 30; this.say('The limo driver found you. “That’ll be $30.” You pay. You weep.'); }
      else this.say('The limo driver found you. You can’t pay. He has parking tickets. And an arm.');
    }
    this.snapCamera();
    this.setMode('intro');
    this.hooks.music(null);
  }

  /** After a game over: this area again, as it was when you arrived. */
  retryZone() {
    const s = this.snapshot;
    this.score = s.score; this.cash = s.cash; this.chaos = s.chaos; this.flags = new Set(s.flags); this.exDefeats = s.exDefeats;
    this.viv = new Viv();
    this.viv.item = s.item ? { ...s.item } : null;
    this.results = null;
    this.startZone(this.zoneIndex);
  }

  get multiplier() { return 1 + this.chaos / 50; }
  get themeAt(): Theme {
    let th: Theme = this.zone.themes[0].theme;
    for (const t of this.zone.themes) if (this.viv.x >= t.from * TILE) th = t.theme;
    return th;
  }
  /** Minutes after 11 PM. */
  get clock() {
    const [a, b] = this.zone.clock;
    if (this.boss) return a + (b - a) * (1 - this.boss.hp / 30) * 0.98;
    return a + (b - a) * Math.min(1, Math.max(0, this.viv.x / (this.exitX || this.zone.w * TILE)));
  }

  addScore(base: number, x?: number, y?: number) {
    const pts = Math.round(base * this.multiplier);
    this.score += pts;
    if (x !== undefined && y !== undefined && pts > 0) this.popup(x, y, `+${pts}`, '#ffd23f');
    return pts;
  }
  addChaos(n: number, x?: number, y?: number) {
    const before = this.chaos;
    this.chaos = Math.max(0, Math.min(100, this.chaos + n));
    this.maxChaos = Math.max(this.maxChaos, this.chaos);
    if (n > 0) this.hooks.sfx('chaos');
    if (x !== undefined && y !== undefined && n !== 0) this.popup(x, y, `CHAOS ${n > 0 ? '+' : ''}${n}`, n > 0 ? '#ff4fd8' : '#3df2ff');
    if (before < CHAOS.unhingedAt && this.chaos >= CHAOS.unhingedAt && !this.unhingedSaid) { this.unhingedSaid = true; this.say('CHAOS 70: UNHINGED. Points ×2.4. Everything is worse. Including you.'); }
    if (before < 100 && this.chaos >= 100) this.say('CHAOS 100. Every hit now costs double. Points ×3. Godspeed.');
  }
  popup(x: number, y: number, text: string, color: string, t = 1.1) { this.popups.push({ x, y, text, color, t }); }
  say(text: string) { this.caption = { text, t: 4.2 }; }

  // ── Update ────────────────────────────────────────────────────────────
  update(dt: number, f: Frame) {
    this.modeT += dt;
    if (this.caption.t > 0) this.caption.t -= dt;
    if (this.bossLine.t > 0) this.bossLine.t -= dt;
    if (f.pausePressed) {
      if (this.mode === 'play' || this.mode === 'intro' || this.mode === 'choice') { this.pause(); return; }
      if (this.mode === 'paused') { this.resume(); return; }
    }
    switch (this.mode) {
      case 'intro':
        this.particles.update(dt);
        if (this.modeT > 2.4 || (this.modeT > 0.6 && (f.jumpPressed || f.attackPressed || f.interactPressed))) this.beginPlay();
        return;
      case 'play': this.play(dt, f); return;
      case 'choice': {
        const c = this.choice!;
        c.opened += dt;
        if (f.choice >= 1 && f.choice <= 3) { this.choose(f.choice - 1); return; }
        if (this.decisionTime > 0) { c.left -= dt; if (c.left <= 0) this.timeout(); }
        return;
      }
      case 'dying':
        this.particles.update(dt); this.updatePopups(dt);
        if (this.modeT > 1.6) this.finish(false);
        return;
      case 'zoneclear':
        this.particles.update(dt);
        if (this.modeT > 1.2 && (f.jumpPressed || f.attackPressed || f.interactPressed)) this.nextZone();
        return;
      default:
        this.particles.update(dt);
    }
  }

  private beginPlay() {
    this.setMode('play');
    this.hooks.music(this.boss && this.bossStarted ? 'boss' : this.themeAt === 'street' && this.zone.id === 1 ? 'street' : this.zone.id === 1 ? 'club' : this.zone.id === 2 ? 'diner' : this.zone.id === 3 ? 'alley' : this.bossStarted ? 'boss' : 'club');
  }
  pause() { if (this.mode !== 'play' && this.mode !== 'intro' && this.mode !== 'choice') return; this.pausedFrom = this.mode; this.setMode('paused'); this.hooks.music(null); }
  resume() {
    if (this.mode !== 'paused') return;
    if (this.pausedFrom === 'choice' && this.choice) { this.setMode('choice'); return; }
    if (this.pausedFrom === 'intro') { this.setMode('intro'); return; }
    this.beginPlay();
  }

  private play(dt: number, f: Frame) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt; this.runTime += dt;
    const v = this.viv, z = this.zone;
    const floorY = FLOOR_ROW * TILE;

    v.slippery = this.puddles.some((p) => v.x + v.w > p.x && v.x < p.x + p.w);
    const vivEvent = (e: VivEvent) => {
      const map: Partial<Record<VivEvent, Sfx>> = { jump: 'jump', land: 'land', step: 'step', swing: 'swing', roll: 'roll', throw: 'throw' };
      const s = map[e]; if (s) this.hooks.sfx(s);
      if (e === 'throw' && v.item) this.throwItem();
      if (e === 'land' || e === 'roll') this.particles.emit(v.cx, v.y + v.h, 5, ['#8a7aa8', '#3df2ff'], 35, { grav: 60, life: 0.3, up: true });
    };
    v.update(dt, f, this.grid, vivEvent);
    this.keepInBounds();

    // Talk to someone (encounters that don't trigger on their own).
    const talk = this.talkable();
    if (f.interactPressed && talk) this.open(talk);
    for (const s of this.slots) if (!s.done && s.enc.auto && v.x + v.w >= s.x) { this.open(s); return; }

    // Melee hits
    const strike = v.strikeBox();
    if (strike) {
      const dmg = (v.courage > 0 ? 2 : 1) * (v.item?.kind === 'cone' ? 2 : 1) * ATTACK.damage;
      for (const e of this.foes) {
        if (!e.alive || v.hitIds.has(e) || !hit(strike, e)) continue;
        v.hitIds.add(e);
        this.strikeFoe(e, dmg, v.face, v.item?.kind === 'cone' ? 280 : ATTACK.knock);
        if (v.item?.kind === 'cone' && --v.item.uses <= 0) { v.item = null; this.popup(v.cx, v.y - 8, 'CONE BROKE', '#ff7a1a'); }
      }
      if (this.boss && !v.hitIds.has(this.boss) && hit(strike, this.bossBox())) { v.hitIds.add(this.boss); this.strikeBoss(dmg); }
    }

    // Foes
    const ch = this.chaos;
    for (const e of this.foes) {
      if (e instanceof Ex) e.update(dt, this.grid, v, ch, (p) => { this.shots.push(p); this.hooks.sfx('throw'); });
      else e.update(dt, this.grid, v, ch);
      if (e instanceof Guard && e.state === 'alert' && e.alertT > 0.4) { this.hooks.sfx('alert'); this.popup(e.cx, e.y - 10, '!', '#ff3355', 0.6); }
      if (e instanceof Bouncer && e.state === 'windup' && e.st > 0.5) this.hooks.sfx('shove');
    }
    if (this.doorFoe && !this.doorFoe.alive && !this.doorOpen) { this.doorOpen = true; this.say('The door is open. The bouncer is asleep. On purpose, he insists.'); }
    this.foes = this.foes.filter((e) => !e.dead);

    // Projectiles
    for (const s of this.shots) {
      s.update(dt, this.grid, v);
      if (s.side === 'viv') {
        for (const e of this.foes) if (e.alive && hit(s, e)) { this.strikeFoe(e, v.courage > 0 ? 3 : 2, Math.sign(s.vx) || v.face, 200); if (s.kind === 'glass') { s.dead = true; this.hooks.sfx('shatter'); this.particles.emit(s.x, s.y, 8, ['#c8f4ff', '#ff4fd8'], 60, { life: 0.3 }); } }
        if (this.boss && hit(s, this.bossBox()) && this.boss.vulnerable) { this.strikeBoss(v.courage > 0 ? 3 : 2); if (s.kind === 'glass') s.dead = true; else s.returning = true; }
      } else {
        if (this.boss && s.kind === 'phone' && hit(s, this.bossBox()) && this.boss.vulnerable) { s.dead = true; this.strikeBoss(1); this.popup(this.boss.cx, this.boss.y - 6, 'BRAD HIT LORENZO', '#22e0ff'); continue; }
        if (!v.rolling && v.invuln <= 0 && hit(s, v)) { s.dead = true; this.damage(s.x, s.kind === 'wave' || s.kind === 'cork' ? 'boss' : s.kind === 'phone' ? 'ex' : 'hazard'); }
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);

    // Contact damage
    if (!v.rolling && v.invuln <= 0) {
      for (const e of this.foes) {
        if (!e.harmful() || !hit({ x: v.x + 1, y: v.y + 2, w: v.w - 2, h: v.h - 2 }, e)) continue;
        if (e instanceof Rat && v.vy > 60 && v.y + v.h - e.y < 8) { this.strikeFoe(e, 1, v.face, 100); v.bounce(); continue; }
        if (e instanceof Bouncer) { if (e.shoving) { this.damage(e.cx, 'bouncer'); v.vx = e.face * 300; } continue; }
        this.damage(e.cx, e.cause);
        // After landing a hit they pause to gloat, which gives Viv room to answer.
        e.stun = Math.max(e.stun, 0.9);
        if (e instanceof Guard && e.kind === 'guard') { this.popup(v.cx, v.y - 10, 'BUSTED!', '#ff3355'); this.addChaos(3); }
      }
    }

    // Hazards
    for (const st of this.steam) {
      const s = st.state(this.t);
      if (s === 'on' && Math.random() < dt * 30) this.particles.emit(st.x + 8, floorY - 4, 2, ['#ffffff', '#c8c8e8'], 40, { grav: -120, life: 0.6 });
      if (s === 'on' && st.phase(this.t) < dt) this.hooks.sfx('steam');
      if (s === 'on' && !v.rolling && v.invuln <= 0 && hit(v, st.box(floorY))) this.damage(st.x + 8, 'hazard');
    }
    for (const p of this.plates) {
      p.t += dt;
      if (p.t >= p.period && Math.abs(p.x - v.x) < W) { p.t = 0; this.shots.push(new Projectile('plate', p.x, floorY - 18 - (this.rnd() < 0.5 ? 0 : 12), p.dir * 150, 0, 'enemy')); this.hooks.sfx('plate'); }
    }
    this.chaosHazards(dt, floorY);

    // Pickups
    for (const pk of this.pickups) {
      pk.t += dt;
      if (pk.taken || !hit(v, pk)) continue;
      pk.taken = true;
      this.collect(pk);
    }

    this.updateBrawls(dt);

    // Exit, boss
    if (this.exitX && v.x + v.w >= this.exitX && (this.doorOpen || v.x > this.doorX)) this.clearZone();
    if (this.boss) this.updateBoss(dt);
    if (v.y > z.h * TILE + 30) { v.place(Math.max(0, v.x - 48), floorY - v.h); this.damage(v.cx + 10, 'fall'); }

    this.particles.update(dt);
    this.updatePopups(dt);
    this.updateCamera(dt);
    this.shake = Math.max(0, this.shake - dt * 14);
  }

  /** Brawls: lock the screen, send a wave, unlock when it's beaten. */
  private updateBrawls(dt: number) {
    if (this.goT > 0) this.goT -= dt;
    const v = this.viv, floorY = FLOOR_ROW * TILE;
    for (const b of this.brawls) {
      if (b.state === 'wait' && v.x > b.x && this.mode === 'play') {
        b.state = 'on';
        const L = b.from * TILE + 6, R = (b.to + 1) * TILE - 26;
        b.wave.forEach((kind, i) => {
          const x = i % 2 ? L : R;
          const e = kind === 'bouncer' ? new Bouncer(x, floorY - 26) : kind === 'rat' ? new Rat(x, floorY - 7) : new Guard(x, floorY - 22, x, 80, true, kind === 'cook' ? 'cook' : 'guard');
          b.foes.push(e); this.foes.push(e);
        });
        this.popup(v.cx, v.y - 24, 'BRAWL!', '#ff3355', 1.4);
        this.hooks.sfx('alert');
      }
      if (b.state === 'on' && b.foes.every((e) => !e.alive)) {
        b.state = 'done'; this.goT = 2.5;
        this.addScore(250, v.cx, v.y - 20);
        this.hooks.sfx('door');
      }
    }
  }

  private updatePopups(dt: number) {
    for (const p of this.popups) { p.t -= dt; p.y -= 18 * dt; }
    this.popups = this.popups.filter((p) => p.t > 0);
  }

  private keepInBounds() {
    const v = this.viv;
    let min = 0, max = this.zone.w * TILE - v.w;
    if (!this.doorOpen && this.doorX) max = Math.min(max, this.doorX - v.w - 2);
    if (this.boss && this.zone.arena) { min = this.zone.arena[0] * TILE; max = (this.zone.arena[1] + 1) * TILE - v.w; }
    const lock = this.lock;
    if (lock) { min = Math.max(min, lock[0]); max = Math.min(max, lock[1] - v.w); }
    if (v.x < min) { v.x = min; v.vx = Math.max(0, v.vx); }
    if (v.x > max) { v.x = max; v.vx = Math.min(0, v.vx); }
  }

  talkable(): Slot | null {
    const v = this.viv;
    return this.slots.find((s) => !s.done && !s.enc.auto && Math.abs(v.cx - (s.npcX + 8)) < 26) ?? null;
  }

  private strikeFoe(e: Foe, dmg: number, dir: number, knock: number) {
    const down = e.takeHit(dmg, dir, knock);
    this.hitstop = 0.05;
    this.hooks.sfx(e instanceof Bouncer ? 'bigHit' : 'hit');
    this.particles.emit(e.cx, e.y + 8, 8, ['#ffffff', '#ffd23f', '#ff4fd8'], 80, { life: 0.3, grav: 100 });
    this.addShake(e instanceof Bouncer ? 3 : 1.5);
    if (!down) return;
    this.defeated++;
    this.hooks.sfx('down');
    this.addScore(e.points, e.cx, e.y);
    if (e instanceof Ex) {
      this.exDefeats++;
      this.popup(e.cx, e.y - 14, 'BRAD LEAVES CRYING', '#22e0ff', 1.6);
    }
    if (e instanceof Bouncer) this.addChaos(5, e.cx, e.y - 16);
  }

  bossBox(): Box { const b = this.boss!; return { x: b.x, y: b.y, w: b.w, h: b.h }; }

  private strikeBoss(dmg: number) {
    const b = this.boss!;
    const d = b.hit(dmg, (e) => this.bossEvent(e), this.flags.has('bossTip'));
    if (d > 0) {
      this.hitstop = 0.06;
      this.addScore(40 * d, b.cx, b.y - 4);
      this.particles.emit(b.cx, b.y + 10, 10, ['#7b1fa2', '#ffd23f', '#ffffff'], 90, { life: 0.4 });
      this.addShake(2);
      if (this.flags.has('bossTip') && b.state === 'monologue') this.popup(b.cx, b.y - 14, 'EGO DAMAGE ×2', '#ffd23f');
    }
  }

  private throwItem() {
    const v = this.viv, it = v.item!;
    if (it.kind === 'glass') {
      this.shots.push(new Projectile('glass', v.cx + v.face * 6, v.y + 6, v.face * 240, -20, 'viv'));
      if (--it.uses <= 0) v.item = null;
    } else if (it.kind === 'heel') {
      if (this.shots.some((s) => s.kind === 'heel')) return; // one heel in the air at a time
      this.shots.push(new Projectile('heel', v.cx + v.face * 6, v.y + 6, v.face * 250, 0, 'viv'));
    }
  }

  damage(fromX: number, cause: Cause) {
    const v = this.viv;
    if (v.invuln > 0 || v.rolling || this.mode !== 'play') return;
    const amount = this.chaos >= CHAOS.brutalAt ? 2 : 1;
    v.hurt(fromX, amount);
    this.deathCause = cause;
    this.hooks.sfx('hurt');
    this.addShake(3);
    this.popup(v.cx, v.y - 6, amount > 1 ? '-2 DIGNITY' : '-1 DIGNITY', '#ff3355');
    this.particles.emit(v.cx, v.cy, 10, ['#ff4fd8', '#ff3355', '#ffffff'], 70, { life: 0.4 });
    if (v.dignity <= 0) { v.dignity = 0; this.hooks.sfx('ko'); this.hooks.music(null); this.setMode('dying'); }
  }

  private collect(pk: Pickup) {
    const v = this.viv;
    switch (pk.kind) {
      case 'cash': this.cash += 5; this.addScore(5 * SCORE.cashPerDollar, pk.x, pk.y); this.hooks.sfx('cash'); break;
      case 'cash20': this.cash += 20; this.addScore(20 * SCORE.cashPerDollar, pk.x, pk.y); this.hooks.sfx('cash'); break;
      case 'lipstick':
        if (v.dignity < VIV.maxDignity) { v.dignity++; this.popup(pk.x, pk.y, '+1 DIGNITY', '#ff8fb0'); } else this.addScore(200, pk.x, pk.y);
        this.hooks.sfx('heal'); break;
      case 'skull': this.addChaos(6, pk.x, pk.y - 8); this.addScore(300, pk.x, pk.y); break;
      case 'disco': this.secrets++; this.addScore(SCORE.secret, pk.x, pk.y); this.hooks.sfx('secret'); this.say(`Golden disco ball ${this.secrets}/3. Somewhere, a DJ nods.`); break;
      case 'courage': v.courage = 10; this.hooks.sfx('courage'); this.popup(pk.x, pk.y, 'LIQUID COURAGE', '#b6ff3d', 1.5); this.addChaos(3); break;
      default: this.giveItem(pk.kind as Item, true);
    }
    this.particles.emit(pk.x + 5, pk.y + 5, 8, ['#ffd23f', '#ffffff', '#ff4fd8'], 50, { grav: 0, life: 0.35 });
  }

  giveItem(kind: Item, floor = false) {
    const v = this.viv;
    v.item = kind === 'glass' ? { kind, uses: floor ? 4 : 6, timer: 0 } : kind === 'heel' ? { kind, uses: 1, timer: 15 } : { kind, uses: 12, timer: 0 };
    this.hooks.sfx('item');
    const names = { glass: 'COCKTAIL GLASSES: THROW', heel: 'HIGH HEEL: BOOMERANG', cone: 'TRAFFIC CONE: BONK' };
    this.popup(v.cx, v.y - 10, names[kind], '#3df2ff', 1.6);
  }

  /** Bottles (outside) or shoes (inside) rain down once Chaos is high, with a shadow first. */
  private chaosHazards(dt: number, floorY: number) {
    if (this.chaos >= CHAOS.hazardsAt && !this.boss) {
      this.hazardT -= dt;
      if (this.hazardT <= 0) {
        this.hazardT = Math.max(1.6, 6 - this.chaos / 22);
        const th = this.themeAt;
        this.drops.push({ x: this.viv.cx + (this.rnd() - 0.35) * 140, warn: 0.9, kind: th === 'street' || th === 'alley' ? 'bottle' : 'shoe' });
      }
    }
    for (const d of this.drops) {
      d.warn -= dt;
      if (d.warn <= 0) { this.shots.push(new Projectile('bottle', d.x - 3, this.cam.y - 10, 0, 120, 'enemy')); this.hooks.sfx('bottle'); }
    }
    this.drops = this.drops.filter((d) => d.warn > 0);
    if (this.boss && this.flags.has('limo') && this.cash < 30 && this.bossStarted && this.boss.phase === 1) {
      this.ticketT -= dt;
      if (this.ticketT <= 0) { this.ticketT = 3.2; this.shots.push(new Projectile('ticket', this.zone.arena![0] * TILE, floorY - 30 - this.rnd() * 30, 110, 0, 'enemy')); }
    }
  }

  // ── Encounters ───────────────────────────────────────────────────────
  private open(s: Slot) {
    s.done = true;
    this.choice = { enc: s.enc, left: this.decisionTime, total: this.decisionTime, opened: 0 };
    this.viv.vx = 0;
    this.hooks.sfx(s.enc.who === 'phone' ? 'buzz' : 'choice');
    this.setMode('choice');
  }

  ctx() { return { cash: this.cash, chaos: this.chaos, dignity: this.viv.dignity, flags: this.flags as ReadonlySet<Flag>, rnd: this.rnd }; }
  prompt() { return this.choice ? this.choice.enc.prompt(this.ctx()) : ''; }

  choose(i: number, timedOut = false) {
    const c = this.choice;
    if (!c || this.mode !== 'choice') return null;
    const opt = c.enc.options[i];
    const before = this.chaos;
    const o = opt.run(this.ctx());
    this.choice = null;
    this.choices.push({ speaker: c.enc.speaker, label: opt.label });
    if (!timedOut && c.opened < 2) this.fastChoices++;
    this.hooks.sfx('decide');
    this.apply(o, c.enc);
    if (this.chaos > before) this.chaoticChoices++;
    this.lastOutcome = o;
    this.say(timedOut ? `You froze. The universe chose “${opt.label}” ${o.text}` : o.text);
    if (this.mode === 'choice') this.beginPlay();
    return o;
  }

  private timeout() {
    const i = Math.floor(this.rnd() * 3);
    this.addChaos(5);
    this.choose(i, true);
  }

  private apply(o: Outcome, enc: Encounter) {
    const v = this.viv;
    // Decisions move Chaos at three quarters of their face value, so one night rarely maxes it by itself.
    if (o.chaos) this.addChaos(Math.round(o.chaos * 0.75), v.cx, v.y - 14);
    if (o.cashTo !== undefined) this.cash = o.cashTo;
    if (o.cash) { this.cash = Math.max(0, this.cash + o.cash); this.popup(v.cx, v.y - 22, `${o.cash > 0 ? '+' : '-'}$${Math.abs(o.cash)}`, o.cash > 0 ? '#3ddc72' : '#ff8fb0'); }
    if (o.dignity) { v.dignity = Math.max(1, Math.min(VIV.maxDignity, v.dignity + o.dignity)); this.hooks.sfx(o.dignity > 0 ? 'heal' : 'hurt'); }
    if (o.score) this.addScore(o.score, v.cx, v.y - 30);
    for (const f of o.flags ?? []) this.flags.add(f);
    if (o.item) this.giveItem(o.item);
    if (o.buff === 'courage') { v.courage = 10; this.hooks.sfx('courage'); }
    if (o.buff === 'speed') v.speed = 8;
    if (o.buff === 'spotlight') { v.spotlight = 4; v.place(50 * TILE, FLOOR_ROW * TILE - v.h); this.doorOpen = true; }
    for (const s of o.spawn ?? []) this.spawn(s, enc);
    if (o.skip || o.skipZone) for (const b of this.brawls) if (b.state === 'wait') b.state = 'done';
    if (o.skip) { v.place(Math.min(this.exitX - 32, v.x + o.skip * TILE), FLOOR_ROW * TILE - v.h); this.snapCamera(); }
    if (o.skipZone) { v.place(this.exitX - 40, FLOOR_ROW * TILE - v.h); this.foes = this.foes.filter((e) => e.x < v.x - 200); this.snapCamera(); }
    if (enc.id === 'bouncer' && !this.flags.has('bouncerAngry')) this.doorOpen = true;
    if (enc.id === 'lorenzo') this.startBoss();
  }

  private spawn(kind: string, enc: Encounter) {
    const v = this.viv, floorY = FLOOR_ROW * TILE;
    const ahead = Math.min(this.zone.w * TILE - 40, this.cam.x + W + 8);
    switch (kind) {
      case 'ex': this.spawnEx(this.flags.has('exJealous') ? 'jealous' : this.flags.has('exBlocked') ? 'blocked' : 'confused', true); break;
      case 'guard': this.foes.push(new Guard(ahead, floorY - 22, ahead, 64, true)); break;
      case 'cook': this.foes.push(new Guard(Math.min(v.x + 90, this.zone.w * TILE - 30), floorY - 22, v.x, 64, true, 'cook')); break;
      case 'rats': for (let i = 0; i < 3; i++) this.foes.push(new Rat(v.x + 60 + i * 22, floorY - 7)); break;
      case 'cash': for (let i = 0; i < 7; i++) this.pickups.push(new Pickup(v.x - 30 + i * 18, floorY - 30 - (i % 3) * 14, i === 3 ? 'cash20' : 'cash')); break;
      case 'bouncer': {
        const slot = this.slots.find((s) => s.enc.id === enc.id);
        const b = new Bouncer((slot?.npcX ?? v.x + 40) - 2, floorY - 26);
        b.face = -1;
        this.foes.push(b);
        this.doorFoe = b;
        if (slot) slot.npcX = -999; // the NPC became the fight
        break;
      }
    }
  }

  spawnEx(mood: 'jealous' | 'confused' | 'blocked', near = false) {
    if (this.foes.some((e) => e instanceof Ex && e.alive)) return;
    const floorY = FLOOR_ROW * TILE;
    const x = near ? Math.max(0, this.viv.x - 130) : (this.zone.exFrom ?? 1) * TILE;
    this.foes.push(new Ex(x, floorY - 22, mood));
    this.exAppeared = true;
    this.popup(this.viv.cx, this.viv.y - 18, mood === 'blocked' ? 'BLOCKED NUMBERS CAN STILL TAKE THE BUS' : 'BRAD HAS ENTERED THE CHAT', '#22e0ff', 2);
    this.hooks.sfx('buzz');
  }

  /** Your ex follows you between areas if your choices invited him. */
  private exCallbacks() {
    const z = this.zone.id, f = this.flags;
    if (this.exAppeared || this.boss) return;
    const x = this.viv.x;
    if (z === 1 && f.has('exJealous') && x > 46 * TILE) this.spawnEx('jealous');
    if (z === 2 && x > 6 * TILE && (f.has('exJealous') || f.has('exConfused'))) this.spawnEx(f.has('exJealous') ? 'jealous' : 'confused');
    if (z === 3 && x > 6 * TILE && (f.has('exJealous') || f.has('exBlocked'))) this.spawnEx(f.has('exJealous') ? 'jealous' : 'blocked');
  }

  // ── Boss ─────────────────────────────────────────────────────────────
  private startBoss() {
    const a = this.zone.arena!;
    this.boss = new Lorenzo(a[0] * TILE, (a[1] + 1) * TILE, FLOOR_ROW * TILE, 27 * TILE, {
      unplugged: this.flags.has('unplugged'), flattered: this.flags.has('flattered'), hotTub: this.flags.has('hotTub'),
    });
    this.bossStarted = true;
    this.foes = this.foes.filter((e) => e.x > a[0] * TILE);
    if (this.viv.x < a[0] * TILE + 8) this.viv.x = a[0] * TILE + 8;
    this.hooks.music('boss');
  }

  private updateBoss(dt: number) {
    const b = this.boss!;
    b.update(dt, this.viv.cx, (e) => this.bossEvent(e));
    const v = this.viv;
    if (b.harmful && !v.rolling && v.invuln <= 0 && hit(v, this.bossBox())) this.damage(b.cx, 'boss');
    for (const beam of b.beams) if (beam.warn <= 0 && beam.on > 0 && !v.rolling && v.invuln <= 0 && v.x + v.w > beam.x - 5 && v.x < beam.x + 5) this.damage(beam.x, 'boss');
    if (b.beams.length && b.beams[0].warn > 0.8) this.hooks.sfx('disco');
    // Tiny keeps his promise.
    if (this.flags.has('bouncerCrush') && b.phase >= 2 && !this.tinyArrived && b.state !== 'summon') {
      this.tinyArrived = true;
      for (const e of this.foes) if (e instanceof Guard) e.takeHit(99, -1, 300);
      b.hit(3, (e) => this.bossEvent(e), false);
      this.say('TINY BURSTS IN: “Nobody touches my date.” Security is removed. So is some of Lorenzo’s hair.');
      this.addShake(5);
    }
    if (this.flags.has('raccoonFriend') && b.phase === 3 && !this.raccoonUsed && b.state === 'tub') {
      this.raccoonUsed = true;
      b.stunFor(3.2); b.x = (b.left + b.right) / 2 - b.w / 2; b.y = FLOOR_ROW * TILE - b.h;
      this.say('Your raccoon friend steals his pool noodle. He is devastated. He is open.');
    }
    if (this.flags.has('exJealous') && b.phase >= 2 && !this.exAppeared && this.exDefeats < 3) this.spawnEx('jealous', true);
  }

  private bossEvent(e: BossEvent) {
    const floorY = FLOOR_ROW * TILE;
    switch (e.type) {
      case 'cork': this.shots.push(new Projectile('cork', e.x, e.y, e.vx, e.vy, 'enemy')); break;
      case 'wave': this.shots.push(new Projectile('wave', e.x, floorY - 10, e.vx, 0, 'enemy')); break;
      case 'summon': {
        const a = this.zone.arena![0] * TILE;
        for (let i = 0; i < 2; i++) this.foes.push(new Guard(a + 4 + i * 20, floorY - 22, a + 40, 60, true));
        break;
      }
      case 'line': this.bossLine = { text: e.text, t: 2.6 }; break;
      case 'sfx': this.hooks.sfx(e.name); break;
      case 'shake': this.addShake(e.power); break;
      case 'phase': if (e.n === 3) this.foes = this.foes.filter((f) => !(f instanceof Guard)); break;
      case 'defeated':
        this.addScore(SCORE.boss);
        this.hooks.sfx('sunrise');
        this.finish(true);
        break;
    }
  }

  // ── Zone clear, endings ───────────────────────────────────────────────
  private clearZone() {
    if (this.mode !== 'play') return;
    this.addScore(SCORE.zone);
    this.hooks.sfx('door');
    this.hooks.music(null);
    this.setMode('zoneclear');
  }

  nextZone() {
    if (this.mode !== 'zoneclear') return;
    if (this.zoneIndex + 1 < zoneCount) this.startZone(this.zoneIndex + 1);
  }

  ending(): Ending {
    const d = this.viv.dignity;
    if (this.chaos >= 85) return { id: 'legend', title: 'LEGEND OF THE NIGHT', text: 'The city will tell this story for years. Mostly in court.' };
    if (d <= 1) return { id: 'shame', title: 'WALK OF SHAME', text: 'Sunrise. Heels in hand. The birds are judging you specifically.' };
    if (this.flags.has('exJealous') && this.exDefeats >= 2) return { id: 'closure', title: 'CLOSURE, TECHNICALLY', text: 'You and Brad are finally done. The restraining order is mutual.' };
    if (this.flags.has('bouncerCrush')) return { id: 'tiny', title: 'A DATE WITH TINY', text: 'Tiny walks you home and carries your heels. Terrifying. A gentleman, though.' };
    if (this.chaos < 25) return { id: 'responsible', title: 'SOMEHOW RESPONSIBLE', text: 'You reached sunrise with most of your dignity. Frankly, disturbing.' };
    return { id: 'influence', title: 'CERTIFIED BAD INFLUENCE', text: 'Bad decisions were made. Great stories were also made. Net positive.' };
  }

  private finish(won: boolean) {
    const v = this.viv;
    if (won) {
      this.score += v.dignity * SCORE.dignityBonus + this.cash * SCORE.cashPerDollar;
    }
    const earned: string[] = [];
    const add = (id: string, ok: boolean) => { if (ok && !earned.includes(id)) earned.push(id); };
    add('red-flag', this.chaoticChoices >= 5);
    add('impulse', this.fastChoices >= 3);
    add('chaos-coordinator', this.maxChaos >= 100);
    add('disco', this.secrets >= 3);
    add('closure', this.exDefeats >= 1);
    if (won) {
      add('walk-of-shame', v.dignity === 1);
      add('bad-influence', this.chaos >= 50);
      add('still-alive', this.chaos >= 90);
    }
    this.earned = earned;
    const gameOver = won ? undefined : this.chaos >= CHAOS.brutalAt ? 'This is why you can’t have nice things.' : this.rnd() < 0.25 ? GENERIC_DEATH[Math.floor(this.rnd() * 2)] : DEATH_LINES[this.deathCause];
    this.results = {
      won, score: this.score, time: this.runTime, cash: this.cash, chaos: this.chaos, dignity: v.dignity,
      ending: won ? this.ending() : { id: 'ko', title: 'KNOCKED OUT', text: gameOver! }, gameOver,
      defeated: this.defeated, secrets: this.secrets, choices: [...this.choices], earned,
    };
    this.hooks.music(won ? 'victory' : null);
    if (!won) this.hooks.sfx('gameover');
    this.setMode(won ? 'victory' : 'gameover');
  }

  // ── Camera ────────────────────────────────────────────────────────────
  private camTarget() {
    const v = this.viv, lw = this.zone.w * TILE, lh = this.zone.h * TILE;
    if (this.boss && this.zone.arena) return { x: this.zone.arena[0] * TILE, y: lh - H };
    const lock = this.lock;
    const lo = lock ? lock[0] : 0, hi = lock ? Math.max(lock[0], lock[1] - W) : lw - W;
    return { x: Math.max(lo, Math.min(hi, v.cx - W / 2 + v.face * 30)), y: lh - H };
  }
  snapCamera() { const t = this.camTarget(); this.cam.x = t.x; this.cam.y = t.y; }
  private updateCamera(dt: number) {
    this.exCallbacks();
    const t = this.camTarget();
    this.cam.x += (t.x - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y = t.y;
  }
  addShake(p: number) { if (this.shakeOn) this.shake = Math.max(this.shake, p); }
}

export const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Minutes after 11 PM → "1:23 AM". */
export const fmtClock = (m: number) => {
  const total = Math.floor(23 * 60 + m) % (24 * 60);
  const h24 = Math.floor(total / 60), mm = total % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
};
export { ENCOUNTERS };
