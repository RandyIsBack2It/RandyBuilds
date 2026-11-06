// Reports for Tidewater Mechanical Ops. Every figure on the Reports view is a
// sum over one sample ledger of completed jobs, so the KPIs, the revenue
// chart, the job mix and the technician table always agree. Each day's jobs
// come from a seed for that date: a day looks the same in every date range.
// DOM-free (tested by `node tests/tidewater.mjs`).
import { rng } from '../shared';
import { techs, type JobType } from './data';

export type Range = 30 | 90 | 365;
export const ranges: [Range, string][] = [[30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']];
export const typeOrder: JobType[] = ['maint', 'repair', 'emergency', 'install', 'estimate'];

export interface Done { date: Date; tech: string; type: JobType; revenue: number; callback: boolean; won: boolean }

const typeWeight: Record<JobType, number> = { maint: 0.4, repair: 0.29, emergency: 0.06, install: 0.07, estimate: 0.18 };
const techWeight: Record<string, number> = { mb: 1.25, ao: 1.1, jw: 1, pk: 1.05, dl: 0.7, sc: 0.95 };
const callbackRate: Record<string, number> = { mb: 0.012, ao: 0.02, jw: 0.025, pk: 0.015, dl: 0.035, sc: 0.02 };
/** Estimate visits are free: they count as completed jobs with $0 revenue. */
const price: Record<JobType, (r: () => number) => number> = {
  maint: (r) => 189 + 25 * Math.floor(r() * 4),
  repair: (r) => 180 + 5 * Math.round(r() * 150),
  emergency: (r) => 420 + 5 * Math.round(r() * 160),
  install: (r) => 2450 + 50 * Math.round(r() * 200),
  estimate: () => 0,
};

function weighted<T extends string>(w: Record<T, number>, keys: T[], r: () => number): T {
  let x = r() * keys.reduce((s, k) => s + w[k], 0);
  for (const k of keys) if ((x -= w[k]) < 0) return k;
  return keys[keys.length - 1];
}

const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The completed jobs of one calendar day. */
export function jobsOn(date: Date): Done[] {
  const d = dayOf(date);
  const r = rng(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate());
  const doy = (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5;
  const season = 1 + 0.3 * Math.cos(((doy - 20) / 365) * 2 * Math.PI); // busiest in midwinter
  const dow = d.getDay();
  const n = dow === 0 ? 0 : Math.round((dow === 6 ? 3 : 9) * season * (0.8 + r() * 0.4));
  return Array.from({ length: n }, () => {
    const type = weighted(typeWeight, typeOrder, r);
    // The apprentice only takes maintenance visits.
    const tech = weighted(techWeight, techs.map((t) => t.id).filter((id) => type === 'maint' || id !== 'dl'), r);
    return { date: d, tech, type, revenue: price[type](r), callback: type !== 'estimate' && r() < callbackRate[tech], won: type === 'estimate' && r() < 0.52 };
  });
}

export function ledger(from: Date, to: Date): Done[] {
  const out: Done[] = [];
  for (let d = dayOf(from); d <= to; d = addDays(d, 1)) out.push(...jobsOn(d));
  return out;
}

export interface Bucket { label: string; span: string; revenue: number; jobs: number }
export interface Totals { revenue: number; jobs: number; estimates: number; won: number }
export interface Report {
  range: Range; unit: 'day' | 'week' | 'month'; from: Date; to: Date;
  buckets: Bucket[]; totals: Totals; prev: Totals;
  mix: { type: JobType; n: number }[];
  techs: { id: string; revenue: number; jobs: number; callbacks: number }[];
}

const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const totals = (list: Done[]): Totals => ({
  revenue: list.reduce((s, j) => s + j.revenue, 0),
  jobs: list.length,
  estimates: list.filter((j) => j.type === 'estimate').length,
  won: list.filter((j) => j.won).length,
});

/** Period boundaries: N days ending today, or the last 12 calendar months (this one to date). */
function period(range: Range, today: Date) {
  const to = dayOf(today);
  if (range === 365) {
    const from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
    return { from, to, prevFrom: new Date(from.getFullYear() - 1, from.getMonth(), 1), prevTo: addDays(from, -1) };
  }
  const from = addDays(to, 1 - range);
  return { from, to, prevFrom: addDays(from, -range), prevTo: addDays(from, -1) };
}

export function report(range: Range, today = new Date()): Report {
  const { from, to, prevFrom, prevTo } = period(range, today);
  const list = ledger(from, to);
  const unit = range === 365 ? 'month' : range === 90 ? 'week' : 'day';
  // Bucket edges: each day, 7-day weeks counted back from today, or calendar months.
  const starts: Date[] = [];
  if (unit === 'month') for (let i = 0; i < 12; i++) starts.push(new Date(from.getFullYear(), from.getMonth() + i, 1));
  else { const step = unit === 'week' ? 7 : 1; for (let d = addDays(to, 1 - step); d > addDays(from, -step); d = addDays(d, -step)) starts.unshift(d < from ? from : d); }
  const buckets = starts.map((s, i) => {
    const end = i + 1 < starts.length ? addDays(starts[i + 1], -1) : to;
    const inside = list.filter((j) => j.date >= s && j.date <= end);
    const label = unit === 'month' ? s.toLocaleDateString('en-US', { month: 'short' }) : short(s);
    const span = unit === 'day' ? short(s) : unit === 'month' && end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() ? s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${short(s)}–${short(end)}`;
    return { label, span, ...totals(inside) };
  });
  return {
    range, unit, from, to, buckets, totals: totals(list), prev: totals(ledger(prevFrom, prevTo)),
    mix: typeOrder.map((type) => ({ type, n: list.filter((j) => j.type === type).length })),
    techs: techs.map((t) => {
      const mine = list.filter((j) => j.tech === t.id);
      return { id: t.id, revenue: mine.reduce((s, j) => s + j.revenue, 0), jobs: mine.length, callbacks: mine.filter((j) => j.callback).length };
    }).sort((a, b) => b.revenue - a.revenue),
  };
}
