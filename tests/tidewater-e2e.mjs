// Tidewater Mechanical Ops in a browser, against the local preview: the
// customer service-request form (validation, summary, job on the board),
// honest labels, keyboard and axe on phone and desktop. Nothing is sent.
//   node tests/tidewater-e2e.mjs   (after `tech preview`; QA_BASE to override)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/tidewater');
mkdirSync(out, { recursive: true });
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const URL_ = BASE + '/concepts/tidewater/';
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

const browser = await chromium.launch({ executablePath: chromePath() });
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  console.log(`\n${vp.name}`);
  const ctx = await browser.newContext({ viewport: vp, bypassCSP: true, isMobile: vp.name === 'phone', hasTouch: vp.name === 'phone' });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Cloudflare Web Analytics runs on the live site only; it isn't part of the demo.
  page.on('request', (r) => { if (/cloudflareinsights\.com|\/cdn-cgi\/rum/.test(r.url())) return; if (!r.url().startsWith(BASE) || r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`); });
  await page.goto(URL_, { waitUntil: 'networkidle' });

  const text = await page.locator('main').innerText();
  expect(/fictional company/.test(text), 'says the company is fictional');
  expect(!/Live map|APR|financed|licensed/i.test(text), 'no live labels, financing or licensing claims');
  expect((await page.locator('[data-clock]').textContent()).startsWith('Sample day'), 'the clock says sample day');
  const trayBefore = await page.locator('[data-tray] .tw-job').count();

  // New request opens the request form.
  await page.locator('[data-newjob]').click();
  const form = page.locator('[data-reqform]');
  await form.waitFor();
  const info = await page.locator('.tw-req__info').innerText();
  expect(/Service area/.test(info) && /Office hours/.test(info) && /written estimate/.test(info) && /instead of using this form/.test(info), 'service area, hours, next steps and urgent-call advice are shown');

  await form.locator('button[type="submit"]').click();
  const err = await form.locator('[data-req-err]').innerText();
  expect(/your name/.test(err) && /what you need/.test(err) && /description/.test(err), 'empty form explains what is missing');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('name')) === 'name', 'focus moves to the first missing field');

  await form.locator('[name="name"]').fill('Sam Sample');
  await form.locator('[name="phone"]').fill('207 555 01');
  await form.locator('[name="email"]').fill('not-an-email');
  await form.locator('[name="street"]').fill('12 Shore Rd');
  await form.locator('[name="town"]').selectOption('other');
  expect(await form.locator('[data-town-note]').isVisible(), 'a town outside the area gets a note, not a block');
  await form.locator('label:has(input[value="noheat"])').click();
  expect(await form.locator('[data-urgent-note]').isVisible(), 'no heat suggests calling');
  await form.locator('[name="timing"]').selectOption('This week');
  await form.locator('[name="desc"]').fill('Boiler shows code F28 and the house is cold.');
  await form.locator('button[type="submit"]').click();
  expect(/10-digit phone/.test(await form.locator('[data-req-err]').innerText()) && /valid email/.test(await form.locator('[data-req-err]').innerText()), 'bad phone and email are explained');
  await form.locator('[name="phone"]').fill('(207) 555-0199');
  await form.locator('[name="email"]').fill('');
  await form.locator('[name="town"]').selectOption('Whitcomb');
  await form.locator('[name="system"]').selectOption('Boiler');
  await form.locator('button[type="submit"]').click();
  const done = await form.locator('.tw-reqdone').innerText();
  expect(/not sent/i.test(done) && /No appointment is booked/.test(done) && /F28/.test(done) && /Boiler/.test(done), 'summary shows the request and says nothing was sent or booked');
  await page.screenshot({ path: path.join(out, `${vp.name}-request.png`), fullPage: false });

  await form.locator('[data-req-see]').click();
  const drawer = page.locator('[data-drawer]');
  await drawer.waitFor({ state: 'visible' });
  const dtext = await drawer.innerText();
  expect(/Sam Sample/.test(dtext) && /F28/.test(dtext) && /Not recorded yet/.test(dtext), 'the job opens with the request details');
  await page.keyboard.press('Escape');
  expect(await page.locator('[data-tray] .tw-job').count() === trayBefore + 1, 'the request is in the Unassigned tray');

  // The new customer has a record that opens without errors.
  await page.locator('[data-nav="customers"]').evaluate((a) => a.click());
  await page.locator('[data-cq]').fill('Sam Sample');
  await page.locator('[data-cust-open]').first().click();
  expect(/No equipment recorded yet/.test(await page.locator('.tw-cpanel').innerText()), 'the new customer’s record opens');
  expect(!errors.length, `no script errors ${errors.join(' | ')}`);

  // Estimates: no financing, sample tax, terms.
  await page.goto(URL_ + '#estimates', { waitUntil: 'networkidle' });
  const est = await page.locator('[data-est]').innerText();
  expect(/Sample tax/.test(est) && /hidden problem/.test(est) && !/APR|\/mo/.test(est), 'estimate shows sample tax and terms, no financing');

  // Keyboard: nav link to Requests.
  await page.goto(URL_, { waitUntil: 'networkidle' });
  if (vp.name === 'desktop') {
    await page.locator('[data-nav="request"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(await page.locator('[data-view="request"]').isVisible(), 'the Requests link works from the keyboard');
  }

  await page.goto(URL_ + '#request', { waitUntil: 'networkidle' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'request view has no sideways scroll');
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => (await window.axe.run('[data-view="request"]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target}`));
  expect(!axe.length, `axe (request view): ${axe.join('; ') || 'no violations'}`);
  await page.screenshot({ path: path.join(out, `${vp.name}-request-form.png`), fullPage: true });
  expect(!requests.length, `no outside or non-GET requests ${requests.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
