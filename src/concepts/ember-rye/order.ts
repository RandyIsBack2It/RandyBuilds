// Ember & Rye pickup orders: prices, totals and pickup times. DOM-free so
// `node tests/ember-rye.mjs` can check that the numbers on screen add up.
// All rules are sample rules for the fictional restaurant (see data.ts).
import { menu, hours, TAX, ORDER_CUTOFF, PICKUP_END, MAX_QTY, prepMinutes, type Item } from './data';

export type Line = { key: string; id: string; qty: number; opts: Record<string, string[]>; note: string };

export const byId = Object.fromEntries(menu.map((i) => [i.id, i])) as Record<string, Item>;

/** Round to whole cents, so every shown amount is exactly what is added up. */
export const cents = (n: number) => Math.round(n * 100) / 100;
export const clampQty = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.round(n) || 1));

export function unitPrice(item: Item, opts: Record<string, string[]>) {
  let p = item.price;
  for (const g of item.options ?? []) for (const c of g.choices) if (opts[g.id]?.includes(c.id)) p += c.price ?? 0;
  return cents(p);
}
export const lineTotal = (l: Line) => cents(unitPrice(byId[l.id], l.opts) * l.qty);

/** Subtotal, sample tax and tip, each rounded to cents; total is their sum. */
export function totals(lines: Line[], tipPct: number) {
  const sub = cents(lines.reduce((s, l) => s + lineTotal(l), 0));
  const tax = cents(sub * TAX);
  const tip = cents((sub * tipPct) / 100);
  return { sub, tax, tip, total: cents(sub + tax + tip), count: lines.reduce((n, l) => n + l.qty, 0) };
}

const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();
const up = (m: number, step: number) => Math.ceil(m / step) * step;

/** Online ordering is open from opening until ORDER_CUTOFF minutes before closing. */
export function orderingOpen(now: Date) {
  const h = hours[now.getDay()];
  return !!h && mins(now) >= h[0] && mins(now) < h[1] - ORDER_CUTOFF;
}

/** Earliest ready time today if ordering is open now, else null. */
export function asapTime(now: Date, items: number) {
  const h = hours[now.getDay()];
  if (!h || !orderingOpen(now)) return null;
  const at = up(mins(now) + prepMinutes(items), 5);
  return at <= h[1] - PICKUP_END ? at : null;
}

/** Scheduled pickup times on the first day that still has any (next 7 days). */
export function pickupSlots(now: Date, items: number) {
  const prep = prepMinutes(items);
  for (let i = 0; i < 7; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const h = hours[day.getDay()];
    if (!h) continue;
    if (i === 0 && mins(now) >= h[1] - ORDER_CUTOFF) continue;
    const from = up(i === 0 ? Math.max(h[0] + prep, mins(now) + prep) : h[0] + prep, 15);
    const slots: number[] = [];
    for (let m = from; m <= h[1] - PICKUP_END; m += 15) slots.push(m);
    if (slots.length) return { day, slots, today: i === 0 };
  }
  return null;
}

/** A US mobile number: ten digits, optionally with a leading 1. */
export const validPhone = (v: string) => /^1?\d{10}$/.test(v.replace(/\D/g, ''));
