// A tiny flat-shaded 3D renderer that draws the configured table as SVG.
// Units are inches. y is up, x runs along the table's length, z across it.
// Shapes are extruded outlines (prisms) and rods; faces are culled, shaded
// against a fixed light and painted back to front.

export interface Config {
  length: number; width: number; species: Species; legs: Legs; edge: Edge; thick: 'std' | 'thick'; finish: Finish; metal: 'black' | 'brass';
  leaf: boolean; bench: boolean; chairs: boolean;
}
export type Species = 'oak' | 'walnut' | 'cherry' | 'maple' | 'ash';
export type Legs = 'tapered' | 'trestle' | 'pedestal' | 'hairpin';
export type Edge = 'square' | 'bevel' | 'live';
export type Finish = 'oil' | 'matte' | 'ebony' | 'white';

type V3 = [number, number, number];
interface Face { pts: V3[]; color: string; kind: 'wood' | 'endgrain' | 'metal' | 'chair' | 'shadow'; grain?: boolean; stroke?: boolean; center?: V3 }
const centerOf = (fs: Face[]) => { const all = fs.flatMap((f) => f.pts); const c = all.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as V3, [0, 0, 0] as V3); const n = all.length; const m: V3 = [c[0] / n, c[1] / n, c[2] / n]; fs.forEach((f) => (f.center = m)); return fs; };

export const woodColor: Record<Species, string> = { oak: '#c69a63', walnut: '#6b4532', cherry: '#a8573a', maple: '#e2c49a', ash: '#d4b383' };
export const finishTone = (c: Config) => {
  if (c.finish === 'ebony') return '#2c2622';
  if (c.finish === 'white') return mix(woodColor[c.species], '#f1ece4', 0.55);
  if (c.finish === 'matte') return mix(woodColor[c.species], '#e8dccb', 0.08);
  return woodColor[c.species];
};

function hex(c: string): V3 { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex([r, g, b]: V3) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function mix(a: string, b: string, k: number) { const A = hex(a), B = hex(b); return toHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]); }
function shade(c: string, k: number) { const A = hex(c); return toHex([A[0] * k, A[1] * k, A[2] * k]); }

/** Extrude an outline (x,z points, counter-clockwise from above) between y0 and y1; `inset` shrinks the bottom. */
function prism(outline: [number, number][], y0: number, y1: number, color: string, kind: Face['kind'] = 'wood', bottomScale = 1, grain = false): Face[] {
  const cx = outline.reduce((s, p) => s + p[0], 0) / outline.length, cz = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  const bot = outline.map(([x, z]) => [cx + (x - cx) * bottomScale, cz + (z - cz) * bottomScale] as [number, number]);
  const faces: Face[] = [
    { pts: outline.map(([x, z]) => [x, y1, z] as V3), color, kind, grain },
    { pts: [...bot].reverse().map(([x, z]) => [x, y0, z] as V3), color, kind },
  ];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    faces.push({ pts: [[outline[i][0], y1, outline[i][1]], [bot[i][0], y0, bot[i][1]], [bot[j][0], y0, bot[j][1]], [outline[j][0], y1, outline[j][1]]], color, kind: kind === 'wood' ? 'endgrain' : kind });
  }
  return centerOf(faces);
}
const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x0, z1], [x1, z1], [x1, z0]];
/** Box with a different footprint at the bottom (tapered legs, pedestal columns). */
function frustum(top: [number, number, number, number], bot: [number, number, number, number], y0: number, y1: number, color: string, kind: Face['kind'] = 'wood'): Face[] {
  const T = rect(...top), B = rect(...bot);
  const faces: Face[] = [{ pts: T.map(([x, z]) => [x, y1, z] as V3), color, kind }, { pts: [...B].reverse().map(([x, z]) => [x, y0, z] as V3), color, kind }];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; faces.push({ pts: [[T[i][0], y1, T[i][1]], [B[i][0], y0, B[i][1]], [B[j][0], y0, B[j][1]], [T[j][0], y1, T[j][1]]], color, kind }); }
  return centerOf(faces);
}
/** Square rod between two points (hairpin legs). */
function rod(a: V3, b: V3, r: number, color: string): Face[] {
  const faces: Face[] = [];
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const up: V3 = Math.abs(d[1]) > Math.abs(d[0]) ? [1, 0, 0] : [0, 1, 0];
  const n1 = norm(cross(d, up)), n2 = norm(cross(d, n1));
  const ring = (p: V3) => [0, 1, 2, 3].map((k) => { const s = [1, -1, -1, 1][k] * r, t = [1, 1, -1, -1][k] * r; return [p[0] + n1[0] * s + n2[0] * t, p[1] + n1[1] * s + n2[1] * t, p[2] + n1[2] * s + n2[2] * t] as V3; });
  const A = ring(a), B = ring(b);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; faces.push({ pts: [A[i], B[i], B[j], A[j]], color, kind: 'metal' }); }
  return centerOf(faces);
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Wavy outline for a live edge, stable for a given length. */
function liveOutline(L: number, W: number): [number, number][] {
  const n = 28;
  const wave = (t: number, k: number) => Math.sin(t * 9.3 + k) * 0.9 + Math.sin(t * 3.1 + k * 2) * 1.1 + Math.sin(t * 17 + k) * 0.35;
  const near: [number, number][] = [], far: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = -L / 2 + t * L;
    near.push([x, W / 2 - 0.8 + wave(t, 1.7) * 0.8]);
    far.push([x, -W / 2 + 0.8 - wave(t, 4.2) * 0.8]);
  }
  return [...near, ...far.reverse()];
}

export function build(c: Config): Face[] {
  const L = c.length + (c.leaf ? 18 : 0), W = c.width, H = 30;
  const t = c.thick === 'thick' ? 1.75 : 1.25;
  const wood = finishTone(c);
  const metal = c.metal === 'brass' ? '#b08d4a' : '#2a2a2a';
  const faces: Face[] = [];
  // soft floor shadow
  faces.push({ pts: rect(-L / 2 - 4, -W / 2 - 4, L / 2 + 4, W / 2 + 4).map(([x, z]) => [x, 0, z] as V3), color: '#000', kind: 'shadow' });
  // top
  const outline = c.edge === 'live' ? liveOutline(L, W) : rect(-L / 2, -W / 2, L / 2, W / 2);
  faces.push(...prism(outline, H - t, H, wood, 'wood', c.edge === 'bevel' ? 0.975 : 1, true));
  if (c.leaf) faces.push({ pts: [[-9, H + 0.01, -W / 2], [-9, H + 0.01, W / 2]], color: shade(wood, 0.7), kind: 'wood', stroke: true });
  const legY = H - t;
  const inX = L / 2 - (c.legs === 'hairpin' ? 4 : 3.5), inZ = W / 2 - 3.5;
  if (c.legs === 'tapered') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * inX, z = sz * inZ;
      faces.push(...frustum([x - 1.4, z - 1.4, x + 1.4, z + 1.4], [x - 0.8 + sx * 0.6, z - 0.8 + sz * 0.6, x + 0.8 + sx * 0.6, z + 0.8 + sz * 0.6], 0, legY, wood));
    }
    // aprons
    faces.push(...prism(rect(-inX + 1.4, inZ - 0.5, inX - 1.4, inZ + 0.4), legY - 3.5, legY, shade(wood, 0.96)));
    faces.push(...prism(rect(-inX + 1.4, -inZ - 0.4, inX - 1.4, -inZ + 0.5), legY - 3.5, legY, shade(wood, 0.96)));
    for (const sx of [-1, 1]) faces.push(...prism(rect(sx * inX - 0.5, -inZ + 1.4, sx * inX + 0.4, inZ - 1.4), legY - 3.5, legY, shade(wood, 0.96)));
  } else if (c.legs === 'trestle') {
    const tx = L / 2 - 12;
    for (const sx of [-1, 1]) {
      const x = sx * tx;
      faces.push(...prism(rect(x - 1.6, -W / 2 + 4, x + 1.6, W / 2 - 4), legY - 2, legY, wood)); // cleat
      faces.push(...frustum([x - 1.5, -6, x + 1.5, 6], [x - 1.5, -4, x + 1.5, 4], 4, legY - 2, wood)); // post
      faces.push(...prism(rect(x - 2, -W / 2 + 5, x + 2, W / 2 - 5), 0, 4, wood)); // foot
    }
    faces.push(...prism(rect(-tx, -1.2, tx, 1.2), 12, 16, shade(wood, 0.97))); // stretcher
  } else if (c.legs === 'pedestal') {
    const px = Math.max(10, L / 2 - 20);
    for (const sx of (L > 80 ? [-1, 1] : [0])) {
      const x = sx * px;
      faces.push(...frustum([x - 3, -3, x + 3, 3], [x - 4.5, -4.5, x + 4.5, 4.5], 3, legY, wood));
      faces.push(...frustum([x - 4.5, -4.5, x + 4.5, 4.5], [x - 9, -9, x + 9, 9], 0, 3, shade(wood, 0.98)));
    }
  } else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * inX, z = sz * inZ;
      faces.push(...rod([x - sx * 3, legY, z], [x, 0.3, z - sz * 0.4], 0.28, metal));
      faces.push(...rod([x + sx * 1.5, legY, z], [x, 0.3, z - sz * 0.4], 0.28, metal));
    }
  }
  if (c.bench) {
    const bz = -W / 2 - 16, bl = Math.max(48, L - 24);
    faces.push(...prism(rect(-bl / 2, bz - 7, bl / 2, bz + 7), 16.75, 18, wood, 'wood', 1, true));
    for (const sx of [-1, 1]) faces.push(...frustum([sx * (bl / 2 - 4) - 1, bz - 5, sx * (bl / 2 - 4) + 1, bz + 5], [sx * (bl / 2 - 3) - 1, bz - 5.5, sx * (bl / 2 - 3) + 1, bz + 5.5], 0, 16.75, shade(wood, 0.95)));
  }
  if (c.chairs) {
    const seats = seatCount(c);
    const perSide = Math.max(1, Math.floor((seats - (L >= 72 ? 2 : 0)) / 2));
    const chairCol = '#e7e2da';
    const spots: { x: number; z: number; face: number }[] = [];
    const span = L - 22;
    for (let i = 0; i < perSide; i++) {
      const x = perSide === 1 ? 0 : -span / 2 + (span / (perSide - 1)) * i;
      spots.push({ x, z: W / 2 + 10, face: -1 });
      if (!c.bench) spots.push({ x, z: -W / 2 - 10, face: 1 });
    }
    if (L >= 72) { spots.push({ x: L / 2 + 10, z: 0, face: 2 }); spots.push({ x: -L / 2 - 10, z: 0, face: -2 }); }
    for (const s of spots) faces.push(...chair(s.x, s.z, s.face, chairCol));
  }
  return faces;
}
function chair(x: number, z: number, face: number, col: string): Face[] {
  const f: Face[] = [];
  const along = Math.abs(face) === 2; // chair at a table end
  const hw = 9, hd = 8.5;
  const seat = along ? rect(x - hd, z - hw, x + hd, z + hw) : rect(x - hw, z - hd, x + hw, z + hd);
  f.push(...prism(seat, 17, 18.5, col, 'chair'));
  const back = along ? (face > 0 ? rect(x + hd - 1.2, z - hw, x + hd, z + hw) : rect(x - hd, z - hw, x - hd + 1.2, z + hw)) : face < 0 ? rect(x - hw, z + hd - 1.2, x + hw, z + hd) : rect(x - hw, z - hd, x + hw, z - hd + 1.2);
  f.push(...prism(back, 18.5, 33, col, 'chair'));
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = x + dx * (along ? hd : hw) * 0.85, lz = z + dz * (along ? hw : hd) * 0.85;
    f.push(...prism(rect(lx - 0.6, lz - 0.6, lx + 0.6, lz + 0.6), 0, 17, '#8f877c', 'chair'));
  }
  return f;
}
export function seatCount(c: Pick<Config, 'length' | 'leaf'>) { const L = c.length + (c.leaf ? 18 : 0); return L < 66 ? 4 : L < 78 ? 6 : L < 96 ? 8 : L < 114 ? 10 : 12; }

export interface View { yaw: number; pitch: number }
export function render(svg: SVGSVGElement, c: Config, v: View, opts: { grainSeed?: number; mini?: boolean } = {}) {
  const faces = build(c);
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
  const span = c.length + (c.leaf ? 18 : 0) + (c.chairs ? 40 : 0);
  const scale = 720 / Math.max(110, span + 14);
  const cam = (p: V3): V3 => {
    const x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy;
    const y = p[1] - 15;
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    return [x, y2, z2];
  };
  const proj = (p: V3) => { const q = cam(p); const k = 900 / (900 + q[2] * 4); return [400 + q[0] * scale * k, 290 - q[1] * scale * k, q[2]] as V3; };
  const light = norm([-0.45, 0.85, -0.35]);
  const out: string[] = [];
  const drawn = faces.map((f) => {
    const P = f.pts.map(proj);
    const depth = f.pts.map(cam).reduce((s, q) => s + q[2], 0) / f.pts.length;
    return { f, P, depth };
  });
  // shadow first, then far to near
  drawn.sort((a, b) => (a.f.kind === 'shadow' ? -1 : b.f.kind === 'shadow' ? 1 : b.depth - a.depth));
  let topPath = '';
  for (const { f, P } of drawn) {
    const d = 'M' + P.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z';
    if (f.stroke) { out.push(`<path d="M${P[0][0]} ${P[0][1]}L${P[1][0]} ${P[1][1]}" stroke="${f.color}" stroke-width="1.2" />`); continue; }
    if (f.kind === 'shadow') { out.push(`<path d="${d}" class="ap-shadow" />`); continue; }
    // outward normal (away from the solid's centre), then cull faces turned away from the camera
    const a = f.pts[0], b = f.pts[1], cc = f.pts[2];
    let n = norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]]));
    const fc = f.pts.reduce((m, p) => [m[0] + p[0] / f.pts.length, m[1] + p[1] / f.pts.length, m[2] + p[2] / f.pts.length] as V3, [0, 0, 0] as V3);
    const ctr = f.center ?? [0, 15, 0];
    if (n[0] * (fc[0] - ctr[0]) + n[1] * (fc[1] - ctr[1]) + n[2] * (fc[2] - ctr[2]) < 0) n = [-n[0], -n[1], -n[2]];
    const nzr = n[0] * sy + n[2] * cy;
    if (n[1] * sp + nzr * cp > 0.001) continue;
    const lambert = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
    const k = (f.kind === 'metal' ? 0.55 : 0.62) + lambert * (f.kind === 'metal' ? 0.75 : 0.45);
    const col = shade(f.kind === 'endgrain' ? shade(f.color, 0.9) : f.color, k);
    out.push(`<path d="${d}" fill="${col}" stroke="${shade(col, 0.92)}" stroke-width=".6" stroke-linejoin="round" />`);
    if (f.grain && !opts.mini) topPath = d;
    if (f.grain && !opts.mini) out.push(grain(f, proj, d, c, opts.grainSeed ?? 1));
  }
  svg.innerHTML = out.join('');
  return topPath;
}
let clipN = 0;
function grain(f: Face, proj: (p: V3) => V3, clip: string, c: Config, seed: number) {
  const xs = f.pts.map((p) => p[0]), zs = f.pts.map((p) => p[2]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), y = f.pts[0][1] + 0.01;
  const lines: string[] = [];
  const dark = c.finish === 'ebony' ? 'rgba(255,255,255,.05)' : c.finish === 'white' ? 'rgba(90,70,50,.12)' : 'rgba(60,35,15,.16)';
  const count = Math.round((z1 - z0) / 1.1);
  for (let i = 0; i < count; i++) {
    const zb = z0 + ((i + 0.5) / count) * (z1 - z0);
    const amp = 0.35 + ((i * 7 + seed) % 5) * 0.12, freq = 0.05 + ((i * 3 + seed) % 4) * 0.012, ph = i * 1.7 + seed;
    const pts: string[] = [];
    for (let s = 0; s <= 24; s++) { const x = x0 + (s / 24) * (x1 - x0); const q = proj([x, y, zb + Math.sin(x * freq + ph) * amp]); pts.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`); }
    lines.push(`<polyline points="${pts.join(' ')}" />`);
  }
  // a couple of cathedral arches give the top character
  const id = `ap-clip-${++clipN}`;
  return `<clipPath id="${id}"><path d="${clip}" /></clipPath><g clip-path="url(#${id})" fill="none" stroke="${dark}" stroke-width=".7">${lines.join('')}</g>`;
}
