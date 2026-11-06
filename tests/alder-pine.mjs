// Alder & Pine prices, delivery, build slots and share links
// (src/concepts/alder-pine/data.ts). No browser.
//   node tests/alder-pine.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = await loadTsTree(path.join(root, 'src/concepts/alder-pine/data.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

// Every combination prices to whole dollars and the parts add up.
let ok = true, n = 0;
for (const length of [60, 84, 108]) for (const width of [34, 40, 46]) for (const s of d.species) for (const l of d.legs) for (const e of d.edges) for (const f of d.finishes) for (const extra of [0, 1]) {
  const c = { ...d.defaultConfig, length, width, species: s.id, legs: l.id, edge: e.id, finish: f.id, thick: extra ? 'thick' : 'std', metal: extra ? 'brass' : 'black', leaf: !!extra, bench: !!extra };
  for (const zip of ['', '04101', '02139', '10001', '94110']) {
    const q = d.quote(c, zip);
    n++;
    if (q.total !== q.rows.reduce((t, r) => t + r[1], 0) || q.grand !== q.total + (q.delivery?.fee ?? 0) || q.deposit + q.balance !== q.grand || !Number.isInteger(q.deposit) || q.total <= 0) ok = false;
  }
}
expect(ok, `${n} quotes: rows add up, delivery is added, deposit + balance = total, whole dollars`);
expect(d.quote(d.defaultConfig, '').delivery === null && d.quote(d.defaultConfig, 'abc').delivery === null, 'no delivery fee without a valid ZIP');
expect(d.delivery('04101').fee < d.delivery('02139').fee && d.delivery('02139').fee < d.delivery('10001').fee && d.delivery('10001').fee < d.delivery('94110').fee, 'delivery fees rise with distance');

// Build slots and arrival
const now = new Date(2026, 9, 24); // a Saturday
const slots = d.buildSlots(now);
expect(slots.every((s) => s.getDay() === 1) && slots[0] - now >= 7 * 864e5 && slots[1] - slots[0] === 14 * 864e5, 'build slots are Mondays, at least a week out, two weeks apart');
// Fixed dates, local calendar (midday and just before midnight, so no time zone or hour can shift the day).
const keys = (y, m, day, h = 12) => d.buildSlots(new Date(y, m - 1, day, h, 0)).map(d.slotKey).join(' ');
const cases = [
  ['a normal weekday (Wed 2026-10-28)', [2026, 10, 28], '2026-11-09 2026-11-23 2026-12-07'],
  ['a Monday (2026-10-26): not today, next week', [2026, 10, 26], '2026-11-02 2026-11-16 2026-11-30'],
  ['a Monday just before midnight', [2026, 10, 26, 23], '2026-11-02 2026-11-16 2026-11-30'],
  ['a Sunday (2026-10-25)', [2026, 10, 25], '2026-11-02 2026-11-16 2026-11-30'],
  ['a month change (Fri 2026-01-23)', [2026, 1, 23], '2026-02-02 2026-02-16 2026-03-02'],
  ['a year change (Wed 2026-12-23)', [2026, 12, 23], '2027-01-04 2027-01-18 2027-02-01'],
  ['a leap year (Mon 2028-02-14 → Feb 21, Mar 6, Mar 20)', [2028, 2, 14], '2028-02-21 2028-03-06 2028-03-20'],
  ['a leap day (Tue 2028-02-22 → Mar 6)', [2028, 2, 22], '2028-03-06 2028-03-20 2028-04-03'],
  ['a non-leap February (Mon 2027-02-15)', [2027, 2, 15], '2027-02-22 2027-03-08 2027-03-22'],
];
for (const [label, args, want] of cases) { const got = keys(...args); expect(got === want, `slots from ${label}: ${got}`); }
let rules = true;
for (let i = 0; i < 800; i++) {
  const today = new Date(2026, 0, 1 + i, 9);
  const s = d.buildSlots(today);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysOut = Math.round((s[0] - t0) / 864e5);
  if (s.length !== 3 || s.some((x) => x.getDay() !== 1) || daysOut < 7 || daysOut > 13 || s.some((x, j) => j && Math.round((x - s[j - 1]) / 864e5) !== 14)) rules = false;
}
expect(rules, '800 days in a row: three Mondays, the first 7–13 days out (never today or past), 14 days apart');
const later = d.buildSlots(new Date(2026, 10, 2, 9)); // Nov 2: offers Nov 9, 23, Dec 7
expect(d.slotKey(d.pickSlot(later, '2026-11-23')) === '2026-11-23', 'a chosen date still offered stays chosen');
expect(d.slotKey(d.pickSlot(later, '2026-11-02')) === '2026-11-09' && d.slotKey(d.pickSlot(later, '2026-11-16')) === '2026-11-23', 'a chosen date that has passed or dropped out moves to the next offered date');
expect(d.slotKey(d.pickSlot(later, '')) === '2026-11-09' && d.slotKey(d.pickSlot(later, '2027-06-07')) === '2026-11-09', 'no choice (or one beyond the list) gets the first date');
expect(JSON.stringify(d.price(d.defaultConfig)) === JSON.stringify(d.price({ ...d.defaultConfig })) && d.price(d.defaultConfig).total === 2310, 'prices are unaffected (default table $2,310)');

const [a, b] = d.arrival(slots[0], d.defaultConfig, 1);
expect(Math.round((a - slots[0]) / 864e5) === (d.leadWeeks(d.defaultConfig) + 1) * 7 && Math.round((b - a) / 864e5) === 14, 'arrival = build weeks + delivery weeks, then a two-week window');
expect(d.leadWeeks({ ...d.defaultConfig, species: 'walnut', edge: 'live', legs: 'pedestal' }) === 11, 'walnut, live edge and pedestal add to the lead time');

// Share links
const custom = { ...d.defaultConfig, length: 96, width: 44, species: 'walnut', legs: 'trestle', edge: 'live', thick: 'thick', finish: 'ebony', leaf: true };
expect(JSON.stringify(d.decode(d.encode(custom))) === JSON.stringify(custom), 'a share link reopens the exact design');
expect(d.decode('999.40.oak.tapered.square.std.oil.black.0.0.1') === null && d.decode('85.40.oak.tapered.square.std.oil.black.0.0.1') === null && d.decode('84.40.oak.tapered.square.huge.oil.black.0.0.1') === null && d.decode('nonsense') === null, 'broken or tampered links are rejected');

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
