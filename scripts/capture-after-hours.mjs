// Captures AFTER HOURS images from the running game: the demo-gallery card
// (public/work/after-hours/card.jpg) and the social preview
// (public/arcade/after-hours/og.png). Nearest-neighbour scaling keeps pixels crisp.
//   node scripts/capture-after-hours.mjs   (preview must be up: `tech preview`)
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:18480';
const browser = await chromium.launch({ executablePath: chromePath() });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage();
await page.goto(`${BASE}/arcade/after-hours/?debug`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.__ah.game.setMode('title'));
await page.waitForTimeout(1500);

// Scales the 320×180 game canvas into a w×h image (cover, centred).
const grab = (w, h, type, scale) => page.evaluate(({ w, h, type, scale }) => {
  const src = document.querySelector('.ah-screen canvas');
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
writeFileSync(path.join(root, 'public/arcade/after-hours/og.png'), Buffer.from(await grab(1200, 630, 'image/png', 3.75), 'base64'));

// Gallery card: the club, mid-brawl, under the lights.
await page.evaluate(() => {
  const g = window.__ah.game;
  g.newRun(4);
  g.mode = 'play';
  for (const s of g.slots) s.done = true;
  g.doorOpen = true;
  g.viv.place(52 * 16, 160 - 22);
  g.viv.face = 1;
  g.chaos = 45;
  g.snapCamera();
});
await page.waitForTimeout(900);
await page.evaluate(() => { const g = window.__ah.game; g.mode = 'paused'; g.caption.t = 0; });
writeFileSync(path.join(root, 'public/work/after-hours/card.jpg'), Buffer.from(await grab(720, 450, 'image/jpeg', 2.5), 'base64'));
await browser.close();
console.log('AFTER HOURS images captured');
