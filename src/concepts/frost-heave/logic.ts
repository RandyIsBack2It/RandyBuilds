// Frost Heave Creamery: the rules behind the page, DOM-free so
// `node tests/frost-heave.mjs` can check them: hours by season, today's
// status and which flavors are in the case. All of it is sample data for a
// fictional shop (see data.ts).
import { flavors, seasons, closures, dayNames, type Flavor, type Season, type Week } from './data';

/** What the owner changes from day to day (owner panel). Kept in the browser in this demo. */
export interface Overrides {
  /** Flavors sold out today. */
  soldOut: string[];
  /** A notice across the top of the site, until the end of `until` (YYYY-MM-DD). */
  notice: { text: string; until: string } | null;
}
export const emptyOverrides = (): Overrides => ({ soldOut: [], notice: null });

/* ---------- dates ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const mmdd = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (d: Date, n = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const minsOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
/** In an MM-DD range, inclusive. Ranges may wrap the new year (11-01 to 03-31). */
export const inRange = (md: string, from: string, to: string) => (from <= to ? md >= from && md <= to : md >= from || md <= to);

export const clock = (m: number) => {
  const hh = Math.floor(m / 60), mm = m % 60;
  return `${((hh + 11) % 12) + 1}${mm ? ':' + pad(mm) : ''} ${hh < 12 || hh === 24 ? 'am' : 'pm'}`;
};
export const span = (r: [number, number]) => `${clock(r[0])} – ${clock(r[1])}`;

/* ---------- hours ---------- */

export function seasonFor(d: Date): Season {
  const md = mmdd(d);
  return seasons.find((s) => inRange(md, s.from, s.to)) ?? seasons[seasons.length - 1];
}

/** Opening hours on a date, after one-off closures. */
export function hoursOn(d: Date): { hours: [number, number] | null; season: Season; reason?: string } {
  const season = seasonFor(d);
  const k = dateKey(d);
  const c = closures.find((x) => x.date === k);
  if (c) return { hours: null, season, reason: `Closed for ${c.label}` };
  return { hours: season.week[d.getDay()], season };
}

export interface Status { open: boolean; text: string; detail: string }
const weekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });

/** "Open until 8 pm" / "Closed · opens Wednesday at 1 pm". */
export function statusAt(now: Date): Status {
  const today = hoursOn(now);
  const m = minsOf(now);
  if (today.hours && m >= today.hours[0] && m < today.hours[1]) {
    return { open: true, text: `Open until ${clock(today.hours[1])}`, detail: today.reason ?? today.season.label };
  }
  for (let i = 0; i < 21; i++) {
    const d = day(now, i);
    const hrs = hoursOn(d).hours;
    if (!hrs || (i === 0 && m >= hrs[0])) continue;
    const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : weekday(d);
    return { open: false, text: `Closed · opens ${when} at ${clock(hrs[0])}`, detail: today.reason ?? today.season.label };
  }
  return { open: false, text: 'Closed for now', detail: today.season.label };
}

/** A week of hours as short lines, runs of days with the same hours together: "Wed – Fri: 1 – 8 pm". Monday first. */
export function weekLines(week: Week) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const same = (a: Week[number], b: Week[number]) => (a && b ? a[0] === b[0] && a[1] === b[1] : a === b);
  const short = (d: number) => dayNames[d].slice(0, 3);
  const out: { days: string; hours: string }[] = [];
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && same(week[order[j + 1]], week[order[i]])) j++;
    const days = i === 0 && j === order.length - 1 ? 'Every day' : i === j ? short(order[i]) : `${short(order[i])} – ${short(order[j])}`;
    const h = week[order[i]];
    out.push({ days, hours: h ? span(h) : 'Closed' });
    i = j + 1;
  }
  return out;
}

/* ---------- flavors ---------- */

export type FlavorState = 'case' | 'out' | 'rotating';
export const monthName = (m: number) => new Date(2026, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });

/** Whether a seasonal flavor is in season this month. Classics always are. */
export const inSeason = (f: Flavor, d: Date) => !f.months || f.months.includes(d.getMonth() + 1);

/** The month a seasonal flavor comes back (null if it's in season or not seasonal). */
export function backIn(f: Flavor, d: Date) {
  if (!f.months || inSeason(f, d)) return null;
  for (let i = 1; i <= 12; i++) {
    const m = ((d.getMonth() + i) % 12) + 1;
    if (f.months.includes(m)) return m;
  }
  return null;
}

export function flavorState(f: Flavor, d: Date, ov: Overrides): FlavorState {
  if (!inSeason(f, d)) return 'rotating';
  if (ov.soldOut.includes(f.id)) return 'out';
  return 'case';
}
export const inCase = (d: Date, ov: Overrides) => flavors.filter((f) => flavorState(f, d, ov) === 'case');

/** "September – November" for a seasonal flavor (months listed in order, so a winter one can wrap the new year). */
export const monthsLabel = (f: Flavor) => (!f.months ? '' : f.months.length === 1 ? monthName(f.months[0]) : `${monthName(f.months[0])} – ${monthName(f.months[f.months.length - 1])}`);
