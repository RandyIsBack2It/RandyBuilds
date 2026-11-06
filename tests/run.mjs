// Full QA pass against a running copy of the site (default: the localhost
// preview container). Writes screenshots and a JSON report to tests/out/.
//   QA_BASE=http://127.0.0.1:18480 pnpm test
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from '../scripts/chrome.mjs';
import { loadTs } from './load-ts.mjs';
import { stubTurnstile } from './turnstile-stub.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { shareCode } = await loadTs(path.join(root, 'src/lib/share-code.ts'));
const out = path.join(root, 'tests/out');
mkdirSync(out, { recursive: true });
const BASE = (process.env.QA_BASE || 'http://127.0.0.1:18480').replace(/\/$/, '');
const axeSource = readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');

const slugs = ['auto-repair', 'landscaping', 'cleaning', 'frost-heave', 'ember-rye', 'alder-pine', 'tidewater', 'cove'];
const serviceSlugs = ['websites', 'redesigns', 'web-apps', 'existing-projects', 'website-management', 'server-setup'];
const pages = ['/', '/work/', '/explore/', '/arcade/', '/arcade/patch-quest/', '/arcade/after-hours/', '/arcade/cross-wire/', '/services/', ...serviceSlugs.map((s) => `/services/${s}/`), '/resources/suggest/', '/privacy/', '/terms/', '/message-sent/', '/message-not-sent/', `/p/${shareCode('frost-heave')}/`, '/admin/', '/work/unmaskd/', ...slugs.map((s) => `/work/${s}/`), ...slugs.map((s) => `/concepts/${s}/`), '/does-not-exist/'];
const viewports = [
  { name: 'mobile-320', width: 320, height: 640 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1680', width: 1680, height: 1050 },
];

const failures = [];
const fail = (msg) => { failures.push(msg); console.log('  FAIL', msg); };
const report = { base: BASE, pages: {} };

const browser = await chromium.launch({ executablePath: chromePath() });
const realContext = stubTurnstile(browser);

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: vp.name === 'mobile-390' ? 'reduce' : 'no-preference', bypassCSP: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !page.url().includes('does-not-exist') && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const p of pages) {
    const res = await page.goto(BASE + p, { waitUntil: 'networkidle' });
    const expected = p.includes('does-not-exist') ? 404 : 200;
    if (res.status() !== expected) fail(`${vp.name} ${p}: status ${res.status()}, expected ${expected}`);
    await page.waitForTimeout(1600); // let the one-time hero drawing finish
    const slug = (p === '/' ? 'home' : p.replace(/\W+/g, '-').replace(/^-|-$/g, ''));
    await page.screenshot({ path: path.join(out, `${slug}-${vp.name}.png`), fullPage: true });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) fail(`${vp.name} ${p}: horizontal overflow ${overflow}px`);

    const fontsOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return ['Bricolage Grotesque', 'Atkinson Hyperlegible Next'].every((f) => document.fonts.check(`16px "${f}"`));
    });
    if (!fontsOk) fail(`${vp.name} ${p}: web fonts not loaded`);

    // Small tap targets (WCAG 2.2 2.5.8: 24×24 minimum) for links/buttons outside running text.
    const small = await page.evaluate(() => [...document.querySelectorAll('a, button')]
      .filter((el) => el.offsetParent && !el.closest('p, li.project__built, .prose'))
      .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
      .map(({ t, r }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`));
    if (small.length) fail(`${vp.name} ${p}: small targets ${small.join(', ')}`);

    if (vp.name === 'laptop-1280' || vp.name === 'mobile-390') {
      await page.addScriptTag({ content: axeSource });
      const axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target.join(' ') }));
      });
      report.pages[`${p} @ ${vp.name}`] = { axe };
      for (const v of axe) fail(`${vp.name} ${p}: axe ${v.id} (${v.impact}) x${v.nodes} e.g. ${v.sample}`);
    }
  }
  if (errors.length) fail(`${vp.name}: console errors: ${[...new Set(errors)].join(' | ')}`);
  await ctx.close();
}

// Real CSP (the passes above bypass it to inject axe): no violations anywhere.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const violations = [];
  page.on('console', (m) => /Content Security Policy/i.test(m.text()) && violations.push(`${page.url()}: ${m.text().slice(0, 140)}`));
  for (const p of pages) { await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(200); }
  for (const v of violations) fail(`CSP: ${v}`);
  await ctx.close();
}

// The real Cloudflare Turnstile widget (test key on localhost) under the real CSP: it loads only
// when a form is near, adds a token to the form and takes no room. Needs the network.
{
  const ctx = await realContext();
  const page = await ctx.newPage();
  const violations = [], early = [];
  page.on('console', (m) => /Content Security Policy/i.test(m.text()) && violations.push(m.text().slice(0, 140)));
  page.on('request', (r) => r.url().includes('challenges.cloudflare.com') && early.push(r.url()));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  if (early.length) fail('turnstile: loaded before any form was near the screen');
  await page.goto(BASE + '/resources/suggest/', { waitUntil: 'load' });
  const token = await page.waitForFunction(() => document.querySelector('[name="cf-turnstile-response"]')?.value, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => '');
  if (!token) fail('turnstile: the real widget gave no token');
  if ((await page.locator('.cform__turnstile').boundingBox())?.height) fail('turnstile: the idle widget takes up room');
  for (const v of violations) fail(`turnstile CSP: ${v}`);
  await ctx.close();
}

// Back to top: hidden at the top, shown a screen down, returns to the top with focus on <main>, no hash.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/services/websites/', { waitUntil: 'networkidle' });
  const shown = () => page.locator('.totop').isVisible();
  if (await shown()) fail('back to top: visible at the top of the page');
  await page.mouse.wheel(0, 2500);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.totop')).visibility === 'visible').catch(() => fail('back to top: not shown after scrolling'));
  await page.click('.totop');
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 3000 }).catch(() => fail('back to top: did not return to the top'));
  const after = await page.evaluate(() => ({ focus: document.activeElement?.id, hash: location.hash }));
  if (after.focus !== 'main') fail('back to top: focus not moved to main');
  if (after.hash) fail('back to top: added a hash to the URL');
  await ctx.close();
}

// Contact form (requests intercepted: nothing is ever sent).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/#contact', { waitUntil: 'networkidle' });
  const form = page.locator('form[data-contact]');
  await form.getByRole('button', { name: 'Send message' }).click();
  const errs = await page.locator('.field__error').allTextContents();
  if (errs.length !== 3) fail(`form: expected 3 errors on empty submit, got ${errs.length}`);
  if ((await page.evaluate(() => document.activeElement?.id)) !== 'cf-name') fail('form: focus not moved to the first invalid field');
  if ((await page.getAttribute('#cf-email', 'aria-invalid')) !== 'true') fail('form: email not marked invalid');
  if (!(await page.getAttribute('#cf-email', 'aria-describedby'))?.includes('cf-email-error')) fail('form: error not linked to field');
  await page.screenshot({ path: path.join(out, 'form-errors-mobile-390.png'), fullPage: false });

  await page.fill('#cf-name', 'Test Person');
  if (await page.locator('#cf-name-error').count()) fail('form: error not cleared after correcting the field');
  await page.fill('#cf-email', 'test@example.com');
  await page.fill('#cf-message', 'I need a new website for my shop.');

  let route = { status: 500, body: '{}' };
  let sentBody = null;
  await page.route('**/api/contact', (r) => { sentBody = r.request().postDataJSON(); r.fulfill({ status: route.status, contentType: 'application/json', body: route.body }); });
  await form.getByRole('button', { name: 'Send message' }).click();
  // The Turnstile token (Cloudflare's test key on localhost) can take a moment.
  await page.waitForFunction(() => document.querySelector('.cform__status')?.textContent, null, { timeout: 20000 }).catch(() => {});
  const st = await page.locator('.cform__status').textContent();
  if (!st?.includes('didn’t send')) fail(`form: server failure message missing ("${st}")`);
  if (!sentBody || sentBody.hpot !== '' || !sentBody.t || !(Number(sentBody.e) > 0)) fail('form: payload missing honeypot/timestamp/time on page');
  if (!sentBody?.['cf-turnstile-response']) fail('form: payload missing the Turnstile token');
  if (await page.locator('form[data-contact] button[disabled]').count()) fail('form: button left disabled after failure');

  route = { status: 200, body: '{"ok":true}' };
  await form.getByRole('button', { name: 'Send message' }).click();
  await page.waitForSelector('.cform__done');
  const done = await page.locator('.cform__done').innerText();
  if (!done.includes('Message sent.') || !done.includes('test@example.com')) fail(`form: success panel wrong ("${done}")`);
  if (!(await page.evaluate(() => document.activeElement?.classList.contains('cform__done')))) fail('form: focus not moved to the success message');
  await page.screenshot({ path: path.join(out, 'form-sent-mobile-390.png') });
  await ctx.close();
}

// Explore what's possible: steps, branching, changing answers, results, the
// inquiry hand-off and Start over. Requests are intercepted: nothing is sent.
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, permissions: ['clipboard-read', 'clipboard-write'], bypassCSP: true });
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/api/contact', (r) => { posts.push(r.request().postDataJSON()); r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); });
  const count = () => page.locator('.xp__count').textContent();
  const visibleStep = () => page.locator('fieldset[data-step]:not([hidden])').getAttribute('data-step');
  const next = page.locator('[data-next]');
  const axe = async (where) => {
    await page.addScriptTag({ content: axeSource });
    const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((x) => `${x.id} e.g. ${x.nodes[0]?.target.join(' ')}`));
    for (const x of v) fail(`explore: ${where}: axe ${x}`);
  };
  const overflow = async (where) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 0) fail(`explore: ${where}: horizontal overflow ${o}px`); };

  await page.goto(BASE + '/explore/', { waitUntil: 'networkidle' });
  if ((await count()) !== 'Question 1 of 4') fail(`explore: progress reads "${await count()}"`);
  if (await page.locator('.xp__nojs').count()) fail('explore: no-JS note still shown');
  await next.click();
  if (!(await page.locator('#xp-err-stage').isVisible())) fail('explore: no error when continuing without an answer');
  if ((await page.evaluate(() => document.activeElement?.name)) !== 'stage') fail('explore: focus not moved to the options after the error');

  // Keyboard: Space picks, Enter continues; the new question gets focus.
  await page.focus('input[name="stage"][value="existing"]');
  await page.keyboard.press('Space');
  if (await page.locator('#xp-err-stage').isVisible()) fail('explore: error not cleared after choosing');
  await page.keyboard.press('Enter');
  if ((await visibleStep()) !== 'start') fail('explore: Enter did not continue to question 2');
  if (!(await page.evaluate(() => document.activeElement?.classList.contains('xp__q')))) fail('explore: focus not on the new question');

  // The whole card is the target; "already have" adds one follow-up question.
  await page.locator('.xp__opt', { hasText: 'I already have a website or digital product' }).click({ position: { x: 200, y: 20 } });
  await next.click();
  if ((await visibleStep()) !== 'have' || (await count()) !== 'Question 3 of 5') fail(`explore: follow-up missing (${await visibleStep()}, ${await count()})`);
  await page.locator('[data-back]').click();
  if ((await visibleStep()) !== 'start' || !(await page.isChecked('input[name="start"][value="have"]'))) fail('explore: Back lost the answer');
  await next.click();
  await page.locator('.xp__opt:has(input[value="site"])').click();
  await next.click();

  // Up to two goals; "not sure" stands alone.
  await page.locator('.xp__opt', { hasText: 'Reach more people' }).click();
  await page.locator('.xp__opt', { hasText: 'Make it easier for people to connect with me' }).click();
  if (!(await page.isDisabled('input[name="goals"][value="simplify"]'))) fail('explore: a third goal can be chosen');
  await page.locator('.xp__opt', { hasText: 'I’m not sure yet' }).click({ force: true }).catch(() => {});
  if (await page.isChecked('input[name="goals"][value="unsure"]')) fail('explore: disabled "not sure" was checked');
  await page.screenshot({ path: path.join(out, 'explore-goals-mobile-320.png') });
  await overflow('goals');
  await axe('goals');
  const navBox = await page.locator('.xp__nav').boundingBox();
  if (!navBox || navBox.y + navBox.height > 640 + 1) fail('explore: Back/Continue not within the screen on a small phone');
  await next.click();
  await page.locator('.xp__opt', { hasText: 'Improving something I already have' }).click();
  if ((await next.textContent()) !== 'See ideas') fail('explore: last step button not "See ideas"');
  await next.click();

  // Results.
  if (!(await page.locator('.xp__results').isVisible())) fail('explore: results not shown');
  if ((await page.evaluate(() => document.activeElement?.textContent)) !== 'Here’s what might be worth exploring.') fail('explore: focus not on the results heading');
  let recs = await page.$$eval('.xp__rec', (els) => els.map((e) => e.dataset.rec));
  if (recs.length < 2 || recs.length > 3 || recs[0] !== 'improve') fail(`explore: results for a site owner: ${recs}`);
  const card = await page.locator('.xp__rec').first().innerText();
  if (!/Why it may fit/i.test(card) || !card.includes('You said you already have a website')) fail('explore: result does not explain why');
  await page.screenshot({ path: path.join(out, 'explore-results-mobile-320.png'), fullPage: true });
  await overflow('results');
  await axe('results');
  if (posts.length) fail('explore: something was sent before the visitor submitted');

  // Change an earlier answer from the review list: the follow-up drops out and the results change.
  await page.locator('.xp__review summary').click();
  await page.getByRole('button', { name: 'Change your answer to: Where are you starting?' }).click();
  if ((await visibleStep()) !== 'start') fail('explore: Change did not open that question');
  await page.locator('.xp__opt', { hasText: 'I’m starting from scratch' }).click();
  await next.click();
  if ((await count()) !== 'Question 3 of 4') fail(`explore: stale follow-up still counted (${await count()})`);
  await next.click(); await next.click();
  recs = await page.$$eval('.xp__rec', (els) => els.map((e) => e.dataset.rec));
  if (recs.includes('improve') || !recs.includes('site')) fail(`explore: results did not follow the changed answer: ${recs}`);

  // Progress survives a reload in the same tab.
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.locator('.xp__results').isVisible())) fail('explore: results lost on reload');

  // Share copies the tool's address only.
  await page.locator('[data-share]').click();
  await page.waitForTimeout(200);
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (copied !== `${BASE}/explore/`) fail(`explore: share copied "${copied}"`);
  if (!(await page.locator('.xp__share-status').textContent())?.includes('Link copied')) fail('explore: no confirmation after copying');

  // Inquiry: editable summary filled in; nothing sent until submitted; real success/failure states.
  await page.getByRole('button', { name: 'Let’s talk about this' }).click();
  await page.waitForTimeout(400);
  if (!(await page.locator('.xp__inquiry').isVisible())) fail('explore: inquiry form not shown');
  if ((await page.evaluate(() => document.activeElement?.textContent)) !== 'Tell me about it') fail('explore: focus not on the inquiry heading');
  const summary = await page.inputValue('#cf-summary');
  if (!summary.includes('I’m starting from scratch') || !summary.includes('A simple website or landing page')) fail(`explore: summary not prefilled ("${summary.slice(0, 80)}")`);
  if (await page.isDisabled('#cf-summary')) fail('explore: summary not editable');
  await page.fill('#cf-summary', summary + '\nEdited by me.');
  if (posts.length) fail('explore: inquiry sent without submitting');
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'test@example.com');
  await page.waitForTimeout(3100); // the mailer drops forms filled in under 3 seconds
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForTimeout(300);
  if (!(await page.locator('.cform__status').textContent())?.includes('didn’t send')) fail('explore: failed send not reported');
  if (await page.locator('.cform__done').count()) fail('explore: success shown after a failure');
  const sentBody = posts.at(-1);
  if (!sentBody?.summary?.includes('Edited by me.') || sentBody.message !== '' || sentBody.hpot !== '') fail('explore: payload missing the edited summary');
  await overflow('inquiry');
  await axe('inquiry with error');
  await page.screenshot({ path: path.join(out, 'explore-inquiry-mobile-320.png'), fullPage: true });
  await page.unroute('**/api/contact');
  await page.route('**/api/contact', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForSelector('.cform__done');
  if (!(await page.locator('.cform__done').innerText()).includes('Message sent.')) fail('explore: success message missing');

  // Start over.
  await page.getByRole('button', { name: 'Start over' }).click();
  if ((await count()) !== 'Question 1 of 4' || (await page.locator('.xp input:checked').count())) fail('explore: Start over did not reset');
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('rbt-explore') || '{}'));
  if (stored.answers && Object.keys(stored.answers).length) fail('explore: answers kept after Start over');
  await ctx.close();
}

// Explore entry points: hero and under the service cards (#explore still lands there); ?start= preselects.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/#explore', { waitUntil: 'networkidle' });
  if (!(await page.locator('#services #explore a[href="/explore/"]').count())) fail('home explore: no Explore link under the service cards');
  if (!(await page.locator('.hero a[href="/explore/"]').count())) fail('home explore: no Explore link in the hero');
  await page.goto(BASE + '/explore/?start=new', { waitUntil: 'networkidle' });
  if (new URL(page.url()).search) fail('home explore: query left in the address');
  if ((await page.locator('fieldset[data-step="start"]').isHidden()) || !(await page.evaluate(() => JSON.parse(sessionStorage.getItem('rbt-explore')).answers.stage[0] === 'new'))) fail('home explore: first answer not carried over');
  // Desktop results layout: cards side by side.
  for (const v of ['scratch']) { await page.locator(`input[name="start"][value="${v}"]`).check(); await page.locator('[data-next]').click(); }
  await page.locator('input[name="goals"][value="idea"]').check(); await page.locator('[data-next]').click();
  await page.locator('input[name="focus"][value="specific"]').check(); await page.locator('[data-next]').click();
  const ys = await page.$$eval('.xp__rec', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  if (new Set(ys).size !== 1) fail(`explore desktop: result cards not in one row (${ys})`);
  await page.screenshot({ path: path.join(out, 'explore-results-laptop-1280.png'), fullPage: true });
  await ctx.close();
}

// Demo gallery: cards, the "something similar" hand-off, and simulated demo actions.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/api/contact', (r) => { posts.push(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.goto(BASE + '/work/', { waitUntil: 'networkidle' });
  const cards = await page.$$eval('.demo', (els) => els.map((e) => e.dataset.demo));
  for (const slug of ['unmaskd', 'ember-rye', 'alder-pine', 'tidewater', 'cove', 'auto-repair', 'landscaping', 'cleaning', 'frost-heave', 'explore']) if (!cards.includes(slug)) fail(`work: ${slug} missing`);
  if (cards.includes('patch-quest')) fail('work: games belong on /arcade/, not /work/');
  if (await page.locator('.demo', { hasText: /website concept prepared/i }).count()) fail('work: private preview listed');
  const order = await page.$$eval('main section[id]', (els) => els.map((e) => e.id).join());
  if (order !== 'websites,apps,similar') fail(`work: sections in the wrong order (${order})`);
  {
    const arcade = await (await page.request.get(BASE + '/arcade/')).text();
    if (!arcade.includes('data-demo="patch-quest"') || !arcade.includes('href="/arcade/patch-quest/"')) fail('arcade: PATCH QUEST not listed on /arcade/');
  }
  for (const c of await page.$$('.demo')) {
    const img = await c.$eval('img', (i) => i.complete && i.naturalWidth > 0).catch(() => false);
    if (!img) { await c.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
    if (!(await c.$eval('img', (i) => i.naturalWidth > 0))) fail('demos: a preview image did not load');
  }
  if (await page.inputValue('#cf-demo')) fail('demos: an example chosen before choosing a demo');
  await page.locator('.demo[data-demo="landscaping"] a[data-similar]').click();
  await page.waitForTimeout(500);
  if ((await page.inputValue('#cf-demo')) !== 'Fern & Fieldstone') fail(`demos: example not chosen ("${await page.inputValue('#cf-demo')}")`);
  if (!(await page.inputValue('#cf-type')).startsWith('A new business website')) fail(`demos: website example did not suggest a website (${await page.inputValue('#cf-type')})`);
  if (!(await page.locator('.demo__picked').textContent())?.includes('Fern & Fieldstone')) fail('demos: choice not confirmed');
  if ((await page.evaluate(() => document.activeElement?.id)) !== 'similar-title') fail('demos: focus not moved to the form heading');
  if (posts.length) fail('demos: something sent before Send');
  await page.selectOption('#cf-type', 'A website redesign');
  await page.locator('.demo[data-demo="ember-rye"] a[data-similar]').click();
  if ((await page.inputValue('#cf-demo')) !== 'Ember & Rye' || (await page.inputValue('#cf-type')) !== 'A website redesign') fail('demos: choosing another demo overwrote the visitor’s project type');
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'test@example.com');
  await page.selectOption('#cf-budget', '$1,000–$3,000');
  await page.fill('#cf-message', 'The same, for a bakery.');
  await page.waitForTimeout(3100);
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForSelector('.cform__done');
  if (posts[0]?.demo !== 'Ember & Rye' || posts[0].budget !== '$1,000–$3,000' || posts[0].message !== 'The same, for a bakery.') fail(`demos: payload missing example, budget or message (${JSON.stringify(posts[0])})`);
  await page.screenshot({ path: path.join(out, 'demos-sent-mobile-390.png'), fullPage: true });

  // From a demo page, top banner and closing promo: /work/?similar=<slug> arrives with the example chosen.
  for (const [where, name] of [['banner', '.concept-banner'], ['promo', '.demo-promo']]) {
    await page.goto(BASE + '/concepts/tidewater/', { waitUntil: 'networkidle' });
    await page.locator(name).getByRole('link', { name: 'Discuss a similar project' }).click();
    await page.waitForLoadState('networkidle');
    if ((await page.inputValue('#cf-demo')) !== 'Tidewater Mechanical Ops' || !(await page.inputValue('#cf-type')).startsWith('A custom application') || new URL(page.url()).search) fail(`demos: ${where} link did not carry the demo`);
  }
  for (const slug of slugs) {
    await page.goto(`${BASE}/concepts/${slug}/`, { waitUntil: 'networkidle' });
    const promo = await page.locator('.demo-promo a[href^="/work/?similar="]').getAttribute('href');
    if (promo !== `/work/?similar=${slug}#similar`) fail(`demos: ${slug} promo links to ${promo}`);
    if (await page.locator('main .demo-promo').count()) fail(`demos: ${slug} promo inside the demo`);
  }
  await page.goto(BASE + '/work/?similar=nope#similar', { waitUntil: 'networkidle' });
  if (await page.inputValue('#cf-demo')) fail('demos: unknown example accepted');

  // Demo actions are simulated and say so.
  await page.goto(BASE + '/concepts/auto-repair/', { waitUntil: 'networkidle' });
  const before = page.url();
  await page.locator('a[href^="tel:"]:visible').first().click();
  if (page.url() !== before || !(await page.locator('.demo-toast').textContent())?.includes('no call is made')) fail('demos: call button not simulated');
  for (const slug of ['auto-repair', 'landscaping', 'cleaning']) {
    await page.goto(`${BASE}/concepts/${slug}/`, { waitUntil: 'networkidle' });
    if (!(await page.locator('form[data-demo] .demo-note').isVisible())) fail(`demos: ${slug} form not labelled as a demo`);
  }
  await ctx.close();

  const wide = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const home = await wide.newPage();
  await home.goto(BASE + '/', { waitUntil: 'networkidle' });
  const panel = home.locator('#work');
  await panel.scrollIntoViewIfNeeded();
  await home.waitForTimeout(1200);
  const h = await panel.evaluate((el) => ({ h: el.getBoundingClientRect().height, vh: innerHeight, cards: [...el.querySelectorAll('.demo')].filter((d) => !d.hidden).length }));
  if (h.h > h.vh + 1) fail(`home work: panel taller than the screen (${h.h}px)`);
  if (h.cards !== 3) fail(`home work: ${h.cards} concept cards`);
  if (!(await panel.locator('a[href="/work/"]').count())) fail('home work: no link to /work/');
  await home.screenshot({ path: path.join(out, 'home-work-1366.png') });
  await home.goto(BASE + '/work/', { waitUntil: 'networkidle' });
  // Cards that share a row must match in height (a last, shorter row may differ).
  const rows = await home.$$eval('#websites .demo', (els) => {
    const by = {};
    for (const e of els) { const r = e.getBoundingClientRect(); (by[Math.round(r.top)] ??= []).push(Math.round(r.height)); }
    return Object.values(by);
  });
  for (const row of rows) if (new Set(row).size !== 1) fail(`work desktop: concept cards in a row differ in height (${row})`);
  await home.screenshot({ path: path.join(out, 'demos-1366.png'), fullPage: true });
  await wide.close();
}

// Tidewater reports: KPIs, chart, job mix and technician table agree in every range; fits a phone.
// Home: the small-website price cue links to the project sizes.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/concepts/tidewater/#reports', { waitUntil: 'networkidle' });
  for (const r of ['30', '90', '365']) {
    await page.click(`[data-range="${r}"]`);
    const t = await page.evaluate(() => {
      const num = (s) => Number(s.replace(/[^0-9.-]/g, ''));
      const kpi = [...document.querySelectorAll('[data-rep] .tw-kpi b')].map((b) => num(b.textContent));
      const rows = [...document.querySelectorAll('.tw-ltable tbody tr')];
      return {
        kpi, rev: rows.reduce((s, tr) => s + num(tr.querySelector('.tw-lbar b').textContent), 0), jobs: rows.reduce((s, tr) => s + num(tr.children[2].textContent), 0),
        mix: [...document.querySelectorAll('.tw-legend b')].reduce((s, b) => s + num(b.textContent), 0),
        chart: [...document.querySelectorAll('.tw-tableview tbody tr')].reduce((s, tr) => s + num(tr.children[1].textContent), 0),
        jobsShown: !!document.querySelector('.tw-ltable tbody tr').children[2].offsetParent,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const [rev, jobs] = t.kpi;
    if (t.rev !== rev || t.chart !== rev) fail(`tidewater ${r}: revenue KPI ${rev}, technicians ${t.rev}, chart ${t.chart}`);
    if (t.jobs !== jobs || t.mix !== jobs) fail(`tidewater ${r}: jobs KPI ${jobs}, technicians ${t.jobs}, job mix ${t.mix}`);
    if (!t.jobsShown) fail(`tidewater ${r}: technician job counts hidden on phones`);
    if (t.overflow > 0) fail(`tidewater ${r}: horizontal overflow ${t.overflow}px at 375`);
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const cue = page.locator('#services .svc-price');
  if (!(await cue.textContent())?.includes('$700') || (await cue.locator('a').getAttribute('href')) !== '/services/#pricing') fail('home: small-website price cue missing or not linked to /services/#pricing');
  await ctx.close();
}

// PATCH QUEST: menus, keyboard, touch, pause, settings, scores, resizing.
{
  const GAME = BASE + '/arcade/patch-quest/?debug';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(GAME, { waitUntil: 'networkidle' });
  const g = (fn, arg) => page.evaluate(fn, arg);
  const mode = () => g(() => window.__pq.game.mode);
  if ((await mode()) !== 'title') fail('game: does not open on the title screen');
  if (await g(() => window.__pq.audio.ctx !== undefined)) fail('game: audio started before any interaction');
  if ((await page.evaluate(() => document.activeElement?.dataset.do)) !== 'play') fail('game: Play not focused on the title screen');
  const scale = await g(() => document.querySelector('.pq-screen canvas').getBoundingClientRect().width / 320);
  if (Math.abs(scale - Math.round(scale)) > 0.01) fail(`game: canvas scale ${scale} is not a whole number at 1280×800`);

  // Menus by keyboard
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  if (!(await page.isVisible('[data-screen="howto"]'))) fail('game: How to play did not open by keyboard');
  await page.keyboard.press('Enter');
  if (!(await page.isVisible('[data-screen="title"]'))) fail('game: Back did not return to the title');

  // Settings persist
  await page.click('[data-screen="title"] [data-do="settings"]');
  await page.click('[data-screen="settings"] [data-toggle="music"]');
  if ((await page.getAttribute('.pq-bar [data-toggle="music"]', 'aria-pressed')) !== 'false') fail('game: music switch not in step between settings and the top bar');
  await page.reload({ waitUntil: 'networkidle' });
  if ((await page.getAttribute('.pq-bar [data-toggle="music"]', 'aria-pressed')) !== 'false') fail('game: music setting not remembered');
  await page.click('.pq-bar [data-toggle="music"]');

  // Play with the keyboard
  await page.focus('[data-do="play"]');
  await page.keyboard.press('Enter');
  if (!(await g(() => window.__pq.audio.ctx !== undefined))) fail('game: audio not unlocked by pressing Play');
  await page.waitForTimeout(2500);
  if ((await mode()) !== 'play') fail(`game: not playing after the intro (${await mode()})`);
  const scrollBefore = await page.evaluate(() => scrollY);
  const x0 = await g(() => window.__pq.game.player.x);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  const x1 = await g(() => window.__pq.game.player.x);
  if (x1 - x0 < 30) fail(`game: arrow key moved Patch only ${x1 - x0}px`);
  await page.keyboard.down('Space'); await page.waitForTimeout(150);
  const jumping = await g(() => window.__pq.game.player.vy < 0 || !window.__pq.game.player.onGround);
  await page.keyboard.up('Space');
  if (!jumping) fail('game: Space did not jump');
  if ((await page.evaluate(() => scrollY)) !== scrollBefore) fail('game: game keys scrolled the page');

  // Pause and resume
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150); // applied on the next game step
  if ((await mode()) !== 'paused' || !(await page.isVisible('[data-screen="paused"]'))) fail('game: Escape did not pause');
  if ((await page.evaluate(() => document.activeElement?.dataset.do)) !== 'resume') fail('game: Resume not focused when paused');
  const t = await g(() => window.__pq.game.runTime);
  await page.waitForTimeout(400);
  if ((await g(() => window.__pq.game.runTime)) !== t) fail('game: clock ran while paused');
  await page.screenshot({ path: path.join(out, 'game-paused-1280.png') });
  await page.keyboard.press('Enter');
  if ((await mode()) !== 'play') fail('game: Enter on Resume did not resume');
  // Hidden tab pauses
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  if ((await mode()) !== 'paused') fail('game: hiding the tab did not pause');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.click('[data-screen="paused"] [data-do="resume"]');

  // Repair by key
  await g(() => { const gm = window.__pq.game; const tm = gm.required[0]; gm.player.place(tm.x + 3, tm.y + tm.h - gm.player.h); });
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1100);
  if (!(await g(() => window.__pq.game.required[0].repaired))) fail('game: E did not repair the terminal');

  // Level clear screen, then the next level
  await g(() => { const gm = window.__pq.game; for (const tm of gm.required) tm.repaired = true; gm.exit.open = true; gm.player.place(gm.exit.x + 3, gm.exit.y + gm.exit.h - 13); });
  await page.waitForTimeout(400);
  if (!(await page.isVisible('[data-screen="clear"]')) || !(await page.locator('[data-out="tally"] li').count())) fail('game: level clear screen missing its tally');
  await page.screenshot({ path: path.join(out, 'game-clear-1280.png') });
  await page.click('[data-do="next"]');
  if ((await g(() => window.__pq.game.level.name)) !== 'CIRCUIT CITY') fail('game: Next level did not load level 2');

  // Game over and retry
  await page.waitForTimeout(2500);
  await g(() => { const gm = window.__pq.game; gm.lives = 1; gm.player.hp = 1; gm.player.invuln = 0; gm.damage(gm.player.cx + 5); });
  await page.waitForTimeout(1700);
  if (!(await page.isVisible('[data-screen="gameover"]'))) fail('game: no game over screen');
  await page.screenshot({ path: path.join(out, 'game-over-1280.png') });
  await page.click('[data-do="retry"]');
  if ((await g(() => [window.__pq.game.mode, window.__pq.game.lives, window.__pq.game.level.name].join())) !== 'intro,3,CIRCUIT CITY') fail('game: Retry did not restart the level with full lives');

  // Victory, personal best, share
  await page.waitForTimeout(2500);
  await g(() => { const gm = window.__pq.game; gm.startLevel(2); });
  await page.waitForTimeout(2500);
  await g(() => { const gm = window.__pq.game; for (const tm of gm.required) tm.repaired = true; gm.exit.open = true; gm.player.place(71 * 16, 11 * 16); gm.player.invuln = 999; });
  await page.waitForTimeout(3000);
  await g(() => { const gm = window.__pq.game; gm.player.invuln = 999; for (const n of [1, 2, 3]) { const tm = gm.terminals.find((x) => x.boss === n); tm.hidden = false; tm.repaired = true; gm.boss.nodeRepaired(() => {}); } gm.boss.stage = 'exposed'; gm.boss.stageT = 5; gm.boss.hp = 1; gm.boss.invuln = 0; gm.boss.hit((e) => e.type === 'dead' && gm.finishLevel?.(true)); });
  await page.waitForTimeout(4500);
  if (!(await page.isVisible('[data-screen="victory"]'))) fail(`game: no victory screen (${await mode()})`);
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem('patch-quest-v1')).best);
  if (!best || !(best.score > 0)) fail('game: personal best not saved');
  await page.screenshot({ path: path.join(out, 'game-victory-1280.png') });
  await page.click('[data-do="share"]');
  await page.waitForTimeout(200);
  const shared = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (!shared.includes('/arcade/patch-quest/') || !shared.includes('recorded on my device')) fail(`game: share text wrong ("${shared}")`);
  await page.click('[data-screen="victory"] [data-do="title"]');
  if (!(await page.locator('[data-out="best"]').first().textContent())?.includes(best.score.toLocaleString('en-US'))) fail('game: personal best not shown on the title screen');

  // Resizing keeps whole-pixel scaling where it fits
  await page.setViewportSize({ width: 1000, height: 640 });
  await page.waitForTimeout(300);
  const w2 = await g(() => document.querySelector('.pq-screen canvas').getBoundingClientRect().width);
  if (w2 > 1000 || w2 < 320) fail(`game: canvas ${w2}px wide after resizing to 1000px`);
  const back = page.locator('.pq-bar__home');
  if ((await back.getAttribute('href')) !== '/') fail('game: no way back to the site');
  if (errors.length) fail(`game: errors: ${[...new Set(errors)].join(' | ')}`);
  await ctx.close();
}

// Landscape play on a touch screen: the game fills the screen, controls at the bottom, pause in the corner.
async function immersiveCheck(page, g, name) {
  const r = await page.evaluate((g) => {
    const c = document.querySelector(`.${g}-screen canvas`).getBoundingClientRect();
    const bar = document.querySelector(`.${g}-bar`);
    return { on: document.querySelector(`.${g}`).classList.contains('is-immersive'), bar: bar.offsetParent !== null, h: c.height, top: c.top, vh: innerHeight };
  }, g);
  if (!r.on || r.bar) fail(`${g} ${name}: landscape play is not full screen (immersive ${r.on}, bar shown ${r.bar})`);
  if (r.h < r.vh - 2 || r.top < -1) fail(`${g} ${name}: game does not fill the screen height (${r.h}px of ${r.vh}px)`);
  const pause = await page.locator(`.${g}-tpause`).boundingBox();
  if (!pause || pause.width < 44 || pause.height < 44) fail(`${g} ${name}: no reachable pause button in full screen`);
}

// PATCH QUEST on a phone: touch controls, multitouch, portrait fallback.
for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/arcade/patch-quest/?debug', { waitUntil: 'networkidle' });
  const name = `${vp.width}x${vp.height}`;
  await page.tap('[data-do="play"]');
  await page.waitForTimeout(2600);
  for (const sel of ['[data-touch="pad"]', '[data-touch="jump"]', '[data-touch="action"]']) {
    const b = await page.locator(sel).boundingBox();
    if (!b || b.width < 44 || b.height < 44) fail(`game ${name}: ${sel} smaller than 44px`);
    if (b && (b.x < 0 || b.x + b.width > vp.width || b.y + b.height > vp.height)) fail(`game ${name}: ${sel} off screen`);
  }
  const hud = await page.locator('.pq-screen canvas').boundingBox();
  const pad = await page.locator('[data-touch="pad"]').boundingBox();
  if (pad.y < hud.y + hud.height * 0.15) fail(`game ${name}: touch controls cover the HUD`);
  // Hold right with one finger and press jump with another.
  const pt = async (type, sel, id, fx = 0.75) => {
    const b = await page.locator(sel).boundingBox();
    await page.dispatchEvent(sel, type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: b.x + b.width * fx, clientY: b.y + b.height / 2, bubbles: true });
  };
  const x0 = await page.evaluate(() => window.__pq.game.player.x);
  await pt('pointerdown', '[data-touch="pad"]', 1);
  await page.waitForTimeout(400);
  await pt('pointerdown', '[data-touch="jump"]', 2, 0.5);
  await page.waitForTimeout(120);
  const s = await page.evaluate(() => ({ x: window.__pq.game.player.x, air: !window.__pq.game.player.onGround }));
  await pt('pointerup', '[data-touch="jump"]', 2, 0.5);
  await pt('pointerup', '[data-touch="pad"]', 1);
  if (s.x - x0 < 20 || !s.air) fail(`game ${name}: moving and jumping at the same time failed (dx ${s.x - x0}, air ${s.air})`);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (ov > 0) fail(`game ${name}: horizontal overflow ${ov}px`);
  await page.screenshot({ path: path.join(out, `game-touch-${name}.png`) });
  if (vp.height > vp.width && !(await page.isVisible('.pq-rotate'))) fail('game portrait: no rotate suggestion');
  if (vp.height > vp.width && pad.y < hud.y + hud.height) fail('game portrait: controls overlap the picture');
  if (vp.width > vp.height) await immersiveCheck(page, 'pq', name);
  await page.tap(vp.width > vp.height ? '.pq-tpause' : '.pq-bar [data-do="pause"]');
  if ((await page.evaluate(() => window.__pq.game.mode)) !== 'paused') fail(`game ${name}: pause button did not pause`);
  if (await page.isHidden('.pq-bar')) fail(`game ${name}: page bar stays hidden while paused`);
  if (errors.length) fail(`game ${name}: errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// Service → contact with the service noted (?topic=); natural scrolling below large screens; anchors.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/api/contact', (r) => { posts.push(r.request().postDataJSON()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.goto(BASE + '/services/redesigns/', { waitUntil: 'networkidle' });
  const hrefs = await page.$$eval('a', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h?.includes('topic=')));
  if (!hrefs.length || !hrefs.every((h) => h === '/?topic=redesigns#contact')) fail(`topic: service page links ${hrefs}`);
  if (!(await page.locator('main a[href="/explore/"]').count())) fail('topic: service page has no Explore link');
  await page.locator('.page-head a[href*="topic="]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  if (new URL(page.url()).search || !page.url().endsWith('#contact')) fail(`topic: address not cleaned (${page.url()})`);
  if ((await page.inputValue('#cf-type')) !== 'A website redesign') fail(`topic: project type not chosen ("${await page.inputValue('#cf-type')}")`);
  await page.fill('#cf-name', 'Test Person'); await page.fill('#cf-email', 'test@example.com');
  await page.fill('#cf-message', 'Mostly the mobile layout.');
  if (posts.length) fail('topic: sent before Send');
  await page.waitForTimeout(3100);
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForSelector('.cform__done');
  if (posts[0]?.type !== 'A website redesign' || posts[0].message !== 'Mostly the mobile layout.') fail('topic: payload missing the project type');
  await page.goto(BASE + '/?topic=<script>#contact', { waitUntil: 'networkidle' });
  if (await page.inputValue('#cf-type')) fail('topic: unknown topic accepted');
  // Home length on a phone, and old anchors.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const screens = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
  // 11 (was 10.5) since 2026-10-22: the form's optional project type, budget and example fields add about a third of a screen.
  if (screens > 11) fail(`home: ${screens.toFixed(1)} screens long on a phone`);
  for (const id of ['services', 'explore', 'work', 'about', 'process', 'faq', 'contact']) if (!(await page.locator(`[id="${id}"]`).count())) fail(`home: anchor #${id} missing`);
  if ((await page.locator('#services .svc-block').count()) !== 3) fail('home: expected the three service categories');
  if (!(await page.locator('#contact h2').textContent())?.includes('Free project review by email')) fail('home: contact is not the free project review');
  // Positioning (Randy, 2026-10-22): typical project sizes on /services/, no takeovers of unfinished projects anywhere.
  await page.goto(BASE + '/services/', { waitUntil: 'networkidle' });
  if ((await page.locator('#pricing .price-guide').count()) !== 3 || !(await page.locator('#pricing .price-note').textContent())?.includes('not quotes')) fail('services: typical project sizes missing');
  for (const u of ['/', '/services/', '/services/existing-projects/', '/work/', '/explore/']) {
    const html = (await (await page.request.get(BASE + u)).text()).toLowerCase();
    for (const w of ['unfinished', 'stalled', 'taking over', 'another developer']) if (html.includes(w)) fail(`positioning: "${w}" on ${u}`);
  }
  await ctx.close();
  for (const vp of [{ width: 1024, height: 660 }, { width: 1280, height: 720 }, { width: 768, height: 1024 }]) {
    const c2 = await browser.newContext({ viewport: vp });
    const p2 = await c2.newPage();
    await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
    const r = await p2.evaluate(() => ({ snap: getComputedStyle(document.documentElement).scrollSnapType, tall: [...document.querySelectorAll('main .panel')].some((el) => getComputedStyle(el).minHeight !== '0px' && getComputedStyle(el).minHeight !== 'auto') }));
    if (r.snap !== 'none' || r.tall) fail(`panels: ${vp.width}×${vp.height} should scroll naturally (snap ${r.snap})`);
    await c2.close();
  }
  const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p3 = await c3.newPage();
  await p3.goto(BASE + '/', { waitUntil: 'networkidle' });
  const snap = await p3.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
  if (snap === 'none' || snap.includes('mandatory')) fail(`panels: 1440×900 snap is "${snap}", expected proximity`);
  for (const id of ['services', 'work', 'about', 'faq', 'contact']) {
    const h = await p3.evaluate((i) => document.getElementById(i).getBoundingClientRect().height, id);
    if (h > 901) fail(`panels: #${id} is ${Math.round(h)}px at 1440×900`);
  }
  await p3.goto(BASE + '/#process', { waitUntil: 'networkidle' });
  await p3.waitForTimeout(800);
  const pt = await p3.evaluate(() => document.getElementById('process').getBoundingClientRect().top);
  if (pt < -2 || pt > 900) fail(`anchor: /#process lands at ${Math.round(pt)}px`);
  await c3.close();
}

// Audio really makes sound after a click (and none before). Measured with an analyser on the master bus.
async function loudness(page, key) {
  return page.evaluate(async (k) => {
    const a = window[k].audio;
    const an = a.ctx.createAnalyser(); an.fftSize = 2048; a.master.connect(an);
    let sum = 0, n = 0;
    for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 50)); const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); sum += Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length); n++; }
    return sum / n;
  }, key);
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/arcade/patch-quest/?debug', { waitUntil: 'networkidle' });
  await page.click('[data-do="settings"]');
  const pq = await loudness(page, '__pq');
  if (!(pq > 0.02)) fail(`PATCH QUEST: title music too quiet or silent (rms ${pq.toFixed(4)})`);
  await ctx.close();
}

// AFTER HOURS: advisory, menus, decisions, audio, settings, pause, results, touch.
{
  const GAME = BASE + '/arcade/after-hours/?debug';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(GAME, { waitUntil: 'networkidle' });
  const g = (fn, arg) => page.evaluate(fn, arg);
  const mode = () => g(() => window.__ah.game.mode);
  if (!(await page.isVisible('[data-screen="advisory"]'))) fail('after hours: no mature-humor advisory before the game');
  if (await g(() => window.__ah.audio.ctx !== undefined)) fail('after hours: audio before any interaction');
  if ((await page.evaluate(() => document.activeElement?.dataset.do)) !== 'advisory') fail('after hours: advisory button not focused');
  await page.keyboard.press('Enter');
  if (!(await page.isVisible('[data-screen="title"]'))) fail('after hours: advisory did not lead to the title');
  await page.click('[data-screen="title"] [data-do="achievements"]');
  if ((await page.locator('[data-out="achievements"] li').count()) < 6) fail('after hours: achievements list missing');
  await page.click('[data-screen="achievements"] [data-do="back"]');
  const music = await loudness(page, '__ah');
  if (!(music > 0.02)) fail(`after hours: title music too quiet or silent (rms ${music.toFixed(4)})`);
  // Settings persist
  await page.click('[data-screen="title"] [data-do="settings"]');
  await page.fill('[data-volume]', '40');
  await page.dispatchEvent('[data-volume]', 'input');
  await page.click('[data-screen="settings"] [data-toggle="timer"]');
  await page.reload({ waitUntil: 'networkidle' });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('after-hours-v1')).settings);
  if (st.volume !== 0.4 || st.timer !== false) fail(`after hours: settings not saved (${JSON.stringify(st)})`);
  if (await page.isVisible('[data-screen="advisory"]')) fail('after hours: advisory shown again in the same session');
  await page.click('[data-screen="title"] [data-do="settings"]');
  await page.click('[data-screen="settings"] [data-toggle="timer"]');
  await page.click('[data-screen="settings"] [data-do="back"]');
  // Play: keyboard, a decision by number key, another by click
  await page.click('[data-do="play"]');
  await page.waitForTimeout(2800);
  if ((await mode()) !== 'play') fail(`after hours: not playing after the intro (${await mode()})`);
  const sy = await page.evaluate(() => scrollY);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
  if ((await page.evaluate(() => scrollY)) !== sy) fail('after hours: game keys scrolled the page');
  if ((await mode()) !== 'choice' || !(await page.isVisible('[data-screen="choice"]'))) fail('after hours: walking up to the phone did not open a decision');
  if (!(await page.locator('[data-pick="1"] span').textContent())?.length) fail('after hours: decision options empty');
  await page.screenshot({ path: path.join(out, 'ah-choice-1280.png') });
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(200);
  if ((await mode()) !== 'play' || !(await g(() => window.__ah.game.flags.has('exJealous')))) fail('after hours: key 2 did not choose option 2');
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(80);
  if (!(await g(() => window.__ah.game.viv.attackT >= 0 || window.__ah.game.viv.attackCool > 0))) fail('after hours: J did not swing');
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyK'); await page.waitForTimeout(60);
  if (!(await g(() => window.__ah.game.viv.dodgeCool > 0))) fail('after hours: K did not roll');
  await g(() => { const ga = window.__ah.game; ga.viv.place(35.6 * 16, 138); });
  await page.waitForTimeout(300);
  if ((await g(() => window.__ah.game.choice?.enc.id)) !== 'bouncer') fail('after hours: the bouncer decision did not open');
  await page.click('[data-pick="3"]');
  await page.waitForTimeout(200);
  if (!(await g(() => window.__ah.game.doorOpen))) fail('after hours: paying the bouncer did not open the door');
  // Pause
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  if ((await mode()) !== 'paused' || (await page.evaluate(() => document.activeElement?.dataset.do)) !== 'resume') fail('after hours: Escape did not pause with Resume focused');
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  if ((await mode()) !== 'play') fail('after hours: did not resume');
  // Game over, then retry
  await g(() => { const ga = window.__ah.game; ga.viv.invuln = 0; ga.viv.dignity = 1; ga.damage(ga.viv.cx + 4, 'bouncer'); });
  await page.waitForTimeout(2000);
  if (!(await page.isVisible('[data-screen="gameover"]')) || !(await page.locator('[data-out="go-line"]').textContent())?.length) fail('after hours: no game-over screen with a line');
  await page.screenshot({ path: path.join(out, 'ah-gameover-1280.png') });
  await page.click('[data-do="retry"]'); await page.waitForTimeout(300);
  if ((await mode()) !== 'intro') fail('after hours: retry did not restart the area');
  // Victory: results, best score, achievements, share
  await page.waitForTimeout(2600);
  await g(() => { const ga = window.__ah.game; ga.chaoticChoices = 5; ga.secrets = 3; ga.startZone(3); });
  await page.waitForTimeout(2600);
  await g(() => { const ga = window.__ah.game; for (const s of ga.slots) if (s.enc.id === 'elevator') s.done = true; ga.viv.place(15 * 16, 138); });
  await page.waitForTimeout(300);
  await page.click('[data-pick="2"]');
  await page.waitForTimeout(2600);
  await g(() => { const ga = window.__ah.game, b = ga.boss; b.state = 'monologue'; b.st = 5; b.hp = 1; b.invuln = 0; ga['strikeBoss'](5); });
  await page.waitForTimeout(5200);
  if (!(await page.isVisible('[data-screen="victory"]'))) fail(`after hours: no victory screen (${await mode()})`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('after-hours-v1')));
  if (!saved.best?.score || !saved.achievements.includes('red-flag') || !saved.achievements.includes('disco')) fail(`after hours: best score or achievements not saved (${JSON.stringify(saved)})`);
  if ((await page.locator('[data-out="v-choices"] li').count()) < 2) fail('after hours: decisions recap missing');
  await page.screenshot({ path: path.join(out, 'ah-victory-1280.png') });
  await page.click('[data-do="share"]'); await page.waitForTimeout(200);
  const shared = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (!shared.includes('/arcade/after-hours/') || !shared.includes('recorded on my device')) fail(`after hours: share text wrong (${shared})`);
  if (errors.length) fail(`after hours: errors: ${[...new Set(errors)].join(' | ')}`);
  await ctx.close();

  // The arcade lists both games, with a content note on AFTER HOURS.
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(BASE + '/arcade/', { waitUntil: 'networkidle' });
  if ((await p2.locator('.demo').count()) < 3) fail('arcade: all three games not listed');
  if (!(await p2.locator('.demo[data-demo="after-hours"] .demo__badge').textContent())?.includes('Mature')) fail('arcade: AFTER HOURS card has no mature-humor note');
  if (await p2.locator('main a[href="/arcade/after-hours/"]').count() === 0) fail('arcade: no link to AFTER HOURS');
  await p2.context().close();
}

// AFTER HOURS on phones: touch controls, multitouch, layouts.
for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/arcade/after-hours/?debug', { waitUntil: 'networkidle' });
  const name = `${vp.width}x${vp.height}`;
  await page.tap('[data-do="advisory"]');
  await page.tap('[data-do="play"]');
  await page.waitForTimeout(2800);
  for (const sel of ['[data-touch="pad"]', '[data-touch="jump"]', '[data-touch="attack"]', '[data-touch="dodge"]']) {
    const b = await page.locator(sel).boundingBox();
    if (!b || b.width < 44 || b.height < 44) fail(`after hours ${name}: ${sel} smaller than 44px`);
    if (b && (b.x < 0 || b.x + b.width > vp.width + 1 || b.y + b.height > vp.height + 1)) fail(`after hours ${name}: ${sel} off screen`);
  }
  const pt = async (type, sel, id, fx = 0.75) => {
    const b = await page.locator(sel).boundingBox();
    if (!b) return false;
    await page.dispatchEvent(sel, type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: b.x + b.width * fx, clientY: b.y + b.height / 2, bubbles: true });
    return true;
  };
  // Settle the opening decision first, then test touch away from any trigger.
  await page.evaluate(() => { const ga = window.__ah.game; ga.viv.place(7 * 16, 138); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { const ga = window.__ah.game; if (ga.mode === 'choice') ga.choose(2); ga.viv.place(10 * 16, 138); });
  await page.waitForTimeout(300);
  const x0 = await page.evaluate(() => window.__ah.game.viv.x);
  await pt('pointerdown', '[data-touch="pad"]', 1);
  await page.waitForTimeout(300);
  await pt('pointerdown', '[data-touch="jump"]', 2, 0.5);
  await page.waitForTimeout(100);
  const s = await page.evaluate(() => ({ x: window.__ah.game.viv.x, air: !window.__ah.game.viv.onGround, mode: window.__ah.game.mode }));
  await pt('pointerup', '[data-touch="jump"]', 2, 0.5); await pt('pointerup', '[data-touch="pad"]', 1);
  if (s.mode === 'play' && (s.x - x0 < 15 || !s.air)) fail(`after hours ${name}: move + jump together failed (dx ${s.x - x0}, air ${s.air})`);
  await page.evaluate(() => { const ga = window.__ah.game; if (ga.mode === 'choice') ga.choose(0); });
  await page.waitForTimeout(200);
  await page.waitForTimeout(500);
  const pressed = await pt('pointerdown', '[data-touch="attack"]', 3, 0.5); await page.waitForTimeout(60); await pt('pointerup', '[data-touch="attack"]', 3, 0.5);
  if (!pressed || !(await page.evaluate(() => window.__ah.game.viv.attackCool > 0))) fail(`after hours ${name}: HIT button did not swing (visible ${pressed}, mode ${await page.evaluate(() => window.__ah.game.mode)})`);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (ov > 0) fail(`after hours ${name}: horizontal overflow ${ov}px`);
  await page.screenshot({ path: path.join(out, `ah-touch-${name}.png`) });
  if (vp.width > vp.height) {
    await immersiveCheck(page, 'ah', name);
    await page.tap('.ah-tpause');
    if ((await page.evaluate(() => window.__ah.game.mode)) !== 'paused') fail(`after hours ${name}: corner pause did not pause`);
    if (await page.isHidden('.ah-bar')) fail(`after hours ${name}: page bar stays hidden while paused`);
  }
  if (errors.length) fail(`after hours ${name}: errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// CROSS//WIRE: menus, keyboard solving, hints, completion, saving, daily, campaign lock, audio, share.
{
  const GAME = BASE + '/arcade/cross-wire/?debug';
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(GAME, { waitUntil: 'networkidle' });
  const g = (fn, arg) => page.evaluate(fn, arg);
  const ses = () => g(() => { const s = window.__cw.session?.s; return s && { cell: s.cell, dir: s.dir, entry: s.entry.i, hints: s.hints, status: s.status, fill: s.fill.map((x) => x || '.').join('') }; });
  if (await g(() => window.__cw.audio.ctx !== undefined)) fail('cross-wire: audio before any interaction');
  const dayN = Math.floor((Date.now() - Date.UTC(2026, 9, 19)) / 86_400_000) + 1;
  if (!(await page.locator('[data-out="daily-num"]').textContent()).includes(`#${Math.max(1, dayN)}`)) fail('cross-wire: daily number on the home card is wrong');
  await page.click('.cw-mode--minis');
  await page.locator('[data-out="minis"] .cw-tile >> nth=9').waitFor({ timeout: 5000 }).catch(() => {});
  if ((await page.locator('[data-out="minis"] .cw-tile').count()) < 10) fail('cross-wire: minis list too short');
  if ((await page.evaluate(() => document.activeElement?.id)) !== 'cw-h-minis') fail('cross-wire: focus not moved to the list heading');
  await page.click('[data-out="minis"] .cw-tile a >> nth=0');
  await page.waitForTimeout(200);
  if ((await g(() => document.activeElement?.matches('[data-grid]')))) {} else fail('cross-wire: grid not focused when a puzzle opens');
  if ((await page.locator('.cw-cell').count()) !== 25) fail('cross-wire: 5×5 grid not built');
  // The whole puzzle fits a 1366×768 screen: grid, clue bar, hints, clue lists.
  const fits = await g(() => ['[data-board]', '.cw-active', '.cw-hints', '.cw-clues'].every((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.height > 0; }));
  if (!fits) fail('cross-wire: desktop puzzle view does not fit the screen');
  // Click selection and direction switching
  const sol = await g(() => window.__cw.session.p.cells.map((c) => c.sol));
  const cellSel = (i) => `.cw-cell[data-i="${i}"]`;
  await page.click(cellSel(12));
  let s = await ses();
  if (s.cell !== 12 || s.dir !== 'across') fail(`cross-wire: clicking a square did not select it (${JSON.stringify(s)})`);
  await page.click(cellSel(12));
  if ((await ses()).dir !== 'down') fail('cross-wire: clicking the square again did not switch to Down');
  // Keyboard: typing moves along the answer, Backspace, arrows, Space, Enter
  await page.click(cellSel(5)); // row 2 start (SEWER), across
  if ((await ses()).dir !== 'across') await page.keyboard.press('Space');
  await page.keyboard.type('sew');
  s = await ses();
  if (s.cell !== 8 || s.fill.slice(5, 8) !== 'SEW') fail(`cross-wire: typing did not fill and advance (${JSON.stringify(s)})`);
  await page.keyboard.press('Backspace');
  s = await ses();
  if (s.cell !== 7 || s.fill[7] !== '.') fail(`cross-wire: Backspace did not step back and erase (${JSON.stringify(s)})`);
  await page.keyboard.press('ArrowDown');
  if ((await ses()).dir !== 'down') fail('cross-wire: an arrow across the direction did not turn first');
  await page.keyboard.press('ArrowDown');
  if ((await ses()).cell !== 12) fail('cross-wire: arrow did not move');
  const before = (await ses()).entry;
  await page.keyboard.press('Enter');
  if ((await ses()).entry === before) fail('cross-wire: Enter did not go to the next clue');
  await page.keyboard.press('Tab');
  if (await g(() => document.activeElement?.matches('[data-grid]'))) fail('cross-wire: Tab traps focus in the grid');
  // Clicking a clue selects its answer
  const clueText = await page.locator('.cw-clue >> nth=3').getAttribute('aria-label');
  await page.click('.cw-clue >> nth=3');
  if (!clueText.includes(await page.locator('[data-out="active-clue"]').textContent())) fail('cross-wire: clue click did not select that answer');
  if (!(await g(() => document.activeElement?.matches('[data-grid]')))) fail('cross-wire: focus did not return to the grid after choosing a clue');
  // Hints: a wrong letter, check, reveal
  const entry = await g(() => { const s = window.__cw.session.s; return { cells: s.entry.cells, ans: s.entry.answer }; });
  await page.keyboard.type(entry.ans[0] === 'Q' ? 'Z' : 'Q');
  await page.click('[data-do="check"]');
  if (!(await page.locator(cellSel(entry.cells[0])).evaluate((el) => el.classList.contains('is-wrong')))) fail('cross-wire: Check word did not mark the wrong letter');
  if ((await page.locator(cellSel(entry.cells[0])).textContent()).includes(entry.ans[0])) fail('cross-wire: Check word revealed the answer');
  await page.click(cellSel(entry.cells[0]));
  if ((await ses()).dir !== (await g(() => window.__cw.session.p.entries[window.__cw.session.s.entry.i].dir))) {}
  await page.click('[data-do="reveal-letter"]');
  if (!(await page.locator(cellSel(entry.cells[0])).evaluate((el) => el.classList.contains('is-rev')))) fail('cross-wire: Reveal letter not shown');
  if ((await ses()).hints !== 2) fail(`cross-wire: hint count wrong (${(await ses()).hints})`);
  // Clock runs
  const t1 = await g(() => window.__cw.session.clock.ms);
  await page.waitForTimeout(1200);
  const t2 = await g(() => window.__cw.session.clock.ms);
  if (t2 - t1 < 1000 || t2 - t1 > 1600) fail(`cross-wire: clock drift (${t2 - t1}ms in 1200ms)`);
  // Leave and come back: progress kept
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  if ((await page.evaluate(() => location.hash)) !== '#/minis') fail('cross-wire: Escape did not go back to the list');
  if (!(await page.locator('[data-out="minis"] .cw-tile >> nth=0').evaluate((el) => el.classList.contains('is-started')))) fail('cross-wire: in-progress puzzle not marked');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-out="minis"] .cw-tile a >> nth=0');
  await page.waitForTimeout(200);
  const kept = await ses();
  if (kept.fill.slice(5, 7) !== 'SE' || kept.hints !== 2) fail(`cross-wire: progress not restored after reload (${JSON.stringify(kept)})`);
  // Solve the rest by keyboard: choose each clue, type its answer
  const answers = await g(() => window.__cw.session.p.entries.map((e) => e.answer));
  for (let i = 0; i < answers.length; i++) {
    if (await page.isVisible('[data-done]')) break;
    await page.click(`.cw-clue[data-entry="${i}"]`);
    await g((i) => { const s = window.__cw.session.s; s.selectEntry(i); s.cell = s.entry.cells[0]; }, i);
    await page.keyboard.type(answers[i]);
  }
  await page.waitForTimeout(1300);
  if (!(await page.isVisible('[data-done]'))) fail(`cross-wire: no completion screen (${JSON.stringify(await ses())})`);
  if (!(await page.locator('[data-out="d-hints"]').textContent()).includes('assisted')) fail('cross-wire: assisted solve not labelled');
  await page.screenshot({ path: path.join(out, 'cw-done-1366.png') });
  await page.click('[data-do="share"]'); await page.waitForTimeout(200);
  const shared = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (!shared.includes('CROSS//WIRE') || !shared.includes('Hints: 2') || !shared.includes('/arcade/cross-wire/')) fail(`cross-wire: share text wrong (${shared})`);
  for (const a of answers) if (a.length > 3 && shared.toUpperCase().includes(a)) fail(`cross-wire: share text contains an answer (${a})`);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cross-wire-v1')));
  const firstId = Object.keys(saved.records)[0];
  if (!saved.solves[firstId]?.done || saved.records[firstId]?.bestClean !== undefined) fail(`cross-wire: assisted solve recorded wrongly (${JSON.stringify(saved.records)})`);
  // Audio: on after interaction, effects audible
  const rms = await g(async () => {
    const a = window.__cw.audio; const an = a.ctx.createAnalyser(); an.fftSize = 2048; a.master.connect(an);
    a.play('solved'); let peak = 0;
    for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 40)); const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); peak = Math.max(peak, Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length)); }
    return peak;
  });
  if (!(rms > 0.02)) fail(`cross-wire: sound effects silent (rms ${rms.toFixed(4)})`);
  await page.click('[data-done] [data-do="done-close"]');
  await page.click('.cw-bar [data-toggle="sound"]');
  if ((await page.evaluate(() => JSON.parse(localStorage.getItem('cross-wire-v1')).settings.sound)) !== false) fail('cross-wire: sound setting not saved');
  // Daily and campaign lock
  await page.goto(GAME + '#/daily'); await page.waitForTimeout(300);
  if (!(await page.locator('[data-out="title"]').textContent()).startsWith('Daily Circuit #')) fail('cross-wire: daily did not open');
  await page.goto(GAME + '#/play/s3-pattern'); await page.waitForTimeout(300);
  if ((await page.evaluate(() => location.hash)) !== '#/campaign') fail('cross-wire: a locked campaign puzzle opened');
  if ((await page.locator('.cw-sector.is-locked').count()) !== 2) fail('cross-wire: sectors 2 and 3 should start locked');
  // Reset with confirmation
  await page.goto(GAME + '#/settings'); await page.waitForTimeout(200);
  await page.click('[data-do="reset"]');
  if (!(await page.isVisible('[data-out="reset-confirm"]'))) fail('cross-wire: reset has no confirmation');
  await page.click('[data-do="reset-yes"]');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('cross-wire-v1')));
  if (Object.keys(after.solves).length || Object.keys(after.records).length) fail('cross-wire: reset did not clear progress');
  if (errors.length) fail(`cross-wire: errors: ${[...new Set(errors)].join(' | ')}`);
  await ctx.close();
}

// CROSS//WIRE on phones: grid fits the width, keyboard reachable, no overflow; landscape fills the screen.
for (const vp of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
  const name = `${vp.width}x${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const done = { fill: '.', revealed: '0', hints: 0, ms: 1000, done: true };
  await ctx.addInitScript((s) => { if (!localStorage.getItem('cross-wire-v1')) localStorage.setItem('cross-wire-v1', s); },
    JSON.stringify({ v: 1, settings: { sound: false, music: false, feedback: true, timer: true }, solves: Object.fromEntries(['s1-startup', 's1-panel', 's1-board', 's1-sink'].map((k) => [k, done])), daily: {}, records: {}, seen: ['s1'] }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/arcade/cross-wire/?debug#/play/s2-power', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const lay = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height, shown: getComputedStyle(e).display !== 'none' && b.height > 0 }; };
    return { vw: innerWidth, vh: innerHeight, over: document.documentElement.scrollWidth - innerWidth, cell: document.querySelector('.cw-cell').getBoundingClientRect().width,
      board: r('[data-board]'), kbd: r('[data-kbd]'), clue: r('.cw-active'), bar: r('.cw-bar'), immersive: document.querySelector('.cw').classList.contains('is-immersive') };
  });
  if (lay.over > 0) fail(`cross-wire ${name}: horizontal overflow ${lay.over}px`);
  if (lay.cell < 28) fail(`cross-wire ${name}: 7×7 squares too small to tap (${lay.cell}px)`);
  for (const k of ['board', 'kbd', 'clue']) if (!lay[k].shown || lay[k].top < -1 || lay[k].bottom > lay.vh + 1 || lay[k].right > lay.vw + 1) fail(`cross-wire ${name}: ${k} not fully on screen (${JSON.stringify(lay[k])})`);
  if (vp.width > vp.height && (!lay.immersive || lay.bar.shown)) fail(`cross-wire ${name}: landscape play is not full screen`);
  if (vp.height > vp.width && lay.kbd.top < lay.board.bottom - 1) fail(`cross-wire ${name}: keyboard overlaps the grid`);
  // Tap a square, type on the on-screen keyboard, switch direction from the clue bar
  await page.tap('.cw-cell[data-i="7"]');
  await page.tap('[data-key="E"]');
  const st = await page.evaluate(() => ({ f: window.__cw.session.s.fill[7], dir: window.__cw.session.s.dir }));
  if (st.f !== 'E') fail(`cross-wire ${name}: on-screen keyboard did not type`);
  await page.tap('[data-do="dir"]');
  if ((await page.evaluate(() => window.__cw.session.s.dir)) === st.dir) fail(`cross-wire ${name}: clue bar did not switch direction`);
  await page.tap('[data-key="back"]');
  if (vp.width < 832) {
    await page.tap('[data-do="hints"]');
    const hb = await page.locator('[data-do="reveal-letter"]').boundingBox();
    if (!hb || hb.y < 0 || hb.y + hb.height > vp.height) fail(`cross-wire ${name}: hint menu off screen`);
    await page.tap('[data-do="reveal-letter"]');
    if ((await page.evaluate(() => window.__cw.session.s.hints)) !== 1) fail(`cross-wire ${name}: hint from the menu did not apply`);
    await page.tap('[data-do="clues"]');
    if (!(await page.isVisible('.cw-clues.is-open .cw-clue'))) fail(`cross-wire ${name}: clue list did not open`);
    await page.tap('.cw-clue >> nth=5');
    if (await page.isVisible('.cw-clues.is-open')) fail(`cross-wire ${name}: clue list did not close after choosing`);
  }
  await page.screenshot({ path: path.join(out, `cw-${name}.png`) });
  if (errors.length) fail(`cross-wire ${name}: errors: ${errors.join(' | ')}`);
  await ctx.close();
}

// The arcade shows the three games, in one row on a wide screen.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/arcade/', { waitUntil: 'networkidle' });
  const cards = await page.locator('.demo').evaluateAll((els) => els.map((e) => ({ slug: e.dataset.demo, top: Math.round(e.getBoundingClientRect().top) })));
  if (cards.map((c) => c.slug).join() !== 'patch-quest,after-hours,cross-wire') fail(`arcade: expected the three games in order (${cards.map((c) => c.slug)})`);
  if (new Set(cards.map((c) => c.top)).size !== 1) fail('arcade: the three cards are not in one row at 1366px');
  const cw = page.locator('.demo[data-demo="cross-wire"]');
  if (!(await cw.textContent()).includes('Solve crosswords, restore circuits, and bring a broken digital network back online.')) fail('arcade: CROSS//WIRE description wrong');
  if ((await cw.locator('a[href="/arcade/cross-wire/"]').count()) === 0) fail('arcade: no link to CROSS//WIRE');
  await page.setViewportSize({ width: 390, height: 844 });
  const xs = await page.locator('.demo').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  if (new Set(xs).size !== 1) fail('arcade: cards not stacked on a phone');
  await ctx.close();
}

// Full-screen mobile menu: covers the screen, page behind is inert and doesn't scroll.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/services/', { waitUntil: 'networkidle' });
  await page.click('.site-nav__toggle');
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const r = document.querySelector('#site-nav-list').getBoundingClientRect();
    return { h: r.bottom, w: r.width, inert: document.querySelector('main').inert, lock: getComputedStyle(document.documentElement).overflow };
  });
  if (m.h < 840 || m.w < 389) fail(`menu: not full screen (${JSON.stringify(m)})`);
  if (!m.inert || m.lock !== 'hidden') fail('menu: page behind is not inert or still scrolls');
  // Safari sizes a fixed menu inside a filtered/transformed header to the header (Chromium doesn't), so check for it here.
  const cb = await page.evaluate(() => {
    const bad = [];
    for (let el = document.querySelector('#site-nav-list').parentElement; el; el = el.parentElement) {
      const c = getComputedStyle(el);
      for (const k of ['backdropFilter', 'webkitBackdropFilter', 'filter', 'transform', 'perspective']) if (c[k] && c[k] !== 'none') bad.push(`${el.className || el.tagName} ${k}`);
      if (/paint|layout|strict|content/.test(c.contain)) bad.push(`${el.className || el.tagName} contain`);
    }
    return bad;
  });
  if (cb.length) fail(`menu: an ancestor would trap the full-screen menu in Safari: ${cb.join(', ')}`);
  // The build ships the header blur as -webkit-backdrop-filter only, which Chromium ignores: check the CSS itself.
  const css = (await Promise.all(await page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href))
    .then((hs) => hs.map((h) => page.request.get(h).then((r) => r.text()))))).join('');
  const headerRules = css.match(/\.site-header\{[^}]*\}/g) ?? [];
  if (headerRules.some((r) => /backdrop-filter:blur/.test(r)) && !headerRules.some((r) => /-webkit-backdrop-filter:none/.test(r))) fail('menu: the header blur is not switched off on phones (Safari squeezes the menu)');
  await page.screenshot({ path: path.join(out, 'menu-full-390.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if (await page.evaluate(() => document.querySelector('main').inert)) fail('menu: page still inert after closing');
  await ctx.close();
}

// Keyboard and menu behaviour on a phone-sized screen.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (first !== 'Skip to content') fail(`keyboard: first Tab stop is "${first}"`);
  await page.keyboard.press('Enter');
  const focusedMain = await page.evaluate(() => document.activeElement?.id);
  if (focusedMain !== 'main') fail(`keyboard: skip link moved focus to "${focusedMain}"`);

  const toggle = page.locator('.site-nav__toggle');
  if (!(await toggle.isVisible())) fail('menu: toggle not visible on mobile');
  if (await page.locator('#site-nav-list a').first().isVisible()) fail('menu: list visible before opening');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') fail('menu: aria-expanded not true after open');
  await page.screenshot({ path: path.join(out, 'menu-open-mobile-390.png') });
  await page.keyboard.press('Tab');
  const inMenu = await page.evaluate(() => !!document.activeElement?.closest('#site-nav-list'));
  if (!inMenu) fail('menu: Tab after opening does not enter the menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') fail('menu: Escape did not close');
  const back = await page.evaluate(() => document.activeElement?.classList.contains('site-nav__toggle'));
  if (!back) fail('menu: focus not returned to toggle after Escape');
  await toggle.click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Work', exact: true }).click();
  await page.waitForTimeout(400);
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') fail('menu: choosing a link did not close it');
  await ctx.close();
}

// One page: former pages redirect to their sections; the nav indicator follows the scroll.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  for (const s of ['about', 'faq', 'contact']) {
    const r = await page.request.get(`${BASE}/${s}/`, { maxRedirects: 0 });
    if (r.status() !== 301 || r.headers().location !== `/#${s}`) fail(`redirect /${s}/: ${r.status()} → ${r.headers().location}`);
  }
  for (const [from, to] of [['/demos/', '/work/'], ['/demos', '/work/'], ['/demos/?similar=cleaning', '/work/?similar=cleaning']]) {
    const r = await page.request.get(BASE + from, { maxRedirects: 0 });
    if (r.status() !== 301 || r.headers().location !== to) fail(`redirect ${from}: ${r.status()} → ${r.headers().location}`);
  }
  // Resources: WordPress is served at /resources/; the old Astro guide URLs move to its addresses.
  for (const [from, to] of [['/resources', '/resources/'], ['/resources/guides/', '/resources/topic/guides/'], ['/resources/guides/quick-fix-or-rebuild/', '/resources/quick-fix-or-rebuild/'], ['/resources/suggest', '/resources/suggest/']]) {
    const r = await page.request.get(BASE + from, { maxRedirects: 0 });
    if (r.status() !== 301 || r.headers().location !== to) fail(`redirect ${from}: ${r.status()} → ${r.headers().location}`);
  }
  for (const u of ['/resources/', '/resources/directory/']) {
    const r = await page.request.get(BASE + u, { maxRedirects: 0 });
    if (r.status() !== 200 || !(await r.text()).includes('randybuilds-resources')) fail(`${u} is not the WordPress site (${r.status()})`);
    if ((r.headers()['content-security-policy'] ?? '').includes("default-src 'self'")) fail(`${u} carries the static site's CSP`);
  }
  for (const u of ['/resources/xmlrpc.php', '/resources/readme.html']) {
    const r = await page.request.get(BASE + u, { maxRedirects: 0 });
    if (r.status() !== 404) fail(`${u} should be blocked: ${r.status()}`);
  }
  for (const u of ['/work/', '/work']) {
    const r = await page.request.get(BASE + u);
    if (r.status() !== 200 || !(await r.text()).includes('id="concepts"')) fail(`${u} is not the Work page`);
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  // unmaskd. is named on the home page only inside the Work (independent projects) section.
  const stray = await page.evaluate(() => {
    const work = document.getElementById('work');
    return [...document.querySelectorAll('main section, header, footer')]
      .filter((el) => el !== work)
      .filter((el) => /unmaskd|social platform/i.test(el.textContent + [...el.querySelectorAll('a')].map((a) => a.href).join(' ')))
      .map((el) => el.id || el.getAttribute('aria-labelledby') || el.tagName);
  });
  if (stray.length) fail(`home: unmaskd. mentioned outside Work: ${stray.join(', ')}`);
  const current = () => page.evaluate(() => document.querySelector('.site-nav__list a[aria-current]')?.textContent?.trim().replace(/^\d+/, '') ?? null);
  if ((await current()) !== null) fail('indicator: a section is marked at the top of the page');
  // Services and Work open their full pages; on the home page they still light up while their section is in view.
  for (const [sec, href, label] of [['services', '/services/', 'Services'], ['work', '/work/', 'Work']]) {
    if ((await page.getAttribute(`.site-nav__list a[data-section="${sec}"]`, 'href')) !== href) fail(`nav: ${label} does not open ${href}`);
    await page.evaluate((i) => document.getElementById(i).scrollIntoView(), sec);
    await page.waitForTimeout(800);
    if ((await current()) !== label) fail(`indicator: #${sec} in view, current is ${await current()}`);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
  for (const [id, label] of [['about', 'About'], ['faq', 'FAQ']]) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label, exact: true }).click();
    await page.waitForTimeout(1200);
    if ((await current()) !== label) fail(`indicator: after clicking ${label}, current is ${await current()}`);
    const top = await page.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().top), id);
    if (Math.abs(top) > 4) fail(`scroll: #${id} top at ${top}px, expected a full-screen panel at the top`);
    const ind = await page.evaluate(() => { const i = document.querySelector('.site-nav__ind').getBoundingClientRect(); const a = document.querySelector('.site-nav__list a[aria-current]').getBoundingClientRect(); return Math.abs(i.left - a.left) < 2 && Math.abs(i.width - a.width) < 2; });
    if (!ind) fail(`indicator: not under ${label}`);
  }
  await page.screenshot({ path: path.join(out, 'indicator-laptop-1280.png') });
  await ctx.close();
}

// Resources: the suggestion form (intercepted; nothing is sent). The listings are WordPress, at /resources/.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // Suggestion form: report a listing.
  const posts = [];
  await page.route('**/api/contact', (route) => { posts.push(route.request().postDataJSON()); route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await page.goto(BASE + '/resources/suggest/?report=webaim-wave', { waitUntil: 'networkidle' });
  if ((await page.inputValue('#cf-listing')) !== 'webaim-wave' || await page.isVisible('#cf-resource')) fail('resources: report link did not preselect the listing');
  await page.getByRole('button', { name: 'Send' }).click();
  if (!(await page.locator('.field__error').count()) || posts.length) fail('resources: empty suggestion form sent or showed no errors');
  await page.fill('#cf-message', 'The link goes to a page that moved.');
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'test@example.com');
  await page.waitForTimeout(3100);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForSelector('.cform__done');
  if (posts[0]?.kind !== 'report' || posts[0].listing !== 'webaim-wave' || 'resource' in posts[0]) fail(`resources: report payload ${JSON.stringify(posts[0])}`);
  if (!(await page.locator('.cform__done').innerText()).includes('Resource submitted!')) fail('resources: report confirmation wrong');
  // Suggestion form: a new resource gets the same confirmation.
  await page.goto(BASE + '/resources/suggest/', { waitUntil: 'networkidle' });
  await page.fill('#cf-resource', 'https://example.com/');
  await page.fill('#cf-message', 'A free checker that helped me.');
  await page.fill('#cf-name', 'Test Person');
  await page.fill('#cf-email', 'test@example.com');
  await page.waitForTimeout(3100);
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForSelector('.cform__done');
  const sentText = await page.locator('.cform__done').innerText();
  if (posts[1]?.kind !== 'resource' || !sentText.includes('Resource submitted!') || !sentText.includes('will be reviewed for inclusion.')) fail(`resources: suggestion confirmation wrong ("${sentText}")`);
  await ctx.close();
}

// Links: every internal href resolves; every mailto uses the configured address.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const site = readFileSync(path.join(root, 'src/site.ts'), 'utf8');
  const email = site.match(/email: '([^']+)'/)[1];
  const seen = new Set();
  for (const p of pages.filter((x) => !x.includes('does-not-exist'))) {
    await page.goto(BASE + p);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    for (const h of hrefs) {
      if (h.startsWith('tel:') && p.startsWith('/concepts/')) continue; // fictional 555 numbers in demos
      if (h.startsWith('mailto:')) { if (!h.startsWith(`mailto:${email}`)) fail(`mailto points elsewhere: ${h}`); continue; }
      if (/^https?:/.test(h)) { if (!h.startsWith('https://www.getunmaskd.com')) fail(`unexpected external link ${h} on ${p}`); continue; }
      const [pathOnly, hash] = h.split('#');
      const target = new URL(pathOnly || p, BASE + p).pathname;
      if (!seen.has(target)) {
        seen.add(target);
        const r = await page.request.get(BASE + target);
        if (r.status() !== 200) fail(`link ${h} on ${p}: ${r.status()}`);
      }
      if (hash && !hash.startsWith('/')) { // '#/minis' etc. are in-page game routes, not anchors
        await page.goto(BASE + target);
        if (hash && !(await page.locator(`[id="${hash}"]`).count())) fail(`link ${h} on ${p}: missing #${hash}`);
        await page.goto(BASE + p);
      }
    }
  }
  for (const f of ['/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/og.png', '/site.webmanifest', '/sitemap.xml', '/robots.txt']) {
    const r = await page.request.get(BASE + f);
    if (r.status() !== 200) fail(`${f}: ${r.status()}`);
  }
  await ctx.close();
}

await browser.close();
report.failures = failures;
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(failures.length ? `\n${failures.length} failure(s)` : '\nAll checks passed');
process.exit(failures.length ? 1 : 0);
