// Records the unmaskd. hero loop: a visitor scrolling Mei's example profile
// card down and back up on getunmaskd.com (public page, sample profile).
// For the loop only (Randy, 2026-10-13): the phone is made shorter so the card
// scrolls further, and the frame is cropped to the hero (card, disclaimer,
// headline, buttons) — a zoom of about 1.5×, rendered at 2× for sharpness.
// Rendered frame by frame, so motion is smooth and text stays sharp, then
// encoded with ffmpeg to public/work/unmaskd/hero.mp4 (H.264 plays everywhere,
// and beat VP9 on size for this clip). Its first frame is also written as the
// stills desktop.jpg (1440×900) and card.jpg (720×450), so every unmaskd. hero
// image has the same framing (Randy, 2026-10-13).
// Starts and ends on the same frame, so it loops without a jump.
//   node scripts/capture-unmaskd-video.mjs   (needs ffmpeg)
import { chromium } from 'playwright-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/work/unmaskd');
const FPS = 30;
// Seconds: hold at the top, scroll down, hold at the end, scroll back up.
const HOLD_TOP = 1.4, DOWN = 2.6, HOLD_END = 1.6, UP = 2.2;
const total = HOLD_TOP + DOWN + HOLD_END + UP;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const progress = (s) => {
  if (s < HOLD_TOP) return 0;
  if (s < HOLD_TOP + DOWN) return ease((s - HOLD_TOP) / DOWN);
  if (s < HOLD_TOP + DOWN + HOLD_END) return 1;
  return 1 - ease((s - HOLD_TOP - DOWN - HOLD_END) / UP);
};

const frames = mkdtempSync(path.join(tmpdir(), 'unmaskd-frames-'));
const browser = await chromium.launch({ executablePath: chromePath() });
// Reduced motion keeps the hero still (otherwise the card fades in and out).
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const PHONE_HEIGHT = 520;
await page.goto('https://www.getunmaskd.com/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);
await page.addStyleTag({ content: `.lp-phone { height: ${PHONE_HEIGHT}px !important; }` });
await page.waitForTimeout(500);
// Crop: the phone (with its note) plus the headline column, padded, widened
// to 16:10 and kept below the site's nav bar.
const { range, clip } = await page.evaluate(() => {
  const body = document.querySelector('.lp-pcard__body');
  if (!body) throw new Error('profile card not found');
  const box = (el) => el.getBoundingClientRect();
  const phone = box(document.querySelector('.lp-phone-wrap'));
  const note = [...document.querySelectorAll('body *')].find((e) => e.children.length === 0 && /^example profile/i.test(e.textContent.trim()));
  const h1 = box(document.querySelector('h1'));
  const cta = box([...document.querySelectorAll('a')].find((a) => /What it/.test(a.textContent)));
  const pad = 36;
  let x0 = Math.min(phone.left, h1.left) - pad, x1 = Math.max(phone.right, h1.right, cta.right) + pad;
  let y0 = Math.min(phone.top, h1.top) - pad, y1 = Math.max(box(note).bottom, cta.bottom) + pad;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < 1.6) { const nw = h * 1.6; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / 1.6; y0 -= (nh - h) / 2; h = nh; }
  // The site's nav bar is fixed and about 57px tall; ignore full-screen fixed layers.
  let bar = document.elementFromPoint(window.innerWidth / 2, 10);
  while (bar && !(/fixed|sticky/.test(getComputedStyle(bar).position) && box(bar).height < 150)) bar = bar.parentElement;
  const nav = bar ? box(bar).bottom : 60;
  if (y0 < nav) y0 = nav;
  return { range: body.scrollHeight - body.clientHeight, clip: { x: Math.round(x0), y: Math.round(y0), width: Math.round(w), height: Math.round(h) } };
});
const count = Math.round(total * FPS);
for (let i = 0; i < count; i++) {
  await page.evaluate((y) => { document.querySelector('.lp-pcard__body').scrollTop = y; }, Math.round(progress(i / FPS) * range));
  writeFileSync(path.join(frames, `f${String(i).padStart(4, '0')}.png`), await page.screenshot({ clip }));
}
await browser.close();

// 1200×750 is plenty for the card (shown at ≤ 600px wide) and the project page.
const input = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'), '-vf', 'scale=1200:750:flags=lanczos'];
execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(out, 'hero.mp4')]);
for (const [name, w, h] of [['desktop.jpg', 1440, 900], ['card.jpg', 720, 450]]) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(frames, 'f0000.png'), '-vf', `scale=${w}:${h}:flags=lanczos`, '-q:v', '3', path.join(out, name)]);
}
rmSync(frames, { recursive: true, force: true });
console.log(`unmaskd hero loop captured (${count} frames, ${total.toFixed(1)}s, ${range}px of card scroll, crop ${clip.width}×${clip.height} at ${clip.x},${clip.y})`);
