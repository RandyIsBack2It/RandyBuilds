// Alder & Pine in a browser, against the local preview: configurator prices,
// room fit, saved designs, share links, ZIP delivery and the demo build-slot
// request, plus keyboard and axe on phone and desktop. Nothing is sent.
//   node tests/alder-pine-e2e.mjs   (after `tech preview`; QA_BASE to override)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/alder-pine');
mkdirSync(out, { recursive: true });
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const URL_ = BASE + '/concepts/alder-pine/';
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const dollars = (s) => Number(String(s).replace(/[^0-9.-]/g, ''));

const browser = await chromium.launch({ executablePath: chromePath() });
for (const vp of [{ name: 'desktop', width: 1366, height: 860 }, { name: 'phone', width: 390, height: 844 }]) {
  console.log(`\n${vp.name}`);
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce', bypassCSP: true, isMobile: vp.name === 'phone', hasTouch: vp.name === 'phone', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(2026, 9, 24, 10, 0).getTime() });
  const errors = [], requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Cloudflare Web Analytics runs on the live site only; it isn't part of the demo.
  page.on('request', (r) => { if (/cloudflareinsights\.com|\/cdn-cgi\/rum/.test(r.url())) return; if (!r.url().startsWith(BASE) || r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`); });
  await page.goto(URL_, { waitUntil: 'networkidle' });

  const text = await page.locator('main').innerText();
  expect(/fictional workshop/i.test(text) && /made-up town/.test(text), 'says the workshop and town are fictional');
  expect(!/Pay deposit|2 left|slot is held,|arrives /i.test(text), 'no payment button, scarcity or promised arrival in the page');
  expect(/Before you order a table/.test(text) && /can’t be returned/.test(text), 'ordering terms are stated');

  // Price follows options and matches the breakdown.
  const total = async () => dollars(await page.locator('[data-breakdown] .is-total dd').textContent());
  const base = await total();
  const openTab = async (id) => { if (await page.locator('[data-tabbar]').isVisible()) await page.locator(`#ap-tab-${id}`).click(); };
  await openTab('wood');
  await page.locator('label.ap-swatch:has(input[value="walnut"])').click();
  expect(await page.locator('.is-pressed').count() === 0, 'with reduced motion, choices show no press ring');
  await openTab('base');
  await page.locator('label.ap-card:has(input[value="trestle"])').click();
  await openTab('size');
  const rows = await page.locator('[data-breakdown] div:not(.is-total):not(:last-child) dd').allTextContents();
  const sum = rows.reduce((s, r) => s + (r === 'Included' ? 0 : dollars(r)), 0);
  expect(await total() > base && sum === await total(), `walnut + trestle raise the price and the breakdown adds up (${await total()})`);
  expect((await page.locator('[data-svg]').getAttribute('aria-label')).includes('Black walnut'), 'the preview’s accessible name follows the design');

  // Room fit
  await page.fill('[data-room="l"]', '10');
  await page.locator('[data-room="l"]').dispatchEvent('input');
  expect(/Too tight|won’t fit/.test(await page.locator('[data-verdict]').innerText()), 'a small room is flagged');
  if (await page.locator('[data-fit-fix]').count()) { await page.locator('[data-fit-fix]').click(); expect(/Comfortable|Snug/.test(await page.locator('[data-verdict]').innerText()), '“Set the length to fit” fixes it'); }

  // Saved designs and share link
  await page.locator('[data-save]').click();
  expect((await page.locator('[data-saved-n]').innerText()) === '1', 'saving counts the design');
  const hash = await page.evaluate(() => location.hash);
  const p2 = await ctx.newPage();
  await p2.goto(URL_ + hash, { waitUntil: 'networkidle' });
  expect((await p2.locator('[data-spec]').innerText()) === (await page.locator('[data-spec]').innerText()), 'a share link reopens the same design');
  await p2.close();

  // ZIP delivery
  await page.fill('[data-zip]', '12');
  await page.locator('[data-zip-go]').click();
  expect(/five-digit/.test(await page.locator('[data-zipout]').innerText()), 'a bad ZIP is explained');
  await page.fill('[data-zip]', '02139');
  await page.locator('[data-zip-go]').click();
  expect(/sample/.test(await page.locator('[data-zipout]').textContent()) && /Estimated arrival/.test(await page.locator('[data-zipout]').textContent()), 'ZIP shows a sample fee and an estimated window');

  // Demo build-slot request
  await page.locator('[data-reserve]:visible').first().click();
  const dlg = page.locator('[data-checkout-dlg]');
  const tot = async () => Object.fromEntries(await dlg.locator('[data-co-totals] div').evaluateAll((ds) => ds.map((x) => [x.querySelector('dt').textContent, x.querySelector('dd').textContent])));
  let t = await tot();
  const grand = dollars(t.Total), dep = dollars(Object.entries(t).find(([k]) => k.startsWith('50%'))[1]), bal = dollars(t['Balance before delivery']);
  expect(dep + bal === grand, `deposit + balance = total (${dep} + ${bal} = ${grand})`);
  await dlg.locator('[name="zip"]').fill('94110');
  t = await tot();
  expect(dollars(t.Total) > grand && Object.keys(t).some((k) => /National/.test(k)), 'changing the ZIP updates delivery and the total');
  await dlg.locator('button[type="submit"]').click();
  expect(/your name and a valid email/.test(await dlg.locator('[data-co-err]').innerText()), 'missing details are explained');
  // Build dates come from today's local date (the clock says Sat Oct 24, 2026).
  const slotKeys = () => dlg.locator('[name="slot"]').evaluateAll((xs) => xs.map((x) => x.value).join(' '));
  const slotPicked = () => dlg.locator('[name="slot"]:checked').getAttribute('value');
  expect(await slotKeys() === '2026-11-02 2026-11-16 2026-11-30' && await slotPicked() === '2026-11-02', 'build dates: the first Monday a week out, then every 14 days; the first is selected');
  expect((await dlg.locator('[data-slots]').innerText()).includes('Mon, Nov 16'), 'dates use the existing short format');
  await dlg.locator('label.ap-pill:has([value="2026-11-16"])').click();
  await page.keyboard.press('Escape');
  await openTab('wood'); await openTab('finish');
  await page.locator('[data-reserve]:visible').first().click();
  expect(await slotKeys() === '2026-11-02 2026-11-16 2026-11-30' && await slotPicked() === '2026-11-16', 'closing the dialog and switching option tabs keeps the dates and the chosen one');
  await dlg.locator('[name="zip"]').fill('94110');
  await dlg.locator('[name="name"]').fill('Sam Sample');
  await dlg.locator('[name="email"]').fill('sam@example.com');
  await dlg.locator('[name="notes"]').fill('Narrow stairs');
  await dlg.locator('button[type="submit"]').click();
  const done = await dlg.locator('.ap-done').innerText();
  expect(/not sent/i.test(done) && /nothing was charged/.test(done) && /Narrow stairs/.test(done) && /With a real workshop/.test(done), 'request summary says nothing was sent and what a real workshop would do');
  expect(/Build start\s*Monday, November 16/.test(done), 'the summary shows the chosen build date');
  await page.screenshot({ path: path.join(out, `${vp.name}-request.png`) });
  await dlg.locator('.ap-done [data-close]').click();
  expect(!(await dlg.evaluate((x) => x.open)), 'Back to the design closes the summary');

  // A chosen date that passes while the dialog is open moves to the next offered date, shown before sending.
  await page.locator('[data-reserve]:visible').first().click();
  await dlg.locator('label.ap-pill:has([value="2026-11-02"])').click();
  await dlg.locator('[name="name"]').fill('Sam Sample');
  await dlg.locator('[name="email"]').fill('sam@example.com');
  await dlg.locator('[name="zip"]').fill('04101');
  await page.clock.setSystemTime(new Date(2026, 10, 2, 9, 0)); // Monday Nov 2
  await dlg.locator('button[type="submit"]').click();
  expect(await slotKeys() === '2026-11-09 2026-11-23 2026-12-07' && await slotPicked() === '2026-11-09' && /no longer available.*Monday, November 9/.test(await dlg.locator('[data-co-err]').innerText()), 'a passed date is replaced by the next valid one, and the visitor is told');
  await dlg.locator('button[type="submit"]').click();
  expect(/Build start\s*Monday, November 9/.test(await dlg.locator('.ap-done').innerText()), 'sending again uses the new date');
  await dlg.locator('.ap-done [data-close]').click();
  await page.clock.setSystemTime(new Date(2026, 9, 24, 10, 0));
  await openTab('size');

  // Options: tabs beside the preview on wide screens, one list on phones.
  if (vp.name === 'desktop') {
    await page.evaluate(() => scrollTo(0, 0));
    const panel = await page.evaluate(() => { const p = document.querySelector('.ap-panel'); return [p.scrollHeight, p.clientHeight]; });
    expect(panel[0] <= panel[1] + 2, `options panel fits beside the preview without its own scroll (${panel[0]} ≤ ${panel[1]})`);
    expect(await page.locator('[data-tabbar]').isVisible() && (await page.locator('[data-step]:visible').count()) === 1, 'one option group shows at a time');
    const tops = await page.locator('[data-tab]').evaluateAll((ts) => new Set(ts.map((t) => Math.round(t.getBoundingClientRect().top))).size);
    expect(tops === 1, 'the option tabs sit in one row');
    await page.locator('#ap-tab-size').focus();
    await page.keyboard.press('ArrowRight');
    expect((await page.locator('#ap-tab-wood').getAttribute('aria-selected')) === 'true' && await page.locator('#ap-step-wood').isVisible(), 'arrow keys move between option tabs');
    await page.keyboard.press('End');
    expect(await page.locator('#ap-step-extras').isVisible() && !(await page.locator('[data-next]').isVisible()), 'End reaches Extras, which has no Next button');
    await page.locator('#ap-tab-top').click();
    await page.locator('[data-next]').click();
    expect(await page.locator('#ap-step-finish').isVisible(), '“Next” moves on to the following group');
    await page.locator('#ap-tab-extras').click();
    await page.locator('[data-tab-step="1"]').click();
    expect((await page.locator('#ap-tab-size').getAttribute('aria-selected')) === 'true', '› after Extras cycles back to Size');
    await page.locator('[data-tab-step="-1"]').click();
    expect((await page.locator('#ap-tab-extras').getAttribute('aria-selected')) === 'true' && await page.locator('#ap-tab-extras').isVisible(), '‹ before Size cycles to Extras, scrolled into view');
    await page.locator('#ap-tab-size').click();
  } else {
    expect(!(await page.locator('[data-tabbar]').isVisible()) && (await page.locator('[data-step]:visible').count()) === 6 && !(await page.locator('[data-step][role]').count()), 'phones show all option groups as one list');
  }

  // Keyboard: view buttons and a radio group.
  await page.locator('[data-view="top"]').focus();
  await page.keyboard.press('Enter');
  expect((await page.locator('[data-view="top"]').getAttribute('aria-pressed')) === 'true', 'view buttons work from the keyboard');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target}`));
  expect(!axe.length, `axe: ${axe.join('; ') || 'no violations'}`);
  await page.locator('[data-reserve]:visible').first().click();
  const axeDlg = await page.evaluate(async () => (await window.axe.run('[data-checkout-dlg]')).violations.map((v) => `${v.id}: ${v.nodes[0].target}`));
  expect(!axeDlg.length, `axe (request dialog): ${axeDlg.join('; ') || 'no violations'}`);
  await page.keyboard.press('Escape');

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(out, `${vp.name}-top.png`) });
  await page.locator('#ordering').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${vp.name}-ordering.png`) });
  expect(!errors.length, `no script errors ${errors.join(' | ')}`);
  expect(!requests.length, `no outside or non-GET requests ${requests.join(' | ')}`);
  await ctx.close();
}

// With motion on and animation frames stalled (a throttled or background tab),
// the headline price still settles on the real total: no frozen count-up frame.
{
  console.log('\nmotion on, frames stalled');
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, reducedMotion: 'no-preference', bypassCSP: true });
  await ctx.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: 'networkidle' });
  const shown = async () => { await page.waitForTimeout(800); return [dollars(await page.locator('[data-price]').textContent()), dollars(await page.locator('[data-breakdown] .is-total dd').textContent()), dollars(await page.locator('[data-mprice]').textContent())]; };
  const same = ([a, b, c]) => a === b && b === c;
  const load = await shown();
  expect(same(load), `on load the headline, breakdown and bar agree (${load.join(' / ')})`);
  await page.locator('#ap-tab-wood').click();
  const tab = await shown();
  expect(same(tab) && tab[0] === load[0], `opening the Wood tab without a change keeps the price (${tab[0]})`);
  await page.locator('label.ap-swatch:has(input[value="walnut"])').click();
  const wal = await shown();
  expect(same(wal) && wal[0] > load[0], `choosing walnut updates every price the same way (${wal[0]})`);
  expect(await page.locator('[data-price]').getAttribute('aria-busy') === null, 'the price is not left busy for screen readers');
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
