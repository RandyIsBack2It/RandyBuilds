// Captures the concept-site screenshots used on the Work section and the
// /work/<slug>/ pages, from the running preview. Re-run after changing a concept.
//   node scripts/capture-concepts.mjs   (preview must be up: `tech preview`)
//   SLUGS=ember-rye node scripts/capture-concepts.mjs   (only some concepts)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:18480';
const slugs = process.env.SLUGS?.split(',') ?? ['auto-repair', 'landscaping', 'cleaning', 'frost-heave', 'ember-rye', 'alder-pine', 'tidewater', 'cove'];
const browser = await chromium.launch({ executablePath: chromePath() });
// 'card' is the desktop view at half resolution for the Work tiles; 'phone'
// is a 1x phone view for the hero.
for (const [device, viewport, scale] of [['desktop', { width: 1440, height: 900 }, 1], ['card', { width: 1440, height: 900 }, 0.5], ['mobile', { width: 390, height: 844 }, 2], ['phone', { width: 390, height: 844 }, 1]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const slug of slugs) {
    await page.goto(`${BASE}/concepts/${slug}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // Screenshot the site itself, below the concept banner.
    const top = await page.evaluate(() => document.querySelector('.concept-banner')?.getBoundingClientRect().height ?? 0);
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(root, 'public/work', slug, `${device}.jpg`), type: 'jpeg', quality: 78 });
  }
  await ctx.close();
}
await browser.close();
console.log('concept screenshots captured');
