// Browser check of the resource center: key pages at desktop and phone width,
// no horizontal scroll, no console errors, axe (WCAG A/AA), the phone menu,
// search, directory filters and the migrated content.
//   RBR_URL=http://127.0.0.1:18490/resources node wordpress/tests/e2e.mjs        (after rbr.sh local)
//   RBR_URL=https://randybuilds.tech/resources node wordpress/tests/e2e.mjs
// Screenshots go to wordpress/tests/out/ (gitignored).
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromePath } from '../../scripts/chrome.mjs';
import { loadTs } from '../../tests/load-ts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const base = (process.env.RBR_URL || 'http://127.0.0.1:18490/resources').replace(/\/$/, '');
const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
const axe = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const data = JSON.parse(readFileSync(path.join(here, '../migrate/data.json'), 'utf8'));
// Listings: the main site's list (src/content/resources.ts) has every published listing, including
// those added in WordPress after the import (data.json is the frozen import snapshot).
data.resources = (await loadTs(path.join(root, 'src/content/resources.ts'))).resources;

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.log(`  ✗ ${m}`); };
const check = (cond, m) => (cond ? ok(m) : fail(m));

const pages = [
  ['home', '/'],
  ['directory', '/directory/'],
  ['guides', '/topic/guides/'],
  ['topic', '/topic/accessibility/'],
  ['tag', '/tag/free-tier/'],
  ['guide', '/website-project-checklist/'],
  ['listing', '/sba-plan-your-business/'],
  ['search', '/?s=booking'],
  ['filtered', '/directory/?topic=accessibility&cost=free'],
  ['404', '/no-such-page/'],
];

const browser = await chromium.launch({ executablePath: chromePath() });
for (const [vw, vh, label] of [[1366, 900, 'desktop'], [390, 844, 'phone']]) {
  console.log(`▸ ${label} ${vw}×${vh}`);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await ctx.newPage();
  const errors = [];
  // The 404 page's own status shows up as a console error; anything else counts.
  page.on('console', (m) => { if (m.type() === 'error' && !page.url().includes('/no-such-page/')) errors.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const [name, url] of pages) {
    const res = await page.goto(base + url, { waitUntil: 'networkidle' });
    const status = res.status();
    check(name === '404' ? status === 404 : status === 200, `${name}: HTTP ${status}`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(wide <= 0, `${name}: no horizontal scroll (${wide}px)`);
    const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Schibsted Grotesk"'); });
    check(fontOk, `${name}: brand font loaded`);
    await page.addScriptTag({ content: axe });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations
      .map((x) => `${x.id} (${x.nodes.length}): ${x.nodes[0]?.target}`));
    check(v.length === 0, `${name}: axe ${v.length ? v.join('; ') : 'clean'}`);
    await page.screenshot({ path: path.join(out, `${label}-${name}.png`), fullPage: name === 'home' || name === 'guide' || name === 'listing' });
  }
  check(errors.length === 0, `console: ${errors.length ? errors.join(' | ') : 'no errors'}`);

  if (label === 'phone') {
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const toggle = page.locator('.site-nav__toggle');
    check(await toggle.isVisible(), 'menu button shows on a phone');
    await toggle.click();
    check(await page.locator('#site-nav-list').isVisible(), 'menu opens');
    await page.screenshot({ path: path.join(out, 'phone-menu.png') });
    await page.keyboard.press('Escape');
    check((await toggle.getAttribute('aria-expanded')) === 'false', 'Escape closes the menu');
    // The main site's >_ admin mark, at the bottom of the drawer: opens the "who are you?" prompt in place.
    await toggle.click();
    const mark = page.locator('.site-nav__admin .admin-key button');
    check(await page.evaluate(() => document.querySelector('#site-nav-list > li:last-child')?.className) === 'site-nav__admin' && await mark.isVisible(), 'drawer: >_ mark is the last item');
    await mark.click();
    await page.waitForTimeout(1000);
    check(await page.locator('#admin-key-menu').isVisible() && await page.locator('#admin-key-menu').evaluate((el) => el === document.activeElement) && !(await page.locator('.site-footer .admin-key').isVisible()), 'drawer: the mark opens the key prompt (none in the footer on a phone)');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check(!(await page.locator('#admin-key-menu').isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'true', 'drawer: Escape closes the prompt, not the menu');
    await page.keyboard.press('Escape');
    // Back to top: hidden at the top, shown a screen down, back at the top with focus on <main>.
    const totop = page.locator('.totop');
    check(!(await totop.isVisible()), 'back to top: hidden at the top');
    await page.evaluate(() => scrollTo(0, innerHeight * 2));
    await page.waitForTimeout(400);
    check(await totop.isVisible(), 'back to top: shown a screen down');
    await totop.click();
    await page.waitForFunction(() => scrollY === 0, null, { timeout: 3000 }).catch(() => {});
    check(await page.evaluate(() => scrollY === 0 && document.activeElement?.id === 'main' && !location.hash), 'back to top: scrolls up, focuses main, no hash');
  } else {
    // Navigation and content.
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const navText = await page.locator('#site-nav-list').innerText();
    check(['Services', 'Work', 'Resources', 'About', 'FAQ', 'Start a project'].every((t) => navText.includes(t)), 'header menu matches the main site: Services · Work · Resources · About · FAQ · Start a project');
    const mark = page.locator('.site-footer__copy > p + .admin-key button');
    check(await mark.isVisible() && !(await page.locator('.site-nav__admin .admin-key button').isVisible()), 'desktop: >_ mark right after the footer copyright, not in the header');
    await mark.click();
    await page.waitForTimeout(1000);
    check(await page.locator('#admin-key').isVisible(), 'desktop: the footer mark opens the key prompt');
    await page.keyboard.press('Escape');
    check(await page.locator('.res-topic').count() === data.categories.length, `home lists ${data.categories.length} topics`);
    check(await page.locator('.guide-card').count() === data.guides.length, `home lists ${data.guides.length} guides`);
    await page.fill('.page-head input[type=search]', 'contrast');
    await Promise.all([page.waitForNavigation(), page.click('.page-head .res-search button')]);
    check(await page.locator('.res__name', { hasText: 'Contrast Checker' }).count() > 0, 'search for "contrast" finds the WebAIM Contrast Checker');
    await page.goto(base + '/directory/', { waitUntil: 'networkidle' });
    check(await page.locator('.res').count() === data.resources.length, `directory shows all ${data.resources.length} listings`);
    const visits = await page.$$eval('.res__visit', (as) => [...new Set(as.map((a) => a.childNodes[0].textContent.trim()))]);
    check(visits.join() === 'Visit site' && await page.locator('.res__url').count() === data.resources.length, 'cards: every button reads "Visit site", the address is under the name');
    const one = await page.context().newPage();
    await one.goto(base + '/webaim-wave/', { waitUntil: 'networkidle' });
    check((await one.locator('.wp-block-button__link').innerText()).trim() === 'Visit site' && (await one.locator('.page-head h1 + .listing__url a').innerText()).includes('wave.webaim.org'), 'listing: "Visit site" button, address below the name');
    await one.close();
    await page.selectOption('#f-cost', 'free-tier');
    await Promise.all([page.waitForNavigation(), page.click('.res-filters button[type=submit]')]);
    const tiers = data.resources.filter((r) => r.price === 'free-tier').length;
    check(await page.locator('.res').count() === tiers && page.url().includes('cost=free-tier'), `cost filter: ${tiers} free tiers, mirrored in the URL`);

    // Search metadata: canonicals on list pages, filtered views kept out of the index, structured
    // data that parses and only describes what is on the page (no ratings or reviews).
    const head = async (url) => {
      const html = await (await fetch(base + url)).text();
      const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
      return { html, ld, canonical: html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], robots: html.match(/<meta name='robots' content='([^']+)'/)?.[1] ?? '' };
    };
    const dir = await head('/directory/');
    check(dir.canonical === `${base}/directory/` && !dir.robots.includes('noindex'), 'directory: canonical to itself, indexable');
    const coll = dir.ld.find((d) => d?.['@type'] === 'CollectionPage');
    check(!dir.ld.includes(null) && coll?.mainEntity?.numberOfItems === data.resources.length, `directory: JSON-LD parses, ItemList has all ${data.resources.length} listings`);
    check(dir.html.includes('class="res-policy"') && dir.html.includes('not an endorsement or a partnership'), 'directory: says how listings are chosen');
    const filt = await head('/directory/?topic=accessibility&cost=free');
    check(filt.robots.includes('noindex') && filt.robots.includes('follow') && !filt.canonical, 'filtered directory: noindex, follow, no canonical');
    const topic = await head('/topic/accessibility/');
    check(topic.canonical === `${base}/topic/accessibility/` && topic.ld.some((d) => d?.['@type'] === 'BreadcrumbList'), 'topic: canonical and breadcrumbs');
    check(topic.html.includes('class="res-next"') && topic.html.includes('/services/existing-projects/') && topic.html.includes('/basic-accessibility-review/'), 'topic: one guide and one related service after the listings');
    const sec = await head('/topic/cybersecurity-and-privacy/');
    check(!sec.html.includes('class="res-next"'), 'topic without a matching service: no pitch');
    const guide = await head('/website-project-checklist/');
    check(guide.ld.some((d) => d?.['@type'] === 'Article' && d.dateModified), 'guide: Article with dates');
    const all = [dir, filt, topic, sec, guide].map((h) => JSON.stringify(h.ld)).join();
    check(!/aggregateRating|"review"|"Review"|"offers"/.test(all), 'structured data: no ratings, reviews or offers');
    const stack = data.resources.filter((r) => r.url.includes('stackpdf.com'));
    check(stack.length === 1 && dir.html.split('/stackpdf-client-paperwork-checklist/">Client paperwork checklist<').length === 2, 'Stack PDF checklist listed once');

    // Every listing: own page, wording and official link preserved.
    let bad = [];
    for (const r of data.resources) {
      const html = await (await fetch(`${base}/${r.id}/`)).text();
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!html.includes(esc(r.description)) || !html.includes(esc(r.goodFor)) || !html.includes(`href="${r.url.replace(/&/g, '&#038;')}"`) && !html.includes(`href="${esc(r.url)}"`)) bad.push(r.id);
    }
    check(bad.length === 0, `all ${data.resources.length} listings keep description, "Good for" and official link${bad.length ? ': ' + bad.join(', ') : ''}`);
    bad = [];
    for (const g of data.guides) {
      const html = await (await fetch(`${base}/${g.slug}/`)).text();
      const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const want = text(g.body), got = text(html);
      const missing = want.split(/(?<=[.?!:])\s/).filter((s) => s.length > 12 && !got.includes(s));
      const related = (g.related ?? []).every((id) => html.includes(`/${id}/`));
      if (missing.length || !related) bad.push(`${g.slug} (${missing.length} sentences missing${related ? '' : ', related links missing'})`);
    }
    check(bad.length === 0, `all ${data.guides.length} guides keep every sentence and related resources${bad.length ? ': ' + bad.join(', ') : ''}`);
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
