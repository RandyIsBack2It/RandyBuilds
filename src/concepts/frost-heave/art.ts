// Frost Heave's illustrations, drawn as SVG strings from data: a scoop for
// every flavor, a cone for the hero and the road sign. DOM-free, so the
// page renders them at build time. No style="" anywhere (strict CSP):
// colours are presentation attributes, and nothing uses ids, so a drawing
// can appear any number of times on a page.
import { rng } from '../shared';
import { flavorById, type Look } from './data';

export const ink = '#2b1630';
const cream = '#fff6e6';
const yellow = '#f7c325';

/** Mix a hex colour toward black (amt < 0) or white (amt > 0). */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const OUTER = 'M26 112C22 58 58 20 100 20C142 20 178 58 174 112Q168 126 154 120Q144 134 128 124Q116 138 100 126Q84 138 72 124Q56 134 46 120Q32 126 26 112Z';
const INNER = 'M34 102C32 60 64 28 100 28C136 28 168 60 166 102C140 112 60 112 34 102Z';

/** One scoop in a 200 × 150 box, centred on x = 100. */
export function scoopG(look: Look, seed: string, opts: { x?: number; y?: number; s?: number; drip?: boolean } = {}) {
  const { x = 0, y = 0, s = 1 } = opts;
  const dark = shade(look.base, -0.17);
  const p: string[] = [];
  if (opts.drip) p.push(`<path d="M120 120c3 16 0 30-2 36a7 7 0 0 0 14 0c-1-8-4-22-2-38z" fill="${dark}"/>`);
  p.push(`<path d="${OUTER}" fill="${dark}" stroke="${ink}" stroke-opacity=".16" stroke-width="2"/>`, `<path d="${INNER}" fill="${look.base}"/>`);
  if (look.swirl) {
    p.push(`<path d="M44 88c18-22 38 8 58-12s40-12 54 8" fill="none" stroke="${look.swirl}" stroke-width="8" stroke-linecap="round"/>`);
    p.push(`<path d="M60 58c14-12 30 6 46-6s28-8 36 2" fill="none" stroke="${look.swirl}" stroke-width="6" stroke-linecap="round" opacity=".85"/>`);
  }
  if (look.bits) {
    const r = rng(hash(seed));
    const n = look.bit === 'speck' ? 18 : look.bit === 'berry' ? 8 : 10;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const cx = (100 + Math.cos(a) * d * 54).toFixed(1), cy = (68 + Math.sin(a) * d * 30).toFixed(1);
      if (look.bit === 'speck') p.push(`<circle cx="${cx}" cy="${cy}" r="${(1.6 + r() * 1.4).toFixed(1)}" fill="${look.bits}"/>`);
      else if (look.bit === 'berry') p.push(`<circle cx="${cx}" cy="${cy}" r="5.5" fill="${look.bits}"/><circle cx="${(+cx - 1.6).toFixed(1)}" cy="${(+cy - 1.8).toFixed(1)}" r="1.6" fill="#fff" opacity=".35"/>`);
      else p.push(`<rect x="${(+cx - 5).toFixed(1)}" y="${(+cy - 4).toFixed(1)}" width="10" height="8" rx="2.5" fill="${look.bits}" transform="rotate(${Math.round(r() * 90 - 45)} ${cx} ${cy})"/>`);
    }
  }
  p.push('<ellipse cx="72" cy="50" rx="20" ry="8.5" transform="rotate(-26 72 50)" fill="#fff" opacity=".42"/><circle cx="99" cy="37" r="3.5" fill="#fff" opacity=".5"/>');
  return `<g transform="translate(${x} ${y}) scale(${s})">${p.join('')}</g>`;
}

export function scoopSvg(id: string, label?: string, drip = false) {
  const f = flavorById[id];
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg viewBox="0 6 200 ${drip ? 160 : 136}" ${a11y}>${scoopG(f.look, id, { drip })}</svg>`;
}

/* ---------- cones and cups ---------- */

function waffleLines(color: string) {
  const out: string[] = [];
  for (let x0 = 52; x0 < 164; x0 += 16) {
    const t = (164 - x0) / 128;
    out.push(`M${x0} 172L${(x0 + 64 * t).toFixed(1)} ${(172 + 122 * t).toFixed(1)}`);
  }
  for (let x0 = 148; x0 > 36; x0 -= 16) {
    const t = (x0 - 36) / 128;
    out.push(`M${x0} 172L${(x0 - 64 * t).toFixed(1)} ${(172 + 122 * t).toFixed(1)}`);
  }
  return `<path d="${out.join('')}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

function vesselBack(v: string) {
  if (v === 'cup') return `<ellipse cx="100" cy="176" rx="58" ry="10" fill="${shade(yellow, -0.35)}"/>`;
  return '';
}
function vesselFront(v: string) {
  if (v === 'cup') {
    const stripes = [70, 90, 110, 130].map((x) => `<path d="M${x} 182L${x - (x - 100) * 0.16} 288" stroke="${yellow}" stroke-width="7"/>`).join('');
    return `<path d="M44 178H156L143 290H57Z" fill="${cream}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>${stripes}<rect x="38" y="170" width="124" height="14" rx="7" fill="${yellow}" stroke="${ink}" stroke-width="3"/>`;
  }
  const sugar = v === 'sugar';
  const fill = sugar ? '#ebc583' : '#d8964b';
  const body = `<path d="M36 172H164L100 294Z" fill="${fill}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
  const texture = sugar
    ? `<path d="${[190, 210, 230, 250, 270].map((y) => { const half = 64 * (294 - y) / 122; return `M${(100 - half + 4).toFixed(1)} ${y}H${(100 + half - 4).toFixed(1)}`; }).join('')}" stroke="${shade(fill, -0.18)}" stroke-width="3" stroke-linecap="round"/>`
    : waffleLines(shade(fill, -0.22));
  const rim = `<rect x="30" y="164" width="140" height="16" rx="8" fill="${shade(fill, 0.12)}" stroke="${ink}" stroke-width="3"/>`;
  const dip = v === 'dipped' ? `<path d="M30 168h140v14c0 6-6 8-10 4-4 10-12 10-14 0-6 14-16 12-18 0-8 8-16 6-18-2-6 18-18 18-20 0-8 6-14 4-16-4-6 10-14 10-16 0-6 6-14 4-14-4-6 6-14 4-14-8z" fill="#3a2220" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M44 172h40" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>` : '';
  return body + texture + rim + dip;
}

/** A cone (or cup) with up to three scoops, bottom flavor first. */
export function coneSvg(ids: string[], vessel: string, label: string, fit = true) {
  const n = Math.max(1, ids.length);
  const top = fit ? -(66 * (n - 1)) + (ids.length ? 0 : 60) : -136;
  const base = vessel === 'cup' ? 92 : 66;
  const scoops = ids.map((id, i) => {
    const s = 1 - i * 0.06;
    return scoopG(flavorById[id].look, `${id}-${i}`, { x: 100 - 100 * s, y: base - 66 * i, s });
  }).join('');
  const empty = ids.length ? '' : `<path d="M58 150c10-34 74-34 84 0" fill="none" stroke="${ink}" stroke-opacity=".3" stroke-width="3" stroke-dasharray="6 7" stroke-linecap="round"/>`;
  const body = vessel === 'cup' ? vesselBack(vessel) + scoops + empty + vesselFront(vessel) : vesselFront(vessel) + scoops + empty;
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg viewBox="0 ${top} 200 ${300 - top}" ${a11y}>${body}</svg>`;
}

/* ---------- the road sign ---------- */

/** The diamond sign: a cone riding over a bump, with a "SCOOP AHEAD" plaque under it like a real road sign. */
export function signG(x: number, y: number, s: number, words = true) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    ${words ? `<rect x="-78" y="106" width="156" height="34" rx="6" fill="${yellow}" stroke="${ink}" stroke-width="6"/><text x="0" y="129" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="16" letter-spacing="1.2" fill="${ink}">SCOOP AHEAD</text>` : ''}
    <rect x="-70" y="-70" width="140" height="140" rx="16" transform="rotate(45)" fill="${yellow}" stroke="${ink}" stroke-width="8"/>
    <rect x="-60" y="-60" width="120" height="120" rx="11" transform="rotate(45)" fill="none" stroke="${ink}" stroke-width="3"/>
    <path d="M-54 30C-32 30-22 6 0 6S32 30 54 30" fill="none" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
    <path d="M-12-20H12L0 4Z" fill="${ink}"/><circle cx="0" cy="-30" r="14" fill="${ink}"/>
  </g>`;
}
export const markSvg = () => `<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">${signG(0, 0, 1, false)}</svg>`;
