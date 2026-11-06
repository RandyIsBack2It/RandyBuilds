// Share links and the link manager in a browser, against the local preview:
// /p/<code>/ features its project (opaque code, fixed, noindex, works in a
// fresh browser, then shows the plain home address and keeps the project first
// for the session; old /p/<slug>/ addresses go to the home page),
// the plain home page picks one at random and keeps it for the session, the
// logo goes back to the plain home page, the footer's admin mark, the sign-in
// (server-side, QA master key from compose.preview.yaml), Share and copy with
// and without clipboard access, keyboard use, axe, and the 1366×768 panel fit.
//   node tests/share-links-e2e.mjs   (after `tech preview`; QA_BASE to override)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';
import { loadTs } from './load-ts.mjs';
import { stubTurnstile } from './turnstile-stub.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/share-links');
mkdirSync(out, { recursive: true });
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const MASTER = process.env.QA_MASTER_KEY || 'QA-MASTER-KEY';
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const { shareCode } = await loadTs(path.join(root, 'src/lib/share-code.ts'));
const share = (slug) => `/p/${shareCode(slug)}/`;
const SLUGS = ['unmaskd', 'auto-repair', 'landscaping', 'cleaning', 'frost-heave', 'ember-rye', 'alder-pine', 'tidewater', 'cove'];

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

const browser = await chromium.launch({ executablePath: chromePath() });
stubTurnstile(browser);

/** What the Work panel shows: the visible featured project and the visible supporting cards, in order. */
const shown = (page) => page.evaluate(() => ({
  feature: [...document.querySelectorAll('#work [data-feature]')].filter((el) => !el.hidden).map((el) => el.dataset.feature),
  cards: [...document.querySelectorAll('#work .demo')].filter((el) => !el.hidden).map((el) => el.dataset.demo),
  rotation: document.querySelector('[data-showcase]')?.dataset.showcase?.split(' ') ?? null,
  robots: document.querySelector('meta[name=robots]')?.content ?? null,
}));
const axe = async (page, label) => {
  await page.addScriptTag({ content: axeSource });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }))
    .violations.map((x) => `${x.id} (${x.nodes.length})`));
  expect(!v.length, `axe ${label}${v.length ? ': ' + v.join(', ') : ''}`);
};

// ── Share links ──────────────────────────────────────────────────────────
console.log('\nshare links');
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, bypassCSP: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const rotation = (await shown(page)).rotation;
  expect(rotation && SLUGS.every((s) => rotation.includes(s)) && rotation.length === SLUGS.length, `home rotation lists every portfolio project (${rotation})`);
  const next3 = (s) => [1, 2, 3].map((k) => rotation[(rotation.indexOf(s) + k) % rotation.length]);

  for (const slug of SLUGS) {
    const res = await page.goto(BASE + share(slug), { waitUntil: 'networkidle' });
    const s = await shown(page);
    expect(res.status() === 200 && /noindex/.test(res.headers()['x-robots-tag'] || '') && /noindex/.test(s.robots || ''), `${share(slug)}: 200, noindex header and meta`);
    expect(s.feature.join() === slug && s.cards.join() === next3(slug).join() && s.rotation === null, `${share(slug)} features ${slug} with ${s.cards.join(', ')}`);
    expect(page.url() === BASE + '/', `${share(slug)}: the address bar shows the plain home address`);
    const panel = page.locator('#work');
    await panel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const h = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(h <= 769, `${share(slug)}: Work panel fits 1366×768 (${Math.round(h)}px)`);
    if (slug === 'frost-heave') await page.screenshot({ path: path.join(out, 'p-frost-heave-1366.png') });
  }
  // Fixed on reload.
  await page.goto(BASE + share('ember-rye'), { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  const re = await shown(page);
  expect(re.feature.join() === 'ember-rye' && re.cards.join() === next3('ember-rye').join() && re.rotation !== null, 'share link: reload opens the home page with the same project first');
  // Logo → home page, same project first for the session.
  await page.goto(BASE + '/services/', { waitUntil: 'networkidle' });
  await page.locator('.site-header .wordmark').click();
  await page.waitForLoadState('networkidle');
  expect(new URL(page.url()).pathname === '/' && (await shown(page)).feature.join() === 'ember-rye', 'after a share link, the logo opens the home page with that project first');
  // Unknown and retired projects fall back to the home page.
  for (const p of ['/p/not-a-code/', '/p/ember-rye/']) {
    const r = await page.request.get(BASE + p, { maxRedirects: 0 });
    expect(r.status() === 302 && new URL(r.headers().location, BASE).pathname === '/', `${p} (unknown code or old slug address) → home page`);
  }
  expect(SLUGS.every((s) => !share(s).includes(s)) && new Set(SLUGS.map(share)).size === SLUGS.length, 'share codes are unique and never name the project');
  // Not in the sitemap, the nav or the public Work page.
  const sitemap = await (await page.request.get(BASE + '/sitemap.xml')).text();
  expect(!/\/p\/|\/admin/.test(sitemap), 'sitemap has no share links or admin pages');
  await page.goto(BASE + '/work/', { waitUntil: 'networkidle' });
  expect(!(await page.locator('a[href^="/p/"], a[href*="/admin/links"]').count()), '/work/ links to no share link or the manager');
  const home = await page.request.get(BASE + '/');
  expect(!/noindex/.test(home.headers()['x-robots-tag'] || '') && !/noindex/.test(await home.text()), 'plain home page stays indexable');
  await ctx.close();

  // A fresh browser with no saved state opens the same project.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, bypassCSP: true });
  const fp = await fresh.newPage();
  await fp.goto(BASE + share('frost-heave'), { waitUntil: 'networkidle' });
  const fs = await shown(fp);
  expect(fs.feature.join() === 'frost-heave' && fs.cards.length === 3, 'share link works in a new browser (phone)');
  expect(await fp.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'share link: no horizontal scroll on a phone');
  await fp.locator('#work').scrollIntoViewIfNeeded();
  await fp.screenshot({ path: path.join(out, 'p-frost-heave-phone.png') });
  await axe(fp, 'frost-heave share link, phone');
  await fresh.close();
}

// ── Plain home page: random, steady while browsing ───────────────────────
console.log('\nhome page');
{
  const picks = new Set();
  for (let i = 0; i < 8; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const a = await shown(page);
    picks.add(a.feature[0]);
    if (i === 0) {
      const next3 = [1, 2, 3].map((k) => a.rotation[(a.rotation.indexOf(a.feature[0]) + k) % a.rotation.length]);
      expect(a.feature.length === 1 && a.cards.join() === next3.join(), `home: one featured project (${a.feature}) and the three after it`);
      await page.goto(BASE + '/services/', { waitUntil: 'networkidle' });
      await page.locator('.site-header .wordmark').click();
      await page.waitForLoadState('networkidle');
      const b = await shown(page);
      expect(b.feature.join() === a.feature.join() && b.cards.join() === a.cards.join(), 'home: same project after browsing to another page and back');
      await page.reload({ waitUntil: 'networkidle' });
      expect((await shown(page)).feature.join() === a.feature.join(), 'home: same project after reload in the same session');
      const vids = await page.evaluate(() => [...document.querySelectorAll('#work [data-feature][hidden] video')].filter((v) => !v.paused).length);
      expect(vids === 0, 'home: no hidden clip keeps playing');
    }
    await ctx.close();
  }
  // Every possible pick shows its three supporting cards (as on its share link).
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, bypassCSP: true });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    const rotation = (await shown(page)).rotation;
    for (const slug of SLUGS) {
      await page.evaluate((s) => sessionStorage.setItem('rbt-home-feature', s), slug);
      await page.reload({ waitUntil: 'networkidle' });
      const s = await shown(page);
      const next3 = [1, 2, 3].map((k) => rotation[(rotation.indexOf(slug) + k) % rotation.length]);
      expect(s.feature.join() === slug && s.cards.join() === next3.join(), `home pick ${slug}: ${s.cards.join(', ')}`);
    }
    await ctx.close();
  }
  expect(picks.size >= 2, `home: new visits get different projects (${[...picks].join(', ')})`);
  // Without JavaScript the home page shows its default, complete.
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto(BASE + '/', { waitUntil: 'networkidle' });
  const n = await np.evaluate(() => ({
    f: [...document.querySelectorAll('#work [data-feature]')].filter((el) => !el.hidden).length,
    c: [...document.querySelectorAll('#work .demo')].filter((el) => !el.hidden).length,
  }));
  expect(n.f === 1 && n.c === 3, 'home without JavaScript: one featured project and three cards');
  await nojs.close();
}

// ── Without JavaScript the footer mark links to the /admin/ sign-in page ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, bypassCSP: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/terms/', { waitUntil: 'networkidle' });
  const link = page.locator('.site-footer .admin-key__link');
  expect(await link.isVisible() && (await link.getAttribute('href')) === '/admin/' && !(await page.locator('.admin-key__form').first().isVisible()), 'no JavaScript: the footer mark is a link to /admin/');
  await page.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
  await page.locator('#key').fill(MASTER);
  await page.locator('#key').press('Enter');
  await page.waitForURL(/\/admin\/links\/$/);
  expect(true, 'no JavaScript: /admin/ form signs in');
  await ctx.close();
}

// ── Admin mark (footer on wide screens, menu drawer on phones) and link manager ──
console.log('\nlink manager');
for (const vp of [{ name: 'desktop', width: 1366, height: 860 }, { name: 'phone', width: 320, height: 640 }]) {
  const phone = vp.name === 'phone';
  const ctx = await browser.newContext({ viewport: vp, isMobile: phone, hasTouch: phone, bypassCSP: true });
  if (!phone) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  // Desktop: the footer's mark. Phone: the drawer's (open the menu first).
  const openMenu = async () => { if (phone) { await page.locator('.site-nav__toggle').click(); await page.waitForTimeout(300); } };
  await page.goto(BASE + '/services/', { waitUntil: 'networkidle' });
  const mark = page.locator(phone ? '.site-nav__admin .admin-key button' : '.site-footer__legal .admin-key button');
  const other = page.locator(phone ? '.site-footer__legal .admin-key button' : '.site-nav__admin .admin-key button');
  const field = page.locator(phone ? '#admin-key-menu' : '#admin-key');
  if (phone) expect(!(await mark.isVisible()), 'phone: drawer mark hidden while the menu is closed');
  await openMenu();
  expect((await mark.getAttribute('aria-label')) === 'Admin sign-in' && (await mark.getAttribute('aria-expanded')) === 'false' && await mark.isVisible() && !(await other.isVisible()), `${vp.name}: one mark (${phone ? 'drawer' : 'footer'}), a button with an accessible name, closed`);
  if (phone) {
    const last = await page.evaluate(() => document.querySelector('#site-nav-list > li:last-child')?.className);
    expect(last === 'site-nav__admin', `phone: mark is the last item in the drawer (${last})`);
  } else {
    const order = await page.evaluate(() => [...document.querySelector('.site-footer__copy').children].map((el) => el.tagName + (el.className ? '.' + el.className : '')));
    expect(order.join() === 'P,DIV.admin-key', `desktop: mark sits right after the copyright (${order})`);
  }
  expect(await page.$$eval('.site-footer__legal ul > li', (li) => li.map((l) => l.textContent.trim()).join()) === 'Privacy,Terms', `${vp.name}: Privacy and Terms unchanged`);
  const box = await mark.boundingBox();
  expect(box && box.width >= 24 && box.height >= 24, `${vp.name}: mark is at least 24×24`);
  expect(!(await field.isVisible()) && !(await page.locator('.admin-key__link:visible').count()), `${vp.name}: key field closed, fallback link replaced`);

  // Manager closed without a session.
  const res = await page.goto(BASE + '/admin/links/', { waitUntil: 'networkidle' });
  expect(new URL(page.url()).pathname === '/admin/' && !(await page.locator('[data-share]').count()), `${vp.name}: /admin/links/ without a session → sign-in, no links (${res.status()})`);

  // Keyboard: reach the mark, open the field in place, sign in.
  await page.goto(BASE + '/privacy/', { waitUntil: 'networkidle' });
  await openMenu();
  await mark.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  expect((await mark.getAttribute('aria-expanded')) === 'true' && await field.isVisible() && await field.evaluate((el) => el === document.activeElement), `${vp.name}: Enter opens the key field and focuses it`);
  expect(new URL(page.url()).pathname === '/privacy/', `${vp.name}: opening the field stays on the page`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect((await mark.getAttribute('aria-expanded')) === 'false' && !(await field.isVisible()) && await mark.evaluate((el) => el === document.activeElement), `${vp.name}: Escape closes it and returns focus to the mark`);
  if (phone) expect(await page.locator('.site-nav.is-open').count() === 1, 'phone: Escape in the prompt leaves the menu open');
  await page.screenshot({ path: path.join(out, `mark-closed-${vp.name}.png`) });
  await mark.click();
  await page.waitForTimeout(1000);
  if (!phone) {
    // Easter egg: wrong. → wrong! → intruder alert → /watching/. Only "admin" reaches the gate
    // (5 failures per visitor per 15 minutes); answers under 4 characters are refused in the page.
    const say = async (answer) => { await field.fill(answer); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      return { ph: await field.getAttribute('placeholder'), st: await field.locator('xpath=..').locator('[data-admin-status]').textContent(), path: new URL(page.url()).pathname }; };
    let r = await say('abc');
    expect(r.ph === 'wrong.' && r.st === 'Wrong.' && r.path === '/privacy/' && (await field.inputValue()) === '', '1st wrong answer → “wrong.”, field cleared');
    r = await say('admin');
    expect(r.ph === 'wrong!' && r.st === 'Wrong!' && r.path === '/privacy/', '2nd wrong answer (“admin”, checked by the gate) → “wrong!”');
    r = await say('xyz');
    expect(r.ph === 'intruder alert' && r.st === 'Intruder alert.' && await page.locator('.admin-key.is-alert').count() === 1, `3rd wrong answer → “intruder alert” (${JSON.stringify(r)})`);
    await page.screenshot({ path: path.join(out, 'mark-intruder.png') });
    await page.waitForURL(/\/watching\/$/, { timeout: 5000 });
    await page.waitForTimeout(5500);   // let the field log finish
    expect((await page.locator('h1').textContent()) === 'WE ARE WATCHING YOU.', '…then the “we are watching you” page');
    const egg = await page.evaluate(() => ({ robots: document.querySelector('meta[name=robots]')?.content, text: document.body.innerText.replace(/\s+/g, ' ').trim(), overflow: document.documentElement.scrollWidth - innerWidth, tall: document.documentElement.scrollHeight - innerHeight }));
    expect(/noindex/.test(egg.robots) && /^← Back CLASSIFIED · EYES ONLY WE ARE WATCHING YOU\.$/i.test(egg.text) && egg.overflow <= 0 && egg.tall <= 0, `egg page: noindex, only the eye, the words and Back beside the tab, fits one screen (${egg.text})`);
    await page.screenshot({ path: path.join(out, 'watching-desktop.png'), fullPage: true });
    await axe(page, '/watching/ desktop');
    expect(!(await page.request.get(BASE + '/sitemap.xml').then((x) => x.text())).includes('/watching/'), 'egg page not in the sitemap');
    await page.locator('[data-back]').click();
    await page.waitForURL(/\/privacy\/$/, { timeout: 5000 });
    expect(true, 'Back returns to the page the prompt was on');
    // The count starts over: the next wrong answer says “wrong.” again.
    await page.goto(BASE + '/privacy/', { waitUntil: 'networkidle' });
    await openMenu();
    await mark.click(); await page.waitForTimeout(1000);
    r = await say('abc');
    expect(r.ph === 'wrong.', 'after the egg the count starts over');
    await mark.click(); await page.waitForTimeout(300); await mark.click(); await page.waitForTimeout(1000);
  }
  await field.fill(MASTER);
  await page.screenshot({ path: path.join(out, `mark-open-${vp.name}.png`) });
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/admin\/links\/$/);
  expect(true, `${vp.name}: master key typed at the mark opens the link manager`);
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${vp.name}: manager has no horizontal scroll`);

  const listed = await page.$$eval('[data-share] .share__url', (els) => els.map((e) => e.value));
  expect(listed.length === SLUGS.length && SLUGS.every((s) => listed.includes(`https://randybuilds.tech${share(s)}`)), `${vp.name}: one share link per project (${listed.length})`);

  const card = page.locator('.demo[data-demo="frost-heave"]');
  const toggle = card.locator('[data-share-toggle]');
  expect(/Share: Frost Heave Creamery/.test(await toggle.textContent()), `${vp.name}: Share button names its project`);
  await toggle.focus();
  await page.keyboard.press('Enter');
  expect((await toggle.getAttribute('aria-expanded')) === 'true' && await card.locator('.share__url').isVisible(), `${vp.name}: Share opens the link (keyboard)`);
  expect((await card.locator('label.share__label').textContent()).includes('Frost Heave Creamery'), `${vp.name}: link field is labelled with the project`);
  if (!phone) {
    await card.locator('[data-share-copy]').click();
    await page.waitForTimeout(200);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip === `https://randybuilds.tech${share('frost-heave')}`, 'copy puts the link on the clipboard');
    expect((await card.locator('[role=status]').textContent()).startsWith('Copied'), 'copy says Copied');
  } else {
    // No clipboard access: the link is selected for copying by hand.
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } }); document.execCommand = () => false; });
    await card.locator('[data-share-copy]').click();
    await page.waitForTimeout(200);
    const sel = await page.evaluate(() => { const i = document.activeElement; return i?.classList.contains('share__url') ? i.value.slice(i.selectionStart, i.selectionEnd) : ''; });
    expect(sel === `https://randybuilds.tech${share('frost-heave')}`, 'phone, no clipboard: link is selected');
    expect(/Couldn’t copy/.test(await card.locator('[role=status]').textContent()), 'phone, no clipboard: says how to copy by hand');
  }
  await page.screenshot({ path: path.join(out, `manager-${vp.name}.png`), fullPage: !phone });
  await axe(page, `/admin/links/ ${vp.name}`);

  // Sign out ends the session.
  await page.locator('.admin-out button').click();
  await page.waitForURL((u) => new URL(u).pathname === '/');
  await page.goto(BASE + '/admin/links/', { waitUntil: 'networkidle' });
  expect(new URL(page.url()).pathname === '/admin/', `${vp.name}: after sign out the manager is closed`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall share-link tests passed');
process.exit(failures ? 1 : 0);
