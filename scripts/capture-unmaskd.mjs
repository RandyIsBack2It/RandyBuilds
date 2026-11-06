// Captures the unmaskd. Explore screenshot (public page, sample profiles only):
//   desktop-explore.jpg     Explore page with all three example profiles in view
// The hero stills (desktop.jpg, card.jpg) come from capture-unmaskd-video.mjs.
//   node scripts/capture-unmaskd.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/work/unmaskd');
const SITE = 'https://www.getunmaskd.com';
const shots = [
  ['desktop-explore', '/explore', 1],
];
const browser = await chromium.launch({ executablePath: chromePath() });
for (const [name, url, scale] of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(SITE + url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Hide the sticky "Back to top" bar. On the homepage, scroll just enough to
  // show Mei's card and the "Example profile" note under it; on Explore, the
  // last profile.
  await page.evaluate((explore) => {
    for (const el of document.querySelectorAll('a, button')) if (/Back to top/.test(el.textContent)) {
      let f = el;
      while (f && !/fixed|sticky/.test(getComputedStyle(f).position)) f = f.parentElement;
      (f || el).style.visibility = 'hidden';
    }
    const scroller = (el) => {
      let s = el.parentElement;
      while (s && !(s.scrollHeight > s.clientHeight && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
      return s ?? document.scrollingElement;
    };
    if (!explore) {
      const note = [...document.querySelectorAll('body *')].find((e) => e.children.length === 0 && /^example profile/i.test(e.textContent.trim()));
      const dy = note ? note.getBoundingClientRect().bottom + 16 - window.innerHeight : 0;
      if (dy > 0) scroller(note).scrollTop += dy;
      return;
    }
    const card = [...document.querySelectorAll('.lp-phone')].at(-1);
    scroller(card).scrollTop += card.getBoundingClientRect().bottom + 40 - window.innerHeight;
  }, url === '/explore');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 78 });
  await ctx.close();
}
await browser.close();
console.log('unmaskd screenshots captured');
