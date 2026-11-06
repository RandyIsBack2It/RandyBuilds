// Back-to-top key (same as the main site's scripts/to-top.ts): shown once the
// page is a screen down, with a cobalt→orange bar that fills with the scroll.
// Without JS it is a plain link to #main. With JS it scrolls up without adding
// a hash and moves focus to <main>, so keyboard users land at the top too.
(() => {
  const key = document.querySelector('.totop');
  const main = document.getElementById('main');
  if (!key || !main) return;
  document.documentElement.classList.add('js');
  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    key.classList.toggle('is-shown', max > 0 && scrollY > innerHeight * 0.9);
    key.style.setProperty('--p', String(max > 0 ? Math.min(1, scrollY / max) : 0));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  key.addEventListener('click', (e) => {
    e.preventDefault();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    main.focus({ preventScroll: true });
  });
  update();
})();
