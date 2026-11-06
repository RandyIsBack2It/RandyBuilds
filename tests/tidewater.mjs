// Tidewater Mechanical Ops reports (src/concepts/tidewater/reports.ts). No browser.
// Every displayed total must come out of the same ledger and add up.
//   node tests/tidewater.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { report, ranges, jobsOn } = await loadTsTree(path.join(root, 'src/concepts/tidewater/reports.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);

for (const today of [new Date(2026, 9, 22), new Date(2026, 0, 3), new Date(2026, 2, 31), new Date()]) {
  const day = today.toDateString();
  for (const [range] of ranges) {
    const r = report(range, today);
    const t = r.totals;
    expect(t.jobs > 0 && t.revenue > 0, `${day} ${range}: has jobs and revenue (${t.jobs}, $${t.revenue})`);
    expect(sum(r.techs, 'revenue') === t.revenue, `${day} ${range}: technician revenue adds up to the KPI`);
    expect(sum(r.techs, 'jobs') === t.jobs, `${day} ${range}: technician jobs add up to the KPI`);
    expect(sum(r.mix, 'n') === t.jobs, `${day} ${range}: job mix adds up to the KPI`);
    expect(sum(r.buckets, 'revenue') === t.revenue, `${day} ${range}: chart buckets add up to the KPI`);
    expect(sum(r.buckets, 'jobs') === t.jobs, `${day} ${range}: chart buckets hold every job`);
    expect(r.mix.find((m) => m.type === 'estimate').n === t.estimates && t.won <= t.estimates, `${day} ${range}: estimate counts agree`);
    expect(r.buckets.length === { 30: 30, 90: 13, 365: 12 }[range], `${day} ${range}: ${r.buckets.length} buckets`);
    expect(r.prev.jobs > 0, `${day} ${range}: previous period has data`);
  }
  // Ranges overlap consistently: the last 30 days are the same jobs in every view.
  const a = report(30, today), b = report(90, today);
  expect(sum(b.buckets.slice(-4), 'jobs') >= a.buckets.slice(-28).reduce((s, x) => s + x.jobs, 0), `${day}: 90-day weeks contain the 30-day days`);
}
// A day is stable no matter when it is asked for.
const d = new Date(2026, 6, 14);
expect(JSON.stringify(jobsOn(d)) === JSON.stringify(jobsOn(new Date(2026, 6, 14, 15))), 'a day always has the same jobs');
expect(jobsOn(new Date(2026, 9, 18)).length === 0, 'no jobs on Sundays');

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
