// Draws AFTER HOURS at 320×180. Each zone's static scenery (walls, floors,
// furniture) is painted once into a canvas; skies and skylines are parallax
// layers; signs, rain, reflections, crowds and lights are drawn per frame.
import { W, H, TILE, CHAOS } from './config';
import { canvas, ctx2d, drawText, textImage, type Sprite } from '../../game/pixels';
import { art } from './art';
import { FLOOR_ROW, type Theme } from './zones';
import { Guard, Bouncer, Ex, Rat } from './actors';
import { fmtClock, type Game } from './game';
import { Tile } from '../../game/levels';

const FLOOR = FLOOR_ROW * TILE;
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return h ^ (h >>> 16); };
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function skyline(seed: number, base: string, lit: string[], tall: number) {
  const w = 512, c = canvas(w, H), x = ctx2d(c), r = rng(seed);
  for (let i = 0; i < w; i += 10 + Math.floor(r() * 22)) {
    const bw = 16 + Math.floor(r() * 30), bh = 40 + Math.floor(r() * tall);
    x.fillStyle = base; x.fillRect(i, H - bh, bw, bh);
    if (r() < 0.3) x.fillRect(i + Math.floor(bw / 2), H - bh - 8, 1, 8);
    for (let y = H - bh + 4; y < H - 4; y += 5) for (let k = i + 2; k < i + bw - 2; k += 4) if (r() < 0.32) { x.fillStyle = lit[Math.floor(r() * lit.length)]; x.fillRect(k, y, 2, 2); }
  }
  return c;
}

function gradient(stops: [string, string, string]) {
  const c = canvas(W, H), x = ctx2d(c);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, stops[0]); g.addColorStop(0.55, stops[1]); g.addColorStop(1, stops[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = rng(5);
  for (let i = 0; i < 40; i++) { x.fillStyle = r() < 0.3 ? '#ff9ae6' : '#c8c8ff'; x.globalAlpha = 0.3 + r() * 0.5; x.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.5), 1, 1); }
  x.globalAlpha = 1;
  return c;
}

/** Static scenery for one zone: walls, floors, furniture. Transparent where the sky shows. */
function paintZone(g: Game) {
  const z = g.zone;
  const c = canvas(z.w * TILE, z.h * TILE), x = ctx2d(c);
  const at = (tx: number, ty: number) => (tx < 0 || tx >= z.w || ty < 0 || ty >= z.h ? 0 : z.tiles[ty * z.w + tx]);
  const themeOf = (tx: number) => { let th = z.themes[0].theme; for (const t of z.themes) if (tx >= t.from) th = t.theme; return th; };
  const px = (col: string, X: number, Y: number, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  const r = rng(z.id * 99);
  for (let tx = 0; tx < z.w; tx++) {
    const th = themeOf(tx), X = tx * TILE, hh = hash(tx, z.id);
    // Back walls
    if (th === 'street') {
      // Shop fronts below a strip of sky.
      const fac = ['#1b1030', '#22123a', '#160d28', '#2a1236'][(Math.floor(tx / 6) + z.id) % 4];
      px(fac, X, 3 * TILE, TILE, 7 * TILE);
      if (tx % 6 === 0) px('#0e0818', X, 3 * TILE, 1, 7 * TILE);
      if (hh % 3 === 0) { px('#2b1d44', X + 3, 5 * TILE + 4, 10, 12); px(['#ffcf6f', '#ff7ad9', '#7ae8ff'][hh % 3], X + 4, 5 * TILE + 5, 8, 10); x.globalAlpha = 0.5; px('#1b1030', X + 4, 5 * TILE + 10, 8, 1); x.globalAlpha = 1; }
      if (hh % 7 === 1) { px('#2e1f4a', X + 2, 8 * TILE - 4, 12, 20); px('#120a20', X + 4, 8 * TILE - 2, 8, 18); }
    } else if (th === 'club') {
      px('#170a26', X, 0, TILE, FLOOR);
      px(tx % 4 === 0 ? '#22103a' : '#1c0c30', X, 0, TILE, FLOOR);
      px('#2c1248', X, 6 * TILE, TILE, 2);
    } else if (th === 'diner') {
      px('#f3e6c8', X, 0, TILE, 6 * TILE);
      px('#3fb7a3', X, 6 * TILE, TILE, 4 * TILE);
      px('#ff3355', X, 6 * TILE - 2, TILE, 2);
      if (tx % 5 === 1) { px('#1a1030', X, TILE + 6, TILE * 2, 3 * TILE); px('#3a2a6a', X + 1, TILE + 7, TILE * 2 - 2, 3 * TILE - 2); px('#ff7ad9', X + 4, 2 * TILE + 8, 2, 2); }
      for (let y = 0; y < 6 * TILE; y += 8) if ((y / 8 + tx) % 2) px('#ecdcb8', X, y, TILE, 1);
    } else if (th === 'alley') {
      for (let y = 0; y < FLOOR; y += 6) for (let bx = (y / 6) % 2 ? -8 : 0; bx < TILE; bx += 16) {
        const shade = (hash(tx * 3 + bx, y) % 3);
        px(['#3a1a22', '#331720', '#40202a'][shade], X + bx, y, 15, 5);
      }
      if (hh % 9 === 0) { px('#120a12', X + 2, 2 * TILE, 12, 16); px('#ffcf6f', X + 4, 2 * TILE + 2, 8, 12); px('#120a12', X + 7, 2 * TILE, 2, 16); }
      if (tx % 13 === 5) for (let y = 0; y < FLOOR; y += 3) px('#2a2a33', X + 6, y, 3, 2);
    } else if (th === 'penthouse') {
      px('#1c1030', X, 0, TILE, FLOOR);
      // Floor-to-ceiling windows: left transparent so the sky (and sunrise) shows through.
      if (tx >= 14 && tx <= 34 && tx % 5 !== 0) x.clearRect(X, TILE, TILE, 7 * TILE);
      if (tx % 5 === 0) px('#c9a227', X + 6, 0, 4, FLOOR);
      px('#c9a227', X, TILE - 2, TILE, 2); px('#c9a227', X, 8 * TILE, TILE, 2);
      if (tx < 13) { px('#2a1840', X, 0, TILE, FLOOR); if (tx === 5 || tx === 6) { px('#b8a070', X, 4 * TILE, TILE, 6 * TILE); px('#8a7550', X + (tx === 5 ? 15 : 0), 4 * TILE, 1, 6 * TILE); } }
    }
    // Floor
    for (let ty = FLOOR_ROW; ty < z.h; ty++) {
      if (at(tx, ty) !== Tile.Solid) continue;
      const Y = ty * TILE;
      if (th === 'street' || th === 'alley') {
        px(th === 'street' ? '#1a1530' : '#1d1a26', X, Y, TILE, TILE);
        if (ty === FLOOR_ROW) { px('#4a3a70', X, Y, TILE, 2); px('#2a2244', X, Y + 2, TILE, 1); if (th === 'street' && tx % 3 === 0) px('#5a4a2a', X + 4, Y + 10, 8, 1); }
        if (th === 'alley' && hh % 5 === 0) px('#14121c', X + 3, Y + 6, 6, 1);
      } else if (th === 'club') {
        px('#120818', X, Y, TILE, TILE);
        if (ty === FLOOR_ROW) { px('#ff4fd8', X, Y, TILE, 1); px('#2a1040', X, Y + 1, TILE, 2); }
      } else if (th === 'diner') {
        for (let a = 0; a < 2; a++) for (let b2 = 0; b2 < 2; b2++) px((a + b2 + tx + ty) % 2 ? '#f4f4f4' : '#141418', X + a * 8, Y + b2 * 8, 8, 8);
        if (ty === FLOOR_ROW) px('#c0c0c8', X, Y, TILE, 1);
      } else {
        px('#e8e0d0', X, Y, TILE, TILE); px('#d8ccb4', X + (hh % 12), Y + 3, 4, 1);
        if (ty === FLOOR_ROW) px('#c9a227', X, Y, TILE, 2);
      }
    }
    // Solid props above the floor
    for (let ty = 0; ty < FLOOR_ROW; ty++) {
      if (at(tx, ty) !== Tile.Solid) continue;
      const Y = ty * TILE;
      if (th === 'penthouse') { px('#2a1840', X, Y, TILE, TILE); px('#c9a227', X + 7, Y, 2, TILE); continue; }
      // Dumpster
      const left = at(tx - 1, ty) !== Tile.Solid, top = at(tx, ty - 1) !== Tile.Solid;
      px('#1f5a3a', X, Y, TILE, TILE); px('#174a2f', X, Y + 8, TILE, 1);
      if (top) { px('#2c7a50', X - (left ? 1 : 0), Y, TILE + 1, 3); px('#0e2a1c', X, Y + 3, TILE, 1); }
      if (left) px('#0e2a1c', X, Y, 1, TILE);
      if (top && left) { px('#b6ff3d', X + 3, Y + 7, 6, 1); px('#ff4fd8', X + 5, Y + 10, 8, 1); }
    }
    // One-way furniture
    for (let ty = 0; ty < FLOOR_ROW; ty++) {
      if (at(tx, ty) !== Tile.OneWay) continue;
      const Y = ty * TILE, l = at(tx - 1, ty) !== Tile.OneWay, rr = at(tx + 1, ty) !== Tile.OneWay;
      if (th === 'club') {
        const bar = tx >= 77 && tx <= 83;
        px(bar ? '#3a1d10' : '#0c0c12', X, Y, TILE, FLOOR - Y);
        px(bar ? '#c9a227' : '#3df2ff', X, Y, TILE, 2);
        if (!bar) { px('#22223a', X + 3, Y + 5, 10, 8); px('#3a3a5a', X + 6, Y + 8, 4, 4); }
        else for (let k = 0; k < 3; k++) px(['#3dff9a', '#ff4fd8', '#ffd23f'][(tx + k) % 3], X + 3 + k * 4, Y - 6, 2, 6);
      } else if (th === 'diner') {
        const counter = tx >= 10 && tx <= 19;
        px(counter ? '#ff3355' : '#c0c0c8', X, Y, TILE, 3);
        px(counter ? '#b31f3a' : '#8a8a96', X, Y + 3, TILE, 1);
        if (counter) { px('#e8e8f0', X, Y + 4, TILE, FLOOR - Y - 4); px('#d0d0dc', X, Y + 8, TILE, 1); }
        else { if (l || rr) px('#8a8a96', X + 7, Y + 4, 2, FLOOR - Y - 4); if (l) { px('#d81f3d', X - 10, Y - 6, 8, FLOOR - Y + 6); px('#ff4a66', X - 10, Y - 6, 8, 2); } if (rr) { px('#d81f3d', X + TILE + 2, Y - 6, 8, FLOOR - Y + 6); px('#ff4a66', X + TILE + 2, Y - 6, 8, 2); } }
      } else {
        px('#4a4a58', X, Y, TILE, 2); for (let k = 0; k < TILE; k += 3) px('#2a2a33', X + k, Y + 2, 1, 3);
        if (l) for (let y = Y; y < FLOOR; y += 4) px('#3a3a46', X + 1, y, 1, 2);
      }
    }
    void r;
  }
  // Diner pie case, jukebox; club DJ decks
  if (z.id === 2) { px('#e8e8f0', 84 * TILE, 7 * TILE, 30, 3 * TILE); for (let k = 0; k < 3; k++) { px('#ffcf6f', 84 * TILE + 3 + k * 9, 7 * TILE + 6, 7, 4); px('#b8632a', 84 * TILE + 3 + k * 9, 7 * TILE + 10, 7, 2); } }
  return c;
}

export class Renderer {
  c: CanvasRenderingContext2D;
  a = art();
  reduced = false;
  private zoneLayer?: HTMLCanvasElement;
  private layerFor = -1;
  private bg = new Map<string, HTMLCanvasElement>();

  constructor(public el: HTMLCanvasElement) { this.c = ctx2d(el); }

  private layer(key: string, make: () => HTMLCanvasElement) { let l = this.bg.get(key); if (!l) { l = make(); this.bg.set(key, l); } return l; }

  draw(g: Game, time: number) {
    const c = this.c;
    c.imageSmoothingEnabled = false;
    if (g.mode === 'title') { this.title(time); return; }
    const th = g.themeAt;
    let camX = g.cam.x, camY = g.cam.y;
    if (g.shake > 0 && !this.reduced) { camX += Math.round((Math.random() - 0.5) * g.shake * 2); camY += Math.round((Math.random() - 0.5) * g.shake * 2); }
    camX = Math.round(camX); camY = Math.round(camY);
    this.background(g, th, camX, time);
    if (this.layerFor !== g.zone.id || !this.zoneLayer || g.modeT === 0) { this.zoneLayer = paintZone(g); this.layerFor = g.zone.id; }
    c.drawImage(this.zoneLayer, camX, camY, W, H, 0, 0, W, H);
    c.save();
    c.translate(-camX, -camY);
    this.world(g, time, th);
    c.restore();
    if (th === 'street' || th === 'alley') this.rain(time, camX);
    if (g.chaos >= CHAOS.unhingedAt) { c.globalAlpha = this.reduced ? 0.08 : 0.06 + Math.sin(time * 3) * 0.04; c.fillStyle = '#ff2e88'; c.fillRect(0, 0, W, 3); c.fillRect(0, H - 3, W, 3); c.fillRect(0, 0, 3, H); c.fillRect(W - 3, 0, 3, H); c.globalAlpha = 1; }
    this.hud(g, time);
    this.captions(g);
    if (g.mode === 'intro') this.introCard(g);
    if (g.mode === 'zoneclear') this.clearCard(g, time);
    if (['paused', 'gameover', 'victory', 'choice'].includes(g.mode)) { c.fillStyle = g.mode === 'choice' ? 'rgba(10,4,20,0.35)' : 'rgba(10,4,20,0.6)'; c.fillRect(0, 0, W, H); }
  }

  private background(g: Game, th: Theme, camX: number, time: number) {
    const c = this.c;
    if (th === 'penthouse') {
      // Night → sunrise as Lorenzo loses.
      const k = g.boss ? 1 - g.boss.hp / 30 : 0;
      const night = this.layer('pn', () => gradient(['#06021a', '#1a0b3a', '#3a1450']));
      const dawn = this.layer('pd', () => gradient(['#2a2a7a', '#ff6fb5', '#ffcf6f']));
      c.drawImage(night, 0, 0); c.globalAlpha = k; c.drawImage(dawn, 0, 0); c.globalAlpha = 1;
      if (k > 0.2) { c.fillStyle = '#fff3b0'; c.globalAlpha = Math.min(1, k); c.beginPath(); c.arc(220, 175 - k * 60, 16, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
      const far = this.layer('psky', () => skyline(4, '#120826', ['#ff7ad9', '#7ae8ff', '#ffcf6f'], 100));
      c.drawImage(far, -((camX * 0.1) % 512), 30);
      return;
    }
    if (th === 'club' || th === 'diner') { c.fillStyle = '#0a0414'; c.fillRect(0, 0, W, H); return; }
    const sky = this.layer(th, () => gradient(th === 'street' ? ['#05021a', '#160a36', '#3a1450'] : ['#04020c', '#12081e', '#2a0c24']));
    c.drawImage(sky, 0, 0);
    const far = this.layer(`${th}f`, () => skyline(th === 'street' ? 11 : 23, th === 'street' ? '#140a2a' : '#100616', ['#ff7ad9', '#7ae8ff', '#ffcf6f', '#b6ff3d'], 110));
    for (let x = -((camX * 0.15) % 512); x < W; x += 512) c.drawImage(far, x, 8);
    void time;
  }

  private rain(time: number, camX: number) {
    const c = this.c;
    c.fillStyle = '#9ab0ff';
    c.globalAlpha = 0.35;
    const n = this.reduced ? 30 : 70;
    for (let i = 0; i < n; i++) {
      const x = (hash(i, 1) % 360 + camX * 0.1 - time * 40 + 1000 * 360) % 360 - 20;
      const y = (hash(i, 2) % 200 + time * 260) % 200 - 10;
      c.fillRect(Math.round(x), Math.round(y), 1, 5);
    }
    c.globalAlpha = 1;
  }

  private sign(text: string, x: number, y: number, color: string, size: number, on: boolean) {
    const c = this.c, img = textImage(text, color, false), w = img.width * size, h = img.height * size;
    if (!on) { c.globalAlpha = 0.25; c.drawImage(img, x, y, w, h); c.globalAlpha = 1; return; }
    c.globalAlpha = 0.25;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(img, x + dx, y + dy, w, h);
    c.globalAlpha = 1;
    c.drawImage(img, x, y, w, h);
  }

  private world(g: Game, time: number, th: Theme) {
    const c = this.c, a = this.a, z = g.zone;
    const px = (col: string, x: number, y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
    const camX = g.cam.x;

    // Club life: light beams, crowd, dance floor, disco ball.
    if (z.id === 1 && camX + W > 42 * TILE) {
      for (let i = 0; i < 4; i++) {
        const bx = (44 + i * 17) * TILE, ang = this.reduced ? 0 : Math.sin(time * 0.8 + i) * 40;
        c.globalAlpha = 0.08; c.fillStyle = ['#ff4fd8', '#3df2ff', '#b6ff3d', '#ffd23f'][i];
        c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx + ang - 30, FLOOR); c.lineTo(bx + ang + 30, FLOOR); c.closePath(); c.fill();
        c.globalAlpha = 1;
      }
      for (let tx = 46; tx <= 62; tx++) {
        const hue = ['#ff4fd8', '#3df2ff', '#8a3cff', '#ffd23f'][(tx + Math.floor(time * (this.reduced ? 0 : 1.2))) % 4];
        c.globalAlpha = 0.45; px(hue, tx * TILE + 1, FLOOR + 1, 14, 4); c.globalAlpha = 1;
      }
      for (let i = 0; i < 14; i++) {
        const cx = (44 + i * 4.5) * TILE + (hash(i, 7) % 20);
        if (cx < camX - 20 || cx > camX + W + 20) continue;
        const bob = this.reduced ? 0 : Math.abs(Math.sin(time * 4 + i)) * 3;
        c.globalAlpha = 0.55; px('#0e0518', cx, FLOOR - 26 + bob, 10, 26 - bob); px('#0e0518', cx + 2, FLOOR - 32 + bob, 6, 6);
        if (i % 3 === 0) px('#0e0518', cx + 9, FLOOR - 36 + bob, 2, 10);
        c.globalAlpha = 1;
      }
      const dbx = 56 * TILE, spin = Math.floor(time * 6);
      px('#888', dbx + 7, 0, 1, 18); px('#cfd6ff', dbx, 18, 15, 12);
      for (let k = 0; k < 6; k++) px((k + spin) % 3 ? '#ffffff' : '#8a8aff', dbx + 1 + ((k * 5 + spin) % 13), 19 + (k % 3) * 4, 2, 2);
    }

    // Signs, with reflections on wet ground outside.
    for (const e of z.ents) {
      if (e.type !== 'sign') continue;
      const x = e.x * TILE, y = e.y * TILE;
      if (x > camX + W + 40 || x + e.text.length * 12 < camX - 40) continue;
      const on = !e.flicker || this.reduced || Math.sin(time * 7 + e.x) > -0.85;
      this.sign(e.text, x, y, e.color, e.size ?? 1, on);
      const thx = e.x >= (z.themes[1]?.from ?? 999) ? z.themes[1].theme : z.themes[0].theme;
      if ((thx === 'street' || thx === 'alley') && on) {
        c.globalAlpha = 0.14;
        const w = e.text.length * 6 * (e.size ?? 1);
        for (let k = 0; k < 4; k++) px(e.color, x + (this.reduced ? 0 : Math.sin(time * 3 + k) * 2), FLOOR + 3 + k * 3, w, 1);
        c.globalAlpha = 1;
      }
    }

    // Puddles, steam vents, warning shadows
    for (const p of g.puddles) {
      c.globalAlpha = 0.5; px('#3a4a8a', p.x, FLOOR - 1, p.w, 3); c.globalAlpha = 0.6;
      px('#9ab0ff', p.x + 4 + (Math.floor(time * 3) % 6), FLOOR, 4, 1); c.globalAlpha = 1;
      if (g.zone.id === 2) { this.sign('WET', p.x + p.w / 2 - 8, FLOOR - 16, '#ffd23f', 1, true); }
    }
    for (const s of g.steam) {
      px('#2a2a33', s.x + 2, FLOOR - 2, 12, 2);
      const st = s.state(g.t);
      if (st === 'on') { c.globalAlpha = 0.65; for (let k = 0; k < 8; k++) px('#e8e8ff', s.x + 3 + (hash(k, Math.floor(time * 20)) % 9), FLOOR - 4 - k * 5, 4, 5); c.globalAlpha = 1; }
      else if (st === 'warn' && Math.floor(time * 10) % 2) px('#ffffff', s.x + 6, FLOOR - 5, 4, 3);
    }
    for (const d of g.drops) { c.globalAlpha = 0.5 + Math.sin(time * 20) * 0.2; px('#000', d.x - 6, FLOOR - 2, 12, 2); c.globalAlpha = 1; px('#ff3355', d.x - 1, FLOOR - 10, 2, 5); }

    // Exit
    if (g.exitX) {
      px('#2a1a40', g.exitX, FLOOR - 36, 22, 36); px('#3df2ff', g.exitX, FLOOR - 36, 22, 2);
      c.globalAlpha = 0.4 + Math.sin(time * 4) * 0.2; px('#3df2ff', g.exitX + 3, FLOOR - 33, 16, 33); c.globalAlpha = 1;
      this.sign('EXIT', g.exitX + 1, FLOOR - 46, '#3df2ff', 1, true);
    }

    // Encounter characters
    for (const s of g.slots) this.npc(g, s, time);

    // Pickups
    for (const p of g.pickups) {
      if (p.taken) continue;
      const it = this.a.items;
      const sp: Sprite = p.kind === 'cash' ? it.cash : p.kind === 'cash20' ? it.cash20 : p.kind === 'lipstick' ? it.lipstick : p.kind === 'skull' ? it.skull : p.kind === 'disco' ? it.disco : p.kind === 'courage' ? it.courage : it[p.kind];
      const bob = Math.round(Math.sin(p.t * 3) * 2);
      if (p.kind === 'disco' || p.kind === 'skull') { c.globalAlpha = 0.3 + Math.sin(time * 5) * 0.15; px(p.kind === 'disco' ? '#ffd23f' : '#ff4fd8', p.x - 3, p.y - 3 + bob, 16, 16); c.globalAlpha = 1; }
      c.drawImage(sp.img, Math.round(p.x - 1), Math.round(p.y + bob - 1));
    }

    // Foes
    for (const e of g.foes) {
      const flash = e.flash > 0 && Math.floor(time * 30) % 2 === 0;
      if (e.dying > 0 && Math.floor(time * 20) % 2) continue;
      if (e instanceof Guard) {
        const person = e.kind === 'cook' ? a.cook : a.guard;
        if (e.kind === 'guard' && e.alive && e.stun <= 0) {
          const b = e.beam();
          c.globalAlpha = e.state === 'patrol' ? 0.12 : 0.22; c.fillStyle = e.state === 'patrol' ? '#fff6b0' : '#ff3355';
          c.beginPath(); const ox = e.face > 0 ? e.x + e.w : e.x; c.moveTo(ox, e.y + 9); c.lineTo(e.face > 0 ? b.x + b.w : b.x, b.y); c.lineTo(e.face > 0 ? b.x + b.w : b.x, b.y + b.h); c.closePath(); c.fill(); c.globalAlpha = 1;
        }
        const sp = flash ? person.flash : e.stun > 0 ? person.hurt : Math.abs(e.vx) > 5 ? person.walk[Math.floor(e.t * (e.state === 'chase' ? 12 : 7)) % 4] : person.idle[0];
        this.blit(sp, e.x - 3, e.y - 2, e.face);
        if (e.state === 'alert' || e.state === 'chase') this.sign('!', e.x + 3, e.y - 12, '#ff3355', 1, true);
        if (e.kind === 'cook') px('#c0c0c8', e.face > 0 ? e.x + e.w : e.x - 4, e.y + 8, 4, 2);
      } else if (e instanceof Bouncer) {
        const sp = flash ? a.bouncer.flash : e.state === 'shove' ? a.bouncer.shove : a.bouncer.idle;
        const shake = e.state === 'windup' ? Math.round(Math.sin(time * 60)) : 0;
        this.blit(sp, e.x - 2 + shake, e.y - 1, e.face);
        if (e.state === 'windup') this.sign('!!', e.x + 6, e.y - 12, '#ff3355', 1, true);
      } else if (e instanceof Ex) {
        const sp = flash ? a.ex.flash : e.stun > 0 ? a.ex.hurt : Math.abs(e.vx) > 5 ? a.ex.walk[Math.floor(e.t * 10) % 4] : a.ex.idle[0];
        this.blit(sp, e.x - 3, e.y - 2, e.face);
        if (e.lineT > 0 && e.alive) this.bubble(e.line, e.x + 5, e.y - 6, '#22e0ff');
      } else if (e instanceof Rat) {
        this.blit(a.rat[Math.floor(e.t * 8) % 2], e.x - 1, e.y - 1, e.face);
      }
    }

    // Boss (before the fight: Lorenzo waits in his tub)
    if (g.boss) this.boss(g, time);
    else if (z.id === 4) this.tubIdle(time);

    // Viv
    this.viv(g, time);

    // Projectiles
    for (const s of g.shots) {
      const x = Math.round(s.x), y = Math.round(s.y);
      switch (s.kind) {
        case 'glass': c.drawImage(this.a.items.glass.img, x - 1, y - 2); break;
        case 'heel': { const f = Math.floor(s.t * 16) % 2; this.blit(this.a.items.heel, x - 2, y - 2 + f, f ? 1 : -1); break; }
        case 'phone': px('#111', x, y, 4, 6); px('#22e0ff', x + 1, y + 1, 2, 3); break;
        case 'cork': px('#e8d4a8', x, y, 4, 4); px('#8a6a3a', x, y, 4, 1); break;
        case 'plate': px('#ffffff', x, y, 8, 3); px('#c8c8d0', x + 1, y + 3, 6, 1); break;
        case 'bottle': px('#3dff9a', x + 1, y, 2, 3); px('#1f8a3a', x, y + 3, 4, 6); break;
        case 'wave': for (let k = 0; k < 16; k += 2) px(k % 4 ? '#7ae8ff' : '#ffffff', x + k, y + 10 - (4 + (hash(k, Math.floor(time * 15)) % 6)), 2, 4 + (hash(k, Math.floor(time * 15)) % 6)); break;
        case 'ticket': px('#ffffff', x, y, 7, 5); px('#ff3355', x + 1, y + 1, 5, 1); break;
        default: px('#ff6fb5', x, y, 3, 3);
      }
    }

    // Particles and popups
    for (const p of g.particles.pool) { if (!p.on) continue; c.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); px(p.color, p.x, p.y, p.size, p.size); }
    c.globalAlpha = 1;
    for (const p of g.popups) { c.globalAlpha = Math.min(1, p.t * 2.5); drawText(c, p.text, p.x, p.y, p.color, 'center'); c.globalAlpha = 1; }
  }

  private blit(s: Sprite, x: number, y: number, face: number) { this.c.drawImage(face >= 0 ? s.img : s.flip, Math.round(x), Math.round(y)); }

  private npc(g: Game, s: Game['slots'][number], time: number) {
    const c = this.c, a = this.a, who = s.enc.who, x = s.npcX;
    if (x < 0) return;
    const y = FLOOR - 24;
    const idle = (frames: Sprite[]) => frames[Math.floor(time * 1.5 + x) % 2];
    const px = (col: string, X: number, Y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(X), Math.round(Y), w, h); };
    switch (who) {
      case 'bouncer': if (!g.doorFoe) this.blit(a.bouncer.idle, x - 4, FLOOR - 27, -1); break;
      case 'dj': this.blit(idle(a.npc.dj), x - 3, 7 * TILE - 25 + (Math.floor(time * 4) % 2), -1); break;
      case 'stranger': this.blit(idle(a.npc.stranger), x - 3, y - 1, -1); break;
      case 'bride': this.blit(idle(a.npc.bride), x - 3, y - 1, -1); px('#ffd23f', x + 2, y - 3, 6, 2); px('#ff6fb5', x + 10, y - 6, 2, 16); break;
      case 'marge': this.blit(idle(a.npc.marge), x - 3, 8 * TILE - 25, -1); break;
      case 'mom': this.blit(idle(a.npc.mom), x - 3, y - 1, -1); break;
      case 'trench': this.blit(idle(a.npc.trench), x - 3, y - 1, -1); break;
      case 'raccoon': this.blit(a.raccoon, x, FLOOR - 9, -1); px('#ffcf6f', x - 12, FLOOR - 4, 10, 3); px('#ff3355', x - 10, FLOOR - 4, 2, 1); break;
      case 'machine':
        px('#3a1a5a', x - 2, FLOOR - 34, 20, 34); px('#ffd23f', x - 2, FLOOR - 34, 20, 2);
        px(Math.floor(time * 3) % 2 ? '#ff4fd8' : '#b05cff', x + 2, FLOOR - 28, 12, 10); px('#ffffff', x + 6, FLOOR - 25, 4, 4);
        break;
      case 'limo': {
        if (s.done && g.flags.has('limo')) break;
        const lx = x - 16;
        px('#24123a', lx, FLOOR - 18, 96, 14); px('#24123a', lx + 20, FLOOR - 26, 50, 9); px('#6a5a9a', lx + 24, FLOOR - 24, 42, 6); px('#c8c8e8', lx, FLOOR - 12, 96, 1); px('#120a20', lx + 46, FLOOR - 24, 2, 6);
        c.globalAlpha = 0.6; px('#ff4fd8', lx + 4, FLOOR - 3, 88, 3); c.globalAlpha = 1;
        px('#ffd23f', lx + 92, FLOOR - 14, 4, 3); px('#222', lx + 10, FLOOR - 6, 12, 6); px('#222', lx + 72, FLOOR - 6, 12, 6);
        break;
      }
      case 'elevator': this.blit(idle(a.npc.stranger), x - 3, y - 1, 1); px('#ff3355', x + 1, y - 2, 8, 3); break;
      default: break;
    }
    // Something to say: "!" over talkable people; a TALK prompt when close.
    if (!s.done && !s.enc.auto && who !== 'phone') {
      const bob = Math.round(Math.sin(time * 5) * 2);
      const top = who === 'dj' ? 7 * TILE - 34 : who === 'marge' ? 8 * TILE - 34 : who === 'raccoon' ? FLOOR - 22 : who === 'machine' ? FLOOR - 46 : y - 12;
      this.sign('!', x + 5, top + bob, '#ffd23f', 1, true);
      if (g.talkable() === s) {
        const label = 'TALK';
        const img = textImage(label, '#1a0f2e', false), bw = img.width + 6;
        px('#ffd23f', x + 8 - bw / 2, top - 14, bw, 10); c.drawImage(img, x + 11 - bw / 2, top - 12);
      }
    }
  }

  private viv(g: Game, time: number) {
    const v = g.viv, a = this.a.viv, c = this.c;
    if (g.mode === 'dying') {
      c.save(); c.translate(Math.round(v.cx), Math.round(v.y + v.h - 4)); c.rotate(-Math.PI / 2 * Math.min(1, g.modeT * 3)); c.drawImage(a.hurt.img, -8, -24); c.restore();
      return;
    }
    if (v.invuln > 0 && g.mode === 'play' && Math.floor(time * 14) % 2 === 0) return;
    let sp: Sprite;
    if (v.rolling) sp = a.roll[Math.floor(v.dodgeT * 20) % 2];
    else if (v.hurtT > 0) sp = a.hurt;
    else if (v.swinging) sp = a.attack[v.attackT < 0.08 ? 0 : 1];
    else if (!v.onGround) sp = v.vy < 0 ? a.jump : a.fall;
    else if (Math.abs(v.vx) > 10) sp = a.walk[Math.floor(v.anim * (Math.abs(v.vx) > 100 ? 13 : 9)) % 4];
    else sp = a.idle[Math.floor(time * 1.6) % 2];
    const x = v.x - 4, y = v.y + v.h - sp.h + 1;
    if (v.spotlight > 0) { c.globalAlpha = 0.18; c.fillStyle = '#fff6b0'; c.beginPath(); c.moveTo(v.cx - 6, 0); c.lineTo(v.cx - 22, FLOOR); c.lineTo(v.cx + 22, FLOOR); c.lineTo(v.cx + 6, 0); c.closePath(); c.fill(); c.globalAlpha = 1; }
    if (v.courage > 0) { c.globalAlpha = 0.35 + Math.sin(time * 12) * 0.15; this.blit(this.a.items.courage, x + 1, y - 10, 1); c.globalAlpha = 1; }
    this.blit(sp, x, y, v.face);
    if (v.item?.kind === 'cone' && !v.rolling) this.blit(this.a.items.cone, v.face > 0 ? x + 12 : x - 6, y + 8, v.face);
    if (v.courage > 0) { c.globalAlpha = 0.25; c.fillStyle = '#b6ff3d'; c.fillRect(Math.round(x), Math.round(y), sp.w, sp.h); c.globalAlpha = 1; }
  }

  private boss(g: Game, time: number) {
    const b = g.boss!, c = this.c, a = this.a.boss;
    const px = (col: string, X: number, Y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(X), Math.round(Y), w, h); };
    // Disco beams: floor markers first, then light.
    for (const beam of b.beams) {
      if (beam.warn > 0) { if (Math.floor(time * 10) % 2) { px('#ffd23f', beam.x - 5, FLOOR - 3, 10, 3); px('#ffd23f', beam.x - 1, FLOOR - 8, 2, 4); } }
      else { c.globalAlpha = 0.55; px('#ffffff', beam.x - 5, 0, 10, FLOOR); c.globalAlpha = 0.3; px('#ff4fd8', beam.x - 9, 0, 18, FLOOR); c.globalAlpha = 1; }
    }
    if (b.state === 'disco' || b.beams.length) { const dx = (b.left + b.right) / 2; px('#888', dx, 0, 1, 26); px('#d8e0ff', dx - 8, 26, 17, 13); for (let k = 0; k < 6; k++) px((k + Math.floor(time * 8)) % 2 ? '#fff' : '#8af', dx - 7 + k * 3, 28 + (k % 3) * 3, 2, 2); }
    // Hot tub (behind the rim)
    const tx = b.tubX;
    px('#c9a227', tx - 2, FLOOR - 20, 84, 4);
    px('#3df2ff', tx, FLOOR - 16, 80, 6);
    for (let k = 0; k < 10; k++) { const bx = tx + (hash(k, 3) % 76), by = FLOOR - 18 - ((time * 18 + hash(k, 9) % 12) % 12); c.globalAlpha = 0.7; px('#ffffff', bx, by, 2, 2); c.globalAlpha = 1; }
    if (b.state === 'gone') return;
    let sp = b.flash > 0 && Math.floor(time * 30) % 2 === 0 ? a.flash : b.robeFell ? a.robe2 : b.state === 'corkPose' || b.state === 'lungePose' || b.state === 'monologue' ? a.pose : a.idle;
    if (b.state === 'stunned') sp = a.pose;
    const x = b.x - 2, y = b.y - 1;
    if (b.inTub) {
      c.save(); c.beginPath(); c.rect(x - 4, y - 4, 40, Math.max(0, FLOOR - 16 - y + 4)); c.clip(); this.blit(sp, x, y, b.face); c.restore();
    } else this.blit(sp, x, y + (b.state === 'strut' ? Math.floor(time * 8) % 2 : 0), b.face);
    if (b.state === 'lungePose' && Math.floor(time * 16) % 2) px('#ffffff', b.cx + b.face * 8, b.y + 4, 3, 3);
    if (b.state === 'corkPose') { px('#1f8a3a', b.cx + b.face * 10, b.y + 6, 4, 10); px('#ffd23f', b.cx + b.face * 10, b.y + 4, 4, 2); }
    if (b.state === 'stunned') this.sign('?!', b.cx - 5, b.y - 12, '#ffd23f', 1, true);
    if (b.state === 'defeat' && b.flyT > 0) {
      // Inflatable flamingo
      px('#ff6fb5', b.x - 4, b.y + 22, 30, 8); px('#ff6fb5', b.x + 22, b.y + 6, 4, 18); px('#ff6fb5', b.x + 22, b.y + 2, 8, 6); px('#1a0f2e', b.x + 28, b.y + 4, 3, 2);
    }
    if (b.robeFell && b.state === 'defeat' && b.flyT === 0) this.bubble('Underneath: a smaller robe.', b.cx, b.y - 4, '#ffd23f');
    if (g.bossLine.t > 0) this.bubble(g.bossLine.text, b.cx, b.y - 6, '#ff9ae6');
  }

  private tubIdle(time: number) {
    const c = this.c, tx = 27 * TILE, a = this.a.boss;
    const px = (col: string, X: number, Y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(X), Math.round(Y), w, h); };
    c.save(); c.beginPath(); c.rect(tx, FLOOR - 60, 80, 44); c.clip(); this.blit(a.idle, tx + 30, FLOOR - 40 + Math.round(Math.sin(time * 2)), -1); c.restore();
    px('#c9a227', tx - 2, FLOOR - 20, 84, 4); px('#3df2ff', tx, FLOOR - 16, 80, 6);
    for (let k = 0; k < 10; k++) { c.globalAlpha = 0.7; px('#ffffff', tx + (hash(k, 3) % 76), FLOOR - 18 - ((time * 18 + hash(k, 9) % 12) % 12), 2, 2); c.globalAlpha = 1; }
  }

  private bubble(text: string, cx: number, bottom: number, color: string) {
    const c = this.c, lines = wrap(text, 26), w = Math.max(...lines.map((l) => l.length)) * 6 + 6, h = lines.length * 9 + 4;
    const x = Math.round(Math.max(this.leftEdge + 2, Math.min(cx - w / 2, this.leftEdge + W - w - 2))), y = Math.round(bottom - h - 4);
    c.fillStyle = 'rgba(10,4,20,0.88)'; c.fillRect(x, y, w, h);
    c.fillStyle = color; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1);
    lines.forEach((l, i) => drawText(c, l, x + 3, y + 3 + i * 9, color));
  }
  private get leftEdge() { return -(this.c.getTransform().e); }

  private hud(g: Game, time: number) {
    const c = this.c, v = g.viv;
    c.fillStyle = 'rgba(10,4,20,0.78)'; c.fillRect(0, 0, W, 13);
    c.fillStyle = '#ff2e88'; c.globalAlpha = 0.6; c.fillRect(0, 13, W, 1); c.globalAlpha = 1;
    for (let i = 0; i < 5; i++) this.heart(4 + i * 8, 3, i < v.dignity);
    drawText(c, `$${g.cash}`, 46, 3, '#3ddc72');
    drawText(c, 'CHAOS', 80, 3, '#ff9ae6');
    const bx = 112, bw = 46;
    c.fillStyle = '#2a1040'; c.fillRect(bx, 4, bw, 6);
    const fill = Math.round((g.chaos / 100) * bw);
    c.fillStyle = g.chaos >= CHAOS.brutalAt ? '#ff3355' : g.chaos >= CHAOS.unhingedAt ? '#ff2e88' : '#b05cff'; c.fillRect(bx, 4, fill, 6);
    c.fillStyle = '#ffffff'; for (const m of [CHAOS.hazardsAt, CHAOS.unhingedAt, CHAOS.brutalAt]) c.fillRect(bx + Math.round((m / 100) * bw), 3, 1, 8);
    drawText(c, `x${g.multiplier.toFixed(1)}`, 162, 3, '#ffd23f');
    drawText(c, fmtClock(g.clock), 190, 3, '#3df2ff');
    drawText(c, String(g.score).padStart(7, '0'), W - 4, 3, '#ffffff', 'right');
    // Second line: item, buffs, warnings (on dark tags so signs behind don't clash)
    const tag = (text: string, tx: number, color: string, align: 'left' | 'center' | 'right' = 'left') => {
      const w = text.length * 6 + 5, x0 = align === 'left' ? tx - 2 : align === 'center' ? tx - w / 2 : tx - w + 2;
      c.fillStyle = 'rgba(10,4,20,0.85)'; c.fillRect(Math.round(x0), 15, w, 11);
      drawText(c, text, tx, 17, color, align);
    };
    let x = 4;
    if (v.item) {
      const it = this.a.items[v.item.kind];
      c.fillStyle = 'rgba(10,4,20,0.85)'; c.fillRect(2, 14, 40, 14);
      c.drawImage(it.img, x, 15, Math.min(12, it.w), Math.min(12, it.h));
      drawText(c, v.item.kind === 'heel' ? `${Math.ceil(v.item.timer)}S` : `x${v.item.uses}`, x + 14, 17, '#3df2ff');
      x += 44;
    }
    if (v.courage > 0) { tag(`COURAGE ${Math.ceil(v.courage)}`, x, '#b6ff3d'); x += 72; }
    if (v.speed > 0) { tag(`ZOOM ${Math.ceil(v.speed)}`, x, '#7ae8ff'); x += 54; }
    if (g.chaos >= CHAOS.brutalAt && Math.floor(time * 2) % 2) tag('HITS COST DOUBLE', W - 4, '#ff3355', 'right');
    if (g.lock) { const left = g.brawls.find((b) => b.state === 'on')!.foes.filter((e) => e.alive).length; tag(`BRAWL · ${left} LEFT`, W / 2, '#ff3355', 'center'); }
    if (g.goT > 0 && Math.floor(time * 4) % 2) drawText(c, 'GO >', W - 8, 80, '#3df2ff', 'right', 2);
    // Boss bar
    if (g.boss && g.boss.state !== 'gone') {
      const b = g.boss, w = 120, bx2 = (W - w) / 2;
      drawText(c, 'LORENZO VELOUR', W / 2, 160, '#ff9ae6', 'center');
      c.fillStyle = '#2a1040'; c.fillRect(bx2, 169, w, 5);
      c.fillStyle = '#ff2e88'; c.fillRect(bx2, 169, Math.round((b.hp / 30) * w), 5);
      c.fillStyle = '#ffffff'; c.fillRect(bx2 + w * 0.33, 168, 1, 7); c.fillRect(bx2 + w * 0.66, 168, 1, 7);
    }
  }

  private heart(x: number, y: number, full: boolean) {
    const c = this.c;
    const rows = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
    c.fillStyle = full ? '#ff2e88' : '#4a2a5a';
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'x') c.fillRect(x + i, y + j, 1, 1); });
    if (full) { c.fillStyle = '#ffd0ea'; c.fillRect(x + 1, y + 1, 1, 1); }
  }

  private captions(g: Game) {
    if (g.caption.t <= 0 || g.mode === 'title') return;
    const c = this.c, lines = wrap(g.caption.text, 50).slice(0, 4);
    const h = lines.length * 9 + 6, y = H - h - 2 - (g.boss ? 26 : 0);
    c.globalAlpha = Math.min(1, g.caption.t * 2);
    c.fillStyle = 'rgba(10,4,20,0.88)'; c.fillRect(6, y, W - 12, h);
    c.fillStyle = '#ff2e88'; c.fillRect(6, y, 2, h);
    lines.forEach((l, i) => drawText(c, l, 12, y + 4 + i * 9, '#f4e8ff'));
    c.globalAlpha = 1;
  }

  private introCard(g: Game) {
    const c = this.c, k = Math.min(1, g.modeT * 3), h = Math.round(64 * k);
    c.fillStyle = 'rgba(10,4,20,0.9)'; c.fillRect(0, 90 - h / 2, W, h);
    c.fillStyle = '#ff2e88'; c.fillRect(0, 90 - h / 2, W, 1); c.fillRect(0, 90 + h / 2 - 1, W, 1);
    if (k < 1) return;
    drawText(c, fmtClock(g.zone.clock[0]), W / 2, 64, '#3df2ff', 'center');
    drawText(c, g.zone.name, W / 2, 76, '#ff4fd8', 'center', 2);
    const sub = g.zone.id === 1 ? '$40. A dying phone. Terrible judgment.' : g.zone.id === 2 ? 'Coffee. Pie. Regret.' : g.zone.id === 3 ? 'A shortcut. What could go wrong?' : 'Sunrise is coming. So is he.';
    drawText(c, sub, W / 2, 98, '#f4e8ff', 'center');
  }

  private clearCard(g: Game, time: number) {
    const c = this.c;
    c.fillStyle = 'rgba(10,4,20,0.85)'; c.fillRect(30, 50, W - 60, 74);
    c.fillStyle = '#3df2ff'; c.fillRect(30, 50, W - 60, 1); c.fillRect(30, 123, W - 60, 1);
    drawText(c, 'SURVIVED', W / 2, 58, '#3df2ff', 'center', 2);
    drawText(c, g.zone.name, W / 2, 78, '#ff4fd8', 'center');
    drawText(c, `${fmtClock(g.zone.clock[1])}  ·  SCORE ${g.score}`, W / 2, 92, '#f4e8ff', 'center');
    if (Math.floor(time * 2) % 2) drawText(c, 'PRESS JUMP TO CONTINUE', W / 2, 108, '#ffd23f', 'center');
  }

  private title(time: number) {
    const c = this.c;
    const sky = this.layer('street', () => gradient(['#05021a', '#160a36', '#3a1450']));
    c.drawImage(sky, 0, 0);
    const far = this.layer('streetf', () => skyline(11, '#140a2a', ['#ff7ad9', '#7ae8ff', '#ffcf6f', '#b6ff3d'], 110));
    c.drawImage(far, -((time * 6) % 512), 8); c.drawImage(far, 512 - ((time * 6) % 512), 8);
    c.fillStyle = '#1a1530'; c.fillRect(0, 150, W, 30); c.fillStyle = '#4a3a70'; c.fillRect(0, 150, W, 2);
    // Wet street reflections
    c.globalAlpha = 0.18; c.fillStyle = '#ff4fd8'; for (let k = 0; k < 5; k++) c.fillRect(70 + Math.sin(time * 2 + k) * 3, 155 + k * 4, 180, 1); c.globalAlpha = 1;
    // Logo: AFTER HOURS in neon, flickering a little.
    const on = this.reduced || Math.sin(time * 9) > -0.9;
    this.sign('AFTER', 160 - 5 * 6 * 4 / 2 + 2, 16, '#ff4fd8', 4, on);
    this.sign('HOURS', 160 - 5 * 6 * 4 / 2 + 2, 48, '#3df2ff', 4, true);
    drawText(this.c, 'BAD DECISIONS', W / 2, 84, '#ffd23f', 'center', 2);
    drawText(this.c, 'ONE NIGHT. ZERO SELF-CONTROL. ENDLESS CONSEQUENCES.', W / 2, 104, '#f4e8ff', 'center');
    const v = this.a.viv;
    this.blit(v.walk[Math.floor(time * 9) % 4], 60 + Math.floor((time * 30) % 220), 126, 1);
    this.rain(time, time * 20);
  }
}

/** Word wrap for the 6px font. */
export function wrap(text: string, max: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}
