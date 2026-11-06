// Clicks every visible control on each concept demo and reports any click
// that changes nothing (no DOM change, dialog, navigation, download or
// scroll). Each control is tested from a fresh page: the crawler replays the
// clicks that revealed it (opening a dialog, choosing a date …), up to three
// steps deep. Flagged controls need a human look; some are fine (a native
// "please fill out this field" bubble, a link to where you already are).
//   node tests/buttons-crawl.mjs [desktop|phone] [slug ...]   (after `tech preview`)
import { chromium } from 'playwright-core';
import { chromePath } from '../scripts/chrome.mjs';

const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const args = process.argv.slice(2);
const vpName = ['desktop', 'phone'].includes(args[0]) ? args.shift() : 'desktop';
const slugs = args.length ? args : ['auto-repair', 'landscaping', 'cleaning', 'frost-heave', 'ember-rye', 'alder-pine', 'tidewater', 'cove'];
const viewport = vpName === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const MAX_DEPTH = 3;

// In the page: the controls in scope (the top open dialog, else the document), keyed stably.
const inPage = {
  list() {
    const sel = 'button, a[href], [role=button], [role=tab], summary, label:has(input[type=radio]), label:has(input[type=checkbox])';
    const scope = [...document.querySelectorAll('dialog[open]')].pop() ?? document;
    const key = (el) => [el.tagName, (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      ...[...el.attributes].filter((a) => a.name.startsWith('data-') && !a.name.startsWith('data-astro') && a.name !== 'data-crawl').map((a) => `${a.name}=${a.value}`),
      el.getAttribute('href') || ''].join('|');
    return [...scope.querySelectorAll(sel)].filter((el) => !el.disabled && el.getClientRects().length && !el.closest('[inert],[hidden]')).map(key);
  },
  mark(k) {
    const sel = 'button, a[href], [role=button], [role=tab], summary, label:has(input[type=radio]), label:has(input[type=checkbox])';
    const scope = [...document.querySelectorAll('dialog[open]')].pop() ?? document;
    const key = (el) => [el.tagName, (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      ...[...el.attributes].filter((a) => a.name.startsWith('data-') && !a.name.startsWith('data-astro') && a.name !== 'data-crawl').map((a) => `${a.name}=${a.value}`),
      el.getAttribute('href') || ''].join('|');
    document.querySelectorAll('[data-crawl]').forEach((e) => e.removeAttribute('data-crawl'));
    const el = [...scope.querySelectorAll(sel)].find((e) => !e.disabled && e.getClientRects().length && key(e) === k);
    el?.setAttribute('data-crawl', '');
    return !!el;
  },
  sig() {
    const html = document.body.innerHTML.replace(/\s?(is-pressed|is-bump|is-pop|is-landed|is-hot)\b/g, '').replace(/ data-crawl=""/g, '');
    let h = 0;
    for (let i = 0; i < html.length; i++) h = (h * 31 + html.charCodeAt(i)) | 0;
    const vals = [...document.querySelectorAll('input, select, textarea')].map((i) => (i.type === 'checkbox' || i.type === 'radio' ? i.checked : i.value)).join('|');
    const scrolls = [...document.querySelectorAll('*')].filter((e) => e.scrollTop || e.scrollLeft).map((e) => `${e.scrollTop},${e.scrollLeft}`).join(';');
    return [location.href, document.querySelectorAll('dialog[open]').length, h, vals, Math.round(scrollY), scrolls].join('§');
  },
};

const browser = await chromium.launch({ executablePath: chromePath() });
let total = 0;
for (const slug of slugs) {
  const url = `${BASE}/concepts/${slug}/`;
  const ctx = await browser.newContext({ viewport, isMobile: vpName === 'phone', hasTouch: vpName === 'phone', reducedMotion: 'reduce', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = new Set();
  page.on('pageerror', (e) => errors.add(String(e).slice(0, 160)));
  let downloaded = false;
  page.on('download', () => { downloaded = true; });
  const click = async (k) => {
    if (!(await page.evaluate(inPage.mark, k))) return false;
    const loc = page.locator('[data-crawl]');
    await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    try { await loc.click({ timeout: 2000 }); } catch { try { await loc.click({ timeout: 1500, force: true }); } catch { return 'blocked'; } }
    await page.waitForTimeout(160);
    return true;
  };
  // Fresh page, then replay a path of clicks. Returns false if the path no longer works.
  const reach = async (path) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    await ctx.clearCookies();
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
    await page.goto(url, { waitUntil: 'networkidle' });
    for (const k of path) if ((await click(k)) !== true || !page.url().startsWith(url)) return false;
    return true;
  };
  await reach([]);
  const queue = (await page.evaluate(inPage.list)).map((k) => ({ k, path: [] }));
  const seen = new Set(queue.map((q) => q.k));
  const dead = [], blocked = [], unreached = [];
  let tested = 0;
  while (queue.length) {
    const { k, path } = queue.shift();
    if (!(await reach(path))) { unreached.push(k); continue; }
    if (!(await page.evaluate(inPage.mark, k))) { unreached.push(k); continue; }
    await page.locator('[data-crawl]').scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(40);
    const before = await page.evaluate(inPage.sig);
    downloaded = false;
    const r = await click(k);
    if (r === 'blocked') { blocked.push(k); continue; }
    tested++;
    if (!page.url().startsWith(url)) continue; // went to another page: that's an effect
    if (before === (await page.evaluate(inPage.sig)) && !downloaded) dead.push(k);
    if (path.length + 1 < MAX_DEPTH) {
      for (const n of await page.evaluate(inPage.list)) if (!seen.has(n)) { seen.add(n); queue.push({ k: n, path: [...path, k] }); }
    }
  }
  console.log(`\n${slug} (${vpName}): ${tested} controls clicked · ${dead.length} no visible effect · ${blocked.length} not clickable · ${unreached.length} not re-reachable${errors.size ? ` · script errors: ${[...errors].join(' | ')}` : ''}`);
  for (const d of dead) console.log('  NO EFFECT  ', d);
  for (const d of blocked) console.log('  BLOCKED    ', d);
  total += dead.length + blocked.length + errors.size;
  await ctx.close();
}
await browser.close();
console.log(total ? `\n${total} to review` : '\nevery control responded');
process.exit(total ? 1 : 0);
