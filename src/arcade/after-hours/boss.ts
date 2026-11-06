// LORENZO VELOUR, self-proclaimed love guru, in the Hot Tub of Truth.
//   Phase 1 · Charm Offensive: champagne corks (arcing) and the Velour Lunge (jump it).
//   Phase 2 · The Entourage: calls security; a disco ball sweeps light beams (marked on the floor first).
//   Phase 3 · Hot Tub Tsunami: hides in the tub firing waves along the floor, then pops out to
//            monologue about himself. That's when he's open.
// Every attack is telegraphed: a pose, a shine, or floor markers.
export type BossEvent =
  | { type: 'cork'; x: number; y: number; vx: number; vy: number }
  | { type: 'wave'; x: number; y: number; vx: number }
  | { type: 'summon' }
  | { type: 'line'; text: string }
  | { type: 'sfx'; name: 'bossPop' | 'bossLunge' | 'bossLaugh' | 'disco' | 'splash' | 'bossHit' | 'bossDown' }
  | { type: 'shake'; power: number }
  | { type: 'phase'; n: 2 | 3 }
  | { type: 'defeated' };

export type BossState = 'intro' | 'strut' | 'corkPose' | 'lungePose' | 'lunge' | 'summon' | 'disco' | 'toTub' | 'tub' | 'monologue' | 'stunned' | 'defeat' | 'gone';

export const BOSS_HP = 30;

const LINES = {
  intro: 'Love is a journey. My journey is a hot tub.',
  p2: 'SECURITY! Someone is being authentic at me!',
  p3: 'To the tub! The tub understands me!',
  monologue: ['Do you know who I AM?', 'I have a podcast. Two, actually.', 'My robe has a robe.', 'Women love me. Statistically. Somewhere.', 'I invented eye contact.'],
  defeat: 'This robe… was… a gift…',
};

export class Lorenzo {
  w = 20; h = 26;
  x: number; y: number;
  hp = BOSS_HP;
  state: BossState = 'intro';
  st = 2.2;
  face: 1 | -1 = -1;
  phase: 1 | 2 | 3 = 1;
  flash = 0;
  invuln = 0;
  vx = 0;
  /** Disco beams: x positions (px) and how long until they fire / stop. */
  beams: { x: number; warn: number; on: number }[] = [];
  cycle = 0;
  robeFell = false;
  flyT = 0;
  aggression = 1;
  wavesLeft = 0;
  tubX: number;

  constructor(public left: number, public right: number, public floorY: number, tubX: number, public opts: { unplugged: boolean; flattered: boolean; hotTub: boolean }) {
    this.tubX = tubX;
    this.x = tubX + 6; this.y = floorY - this.h - 8;
    if (opts.flattered) this.hp = Math.round(BOSS_HP * 0.8);
    if (opts.hotTub) this.aggression = 1.25;
  }

  get cx() { return this.x + this.w / 2; }
  get vulnerable() { return this.invuln <= 0 && this.state !== 'intro' && this.state !== 'tub' && this.state !== 'toTub' && this.state !== 'defeat' && this.state !== 'gone'; }
  get harmful() { return !['intro', 'monologue', 'stunned', 'defeat', 'gone', 'tub', 'toTub'].includes(this.state); }
  get inTub() { return this.state === 'tub' || this.state === 'toTub'; }

  /** Returns damage actually dealt. */
  hit(dmg: number, emit: (e: BossEvent) => void, tip: boolean) {
    if (!this.vulnerable) return 0;
    const d = this.state === 'monologue' && tip ? dmg * 2 : dmg;
    this.hp = Math.max(0, this.hp - d);
    this.flash = 0.15; this.invuln = 0.22;
    emit({ type: 'sfx', name: 'bossHit' });
    if (this.hp <= 0) { this.state = 'defeat'; this.st = 3.6; this.vx = 0; emit({ type: 'line', text: LINES.defeat }); emit({ type: 'sfx', name: 'bossDown' }); emit({ type: 'shake', power: 5 }); }
    else if (this.phase === 1 && this.hp <= BOSS_HP * 0.66) { this.phase = 2; this.state = 'summon'; this.st = 1.2; emit({ type: 'phase', n: 2 }); emit({ type: 'line', text: LINES.p2 }); emit({ type: 'summon' }); }
    else if (this.phase === 2 && this.hp <= BOSS_HP * 0.33) { this.phase = 3; this.state = 'toTub'; this.st = 0.8; emit({ type: 'phase', n: 3 }); emit({ type: 'line', text: LINES.p3 }); }
    return d;
  }

  stunFor(t: number) { this.state = 'stunned'; this.st = t; this.vx = 0; }

  update(dt: number, px: number, emit: (e: BossEvent) => void) {
    if (this.flash > 0) this.flash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    for (const b of this.beams) { if (b.warn > 0) b.warn -= dt; else b.on -= dt; }
    this.beams = this.beams.filter((b) => b.warn > 0 || b.on > 0);
    this.st -= dt;
    const k = this.aggression;
    const groundY = this.floorY - this.h;
    switch (this.state) {
      case 'intro':
        this.y += (groundY - 8 - this.y) * Math.min(1, dt * 3);
        if (this.st <= 1.9 && this.st + dt > 1.9) emit({ type: 'line', text: LINES.intro });
        if (this.st <= 0) { this.y = groundY; this.x = this.tubX - 30; this.next(); }
        return;
      case 'strut':
        this.face = px > this.cx ? 1 : -1;
        this.vx = this.face * 38 * k;
        this.move(dt);
        if (this.st <= 0) this.next();
        return;
      case 'corkPose':
        this.vx = 0;
        if (this.st <= 0) {
          emit({ type: 'sfx', name: 'bossPop' });
          const n = this.phase === 1 ? 3 : 4;
          for (let i = 0; i < n; i++) {
            const dx = px - this.cx;
            emit({ type: 'cork', x: this.cx, y: this.y + 4, vx: dx * (0.55 + i * 0.25) * k + (i - 1) * 25, vy: -260 - i * 30 });
          }
          this.state = 'strut'; this.st = 1.1;
        }
        return;
      case 'lungePose':
        this.vx = 0;
        if (this.st <= 0) { this.state = 'lunge'; this.st = 1.4; emit({ type: 'sfx', name: 'bossLunge' }); }
        return;
      case 'lunge':
        this.vx = this.face * 230 * k;
        if (this.move(dt) || this.st <= 0) { this.vx = 0; this.state = 'strut'; this.st = 0.9; emit({ type: 'shake', power: 2 }); }
        return;
      case 'summon':
        this.vx = 0;
        if (this.st <= 0) this.next();
        return;
      case 'disco':
        this.vx = 0;
        if (this.st <= 0) this.next();
        return;
      case 'toTub':
        this.x += (this.tubX + 6 - this.x) * Math.min(1, dt * 5);
        this.y += (groundY - 4 - this.y) * Math.min(1, dt * 5);
        if (this.st <= 0) { this.state = 'tub'; this.wavesLeft = 3; this.st = 0.9; emit({ type: 'sfx', name: 'splash' }); }
        return;
      case 'tub':
        this.x = this.tubX + 6; this.y = groundY + 6;
        if (this.st <= 0) {
          if (this.wavesLeft > 0) {
            this.wavesLeft--;
            this.st = this.opts.unplugged ? 1.4 : 1.15 / k;
            emit({ type: 'wave', x: this.tubX - 12, y: this.floorY, vx: -(this.opts.unplugged ? 90 : 140) });
            emit({ type: 'sfx', name: 'splash' });
          } else {
            this.state = 'monologue'; this.st = 2.4;
            this.x = (this.left + this.right) / 2 - this.w / 2; this.y = groundY;
            emit({ type: 'line', text: LINES.monologue[this.cycle++ % LINES.monologue.length] });
            emit({ type: 'sfx', name: 'bossLaugh' });
          }
        }
        return;
      case 'monologue':
        this.vx = 0;
        if (this.st <= 0) { this.state = 'toTub'; this.st = 0.6; }
        return;
      case 'stunned':
        this.vx = 0;
        if (this.st <= 0) this.next();
        return;
      case 'defeat':
        // The robe falls. Underneath: another, smaller robe. Then an inflatable flamingo exit.
        if (this.st < 2.6) this.robeFell = true;
        if (this.st < 1.6) { this.flyT += dt; this.x += 70 * dt; this.y -= 55 * dt; }
        if (this.st <= 0) { this.state = 'gone'; emit({ type: 'defeated' }); }
        return;
      case 'gone':
        return;
    }
  }

  /** Moves along the floor; returns true if it hit a wall of the arena. */
  private move(dt: number) {
    this.x += this.vx * dt;
    const min = this.left + 4, max = this.tubX - this.w - 2;
    if (this.x < min) { this.x = min; this.face = 1; return true; }
    if (this.x > max) { this.x = max; this.face = -1; return true; }
    return false;
  }

  private next() {
    const roll = Math.random();
    if (this.phase === 1) {
      if (roll < 0.45) { this.state = 'corkPose'; this.st = 0.55; }
      else if (roll < 0.8) { this.state = 'lungePose'; this.st = 0.65; }
      else { this.state = 'strut'; this.st = 1; }
    } else if (this.phase === 2) {
      if (roll < 0.35) { this.state = 'disco'; this.st = 2.2; this.spawnBeams(); }
      else if (roll < 0.65) { this.state = 'corkPose'; this.st = 0.5; }
      else if (roll < 0.9) { this.state = 'lungePose'; this.st = 0.55; }
      else { this.state = 'strut'; this.st = 0.8; }
    } else {
      this.state = 'toTub'; this.st = 0.6;
    }
  }

  private spawnBeams() {
    const span = this.tubX - this.left - 20;
    const n = 3;
    const start = Math.random() * (span / n);
    for (let i = 0; i < n; i++) this.beams.push({ x: this.left + 10 + start + (i * span) / n, warn: 0.85, on: 0.6 });
  }
}
