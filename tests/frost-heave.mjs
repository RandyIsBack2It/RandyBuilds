// Frost Heave Creamery rules (src/concepts/frost-heave/logic.ts, data.ts).
// No browser. Flavor data must be consistent with its labels, hours must
// cover every day of the year and read correctly, seasonal flavors must come
// and go by month, and the menu must hold sample prices only.
//   node tests/frost-heave.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = await loadTsTree(path.join(root, 'src/concepts/frost-heave/logic.ts'));
const D = await loadTsTree(path.join(root, 'src/concepts/frost-heave/data.ts'));
const A = await loadTsTree(path.join(root, 'src/concepts/frost-heave/art.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const ov = () => L.emptyOverrides();
const at = (y, m, d, h = 15, min = 0) => new Date(y, m - 1, d, h, min);

// Flavor data
const F = D.flavors;
expect(new Set(F.map((f) => f.id)).size === F.length, 'flavor ids are unique');
expect(F.every((f) => /^#[0-9a-f]{6}$/i.test(f.look.base) && f.desc), 'every flavor has a colour and a description');
expect(F.every((f) => D.flavorCats.some((k) => k.id === f.cat)), 'every flavor is in a category');
expect(F.filter((f) => f.cat === 'dairyfree').every((f) => f.tags.includes('df')), 'the dairy-free category is all dairy-free');
expect(F.every((f) => f.tags.every((t) => D.tagLabel[t])), 'every tag has a label');
expect(F.filter((f) => f.cat === 'season').every((f) => f.months?.length), 'seasonal flavors have months');
expect(F.filter((f) => f.cat === 'classic').every((f) => !f.months), 'classics are in the case every month');
expect(F.every((f) => !f.months || f.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)), 'months are 1 to 12');
for (let m = 1; m <= 12; m++) {
  const d = new Date(2026, m - 1, 15);
  if (L.inCase(d, ov()).length < 12) { expect(false, `at least 12 flavors in the case in month ${m}`); break; }
  if (m === 12) expect(true, 'at least 12 flavors in the case every month');
}
expect(F.every((f) => A.scoopSvg(f.id).startsWith('<svg') && !/\sstyle=/.test(A.scoopSvg(f.id))), 'every flavor draws a scoop with no style attributes');
expect(L.monthsLabel(D.flavorById.gingerbread) === 'December – January' && L.monthsLabel(D.flavorById.peach) === 'August' && L.monthsLabel(D.flavorById.vanilla) === '', 'seasonal flavors are labelled with their months');

// Hours
let covered = true;
for (let i = 0; i < 366; i++) {
  const d = new Date(2026, 0, 1 + i);
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (D.seasons.filter((s) => L.inRange(md, s.from, s.to)).length !== 1) { covered = false; console.log('   ', md); }
}
expect(covered, 'every day of the year is in exactly one season');
expect(D.seasons.every((s) => s.week.length === 7 && s.week.every((h) => h === null || (h[0] < h[1] && h[1] <= 24 * 60))), 'every season has seven days of sensible hours');
expect(L.statusAt(at(2026, 10, 25, 15)).text === 'Open until 8 pm', 'a fall Sunday afternoon is open until 8 pm');
expect(L.statusAt(at(2026, 10, 26, 15)).text === 'Closed · opens Wednesday at 1 pm', 'a fall Monday is closed and says when it opens');
expect(L.statusAt(at(2026, 10, 25, 11)).text === 'Closed · opens today at 12 pm', 'before opening it says “opens today”');
expect(L.statusAt(at(2026, 10, 24, 21)).text === 'Closed · opens tomorrow at 12 pm', 'after closing it says “opens tomorrow”');
expect(L.hoursOn(at(2026, 11, 26)).hours === null && /Thanksgiving/.test(L.hoursOn(at(2026, 11, 26)).reason), 'Thanksgiving is closed, and says why');
expect(L.seasonFor(at(2026, 11, 1)).id === 'winter' && L.seasonFor(at(2027, 3, 31)).id === 'winter' && L.seasonFor(at(2027, 4, 1)).id === 'spring', 'winter runs November 1 to March 31');
const lines = (id) => L.weekLines(D.seasons.find((x) => x.id === id).week).map((l) => `${l.days}: ${l.hours}`).join(' | ');
expect(lines('summer') === 'Mon – Thu: 12 pm – 9:30 pm | Fri – Sat: 12 pm – 10 pm | Sun: 12 pm – 9:30 pm', `summer hours read in short lines (${lines('summer')})`);
expect(lines('fall') === 'Mon – Tue: Closed | Wed – Thu: 1 pm – 8 pm | Fri: 1 pm – 8:30 pm | Sat: 12 pm – 8:30 pm | Sun: 12 pm – 8 pm', `fall hours list the closed days (${lines('fall')})`);
expect(D.seasons.every((x) => L.weekLines(x.week).length >= 1), 'every season reads as at least one line');

// Flavor states
const pumpkin = D.flavorById.pumpkin;
expect(L.flavorState(pumpkin, at(2026, 10, 25), ov()) === 'case', 'Pumpkin Whoopie is in the case in October');
expect(L.flavorState(pumpkin, at(2026, 7, 1), ov()) === 'rotating' && L.backIn(pumpkin, at(2026, 7, 1)) === 10, 'in July it says it is back in October');
expect(L.backIn(D.flavorById.gingerbread, at(2026, 2, 1)) === 12, 'back-in months wrap around the year');
{
  const o = ov(); o.soldOut.push('salt-truck');
  expect(L.flavorState(D.flavorById['salt-truck'], at(2026, 10, 25), o) === 'out' && !L.inCase(at(2026, 10, 25), o).some((f) => f.id === 'salt-truck'), 'a sold-out flavor is not in the case');
  expect(L.flavorState(pumpkin, at(2026, 7, 1), { ...o, soldOut: ['pumpkin'] }) === 'rotating', 'out of season wins over sold out');
}

// Menu
const M = [...D.sizes, ...D.cones, ...D.treats, ...D.takeHome];
expect(M.every((x) => Number.isFinite(x.price) && x.price >= 0 && Math.round(x.price * 100) === x.price * 100), 'every menu price is a sample amount in whole cents');
expect(D.sizes.every((x, i) => i === 0 || x.price > D.sizes[i - 1].price) && D.sizes.every((x) => x.scoops >= 1 && x.scoops <= 3), 'sizes go up in price, one to three scoops');

// Copy honesty
const text = JSON.stringify({ F, M, s: D.seasons });
expect(!/\b(review|rating|stars?|award|best in|#1|voted)\b/i.test(text), 'no reviews, ratings or awards in the data');
expect(/555-01\d\d/.test(D.shop.phone) && D.shop.email.endsWith('.example'), 'fictional phone number and a non-routable email');

console.log(failures ? `\n${failures} failure(s)` : '\nall frost-heave checks passed');
process.exit(failures ? 1 : 0);
