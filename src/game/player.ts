// Patch's movement. Forgiving by design: coyote time, a jump buffer,
// variable jump height (release early for a short hop), and walking that
// turns into running after holding a direction for a moment.
import { PHYS, PLAYER } from './config';
import { move, type Grid, type Platform, type Body } from './physics';

export interface Controls { left: boolean; right: boolean; down: boolean; jump: boolean; jumpPressed: boolean }

export type PlayerEvent = 'jump' | 'land' | 'step';

export class Player implements Body {
  x = 0; y = 0; w = PLAYER.w; h = PLAYER.h; vx = 0; vy = 0;
  face: 1 | -1 = 1;
  onGround = false;
  platform: Platform | null = null;
  hp = PLAYER.maxHp;
  invuln = 0;
  /** Seconds since last on the ground (coyote time). */
  air = 0;
  /** Seconds since jump was pressed (jump buffer). */
  buffered = Infinity;
  held = 0; // how long a direction has been held
  jumping = false;
  /** Locked in place while repairing or hurt. */
  lock = 0;
  hurtTime = 0;
  anim = 0;
  stepTimer = 0;

  place(px: number, py: number) {
    this.x = px; this.y = py; this.vx = 0; this.vy = 0; this.onGround = false; this.platform = null;
    this.air = 0; this.buffered = Infinity; this.jumping = false; this.lock = 0; this.held = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt: number, c: Controls, grid: Grid, platforms: Platform[], emit: (e: PlayerEvent) => void) {
    this.anim += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtTime > 0) this.hurtTime -= dt;

    // Ride a moving platform: move with it before moving ourselves.
    if (this.platform && this.onGround) { this.x += this.platform.dx; this.y = this.platform.y - this.h; }

    const locked = this.lock > 0;
    if (locked) this.lock -= dt;
    const dir = locked ? 0 : (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (dir !== 0) { this.face = dir as 1 | -1; this.held += dt; } else this.held = 0;

    const top = this.held > PHYS.runAfter ? PHYS.run : PHYS.walk;
    const accel = this.onGround ? PHYS.accelGround : PHYS.accelAir;
    if (dir !== 0) {
      // Turning around is quick: brake harder against the current motion.
      const a = Math.sign(this.vx) === -dir ? accel * 1.8 : accel;
      this.vx += dir * a * dt;
      if (Math.abs(this.vx) > top) this.vx = Math.max(Math.abs(this.vx) - PHYS.friction * dt, top) * Math.sign(this.vx);
    } else if (this.hurtTime <= 0) {
      const f = (this.onGround ? PHYS.friction : PHYS.friction * 0.35) * dt;
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - f * Math.sign(this.vx);
    }

    // Jumping
    if (c.jumpPressed && !locked) this.buffered = 0; else this.buffered += dt;
    const canJump = this.onGround || this.air < PHYS.coyote;
    const drop = c.down && this.onGround && this.buffered === 0 && this.standingOnOneWay(grid);
    if (this.buffered < PHYS.buffer && canJump && !drop && !this.jumping) {
      this.vy = -PHYS.jump;
      this.jumping = true;
      this.onGround = false;
      this.platform = null;
      this.air = PHYS.coyote; // no second coyote jump
      this.buffered = Infinity;
      emit('jump');
    }
    if (this.jumping && !c.jump && this.vy < 0) { this.vy *= PHYS.jumpCut; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;

    this.vy = Math.min(this.vy + PHYS.gravity * dt, PHYS.maxFall);
    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    const hits = move(this, dt, grid, platforms, drop || this.dropping > 0);
    if (drop) this.dropping = 0.2;
    if (this.dropping > 0) this.dropping -= dt;
    this.onGround = hits.ground;
    this.platform = hits.platform;
    if (hits.ceil) this.jumping = false;
    if (this.onGround) {
      this.air = 0;
      if (!wasGround && fallSpeed > 120) emit('land');
      if (Math.abs(this.vx) > 20) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) { emit('step'); this.stepTimer = Math.abs(this.vx) > PHYS.walk + 10 ? 0.16 : 0.24; }
      }
    } else this.air += dt;
  }

  dropping = 0;

  private standingOnOneWay(grid: Grid) {
    const ty = Math.floor((this.y + this.h + 1) / 16);
    const l = Math.floor(this.x / 16), r = Math.floor((this.x + this.w - 0.01) / 16);
    let oneway = false;
    for (let tx = l; tx <= r; tx++) {
      const t = grid.at(tx, ty);
      if (t === 1) return false;
      if (t === 2) oneway = true;
    }
    return oneway;
  }

  hurt(fromX: number) {
    this.hp -= 1;
    this.invuln = PLAYER.invuln;
    this.hurtTime = 0.35;
    this.vx = (this.cx < fromX ? -1 : 1) * PLAYER.knockX;
    this.vy = -PLAYER.knockY;
    this.onGround = false;
    this.platform = null;
    this.jumping = false;
  }

  bounce(strong: boolean) {
    this.vy = -(strong ? PHYS.jump : PHYS.stompBounce);
    this.jumping = strong;
    this.onGround = false;
  }
}
