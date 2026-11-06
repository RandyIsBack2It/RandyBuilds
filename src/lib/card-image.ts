// WebP srcset for a card image (public/work/<slug>/card.jpg), from the copies
// scripts/card-images.mjs makes (`pnpm cards`). They are named after the JPEG's
// content hash, so a re-shot card without fresh copies gets no srcset and the
// JPEG is used as before.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const WIDTHS = [440, 720];
const seen = new Map<string, string | null>();
export function cardSrcset(src: string) {
  if (!seen.has(src)) {
    let set: string | null = null;
    if (/\/card\.jpg$/.test(src)) {
      const pub = path.join(process.cwd(), 'public');
      const hash = createHash('sha1').update(readFileSync(path.join(pub, src))).digest('hex').slice(0, 8);
      const files = WIDTHS.map((w) => [w, src.replace(/card\.jpg$/, `card.${hash}.${w}.webp`)] as const);
      if (files.every(([, f]) => existsSync(path.join(pub, f)))) set = files.map(([w, f]) => `${f} ${w}w`).join(', ');
    }
    seen.set(src, set);
  }
  return seen.get(src)!;
}
