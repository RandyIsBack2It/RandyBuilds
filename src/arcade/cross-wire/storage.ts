// CROSS//WIRE saves: everything stays in this browser (localStorage). A broken
// or missing save starts fresh; nothing is ever sent anywhere.
import type { SolveSave } from './solve';

export interface Record_ {
  /** Best times in ms: any solve, and solves without hints. */
  best?: number;
  bestClean?: number;
  bestScore?: number;
  solves: number;
}

export interface Settings { sound: boolean; music: boolean; feedback: boolean; timer: boolean }

export interface Save {
  v: 1;
  settings: Settings;
  /** In-progress or finished solves of library and campaign puzzles, by puzzle id. */
  solves: Record<string, SolveSave>;
  /** Daily solves by day number. */
  daily: Record<string, SolveSave & { id: string }>;
  records: Record<string, Record_>;
  /** Campaign sectors whose restoration has been shown. */
  seen: string[];
}

export const KEY = 'cross-wire-v1';
export const defaults = (): Save => ({ v: 1, settings: { sound: true, music: false, feedback: true, timer: true }, solves: {}, daily: {}, records: {}, seen: [] });

const isSolve = (x: unknown): x is SolveSave => {
  const s = x as SolveSave;
  return !!s && typeof s.fill === 'string' && typeof s.revealed === 'string' && typeof s.hints === 'number' && typeof s.ms === 'number' && typeof s.done === 'boolean';
};
const obj = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

/** Parses a stored save, keeping whatever parts are sound. */
export function parseSave(raw: string | null): Save {
  const out = defaults();
  if (!raw) return out;
  let data: Record<string, unknown>;
  try { data = obj(JSON.parse(raw)); } catch { return out; }
  if (data.v !== 1) return out;
  const st = obj(data.settings);
  for (const k of Object.keys(out.settings) as (keyof Settings)[]) if (typeof st[k] === 'boolean') out.settings[k] = st[k] as boolean;
  for (const [k, v] of Object.entries(obj(data.solves))) if (isSolve(v)) out.solves[k] = v;
  for (const [k, v] of Object.entries(obj(data.daily))) if (isSolve(v) && typeof (v as { id?: unknown }).id === 'string') out.daily[k] = v as SolveSave & { id: string };
  for (const [k, v] of Object.entries(obj(data.records))) {
    const r = obj(v);
    if (typeof r.solves !== 'number') continue;
    const rec: Record_ = { solves: r.solves };
    for (const f of ['best', 'bestClean', 'bestScore'] as const) if (typeof r[f] === 'number') rec[f] = r[f] as number;
    out.records[k] = rec;
  }
  if (Array.isArray(data.seen)) out.seen = data.seen.filter((x): x is string => typeof x === 'string');
  return out;
}

export class Store {
  data: Save;
  ok = true;
  constructor(private ls: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocal()) {
    let raw: string | null = null;
    try { raw = this.ls?.getItem(KEY) ?? null; } catch { this.ok = false; }
    if (!this.ls) this.ok = false;
    this.data = parseSave(raw);
  }
  write() {
    try { this.ls?.setItem(KEY, JSON.stringify(this.data)); } catch { this.ok = false; }
  }
  /** Records a finished solve; returns which records it beat. */
  finish(id: string, ms: number, hints: number, points: number) {
    const r = this.data.records[id] ?? { solves: 0 };
    const beat = { best: r.best === undefined || ms < r.best, clean: hints === 0 && (r.bestClean === undefined || ms < r.bestClean), score: r.bestScore === undefined || points > r.bestScore };
    r.solves++;
    if (beat.best) r.best = ms;
    if (beat.clean) r.bestClean = ms;
    if (beat.score) r.bestScore = points;
    this.data.records[id] = r;
    this.write();
    return beat;
  }
  reset() {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    try { this.ls?.removeItem(KEY); } catch { /* fine */ }
    this.write();
  }
}

function safeLocal() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
