// Parallax: [data-parallax="<speed>"] elements lag the scroll, measured from
// where their section enters at the bottom of the viewport (or, with
// data-parallax-origin="page", from the top of the page). Uses the
// CSS `translate` property so it composes with any transform animation.
// With data-parallax-prop="bg", it sets --py instead (the blueprint grid's
// background offset) so the grid drifts behind the content.
// Off under reduced motion and on phone-width screens.
export function startParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = [...document.querySelectorAll<HTMLElement | SVGElement>('[data-parallax]')]
    .map((el) => ({ el, speed: Number(el.dataset.parallax) || 0, page: el.dataset.parallaxOrigin === 'page', bg: el.dataset.parallaxProp === 'bg', host: el.closest('section') ?? document.body }));
  if (!items.length) return;
  const wide = window.matchMedia('(min-width: 48rem)');
  let queued = false;
  const update = () => {
    queued = false;
    if (!wide.matches) { for (const { el } of items) { el.style.translate = ''; el.style.removeProperty('--py'); } return; }
    for (const { el, speed, page, bg, host } of items) {
      const top = host.getBoundingClientRect().top;
      if (top > innerHeight || top + host.offsetHeight < 0) continue;
      const y = `${Math.round((page ? scrollY : innerHeight - top) * speed)}px`;
      if (bg) el.style.setProperty('--py', y); else el.style.translate = `0 ${y}`;
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
