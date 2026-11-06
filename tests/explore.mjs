// Recommendation rules for /explore/ (src/content/explore.ts). No browser.
//   node tests/explore.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs, loadTsTree } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { steps, recs, recommend, activeSteps, prune, isUnsure, summarize, WEIGHTS } = await loadTs(path.join(root, 'src/content/explore.ts'));
const { services } = await loadTs(path.join(root, 'src/content/services.ts'));
const { demoBySlug } = await loadTsTree(path.join(root, 'src/content/demos.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const ids = (a) => recommend(a).map((r) => r.rec.id);
const A = (stage, start, goals, focus, extra = {}) => ({ stage: [stage], start: [start], goals, focus: [focus], ...extra });

// Every combination of answers a visitor can give.
const opts = (id) => steps.find((s) => s.id === id).options.map((o) => o.value);
const goalSets = opts('goals').map((g) => [g]);
const g = opts('goals').filter((x) => x !== 'unsure');
for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) goalSets.push([g[i], g[j]]);
const all = [];
for (const stage of opts('stage')) for (const start of opts('start')) for (const have of start === 'have' ? opts('have') : [undefined])
  for (const goals of goalSets) for (const offer of goals.includes('offer') ? opts('offer') : [undefined])
  for (const users of goals.includes('simplify') ? opts('users') : [undefined]) for (const focus of opts('focus')) {
    const a = A(stage, start, goals, focus);
    if (have) a.have = [have];
    if (offer) a.offer = [offer];
    if (users) a.users = [users];
    all.push(a);
  }

// Shape: two or three results, never repeated, each with a reason.
const results = all.map((a) => [a, recommend(a)]);
expect(results.every(([, r]) => r.length >= 2 && r.length <= 3), `every one of ${all.length} combinations gives 2–3 results`);
expect(results.every(([, r]) => new Set(r.map((x) => x.rec.id)).size === r.length), 'no result repeats');
expect(results.every(([, r]) => r.every((x) => x.why && x.rec.what && x.rec.helps)), 'every result says what it is, why it fits and what it could help with');
const sets = new Set(results.map(([, r]) => r.map((x) => x.rec.id).sort().join(',')));
expect(sets.size >= 20, `answers change the results (${sets.size} distinct sets)`);
const seen = new Set(results.flatMap(([, r]) => r.map((x) => x.rec.id)));
expect(seen.size === Object.keys(recs).length, 'every possibility is reachable');

// Never assume something the visitor didn't say they have.
const bad = results.filter(([a, r]) => r.some(({ rec }) =>
  (rec.id === 'improve' && !['site', 'other'].includes(a.have?.[0])) ||
  (rec.id === 'features' && !['app', 'other'].includes(a.have?.[0])) ||
  (rec.id === 'site' && ['site', 'app'].includes(a.have?.[0])) ||
  (rec.id === 'manage' && !['site', 'other'].includes(a.have?.[0]) && !(a.goals.includes('maintain') && a.start[0] !== 'scratch')) ||
  (rec.id === 'hosting' && !['site', 'app', 'other'].includes(a.have?.[0]) && !a.goals.includes('launch'))));
expect(bad.length === 0, `no improvements, updates or hosting for something they don't have, no new site for site owners (${bad.length} bad)`);
// Not offered (Randy, 2026-10-22): taking over or finishing someone else's unfinished project.
expect(!steps.some((st) => st.options.some((o) => o.value === 'unfinished')) && !('finish' in recs), 'no “something unfinished” answer and no takeover suggestion');

// Significant paths.
expect(ids(A('existing', 'have', ['reach'], 'improve', { have: ['site'] }))[0] === 'improve', 'business with a site that wants reach → focused improvements first');
expect(ids(A('existing', 'have', ['connect'], 'simple', { have: ['site'] })).includes('contact'), 'site owner who wants to be easier to reach → contact options');
expect(ids(A('existing', 'have', ['simplify'], 'specific', { have: ['app'] })).includes('features'), 'existing app → new features');
expect(ids(A('new', 'scratch', ['reach'], 'simple'))[0] === 'site', 'new and from scratch, straightforward → simple website first');
expect(ids(A('personal', 'scratch', ['idea'], 'specific'))[0] === 'prototype', 'personal idea → first working version first');
expect(ids(A('existing', 'scratch', ['simplify'], 'specific', { users: ['team'] }))[0] === 'internal', 'simplify, for the team → internal tool first');
expect(ids(A('existing', 'scratch', ['simplify'], 'specific', { users: ['public'] }))[0] === 'requests', 'simplify, for customers → request system first');
expect(ids(A('existing', 'scratch', ['offer'], 'specific')).includes('requests'), 'offer something online → request or ordering system');
expect(ids(A('existing', 'have', ['reach'], 'simple', { have: ['social'] }))[0] === 'site', 'only a social page → simple website first');
expect(ids(A('existing', 'have', ['maintain'], 'simple', { have: ['site'] }))[0] === 'manage', 'keep my site up to date → updates and fixes first');
expect(ids(A('existing', 'have', ['launch'], 'specific', { have: ['app'] }))[0] === 'hosting', 'get my app online → hosting and deployment first');
expect(ids(A('existing', 'scratch', ['offer'], 'specific', { offer: ['book'] }))[0] === 'booking', 'offer bookings → online booking first');
expect(ids(A('existing', 'scratch', ['offer'], 'specific', { offer: ['customize'] }))[0] === 'configurator', 'options and a price → product builder first');
expect(ids(A('existing', 'scratch', ['offer'], 'specific', { offer: ['account'] }))[0] === 'portal', 'sign in to an account → client portal first');
expect(ids(A('existing', 'scratch', ['offer'], 'specific', { offer: ['order'] }))[0] === 'requests', 'order something → ordering system first');
expect(!ids(A('new', 'scratch', ['maintain'], 'simple')).includes('manage'), 'starting from scratch → no updates for a site they don’t have');
const unsure = A('exploring', 'unsure', ['unsure'], 'options');
expect(recommend(unsure).length >= 2 && isUnsure(unsure), 'all “not sure” → still two starting points, plus the not-sure note');
expect(!isUnsure(A('existing', 'have', ['reach'], 'improve', { have: ['site'] })), 'decided answers → no not-sure note');
expect(recommend(A('existing', 'have', ['reach'], 'improve', { have: ['site'] }))[0].why.startsWith('You said you already have a website'), 'reason quotes the strongest answer');

// Follow-up questions appear only when they apply, and stale answers are dropped.
expect(activeSteps({}).length === 4, 'four questions by default');
expect(activeSteps({ start: ['have'] }).some((s) => s.id === 'have'), '“already have” → asks what they have');
expect(activeSteps({ goals: ['simplify'] }).some((s) => s.id === 'users'), '“simplify” → asks who would use it');
expect(activeSteps({ goals: ['offer'] }).some((s) => s.id === 'offer'), '“offer something” → asks what people would do');
expect(!('have' in prune({ start: ['scratch'], have: ['site'] })), 'changing “where are you starting” drops the old follow-up answer');
expect(!ids({ ...A('existing', 'scratch', ['reach'], 'improve'), have: ['site'] }).includes('improve'), 'a stale follow-up answer does not affect results');

// Copy rules: no guarantees, no claims of reviewing a site.
const copy = JSON.stringify(recs);
expect(!/guarantee|increase|boost|more (sales|traffic|customers|revenue)|audit|analy[sz]ed|we reviewed|your site is/i.test(copy), 'no promises of growth, no claims of an audit');
expect(!/!/.test(copy + JSON.stringify(steps)), 'no exclamation marks');
const slugs = new Set(services.map((s) => s.slug));
expect(Object.values(recs).every((r) => slugs.has(r.service)), 'every possibility links to an existing service page');
const covered = new Set(Object.values(recs).map((r) => r.service));
expect(services.every((s) => covered.has(s.slug)), `every service is a possible result (${services.filter((s) => !covered.has(s.slug)).map((s) => s.slug).join(', ') || 'all covered'})`);
expect(Object.values(recs).every((r) => !r.demo || (demoBySlug[r.demo] && !['games', 'tools'].includes(demoBySlug[r.demo].group))), 'every example demo exists on /work/ and is not a game');
for (const slug of ['ember-rye', 'alder-pine', 'tidewater', 'cove']) expect(Object.values(recs).some((r) => r.demo === slug), `product concept ${slug} is an example for a possibility`);
expect(Object.entries(WEIGHTS).every(([step, byValue]) => Object.keys(byValue).every((v) => opts(step).includes(v))), 'every rule refers to a real answer');

// Inquiry summary.
const a = A('existing', 'have', ['reach', 'connect'], 'improve', { have: ['site'] });
const text = summarize(a, recommend(a));
expect(text.includes('What do you have now? A website') && text.includes('Reach more people; Make it easier') && text.includes('A redesign or focused improvements'), 'summary lists the answers and the possibilities');
expect(text.length < 3000, 'summary fits the mailer’s 3,000-character limit');

console.log(failures ? `\n${failures} failure(s)` : '\nAll explore checks passed');
process.exit(failures ? 1 : 0);
