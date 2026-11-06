// Adds a content hash to a /public file URL, so a re-shot image is fetched
// fresh instead of from a browser or Cloudflare cache.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const seen = new Map<string, string>();
export function versioned(src: string) {
  if (!seen.has(src)) {
    const file = readFileSync(path.join(process.cwd(), 'public', src));
    seen.set(src, `${src}?v=${createHash('sha1').update(file).digest('hex').slice(0, 8)}`);
  }
  return seen.get(src)!;
}
