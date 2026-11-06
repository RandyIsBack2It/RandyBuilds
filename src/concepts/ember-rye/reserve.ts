// Ember & Rye reservations: seatings, capacity and availability. DOM-free so
// `node tests/ember-rye.mjs` can check the rules. Guests choose a party size,
// a date and a time; the restaurant assigns tables itself, so availability is
// a capacity check per seating (see data.ts). Existing bookings are sample
// data; the visitor's own demo bookings are added on top, so a seating fills
// up and the same capacity can't be booked twice.
import { rng, daySeed } from '../shared';
import { hours, MAX_PARTY, SEATING_STEP, SEATING_COVERS, LARGE_PARTY, LARGE_PER_SEATING, BOOKING_DAYS, BOOKING_LEAD } from './data';

/** A demo booking made in this browser. No name or contact details. */
export type Booking = { date: string; time: number; party: number; ref: string };
export type DayState = 'open' | 'full' | 'closed' | 'past' | 'beyond';
export type SlotState = 'open' | 'full' | 'past';

export const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();
const daysBetween = (a: Date, b: Date) => Math.round((startOf(b).getTime() - startOf(a).getTime()) / 864e5);

/** Dinner seatings for a day, in minutes since midnight. */
export function seatings(day: Date) {
  const h = hours[day.getDay()];
  if (!h) return [];
  const out: number[] = [];
  for (let m = Math.max(h[0], 17 * 60); m <= h[1] - 90; m += SEATING_STEP) out.push(m);
  return out;
}

/** Sample bookings already taken at a seating: stable for a given date and time. */
export function sampleLoad(day: Date, time: number) {
  const r = rng(daySeed(day) * 31 + time * 7);
  const weekend = [5, 6].includes(day.getDay());
  const peak = time >= 18 * 60 && time <= 19 * 60 + 30;
  const share = Math.min(1, 0.2 + r() * 0.45 + (weekend ? 0.2 : 0) + (peak ? 0.2 : 0));
  const large = Math.min(LARGE_PER_SEATING, Math.floor(r() * (weekend || peak ? 3 : 1.6)));
  return { covers: Math.round(SEATING_COVERS * share), large };
}

function load(day: Date, time: number, mine: Booking[]) {
  const l = sampleLoad(day, time);
  for (const b of mine) if (b.date === dateKey(day) && b.time === time) { l.covers += b.party; if (b.party >= LARGE_PARTY) l.large++; }
  return l;
}

export function slotState(day: Date, time: number, party: number, now: Date, mine: Booking[]): SlotState {
  if (daysBetween(now, day) < 0 || (daysBetween(now, day) === 0 && time < mins(now) + BOOKING_LEAD)) return 'past';
  const l = load(day, time, mine);
  if (l.covers + party > SEATING_COVERS) return 'full';
  if (party >= LARGE_PARTY && l.large >= LARGE_PER_SEATING) return 'full';
  return 'open';
}

export function dayState(day: Date, party: number, now: Date, mine: Booking[]): DayState {
  const n = daysBetween(now, day);
  if (n < 0) return 'past';
  if (n >= BOOKING_DAYS) return 'beyond';
  const s = seatings(day);
  if (!s.length) return 'closed';
  const states = s.map((t) => slotState(day, t, party, now, mine));
  if (states.includes('open')) return 'open';
  return states.every((x) => x === 'past') ? 'past' : 'full';
}

/** The first bookable day from `from` (inclusive) within the booking window. */
export function nextOpenDay(from: Date, party: number, now: Date, mine: Booking[]) {
  for (let i = Math.max(0, daysBetween(now, from)); i < BOOKING_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (dayState(d, party, now, mine) === 'open') return d;
  }
  return null;
}

/** Why a booking can't be made, or null if it can. Checked again on submit. */
export function bookingProblem(day: Date | null, time: number | null, party: number, now: Date, mine: Booking[]) {
  if (party < 1 || party > MAX_PARTY) return `We book parties of 1 to ${MAX_PARTY} online.`;
  if (!day) return 'Choose a date.';
  const ds = dayState(day, party, now, mine);
  if (ds === 'closed') return 'We’re closed that day. Choose another date.';
  if (ds === 'past') return 'That date has passed. Choose another date.';
  if (ds === 'beyond') return `We take reservations up to ${BOOKING_DAYS} days ahead.`;
  const dup = mine.find((b) => b.date === dateKey(day));
  if (dup) return 'You already have a demo reservation that night. Cancel it first to choose a different time.';
  if (time === null) return 'Choose a time.';
  const ss = slotState(day, time, party, now, mine);
  if (ss === 'past') return 'That time is too soon to book online. Choose a later time.';
  if (ss === 'full') return `That time is now full for ${party}. Choose another time.`;
  return null;
}
