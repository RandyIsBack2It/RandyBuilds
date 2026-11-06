// AFTER HOURS actors: Viv, the enemies and the things that fly around.
// Logic only (no DOM); render.ts draws them, game.ts wires them together.
import { PHYS, VIV, ATTACK, DODGE, TILE } from './config';
import { move, groundBelow, type Grid } from '../../game/physics';
import type { Item } from './encounters';

export interface Box { x: number; y: number; w: number; h: number }
export const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export interface Pad { left: boolean; right: boolean; down: boolean; jump: boolean; jumpPressed: boolean; attackPressed: boolean; dodgePressed: boolean }
export type VivEvent = 'jump' | 'land' | 'step' | 'swing' | 'roll' | 'throw';

export class Viv implements Box {
  x = 0; y = 0; w = VIV.w; h = VIV.h; vx = 0; vy = 0;
  face: 1 | -1 = 1;
  onGround = false; air = 0; buffered = Infinity; jumping = false; held = 0; anim = 0; step = 0;
  dignity = VIV.maxDignity;
  invuln = 0; hurtT = 0; lock = 0;
  attackT = -1; attackCool = 0; hitIds = new Set<object>();
  dodgeT = -1; dodgeCool = 0;
  item: { kind: Item; uses: number; timer: number } | null = null;
  courage = 0; speed = 0; spotlight = 0;
  slippery = false;

  place(px: number, py: number) { this.x = px; this.y = py; this.vx = 0; this.vy = 0; this.onGround = false; this.jumping = false; this.lock = 0; this.attackT = -1; this.dodgeT = -1; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get rolling() { return this.dodgeT >= 0; }
  get swinging() { return this.attackT >= 0; }
  /** The handbag's (or cone's) reach while the swing is live. */
  strikeBox(): Box | null {
    if (this.attackT < ATTACK.active[0] || this.attackT > ATTACK.active[1]) return null;
    const reach = this.item?.kind === 'cone' ? 24 : ATTACK.reach;
    return { x: this.face > 0 ? this.x + this.w - 2 : this.x - reach + 2, y: this.y + 3, w: reach, h: ATTACK.height };
  }

  update(dt: number, c: Pad, grid: Grid, emit: (e: VivEvent) => void) {
    this.anim += dt;
    for (const k of ['invuln', 'hurtT', 'attackCool', 'dodgeCool', 'courage', 'speed', 'spotlight'] as const) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.item && this.item.kind === 'heel') { this.item.timer -= dt; if (this.item.timer <= 0) this.item = null; }
    const locked = this.lock > 0;
    if (locked) this.lock -= dt;

    // Dodge roll: quick, invulnerable, through enemies.
    if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      this.vx = this.face * DODGE.speed;
      if (this.dodgeT > DODGE.time) { this.dodgeT = -1; this.vx *= 0.4; }
    } else if (c.dodgePressed && !locked && this.dodgeCool <= 0 && this.hurtT <= 0) {
      this.dodgeT = 0; this.dodgeCool = DODGE.cooldown; this.attackT = -1; emit('roll');
    }

    // Attack
    if (this.attackT >= 0) { this.attackT += dt; if (this.attackT > ATTACK.time) this.attackT = -1; }
    else if (c.attackPressed && !locked && this.attackCool <= 0 && !this.rolling) {
      this.attackCool = ATTACK.cooldown * (this.courage > 0 ? 0.7 : 1);
      if (this.item && (this.item.kind === 'glass' || this.item.kind === 'heel')) { this.attackT = ATTACK.active[1]; emit('throw'); }
      else { this.attackT = 0; this.hitIds.clear(); emit('swing'); }
    }

    const dir = locked || this.rolling ? 0 : (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (dir !== 0 && !this.swinging) this.face = dir as 1 | -1;
    if (dir !== 0) this.held += dt; else this.held = 0;
    const boost = (this.speed > 0 ? 1.35 : 1) * (this.courage > 0 ? 1.15 : 1);
    const top = (this.held > PHYS.runAfter ? PHYS.run : PHYS.walk) * boost * (this.swinging && this.onGround ? 0.45 : 1);
    if (!this.rolling) {
      const grip = this.slippery && this.onGround ? 0.25 : 1;
      const accel = (this.onGround ? PHYS.accelGround : PHYS.accelAir) * grip;
      if (dir !== 0) {
        this.vx += dir * (Math.sign(this.vx) === -dir ? accel * 1.8 : accel) * dt;
        if (Math.abs(this.vx) > top) this.vx = Math.max(Math.abs(this.vx) - PHYS.friction * dt, top) * Math.sign(this.vx);
      } else if (this.hurtT <= 0) {
        const f = (this.onGround ? PHYS.friction * grip : PHYS.friction * 0.35) * dt;
        this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - f * Math.sign(this.vx);
      }
    }

    if (c.jumpPressed && !locked) this.buffered = 0; else this.buffered += dt;
    const can = this.onGround || this.air < PHYS.coyote;
    if (this.buffered < PHYS.buffer && can && !this.jumping && !this.rolling) {
      this.vy = -PHYS.jump; this.jumping = true; this.onGround = false; this.air = PHYS.coyote; this.buffered = Infinity; emit('jump');
    }
    if (this.jumping && !c.jump && this.vy < 0) { this.vy *= PHYS.jumpCut; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;
    this.vy = Math.min(this.vy + PHYS.gravity * dt, PHYS.maxFall);
    const was = this.onGround, fall = this.vy;
    const h = move(this, dt, grid, [], c.down && c.jumpPressed);
    this.onGround = h.ground;
    if (h.ceil) this.jumping = false;
    if (this.onGround) {
      this.air = 0;
      if (!was && fall > 140) emit('land');
      if (Math.abs(this.vx) > 25) { this.step -= dt; if (this.step <= 0) { emit('step'); this.step = 0.22; } }
    } else this.air += dt;
  }

  hurt(fromX: number, amount: number) {
    this.dignity -= amount;
    this.invuln = VIV.invuln; this.hurtT = 0.35;
    this.vx = (this.cx < fromX ? -1 : 1) * VIV.knockX; this.vy = -VIV.knockY;
    this.onGround = false; this.jumping = false; this.attackT = -1; this.dodgeT = -1;
  }
  bounce() { this.vy = -260; this.onGround = false; this.jumping = false; }
}

// ── Enemies ──────────────────────────────────────────────────────────
export type Cause = 'bouncer' | 'guard' | 'ex' | 'cook' | 'rat' | 'hazard' | 'boss' | 'fall';

export abstract class Foe implements Box {
  abstract w: number; abstract h: number;
  vx = 0; vy = 0; face: 1 | -1 = -1;
  hp = 1; flash = 0; stun = 0; dying = 0; dead = false; t = Math.random() * 3; onGround = false;
  abstract cause: Cause;
  abstract points: number;
  constructor(public x: number, public y: number) {}
  get alive() { return !this.dead && this.dying <= 0; }
  get cx() { return this.x + this.w / 2; }
  /** Returns true if this hit defeated it. */
  takeHit(dmg: number, dir: number, knock: number) {
    if (!this.alive) return false;
    this.hp -= dmg; this.flash = 0.12; this.stun = Math.max(this.stun, 0.35);
    this.vx = dir * knock * this.knockScale; this.vy = -120 * this.knockScale;
    if (this.hp <= 0) { this.dying = 0.7; this.vy = -200; return true; }
    return false;
  }
  knockScale = 1;
  protected physics(dt: number, grid: Grid) {
    this.vy = Math.min(this.vy + 1000 * dt, 340);
    const h = move(this, dt, grid);
    this.onGround = h.ground;
    return h;
  }
  base(dt: number, grid: Grid) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.dying > 0) { this.dying -= dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 900 * dt; if (this.dying <= 0) this.dead = true; return true; }
    if (this.stun > 0) { this.stun -= dt; this.vx *= Math.pow(0.02, dt); this.physics(dt, grid); return true; }
    return false;
  }
  abstract update(dt: number, grid: Grid, p: Viv, chaos: number): void;
  /** Can it touch Viv right now? */
  harmful() { return this.alive && this.stun <= 0; }
}

/** Patrols with a flashlight; spots Viv in the beam, then chases. Sneak up from behind. */
export class Guard extends Foe {
  w = 11; h = 22; cause: Cause = 'guard'; points = 100;
  state: 'patrol' | 'alert' | 'chase' = 'patrol'; alertT = 0; chaseT = 0;
  constructor(x: number, y: number, public home: number, public range: number, public alertOnStart = false, public kind: 'guard' | 'cook' = 'guard') {
    super(x, y);
    this.hp = 2;
    if (kind === 'cook') { this.cause = 'cook'; this.points = 150; }
    if (alertOnStart) { this.state = 'chase'; this.chaseT = 6; }
  }
  beam(): Box { return { x: this.face > 0 ? this.x + this.w : this.x - 64, y: this.y - 4, w: 64, h: 26 }; }
  update(dt: number, grid: Grid, p: Viv, chaos: number) {
    if (this.base(dt, grid)) return;
    const k = 1 + chaos / 200;
    if (this.state === 'patrol') {
      if (Math.abs(this.x - this.home) > this.range) this.face = this.x > this.home ? -1 : 1;
      this.vx = this.face * 28 * k;
      if (!p.rolling && hit(this.beam(), p)) { this.state = 'alert'; this.alertT = 0.45; this.vx = 0; }
    } else if (this.state === 'alert') {
      this.vx = 0; this.alertT -= dt;
      if (this.alertT <= 0) { this.state = 'chase'; this.chaseT = 4.5; }
    } else {
      this.chaseT -= dt;
      this.face = p.cx > this.cx ? 1 : -1;
      this.vx = this.face * 92 * k;
      if (this.chaseT <= 0) { this.state = 'patrol'; this.home = this.x; }
    }
    const h = this.physics(dt, grid);
    if (h.wall) this.face = this.face > 0 ? -1 : 1;
    if (this.onGround && this.state === 'patrol' && !groundBelow(grid, this.face > 0 ? this.x + this.w + 1 : this.x - 1, this.y + this.h)) this.face = this.face > 0 ? -1 : 1;
  }
  takeHit(dmg: number, dir: number, knock: number) { const r = super.takeHit(dmg, dir, knock); if (this.alive) { this.state = 'chase'; this.chaseT = 5; } return r; }
}

/** Slow and heavy. Winds up, then shoves you across the room. Only every second hit makes him flinch. */
export class Bouncer extends Foe {
  w = 20; h = 26; cause: Cause = 'bouncer'; points = 300; knockScale = 0.35;
  state: 'walk' | 'windup' | 'shove' | 'rest' = 'walk'; st = 0; hits = 0;
  constructor(x: number, y: number) { super(x, y); this.hp = 7; }
  update(dt: number, grid: Grid, p: Viv, chaos: number) {
    if (this.base(dt, grid)) return;
    const k = 1 + chaos / 250;
    const dx = p.cx - this.cx;
    this.st -= dt;
    if (this.state === 'walk') {
      this.face = dx > 0 ? 1 : -1;
      this.vx = this.face * 32 * k;
      if (Math.abs(dx) < 70 && Math.abs(p.cy - (this.y + 13)) < 30) { this.state = 'windup'; this.st = 0.55; this.vx = 0; }
    } else if (this.state === 'windup') {
      this.vx = 0;
      if (this.st <= 0) { this.state = 'shove'; this.st = 0.32; }
    } else if (this.state === 'shove') {
      this.vx = this.face * 190 * k;
      if (this.st <= 0) { this.state = 'rest'; this.st = 0.7; }
    } else { this.vx = 0; if (this.st <= 0) this.state = 'walk'; }
    this.physics(dt, grid);
  }
  takeHit(dmg: number, dir: number, knock: number) {
    this.hits++;
    if (this.hits % 2 === 1 && this.hp - dmg > 0) { this.hp -= dmg; this.flash = 0.1; return false; }
    if (this.state === 'windup') this.state = 'walk';
    return super.takeHit(dmg, dir, knock);
  }
  get shoving() { return this.state === 'shove'; }
}

const EX_LINES = ['Is that MY hoodie?', 'We should talk.', 'I’ve been working on myself.', 'My therapist says hi.', 'You looked happy. Rude.', 'I made you a playlist.', 'Who was that elbow?!'];

/** The jealous ex. Follows you through the night if your choices invite him. Throws his phone. */
export class Ex extends Foe {
  w = 11; h = 22; cause: Cause = 'ex'; points = 250;
  throwT = 2.5; line = ''; lineT = 0; lineCool = 1;
  constructor(x: number, y: number, public mood: 'jealous' | 'confused' | 'blocked') {
    super(x, y);
    this.hp = mood === 'jealous' ? 6 : mood === 'confused' ? 3 : 4;
  }
  update(dt: number, grid: Grid, p: Viv, chaos: number, fire?: (pr: Projectile) => void) {
    if (this.lineT > 0) this.lineT -= dt;
    if (this.base(dt, grid)) return;
    const dx = p.cx - this.cx;
    this.face = dx > 0 ? 1 : -1;
    const k = (this.mood === 'jealous' ? 1 : 0.8) * (1 + chaos / 250);
    // Confused: wanders off in the wrong direction now and then.
    const lost = this.mood === 'confused' && Math.sin(this.t * 0.9) > 0.6;
    this.vx = (lost ? -this.face : this.face) * (Math.abs(dx) > 30 ? 88 : 40) * k;
    if ((this.lineCool -= dt) <= 0) { this.line = EX_LINES[Math.floor(Math.random() * EX_LINES.length)]; this.lineT = 2.2; this.lineCool = 4 + Math.random() * 3; }
    if ((this.throwT -= dt) <= 0 && Math.abs(dx) < 170 && fire) {
      this.throwT = this.mood === 'jealous' ? 2.2 : 3.4;
      fire(new Projectile('phone', this.cx, this.y + 6, this.face * 120, -170, 'enemy'));
    }
    const h = this.physics(dt, grid);
    if (h.wall && this.onGround) this.vy = -300;
  }
}

/** Alley rat (or one of the raccoon's friends). */
export class Rat extends Foe {
  w = 13; h = 7; cause: Cause = 'rat'; points = 50;
  constructor(x: number, y: number) { super(x, y); this.vx = -50; this.face = -1; }
  update(dt: number, grid: Grid) {
    if (this.base(dt, grid)) return;
    if (this.stun <= 0 && Math.abs(this.vx) < 40) this.vx = this.face * 55;
    const h = this.physics(dt, grid);
    if (h.wall || (this.onGround && !groundBelow(grid, this.vx > 0 ? this.x + this.w + 1 : this.x - 1, this.y + this.h))) { this.vx = -this.vx; this.face = this.face > 0 ? -1 : 1; }
    if (this.onGround && Math.random() < dt * 0.4) this.vy = -200;
  }
}

// ── Projectiles and hazards ───────────────────────────────────────────
export type Shot = 'glass' | 'heel' | 'phone' | 'cork' | 'plate' | 'bottle' | 'wave' | 'ticket' | 'petal';

export class Projectile implements Box {
  w = 6; h = 6; dead = false; life = 4; t = 0; returning = false;
  constructor(public kind: Shot, public x: number, public y: number, public vx: number, public vy: number, public side: 'viv' | 'enemy') {
    if (kind === 'wave') { this.w = 16; this.h = 10; this.life = 3; }
    if (kind === 'plate') { this.w = 8; this.h = 4; }
    if (kind === 'heel') this.life = 1.4;
  }
  get gravity() { return this.kind === 'phone' || this.kind === 'cork' || this.kind === 'bottle' ? 600 : this.kind === 'petal' ? 40 : 0; }
  update(dt: number, grid: Grid, owner?: Box) {
    this.t += dt; this.life -= dt;
    if (this.kind === 'heel' && owner) {
      // Boomerang: out, then back to Viv.
      if (this.t > 0.38) this.returning = true;
      if (this.returning) {
        const dx = owner.x + owner.w / 2 - this.x, dy = owner.y + 8 - this.y, d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * 260; this.vy = (dy / d) * 260;
        if (d < 10) this.dead = true;
      }
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.life <= 0) this.dead = true;
    if (this.kind !== 'heel' && this.kind !== 'wave' && grid.solid(Math.floor((this.x + this.w / 2) / TILE), Math.floor((this.y + this.h / 2) / TILE))) this.dead = true;
  }
}

/** Steam vent: hisses, then blasts a column for a moment. */
export class Steam {
  constructor(public x: number, public period: number, public offset: number) {}
  phase(t: number) { return ((t + this.offset) % this.period + this.period) % this.period; }
  state(t: number): 'off' | 'warn' | 'on' { const p = this.phase(t); return p < 0.7 ? 'on' : p > this.period - 0.5 ? 'warn' : 'off'; }
  box(floorY: number): Box { return { x: this.x + 3, y: floorY - 40, w: 10, h: 40 }; }
}

export class Pickup implements Box {
  w = 10; h = 10; taken = false; t = Math.random() * 3;
  constructor(public x: number, public y: number, public kind: 'cash' | 'cash20' | 'lipstick' | 'skull' | 'disco' | 'courage' | Item) {}
}
