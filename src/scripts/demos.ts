// Work page: "Discuss a similar project" names the example in the form below
// (also from ?similar=<slug>, used by the demo pages and /work/<slug>/ pages).
// Nothing is sent until Send.
import { pickDemo } from './contact';

export function startDemos() {
  const section = document.getElementById('similar');
  if (!section) return;
  const picked = section.querySelector<HTMLElement>('.demo__picked')!;
  const pick = (slug: string | undefined, focus: boolean) => {
    const title = slug ? pickDemo(slug) : undefined;
    if (!title) return;
    picked.textContent = `Example chosen: ${title}. You can change it in the form.`;
    if (focus) {
      const h = section.querySelector<HTMLElement>('h2')!;
      h.focus({ preventScroll: true });
      section.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-similar]');
    if (!a) return;
    e.preventDefault();
    pick(a.dataset.similar, true);
  });
  const fromLink = new URLSearchParams(location.search).get('similar');
  if (fromLink) {
    pick(fromLink, false);
    history.replaceState(null, '', `${location.pathname}#similar`);
  }
}
