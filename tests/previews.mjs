// Private previews, end to end against the localhost preview stack (uses the
// fixed QA codes from compose.preview.yaml, never real ones): the access form,
// the gate (one code opens one project, the master key opens the vault and
// every project), headers, and the vault index at phone/tablet/desktop widths
// with axe and overflow. Set QA_PREVIEW_ID / QA_PREVIEW_CODE to a preview that
// exists in compose.preview.yaml; with none configured the test is skipped.
//   node tests/previews.mjs        (after: tech preview)
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/out/previews');
mkdirSync(out, { recursive: true });
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const CODE = process.env.QA_PREVIEW_CODE || '';
const ID = process.env.QA_PREVIEW_ID || '';
if (!ID || !CODE) { console.log('  skip  no private preview configured (client previews removed 2026-11-04); set QA_PREVIEW_ID and QA_PREVIEW_CODE'); process.exit(0); }
const OTHER = 'QA00-0000-OT02';
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

const viewports = [
  { name: 'phone-320', width: 320, height: 640 },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL', m); };
const ok = (m) => console.log('  ok  ', m);
const expect = (c, m) => (c ? ok(m) : fail(m));

const browser = await chromium.launch({ executablePath: chromePath() });

async function login(ctx, code) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/preview/`);
  await page.fill('#code', code);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  return page;
}

// ── Access flow ──────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/preview/${ID}/`);
  expect(new URL(page.url()).pathname === '/preview/', 'no session: preview redirects to the access form');
  expect(await page.textContent('h1') === 'Your website preview', 'access page heading');
  expect((await page.textContent('main')).includes('Enter your private preview code to view a website concept prepared for your business.'), 'access page text');
  expect(await page.textContent('label[for=code]') === 'Preview code' && (await page.textContent('button[type=submit]')).trim() === 'View preview', 'input label and button text');
  await page.fill('#code', ID);
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
  expect(new URL(page.url()).pathname === '/preview/try-again/', 'the project id is not a code');
  expect(await page.isVisible('[role=alert]'), 'error message shown');
  await page.fill('#code', `  ${CODE.toLowerCase()}  `);
  await Promise.all([page.waitForURL((u) => u.pathname !== '/preview/try-again/'), page.click('button[type=submit]')]);
  await page.waitForURL(`**/preview/${ID}/`);
  expect(new URL(page.url()).pathname === `/preview/${ID}/`, 'right code (lower case, padded) opens the project');
  const [c] = await ctx.cookies();
  expect(c && c.httpOnly && c.secure && c.sameSite === 'Lax' && c.path === '/', 'session cookie HttpOnly + Secure + SameSite=Lax, path /');
  expect(await page.evaluate(() => document.cookie.includes('rbt_preview')) === false, 'gate cookie not readable from page script');
  const r = await page.goto(`${BASE}/preview/`);
  expect(r.status() === 200, 'access page still reachable when signed in');
  await ctx.close();

  const ctx2 = await browser.newContext();
  const p2 = await login(ctx2, OTHER);
  const res = await p2.goto(`${BASE}/preview/${ID}/`);
  expect(new URL(p2.url()).pathname === '/preview/' && res.status() === 200, "another business's code cannot open this project");
  await ctx2.close();
}

// ── Master key → vault index with every project ─────────────────────────
{
  const ctx = await browser.newContext();
  const page = await login(ctx, '  qa-master key ');
  expect(new URL(page.url()).pathname === '/preview/vault/' && (await page.textContent('h1')) === 'All projects', 'master key opens the vault index');
  const hrefs = await page.$$eval('.v-card h3 a', (as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.includes(`/preview/${ID}/`), `vault lists every project (${hrefs.join(', ')})`);
  for (const h of hrefs) {
    const r = await page.goto(BASE + h);
    if (r.status() !== 200 || new URL(page.url()).pathname !== h) fail(`master key: ${h} did not open`);
  }
  ok('master key opens every listed project directly');
  const hd = (await page.request.get(`${BASE}/preview/vault/`)).headers();
  expect(/noindex/.test(hd['x-robots-tag'] || '') && /no-store/.test(hd['cache-control'] || '') && !/cloudflareinsights/.test(hd['content-security-policy'] || ''), 'vault headers: X-Robots-Tag noindex, no-store, CSP without analytics');
  const ph = (await page.request.get(`${BASE}/preview/${ID}/`)).headers();
  expect(/noindex/.test(ph['x-robots-tag'] || ''), 'project headers: X-Robots-Tag noindex');
  await ctx.close();
  const ctx2 = await browser.newContext();
  const p2 = await login(ctx2, CODE);
  await p2.goto(`${BASE}/preview/vault/`);
  expect(new URL(p2.url()).pathname === '/preview/', 'a project code can’t open the vault index');
  await ctx2.close();
}

// ── The vault index at every width ───────────────────────────────────────
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, bypassCSP: true });
  const page = await login(ctx, 'QA-MASTER-KEY');
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/preview/vault/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(out, `vault-${vp.name}.png`), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) fail(`${vp.name} vault: horizontal overflow ${overflow}px`);
  const robots = await page.getAttribute('meta[name=robots]', 'content');
  if (!robots?.includes('noindex')) fail(`${vp.name} vault: no noindex meta`);
  if (vp.name === 'phone-390' || vp.name === 'laptop-1366') {
    await page.addScriptTag({ content: axeSource });
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }))
      .violations.map((x) => `${x.id} x${x.nodes.length} ${x.nodes[0]?.target.join(' ')}`));
    for (const x of v) fail(`${vp.name} vault: axe ${x}`);
  }
  if (errors.length) fail(`${vp.name}: console errors ${[...new Set(errors)].join(' | ')}`);
  else ok(`${vp.name}: vault index renders, no overflow`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s). Screenshots: tests/out/previews/` : '\nall preview checks passed. Screenshots: tests/out/previews/');
process.exit(failures ? 1 : 0);
