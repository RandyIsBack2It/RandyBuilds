// Frost Heave Creamery in a browser, against the local preview: a simple
// shop site (flavors, menu, story, visit), seasonal flavors by month, today's
// status, the owner panel, honesty labels, keyboard use and axe on phone and
// desktop. Nothing is sent anywhere.
//   node tests/frost-heave-e2e.mjs   (after `tech preview`; QA_BASE to override)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/frost-heave');
mkdirSync(out, { recursive: true });
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const URL_ = BASE + '/concepts/frost-heave/';
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

const browser = await chromium.launch({ executablePath: chromePath() });
// Sunday, October 25, 2026, 3 pm: fall hours, open until 8.
const clock = new Date(2026, 9, 25, 15, 0).getTime();

for (const vp of [{ name: 'desktop', width: 1366, height: 860 }, { name: 'phone', width: 390, height: 844 }]) {
  console.log(`\n${vp.name}`);
  const ctx = await browser.newContext({ viewport: vp, bypassCSP: true, isMobile: vp.name === 'phone', hasTouch: vp.name === 'phone' });
  const page = await ctx.newPage();
  await page.clock.install({ time: clock });
  const requests = [];
  page.on('request', (r) => {
    if (/cloudflareinsights\.com|\/cdn-cgi\/rum/.test(r.url())) return;
    if (!r.url().startsWith(BASE) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url());
    if (r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`);
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Honesty and the basics up front.
  const text = await page.locator('main').innerText();
  expect(/fictional ice cream shop/i.test(text) && /portfolio demo/i.test(text), 'says it is a fictional shop and a portfolio demo');
  expect(!/\b(reviews?|ratings?|testimonials?|stars)\b/i.test(text), 'no reviews, ratings or testimonials');
  expect(/Sample flavors/.test(text) && /Sample prices/.test(text), 'flavors and prices are labelled sample');
  expect((await page.locator('[data-status-text]').innerText()) === 'Open until 8 pm (sample)', 'header status: open until 8, labelled sample');
  expect(/Open now, until 8 pm · Fall hours \(sample\)/.test(await page.locator('[data-visit-status]').innerText()), 'Visit says it is open now');
  expect(await page.locator('.fh-season.is-now[data-season="fall"]').count() === 1, 'the current season’s hours are marked');
  expect((text.match(/\(207\) 555-\d{4}/g) ?? []).every((x) => x === '(207) 555-0163'), 'one phone number, used consistently');
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  expect(new Set(ids).size === ids.length, 'no duplicate ids');
  const nav = await page.locator('.fh-nav a').allInnerTexts();
  expect(nav.join() === 'Flavors,Menu,Our story,Visit', `short nav: ${nav.join(', ')}`);
  for (const gone of ['[data-open-bag]', '[data-shuffle]', '#planner', '#shop', '#events', '#jobs', 'form:not([data-own-notice])']) {
    expect(!(await page.locator(`.fh ${gone}`).count()), `no ${gone} (no shop, planner, events or forms)`);
  }

  // Flavors: out-of-season ones leave the list.
  const shown = (id) => page.locator(`[data-flavor="${id}"]`).isVisible();
  expect(await shown('pumpkin') && await shown('cider-donut') && !(await shown('strawberry')) && !(await shown('peppermint')), 'October shows fall flavors only');
  expect(/Coming later: .*Molasses Gingerbread \(December\)/.test(await page.locator('[data-later]').innerText()), 'says which seasonal flavors come next');
  const count = await page.locator('[data-flavor]:not([hidden])').count();
  expect(count >= 15 && count < 27, `only what’s in season (${count})`);

  // Owner panel: sold out and a notice, then reset.
  await page.locator('[data-open-owner]').click();
  const own = page.locator('[data-owner-dlg]');
  expect(await own.isVisible() && /stay in this browser/.test(await own.innerText()), 'owner panel opens and says changes stay in this browser');
  await own.locator('[data-own-out="salt-truck"]').check();
  expect(await page.locator('[data-flavor="salt-truck"] [data-out]').isVisible(), 'a flavor marked sold out shows it');
  await own.locator('textarea[name="text"]').fill('Closing at 6 tonight.');
  await own.locator('[data-own-notice] button[type="submit"]').click();
  expect(/Closing at 6 tonight\. \(Sample notice/.test(await page.locator('[data-notice]').innerText()), 'a notice shows across the top');
  await page.reload({ waitUntil: 'networkidle' });
  expect(await page.locator('[data-notice]').isVisible() && await page.locator('[data-flavor="salt-truck"] [data-out]').isVisible(), 'owner changes survive a reload (this browser only)');
  await page.locator('[data-open-owner]').click();
  await own.locator('[data-own-reset]').click();
  await page.keyboard.press('Escape');
  expect(await page.locator('[data-notice]').isHidden() && await page.locator('[data-flavor="salt-truck"] [data-out]').isHidden(), 'reset puts the sample data back');

  // Keyboard: skip link to the flavors.
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim()) === 'Discuss a similar project' || await page.evaluate(() => document.activeElement?.className === 'fh-skip'), 'tab starts at the banner or skip link');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow <= 0, `no horizontal scroll (${overflow}px)`);

  // From the top, so the sticky header isn't covering a card while axe measures targets.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => `${v.id} x${v.nodes.length} ${v.nodes[0]?.target.join(' ')}`);
  });
  expect(!axe.length, `axe: ${axe.join(' | ') || 'clean'}`);
  await page.locator('[data-open-owner]').click();
  const axeO = await page.evaluate(async () => (await window.axe.run(document.querySelector('[data-owner-dlg]'))).violations.map((v) => v.id));
  expect(!axeO.length, `axe on the owner panel: ${axeO.join(', ') || 'clean'}`);
  await page.keyboard.press('Escape');

  await page.screenshot({ path: path.join(out, `${vp.name}.png`), fullPage: false });
  expect(!requests.length, `no requests leave the site (${requests.join(', ') || 'none'})`);
  expect(!errors.length, `no console errors (${errors.join(' | ') || 'none'})`);
  await ctx.close();
}

// Narrowest phone: no sideways scroll.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();
  await page.clock.install({ time: clock });
  await page.goto(URL_, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow <= 0, `320px wide: no horizontal scroll (${overflow}px)`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall frost-heave browser checks passed');
process.exit(failures ? 1 : 0);
