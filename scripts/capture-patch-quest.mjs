// Captures PATCH QUEST's images from the running game: the demo-gallery card
// (public/work/patch-quest/card.jpg) and the social preview
// (public/arcade/patch-quest/og.png). Nearest-neighbour scaling keeps pixels crisp.
//   node scripts/capture-patch-quest.mjs   (preview must be up: `tech preview`)
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:18480';
const browser = await chromium.launch({ executablePath: chromePath() });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage();
await page.goto(`${BASE}/arcade/patch-quest/?debug`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Scales the 320×180 game canvas into a w×h image (cover, centred).
const grab = (w, h, type, scale) => page.evaluate(({ w, h, type, scale }) => {
  const src = document.querySelector('.pq-screen canvas');
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  const sw = 320 * scale, sh = 180 * scale;
  x.fillStyle = '#050920'; x.fillRect(0, 0, w, h);
  x.drawImage(src, Math.round((w - sw) / 2), Math.round((h - sh) / 2), sw, sh);
  return out.toDataURL(type, 0.86).split(',')[1];
}, { w, h, type, scale });

// Social preview: the title screen.
writeFileSync(path.join(root, 'public/arcade/patch-quest/og.png'), Buffer.from(await grab(1200, 630, 'image/png', 3.75), 'base64'));

// Gallery card: Patch at a terminal on level 1, with a glitch and cells in view.
await page.evaluate(() => {
  const g = window.__pq.game;
  g.newRun();
  g.mode = 'play';
  const t = g.required[0];
  g.player.place(t.x - 26, t.y + t.h - g.player.h);
  g.player.face = 1;
  g.snapCamera();
});
await page.waitForTimeout(1200);
writeFileSync(path.join(root, 'public/work/patch-quest/card.jpg'), Buffer.from(await grab(720, 450, 'image/jpeg', 2.5), 'base64'));
await browser.close();
console.log('PATCH QUEST images captured');
