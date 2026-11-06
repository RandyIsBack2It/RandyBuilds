// Resource listing data (content/resources.ts: the suggest form's listings and the WordPress import). No browser.
//   node tests/resources.mjs
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadTs } from './load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { resources, categories, typeLabels, priceLabels, accountLabels, audiences } = await loadTs(path.join(root, 'src/content/resources.ts'));

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const each = (label, fn) => { const bad = resources.filter((r) => !fn(r)).map((r) => r.id); expect(!bad.length, `${label}${bad.length ? `: ${bad.join(', ')}` : ''}`); };

// ── Data ──────────────────────────────────────────────────────────────
console.log('data');
const ids = resources.map((r) => r.id);
expect(new Set(ids).size === ids.length, 'ids are unique');
const urls = resources.map((r) => r.url.replace(/\/$/, '').toLowerCase());
expect(new Set(urls).size === urls.length, 'no two listings share a URL');
expect(new Set(resources.map((r) => r.name.toLowerCase())).size === resources.length, 'names are unique');
each('ids are kebab-case', (r) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id));
each('URLs are https', (r) => { try { return new URL(r.url).protocol === 'https:'; } catch { return false; } });
each('known category', (r) => categories.some((c) => c.id === r.category));
each('known type', (r) => r.type in typeLabels);
each('known price label', (r) => r.price in priceLabels);
each('account is known or left out', (r) => r.account === undefined || r.account in accountLabels);
each('at least one known audience', (r) => r.audience.length > 0 && r.audience.every((a) => audiences.some((x) => x.id === a)));
each('checked is an ISO date, not in the future', (r) => /^\d{4}-\d{2}-\d{2}$/.test(r.checked) && new Date(r.checked) <= new Date());
each('description is 40–320 characters', (r) => r.description.length >= 40 && r.description.length <= 320);
each('goodFor is short (≤ 70)', (r) => r.goodFor.length <= 70);
each('free tiers and trials explain themselves', (r) => r.price === 'free' || Boolean(r.priceNote));
// Voice and honesty rules (CLAUDE.md): no hype, no endorsement claims, no third-party prices.
const text = (r) => [r.name, r.description, r.goodFor, r.priceNote ?? ''].join(' ');
each('no exclamation marks', (r) => !text(r).includes('!'));
each('no prices or dollar amounts', (r) => !/\$\s?\d|\d+\s?(usd|dollars)\b|per month|\/mo\b/i.test(text(r)));
each('no endorsement or hype words', (r) => !/\b(we recommend|endorse|best-in-class|world-class|amazing|revolutionary|must-have|ai-powered)\b/i.test(text(r)));
each('American spelling (no -ise/-our forms)', (r) => !/\b(organis|optimis|recognis|colour|favour|behaviour|centre)\w*/i.test(text(r)));
expect(resources.length >= 50, `at least 50 resources (${resources.length})`);
for (const c of categories) expect(resources.filter((r) => r.category === c.id).length >= 3, `${c.title}: at least 3 listings`);
expect(resources.some((r) => r.start), 'some listings are marked as good places to start');

// Research record lists every published entry (RESOURCE_RESEARCH.md).
const research = readFileSync(path.join(root, 'RESOURCE_RESEARCH.md'), 'utf8');
each('listed in RESOURCE_RESEARCH.md with its URL', (r) => research.includes(r.url));

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
