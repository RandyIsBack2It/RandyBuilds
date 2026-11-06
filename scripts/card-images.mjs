// Smaller WebP copies of every card image (public/work/<slug>/card.jpg) for
// srcset: card.<hash>.440.webp and card.<hash>.720.webp, where <hash> is the
// JPEG's own content hash. Cards use them only when the hash matches
// (src/lib/card-image.ts), so a re-shot card.jpg without fresh copies just
// falls back to the JPEG. Run after re-shooting any card:  pnpm cards
// Uses the host's cached Playwright Chromium to encode (no image library).
import { chromium } from 'playwright-core';
import { chromePath } from './chrome.mjs';
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, 'public/work');
export const WIDTHS = [440, 720];

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
let made = 0;
for (const slug of readdirSync(work)) {
  const dir = path.join(work, slug), jpg = path.join(dir, 'card.jpg');
  if (!existsSync(jpg)) continue;
  const buf = readFileSync(jpg);
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 8);
  for (const f of readdirSync(dir)) if (/^card\.[0-9a-f]{8}\.\d+\.webp$/.test(f) && !f.startsWith(`card.${hash}.`)) unlinkSync(path.join(dir, f));
  for (const w of WIDTHS) {
    const out = path.join(dir, `card.${hash}.${w}.webp`);
    if (existsSync(out)) continue;
    const b64 = await page.evaluate(async ({ src, w }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = Math.min(w, img.naturalWidth);
      c.height = Math.round((img.naturalHeight * c.width) / img.naturalWidth);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.8).split(',')[1];
    }, { src: `data:image/jpeg;base64,${buf.toString('base64')}`, w });
    writeFileSync(out, Buffer.from(b64, 'base64'));
    made++;
    console.log(`  ${slug}/card.${hash}.${w}.webp  ${Math.round(Buffer.from(b64, 'base64').length / 1024)} KB (jpg ${Math.round(buf.length / 1024)} KB)`);
  }
}
await browser.close();
console.log(made ? `${made} file(s) written` : 'all card images up to date');
