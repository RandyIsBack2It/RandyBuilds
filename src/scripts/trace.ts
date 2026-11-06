// Circuit trace on the home page: the lit part of .trace grows with the
// scroll, and the panel crossing the middle of the screen is marked
// .is-active (its kicker branch and node light up).
export function startTrace() {
  const trace = document.querySelector<HTMLElement>('.trace');
  const host = trace?.parentElement;
  const panels = [...document.querySelectorAll<HTMLElement>('main .panel')];
  if (!trace || !host) return;
  let queued = false;
  let active: HTMLElement | undefined;
  const update = () => {
    queued = false;
    const box = host.getBoundingClientRect();
    const line = innerHeight * 0.5;
    trace.style.setProperty('--p', String(Math.min(1, Math.max(0, (line - box.top) / box.height))));
    const hit = panels.find((p) => { const r = p.getBoundingClientRect(); return r.top <= line && r.bottom > line; });
    if (hit !== active) { active?.classList.remove('is-active'); hit?.classList.add('is-active'); active = hit; }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
}
