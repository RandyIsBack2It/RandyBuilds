// Pixel art from text: each sprite row is a string, each character a palette
// colour ('.' = transparent). Sprites are drawn once into small canvases
// (plus a mirrored copy) and blitted from then on. Also the 5×7 bitmap font.

export const PAL: Record<string, string> = {
  k: '#0d1020', // outline
  w: '#eef3fb',
  h: '#ffffff',
  l: '#b8c6dd', // light metal
  g: '#7d8db0', // metal
  d: '#4a5878', // dark metal
  c: '#47f3ff', // cyan
  b: '#1b8fb3', // deep cyan
  o: '#ff8c2e', // orange
  y: '#ffe066', // yellow
  r: '#ff4d6d', // red
  m: '#ff3df2', // magenta
  p: '#7a32e0', // purple
  v: '#2a1b4d', // violet
  n: '#39ff88', // green
  e: '#159a55', // deep green
};

export interface Sprite { w: number; h: number; img: HTMLCanvasElement; flip: HTMLCanvasElement }

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement) {
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return x;
}

export function sprite(rows: string[], pal: Record<string, string> = PAL): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const img = canvas(w, h);
  const x = ctx2d(img);
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); }
    }
  });
  const flip = canvas(w, h);
  const f = ctx2d(flip);
  f.translate(w, 0);
  f.scale(-1, 1);
  f.drawImage(img, 0, 0);
  return { w, h, img, flip };
}

/** Swaps palette letters in a sprite's rows (for colour variants). */
export const recolor = (rows: string[], map: Record<string, string>) =>
  rows.map((r) => [...r].map((ch) => map[ch] ?? ch).join(''));

// ── 5×7 font ───────────────────────────────────────────────────────────
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..#..', '..#..'],
  ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  ';': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.#...'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '.#.#.', '#####', '.#.#.'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
};
/** Typographic characters drawn with the glyphs we have. */
const NORMALIZE: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '×': 'X', '–': '-', '—': '-', '→': '>', '←': '<', 'é': 'E', 'É': 'E' };
export const GLYPH_W = 6;
export const GLYPH_H = 7;

const textCache = new Map<string, HTMLCanvasElement>();

/**
 * Text as a cached canvas. With `shadow`, a 1px dark drop shadow keeps it
 * legible over any background.
 */
export function textImage(str: string, color: string, shadow = true) {
  const key = `${str}|${color}|${shadow}`;
  let img = textCache.get(key);
  if (img) return img;
  const s = [...str].map((ch) => NORMALIZE[ch] ?? ch).join('').toUpperCase();
  img = canvas(s.length * GLYPH_W + 1, GLYPH_H + 1);
  const x = ctx2d(img);
  const draw = (col: string, ox: number, oy: number) => {
    x.fillStyle = col;
    [...s].forEach((ch, i) => {
      const g = GLYPHS[ch] ?? GLYPHS[ch.toLowerCase()] ?? GLYPHS['?'];
      g.forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') x.fillRect(i * GLYPH_W + rx + ox, ry + oy, 1, 1); });
    });
  };
  if (shadow) draw('#05060d', 1, 1);
  draw(color, 0, 0);
  if (textCache.size > 300) textCache.clear();
  textCache.set(key, img);
  return img;
}

export const textWidth = (s: string) => [...s].map((ch) => NORMALIZE[ch] ?? ch).join('').length * GLYPH_W - 1;

export function drawText(c: CanvasRenderingContext2D, s: string, x: number, y: number, color = '#eef3fb', align: 'left' | 'center' | 'right' = 'left', scale = 1) {
  const img = textImage(s, color);
  const w = img.width * scale;
  const dx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  c.drawImage(img, Math.round(dx), Math.round(y), w, img.height * scale);
}
