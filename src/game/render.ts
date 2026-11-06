// Draws PATCH QUEST at 320×180. Backgrounds and each level's tiles are
// painted once into offscreen canvases; each frame blits the visible parts
// and draws the moving things on top. All coordinates are whole pixels.
import { W, H, TILE, PULSE } from './config';
import { Tile, type Theme } from './levels';
import { canvas, ctx2d, drawText, textImage, type Sprite } from './pixels';
import { sprites } from './sprites';
import { fmtTime, type Game } from './game';

interface ThemeDef {
  sky: [string, string, string];
  far: string; mid: string; near: string;
  accent: string; accent2: string;
  tile: { base: string; top: string; topDark: string; trace: string; dark: string; via: string };
}

export const THEMES: Record<Theme, ThemeDef> = {
  boot: { sky: ['#050920', '#0c1a45', '#15326e'], far: '#0e2050', mid: '#15336c', near: '#1d4a94', accent: '#47f3ff', accent2: '#ffe066',
    tile: { base: '#16305e', top: '#47f3ff', topDark: '#1b8fb3', trace: '#24508f', dark: '#0a1836', via: '#7cf7ff' } },
  city: { sky: ['#0b0316', '#230a3b', '#4a1462'], far: '#1c0a33', mid: '#2c1050', near: '#43196e', accent: '#ff3df2', accent2: '#ffe066',
    tile: { base: '#2b1550', top: '#ff3df2', topDark: '#a3249c', trace: '#47297a', dark: '#14082a', via: '#ffe066' } },
  core: { sky: ['#120202', '#350909', '#5c170f'], far: '#260707', mid: '#3d0f0b', near: '#58190f', accent: '#ff8c2e', accent2: '#ff4d6d',
    tile: { base: '#3b1313', top: '#ff8c2e', topDark: '#b34a12', trace: '#5c2317', dark: '#1d0707', via: '#ffe066' } },
};

/** Small seeded random numbers, so the art is the same every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return h ^ (h >>> 16);
};

/** Silhouette of a sprite in one colour (for the glitch colour split and hit flashes). */
function silhouette(s: Sprite, color: string) {
  const c = canvas(s.w, s.h);
  const x = ctx2d(c);
  x.drawImage(s.img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, s.w, s.h);
  return c;
}

interface Layers { sky: HTMLCanvasElement; far: HTMLCanvasElement; mid: HTMLCanvasElement }

function paintSky(t: ThemeDef, seed: number) {
  const c = canvas(W, H);
  const x = ctx2d(c);
  // Three bands with ordered dithering between them, for a 16-bit gradient.
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const rgb = t.sky.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const f = y / (H - 1) * 2;
    const band = Math.min(1, Math.floor(f));
    const k = f - band;
    for (let i = 0; i < W; i++) {
      const col = rgb[k > bayer[(y % 4) * 4 + (i % 4)] / 16 ? band + 1 : band];
      const o = (y * W + i) * 4;
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    x.fillStyle = r() < 0.2 ? t.accent : r() < 0.5 ? '#eef3fb' : '#7d8db0';
    x.globalAlpha = 0.35 + r() * 0.5;
    x.fillRect(Math.floor(r() * W), Math.floor(r() * H * 0.7), 1, 1);
  }
  x.globalAlpha = 1;
  return c;
}

function paintFar(theme: Theme, t: ThemeDef) {
  const w = 384;
  const c = canvas(w, H);
  const x = ctx2d(c);
  const r = rng(11);
  x.fillStyle = t.far;
  if (theme === 'boot') {
    // Server towers with blinking-light rows.
    for (let i = 0; i < w; i += 22 + Math.floor(r() * 18)) {
      const tw = 10 + Math.floor(r() * 10), th = 50 + Math.floor(r() * 70);
      x.fillStyle = t.far; x.fillRect(i, H - th, tw, th);
      for (let y = H - th + 4; y < H - 4; y += 5) { x.fillStyle = r() < 0.25 ? t.accent : '#1a3366'; x.fillRect(i + 2, y, 1, 1); x.fillRect(i + tw - 3, y, 1, 1); }
    }
  } else if (theme === 'city') {
    for (let i = 0; i < w; i += 14 + Math.floor(r() * 16)) {
      const tw = 14 + Math.floor(r() * 20), th = 40 + Math.floor(r() * 90);
      x.fillStyle = t.far; x.fillRect(i, H - th, tw, th);
      if (r() < 0.4) x.fillRect(i + Math.floor(tw / 2), H - th - 10, 1, 10);
      for (let y = H - th + 4; y < H - 2; y += 4) for (let k = i + 2; k < i + tw - 2; k += 3) if (r() < 0.3) { x.fillStyle = r() < 0.5 ? '#5a2a7a' : '#7a4a20'; x.fillRect(k, y, 1, 1); }
    }
  } else {
    // A huge dim ring: the core, far away.
    x.strokeStyle = t.far; x.lineWidth = 1;
    for (let rr = 40; rr < 120; rr += 12) { x.beginPath(); x.arc(w / 2, H * 0.55, rr, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = t.far;
    for (let i = 0; i < w; i += 30) x.fillRect(i, 0, 4, H);
  }
  return c;
}

function paintMid(theme: Theme, t: ThemeDef) {
  const w = 512;
  const c = canvas(w, H);
  const x = ctx2d(c);
  const r = rng(27);
  if (theme === 'boot') {
    // Circuit-board traces and chips.
    x.fillStyle = t.mid;
    for (let k = 0; k < 14; k++) {
      let px = Math.floor(r() * w), py = 70 + Math.floor(r() * 100);
      for (let s = 0; s < 6; s++) {
        const len = 10 + Math.floor(r() * 40);
        if (s % 2 === 0) { x.fillRect(Math.min(px, px + len), py, len, 1); px += len; } else { const d = (r() < 0.5 ? -1 : 1) * Math.floor(len / 2); x.fillRect(px, Math.min(py, py + d), 1, Math.abs(d)); py += d; }
      }
      x.fillStyle = t.near; x.fillRect(px - 1, py - 1, 3, 3); x.fillStyle = t.mid;
    }
    for (let k = 0; k < 6; k++) {
      const cx = Math.floor(r() * (w - 30)), cy = 100 + Math.floor(r() * 60), cw = 14 + Math.floor(r() * 14);
      x.fillStyle = t.near; x.fillRect(cx, cy, cw, 10);
      x.fillStyle = t.mid; for (let p = cx + 2; p < cx + cw - 1; p += 3) { x.fillRect(p, cy - 2, 1, 2); x.fillRect(p, cy + 10, 1, 2); }
    }
  } else if (theme === 'city') {
    for (let i = 0; i < w; i += 20 + Math.floor(r() * 24)) {
      const tw = 18 + Math.floor(r() * 26), th = 50 + Math.floor(r() * 70);
      x.fillStyle = t.mid; x.fillRect(i, H - th, tw, th);
      x.fillStyle = t.near; x.fillRect(i, H - th, tw, 2);
      for (let y = H - th + 5; y < H - 3; y += 5) for (let k = i + 3; k < i + tw - 3; k += 4) if (r() < 0.45) { x.fillStyle = r() < 0.15 ? t.accent : r() < 0.5 ? '#ffe066' : '#6a3a9a'; x.fillRect(k, y, 2, 2); }
      if (r() < 0.3) { x.fillStyle = t.accent; x.fillRect(i + 3, H - th + 8, tw - 6, 1); }
    }
  } else {
    // Pipes and pressure vessels.
    for (let k = 0; k < 7; k++) {
      const py = 60 + Math.floor(r() * 110);
      x.fillStyle = t.mid; x.fillRect(0, py, w, 4);
      x.fillStyle = t.near; x.fillRect(0, py, w, 1);
      for (let j = Math.floor(r() * 60); j < w; j += 60 + Math.floor(r() * 40)) { x.fillStyle = t.near; x.fillRect(j, py - 2, 4, 8); x.fillStyle = '#7a2a10'; x.fillRect(j + 1, py + 1, 2, 2); }
    }
    for (let k = 0; k < 5; k++) {
      const vx = Math.floor(r() * (w - 30)), vh = 40 + Math.floor(r() * 50);
      x.fillStyle = t.mid; x.fillRect(vx, H - vh, 24, vh);
      x.fillStyle = t.near; x.fillRect(vx + 2, H - vh + 2, 20, 1);
    }
  }
  return c;
}

function paintTiles(lv: Game['level'], t: ThemeDef) {
  const c = canvas(lv.w * TILE, lv.h * TILE);
  const x = ctx2d(c);
  const at = (tx: number, ty: number) => (tx < 0 || tx >= lv.w || ty < 0 ? (ty < 0 ? 0 : 1) : ty >= lv.h ? 1 : lv.tiles[ty * lv.w + tx]);
  const px = (col: string, X: number, Y: number, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.w; tx++) {
      const tt = at(tx, ty), X = tx * TILE, Y = ty * TILE, hh = hash(tx, ty);
      if (tt === Tile.Solid) {
        px(t.tile.base, X, Y, TILE, TILE);
        // Circuit detail, varied per tile.
        const v = hh % 6;
        if (v === 0) { px(t.tile.trace, X + 2, Y + 7, 12, 1); px(t.tile.via, X + 13, Y + 6, 2, 2); }
        else if (v === 1) { px(t.tile.trace, X + 7, Y + 2, 1, 12); px(t.tile.trace, X + 7, Y + 9, 6, 1); px(t.tile.via, X + 12, Y + 8, 2, 2); }
        else if (v === 2) { px(t.tile.trace, X + 4, Y + 4, 8, 8); px(t.tile.base, X + 5, Y + 5, 6, 6); px(t.tile.dark, X + 6, Y + 6, 4, 4); }
        else if (v === 3) { px(t.tile.dark, X + 3, Y + 3, 1, 1); px(t.tile.dark, X + 12, Y + 12, 1, 1); px(t.tile.trace, X + 2, Y + 12, 6, 1); }
        else if (v === 4) { for (let i = 2; i < 14; i += 4) px(t.tile.trace, X + i, Y + 10, 2, 1); }
        // Bevel
        px(t.tile.dark, X, Y + 15, 16, 1); px(t.tile.dark, X + 15, Y, 1, 16);
        const open = (dx: number, dy: number) => at(tx + dx, ty + dy) !== Tile.Solid;
        if (open(0, -1)) {
          px(t.tile.top, X, Y, 16, 2); px(t.tile.topDark, X, Y + 2, 16, 1);
          for (let i = 0; i < 16; i += 1) if ((hh >> i) & 1 && i % 3 === 0) px(t.tile.topDark, X + i, Y + 3, 1, 1 + ((hh >> (i + 3)) & 1));
          if (open(-1, 0)) x.clearRect(X, Y, 1, 1);
          if (open(1, 0)) x.clearRect(X + 15, Y, 1, 1);
        }
        if (open(-1, 0)) px(t.tile.dark, X, Y + (open(0, -1) ? 1 : 0), 1, 16);
        if (open(1, 0)) px(t.tile.dark, X + 15, Y, 1, 16);
        if (open(0, 1) && ty < lv.h - 1) px('#05060d', X, Y + 15, 16, 1);
      } else if (tt === Tile.OneWay) {
        px(t.tile.dark, X, Y + 1, 16, 6);
        px(t.tile.top, X, Y, 16, 1);
        px(t.tile.base, X, Y + 1, 16, 4);
        px(t.tile.trace, X + 1, Y + 3, 14, 1);
        px(t.tile.dark, X + 3, Y + 2, 1, 1); px(t.tile.dark, X + 12, Y + 2, 1, 1);
        if (at(tx - 1, ty) !== Tile.OneWay) px(t.tile.topDark, X, Y, 1, 6);
        if (at(tx + 1, ty) !== Tile.OneWay) px(t.tile.topDark, X + 15, Y, 1, 6);
        if (hh % 3 === 0) { px(t.tile.dark, X + 7, Y + 7, 2, 3); }
      } else if (tt === Tile.Spike) {
        for (let s = 0; s < 4; s++) {
          const sx = X + s * 4;
          for (let r = 0; r < 7; r++) {
            const half = Math.floor(r / 3);
            px(r < 2 ? '#eef3fb' : r < 4 ? '#ff4d6d' : '#8a1630', sx + 2 - half, Y + 9 + r, half * 2 + 1, 1);
          }
        }
        px('#5a0f1e', X, Y + 15, 16, 1);
      }
    }
  }
  return c;
}

export class Renderer {
  c: CanvasRenderingContext2D;
  spr = sprites();
  layers = new Map<Theme, Layers>();
  tiles?: HTMLCanvasElement;
  tilesFor?: Game['level'];
  reduced = false;
  sil: { glitchM: HTMLCanvasElement[]; glitchC: HTMLCanvasElement[]; patchW: Map<Sprite, HTMLCanvasElement> };
  logo: HTMLCanvasElement;

  constructor(public el: HTMLCanvasElement) {
    this.c = ctx2d(el);
    this.sil = {
      glitchM: this.spr.glitch.map((s) => silhouette(s, '#ff3df2')),
      glitchC: this.spr.glitch.map((s) => silhouette(s, '#47f3ff')),
      patchW: new Map(),
    };
    this.logo = this.paintLogo();
  }

  private theme(th: Theme) {
    let l = this.layers.get(th);
    if (!l) {
      const t = THEMES[th];
      l = { sky: paintSky(t, th.length * 7), far: paintFar(th, t), mid: paintMid(th, t) };
      this.layers.set(th, l);
    }
    return l;
  }

  private paintLogo() {
    // PATCH (×4) over QUEST (×3), outlined, with a two-tone fill.
    const lc = canvas(150, 56);
    const x = ctx2d(lc);
    const word = (s: string, scale: number, y: number, fill: string, shade: string) => {
      const w = (s.length * 6 - 1) * scale, ox = Math.round((150 - w) / 2);
      const ink = textImage(s, '#05060d', false);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [2, 2], [1, 2], [2, 1]]) x.drawImage(ink, ox + dx * 1, y + dy * 1, ink.width * scale, ink.height * scale);
      x.drawImage(textImage(s, fill, false), ox, y, ink.width * scale, ink.height * scale);
      // Lower half in the shade colour, for a metallic split.
      x.save(); x.beginPath(); x.rect(0, y + Math.round(3.6 * scale), 150, 10 * scale); x.clip();
      x.drawImage(textImage(s, shade, false), ox, y, ink.width * scale, ink.height * scale); x.restore();
    };
    word('PATCH', 4, 2, '#7cf7ff', '#1fb7d6');
    word('QUEST', 3, 34, '#ffb35c', '#ff7a1a');
    return lc;
  }

  draw(g: Game, time: number) {
    const c = this.c;
    const lv = g.level;
    const th = g.mode === 'title' ? 'boot' : lv.theme;
    const T = THEMES[th];
    const L = this.theme(th);
    c.imageSmoothingEnabled = false;

    let camX = g.mode === 'title' ? time * 24 : g.cam.x;
    let camY = g.mode === 'title' ? 0 : g.cam.y;
    if (g.shake > 0 && !this.reduced) { camX += Math.round((Math.random() - 0.5) * g.shake * 2); camY += Math.round((Math.random() - 0.5) * g.shake * 2); }
    camX = Math.round(camX); camY = Math.round(camY);

    // Backgrounds
    c.drawImage(L.sky, 0, 0);
    const tileLayer = (img: HTMLCanvasElement, f: number, yOff: number) => {
      const w = img.width;
      let ox = -Math.floor((camX * f) % w);
      if (ox > 0) ox -= w;
      for (let x = ox; x < W; x += w) c.drawImage(img, x, yOff);
    };
    const vy = g.mode === 'title' ? 0 : Math.round(-(camY - (lv.h * TILE - H)) * 0.15);
    tileLayer(L.far, 0.12, vy + 6);
    tileLayer(L.mid, 0.32, Math.round(vy * 1.6) + 14);
    // A veil keeps the parallax layers clearly behind the playfield.
    c.globalAlpha = 0.38; c.fillStyle = T.sky[0]; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    this.drift(T, time, camX);

    if (g.mode === 'title') { this.title(time, T); return; }

    // Tiles
    if (this.tilesFor !== lv) { this.tiles = paintTiles(lv, T); this.tilesFor = lv; }
    c.drawImage(this.tiles!, camX, camY, W, H, 0, 0, W, H);

    c.save();
    c.translate(-camX, -camY);
    this.world(g, time, T);
    c.restore();

    if (g.flash > 0) { c.fillStyle = '#ffffff'; c.globalAlpha = Math.min(1, g.flash) * (this.reduced ? 0.25 : 0.7); c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    this.hud(g, time, T);
    if (g.mode === 'intro') this.introCard(g, T);
    if (g.mode === 'paused' || g.mode === 'gameover' || g.mode === 'victory' || g.mode === 'clear') { c.fillStyle = 'rgba(5,6,13,0.55)'; c.fillRect(0, 0, W, H); }
  }

  /** Data bits drifting up through the background. */
  private drift(T: ThemeDef, time: number, camX: number) {
    const c = this.c;
    for (let i = 0; i < 26; i++) {
      const sp = 6 + (i % 5) * 3;
      const x = Math.floor(((hash(i, 3) % 400) - camX * 0.5 + 400 * 8) % 340) - 10;
      const y = Math.floor(H - ((hash(i, 9) % 200) + time * sp) % (H + 20));
      c.globalAlpha = 0.25 + (i % 3) * 0.15;
      c.fillStyle = i % 4 === 0 ? T.accent2 : T.accent;
      c.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    c.globalAlpha = 1;
  }

  private title(time: number, T: ThemeDef) {
    const c = this.c;
    // A strip of ground with Patch patrolling it.
    for (let x = -((time * 24) % 16); x < W; x += 16) {
      c.fillStyle = THEMES.boot.tile.base; c.fillRect(Math.floor(x), 152, 16, 28);
      c.fillStyle = THEMES.boot.tile.top; c.fillRect(Math.floor(x), 152, 16, 2);
      c.fillStyle = THEMES.boot.tile.topDark; c.fillRect(Math.floor(x), 154, 16, 1);
      c.fillStyle = THEMES.boot.tile.trace; c.fillRect(Math.floor(x) + 3, 162, 9, 1);
    }
    const run = this.spr.patch.run[Math.floor(time * 10) % 4];
    c.drawImage(run.img, 96, 136 + (Math.floor(time * 10) % 2 ? -1 : 0));
    const gl = this.spr.glitch[Math.floor(time * 4) % 2];
    const gx = Math.floor(250 - ((time * 30) % 120));
    c.drawImage(gl.flip, gx, 142);
    const cell = this.spr.cell[Math.floor(time * 6) % 4];
    c.drawImage(cell.img, 150, 128 + Math.round(Math.sin(time * 3) * 2));
    c.drawImage(cell.img, 172, 128 + Math.round(Math.sin(time * 3 + 1) * 2));
    // Logo, with an occasional glitch slice.
    const lx = Math.round((W - this.logo.width) / 2), ly = 14 + Math.round(Math.sin(time * 1.6) * (this.reduced ? 0 : 2));
    c.drawImage(this.logo, lx, ly);
    if (!this.reduced && Math.sin(time * 2.3) > 0.97) {
      const sy = Math.floor(Math.random() * 50);
      c.drawImage(this.logo, 0, sy, this.logo.width, 3, lx + 3, ly + sy, this.logo.width, 3);
    }
    drawText(c, 'A REPAIR ROBOT ADVENTURE', W / 2, ly + 60, T.accent2, 'center');
  }

  private world(g: Game, time: number, T: ThemeDef) {
    const c = this.c;
    const s = this.spr;
    const px = (col: string, x: number, y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

    // Signs (holographic panels)
    for (const sg of g.signs) {
      const text = sg.text.replace('{ACT}', g.actLabel);
      const img = textImage(text, T.accent2);
      const w = img.width + 6;
      c.globalAlpha = 0.75;
      px('#05060d', sg.x - 3, sg.y - 3, w, 13);
      c.globalAlpha = 1;
      px(T.accent, sg.x - 3, sg.y - 3, w, 1); px(T.accent, sg.x - 3, sg.y + 9, w, 1);
      c.drawImage(img, sg.x, sg.y);
      px(T.tile.trace, sg.x + Math.floor(w / 2) - 4, sg.y + 10, 1, 6);
    }

    // Arcs
    for (const a of g.arcs) {
      const st = a.state(g.t);
      px('#eef3fb', a.x - 2, a.y0 - 2, 4, 2); px(T.accent, a.x - 1, a.y1 - 1, 2, 1);
      if (st === 'on') {
        let x = a.x;
        for (let y = a.y0; y < a.y1; y += 2) {
          const nx = a.x + ((hash(y, Math.floor(time * 30)) % 5) - 2);
          px(T.accent, Math.min(x, nx), y, Math.abs(nx - x) + 1, 1);
          px('#eef3fb', nx, y, 1, 2);
          x = nx;
        }
        c.globalAlpha = 0.25; px(T.accent, a.x - 3, a.y0, 6, a.y1 - a.y0); c.globalAlpha = 1;
      } else if (st === 'warn' && Math.floor(time * 20) % 2 === 0) {
        px('#eef3fb', a.x - 1, a.y0, 2, 3); px('#eef3fb', a.x - 1, a.y1 - 3, 2, 3);
      }
    }

    // Moving platforms
    for (const m of g.movers) {
      const x = Math.round(m.x), y = Math.round(m.y);
      px(T.tile.dark, x, y, m.w, 7); px(T.tile.top, x, y, m.w, 1); px(T.tile.base, x + 1, y + 1, m.w - 2, 4);
      for (let i = 4; i < m.w - 2; i += 8) px(Math.floor(time * 4 + i) % 2 ? T.accent2 : T.tile.trace, x + i, y + 2, 2, 2);
      px(T.accent, x + 3, y + 7 + (Math.floor(time * 12) % 2), 2, 1); px(T.accent, x + m.w - 5, y + 7 + (Math.floor(time * 12 + 1) % 2), 2, 1);
    }

    // Exit / gate
    const ex = g.exit;
    if (ex) {
      if (ex.gate) {
        if (!ex.open || g.arena?.active) {
          for (let y = 0; y < ex.y + ex.h; y += 3) px((Math.floor(y / 3 + time * 10) % 3) ? T.accent2 : '#eef3fb', ex.x + 6 + (hash(y, Math.floor(time * 15)) % 3) - 1, y, 2, 2);
          c.globalAlpha = 0.2; px(T.accent2, ex.x + 3, 0, 10, ex.y + ex.h); c.globalAlpha = 1;
        }
        px('#4a5878', ex.x + 2, ex.y + ex.h - 6, 12, 6); px('#7d8db0', ex.x + 2, ex.y + ex.h - 6, 12, 1);
      } else {
        px('#4a5878', ex.x, ex.y, 16, ex.h); px('#7d8db0', ex.x, ex.y, 16, 2); px('#0d1020', ex.x + 3, ex.y + 4, 10, ex.h - 4);
        if (ex.open) {
          for (let i = 0; i < 14; i++) {
            const yy = ex.y + 4 + ((i * 7 + Math.floor(time * 40)) % (ex.h - 6));
            px(i % 2 ? T.accent : '#eef3fb', ex.x + 4 + (hash(i, 5) % 8), yy, 1, 2);
          }
          c.globalAlpha = 0.35 + Math.sin(time * 6) * 0.15; px(T.accent, ex.x + 3, ex.y + 4, 10, ex.h - 4); c.globalAlpha = 1;
          px(T.accent2, ex.x + 6, ex.y - 6 + Math.round(Math.sin(time * 5) * 2), 4, 3);
        } else {
          for (let y = ex.y + 6; y < ex.y + ex.h; y += 5) px('#ff4d6d', ex.x + 3, y, 10, 2);
          px('#ffe066', ex.x + 6, ex.y + 12, 4, 4); px('#0d1020', ex.x + 7, ex.y + 13, 2, 2);
        }
      }
    }

    // Checkpoints
    for (const cp of g.checkpoints) {
      px('#4a5878', cp.x + 4, cp.y + 4, 2, 20); px('#7d8db0', cp.x + 4, cp.y + 4, 1, 20);
      px('#4a5878', cp.x + 1, cp.y + 22, 8, 2);
      const col = cp.active ? T.accent : '#ff4d6d';
      px(col, cp.x + 3, cp.y, 4, 4);
      if (cp.active) {
        for (let i = 0; i < 4; i++) px(T.accent, cp.x + 6 + i * 2, cp.y + 5 + Math.round(Math.sin(time * 6 + i) * 1.5), 2, 4);
        c.globalAlpha = 0.3 + Math.sin(time * 4) * 0.2; px(T.accent, cp.x + 2, cp.y - 1, 6, 6); c.globalAlpha = 1;
      }
    }

    // Terminals
    for (const t of g.terminals) {
      if (t.hidden) continue;
      this.terminal(t, time, g);
    }

    // Boss beams from repaired nodes
    const b = g.boss;
    if (b && g.arena?.active && (b.stage === 'shielded' || b.stage === 'unstable')) {
      for (const t of g.terminals) if (t.repaired && t.boss && t.boss < 3) this.beam(t.x + 8, t.y + 4, b.x, b.y, time);
    }

    // Pickups
    for (const pk of g.pickups) {
      if (pk.taken) continue;
      const bob = Math.round(Math.sin(pk.t * 3) * 2);
      if (pk.kind === 'cell') {
        const f = s.cell[Math.floor(pk.t * 8) % 4];
        c.globalAlpha = 0.25; px(T.accent, pk.x - 1, pk.y + bob - 1, 10, 11); c.globalAlpha = 1;
        c.drawImage(f.img, Math.round(pk.x), Math.round(pk.y + bob));
      } else c.drawImage(s.kit.img, Math.round(pk.x), Math.round(pk.y + bob));
    }

    // Turrets
    for (const tu of g.turrets) {
      const sp = tu.fixed ? s.turretFixed : s.turret;
      c.drawImage(tu.dir > 0 ? sp.img : sp.flip, Math.round(tu.x - 1), Math.round(tu.y - 2));
      if (tu.flash > 0) px('#ffe066', tu.dir > 0 ? tu.x + 15 : tu.x - 3, tu.y + 3, 3, 3);
      if (tu.fixed && Math.floor(time * 2) % 2) px('#39ff88', tu.x + 6, tu.y - 4, 2, 2);
    }

    // Glitches: a colour-split, jittery look; scattered slices when defeated.
    for (const gl of g.glitches) {
      const f = Math.floor(gl.t * 6) % 2;
      const sp = s.glitch[f];
      const img = gl.vx > 0 ? sp.flip : sp.img;
      const x = Math.round(gl.x - 1), y = Math.round(gl.y - 2);
      if (gl.dying > 0) {
        const k = 1 - gl.dying / 0.45;
        for (let row = 0; row < sp.h; row += 2) c.drawImage(img, 0, row, sp.w, 2, x + Math.round((hash(row, 7) % 9 - 4) * k * 4), y + row - Math.round(k * 6), sp.w, 2);
        continue;
      }
      if (!this.reduced && hash(Math.floor(time * 12), Math.round(gl.x)) % 7 === 0) {
        c.drawImage(this.sil.glitchM[f], x - 1, y); c.drawImage(this.sil.glitchC[f], x + 1, y);
      }
      c.drawImage(img, x, y);
    }

    // Drones
    for (const d of g.drones) {
      const sp = s.drone[Math.floor(time * 14) % 2];
      if (d.dying > 0 && Math.floor(time * 20) % 2) continue;
      c.drawImage(sp.img, Math.round(d.x - 2), Math.round(d.y - 2));
      if (d.chase && d.alive) px('#ff4d6d', d.x + 5, d.y - 5, 2, 2);
    }

    // Boss
    if (b && (g.arena?.active || b.stage !== 'intro') && b.stage !== 'dead') this.boss(g, time);

    // Bullets and shockwaves
    for (const bl of g.bullets) {
      const x = Math.round(bl.x), y = Math.round(bl.y);
      if (bl.kind === 'big') { px('#ff8c2e', x, y + 1, 6, 4); px('#ff8c2e', x + 1, y, 4, 6); px('#ffe066', x + 2, y + 2, 2, 2); }
      else { px('#ff4d6d', x + 1, y + 1, 4, 4); px('#eef3fb', x + 2, y + 2, 2, 2); px('#ff4d6d', x + 2, y, 2, 6); }
    }
    for (const w of g.waves) {
      for (let i = 0; i < w.w; i += 2) {
        const hgt = 4 + (hash(i, Math.floor(time * 20)) % 6);
        px(i % 4 ? '#ff8c2e' : '#ffe066', w.x + i, w.y + w.h - hgt, 2, hgt);
      }
    }

    // Patch
    this.patch(g, time, T);

    // Pulse ring
    if (g.pulseT > 0) {
      const k = 1 - g.pulseT / PULSE.time;
      this.ring(g.player.cx, g.player.cy, Math.round(6 + k * (PULSE.radius - 6)), T.accent, 1 - k * 0.6);
      this.ring(g.player.cx, g.player.cy, Math.round(3 + k * (PULSE.radius - 10)), '#eef3fb', 0.6 - k * 0.5);
    }

    // Particles
    for (const p of g.particles.pool) {
      if (!p.on) continue;
      c.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      px(p.color, p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
  }

  private terminal(t: Game['terminals'][number], time: number, g: Game) {
    const c = this.c;
    const px = (col: string, x: number, y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
    const x = t.x, y = t.y;
    // Stand and housing
    px('#2b3550', x + 2, y + 16, 12, 6); px('#4a5878', x + 2, y + 16, 12, 1);
    px('#4a5878', x + 6, y + 12, 4, 4);
    px('#0d1020', x, y, 16, 13); px(t.repaired ? '#7d8db0' : '#4a5878', x + 1, y + 1, 14, 11);
    // Screen
    const sx = x + 2, sy = y + 2;
    if (t.repaired) {
      px('#0c3a24', sx, sy, 12, 9);
      for (let i = 0; i < 3; i++) px('#159a55', sx + 1, sy + 1 + ((i * 3 + Math.floor(time * 6)) % 9), 10, 1);
      // Check mark
      px('#39ff88', sx + 3, sy + 4, 1, 1); px('#39ff88', sx + 4, sy + 5, 1, 1); px('#39ff88', sx + 5, sy + 6, 1, 1);
      px('#39ff88', sx + 6, sy + 5, 1, 1); px('#39ff88', sx + 7, sy + 4, 1, 1); px('#39ff88', sx + 8, sy + 3, 1, 1);
    } else {
      px('#3a0a14', sx, sy, 12, 9);
      for (let r = 0; r < 9; r += 2) {
        const off = (hash(r, Math.floor(time * 8)) % 5) - 2;
        px(r % 4 ? '#ff4d6d' : '#7a1a30', sx + 2 + off, sy + r, 6 + (hash(r, 3) % 4), 1);
      }
      if (t.progress > 0) { px('#0d1020', sx + 1, sy + 7, 10, 2); px('#39ff88', sx + 1, sy + 7, Math.round(10 * t.progress), 2); }
      // Blinking marker: this one needs repair.
      if (Math.floor(time * 3) % 2 === 0) {
        const mx = x + 6, my = y - 9 + Math.round(Math.sin(time * 5) * 1);
        px('#ffe066', mx, my, 4, 1); px('#ffe066', mx + 1, my + 1, 2, 1); px('#0d1020', mx, my - 1, 4, 1);
      }
      if (g.terminalInReach() === t && g.player.onGround && !g.repairing) {
        const label = g.actLabel;
        const img = textImage(label, '#0d1020', false);
        const bw = img.width + 5;
        const bx = Math.round(x + 8 - bw / 2), by = y - 22 + (Math.floor(time * 4) % 2);
        px('#ffe066', bx, by, bw, 10); px('#0d1020', bx, by + 10, bw, 1);
        c.drawImage(img, bx + 3, by + 2);
      }
    }
  }

  private beam(x0: number, y0: number, x1: number, y1: number, time: number) {
    const c = this.c;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3);
    for (let i = 0; i < n; i++) {
      if ((i + Math.floor(time * 20)) % 3 === 0) continue;
      const k = i / n;
      c.fillStyle = i % 2 ? '#39ff88' : '#eef3fb';
      c.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k), 2, 2);
    }
  }

  private ring(cx: number, cy: number, r: number, col: string, alpha: number) {
    const c = this.c;
    if (alpha <= 0) return;
    c.globalAlpha = alpha;
    c.fillStyle = col;
    let x = r, y = 0, err = 1 - r;
    cx = Math.round(cx); cy = Math.round(cy);
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) c.fillRect(cx + a, cy + b, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
    c.globalAlpha = 1;
  }

  private disc(cx: number, cy: number, r: number, col: string) {
    const c = this.c;
    c.fillStyle = col;
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y));
      c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  }

  private boss(g: Game, time: number) {
    const b = g.boss!;
    const c = this.c;
    const x = Math.round(b.x), y = Math.round(b.y);
    const hit = b.hitFlash > 0 && Math.floor(time * 30) % 2 === 0;
    const dying = b.stage === 'dying';
    if (dying && Math.floor(time * 16) % 3 === 0) return;
    // Outer teeth ring, rotating
    const spin = time * (b.stage === 'exposed' ? 2.4 : 1.2);
    for (let i = 0; i < 12; i++) {
      const a = spin + (i / 12) * Math.PI * 2;
      c.fillStyle = i % 2 ? '#ff4d6d' : '#8a1630';
      c.fillRect(Math.round(x + Math.cos(a) * 21) - 2, Math.round(y + Math.sin(a) * 21) - 2, 4, 4);
    }
    this.disc(x, y, 18, '#0d1020');
    this.disc(x, y, 17, hit ? '#eef3fb' : b.stage === 'exposed' ? '#3a0f0f' : '#24101e');
    this.ring(x, y, 15, b.stage === 'exposed' ? '#ff8c2e' : '#7a32e0', 1);
    // Cracks once the shield is down
    if (b.stage !== 'shielded' && b.stage !== 'intro') {
      c.fillStyle = '#ff8c2e';
      for (const [dx, dy] of [[-12, -6], [-11, -5], [-10, -5], [9, 8], [10, 9], [11, 9], [4, -13], [5, -12]]) c.fillRect(x + dx, y + dy, 1, 1);
    }
    // The eye
    const glow = b.stage === 'exposed' ? 0.5 + Math.sin(time * 10) * 0.3 : 0;
    if (glow) { c.globalAlpha = glow; this.disc(x, y, 12, '#ff8c2e'); c.globalAlpha = 1; }
    this.disc(x, y, 9, '#eef3fb');
    const ex = x + Math.round(b.look * 4);
    this.disc(ex, y + 1, 5, b.stage === 'exposed' ? '#ff8c2e' : '#ff4d6d');
    this.disc(ex, y + 1, 2, '#0d1020');
    c.fillStyle = '#ffffff'; c.fillRect(ex - 2, y - 2, 1, 1);
    if (b.slamming === 'warn' && Math.floor(time * 16) % 2) { c.fillStyle = '#ffe066'; c.fillRect(x - 20, y + 22, 40, 2); }
    // Glitch slices when hit
    if (b.hitFlash > 0 && !this.reduced) {
      for (let i = 0; i < 4; i++) {
        const sy = y - 18 + (hash(i, Math.floor(time * 30)) % 36);
        c.fillStyle = i % 2 ? '#ff3df2' : '#47f3ff';
        c.fillRect(x - 20 + (hash(i, Math.floor(time * 30)) % 12), sy, 16 + (hash(i, 4) % 10), 1);
      }
    }
    // Shield
    if (b.stage === 'shielded' || b.stage === 'intro') {
      for (let i = 0; i < 24; i++) {
        if ((i + Math.floor(time * 8)) % 3 === 0) continue;
        const a = -time * 1.5 + (i / 24) * Math.PI * 2;
        c.fillStyle = i % 2 ? '#47f3ff' : '#ff3df2';
        c.fillRect(Math.round(x + Math.cos(a) * 27), Math.round(y + Math.sin(a) * 27), 2, 2);
      }
    }
  }

  private patch(g: Game, time: number, T: ThemeDef) {
    const p = g.player;
    if (g.mode === 'dying') return;
    if (p.invuln > 0 && g.mode === 'play' && Math.floor(time * 14) % 2 === 0) return;
    const s = this.spr.patch;
    let sp: Sprite;
    let bob = 0;
    if (p.hurtTime > 0) sp = s.hurt;
    else if (g.repairing) sp = s.repair[Math.floor(time * 10) % 2];
    else if (!p.onGround) sp = p.vy < 0 ? s.jump : s.fall;
    else if (Math.abs(p.vx) > 12) {
      const f = Math.floor(p.anim * (Math.abs(p.vx) > 100 ? 14 : 10)) % 4;
      sp = s.run[f];
      bob = f % 2 ? -1 : 0;
    } else {
      const cyc = Math.floor(time * 3) % 12;
      sp = cyc === 11 ? s.idle[2] : s.idle[Math.floor(time * 2) % 2 === 0 ? 0 : 1];
    }
    const x = Math.round(p.x - 3), y = Math.round(p.y + p.h - 16 + bob);
    this.c.drawImage(p.face > 0 ? sp.img : sp.flip, x, y);
    if (g.repairing) {
      const tx = p.face > 0 ? x + 15 : x;
      if (Math.floor(time * 20) % 2) { this.c.fillStyle = T.accent2; this.c.fillRect(tx, y + 10, 1, 1); this.c.fillStyle = '#eef3fb'; this.c.fillRect(tx + p.face, y + 9, 1, 1); }
    }
  }

  private hud(g: Game, time: number, T: ThemeDef) {
    const c = this.c;
    const s = this.spr;
    // Top bar
    c.fillStyle = 'rgba(5,6,13,0.6)'; c.fillRect(0, 0, W, 13);
    c.fillStyle = T.accent; c.globalAlpha = 0.5; c.fillRect(0, 13, W, 1); c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) c.drawImage(i < g.player.hp ? s.heart.img : s.heartEmpty.img, 4 + i * 9, 4);
    drawText(c, `x${g.lives}`, 33, 3, '#eef3fb');
    c.drawImage(s.cell[0].img, 54, 2, 7, 8);
    drawText(c, `${g.cells}/${g.cellsTotal}`, 63, 3, T.accent);
    if (g.boss && g.arena?.active) {
      const b = g.boss;
      drawText(c, 'KERNEL', 124, 3, '#ff4d6d');
      for (let i = 0; i < 6; i++) {
        c.fillStyle = b.stage === 'exposed' || b.stage === 'dying' ? (i < b.hp ? '#ff8c2e' : '#3a0f0f') : '#47f3ff';
        c.fillRect(162 + i * 6, 4, 5, 6);
      }
    } else {
      const req = g.required.length;
      drawText(c, `SYS ${g.repairedCount}/${req}`, 118, 3, g.repairedCount === req ? '#39ff88' : T.accent2);
    }
    drawText(c, String(g.score).padStart(6, '0'), W - 4, 3, '#eef3fb', 'right');
    drawText(c, fmtTime(g.runTime), W - 46, 3, '#9db0c4', 'right');

    if (g.toast.t > 0) {
      const a = Math.min(1, g.toast.t * 3);
      c.globalAlpha = a;
      const img = textImage(g.toast.text, T.accent2);
      const w = img.width + 10;
      c.fillStyle = 'rgba(5,6,13,0.8)'; c.fillRect(Math.round(W / 2 - w / 2), 20, w, 13);
      c.fillStyle = T.accent2; c.fillRect(Math.round(W / 2 - w / 2), 32, w, 1);
      c.drawImage(img, Math.round(W / 2 - img.width / 2), 23);
      c.globalAlpha = 1;
    }
  }

  private introCard(g: Game, T: ThemeDef) {
    const c = this.c;
    const k = Math.min(1, g.modeT * 3);
    const h = Math.round(56 * k);
    c.fillStyle = 'rgba(5,6,13,0.85)'; c.fillRect(0, 90 - h / 2, W, h);
    c.fillStyle = T.accent; c.fillRect(0, 90 - h / 2, W, 1); c.fillRect(0, 90 + h / 2 - 1, W, 1);
    if (k < 1) return;
    drawText(c, `LEVEL ${g.level.id}`, W / 2, 68, T.accent2, 'center');
    drawText(c, g.level.name, W / 2, 80, T.accent, 'center', 2);
    drawText(c, g.level.subtitle, W / 2, 100, '#9db0c4', 'center');
  }
}
