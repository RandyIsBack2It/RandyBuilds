// Alder & Pine: live 3D configurator, room-fit planner, saved designs,
// share links, delivery estimate and a simulated build-slot request.
// Concept demo: nothing is sent, ordered or charged; saved designs stay on
// this device. Prices and dates come from ./data.ts (quote, buildSlots, arrival).
import { $, $$, esc, money, fmtDate, store, toast, openDialog, reducedMotion, countTo, pressFeedback } from '../shared';
import { render, seatCount, type Config, type View } from './render';
import { defaultConfig, price, quote, leadWeeks, delivery, buildSlots, pickSlot, slotKey, arrival, encode, decode, species, legs, finishes, edges } from './data';

const SAVED = 'alder-pine-saved-v1';
const views: Record<string, View> = { three: { yaw: -0.62, pitch: -0.42 }, side: { yaw: 0, pitch: -0.12 }, end: { yaw: -Math.PI / 2, pitch: -0.14 }, top: { yaw: -0.25, pitch: -1.2 } };
let cfg: Config = { ...defaultConfig };
let view: View = { ...views.three };
let target: View | null = null;
let zip = '';
let slotPick = ''; // chosen build start (YYYY-MM-DD), kept while the page is open

const form = () => $<HTMLFormElement>('[data-form]');
function readForm() {
  const f = form();
  const v = (n: string) => (f.elements.namedItem(n) as RadioNodeList | HTMLInputElement).value;
  const ch = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).checked;
  cfg = { ...cfg, length: Number(v('length')), width: Number(v('width')), species: v('species') as Config['species'], legs: v('legs') as Config['legs'], edge: v('edge') as Config['edge'], thick: v('thick') as Config['thick'], finish: v('finish') as Config['finish'], metal: v('metal') as Config['metal'], leaf: ch('leaf'), bench: ch('bench') };
}
function writeForm() {
  const f = form();
  for (const [k, val] of Object.entries(cfg)) {
    const el = f.elements.namedItem(k);
    if (!el) continue;
    if (el instanceof RadioNodeList) for (const r of Array.from(el) as HTMLInputElement[]) r.checked = r.value === val;
    else if ((el as HTMLInputElement).type === 'checkbox') (el as HTMLInputElement).checked = !!val;
    else (el as HTMLInputElement).value = String(val);
  }
  $<HTMLInputElement>('[data-chairs]').checked = cfg.chairs;
}

/* ---------- drawing ---------- */
let frame = 0;
function draw() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => render($<SVGSVGElement>('[data-svg]'), cfg, view, { grainSeed: cfg.length }));
}
function animateTo(v: View) {
  if (reducedMotion()) { view = { ...v }; draw(); return; }
  target = v;
  const step = () => {
    if (!target) return;
    const dy = target.yaw - view.yaw, dp = target.pitch - view.pitch;
    if (Math.abs(dy) < 0.003 && Math.abs(dp) < 0.003) { view = { ...target }; target = null; draw(); return; }
    view = { yaw: view.yaw + dy * 0.16, pitch: view.pitch + dp * 0.16 };
    render($<SVGSVGElement>('[data-svg]'), cfg, view, { grainSeed: cfg.length });
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- summary ---------- */
const short = (d: Date) => fmtDate(d, { month: 'short', day: 'numeric' });
function deliveryWindow(start: Date, extra = 0) {
  const [a, b] = arrival(start, cfg, extra);
  return `${short(a)} – ${short(b)}`;
}
function update(redraw = true) {
  const p = price(cfg);
  const priceEl = $('[data-price]');
  countTo(priceEl, p.total, (n) => money(Math.round(n / 10) * 10, true));
  $('[data-mprice]').textContent = money(p.total, true);
  const lw = leadWeeks(cfg);
  $('[data-lead]').textContent = `Built in about ${lw} weeks (sample lead time)`;
  $('[data-mlead]').textContent = `${lw}-week build`;
  const sp = species.find((s) => s.id === cfg.species)!;
  const L = cfg.length + (cfg.leaf ? 18 : 0);
  const spec = `${L}″ × ${cfg.width}″ · ${sp.name} · ${legs.find((l) => l.id === cfg.legs)!.name} base · ${finishes.find((f) => f.id === cfg.finish)!.name}`;
  $('[data-spec]').textContent = spec;
  $('[data-svg]').setAttribute('aria-label', `Preview of your table: ${spec}`);
  $('[data-out="length"]').textContent = `${cfg.length}″ · ${(cfg.length / 12).toFixed(1)} ft`;
  $('[data-out="width"]').textContent = `${cfg.width}″`;
  const seats = seatCount(cfg);
  $('[data-seats]').innerHTML = `<b>Seats ${seats - 2}–${seats}</b>${cfg.leaf ? ' with the leaf in' : ''}`;
  $('[data-species-note]').textContent = sp.note;
  $('[data-metal]').hidden = cfg.legs !== 'hairpin';
  $('[data-breakdown]').innerHTML = p.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === 0 ? 'Included' : (v < 0 ? '−' : '') + money(Math.abs(v), true)}</dd></div>`).join('') + `<div class="is-total"><dt>Total</dt><dd>${money(p.total, true)}</dd></div><div><dt>50% deposit, invoiced after confirmation</dt><dd>${money(quote(cfg).deposit, true)}</dd></div>`;
  history.replaceState(null, '', `#d=${encode(cfg)}`);
  renderFit();
  if (zip) renderZip();
  if (redraw) draw();
}

/* ---------- option tabs (wide screens) ---------- */
// From 980px the six option groups become one row of tabs (‹ › cycle through
// them), so the panel fits beside the preview without its own long scroll.
// Narrower screens keep one list.
const stepIds = ['size', 'wood', 'base', 'top', 'finish', 'extras'];
const wide = matchMedia('(min-width: 980px)');
let step = 'size';
function showStep(id: string, focusTab = false) {
  step = id;
  const tabbed = wide.matches;
  $('[data-tabbar]').hidden = !tabbed;
  for (const t of $$<HTMLElement>('[data-tab]')) { const on = t.dataset.tab === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
  // Keep the chosen pill in view in the one-row strip (without scrolling the page).
  const strip = $('[data-tabs]'), cur = $<HTMLElement>(`#ap-tab-${id}`);
  if (tabbed) strip.scrollTo({ left: cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  for (const s of $$<HTMLElement>('[data-step]')) {
    if (tabbed) { s.setAttribute('role', 'tabpanel'); s.setAttribute('aria-labelledby', `ap-tab-${s.dataset.step}`); s.hidden = s.dataset.step !== id; }
    else { s.removeAttribute('role'); s.removeAttribute('aria-labelledby'); s.hidden = false; }
  }
  const i = stepIds.indexOf(id);
  const next = $<HTMLButtonElement>('[data-next]');
  next.hidden = !tabbed || i === stepIds.length - 1;
  if (!next.hidden) { next.dataset.to = stepIds[i + 1]; next.textContent = `Next: ${$(`#ap-tab-${stepIds[i + 1]}`).lastChild!.textContent} →`; }
  if (focusTab) $<HTMLElement>(`#ap-tab-${id}`).focus();
}
function startSteps() {
  const list = $('[data-tabs]');
  list.addEventListener('click', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]'); if (t) showStep(t.dataset.tab!); });
  list.addEventListener('keydown', (e) => {
    const i = stepIds.indexOf(step);
    const k = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: stepIds.length - 1 } as Record<string, number>)[e.key];
    if (k === undefined) return;
    e.preventDefault();
    showStep(stepIds[(k + stepIds.length) % stepIds.length], true);
  });
  for (const b of $$<HTMLElement>('[data-tab-step]')) b.addEventListener('click', () => {
    const i = stepIds.indexOf(step) + Number(b.dataset.tabStep);
    showStep(stepIds[(i + stepIds.length) % stepIds.length]);
  });
  $('[data-next]').addEventListener('click', (e) => {
    showStep((e.currentTarget as HTMLElement).dataset.to!);
    ($<HTMLElement>(`#ap-step-${step} input:checked`) ?? $<HTMLElement>(`#ap-step-${step} input`)).focus();
  });
  wide.addEventListener('change', () => showStep(step));
  showStep(step);
}

/* ---------- rotation by drag / keys ---------- */
function startStage() {
  const box = $('[data-canvas]');
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  box.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; target = null; box.setPointerCapture(e.pointerId); box.classList.add('is-drag'); $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false')); });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view = { yaw: drag.yaw - (e.clientX - drag.x) * 0.008, pitch: Math.max(-1.35, Math.min(-0.05, drag.pitch - (e.clientY - drag.y) * 0.006)) };
    render($<SVGSVGElement>('[data-svg]'), cfg, view, { grainSeed: cfg.length });
  });
  const end = () => { drag = null; box.classList.remove('is-drag'); };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  for (const b of $$<HTMLButtonElement>('[data-view]')) b.addEventListener('click', () => {
    $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    animateTo(views[b.dataset.view!]);
  });
  $('[data-rotate]').addEventListener('click', () => animateTo({ ...view, yaw: view.yaw + Math.PI / 4 }));
  $('[data-rotate-r]').addEventListener('click', () => animateTo({ ...view, yaw: view.yaw - Math.PI / 4 }));
  $<HTMLInputElement>('[data-chairs]').addEventListener('change', (e) => { cfg.chairs = (e.target as HTMLInputElement).checked; update(); });
  // An unhurried turn on load shows that it is 3D.
  if (!reducedMotion()) { view = { yaw: -1.5, pitch: -0.3 }; setTimeout(() => animateTo(views.three), 250); }
}

/* ---------- room fit ---------- */
function renderFit() {
  const rl = Number($<HTMLInputElement>('[data-room="l"]').value) * 12 || 0;
  const rw = Number($<HTMLInputElement>('[data-room="w"]').value) * 12 || 0;
  const L = cfg.length + (cfg.leaf ? 18 : 0), W = cfg.width;
  const cl = (rl - L) / 2, cw = (rw - W) / 2;
  const worst = Math.min(cl, cw);
  const tone = (c: number) => (c >= 36 ? 'good' : c >= 30 ? 'ok' : 'bad');
  const svg = $<SVGSVGElement>('[data-plan]');
  if (rl < 72 || rw < 72) { svg.innerHTML = ''; $('[data-verdict]').innerHTML = '<p>Enter a room at least 6 feet each way.</p>'; return; }
  const s = Math.min(360 / rl, 280 / rw), ox = 200 - (rl * s) / 2, oy = 160 - (rw * s) / 2;
  const tx = 200 - (L * s) / 2, ty = 160 - (W * s) / 2;
  const seats = seatCount(cfg);
  const per = Math.floor((seats - (L >= 72 ? 2 : 0)) / 2);
  const chairs: string[] = [];
  for (let i = 0; i < per; i++) {
    const x = per === 1 ? 200 : tx + 11 * s + ((L - 22) * s / (per - 1)) * i;
    chairs.push(`<rect x="${x - 8.5 * s}" y="${ty + W * s + 3 * s}" width="${17 * s}" height="${17 * s}" rx="${3 * s}" class="ap-pchair" />`);
    if (!cfg.bench) chairs.push(`<rect x="${x - 8.5 * s}" y="${ty - 20 * s}" width="${17 * s}" height="${17 * s}" rx="${3 * s}" class="ap-pchair" />`);
  }
  if (cfg.bench) chairs.push(`<rect x="${200 - (Math.max(48, L - 24) * s) / 2}" y="${ty - 23 * s}" width="${Math.max(48, L - 24) * s}" height="${14 * s}" rx="${2 * s}" class="ap-pchair" />`);
  if (L >= 72) for (const sx of [-1, 1]) chairs.push(`<rect x="${200 + sx * ((L * s) / 2 + 11.5 * s) - 8.5 * s}" y="${160 - 8.5 * s}" width="${17 * s}" height="${17 * s}" rx="${3 * s}" class="ap-pchair" />`);
  svg.innerHTML = `
    <rect x="${ox}" y="${oy}" width="${rl * s}" height="${rw * s}" class="ap-room" />
    <rect x="${tx - 36 * s}" y="${ty - 36 * s}" width="${(L + 72) * s}" height="${(W + 72) * s}" rx="${10 * s}" class="ap-zone ap-zone--${tone(worst)}" />
    ${chairs.join('')}
    <rect x="${tx}" y="${ty}" width="${L * s}" height="${W * s}" rx="${cfg.edge === 'live' ? 6 : 2}" class="ap-ptable" />
    <g class="ap-dim ap-dim--${tone(cl)}"><path d="M${ox + 3} 160H${tx - 3}" /><text x="${(ox + tx) / 2}" y="152" text-anchor="middle">${Math.round(cl)}″</text></g>
    <g class="ap-dim ap-dim--${tone(cw)}"><path d="M200 ${oy + 3}V${ty - 3}" /><text x="206" y="${(oy + ty) / 2 + 4}">${Math.round(cw)}″</text></g>
    <text x="${ox + 6}" y="${oy + rw * s - 8}" class="ap-roomlabel">${(rl / 12).toFixed(1)} × ${(rw / 12).toFixed(1)} ft</text>`;
  const msg = worst >= 36 ? ['Comfortable fit', `At least ${Math.floor(worst)}″ on every side, enough to walk behind seated guests.`]
    : worst >= 30 ? ['Snug, but it works', `${Math.floor(worst)}″ on the tightest side. Chairs can be pulled out, but passing behind them is tight.`]
    : worst > 0 ? ['Too tight', `Only ${Math.max(0, Math.floor(worst))}″ on one side. Try ${Math.max(60, Math.floor((Math.min(rl - 72, cfg.length)) / 6) * 6)}″ long${cw < 30 ? ' or a narrower width' : ''}.`]
    : ['It won’t fit', 'The table is larger than the room. Try a shorter length.'];
  $('[data-verdict]').innerHTML = `<p class="ap-v ap-v--${tone(worst)}"><b>${msg[0]}</b>${esc(msg[1])}</p>${worst < 30 && worst > 0 ? `<button type="button" class="ap-link" data-fit-fix>Set the length to fit</button>` : ''}`;
}

/* ---------- delivery ---------- */
function renderZip() {
  const d = delivery(zip);
  const out = $('[data-zipout]');
  if (!d) { out.innerHTML = '<p class="ap-err">Enter a five-digit US ZIP code.</p>'; return; }
  const start = buildSlots(new Date())[0];
  out.innerHTML = `<dl><div><dt>Service</dt><dd>${d.zone}</dd></div><div><dt>Delivery fee</dt><dd>${money(d.fee, true)} <small>(sample)</small></dd></div><div><dt>Estimated arrival</dt><dd>${deliveryWindow(start, d.extra)}</dd></div></dl><p>${d.note} The estimate assumes the next build slot, starting ${short(start)}.</p>`;
}

/* ---------- saved designs and sharing ---------- */
type Saved = { id: string; cfg: Config; at: number };
const saved = () => store.get<Saved[]>(SAVED, []);
function updateSavedCount() { $('[data-saved-n]').textContent = String(saved().length); }
function openSaved() {
  const dlg = $<HTMLDialogElement>('[data-saved-dlg]');
  const list = saved();
  dlg.innerHTML = `<div class="ap-dlg__in"><header><h2 id="ap-saved-h">Saved designs</h2><button type="button" class="ap-x" data-close aria-label="Close">×</button></header>
    ${list.length ? `<ul class="ap-savedlist">${list.map((s) => `<li><svg viewBox="0 0 800 520" class="ap-thumb" data-thumb="${s.id}" aria-hidden="true"></svg>
      <div><b>${s.cfg.length + (s.cfg.leaf ? 18 : 0)}″ ${esc(species.find((x) => x.id === s.cfg.species)!.name)}</b><small>${esc(legs.find((x) => x.id === s.cfg.legs)!.name)} · ${esc(edges.find((x) => x.id === s.cfg.edge)!.name)} · ${esc(finishes.find((x) => x.id === s.cfg.finish)!.name)}</small><span>${money(price(s.cfg).total, true)}</span></div>
      <div class="ap-savedlist__btns"><button type="button" class="ap-btn ap-btn--sm ap-btn--primary" data-load="${s.id}">Open</button><button type="button" class="ap-btn ap-btn--sm ap-btn--ghost" data-del="${s.id}" aria-label="Delete this design">Delete</button></div></li>`).join('')}</ul>`
      : '<p class="ap-empty">Nothing saved yet. Use Save design to keep a version and compare it later.</p>'}
    <p class="ap-fine">Saved on this device only.</p></div>`;
  for (const s of list) render($<SVGSVGElement>(`[data-thumb="${s.id}"]`, dlg), { ...s.cfg, chairs: false }, views.three, { mini: true });
  if (!dlg.open) openDialog(dlg);
}

/* ---------- build-slot request (simulated) ---------- */
const totalsHtml = (q: ReturnType<typeof quote>) => `
  ${q.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === 0 ? 'Included' : (v < 0 ? '−' : '') + money(Math.abs(v), true)}</dd></div>`).join('')}
  ${q.delivery ? `<div><dt>${esc(q.delivery.zone)} (sample)</dt><dd>${money(q.delivery.fee, true)}</dd></div>` : '<div><dt>Delivery</dt><dd>Enter a ZIP code</dd></div>'}
  <div class="is-total"><dt>Total</dt><dd>${money(q.grand, true)}</dd></div>
  <div class="is-dep"><dt>50% deposit, invoiced after we confirm</dt><dd>${money(q.deposit, true)}</dd></div>
  <div><dt>Balance before delivery</dt><dd>${money(q.balance, true)}</dd></div>`;

// Slots are worked out from today's local date each time, so they never go stale.
const slotPills = (slots: Date[], pick: Date) => slots.map((d) => `<label class="ap-pill"><input type="radio" name="slot" value="${slotKey(d)}" ${d === pick ? 'checked' : ''} /><span>${fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}</span></label>`).join('');

function openCheckout() {
  const dlg = $<HTMLDialogElement>('[data-checkout-dlg]');
  const slots = buildSlots(new Date());
  slotPick = slotKey(pickSlot(slots, slotPick));
  dlg.innerHTML = `<form class="ap-dlg__in ap-co" data-co novalidate>
    <header><h2 id="ap-co-h">Request a build slot</h2><button type="button" class="ap-x" data-close aria-label="Close">×</button></header>
    <div class="ap-co__grid">
      <div class="ap-co__sum"><svg viewBox="0 0 800 520" class="ap-thumb ap-thumb--lg" data-co-thumb aria-hidden="true"></svg>
        <p class="ap-co__spec">${esc($('[data-spec]').textContent)}</p>
        <dl data-co-totals aria-live="polite"></dl></div>
      <div class="ap-co__form">
        <label>Full name<input name="name" autocomplete="name" required /></label>
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>Delivery ZIP<input name="zip" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="${esc(zip)}" required /></label>
        <fieldset class="ap-slot" data-slots><legend>Preferred build start <small>(sample dates)</small></legend>
          ${slotPills(slots, pickSlot(slots, slotPick))}
        </fieldset>
        <label>Delivery notes <small>(optional)</small><textarea name="notes" rows="2" maxlength="300" placeholder="Stairs, narrow doorways, which room"></textarea></label>
        <p class="ap-err" data-co-err role="alert"></p>
        <button type="submit" class="ap-btn ap-btn--primary ap-btn--block">Send demo request</button>
        <p class="demo-note">Demo: nothing is sent, ordered or charged. A real request would be confirmed by email before any payment.</p>
      </div>
    </div></form>`;
  const f = $<HTMLFormElement>('[data-co]', dlg);
  const refresh = () => {
    const z = $<HTMLInputElement>('[name="zip"]', f).value.trim();
    $('[data-co-totals]', f).innerHTML = totalsHtml(quote(cfg, z));
  };
  $('[name="zip"]', f).addEventListener('input', refresh);
  $('[data-slots]', f).addEventListener('change', (e) => { slotPick = (e.target as HTMLInputElement).value; });
  refresh();
  render($<SVGSVGElement>('[data-co-thumb]', dlg), { ...cfg, chairs: false }, views.three, { mini: true });
  if (!dlg.open) openDialog(dlg);
}

function submitCheckout(f: HTMLFormElement) {
  const field = (n: string) => $<HTMLInputElement>(`[name="${n}"]`, f);
  const checks: [HTMLInputElement, boolean, string][] = [
    [field('name'), !!field('name').value.trim(), 'your name'],
    [field('email'), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field('email').value.trim()), 'a valid email address'],
    [field('zip'), !!delivery(field('zip').value.trim()), 'a five-digit US ZIP code'],
  ];
  $$('input', f).forEach((i) => i.removeAttribute('aria-invalid'));
  const bad = checks.filter((c) => !c[1]);
  if (bad.length) {
    bad.forEach(([i]) => i.setAttribute('aria-invalid', 'true'));
    $('[data-co-err]', f).textContent = `Please add ${bad.map((c) => c[2]).join(' and ')}.`;
    bad[0][0].focus();
    return;
  }
  const fd = new FormData(f);
  // If the day changed while the dialog was open and the chosen date is no
  // longer offered, show the new dates with the next one selected and let
  // the visitor confirm it before the summary.
  const slots = buildSlots(new Date());
  const chosen = String(fd.get('slot') ?? '');
  const start = pickSlot(slots, chosen);
  if (slotKey(start) !== chosen) {
    slotPick = slotKey(start);
    $('[data-slots]', f).innerHTML = `<legend>Preferred build start <small>(sample dates)</small></legend>${slotPills(slots, start)}`;
    $('[data-co-err]', f).textContent = `That start date is no longer available. We selected ${fmtDate(start, { weekday: 'long', month: 'long', day: 'numeric' })}; send again to use it.`;
    $<HTMLInputElement>('[name="slot"]:checked', f).focus();
    return;
  }
  zip = field('zip').value.trim();
  const q = quote(cfg, zip);
  const [a, b] = arrival(start, cfg, q.delivery!.extra);
  const notes = String(fd.get('notes') ?? '').trim();
  const ref = `AP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  $('.ap-co__form', f).innerHTML = `<div class="ap-done" tabindex="-1"><p class="ap-eyebrow">Demo request · not sent</p><h3>Request summary</h3>
    <dl class="ap-facts">
      <div><dt>Name</dt><dd>${esc(field('name').value.trim())}</dd></div>
      <div><dt>Email</dt><dd>${esc(field('email').value.trim())}</dd></div>
      <div><dt>Build start</dt><dd>${fmtDate(start, { weekday: 'long', month: 'long', day: 'numeric' })}</dd></div>
      <div><dt>Estimated arrival</dt><dd>${short(a)} – ${short(b)}</dd></div>
      ${notes ? `<div><dt>Delivery notes</dt><dd>${esc(notes)}</dd></div>` : ''}
      <div><dt>Sample reference</dt><dd>${ref}</dd></div>
    </dl>
    <p class="ap-notsent">Nothing was sent to a workshop and nothing was charged. Your details aren’t saved.</p>
    <div class="ap-real"><h4>With a real workshop</h4><ol class="ap-next">
      <li>They would check the design and confirm measurements by email.</li>
      <li>They would invoice the ${money(q.deposit, true)} deposit. The slot is held once it’s paid.</li>
      <li>You would approve photos of your boards before anything is cut.</li>
      <li>The ${money(q.balance, true)} balance would be due before delivery.</li>
    </ol></div>
    <button type="button" class="ap-btn ap-btn--ghost ap-btn--block" data-close>Back to the design</button></div>`;
  $<HTMLElement>('.ap-done', f).focus();
}

/* ---------- press feedback ---------- */
const PRESSABLE = '.ap-btn, .ap-tabs button, .ap-tabnav, .ap-nextstep, .ap-views button, .ap-rot, .ap-saved, .ap-link, .ap-swatch, .ap-card, .ap-finish, .ap-pill, .ap-check';

export function start() {
  pressFeedback(PRESSABLE);
  const fromHash = location.hash.startsWith('#d=') ? decode(location.hash.slice(3)) : null;
  if (fromHash) { cfg = fromHash; writeForm(); if (encode(fromHash) !== encode(defaultConfig)) toast('Shared design loaded.', 'ap-toast'); }
  readForm();
  startStage();
  startSteps();
  updateSavedCount();
  update();
  form().addEventListener('input', () => { readForm(); update(); });
  form().addEventListener('submit', (e) => e.preventDefault());
  for (const b of $$('[data-reserve]')) b.addEventListener('click', openCheckout);
  $('[data-open-saved]').addEventListener('click', openSaved);
  $('[data-save]').addEventListener('click', () => {
    const list = saved();
    if (list.some((s) => encode(s.cfg) === encode(cfg))) { toast('This design is already saved.', 'ap-toast'); return; }
    list.unshift({ id: Math.random().toString(36).slice(2, 8), cfg: { ...cfg }, at: Date.now() });
    store.set(SAVED, list.slice(0, 6));
    updateSavedCount();
    const b = $('.ap-saved'); b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
    toast(`Saved. ${list.length} ${list.length === 1 ? 'design' : 'designs'} to compare.`, 'ap-toast');
  });
  $('[data-share]').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#d=${encode(cfg)}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied. Anyone with it sees this exact table.', 'ap-toast'); }
    catch { toast(`Copy this link: ${url}`, 'ap-toast'); }
  });
  for (const r of $$<HTMLInputElement>('[data-room]')) r.addEventListener('input', renderFit);
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-fit-fix]')) {
      const rl = Number($<HTMLInputElement>('[data-room="l"]').value) * 12;
      cfg.leaf = false;
      cfg.length = Math.max(60, Math.min(108, Math.floor((rl - 72) / 6) * 6));
      const rw = Number($<HTMLInputElement>('[data-room="w"]').value) * 12;
      if ((rw - cfg.width) / 2 < 30) cfg.width = Math.max(34, Math.min(46, Math.floor((rw - 60) / 2) * 2));
      writeForm(); update(); showStep('size'); toast(`Set to ${cfg.length}″ × ${cfg.width}″.`, 'ap-toast');
    }
    const pick = t.closest<HTMLElement>('[data-pick-species]');
    if (pick) { cfg.species = pick.dataset.pickSpecies as Config['species']; writeForm(); update(); showStep('wood'); $('#configure').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); }
    const dlg = t.closest('dialog');
    if (dlg && t.closest('[data-close]')) (dlg as HTMLDialogElement).close();
    const load = t.closest<HTMLElement>('[data-load]');
    if (load) { cfg = { ...saved().find((s) => s.id === load.dataset.load)!.cfg }; writeForm(); update(); $<HTMLDialogElement>('[data-saved-dlg]').close(); toast('Design opened.', 'ap-toast'); }
    const del = t.closest<HTMLElement>('[data-del]');
    if (del) { store.set(SAVED, saved().filter((s) => s.id !== del.dataset.del)); updateSavedCount(); openSaved(); $<HTMLElement>('.ap-x', $('[data-saved-dlg]')).focus(); }
  });
  $('[data-zip-go]').addEventListener('click', () => { zip = $<HTMLInputElement>('[data-zip]').value.trim(); renderZip(); });
  $('[data-zip]').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { zip = (e.target as HTMLInputElement).value.trim(); renderZip(); } });
  $('[data-checkout-dlg]').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    if (f.matches('[data-co]') && !f.querySelector('.ap-done')) submitCheckout(f);
  });
}
