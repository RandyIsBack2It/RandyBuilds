// Renders the raster brand assets into public/ from SVG/HTML sources:
//   favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png, og.png
// Run after changing the mark or the OG layout:  pnpm assets
// Uses the host's cached Playwright Chromium (set CHROME_PATH to override).
import { chromium } from 'playwright-core';
import { chromePath } from './chrome.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => path.join(root, 'public', f);
// Fonts inlined as data URLs: setContent pages can't load file:// URLs.
const font = (f) => 'data:font/woff2;base64,' + readFileSync(path.join(root, 'src/fonts', f)).toString('base64');


const favicon = readFileSync(pub('favicon.svg'), 'utf8');

const iconHtml = (size, padded) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;${padded ? 'background:#07111c;display:grid;place-items:center' : ''}">
  <div style="width:${padded ? size * 0.82 : size}px;height:${padded ? size * 0.82 : size}px">${favicon.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
</div></body></html>`;

const ogHtml = `<!doctype html><html><head><style>
@font-face { font-family: S; src: url(${font('schibsted-grotesk-latin-wght-normal.woff2')}); font-weight: 400 900; }
@font-face { font-family: M; src: url(${font('jetbrains-mono-latin-wght-normal.woff2')}); font-weight: 100 800; }
* { box-sizing: border-box; }
body { margin: 0; }
.og { position: relative; width: 1200px; height: 630px; color: #e6edf5; font-family: S; display: grid; grid-template-rows: 1fr auto; overflow: hidden;
  background-color: #07111c;
  background-image: radial-gradient(700px 420px at 90% 0%, rgba(29,85,196,.35), transparent 70%), radial-gradient(500px 360px at 0% 100%, rgba(242,92,31,.16), transparent 70%),
    linear-gradient(rgba(110,160,230,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(110,160,230,.1) 1px, transparent 1px),
    linear-gradient(rgba(110,160,230,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(110,160,230,.05) 1px, transparent 1px);
  background-size: auto, auto, 120px 120px, 120px 120px, 24px 24px, 24px 24px; }
.main { padding: 60px 80px 0; display: flex; flex-direction: column; justify-content: space-between; }
.wm { display: flex; align-items: center; gap: 16px; font-size: 36px; font-weight: 500; letter-spacing: -0.02em; }
.wm b { font-weight: 850; }
.wm .d { color: #ff8a57; } .wm .t { font-family: M; font-size: 33px; color: #6ea0ff; letter-spacing: 0; }
.wm svg { width: 46px; height: 46px; }
.prompt { font: 500 26px M; color: #9db0c4; margin-bottom: 18px; } .prompt .u { color: #19b38a; } .prompt .p { color: #6ea0ff; } .prompt .c { color: #e6edf5; }
h1 { margin: 0 0 52px; font-size: 112px; line-height: 0.95; letter-spacing: -0.045em; font-weight: 850; }
h1 .a { background: linear-gradient(90deg, #6ea0ff, #ff8a57); -webkit-background-clip: text; color: transparent; }
h1 .k { display: inline-block; width: 52px; height: 92px; margin-left: 8px; vertical-align: -6px; background: #f25c1f; box-shadow: 0 0 30px rgba(242,92,31,.7); }
.foot { display: flex; justify-content: space-between; align-items: center; padding: 26px 80px; background: rgba(5,12,21,.9); color: #9db0c4; font: 500 24px M; }
.foot strong { color: #e6edf5; font-weight: 700; }
.line { height: 3px; background: linear-gradient(90deg, #6ea0ff, #f25c1f); box-shadow: 0 0 18px rgba(110,160,255,.6); }
</style></head><body><div class="og">
<div class="main">
<div class="wm">${favicon.replace('<svg ', '<svg width="46" height="46" ')}<span><b>Randy</b>Builds<span class="d">.</span><span class="t">tech</span></span></div>
<div><div class="prompt"><span class="u">dev@randybuilds</span>:<span class="p">~</span>$ <span class="c">./build --your-idea</span></div>
<h1>Have an idea?<br><span class="a">Let’s build it.</span><span class="k"></span></h1></div>
</div>
<div><div class="line"></div><div class="foot"><strong>RandyBuilds.tech</strong><span>Websites and web apps for small businesses</span></div></div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
for (const [file, size, padded] of [
  ['favicon-32.png', 32, false],
  ['apple-touch-icon.png', 180, true],
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(iconHtml(size, padded));
  await page.screenshot({ path: pub(file), omitBackground: !padded, clip: { x: 0, y: 0, width: size, height: size } });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(ogHtml);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: pub('og.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('assets rendered');
