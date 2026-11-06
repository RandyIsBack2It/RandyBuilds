// Small-screen disclosure menu (same behaviour as the main site's header).
// Without JS the list simply shows.
(() => {
  const nav = document.querySelector('.site-nav');
  const toggle = nav && nav.querySelector('.site-nav__toggle');
  if (!nav || !toggle) return;
  document.documentElement.classList.add('js');
  const behind = () => [...document.querySelectorAll('body > :not(.site-header):not(script):not(.skip):not(#wpadminbar)')];
  const set = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('nav-open', open);
    for (const el of behind()) el.inert = open;
  };
  matchMedia('(min-width: 62.01rem)').addEventListener('change', (e) => { if (e.matches) set(false); });
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); toggle.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) set(false);
  });
})();
