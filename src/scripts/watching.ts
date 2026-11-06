// /watching/ (Easter egg): an alien eye whose pupil follows the pointer; the
// eye itself stays put (still under reduced motion), and a Back button that returns to the page the visitor
// came from on this site. Nothing is recorded.
export function startWatching() {
  const back = document.querySelector<HTMLAnchorElement>('[data-back]');
  back?.addEventListener('click', (e) => {
    let same = false;
    try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch { /* no referrer */ }
    if (same && history.length > 1) { e.preventDefault(); history.back(); }
  });

  const eye = document.querySelector<SVGSVGElement>('[data-eye]');
  const pupil = document.querySelector<SVGElement>('[data-pupil]');
  if (!eye || !pupil || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const look = (x: number, y: number) => {
    const r = eye.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (r.width * 0.6));
    // The pupil stays inside the iris (r 34): up to 22 across and 7 up or down.
    pupil.style.transform = `translate(${(dx / d) * k * 22}px, ${(dy / d) * k * 7}px)`;
  };
  addEventListener('pointermove', (e) => look(e.clientX, e.clientY), { passive: true });
  // Touch screens: it glances around on its own.
  if (matchMedia('(hover: none)').matches) {
    setInterval(() => { const b = eye.getBoundingClientRect(); look(b.left + (Math.random() * 3 - 1) * b.width, b.top + (Math.random() * 3 - 1) * b.height); }, 1600);
  }
}
