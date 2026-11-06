// Personal best and settings, kept in this browser only. Storage can be
// unavailable (private mode, blocked site data); the game then still works,
// it just doesn't remember.
export interface Best { score: number; time: number }
export interface Settings { music: boolean; sfx: boolean; shake: boolean }
interface Saved { best: Best | null; settings: Settings }

const KEY = 'patch-quest-v1';

export function load(reducedMotion: boolean): Saved {
  const fallback: Saved = { best: null, settings: { music: true, sfx: true, shake: !reducedMotion } };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    const best = raw.best && Number.isFinite(raw.best.score) && Number.isFinite(raw.best.time) ? { score: raw.best.score, time: raw.best.time } : null;
    const st = raw.settings ?? {};
    return { best, settings: { music: st.music !== false, sfx: st.sfx !== false, shake: typeof st.shake === 'boolean' ? st.shake : fallback.settings.shake } };
  } catch { return fallback; }
}

export function save(s: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

/** Records a finished run. Returns which records it beat. */
export function record(s: Saved, score: number, time: number) {
  const newScore = !s.best || score > s.best.score;
  const newTime = !s.best || time < s.best.time;
  s.best = { score: Math.max(score, s.best?.score ?? 0), time: Math.min(time, s.best?.time ?? Infinity) };
  save(s);
  return { newScore, newTime };
}
