// Enemies, hazards and objects. Logic only (no DOM); render.ts draws them.
import { TILE } from './config';
import { move, groundBelow, type Grid, type Platform } from './physics';

export interface Box { x: number; y: number; w: number; h: number }

/** A patrolling glitch: walks, turns at walls and ledges. Stomp or pulse it. */
export class Glitch implements Box {
  w = 14; h = 10; vx = -32; vy = 0; dying = 0; dead = false; t = Math.random() * 2;
  constructor(public x: number, public y: number) {}
  update(dt: number, grid: Grid) {
    this.t += dt;
    if (this.dying > 0) { this.dying -= dt; if (this.dying <= 0) this.dead = true; return; }
    this.vy = Math.min(this.vy + 900 * dt, 300);
    const hits = move(this, dt, grid);
    if (hits.wall) this.vx = this.vx > 0 ? -32 : 32;
    if (hits.ground) {
      const ahead = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundBelow(grid, ahead, this.y + this.h)) this.vx = -this.vx;
    }
  }
  kill() { this.dying = 0.45; }
  get alive() { return this.dying <= 0 && !this.dead; }
}

/** A hovering drone. Patrols around its post; a chaser follows Patch when close. */
export class Drone implements Box {
  w = 12; h = 10; t = Math.random() * 6; dying = 0; dead = false; vx = 0; vy = 0;
  x: number; y: number;
  constructor(public ax: number, public ay: number, public rx: number, public chase: boolean) { this.x = ax; this.y = ay; }
  update(dt: number, px: number, py: number) {
    this.t += dt;
    if (this.dying > 0) { this.dying -= dt; this.y += 60 * dt; if (this.dying <= 0) this.dead = true; return; }
    const dx = px - (this.x + this.w / 2), dy = py - (this.y + this.h / 2);
    if (this.chase && Math.hypot(dx, dy) < 120) {
      // Slow pursuit, so it can be outrun.
      this.vx += Math.sign(dx) * 90 * dt; this.vy += Math.sign(dy) * 70 * dt;
      const s = Math.hypot(this.vx, this.vy), max = 40;
      if (s > max) { this.vx *= max / s; this.vy *= max / s; }
      this.x += this.vx * dt; this.y += this.vy * dt + Math.sin(this.t * 4) * 0.2;
    } else {
      const tx = this.ax + Math.sin(this.t * 0.9) * this.rx, ty = this.ay + Math.sin(this.t * 2.1) * 4;
      this.x += (tx - this.x) * Math.min(1, dt * 3); this.y += (ty - this.y) * Math.min(1, dt * 3);
      this.vx = 0; this.vy = 0;
    }
  }
  kill() { this.dying = 0.5; }
  get alive() { return this.dying <= 0 && !this.dead; }
}

export class Bullet implements Box {
  w = 6; h = 6; dead = false; life = 4;
  constructor(public x: number, public y: number, public vx: number, public vy: number, public kind: 'bit' | 'big' = 'bit') {}
  update(dt: number, grid: Grid) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
    if (this.life <= 0 || grid.solid(Math.floor((this.x + 3) / TILE), Math.floor((this.y + 3) / TILE))) this.dead = true;
  }
}

/** A security turret. Fires along the floor while Patch is in front of it; a pulse repairs it. */
export class Turret implements Box {
  w = 14; h = 14; timer = 1.2; fixed = false; flash = 0;
  constructor(public x: number, public y: number, public dir: 1 | -1) {}
  update(dt: number, px: number, py: number, fire: (b: Bullet) => void) {
    if (this.flash > 0) this.flash -= dt;
    if (this.fixed) return;
    const dx = px - (this.x + this.w / 2), dy = py - (this.y + this.h / 2);
    const inFront = Math.sign(dx) === this.dir && Math.abs(dx) < 180 && Math.abs(dy) < 44;
    this.timer -= dt;
    if (inFront && this.timer <= 0) {
      this.timer = 1.9;
      this.flash = 0.12;
      fire(new Bullet(this.dir > 0 ? this.x + this.w : this.x - 6, this.y + 4, this.dir * 92, 0));
    } else if (!inFront && this.timer < 0.6) this.timer = 0.6;
  }
}

/** Moving platform: eases back and forth between its start and start + (dx, dy) tiles. */
export class Mover implements Platform {
  x: number; y: number; w: number; dx = 0; dy = 0; prevY: number; t: number;
  constructor(public bx: number, public by: number, wTiles: number, public ex: number, public ey: number, public period: number, phase = 0) {
    this.x = bx; this.y = by; this.prevY = by; this.w = wTiles * TILE; this.t = phase * period;
  }
  update(dt: number) {
    this.t += dt;
    const k = 0.5 - 0.5 * Math.cos((this.t / this.period) * Math.PI * 2);
    const nx = this.bx + this.ex * k, ny = this.by + this.ey * k;
    this.dx = nx - this.x; this.dy = ny - this.y;
    this.prevY = this.y;
    this.x = nx; this.y = ny;
  }
}

/** Electric arc between an emitter and the floor. Flickers as a warning before it fires. */
export class Arc {
  constructor(public x: number, public y0: number, public y1: number, public period: number, public offset: number) {}
  phase(t: number) { return ((t + this.offset) % this.period + this.period) % this.period; }
  /** 'on' hurts; 'warn' flickers for 0.45 s before. */
  state(t: number): 'off' | 'warn' | 'on' {
    const p = this.phase(t), on = this.period * 0.45;
    if (p < on) return 'on';
    if (p > this.period - 0.45) return 'warn';
    return 'off';
  }
  box(): Box { return { x: this.x - 3, y: this.y0, w: 6, h: this.y1 - this.y0 }; }
}

export class Terminal implements Box {
  w = 16; h = 22; repaired = false; progress = 0; glow = 0;
  constructor(public x: number, public y: number, public boss: 0 | 1 | 2 | 3, public hidden: boolean) {}
}

export class Pickup implements Box {
  w = 8; h = 9; taken = false; t = Math.random() * 3;
  constructor(public x: number, public y: number, public kind: 'cell' | 'kit') { if (kind === 'kit') { this.w = 10; this.h = 10; } }
}

export class Checkpoint implements Box {
  w = 10; h = 24; active = false; t = 0;
  constructor(public x: number, public y: number) {}
}

export class Exit implements Box {
  w = 16; h = 32; open = false; t = 0;
  constructor(public x: number, public y: number, public gate: boolean) {}
}

/** Shockwave from the boss's slam: runs along the floor; jump over it. */
export class Wave implements Box {
  w = 12; h = 10; dead = false; life = 2.6;
  constructor(public x: number, public y: number, public vx: number) {}
  update(dt: number, grid: Grid) {
    this.x += this.vx * dt; this.life -= dt;
    const tx = Math.floor((this.vx > 0 ? this.x + this.w : this.x) / TILE);
    if (this.life <= 0 || grid.solid(tx, Math.floor((this.y + 4) / TILE))) this.dead = true;
  }
}
