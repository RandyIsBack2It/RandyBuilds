// Alder & Pine is a fictional furniture workshop. Prices, lead times and
// delivery fees are sample figures for the concept demo. Janka hardness
// values are the commonly published figures for each species.
import type { Config, Species, Legs, Edge, Finish } from './render';

export const species: { id: Species; name: string; mult: number; janka: number; note: string; weeks: number }[] = [
  { id: 'oak', name: 'White oak', mult: 1, janka: 1360, note: 'Straight grain, warm and hard-wearing. Our most requested.', weeks: 0 },
  { id: 'walnut', name: 'Black walnut', mult: 1.45, janka: 1010, note: 'Deep chocolate tones that lighten slightly with age.', weeks: 1 },
  { id: 'cherry', name: 'Cherry', mult: 1.2, janka: 950, note: 'Starts pale pink, deepens to a rich red-brown in sunlight.', weeks: 0 },
  { id: 'maple', name: 'Hard maple', mult: 0.95, janka: 1450, note: 'Pale, tight grain. The hardest wood we offer.', weeks: 0 },
  { id: 'ash', name: 'Ash', mult: 0.9, janka: 1320, note: 'Bold open grain and a light, Scandinavian feel.', weeks: 0 },
];
export const legs: { id: Legs; name: string; price: number; note: string }[] = [
  { id: 'tapered', name: 'Tapered', price: 0, note: 'Four splayed legs with a slim apron' },
  { id: 'trestle', name: 'Trestle', price: 480, note: 'Two trestles joined by a stretcher; no legs at the corners' },
  { id: 'pedestal', name: 'Pedestal', price: 650, note: 'Columns on wide feet; one under shorter tables' },
  { id: 'hairpin', name: 'Hairpin steel', price: -120, note: 'Powder-coated steel rods' },
];
export const edges: { id: Edge; name: string; price: number }[] = [
  { id: 'square', name: 'Square', price: 0 },
  { id: 'bevel', name: 'Under-bevel', price: 90 },
  { id: 'live', name: 'Live edge', price: 420 },
];
export const finishes: { id: Finish; name: string; price: number; note: string }[] = [
  { id: 'oil', name: 'Hardwax oil', price: 0, note: 'Natural feel, easy to spot-repair' },
  { id: 'matte', name: 'Matte clear', price: 0, note: 'Water-resistant, low sheen' },
  { id: 'white', name: 'Whitewash', price: 120, note: 'Soft Nordic pale tone' },
  { id: 'ebony', name: 'Ebonized', price: 180, note: 'Deep black that keeps the grain' },
];
export const extras = { leaf: 520, bench: 690, brass: 90, thick: 260 };

export const defaultConfig: Config = { length: 84, width: 40, species: 'oak', legs: 'tapered', edge: 'square', thick: 'std', finish: 'oil', metal: 'black', leaf: false, bench: false, chairs: true };

export function price(c: Config) {
  const sp = species.find((s) => s.id === c.species)!;
  const top = Math.round((900 + c.length * c.width * 0.42) * sp.mult / 10) * 10;
  const rows: [string, number][] = [[`${sp.name} top, ${c.length}″ × ${c.width}″`, top]];
  const lg = legs.find((l) => l.id === c.legs)!;
  rows.push([`${lg.name} base`, lg.price]);
  if (c.legs === 'hairpin' && c.metal === 'brass') rows.push(['Brass-tone steel', extras.brass]);
  const ed = edges.find((e) => e.id === c.edge)!;
  if (ed.price) rows.push([`${ed.name}`, ed.price]);
  if (c.thick === 'thick') rows.push(['1¾″ thick top', extras.thick]);
  const fi = finishes.find((f) => f.id === c.finish)!;
  rows.push([fi.name, fi.price]);
  if (c.leaf) rows.push(['18″ extension leaf', extras.leaf]);
  if (c.bench) rows.push(['Matching bench', extras.bench]);
  return { rows, total: rows.reduce((s, r) => s + r[1], 0) };
}

export function leadWeeks(c: Config) {
  const sp = species.find((s) => s.id === c.species)!;
  return 7 + sp.weeks + (c.edge === 'live' ? 2 : 0) + (c.legs === 'pedestal' ? 1 : 0);
}

/** Delivery by ZIP: sample zones from the workshop in New England. */
export function delivery(zip: string) {
  if (!/^\d{5}$/.test(zip)) return null;
  const p = zip.slice(0, 3);
  if (['039', '040', '041', '042', '043', '044', '045', '046', '047', '048', '049', '038', '030', '031', '032', '033', '034', '035', '036', '037'].includes(p)) return { zone: 'Local white-glove', fee: 149, extra: 0, note: 'Our own team delivers, assembles and takes the packaging.' };
  if (zip[0] === '0') return { zone: 'New England white-glove', fee: 249, extra: 0, note: 'Our team, on a scheduled regional run.' };
  if ('12'.includes(zip[0])) return { zone: 'Northeast freight', fee: 389, extra: 1, note: 'Blanket-wrapped freight with room-of-choice delivery.' };
  return { zone: 'National freight', fee: 549, extra: 2, note: 'Crated freight with room-of-choice delivery and assembly.' };
}

export const DEPOSIT_SHARE = 0.5;

/** Table price plus sample delivery for a ZIP, with the deposit and balance in whole dollars. */
export function quote(c: Config, zip = '') {
  const p = price(c);
  const d = delivery(zip);
  const grand = p.total + (d?.fee ?? 0);
  const deposit = Math.round(grand * DEPOSIT_SHARE);
  return { ...p, delivery: d, grand, deposit, balance: grand - deposit };
}

/** Sample build-slot start dates: Mondays at least a week out, two weeks apart. */
export function buildSlots(now: Date) {
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  first.setDate(first.getDate() + ((8 - first.getDay()) % 7));
  return [0, 14, 28].map((n) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + n));
}

/** A slot's local calendar date as YYYY-MM-DD (no time zone shift). */
export const slotKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The chosen slot if it is still offered, else the next offered slot after it, else the first. */
export function pickSlot(slots: Date[], key = '') {
  return slots.find((s) => slotKey(s) === key) ?? slots.find((s) => slotKey(s) > key) ?? slots[0];
}

/** Estimated arrival window: build weeks plus any delivery weeks, then a two-week window. */
export function arrival(start: Date, c: Config, extraWeeks = 0) {
  const w = leadWeeks(c) + extraWeeks;
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
  return [from, new Date(from.getFullYear(), from.getMonth(), from.getDate() + 14)] as const;
}

/** Compact, URL-safe encoding of a design for share links. */
const keys: (keyof Config)[] = ['length', 'width', 'species', 'legs', 'edge', 'thick', 'finish', 'metal', 'leaf', 'bench', 'chairs'];
export function encode(c: Config) { return keys.map((k) => (typeof c[k] === 'boolean' ? (c[k] ? '1' : '0') : String(c[k]))).join('.'); }
export function decode(s: string): Config | null {
  const p = s.split('.');
  if (p.length !== keys.length) return null;
  const c = { ...defaultConfig } as Record<string, unknown>;
  keys.forEach((k, i) => { c[k] = typeof defaultConfig[k] === 'boolean' ? p[i] === '1' : typeof defaultConfig[k] === 'number' ? Number(p[i]) : p[i]; });
  const cc = c as unknown as Config;
  const ok = cc.length >= 60 && cc.length <= 108 && cc.length % 6 === 0 && cc.width >= 34 && cc.width <= 46 && cc.width % 2 === 0 && ['std', 'thick'].includes(cc.thick) && ['black', 'brass'].includes(cc.metal) && species.some((x) => x.id === cc.species) && legs.some((x) => x.id === cc.legs) && edges.some((x) => x.id === cc.edge) && finishes.some((x) => x.id === cc.finish);
  return ok ? cc : null;
}
