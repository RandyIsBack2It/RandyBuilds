// Ember & Rye in a browser, against the local preview: menu search and
// filters, cart editing, totals, demo checkout, reservations, keyboard use
// and axe on phone and desktop. Nothing is sent anywhere.
//   node tests/ember-rye-e2e.mjs   (after `tech preview`; QA_BASE to override)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/ember-rye');
mkdirSync(out, { recursive: true });
const URL_ = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '') + '/concepts/ember-rye/';
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const cents = (s) => Math.round(Number(String(s).replace(/[^0-9.]/g, '')) * 100);

const browser = await chromium.launch({ executablePath: chromePath() });
// A Tuesday at 6 pm, so ordering is open and pickup times are predictable.
const clock = new Date(2026, 9, 27, 18, 0).getTime();

for (const vp of [{ name: 'desktop', width: 1366, height: 860 }, { name: 'phone', width: 390, height: 844 }]) {
  console.log(`\n${vp.name}`);
  const ctx = await browser.newContext({ viewport: vp, bypassCSP: true, isMobile: vp.name === 'phone', hasTouch: vp.name === 'phone' });
  const page = await ctx.newPage();
  await page.clock.install({ time: clock });
  const requests = [];
  // Cloudflare Web Analytics runs on the live site only; it isn't part of the demo.
  page.on('request', (r) => { if (/cloudflareinsights\.com|\/cdn-cgi\/rum/.test(r.url())) return; if (!r.url().startsWith(URL_.replace('/concepts/ember-rye/', '')) ) requests.push(r.url()); if (r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`); });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_, { waitUntil: 'networkidle' });

  // Fictional labelling and no fake live readouts.
  const text = await page.locator('main').innerText();
  expect(/fictional restaurant/i.test(text) && /portfolio demo/i.test(text), 'says it is a fictional restaurant and a portfolio demo');
  expect(!/hearth temperature|tables tonight|live tracker|DoorDash|Uber Eats|promo code/i.test(text), 'no fake live readouts, delivery apps or promo codes');
  expect(/We don’t deliver/.test(text) && /How pickup works/.test(text), 'pickup only, explained');
  expect((await page.locator('[data-status-text]').innerText()).startsWith('Sample hours'), 'header status is labelled sample hours');
  expect(await page.locator('.er-facts-strip a[href="#visit"]').isVisible() && await page.locator('.er-facts-strip a[href^="tel:"]').isVisible(), 'address and call link are at the top of the page');
  const addrs = (text.match(/\d+ Wharf Lane, Port Alder/g) ?? []);
  expect(addrs.length >= 2 && addrs.every((x) => x === '14 Wharf Lane, Port Alder') && (text.match(/\(207\) 555-\d{4}/g) ?? []).every((x) => x === '(207) 555-0147'), 'one address and one phone number, used consistently');
  expect(/24 hours’ notice/.test(text) && /can’t promise a particular table/.test(text) && /walk-in and pickup only/.test(text), 'reservation, change and meal-period policies are stated');
  expect(await page.locator('nav.er-nav a[href="#pickup"]').isVisible(), 'section nav visible');

  // Menu search and filters.
  await page.fill('[data-search]', 'pizza dough nothing');
  expect(await page.locator('[data-empty]').isVisible(), 'empty state when nothing matches');
  await page.locator('[data-empty] [data-clear]').click();
  expect(await page.locator('.er-item:visible').count() === 22 && (await page.inputValue('[data-search]')) === '', 'clear restores the full menu');
  await page.locator('.er-chip:has-text("Vegan")').click();
  const vegan = await page.locator('.er-item:visible').evaluateAll((els) => els.map((e) => e.dataset.tags));
  expect(vegan.length > 0 && vegan.every((t) => t.includes('vg')), `vegan filter shows only vegan dishes (${vegan.length})`);
  expect(/dishes shown/.test(await page.locator('[data-menu-live]').innerText()), 'filter result is announced');
  await page.locator('[data-clear-inline]').click();
  await page.fill('[data-search]', 'halibut');
  expect(await page.locator('.er-item:visible').count() === 1, 'search finds a dish by name');
  await page.fill('[data-search]', '');
  await page.dispatchEvent('[data-search]', 'input');

  // Every part of a menu card opens the dish (no dead strip under shorter cards).
  const dead = [];
  for (const id of await page.locator('.er-item').evaluateAll((els) => els.map((e) => e.dataset.item))) {
    const li = page.locator(`[data-item="${id}"]`);
    await li.scrollIntoViewIfNeeded();
    const r = await li.boundingBox();
    if (!(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-open], [data-quick]'), [r.x + 30, r.y + r.height - 3]))) dead.push(id);
  }
  expect(!dead.length, `menu cards are clickable to their bottom edge ${dead.join(' ')}`);

  // Dine-in only dish cannot be ordered.
  expect(await page.locator('[data-item="oysters"] [data-quick]').count() === 0, 'dine-in dish has no add button');
  await page.locator('[data-open="oysters"]').click();
  expect(await page.locator('[data-item-dlg] .er-dinein').isVisible() && (await page.locator('[data-item-dlg] [data-addbtn]').count()) === 0, 'dine-in dish dialog explains and offers no add');
  await page.keyboard.press('Escape');

  // Build an order: options dialog, quick add, quantities.
  await page.locator('[data-open="margherita"]').click();
  await page.locator('[data-item-dlg] input[value="gf"]').check();
  await page.locator('[data-item-dlg] input[name="add"][value="egg"]').check();
  expect(/Sample allergen info/.test(await page.locator('[data-item-dlg]').innerText()), 'dish dialog shows sample allergen info');
  await page.locator('[data-item-dlg] [data-q="1"]').click();
  expect(cents(await page.locator('[data-item-dlg] [data-price]').innerText()) === 4700, 'dialog price follows options and quantity ($47.00)');
  await page.locator('[data-item-dlg] [data-addbtn]').click();
  await page.locator('[data-quick="fries"]').click();
  await page.locator('[data-quick="fries"]').click();
  expect((await page.locator('[data-count]').innerText()) === '4', 'badge counts four items');

  await page.locator('.er-floatcart, .er-cartbtn').first().click();
  const cart = page.locator('[data-cart-dlg]');
  await cart.waitFor({ state: 'visible' });
  const check = async (label) => {
    const lines = await cart.locator('.er-line__price').allInnerTexts();
    const t = Object.fromEntries(await cart.locator('.er-totals div').evaluateAll((ds) => ds.map((d) => [d.querySelector('dt').textContent.split(' ')[0], d.querySelector('dd').textContent])));
    const sub = cents(t.Subtotal), tax = cents(t.Sample), tip = cents(t.Tip), total = cents(t.Total);
    expect(lines.reduce((s, x) => s + cents(x), 0) === sub && sub + tax + tip === total && tax === Math.round(sub * 0.08), `${label}: totals add up (${t.Subtotal} + ${t.Sample} + ${t.Tip} = ${t.Total})`);
    return { sub, total };
  };
  let t = await check('start');
  expect(t.sub === 4700 + 1600, 'subtotal is $63.00');
  await cart.locator('[data-line][data-d="1"]').last().click();
  t = await check('after +1 fries');
  expect(t.sub === 4700 + 2400, 'quantity edit changes the subtotal');
  await cart.locator('.er-tip label:has-text("15%")').click();
  await check('with a 15% tip');
  await cart.locator('[data-remove]').last().click();
  t = await check('after removing fries');
  expect(t.sub === 4700 && (await cart.locator('.er-line').count()) === 1, 'remove takes the line out');
  expect(await page.evaluate(() => document.activeElement?.matches('[data-remove], .er-x')), 'focus stays in the cart after removing');

  // Checkout validation and demo summary.
  await cart.locator('[data-go="checkout"]').click();
  expect(/about 6:20 pm/.test(await cart.innerText()), 'ASAP pickup time from prep time (6:20 pm)');
  await cart.locator('button[type="submit"]').click();
  expect(/Please add your name and a 10-digit mobile number/.test(await cart.locator('[data-co-err]').innerText()), 'checkout explains missing details');
  await cart.locator('[name="name"]').fill('Sam Sample');
  await cart.locator('[name="phone"]').fill('207 555 0100');
  await cart.locator('button[type="submit"]').click();
  const done = await cart.innerText();
  expect(/Not sent/.test(done) && /no payment was taken/.test(done) && /In a real restaurant’s system/.test(done), 'demo summary says nothing was sent and what a real system would do');
  expect(/Today, about 6:20 pm/.test(done) && /Sam Sample/.test(done), 'summary shows the pickup time and name');
  await page.screenshot({ path: path.join(out, `${vp.name}-summary.png`) });
  await cart.locator('[data-neworder]').click();
  expect((await page.locator('[data-count]').innerText()) === '0', 'new order starts empty');

  // Reservations: party size, calendar, times, details, summary.
  const resv = page.locator('[data-resform]');
  await page.locator('#reserve').scrollIntoViewIfNeeded();
  expect(!(await page.locator('#reserve svg, [data-plan], [name="zone"]').count()), 'no floor plan or seating picker');
  expect(await resv.locator('.er-cal__out:text-is("26")').count() === 1 && !(await resv.locator('[data-date="2026-10-26"]').count()), 'past dates are not selectable');
  for (let i = 0; i < 8; i++) if (await resv.locator('[data-party="1"]').isEnabled()) await resv.locator('[data-party="1"]').click();
  expect((await resv.locator('[data-party-out]').innerText()) === '8 guests' && await resv.locator('[data-party-note]').isVisible() && await resv.locator('[data-party="1"]').isDisabled(), 'party size stops at 8 and points to private dining');
  for (let i = 0; i < 6; i++) await resv.locator('[data-party="-1"]').click();
  await resv.locator('[data-month="1"]').click();
  const monday = resv.locator('[data-date="2026-11-02"]');
  expect((await monday.getAttribute('aria-disabled')) === 'true' && /closed/.test(await monday.getAttribute('aria-label')), 'Mondays are marked closed');
  await monday.click({ force: true });
  expect(/closed on Mondays/.test(await resv.locator('[data-times]').innerText()), 'a closed day explains itself instead of offering times');
  await resv.locator('[data-goto]').click();
  expect((await resv.locator('[aria-pressed="true"]').getAttribute('data-date')) === '2026-11-03', '“Next available” selects the next open day');
  await resv.locator('button[type="submit"]').click();
  expect((await resv.locator('[data-res-err]').innerText()) === 'Choose a time.', 'Reserve without a time asks for one');
  await page.locator('[data-month="-1"]').click();
  await resv.locator('[data-date="2026-10-30"]').click();
  const full = resv.locator('.er-time[aria-disabled="true"]');
  expect(await full.count() > 0 && /Full/.test(await full.first().innerText()), 'a busy Friday shows full times');
  await full.first().click({ force: true });
  expect(/is full for 2 guests/.test(await resv.locator('[data-ressum]').innerText()), 'choosing a full time explains it');
  await resv.locator('.er-time:not([aria-disabled])').first().click();
  const chosen = await resv.locator('.er-time[aria-checked="true"]').getAttribute('aria-label');
  expect((await resv.locator('[data-ressum]').innerText()).includes('Friday, October 30') && (await resv.locator('[data-ressum]').innerText()).includes('2 guests'), `summary shows Friday, October 30 at ${chosen}, 2 guests before reserving`);
  await resv.locator('button[type="submit"]').click();
  expect(/Please add your name and a 10-digit mobile number/.test(await resv.locator('[data-res-err]').innerText()), 'missing details are explained');
  await resv.locator('[name="name"]').fill('Sam Sample');
  await resv.locator('[name="phone"]').fill('(207) 555-0100');
  await resv.locator('[name="email"]').fill('not an email');
  await resv.locator('button[type="submit"]').click();
  expect(/valid email/.test(await resv.locator('[data-res-err]').innerText()), 'a bad email is explained');
  await resv.locator('[name="email"]').fill('');
  await resv.locator('[name="notes"]').fill('Birthday, high chair');
  await resv.locator('button[type="submit"]').click();
  const conf = await resv.locator('.er-confirm').innerText();
  expect(/not sent/i.test(conf) && /no text or email went out/.test(conf) && /Birthday, high chair/.test(conf) && /Friday, October 30/.test(conf), 'summary shows the booking and says nothing was sent');
  expect(!(await resv.locator('.er-booker__when').isVisible()), 'the picker steps aside for the summary');
  const stored = await page.evaluate(() => sessionStorage.getItem('ember-rye-res-v2') ?? '');
  expect(stored.includes('2026-10-30') && !/Sam|555|Birthday/.test(stored), 'only date, time and party size are kept, in this tab');
  await page.screenshot({ path: path.join(out, `${vp.name}-reserved.png`) });
  await resv.locator('[data-res-again]').click();
  await resv.locator('[data-date="2026-10-30"]').click();
  expect(/already have a demo reservation/.test(await resv.locator('[data-times]').innerText()), 'a second booking the same night is refused');
  expect(/is-mine/.test(await resv.locator('[data-date="2026-10-30"]').getAttribute('class')), 'your booked night is marked on the calendar');
  await resv.locator('[name="name"]').fill('Sam Sample');
  await resv.locator('[name="phone"]').fill('2075550100');
  await resv.locator('button[type="submit"]').click();
  expect(/already have/.test(await resv.locator('[data-res-err]').innerText()), 'Reserve explains the duplicate');
  // Cancel frees the night again.
  await page.evaluate(() => sessionStorage.removeItem('ember-rye-res-v2'));
  await page.reload({ waitUntil: 'networkidle' });
  await resv.locator('[data-date="2026-10-29"]').click();
  await resv.locator('.er-time:not([aria-disabled])').first().click();
  await resv.locator('[name="name"]').fill('Sam Sample');
  await resv.locator('[name="phone"]').fill('2075550100');
  await resv.locator('button[type="submit"]').click();
  await resv.locator('[data-res-cancel]').click();
  expect(/cancelled/.test(await resv.locator('[data-ressum]').innerText()) && (await page.evaluate(() => sessionStorage.getItem('ember-rye-res-v2'))) === '[]', 'cancel removes the demo reservation');

  // Press feedback survives the time list redrawing.
  await resv.locator('.er-time:not([aria-disabled])').last().click();
  expect(await resv.locator('.er-time.is-pressed').count() === 1, 'a chosen time shows the press ring');

  // Keyboard: arrows move through the calendar, Enter picks a date, arrows pick times.
  await resv.locator('[data-date][tabindex="0"]').focus();
  const from = await page.evaluate(() => document.activeElement.dataset.date);
  await page.keyboard.press('ArrowRight');
  const to = await page.evaluate(() => document.activeElement.dataset.date);
  await page.keyboard.press('Enter');
  expect(from !== to && (await resv.locator('[aria-pressed="true"]').getAttribute('data-date')) === to, 'arrow keys and Enter choose a date');
  await page.keyboard.press('ArrowDown');
  expect((await page.evaluate(() => document.activeElement.dataset.date)) !== to, 'down arrow moves a week');
  await resv.locator('.er-time[tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');
  expect((await resv.locator('.er-time[aria-checked="true"]').count()) === 1, 'arrow keys choose a time');

  // Private dining inquiry is simulated.
  await page.fill('.er-evform [name="date"]', '2026-11-20');
  await page.fill('.er-evform [name="name"]', 'Sam Sample');
  await page.fill('.er-evform [name="email"]', 'sam@example.com');
  await page.locator('.er-evform button[type="submit"]').click();
  expect(/nothing was sent/.test(await page.locator('.er-evform [data-demo-result]').innerText()), 'private dining inquiry says nothing was sent');

  // Phone call button is simulated.
  await page.locator('.er-facts-strip a[href^="tel:"]').click();
  expect(/no call is made/.test(await page.locator('.demo-toast').innerText()), 'call link is simulated');

  // No horizontal overflow, axe clean.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
  await page.locator('.er-floatcart, .er-cartbtn').first().click();
  await page.keyboard.press('Escape');
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target}`));
  expect(!axe.length, `axe: ${axe.join('; ') || 'no violations'}`);
  // The open cart dialog, too.
  await page.locator('.er-cartbtn').click();
  const axeDlg = await page.evaluate(async () => (await window.axe.run('[data-cart-dlg]')).violations.map((v) => `${v.id}: ${v.nodes[0].target}`));
  expect(!axeDlg.length, `axe (cart): ${axeDlg.join('; ') || 'no violations'}`);
  await page.keyboard.press('Escape');

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(out, `${vp.name}-top.png`) });
  await page.locator('#menu').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${vp.name}-menu.png`) });
  await page.locator('#pickup').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${vp.name}-pickup.png`) });

  expect(!errors.length, `no script errors ${errors.join(' | ')}`);
  expect(!requests.length, `no outside or non-GET requests ${requests.join(' | ')}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
