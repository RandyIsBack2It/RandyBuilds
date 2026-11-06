// Captures the Explore tool's results screen for its demo gallery card
// (public/work/explore/card.jpg). Preview must be up: `tech preview`.
//   node scripts/capture-explore.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:18480';
const browser = await chromium.launch({ executablePath: chromePath() });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0.5, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(`${BASE}/explore/?start=existing`, { waitUntil: 'networkidle' });
for (const [name, value] of [['start', 'have'], ['have', 'site'], ['goals', 'reach'], ['focus', 'improve']]) {
  await page.locator(`input[name="${name}"][value="${value}"]`).check();
  await page.locator('[data-next]').click();
}
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => scrollTo(0, document.querySelector('.explore__card').getBoundingClientRect().top + scrollY - 24));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(root, 'public/work/explore/card.jpg'), type: 'jpeg', quality: 78 });
await browser.close();
console.log('explore screenshot captured');
