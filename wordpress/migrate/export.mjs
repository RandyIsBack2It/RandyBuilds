// Exports the existing Resources section (randybuilds.tech/resources/) for the
// WordPress import: every listing in src/content/resources.ts, and every guide
// in src/guides/ as the HTML the live site shows (taken from the built page in
// dist/, so wording, curly quotes and heading ids match exactly).
// Writes migrate/data.json (gitignored); migrate/import.php reads it.
//
// Run by `rbr.sh import` (loads the TypeScript with the site's tests/load-ts.mjs).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..', '..');
const { loadTs } = await import(join(site, 'tests/load-ts.mjs'));
const data = await loadTs(join(site, 'src/content/resources.ts'));

// Frontmatter of the guides is simple `key: value` lines (strings, numbers,
// booleans, [a, b] lists), so a full YAML parser isn't needed.
const frontmatter = (text) => {
  const block = text.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!block) throw new Error('guide without frontmatter');
  const out = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('[')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else if (/^\d+$/.test(v)) v = Number(v);
    out[m[1]] = v;
  }
  return out;
};

const between = (html, re, what) => {
  const m = html.match(re);
  if (!m) throw new Error(`not found in built page: ${what}`);
  return m[1].trim();
};

const guidesDir = join(site, 'src/guides');
const slugs = readdirSync(guidesDir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
const guides = slugs.map((slug) => {
  const fm = frontmatter(readFileSync(join(guidesDir, `${slug}.md`), 'utf8'));
  const built = join(site, 'dist/resources/guides', slug, 'index.html');
  if (!existsSync(built)) throw new Error(`build the site first (pnpm build): ${built} missing`);
  const html = readFileSync(built, 'utf8');
  // The rendered title/description are the frontmatter after typographic quotes.
  return {
    slug,
    ...fm,
    title: between(html, /<h1>([\s\S]*?)<\/h1>/, 'h1'),
    description: between(html, /<p class="lede">([\s\S]*?)<\/p>/, 'lede'),
    body: between(html, /<div class="prose guide__body[^"]*">([\s\S]*?)<\/div>/, 'guide body'),
    help: html.match(/<p class="wrap guide-pager__help">([\s\S]*?)<\/p>/)?.[1].trim() ?? null,
  };
}).sort((a, b) => a.order - b.order);

const out = {
  exported: new Date().toISOString(),
  source: 'https://randybuilds.tech/resources/',
  categories: data.categories,
  typeLabels: data.typeLabels,
  priceLabels: data.priceLabels,
  accountLabels: data.accountLabels,
  audiences: data.audiences,
  resources: data.resources.map((r) => ({ ...r, host: data.publisherHost(r) })),
  guides,
};
writeFileSync(join(here, 'data.json'), JSON.stringify(out, null, 1));
console.log(`  ✓ exported ${out.resources.length} listings and ${guides.length} guides to migrate/data.json`);
