// Home page "What I’ve built": feature one project at random and show the
// three after it in the rotation (content/showcase.ts). The pick is kept for
// the browser session, so it doesn't change while someone browses the site.
// A share link (/p/<code>/) is fixed at build time. It makes its project
// this session's pick and shows the plain home address (Randy, 2026-10-25), so
// a reload or the logo opens the home page with the same project first.
import { nextAfter } from '../lib/rotation';

const KEY = 'rbt-home-feature';

export function startShowcase() {
  const shared = document.querySelector<HTMLElement>('[data-share-feature]')?.dataset.shareFeature;
  if (shared) {
    try { sessionStorage.setItem(KEY, shared); } catch { /* storage blocked: only this page view is fixed */ }
    history.replaceState(history.state, '', `/${location.search}${location.hash}`);
    return;
  }
  const root = document.querySelector<HTMLElement>('[data-showcase]');
  const list = root?.querySelector<HTMLElement>('.demo-list');
  if (!root || !list) return;
  const slugs = (root.dataset.showcase ?? '').split(' ').filter(Boolean);
  let pick: string | null = null;
  try { pick = sessionStorage.getItem(KEY); } catch { /* storage blocked: a new pick each time */ }
  if (!pick || !slugs.includes(pick)) {
    pick = slugs[Math.floor(Math.random() * slugs.length)];
    try { sessionStorage.setItem(KEY, pick); } catch { /* as above */ }
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-feature]')) {
    el.hidden = el.dataset.feature !== pick;
    if (el.hidden) el.querySelector('video')?.pause();
  }
  const cards = new Map([...list.querySelectorAll<HTMLElement>('[data-demo]')].map((li) => [li.dataset.demo!, li]));
  const support = nextAfter(slugs, pick, 3);
  for (const [slug, li] of cards) li.hidden = !support.includes(slug);
  for (const slug of support) { const li = cards.get(slug); if (li) list.append(li); }
}
