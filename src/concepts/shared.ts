// Small helpers shared by the flagship concept products (/concepts/<slug>/).
// Everything here is DOM-light and dependency-free. The strict CSP forbids
// style="" attributes, so markup strings never carry them: positions and
// colours that change at runtime are set through CSSOM (`css()` below).

/** Escape text for use inside an HTML template string. */
export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/** Set custom properties / styles through CSSOM (CSP-safe). */
export function css(el: HTMLElement | SVGElement, props: Record<string, string | number>) {
  for (const [k, v] of Object.entries(props)) el.style.setProperty(k, String(v));
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const money = (n: number, whole = false) => (whole ? usd0 : usd).format(n);

/** Deterministic PRNG so "random" availability is stable for a given day. */
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const daySeed = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
export const fmtTime = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
export const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  d.toLocaleDateString('en-US', opts);

/** Offer an .ics file for a calendar event (generated locally, nothing sent). */
export function downloadIcs(opts: { title: string; start: Date; minutes: number; location: string; description: string; file: string }) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(opts.start.getTime() + opts.minutes * 60000);
  const text = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RandyBuilds.tech//Concept demo//EN', 'BEGIN:VEVENT',
    `UID:${Date.now()}@concept.randybuilds.tech`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(opts.start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${opts.title}`, `LOCATION:${opts.location}`, `DESCRIPTION:${opts.description}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: opts.file });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

/** A polite status toast. One per page; `cls` lets each concept style it. */
let toastEl: HTMLElement | undefined;
let toastTimer: number | undefined;
export function toast(message: string, cls = 'cx-toast') {
  if (!toastEl) {
    toastEl = document.createElement('p');
    toastEl.className = cls;
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('is-on'), 5200);
}

/**
 * Modal dialogs built on <dialog>: focus is trapped by the browser, Escape
 * closes, and focus returns to whatever opened it.
 */
export function openDialog(dlg: HTMLDialogElement) {
  const back = document.activeElement as HTMLElement | null;
  dlg.showModal();
  document.documentElement.classList.add('cx-locked');
  dlg.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('cx-locked');
    back?.focus?.();
  }, { once: true });
  // Clicking the backdrop closes. Added as a listener, once per dialog: a
  // property here would replace a concept's own click handler on the dialog.
  if (!backdropBound.has(dlg)) {
    backdropBound.add(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
}
const backdropBound = new WeakSet<HTMLDialogElement>();

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Press feedback: adds `.is-pressed` to the clicked control so the concept's
 * CSS can ripple a ring around it (an ::after animation named `*-press`).
 * Controls never move, so a click near an edge can't slip off the target.
 * A click on a label is followed by one on its input; only that one counts.
 */
export function pressFeedback(selector: string) {
  document.addEventListener('click', (e) => {
    if (reducedMotion()) return;
    const t = e.target as HTMLElement;
    let el = t.closest<HTMLElement>(selector);
    if (!el || (el.matches('label') && t.tagName !== 'INPUT')) return;
    // Lists that redraw on click (times, dates, cart lines) replace the control:
    // find its replacement by the same data-* attributes.
    if (!el.isConnected) {
      const attrs = Array.from(el.attributes).filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
      el = attrs ? document.querySelector<HTMLElement>(el.tagName.toLowerCase() + attrs) : null;
      if (!el) return;
    }
    el.classList.remove('is-pressed');
    void el.offsetWidth;
    el.classList.add('is-pressed');
  });
  document.addEventListener('animationend', (e) => {
    if (e.animationName.endsWith('-press')) (e.target as HTMLElement).closest('.is-pressed')?.classList.remove('is-pressed');
  });
}

/** Animate a number in an element (skips under reduced motion or in a hidden tab).
 *  The count is decoration only: the final value always lands, even when the
 *  browser throttles or pauses animation frames, and a newer call replaces an
 *  older one. Screen readers hear only the final value (aria-busy while counting). */
const counting = new WeakMap<HTMLElement, { frame: number; timer: number }>();
export function countTo(el: HTMLElement, to: number, fmt: (n: number) => string, ms = 650) {
  const from = Number(el.dataset.v ?? 0);
  el.dataset.v = String(to);
  const prev = counting.get(el);
  if (prev) { cancelAnimationFrame(prev.frame); clearTimeout(prev.timer); counting.delete(el); }
  const finish = () => {
    const run = counting.get(el);
    if (run) { cancelAnimationFrame(run.frame); clearTimeout(run.timer); counting.delete(el); }
    el.textContent = fmt(to);
    el.removeAttribute('aria-busy');
  };
  if (reducedMotion() || document.hidden || from === to) { finish(); return; }
  el.setAttribute('aria-busy', 'true');
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    if (k >= 1) { finish(); return; }
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    counting.get(el)!.frame = requestAnimationFrame(step);
  };
  // Timers keep running when frames stall, so this guarantees the real value shows.
  counting.set(el, { frame: requestAnimationFrame(step), timer: window.setTimeout(finish, ms + 50) });
}
