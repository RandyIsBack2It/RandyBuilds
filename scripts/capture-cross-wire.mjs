// Captures CROSS//WIRE images from the running game: the arcade card
// (public/work/cross-wire/card.jpg) and the social preview
// (public/arcade/cross-wire/og.png): a 7×7 grid part-way solved, circuits lit.
// The grid is a demo that is not in the game, so the images spoil nothing.
//   node scripts/capture-cross-wire.mjs   (preview must be up: `tech preview`)
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromePath } from './chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.QA_BASE || 'http://127.0.0.1:18480';
const browser = await chromium.launch({ executablePath: chromePath() });

const DEMO = {
  id: 'demo', title: 'Signal Test', level: 2,
  grid: ['ARM#TOE', 'GOO#RAY', 'EDUCATE', '##NAG##', 'LETTERS', 'AWE#DOE', 'WED#YEW'],
  clues: {
    ARM: 'Limb with an elbow', TOE: 'Little piggy', GOO: 'Sticky stuff', RAY: 'Beam of light', EDUCATE: 'Teach', NAG: 'Pester',
    LETTERS: 'Mail, or the alphabet', AWE: 'Wonder', DOE: 'Female deer', WED: 'Married', YEW: 'Evergreen with red berries',
    AGE: 'Number of candles', LAW: 'Rule', ROD: 'Fishing pole', EWE: 'Female sheep', MOUNTED: 'Got on a horse', CAT: 'Feline',
    TRAGEDY: 'Shakespeare wrote many', OAT: 'Porridge grain', ROE: 'Fish eggs', EYE: 'Needle hole', SEW: 'Stitch',
  },
};
const seed = JSON.stringify({ v: 1, settings: { sound: true, music: false, feedback: true, timer: true }, solves: {}, daily: {}, records: {}, seen: [] });

async function shoot(w, h, file, type) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => localStorage.setItem('cross-wire-v1', s), seed);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/arcade/cross-wire/?debug`, { waitUntil: 'networkidle' });
  await page.evaluate((def) => window.__cw.play(def), DEMO);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const s = window.__cw.session.s;
    const want = ['ARM', 'TOE', 'GOO', 'EDUCATE', 'NAG', 'LETTERS', 'TRAGEDY', 'AGE', 'MOUNTED'];
    for (const e of s.p.entries.filter((x) => want.includes(x.answer))) {
      s.selectEntry(e.i);
      for (const i of e.cells) { s.select(i); if (s.entry.i !== e.i) s.toggleDir(); s.type(s.p.cells[i].sol); }
    }
    s.selectEntry(s.p.entries.find((x) => x.answer === 'DOE').i);
    s.type('O');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, type, quality: type === 'jpeg' ? 86 : undefined, clip: { x: 0, y: 0, width: w, height: h } });
  await ctx.close();
}

await shoot(1200, 630, path.join(root, 'public/arcade/cross-wire/og.png'), 'png');
await shoot(720, 450, path.join(root, 'public/work/cross-wire/card.jpg'), 'jpeg');
await browser.close();
console.log('CROSS//WIRE images captured');
