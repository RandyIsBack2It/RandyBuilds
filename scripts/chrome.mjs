// Path to the host's cached Playwright Chromium matching playwright-core.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const rev = JSON.parse(readFileSync(path.join(root, 'node_modules/playwright-core/browsers.json'), 'utf8'))
    .browsers.find((b) => b.name === 'chromium').revision;
  for (const dir of ['chrome-linux64', 'chrome-linux']) {
    const p = path.join(homedir(), '.cache/ms-playwright', `chromium-${rev}`, dir, 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('Chromium not found; set CHROME_PATH');
}
