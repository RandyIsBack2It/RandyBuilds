// Ember & Rye pickup orders and reservations (src/concepts/ember-rye/order.ts,
// reserve.ts). No browser. Totals must add up to the cent, pickup times must
// respect the sample ordering hours and prep time, and reservations must never
// book more than a seating holds.
//   node tests/ember-rye.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const o = await loadTsTree(path.join(root, 'src/concepts/ember-rye/order.ts'));
const d = await loadTsTree(path.join(root, 'src/concepts/ember-rye/data.ts'));
const r = await loadTsTree(path.join(root, 'src/concepts/ember-rye/reserve.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const c = (n) => Math.round(n * 100);

// Menu data
expect(d.menu.every((i) => Array.isArray(i.contains)), 'every dish has a sample allergen list');
expect(d.menu.every((i) => d.categories.some((k) => k.id === i.cat)), 'every dish is in a category');
expect(d.menu.filter((i) => i.dineIn).every((i) => !i.options), 'dine-in-only dishes have no order options');
expect(d.menu.filter((i) => i.tags.includes('vg')).every((i) => !i.contains.some((a) => ['dairy', 'egg', 'fish', 'shellfish'].includes(a))), 'vegan dishes list no animal allergens');
expect(d.menu.filter((i) => i.tags.includes('gf')).every((i) => !i.contains.includes('gluten')), 'gluten-free dishes do not list gluten');

// Totals add up to the cent for many carts and tips.
const ids = d.menu.filter((i) => !i.dineIn).map((i) => i.id);
let ok = true;
for (let n = 0; n < 500; n++) {
  const lines = Array.from({ length: 1 + (n % 6) }, (_, k) => {
    const item = o.byId[ids[(n * 7 + k * 3) % ids.length]];
    const opts = {};
    for (const g of item.options ?? []) opts[g.id] = g.type === 'one' ? [g.choices[(n + k) % g.choices.length].id] : g.choices.slice(0, (n + k) % 3).map((x) => x.id);
    return { key: `${n}-${k}`, id: item.id, qty: 1 + ((n + k) % 4), opts, note: '' };
  });
  for (const tip of d.TIPS) {
    const t = o.totals(lines, tip);
    const lineSum = lines.reduce((s, l) => s + c(o.lineTotal(l)), 0);
    if (c(t.sub) !== lineSum || c(t.total) !== c(t.sub) + c(t.tax) + c(t.tip) || c(t.tax) !== Math.round(c(t.sub) * d.TAX)) { ok = false; console.log('   ', JSON.stringify({ t, lineSum })); }
  }
}
expect(ok, 'subtotal = line totals and total = subtotal + tax + tip, to the cent (500 carts × 4 tips)');
const egg = { key: 'a', id: 'margherita', qty: 3, opts: { crust: ['gf'], add: ['egg', 'chili'] }, note: '' };
expect(o.lineTotal(egg) === 75, 'Margherita, gluten-free base, egg and hot honey, × 3 = $75.00');
expect(o.clampQty(0) === 1 && o.clampQty(99) === d.MAX_QTY, 'quantities stay between 1 and the per-item limit');

// Pickup times (the sample week: Sunday 4–9 pm, Monday closed, Tue–Thu 4–10, Fri 4–11, Sat noon–11).
const at = (y, m, day, h, min = 0) => new Date(y, m, day, h, min);
const tue = (h, min) => at(2026, 9, 27, h, min); // Tuesday 27 October 2026
expect(!o.orderingOpen(tue(15, 0)) && o.orderingOpen(tue(16, 0)) && o.orderingOpen(tue(21, 29)) && !o.orderingOpen(tue(21, 30)), 'online ordering runs from opening to 30 minutes before closing');
expect(o.asapTime(tue(18, 2), 2) === 18 * 60 + 25, '6:02 pm, two items: ready about 6:25 pm');
expect(o.asapTime(tue(18, 0), 12) === 18 * 60 + 40, 'a large order takes longer');
expect(o.asapTime(tue(15, 0), 2) === null, 'no “as soon as possible” before opening');
const before = o.pickupSlots(tue(15, 0), 2);
expect(before.today && before.slots[0] === 16 * 60 + 30 && before.slots.at(-1) === 22 * 60 - 15, 'before opening: today, 4:30 pm to 9:45 pm');
const late = o.pickupSlots(tue(21, 40), 2);
expect(!late.today && late.day.getDay() === 3, 'after the cutoff: the next open day');
const sun = o.pickupSlots(at(2026, 9, 25, 21, 0), 1);
expect(sun.day.getDay() === 2, 'Sunday night skips closed Monday to Tuesday');
for (const [label, now] of [['Tuesday 6 pm', tue(18, 0)], ['Saturday 11 am', at(2026, 9, 31, 11, 0)], ['Monday', at(2026, 9, 26, 12, 0)]]) {
  const s = o.pickupSlots(now, 3);
  const h = d.hours[s.day.getDay()];
  expect(s.slots.every((m) => m % 15 === 0 && m >= h[0] + d.prepMinutes(3) && m <= h[1] - d.PICKUP_END), `${label}: every pickup slot fits the day’s hours`);
}

// Phone numbers
expect(o.validPhone('(207) 555-0100') && o.validPhone('1 207 555 0100') && !o.validPhone('555-0100') && !o.validPhone(''), 'mobile numbers need ten digits');

// Reservations: seatings and capacity.
const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
expect(r.seatings(tue(0, 0)).map(hm).join(' ') === '17:00 17:30 18:00 18:30 19:00 19:30 20:00 20:30', 'Tuesday seatings: 5 pm to 8:30 pm, every half hour');
expect(r.seatings(at(2026, 9, 26, 0)).length === 0 && r.seatings(at(2026, 9, 25, 0)).at(-1) === 19 * 60 + 30, 'closed Monday; Sunday’s last seating is 7:30 pm');
let loadsOk = true;
for (let i = 0; i < 60; i++) for (const t of r.seatings(at(2026, 9, 24 + i, 0))) { const l = r.sampleLoad(at(2026, 9, 24 + i, 0), t); if (l.covers < 0 || l.covers > d.SEATING_COVERS || l.large > d.LARGE_PER_SEATING) loadsOk = false; }
expect(loadsOk, 'sample bookings never exceed a seating’s capacity');
const now = tue(12, 0);
const fri = at(2026, 9, 30, 0);
let someFull = false, someOpen = false;
for (const t of r.seatings(fri)) { const st = r.slotState(fri, t, 2, now, []); someFull ||= st === 'full'; someOpen ||= st === 'open'; }
expect(someFull && someOpen, 'a Friday has both open and full times for two');
expect(r.slotState(tue(0, 0), 17 * 60 + 30, 2, tue(16, 45), []) === 'past' && r.slotState(tue(0, 0), 18 * 60, 2, tue(16, 45), []) !== 'past', 'same-day bookings close an hour before the seating');

// Filling a seating: bookings use up capacity and can't overbook it.
const slot = r.seatings(tue(0, 0)).find((t) => r.slotState(tue(0, 0), t, 2, now, []) === 'open');
const room = d.SEATING_COVERS - r.sampleLoad(tue(0, 0), slot).covers;
const mine = [];
while (r.slotState(tue(0, 0), slot, 2, now, mine) === 'open') mine.push({ date: r.dateKey(tue(0, 0)), time: slot, party: 2, ref: `T${mine.length}` });
expect(mine.length === Math.floor(room / 2), `a seating with room for ${room} takes exactly ${Math.floor(room / 2)} parties of two, then shows full`);
expect(r.bookingProblem(tue(0, 0), slot, 2, now, mine.slice(0, 1))?.includes('already have'), 'one demo reservation per night');
const big = [];
const bigDay = at(2026, 9, 28, 0);
const bigSlot = r.seatings(bigDay).find((t) => r.slotState(bigDay, t, 6, now, []) === 'open');
while (r.slotState(bigDay, bigSlot, 6, now, big) === 'open') big.push({ date: r.dateKey(bigDay), time: bigSlot, party: 6, ref: `B${big.length}` });
expect(r.sampleLoad(bigDay, bigSlot).large + big.length <= d.LARGE_PER_SEATING, 'large parties are limited per seating');

// Days and the booking window.
expect(r.dayState(at(2026, 9, 26, 0), 2, now, []) === 'past' && r.dayState(at(2026, 9, 26 + 1, 0), 2, now, []) !== 'past', 'past dates can’t be booked');
expect(r.dayState(at(2026, 10, 2, 0), 2, now, []) === 'closed', 'Mondays are closed');
expect(r.dayState(at(2026, 9, 27 + d.BOOKING_DAYS, 0), 2, now, []) === 'beyond', `bookings open ${d.BOOKING_DAYS} days ahead`);
expect(r.nextOpenDay(at(2026, 10, 2, 0), 2, now, []).getDay() !== 1, 'next available skips a closed Monday');
expect(r.bookingProblem(null, null, 2, now, []) === 'Choose a date.' && r.bookingProblem(tue(0, 0), null, 2, now, []) === 'Choose a time.' && r.bookingProblem(tue(0, 0), null, 9, now, []).includes('1 to 8'), 'booking problems are explained');

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
