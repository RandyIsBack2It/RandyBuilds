// Lighthouse (mobile + desktop) against the preview. Scores + key metrics.
//   node tests/lighthouse.mjs [url]
import lighthouse from 'lighthouse';
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromePath } from '../scripts/chrome.mjs';

const url = process.argv[2] || 'http://127.0.0.1:18480/';
mkdirSync('tests/out', { recursive: true });
const port = 9333;
const browser = await chromium.launch({ executablePath: chromePath(), args: [`--remote-debugging-port=${port}`] });
let bad = 0;
for (const formFactor of ['mobile', 'desktop']) {
  const config = formFactor === 'desktop'
    ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } }
    : { extends: 'lighthouse:default' };
  const r = await lighthouse(url, { port, output: 'html', logLevel: 'error' }, config);
  writeFileSync(`tests/out/lighthouse-${formFactor}.html`, r.report);
  const c = r.lhr.categories, a = r.lhr.audits;
  const scores = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v.score * 100)]));
  console.log(formFactor, scores, 'LCP', a['largest-contentful-paint'].displayValue, 'CLS', a['cumulative-layout-shift'].displayValue, 'TBT', a['total-blocking-time'].displayValue);
  for (const [k, v] of Object.entries(c)) if (v.score < 0.95 && k !== 'seo') bad++;
  for (const au of Object.values(a)) if (au.score !== null && au.score < 0.9 && au.scoreDisplayMode !== 'informative' && au.scoreDisplayMode !== 'notApplicable') console.log('  ', au.id, au.score, au.displayValue || '');
}
await browser.close();
process.exit(bad ? 1 : 0);
