// A fixed pool of square pixels for sparks, dust and debris (no allocation per frame).
export interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number; on: boolean }

export class Particles {
  pool: P[] = Array.from({ length: 360 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 1, grav: 0, on: false }));
  private i = 0;
  /** 0–1: fewer particles under reduced motion. */
  density = 1;

  emit(x: number, y: number, n: number, color: string | string[], speed = 60, opts: { grav?: number; life?: number; size?: number; up?: boolean } = {}) {
    const count = Math.max(1, Math.round(n * this.density));
    for (let k = 0; k < count; k++) {
      const p = this.pool[this.i];
      this.i = (this.i + 1) % this.pool.length;
      const a = opts.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = (opts.life ?? 0.5) * (0.6 + Math.random() * 0.6);
      p.color = Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color;
      p.size = opts.size ?? (Math.random() < 0.3 ? 2 : 1);
      p.grav = opts.grav ?? 200;
      p.on = true;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  clear() { for (const p of this.pool) p.on = false; }
}
