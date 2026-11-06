// THE KERNEL — the corrupted core at the end of level 3. Three stages that
// use everything learned so far:
//   1. Shielded: it fires aimed bursts and drops glitches while Patch repairs
//      the two side terminals (each repair hits it with a beam).
//   2. Unstable: shield down. It slams the floor (jump the shockwaves) and the
//      centre terminal comes online above the lift.
//   3. Exposed: the third repair knocks it low. Pulse or stomp it six times
//      while dodging its ring bursts.
export type BossEvent =
  | { type: 'shoot'; x: number; y: number; vx: number; vy: number; big?: boolean }
  | { type: 'glitch'; x: number; y: number }
  | { type: 'slam'; x: number; y: number }
  | { type: 'sfx'; name: 'bossShoot' | 'bossRoar' | 'bossWarn' | 'bossHit' | 'explode' | 'shield' }
  | { type: 'shake'; power: number }
  | { type: 'reveal' }
  | { type: 'dead' };

export type Stage = 'intro' | 'shielded' | 'unstable' | 'exposed' | 'dying' | 'dead';

export const BOSS_HP = 6;

export class Boss {
  stage: Stage = 'intro';
  x: number; y: number; // centre
  r = 18;
  t = 0;
  stageT = 0;
  hp = BOSS_HP;
  nodes = 0; // terminals repaired
  hitFlash = 0;
  invuln = 0;
  shoot = 2;
  spawn = 5;
  slam = 4.5;
  slamming: 'no' | 'warn' | 'drop' | 'rise' = 'no';
  slamT = 0;
  ring = 2.5;
  look = 0; // eye direction towards Patch, -1..1
  baseY: number;
  floorY: number;
  constructor(public cx: number, public topY: number, public left: number, public right: number, floorY: number) {
    this.x = cx; this.baseY = topY + 34; this.y = topY - 60; this.floorY = floorY;
  }

  get vulnerable() { return this.stage === 'exposed' && this.invuln <= 0; }
  get touchable() { return this.stage !== 'intro' && this.stage !== 'dying' && this.stage !== 'dead'; }

  nodeRepaired(emit: (e: BossEvent) => void) {
    this.nodes++;
    this.hitFlash = 0.5;
    emit({ type: 'sfx', name: 'bossHit' });
    emit({ type: 'shake', power: 4 });
    if (this.nodes === 2) { this.setStage('unstable'); emit({ type: 'sfx', name: 'shield' }); emit({ type: 'reveal' }); }
    if (this.nodes === 3) { this.setStage('exposed'); this.slamming = 'no'; emit({ type: 'sfx', name: 'bossRoar' }); }
  }

  /** A pulse or stomp landed. Returns true if it did damage. */
  hit(emit: (e: BossEvent) => void) {
    if (!this.vulnerable) return false;
    this.hp--;
    this.invuln = 0.7;
    this.hitFlash = 0.35;
    emit({ type: 'sfx', name: 'bossHit' });
    emit({ type: 'shake', power: 3 });
    if (this.hp <= 0) { this.setStage('dying'); emit({ type: 'sfx', name: 'explode' }); }
    return true;
  }

  private setStage(s: Stage) { this.stage = s; this.stageT = 0; }

  update(dt: number, px: number, py: number, emit: (e: BossEvent) => void) {
    this.t += dt; this.stageT += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    this.look += (Math.max(-1, Math.min(1, (px - this.x) / 80)) - this.look) * Math.min(1, dt * 5);
    const mid = (this.left + this.right) / 2, span = (this.right - this.left) / 2 - 40;
    const aim = (speed: number, spread: number[]) => {
      const a = Math.atan2(py - this.y, px - this.x);
      for (const s of spread) emit({ type: 'shoot', x: this.x, y: this.y + 6, vx: Math.cos(a + s) * speed, vy: Math.sin(a + s) * speed });
      emit({ type: 'sfx', name: 'bossShoot' });
    };

    switch (this.stage) {
      case 'intro':
        this.y += (this.baseY - this.y) * Math.min(1, dt * 1.5);
        if (this.stageT > 0.2 && this.stageT - dt <= 0.2) emit({ type: 'sfx', name: 'bossRoar' });
        if (this.stageT > 2.2) this.setStage('shielded');
        return;
      case 'shielded':
        this.x = mid + Math.sin(this.t * 0.55) * span;
        this.y = this.baseY + Math.sin(this.t * 1.3) * 8;
        if ((this.shoot -= dt) <= 0) { this.shoot = 2.4; aim(82, [-0.28, 0, 0.28]); }
        if ((this.spawn -= dt) <= 0) { this.spawn = 7.5; emit({ type: 'glitch', x: this.x, y: this.y + 16 }); }
        return;
      case 'unstable':
        if (this.slamming === 'no') {
          this.x = mid + Math.sin(this.t * 0.7) * span;
          this.y = this.baseY + Math.sin(this.t * 1.6) * 8;
          if ((this.shoot -= dt) <= 0) { this.shoot = 2.8; aim(92, [-0.4, -0.2, 0, 0.2, 0.4]); }
          if ((this.slam -= dt) <= 0) { this.slamming = 'warn'; this.slamT = 0; emit({ type: 'sfx', name: 'bossWarn' }); }
        } else {
          this.slamT += dt;
          if (this.slamming === 'warn') {
            this.x += Math.sin(this.t * 60) * 0.6;
            if (this.slamT > 0.7) { this.slamming = 'drop'; this.slamT = 0; }
          } else if (this.slamming === 'drop') {
            this.y += 360 * dt;
            if (this.y + this.r >= this.floorY) {
              this.y = this.floorY - this.r;
              emit({ type: 'slam', x: this.x, y: this.floorY });
              emit({ type: 'shake', power: 6 });
              this.slamming = 'rise'; this.slamT = 0;
            }
          } else if (this.slamming === 'rise' && this.slamT > 0.5) {
            this.y += (this.baseY - this.y) * Math.min(1, dt * 2.5);
            if (Math.abs(this.y - this.baseY) < 2) { this.slamming = 'no'; this.slam = 5.5; this.shoot = 1.4; }
          }
        }
        return;
      case 'exposed': {
        const lowY = this.floorY - 40;
        if (this.stageT < 1.4) { this.y += (lowY - this.y) * Math.min(1, dt * 3); return; }
        this.x = mid + Math.sin(this.t * 0.45) * (span + 10);
        this.y = lowY + Math.sin(this.t * 2) * 6;
        if ((this.ring -= dt) <= 0) {
          this.ring = this.hp <= 3 ? 2.4 : 3.2;
          const n = this.hp <= 3 ? 10 : 8;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + this.t;
            emit({ type: 'shoot', x: this.x, y: this.y, vx: Math.cos(a) * 66, vy: Math.sin(a) * 66, big: true });
          }
          emit({ type: 'sfx', name: 'bossShoot' });
        }
        return;
      }
      case 'dying':
        this.y += 10 * dt;
        if (Math.random() < dt * 14) emit({ type: 'shake', power: 2 });
        if (this.stageT > 2.8) { this.setStage('dead'); emit({ type: 'dead' }); }
        return;
    }
  }
}
