// Daily Circuit: one puzzle per calendar day (UTC), the same for everyone.
// Day 1 is 2026-10-19. Day n uses DAILY_ORDER[(n - 1) % length], so the Daily
// cycles through the collection; it is not a new puzzle every day.
// Adding puzzles: append their ids to DAILY_ORDER. While the list is longer
// than the current day number, appending never changes today or past days.
import { byId } from './puzzles';

export const DAILY_START = Date.UTC(2026, 9, 19);
const DAY = 86_400_000;

export const DAILY_ORDER: string[] = [
  'm-alarm', 's1-startup', 'm-screen', 's2-claims', 'm-pet', 's1-panel', 'm-apple', 's3-weather',
  'm-early', 's2-signal', 'm-radar', 's1-board', 'm-atlas', 's3-news', 'm-taste', 's2-fact',
  'm-desktop', 's1-sink', 'm-build', 's3-puppy', 'm-shop', 's2-power', 'm-target', 's3-pattern',
];

export interface Daily { n: number; date: string; id: string }

export function dailyNumber(now: number = Date.now()): number {
  return Math.max(1, Math.floor((now - DAILY_START) / DAY) + 1);
}

export function daily(n: number = dailyNumber()): Daily {
  const id = DAILY_ORDER[(n - 1) % DAILY_ORDER.length];
  const date = new Date(DAILY_START + (n - 1) * DAY).toISOString().slice(0, 10);
  return { n, date, id };
}

/** Milliseconds until the next UTC midnight. */
export const msToNextDaily = (now: number = Date.now()) => DAY - ((now - DAILY_START) % DAY + DAY) % DAY;

export const dailyIsValid = () => DAILY_ORDER.every((id) => byId[id]) && new Set(DAILY_ORDER).size === DAILY_ORDER.length;
