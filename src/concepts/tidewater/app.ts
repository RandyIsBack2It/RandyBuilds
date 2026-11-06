// Tidewater Mechanical Ops: a field-service back office in the browser.
// Concept demo: all data is generated sample data (data.ts) and every change
// lives only in this tab. Texts, emails and signatures are simulated.
import { $, $$, esc, money, css, fmtTime, toast, openDialog } from '../shared';
import { startDemoForms } from '../../scripts/demo-forms';
import { techs, customers, jobs, pricebook, checklists, typeInfo, statusLabel, DEMO_NOW, TAX, type Job, type JobType, type Status, type Customer, type PriceItem } from './data';
import { report, ranges, type Range } from './reports';

const DAY0 = 7 * 60, DAY1 = 18 * 60, SPAN = DAY1 - DAY0;
const custById = Object.fromEntries(customers.map((c) => [c.id, c])) as Record<string, Customer>;
const techById = Object.fromEntries(techs.map((t) => [t.id, t]));
const loadedAt = Date.now();
const now = () => Math.min(DAY1, DEMO_NOW + Math.floor((Date.now() - loadedAt) / 60000));
const initials = (n: string) => n.split(' ').map((p) => p[0]).join('');
const TT = (s: string) => `<span class="tw-type tw-type--${s}">${esc(typeInfo[s as JobType].label)}</span>`;
let selectedTech: string | null = null;
let nextJob = 7400;

/* ================= router ================= */
const titles: Record<string, [string, string]> = {
  dispatch: ['Dispatch', 'Today’s board'], request: ['Requests', 'New service request'], estimates: ['Sales', 'Estimate builder'], customers: ['Customers', 'Customer list'], reports: ['Reports', 'Business overview'],
};
function route() {
  const id = (location.hash.slice(1) in titles) ? location.hash.slice(1) : 'dispatch';
  for (const v of $$('[data-view]')) v.hidden = v.dataset.view !== id;
  for (const a of $$('[data-nav]')) { if (a.dataset.nav === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  $('[data-crumb]').textContent = titles[id][0];
  $('[data-title]').textContent = titles[id][1];
  if (id === 'dispatch') renderDispatch();
  if (id === 'estimates') renderEstimate();
  if (id === 'customers') renderCustomers();
  if (id === 'reports') renderReports();
}
function go(id: string) {
  if (location.hash === `#${id}`) route(); else location.hash = id;
  $<HTMLElement>('.tw-main').scrollTo?.({ top: 0 });
}

/* ================= dispatch ================= */
const overlaps = (a: Job, b: Job) => a.tech === b.tech && a.id !== b.id && a.start < b.start + b.dur && b.start < a.start + a.dur;
const conflicted = (j: Job) => !!j.tech && jobs.some((o) => overlaps(j, o));
const pct = (m: number) => ((m - DAY0) / SPAN) * 100;

function renderKpis() {
  const assigned = jobs.filter((j) => j.tech);
  const booked = assigned.reduce((s, j) => s + j.value, 0);
  const done = jobs.filter((j) => j.status === 'done').length;
  const util = Math.round((assigned.reduce((s, j) => s + j.dur, 0) / (techs.length * 600)) * 100);
  const un = jobs.filter((j) => !j.tech).length;
  const conflicts = assigned.filter(conflicted).length;
  $('[data-kpis]').innerHTML = [
    ['Booked today', money(booked, true), `${assigned.length} jobs on the board`],
    ['Completed', `${done} of ${jobs.length}`, `${jobs.filter((j) => j.status === 'onsite').length} on site now`],
    ['Unassigned', String(un), un ? 'Drag them onto the board' : 'Everything is covered', un ? 'warn' : 'good'],
    ['Utilization', `${util}%`, conflicts ? `${conflicts} overlapping jobs` : 'No overlaps', conflicts ? 'bad' : ''],
  ].map(([k, v, s, tone]) => `<div class="tw-kpi ${tone ? `tw-kpi--${tone}` : ''}"><p>${k}</p><b>${v}</b><small>${s}</small></div>`).join('');
}

function jobBlock(j: Job, inTray = false) {
  const c = custById[j.customer];
  const conflict = conflicted(j);
  return `<button type="button" class="tw-job tw-job--${j.type} is-${j.status} ${conflict ? 'is-conflict' : ''} ${inTray ? 'tw-job--tray' : ''}" data-job="${j.id}">
    <span class="tw-job__top"><b>${esc(j.title)}</b>${j.status === 'done' ? '<i class="tw-ok" aria-hidden="true">✓</i>' : ''}${conflict ? '<i class="tw-warn" aria-hidden="true">!</i>' : ''}</span>
    <span class="tw-job__meta">${inTray ? `${typeInfo[j.type].short} · ${j.dur / 60}h · ` : `${fmtTime(j.start)} · `}${esc(c.name)}</span>
    <span class="tw-vh">, ${esc(typeInfo[j.type].label)}, ${inTray ? 'unassigned' : `until ${fmtTime(j.start + j.dur)}`}, ${statusLabel[j.status]}${conflict ? ', overlaps another job' : ''}</span>
  </button>`;
}

function renderBoard() {
  const board = $('[data-board]');
  const hrs = Array.from({ length: SPAN / 60 + 1 }, (_, i) => DAY0 + i * 60);
  board.innerHTML = `
    <div class="tw-board__head"><div class="tw-board__corner">Technician</div><div class="tw-board__hours">${hrs.map((h) => `<span data-h="${h}">${fmtTime(h).replace(':00', '')}</span>`).join('')}</div></div>
    ${techs.map((t) => {
      const mine = jobs.filter((j) => j.tech === t.id).sort((a, b) => a.start - b.start);
      const hours = mine.reduce((s, j) => s + j.dur, 0) / 60;
      return `<div class="tw-row ${selectedTech === t.id ? 'is-sel' : ''}" data-row="${t.id}">
        <button type="button" class="tw-row__tech" data-tech="${t.id}" aria-pressed="${selectedTech === t.id}">
          <span class="tw-av" data-color="${t.id}">${initials(t.name)}</span><span><b>${esc(t.name)}</b><small>${esc(t.role)} · ${hours}h booked</small></span></button>
        <div class="tw-lane" data-lane="${t.id}">${mine.map((j) => jobBlock(j)).join('')}</div>
      </div>`;
    }).join('')}
    <div class="tw-now" data-now aria-hidden="true"><span></span></div>`;
  for (const [i, h] of hrs.entries()) { const s = $<HTMLElement>(`[data-h="${h}"]`, board); css(s, { left: `${(i / (hrs.length - 1)) * 100}%` }); }
  for (const el of $$<HTMLElement>('.tw-lane .tw-job', board)) {
    const j = jobs.find((x) => x.id === el.dataset.job)!;
    css(el, { left: `${pct(j.start)}%`, width: `calc(${(j.dur / SPAN) * 100}% - 3px)` });
  }
  for (const av of $$<HTMLElement>('[data-color]', board)) css(av, { '--c': techById[av.dataset.color!].color });
  placeNow();
  const tray = $('[data-tray]');
  const un = jobs.filter((j) => !j.tech);
  tray.innerHTML = `<p class="tw-tray__label">Unassigned <span>${un.length}</span></p><div class="tw-tray__list">${un.length ? un.map((j) => jobBlock(j, true)).join('') : '<p class="tw-tray__empty">All jobs assigned. Drop one here to unassign it.</p>'}</div>`;
}
function placeNow() {
  const el = $<HTMLElement>('[data-now]');
  if (!el) return;
  const lane = $<HTMLElement>('.tw-lane');
  const board = $<HTMLElement>('[data-board]');
  const x = lane.offsetLeft + (lane.offsetWidth * pct(now())) / 100;
  css(el, { left: `${x}px`, top: `${lane.parentElement!.offsetTop}px`, height: `${board.scrollHeight - lane.parentElement!.offsetTop}px` });
  $('span', el).textContent = fmtTime(now());
}

function renderMap() {
  const svg = $<SVGSVGElement>('[data-map]');
  const n = now();
  const pos = (t: string) => {
    const mine = jobs.filter((j) => j.tech === t).sort((a, b) => a.start - b.start);
    const cur = mine.find((j) => j.start <= n && n < j.start + j.dur);
    if (cur) return custById[cur.customer].xy;
    const prev = [...mine].reverse().find((j) => j.start + j.dur <= n);
    const next = mine.find((j) => j.start > n);
    if (prev && next) { // driving between jobs
      const k = Math.min(1, (n - prev.start - prev.dur) / Math.max(15, next.start - prev.start - prev.dur));
      const a = custById[prev.customer].xy, b = custById[next.customer].xy;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] as [number, number];
    }
    return prev ? custById[prev.customer].xy : techById[t].home;
  };
  const routes = techs.map((t) => {
    const pts = jobs.filter((j) => j.tech === t.id).sort((a, b) => a.start - b.start).map((j) => custById[j.customer].xy);
    return `<polyline class="tw-route ${selectedTech && selectedTech !== t.id ? 'is-dim' : ''} ${selectedTech === t.id ? 'is-sel' : ''}" data-route="${t.id}" points="${[t.home, ...pts].map((p) => p.join(',')).join(' ')}" />`;
  }).join('');
  svg.innerHTML = `
    <rect width="400" height="300" class="tw-map__land" />
    <path class="tw-map__water" d="M400 0v300H260c10-30-20-50 0-80s60-20 50-60 30-50 20-90 30-40 70-70z" />
    <path class="tw-map__water" d="M0 250c40-10 80 20 120 10s50-30 80-10v50H0z" />
    <g class="tw-map__roads"><path d="M0 120h300M150 0v300M40 300l110-180M150 120l140 140M60 40l90 80" /></g>
    <text x="330" y="40" class="tw-map__label">Linden Bay</text><text x="20" y="290" class="tw-map__label">Whitcomb Cove</text>
    ${routes}
    ${jobs.filter((j) => j.tech || true).map((j) => {
      const [x, y] = custById[j.customer].xy;
      const dim = selectedTech && j.tech !== selectedTech;
      return `<g class="tw-pin is-${j.status} ${j.tech ? '' : 'is-un'} ${dim ? 'is-dim' : ''}" data-pin="${j.id}" data-color="${j.tech ?? ''}" transform="translate(${x} ${y})" role="button" tabindex="${dim ? -1 : 0}" aria-label="${esc(`${j.title} at ${custById[j.customer].address}${j.tech ? `, ${techById[j.tech].name}` : ', unassigned'}`)}"><circle r="9" /><circle r="3.5" class="tw-pin__dot" /></g>`;
    }).join('')}
    ${techs.map((t) => { const [x, y] = pos(t.id); return `<g class="tw-van ${selectedTech && selectedTech !== t.id ? 'is-dim' : ''}" data-color="${t.id}" transform="translate(${x.toFixed(1)} ${(y - 18).toFixed(1)})" aria-hidden="true"><rect x="-13" y="-9" width="26" height="16" rx="5" /><text y="3">${initials(t.name)}</text></g>`; }).join('')}`;
  for (const el of $$<SVGElement>('[data-color]', svg)) if (el.dataset.color) css(el, { '--c': techById[el.dataset.color].color });
  for (const el of $$<SVGElement>('[data-route]', svg)) css(el, { '--c': techById[el.dataset.route!].color });
  $('[data-mapnote]').textContent = selectedTech ? `${techById[selectedTech].name}’s route` : 'All technicians';
  const list = $('[data-techlist]');
  list.innerHTML = techs.map((t) => {
    const cur = jobs.find((j) => j.tech === t.id && j.start <= n && n < j.start + j.dur);
    const next = jobs.filter((j) => j.tech === t.id && j.start > n).sort((a, b) => a.start - b.start)[0];
    const st = cur ? `On site · ${esc(custById[cur.customer].town)}` : next ? `Driving · next ${fmtTime(next.start)}` : 'Available';
    return `<li><button type="button" data-tech="${t.id}" aria-pressed="${selectedTech === t.id}"><span class="tw-av tw-av--sm" data-color="${t.id}">${initials(t.name)}</span><span><b>${esc(t.name.split(' ')[0])}</b><small>${st}</small></span></button></li>`;
  }).join('');
  for (const av of $$<HTMLElement>('[data-color]', list)) css(av, { '--c': techById[av.dataset.color!].color });
}

function renderDispatch() { renderKpis(); renderBoard(); renderMap(); }

/* drag and drop with pointer events (mouse, pen and touch) */
function startDrag() {
  const root = $('[data-view="dispatch"]');
  let drag: { job: Job; el: HTMLElement; ghost: HTMLElement; x0: number; y0: number; dx: number; moved: boolean; marker?: HTMLElement } | null = null;
  root.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.tw-job');
    if (!el || e.button !== 0) return;
    const job = jobs.find((j) => j.id === el.dataset.job)!;
    const r = el.getBoundingClientRect();
    drag = { job, el, ghost: el, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, moved: false };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true;
      const g = drag.el.cloneNode(true) as HTMLElement;
      g.classList.add('tw-ghost');
      g.removeAttribute('data-job');
      css(g, { width: `${Math.max(140, drag.el.offsetWidth)}px` });
      document.body.append(g);
      drag.ghost = g;
      drag.el.classList.add('is-dragging');
      document.documentElement.classList.add('tw-dragging');
    }
    e.preventDefault();
    css(drag.ghost, { transform: `translate(${e.clientX - Math.min(drag.dx, 60)}px, ${e.clientY - 20}px)` });
    const target = document.elementsFromPoint(e.clientX, e.clientY);
    const lane = target.find((t) => (t as HTMLElement).dataset?.lane) as HTMLElement | undefined;
    drag.marker?.remove(); drag.marker = undefined;
    $('[data-tray]').classList.toggle('is-over', target.some((t) => (t as HTMLElement).dataset?.tray !== undefined));
    if (lane) {
      const start = snap(lane, e.clientX - Math.min(drag.dx, 60));
      const m = document.createElement('div');
      m.className = 'tw-drop';
      m.textContent = `${fmtTime(start)}`;
      css(m, { left: `${pct(start)}%`, width: `${(drag.job.dur / SPAN) * 100}%` });
      lane.append(m);
      drag.marker = m;
    }
  }, { passive: false });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) { openJob(d.job.id); return; }
    d.ghost.remove(); d.marker?.remove();
    document.documentElement.classList.remove('tw-dragging');
    $('[data-tray]').classList.remove('is-over');
    const target = document.elementsFromPoint(e.clientX, e.clientY);
    const lane = target.find((t) => (t as HTMLElement).dataset?.lane) as HTMLElement | undefined;
    if (lane) assign(d.job, lane.dataset.lane!, snap(lane, e.clientX - Math.min(d.dx, 60)));
    else if (target.some((t) => (t as HTMLElement).dataset?.tray !== undefined)) assign(d.job, null, d.job.start);
    else renderDispatch();
  });
  addEventListener('pointercancel', () => { if (drag?.moved) { drag.ghost.remove(); drag.marker?.remove(); document.documentElement.classList.remove('tw-dragging'); renderDispatch(); } drag = null; });
}
function snap(lane: HTMLElement, clientX: number) {
  const r = lane.getBoundingClientRect();
  const m = DAY0 + ((clientX - r.left) / r.width) * SPAN;
  return Math.max(DAY0, Math.min(DAY1 - 30, Math.round(m / 15) * 15));
}
function assign(job: Job, tech: string | null, start: number, quiet = false) {
  const was = job.tech;
  job.tech = tech;
  job.start = Math.min(start, DAY1 - job.dur);
  if (!tech) job.status = 'scheduled';
  else if (job.status === 'done' && job.start > now()) job.status = 'scheduled';
  renderDispatch();
  const el = $<HTMLElement>(`[data-job="${job.id}"]`);
  el?.classList.add('is-landed');
  if (!quiet) {
    if (!tech) toast(`${job.title} moved back to Unassigned.`, 'tw-toast');
    else {
      const clash = conflicted(job);
      toast(`${job.title} → ${techById[tech].name}, ${fmtTime(job.start)}.${clash ? ' Heads up: it overlaps another job.' : was !== tech ? ' Customer notice drafted (demo, not sent).' : ''}`, 'tw-toast');
    }
  }
  el?.focus({ preventScroll: true });
}

/* job drawer */
function openJob(id: string) {
  const j = jobs.find((x) => x.id === id)!;
  const c = custById[j.customer];
  const dlg = $<HTMLDialogElement>('[data-drawer]');
  const times = Array.from({ length: (DAY1 - DAY0) / 15 }, (_, i) => DAY0 + i * 15);
  dlg.innerHTML = `<div class="tw-dr">
    <header class="tw-dr__head">
      <p>${TT(j.type)} <span class="tw-id">${j.id}</span></p>
      <h2 id="tw-drawer-title">${esc(j.title)}</h2>
      <button type="button" class="tw-x" data-close aria-label="Close">×</button>
    </header>
    <div class="tw-dr__body">
      <ol class="tw-stepper" aria-label="Job status">
        ${(['scheduled', 'enroute', 'onsite', 'done'] as Status[]).map((s, i, a) => `<li><button type="button" data-status="${s}" aria-pressed="${j.status === s}" class="${a.indexOf(j.status) >= i ? 'is-past' : ''}" ${!j.tech && s !== 'scheduled' ? 'disabled' : ''}><span>${i + 1}</span>${statusLabel[s]}</button></li>`).join('')}
      </ol>
      <section class="tw-card">
        <h3>${esc(c.name)} ${c.plan !== 'none' ? `<span class="tw-badge">${c.plan === 'total' ? 'Total Comfort' : 'Comfort'} member</span>` : ''}</h3>
        <p>${esc(c.address)}, ${esc(c.town)}</p>
        <p class="tw-links"><a href="tel:+1${c.phone.replace(/\D/g, '')}">${esc(c.phone)}</a> · <button type="button" class="tw-link" data-goto-cust="${c.id}">Customer record</button></p>
        ${c.tags.length ? `<p class="tw-tags">${c.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
        <p class="tw-notes">${esc(j.notes)}</p>
      </section>
      <section class="tw-card">
        <h3>Assignment</h3>
        <div class="tw-grid3">
          <label>Technician<select data-f="tech"><option value="">Unassigned</option>${techs.map((t) => `<option value="${t.id}" ${t.id === j.tech ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
          <label>Start<select data-f="start">${times.map((m) => `<option value="${m}" ${m === j.start ? 'selected' : ''}>${fmtTime(m)}</option>`).join('')}</select></label>
          <label>Length<select data-f="dur">${[30, 60, 90, 120, 150, 180, 240, 480].map((m) => `<option value="${m}" ${m === j.dur ? 'selected' : ''}>${m < 60 ? m + ' min' : m / 60 + ' h'}</option>`).join('')}</select></label>
        </div>
        <p class="tw-conflict" data-conflict role="status">${conflicted(j) ? 'This overlaps another job for the same technician.' : ''}</p>
      </section>
      <section class="tw-card">
        <h3>Checklist <small data-chk-count></small></h3>
        <ul class="tw-check">${j.checklist.map((s, i) => `<li><label><input type="checkbox" data-chk="${i}" ${s.done ? 'checked' : ''} /> ${esc(s.label)}</label></li>`).join('')}</ul>
      </section>
      <section class="tw-card tw-card--row">
        <div><p class="tw-muted">Job value</p><b class="tw-big">${j.value ? money(j.value, true) : 'Quote'}</b></div>
        <div><p class="tw-muted">Equipment</p>${c.equipment.length ? `<b>${esc(c.equipment[0].kind)}</b><small> · ${esc(c.equipment[0].brand)}, ${c.equipment[0].year}</small>` : '<b>Not recorded yet</b>'}</div>
      </section>
    </div>
    <footer class="tw-dr__foot">
      <button type="button" class="tw-btn" data-omw>Text “On my way”</button>
      <button type="button" class="tw-btn tw-btn--primary" data-estimate="${c.id}">Start estimate</button>
    </footer></div>`;
  const sync = () => {
    $('[data-chk-count]', dlg).textContent = `${j.checklist.filter((s) => s.done).length}/${j.checklist.length}`;
    $('[data-conflict]', dlg).textContent = conflicted(j) ? 'This overlaps another job for the same technician.' : '';
  };
  sync();
  dlg.onchange = (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t.dataset.chk) { j.checklist[Number(t.dataset.chk)].done = (t as HTMLInputElement).checked; sync(); return; }
    if (t.dataset.f === 'tech') { assign(j, t.value || null, j.start, true); openJob(j.id); $<HTMLElement>('[data-f="tech"]', dlg).focus(); return; }
    if (t.dataset.f === 'start') j.start = Number(t.value);
    if (t.dataset.f === 'dur') j.dur = Number(t.value);
    renderDispatch(); sync();
  };
  dlg.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (e.target === dlg || t.closest('[data-close]')) return dlg.close();
    const s = t.closest<HTMLElement>('[data-status]');
    if (s) {
      j.status = s.dataset.status as Status;
      if (j.status === 'done') j.checklist.forEach((c) => (c.done = true));
      renderDispatch(); openJob(j.id); $<HTMLElement>(`[data-status="${j.status}"]`, dlg).focus();
      if (j.status === 'done') toast(`${j.id} complete. Invoice ${money(j.value, true)} ready to send (demo).`, 'tw-toast');
      return;
    }
    if (t.closest('[data-omw]')) toast(`Demo, not sent: “Hi ${c.name.split(' ')[0]}, ${j.tech ? techById[j.tech].name.split(' ')[0] : 'your technician'} from Tidewater is on the way. ETA about 20 minutes.”`, 'tw-toast');
    const est = t.closest<HTMLElement>('[data-estimate]');
    if (est) { estimate.customer = est.dataset.estimate!; dlg.close(); go('estimates'); }
    const gc = t.closest<HTMLElement>('[data-goto-cust]');
    if (gc) { custState.open = gc.dataset.gotoCust!; dlg.close(); go('customers'); }
  };
  if (!dlg.open) openDialog(dlg);
}

function startDispatch() {
  startDrag();
  const view = $('[data-view="dispatch"]');
  view.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tech]');
    if (t) { selectedTech = selectedTech === t.dataset.tech ? null : t.dataset.tech!; renderBoard(); renderMap(); $<HTMLElement>(`${t.closest('.tw-techlist') ? '.tw-techlist ' : '.tw-row '}[data-tech="${t.dataset.tech}"]`).focus(); }
    const pin = (e.target as Element).closest<SVGElement>('[data-pin]');
    if (pin) openJob(pin.dataset.pin!);
  });
  view.addEventListener('keydown', (e) => {
    const job = (e.target as HTMLElement).closest<HTMLElement>('.tw-job');
    if (job && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openJob(job.dataset.job!); }
    const pin = (e.target as Element).closest<SVGElement>('[data-pin]');
    if (pin && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openJob(pin.dataset.pin!); }
  });
  addEventListener('resize', placeNow);
  setInterval(() => { if (!$('[data-view="dispatch"]').hidden) { placeNow(); renderMap(); } $('[data-clock]').textContent = `Sample day · ${fmtTime(now())}`; }, 20000);
  $('[data-clock]').textContent = `Sample day · ${fmtTime(now())}`;
}

/* ================= estimates ================= */
type Tier = 'good' | 'better' | 'best';
interface Line { id: string; name: string; qty: number; price: number }
const tierInfo: Record<Tier, { label: string; pitch: string }> = {
  good: { label: 'Repair', pitch: 'Get the existing boiler running safely this week.' },
  better: { label: 'Replace', pitch: 'A high-efficiency combi boiler with on-demand hot water.' },
  best: { label: 'Upgrade', pitch: 'Cold-climate heat pumps for heating and cooling, with the boiler as backup.' },
};
const line = (id: string, qty = 1): Line => { const p = pricebook.find((x) => x.id === id)!; return { id, name: p.name, qty, price: p.price }; };
const estimate = {
  no: 'EST-2291', customer: customers[6].id, title: 'Heating system options', tier: 'better' as Tier, discount: 'none', status: 'draft' as 'draft' | 'sent' | 'approved', chosen: '' as Tier | '', signed: false,
  tiers: {
    good: [line('diag'), line('ign'), line('flame'), line('labor', 2)],
    better: [line('boil'), line('permit'), line('haul'), line('tstat')],
    best: [line('hp-hi'), line('permit'), line('tstat'), line('plan')],
  } as Record<Tier, Line[]>,
};
const discounts: Record<string, { label: string; calc: (s: number) => number }> = {
  none: { label: 'No discount', calc: () => 0 },
  member: { label: 'Member, 15% off', calc: (s) => s * 0.15 },
  season: { label: 'Fall install, $500 off over $5k', calc: (s) => (s >= 5000 ? 500 : 0) },
};
function tierTotal(t: Tier) {
  const sub = estimate.tiers[t].reduce((s, l) => s + l.qty * l.price, 0);
  const disc = discounts[estimate.discount].calc(sub);
  const tax = (sub - disc) * TAX;
  return { sub, disc, tax, total: sub - disc + tax };
}

let pbQuery = '';
function renderEstimate() {
  const host = $('[data-est]');
  const c = custById[estimate.customer];
  const t = estimate.tier;
  const tt = tierTotal(t);
  const results = pricebook.filter((p) => !pbQuery || `${p.name} ${p.cat}`.toLowerCase().includes(pbQuery.toLowerCase()));
  const locked = estimate.status === 'approved';
  host.innerHTML = `
  <div class="tw-est__build">
    <div class="tw-card">
      <div class="tw-grid2">
        <label>Customer<select data-e="customer" ${locked ? 'disabled' : ''}>${customers.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.town)}</option>`).join('')}</select></label>
        <label>Estimate title<input data-e="title" value="${esc(estimate.title)}" ${locked ? 'disabled' : ''} /></label>
      </div>
    </div>
    <div class="tw-card">
      <div class="tw-tiers" role="tablist" aria-label="Options">
        ${(['good', 'better', 'best'] as Tier[]).map((k) => `<button type="button" role="tab" id="tw-tab-${k}" aria-selected="${k === t}" aria-controls="tw-tierpanel" tabindex="${k === t ? 0 : -1}" data-tier="${k}"><small>${k}</small><b>${tierInfo[k].label}</b><span>${money(tierTotal(k).total, true)}</span></button>`).join('')}
      </div>
      <div id="tw-tierpanel" role="tabpanel" aria-labelledby="tw-tab-${t}">
        <table class="tw-lines">
          <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Price</th><th scope="col">Total</th><th scope="col"><span class="tw-vh">Remove</span></th></tr></thead>
          <tbody>${estimate.tiers[t].map((l, i) => `<tr>
            <td>${esc(l.name)}</td>
            <td><input type="number" min="1" max="99" value="${l.qty}" data-qty="${i}" aria-label="Quantity, ${esc(l.name)}" ${locked ? 'disabled' : ''} /></td>
            <td><input type="number" min="0" step="1" value="${l.price}" data-price="${i}" aria-label="Price, ${esc(l.name)}" ${locked ? 'disabled' : ''} /></td>
            <td class="tw-num">${money(l.qty * l.price)}</td>
            <td><button type="button" class="tw-iconbtn" data-rm="${i}" aria-label="Remove ${esc(l.name)}" ${locked ? 'disabled' : ''}>×</button></td></tr>`).join('') || `<tr><td colspan="5" class="tw-muted">No items yet. Add from the price book.</td></tr>`}</tbody>
        </table>
        <div class="tw-totals">
          <label>Discount<select data-e="discount" ${locked ? 'disabled' : ''}>${Object.entries(discounts).map(([k, d]) => `<option value="${k}" ${k === estimate.discount ? 'selected' : ''}>${d.label}</option>`).join('')}</select></label>
          <dl>
            <div><dt>Subtotal</dt><dd>${money(tt.sub)}</dd></div>
            ${tt.disc ? `<div><dt>Discount</dt><dd>−${money(tt.disc)}</dd></div>` : ''}
            <div><dt>Sample tax (5.5%)</dt><dd>${money(tt.tax)}</dd></div>
            <div class="is-total"><dt>${tierInfo[t].label} total</dt><dd>${money(tt.total)}</dd></div>
          </dl>
        </div>
      </div>
    </div>
    <div class="tw-card">
      <div class="tw-pbhead"><h2>Price book</h2><label class="tw-search"><span class="tw-vh">Search the price book</span><input type="search" placeholder="Search parts, labor, systems" value="${esc(pbQuery)}" data-pbq /></label></div>
      <ul class="tw-pb">${results.map((p) => `<li><span><b>${esc(p.name)}</b><small>${esc(p.cat)}</small></span><span class="tw-num">${money(p.price, true)}${p.unit ? '/' + p.unit : ''}</span><button type="button" class="tw-btn tw-btn--sm" data-add="${p.id}" ${locked ? 'disabled' : ''} aria-label="Add ${esc(p.name)} to ${tierInfo[t].label}">Add</button></li>`).join('') || '<li class="tw-muted">Nothing matches.</li>'}</ul>
    </div>
  </div>
  <div class="tw-est__doc">
    <div class="tw-doc" data-doc>
      <header class="tw-doc__head"><div class="tw-brand tw-brand--doc"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 20c4 0 4-3 8-3s4 3 8 3 4-3 8-3" /><path d="M3 26c4 0 4-3 8-3s4 3 8 3 4-3 8-3" /><path d="M16 4l6 9H10z" /></svg><div><b>Tidewater</b><small>Mechanical</small></div></div>
        <div class="tw-doc__no"><b>${estimate.no}</b><span class="tw-st tw-st--${estimate.status}">${estimate.status === 'draft' ? 'Draft' : estimate.status === 'sent' ? 'Sent' : 'Approved'}</span></div></header>
      <p class="tw-doc__to">Prepared for <b>${esc(c.name)}</b><br />${esc(c.address)}, ${esc(c.town)}</p>
      <h2 class="tw-doc__title">${esc(estimate.title)}</h2>
      <div class="tw-opts">${(['good', 'better', 'best'] as Tier[]).map((k) => { const x = tierTotal(k); return `
        <div class="tw-opt ${estimate.chosen === k ? 'is-chosen' : ''} ${k === 'better' ? 'is-rec' : ''}">
          ${k === 'better' ? '<p class="tw-opt__rec">Recommended</p>' : ''}
          <h3>${tierInfo[k].label}</h3><p>${tierInfo[k].pitch}</p>
          <ul>${estimate.tiers[k].map((l) => `<li>${l.qty > 1 ? l.qty + ' × ' : ''}${esc(l.name)}</li>`).join('')}</ul>
          <p class="tw-opt__price">${money(x.total, true)}</p>
          <button type="button" class="tw-btn ${estimate.chosen === k ? 'tw-btn--primary' : ''} tw-btn--block" data-choose="${k}" ${estimate.status !== 'sent' ? 'disabled' : ''} aria-pressed="${estimate.chosen === k}">${estimate.chosen === k ? 'Selected' : 'Choose'}</button>
        </div>`; }).join('')}</div>
      ${estimate.status === 'sent' ? `<div class="tw-sign"><p><b>Customer signature</b> <span class="tw-muted">Sign with a mouse or finger</span></p><canvas data-sig width="600" height="140" aria-label="Signature pad"></canvas><div class="tw-sign__row"><button type="button" class="tw-link" data-clear-sig>Clear</button><button type="button" class="tw-btn tw-btn--primary" data-approve>Approve ${estimate.chosen ? tierInfo[estimate.chosen].label : 'option'}</button></div><p class="tw-conflict" data-sig-err role="status"></p></div>` : ''}
      ${estimate.status === 'approved' ? `<div class="tw-stamp"><b>Approved</b><span>${tierInfo[estimate.chosen as Tier].label} · ${money(tierTotal(estimate.chosen as Tier).total)}</span><span>Signed by ${esc(c.name)}, ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>` : ''}
      <p class="tw-doc__fine">Sample pricing for a fictional company. Valid for 30 days. Prices include parts and labor unless noted. If we find a hidden problem once work starts, we explain it and ask before doing anything extra.</p>
    </div>
    <div class="tw-doc__actions">
      ${estimate.status === 'draft' ? `<button type="button" class="tw-btn tw-btn--primary" data-send>Send to customer</button>` : ''}
      ${estimate.status === 'sent' ? `<p class="tw-muted">Customer view: pick an option, sign and approve, as the customer would on their phone.</p>` : ''}
      ${estimate.status === 'approved' ? `<button type="button" class="tw-btn tw-btn--primary" data-schedule>Schedule the work</button>` : ''}
      <button type="button" class="tw-btn" data-reset>${estimate.status === 'draft' ? 'Reset' : 'Start over'}</button>
    </div>
  </div>`;
  if (estimate.status === 'sent') startSignature();
}
function startSignature() {
  const cv = $<HTMLCanvasElement>('[data-sig]');
  const ctx = cv.getContext('2d')!;
  ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.strokeStyle = '#0d1b24';
  let down = false;
  const p = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
  cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); const [x, y] = p(e); ctx.beginPath(); ctx.moveTo(x, y); });
  cv.addEventListener('pointermove', (e) => { if (!down) return; const [x, y] = p(e); ctx.lineTo(x, y); ctx.stroke(); estimate.signed = true; });
  cv.addEventListener('pointerup', () => { down = false; });
}
function startEstimates() {
  const host = $('[data-est]');
  host.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const ls = estimate.tiers[estimate.tier];
    if (t.dataset.qty) { ls[Number(t.dataset.qty)].qty = Math.max(1, Number(t.value) || 1); refreshKeep(t); }
    if (t.dataset.price) { ls[Number(t.dataset.price)].price = Math.max(0, Number(t.value) || 0); refreshKeep(t); }
    if (t.dataset.e === 'title') { estimate.title = t.value; $('.tw-doc__title').textContent = t.value; }
    if (t.matches('[data-pbq]')) { pbQuery = t.value; refreshKeep(t); }
  });
  host.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.dataset.e === 'customer') { estimate.customer = t.value; refreshKeep(t); }
    if (t.dataset.e === 'discount') { estimate.discount = t.value; refreshKeep(t); }
  });
  host.addEventListener('keydown', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tier]');
    if (!tab || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const order: Tier[] = ['good', 'better', 'best'];
    estimate.tier = order[(order.indexOf(estimate.tier) + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
    renderEstimate(); $<HTMLElement>(`[data-tier="${estimate.tier}"]`).focus();
  });
  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tier = t.closest<HTMLElement>('[data-tier]');
    if (tier) { estimate.tier = tier.dataset.tier as Tier; renderEstimate(); $<HTMLElement>(`[data-tier="${estimate.tier}"]`).focus(); }
    const add = t.closest<HTMLElement>('[data-add]');
    if (add) {
      const ls = estimate.tiers[estimate.tier];
      const ex = ls.find((l) => l.id === add.dataset.add);
      if (ex) ex.qty++; else ls.push(line(add.dataset.add!));
      renderEstimate(); $<HTMLElement>(`[data-add="${add.dataset.add}"]`).focus();
      toast(`Added to ${tierInfo[estimate.tier].label}. Total ${money(tierTotal(estimate.tier).total, true)}.`, 'tw-toast');
    }
    const rm = t.closest<HTMLElement>('[data-rm]');
    if (rm) { estimate.tiers[estimate.tier].splice(Number(rm.dataset.rm), 1); renderEstimate(); $<HTMLElement>(`[data-tier="${estimate.tier}"]`).focus(); }
    if (t.closest('[data-send]')) {
      estimate.status = 'sent'; renderEstimate();
      toast(`Demo, not sent: estimate link texted to ${custById[estimate.customer].phone}. The preview now shows the customer’s view.`, 'tw-toast');
      $<HTMLElement>('[data-choose="better"]').focus();
    }
    const ch = t.closest<HTMLElement>('[data-choose]');
    if (ch) { estimate.chosen = ch.dataset.choose as Tier; const sig = estimate.signed; renderEstimate(); estimate.signed = false; if (sig) toast('Pick changed, so please sign again.', 'tw-toast'); $<HTMLElement>(`[data-choose="${estimate.chosen}"]`).focus(); }
    if (t.closest('[data-clear-sig]')) { const cv = $<HTMLCanvasElement>('[data-sig]'); cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height); estimate.signed = false; }
    if (t.closest('[data-approve]')) {
      const err = $('[data-sig-err]');
      if (!estimate.chosen) { err.textContent = 'Choose an option first.'; return; }
      if (!estimate.signed) { err.textContent = 'Please sign in the box.'; return; }
      estimate.status = 'approved'; renderEstimate();
      toast(`Approved: ${tierInfo[estimate.chosen].label}, ${money(tierTotal(estimate.chosen).total, true)}. Deposit request drafted (demo).`, 'tw-toast');
      $<HTMLElement>('[data-schedule]').focus();
    }
    if (t.closest('[data-schedule]')) {
      const c = custById[estimate.customer];
      const j: Job = { id: `J-${nextJob++}`, customer: c.id, type: 'install', title: `${tierInfo[estimate.chosen as Tier].label}: ${estimate.title}`, tech: null, start: 8 * 60, dur: 480, value: Math.round(tierTotal(estimate.chosen as Tier).total), status: 'scheduled', notes: `From ${estimate.no}, approved by the customer.`, checklist: ['Protect floors', 'Remove old unit', 'Set and connect', 'Commission', 'Clean up and handover'].map((label) => ({ label, done: false })) };
      jobs.push(j); go('dispatch'); toast('Install added to Unassigned. Drag it onto a technician.', 'tw-toast');
    }
    if (t.closest('[data-reset]')) { estimate.status = 'draft'; estimate.chosen = ''; estimate.signed = false; renderEstimate(); }
  });
}
/** Re-render but keep focus and caret in the control being edited. */
function refreshKeep(el: HTMLInputElement | HTMLSelectElement) {
  const sel = el.dataset.qty ? `[data-qty="${el.dataset.qty}"]` : el.dataset.price ? `[data-price="${el.dataset.price}"]` : el.dataset.e ? `[data-e="${el.dataset.e}"]` : '[data-pbq]';
  const pos = 'selectionStart' in el && el.type !== 'number' ? el.selectionStart : null;
  renderEstimate();
  const n = $<HTMLInputElement>(sel);
  n?.focus();
  if (n && pos !== null && n.type !== 'number') n.setSelectionRange(pos, pos);
}

/* ================= customers ================= */
const custState = { q: '', filter: 'all', sort: 'name', dir: 1, open: '' as string };
const age = (y: number) => new Date().getFullYear() - y;
function renderCustomers() {
  const host = $('[data-cust]');
  const q = custState.q.toLowerCase();
  let list = customers.filter((c) => (!q || `${c.name} ${c.address} ${c.town} ${c.phone} ${c.id}`.toLowerCase().includes(q))
    && (custState.filter === 'all' || (custState.filter === 'members' && c.plan !== 'none') || (custState.filter === 'balance' && c.balance > 0) || (custState.filter === 'old' && c.equipment.some((e) => age(e.year) >= 15))));
  const key = custState.sort as keyof Customer;
  list = [...list].sort((a, b) => (key === 'equipment' ? Math.max(...a.equipment.map((e) => age(e.year))) - Math.max(...b.equipment.map((e) => age(e.year))) : a[key]! > b[key]! ? 1 : a[key]! < b[key]! ? -1 : 0) * custState.dir);
  const cols: [string, string][] = [['name', 'Customer'], ['town', 'Town'], ['plan', 'Plan'], ['equipment', 'Oldest system'], ['lifetime', 'Lifetime'], ['balance', 'Balance']];
  const open = custState.open ? custById[custState.open] : null;
  host.innerHTML = `
    <div class="tw-ctools">
      <label class="tw-search"><span class="tw-vh">Search customers</span><input type="search" placeholder="Search name, street, phone" value="${esc(custState.q)}" data-cq /></label>
      <div class="tw-chips" role="group" aria-label="Filter">${[['all', 'All'], ['members', 'Members'], ['balance', 'Balance due'], ['old', 'Systems 15+ years']].map(([k, l]) => `<button type="button" data-cf="${k}" aria-pressed="${custState.filter === k}">${l}</button>`).join('')}</div>
      <p class="tw-muted" role="status">${list.length} of ${customers.length}</p>
    </div>
    <div class="tw-cgrid ${open ? 'has-open' : ''}">
      <div class="tw-tablewrap" tabindex="0" role="region" aria-label="Customer table">
        <table class="tw-table">
          <thead><tr>${cols.map(([k, l]) => `<th scope="col" aria-sort="${custState.sort === k ? (custState.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${k}">${l}<span aria-hidden="true">${custState.sort === k ? (custState.dir > 0 ? '↑' : '↓') : ''}</span></button></th>`).join('')}</tr></thead>
          <tbody>${list.map((c) => { const old = c.equipment.length ? Math.max(...c.equipment.map((e) => age(e.year))) : -1; return `<tr class="${custState.open === c.id ? 'is-open' : ''}">
            <th scope="row"><button type="button" class="tw-cname" data-cust-open="${c.id}"><span class="tw-av tw-av--sm tw-av--plain">${initials(c.name)}</span><span><b>${esc(c.name)}</b><small>${esc(c.address)}</small></span></button></th>
            <td>${esc(c.town)}</td>
            <td>${c.plan === 'none' ? '<span class="tw-muted">None</span>' : `<span class="tw-badge">${c.plan === 'total' ? 'Total' : 'Comfort'}</span>`}</td>
            <td>${old < 0 ? '<span class="tw-muted">Not recorded</span>' : `<span class="tw-age ${old >= 15 ? 'is-old' : ''}">${old} yrs</span>`}</td>
            <td class="tw-num">${money(c.lifetime, true)}</td>
            <td class="tw-num">${c.balance ? `<span class="tw-due">${money(c.balance, true)}</span>` : '<span class="tw-muted">—</span>'}</td></tr>`; }).join('')}</tbody>
        </table>
      </div>
      <p class="tw-muted tw-scrollhint">Scroll the table sideways for plan, system age, lifetime value and balance.</p>
      ${open ? custPanel(open) : ''}
    </div>`;
  for (const el of $$<HTMLElement>('[data-life]', host)) css(el, { width: `${el.dataset.life}%` });
}
function custPanel(c: Customer) {
  const upcoming = jobs.filter((j) => j.customer === c.id);
  return `<aside class="tw-cpanel" aria-labelledby="tw-cp-h" tabindex="-1">
    <header><span class="tw-av tw-av--plain">${initials(c.name)}</span><div><h2 id="tw-cp-h">${esc(c.name)}</h2><p>${c.id} · customer since ${c.since}</p></div><button type="button" class="tw-x" data-cust-close aria-label="Close customer">×</button></header>
    <dl class="tw-facts"><div><dt>Address</dt><dd>${esc(c.address)}, ${esc(c.town)}</dd></div><div><dt>Phone</dt><dd><a href="tel:+1${c.phone.replace(/\D/g, '')}">${esc(c.phone)}</a></dd></div><div><dt>Email</dt><dd>${esc(c.email)}</dd></div><div><dt>Plan</dt><dd>${c.plan === 'none' ? 'No plan · <span class="tw-muted">offer Total Comfort</span>' : c.plan === 'total' ? 'Total Comfort' : 'Comfort'}</dd></div></dl>
    ${c.balance ? `<p class="tw-alert">Open balance ${money(c.balance)} · invoice overdue</p>` : ''}
    <h3>Equipment</h3>
    ${c.equipment.length ? '' : '<p class="tw-muted">No equipment recorded yet.</p>'}<ul class="tw-eq">${c.equipment.map((e) => { const a = age(e.year); return `<li><div><b>${esc(e.kind)}</b><small>${esc(e.brand)} · installed ${e.year} · serviced ${e.lastService}</small></div><div class="tw-life" role="img" aria-label="${a} of about 20 years of service life"><span data-life="${Math.min(100, (a / 20) * 100)}" class="${a >= 15 ? 'is-old' : ''}"></span></div></li>`; }).join('')}</ul>
    ${upcoming.length ? `<h3>Today</h3><ul class="tw-hist">${upcoming.map((j) => `<li><span>${esc(j.title)}</span><span>${j.tech ? fmtTime(j.start) : 'Unassigned'}</span></li>`).join('')}</ul>` : ''}
    <h3>History</h3>
    ${c.history.length ? '' : '<p class="tw-muted">No visits yet.</p>'}<ul class="tw-hist">${c.history.map((h) => `<li><span>${esc(h.what)}<small>${h.date} · ${esc(h.tech)}</small></span><span class="tw-num">${money(h.amount, true)}</span></li>`).join('')}</ul>
    <div class="tw-cpanel__actions"><button type="button" class="tw-btn" data-cust-visit="${c.id}">Book a visit</button><button type="button" class="tw-btn tw-btn--primary" data-estimate-for="${c.id}">Start estimate</button></div>
  </aside>`;
}
function startCustomers() {
  const host = $('[data-cust]');
  const after = () => {};
  host.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (t.matches('[data-cq]')) { custState.q = t.value; renderCustomers(); after(); const n = $<HTMLInputElement>('[data-cq]'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });
  host.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLElement>('[data-cf]');
    if (f) { custState.filter = f.dataset.cf!; renderCustomers(); after(); $<HTMLElement>(`[data-cf="${custState.filter}"]`).focus(); }
    const s = t.closest<HTMLElement>('[data-sort]');
    if (s) { custState.dir = custState.sort === s.dataset.sort ? -custState.dir : 1; custState.sort = s.dataset.sort!; renderCustomers(); after(); $<HTMLElement>(`[data-sort="${custState.sort}"]`).focus(); }
    const o = t.closest<HTMLElement>('[data-cust-open]');
    if (o) { custState.open = o.dataset.custOpen!; renderCustomers(); after(); $<HTMLElement>('.tw-cpanel').focus(); $<HTMLElement>('.tw-cpanel').scrollIntoView({ block: 'nearest' }); }
    if (t.closest('[data-cust-close]')) { const id = custState.open; custState.open = ''; renderCustomers(); after(); $<HTMLElement>(`[data-cust-open="${id}"]`)?.focus(); }
    const v = t.closest<HTMLElement>('[data-cust-visit]');
    if (v) {
      const c = custById[v.dataset.custVisit!];
      jobs.push({ id: `J-${nextJob++}`, customer: c.id, type: 'maint', title: 'Heating tune-up', tech: null, start: 13 * 60, dur: 60, value: 189, status: 'scheduled', notes: 'Booked from the customer record.', checklist: ['Check filters', 'Test safeties', 'Clean burners / coils', 'Record readings', 'Customer walkthrough'].map((label) => ({ label, done: false })) });
      go('dispatch'); toast(`Tune-up for ${c.name} added to Unassigned.`, 'tw-toast');
    }
    const est = t.closest<HTMLElement>('[data-estimate-for]');
    if (est) { estimate.customer = est.dataset.estimateFor!; estimate.status = 'draft'; estimate.chosen = ''; go('estimates'); }
  });
}

/* ================= reports ================= */
// Every figure below is a sum over one sample ledger (reports.ts).
let range: Range = 90;
/** The revenue chart's drawing width: its card's width, at most 640. */
const chartWidth = () => Math.round(Math.min(640, Math.max(280, $('[data-rep]').clientWidth - 40)));
function renderReports() {
  const host = $('[data-rep]');
  const rep = report(range);
  const { revenue: total, jobs: jobsN } = rep.totals;
  const s = { unit: rep.unit, labels: rep.buckets.map((b) => b.label), vals: rep.buckets.map((b) => b.revenue) };
  const mix = rep.mix.map(({ type, n }) => ({ t: type, n }));
  const leaders = rep.techs.map((l) => ({ t: techById[l.id], rev: l.revenue, jobs: l.jobs, cb: l.jobs ? ((l.callbacks / l.jobs) * 100).toFixed(1) : '0.0' }));
  const maxRev = leaders[0].rev || 1;
  const W = chartWidth(), H = 240, P = { l: 52, r: 8, t: 12, b: 28 };
  // Four even gridlines on a round step ($5k, $10k, $25k …).
  const tick = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * 10 ** Math.floor(Math.log10(Math.max(...s.vals, 4) / 4))).find((t) => t * 4 >= Math.max(...s.vals))!;
  const max = tick * 4;
  const bw = (W - P.l - P.r) / s.vals.length;
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => max * k);
  const step = Math.ceil(s.labels.length / Math.max(3, Math.floor((W - P.l) / 64)));
  let a0 = -Math.PI / 2;
  const sumMix = jobsN;
  const arcs = mix.filter((m) => m.n).map((m) => {
    const a1 = a0 + (m.n / sumMix) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const R = 70, rI = 46, g = 0.012;
    const p = (a: number, rr: number) => `${(rr * Math.cos(a)).toFixed(2)} ${(rr * Math.sin(a)).toFixed(2)}`;
    const d = `M${p(a0 + g, R)} A${R} ${R} 0 ${large} 1 ${p(a1 - g, R)} L${p(a1 - g, rI)} A${rI} ${rI} 0 ${large} 0 ${p(a0 + g, rI)} Z`;
    a0 = a1;
    return `<path d="${d}" class="tw-arc tw-fill--${m.t}" tabindex="0" data-tip="${esc(`${typeInfo[m.t].label}: ${m.n} jobs (${Math.round((m.n / sumMix) * 100)}%)`)}" />`;
  }).join('');
  const change = (now: number, before: number) => (before ? now / before - 1 : 0);
  const rate = (t: { estimates: number; won: number }) => (t.estimates ? t.won / t.estimates : 0);
  const { prev } = rep;
  const kpis: [string, string, number | string][] = [
    ['Revenue', money(total, true), change(total, prev.revenue)],
    ['Jobs completed', String(jobsN), change(jobsN, prev.jobs)],
    ['Average ticket', money(jobsN ? total / jobsN : 0, true), change(jobsN ? total / jobsN : 0, prev.jobs ? prev.revenue / prev.jobs : 0)],
    ['Estimate close rate', `${Math.round(rate(rep.totals) * 100)}%`, rate(rep.totals) - rate(prev)],
    ['Members', String(customers.filter((c) => c.plan !== 'none').length * 9), 'Current count'],
  ];
  const cbAll = rep.techs.reduce((q, l) => q + l.callbacks, 0);
  host.innerHTML = `
    <div class="tw-rtools"><div class="tw-chips" role="group" aria-label="Date range">${ranges.map(([k, l]) => `<button type="button" data-range="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}</div><p class="tw-muted">Sample data · ${[rep.from, rep.to].map((d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: rep.unit === 'month' ? 'numeric' : undefined })).join('–')} · compared with the previous period</p></div>
    <div class="tw-kpis tw-kpis--5">${kpis.map(([k, v, d]) => `<div class="tw-kpi"><p>${k}</p><b>${v}</b>${typeof d === 'string' ? `<small>${d}</small>` : `<small class="${d >= 0 ? 'is-up' : 'is-down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1)}${k === 'Estimate close rate' ? ' pts' : '%'}</small>`}</div>`).join('')}</div>
    <p class="tw-muted tw-rnote">Every figure counts the same completed jobs. Average ticket is revenue ÷ jobs completed. Estimate visits are free, so they count as jobs with $0 revenue.</p>
    <div class="tw-rgrid">
      <figure class="tw-card tw-chart">
        <figcaption><h2>Revenue by ${s.unit}</h2><p class="tw-muted">${money(total, true)} total</p></figcaption>
        <div class="tw-chart__plot">
          <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of revenue by ${s.unit}. Highest ${money(Math.max(...s.vals), true)}.">
            ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" class="tw-grid" /><text x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end" class="tw-axis">${t >= 1000 ? '$' + +(t / 1000).toFixed(1) + 'k' : '$' + t}</text>`).join('')}
            ${s.vals.map((v, i) => { const x = P.l + i * bw + 1; const w = Math.max(2, bw - 2); const top = y(v); const hgt = H - P.b - top; return `<g class="tw-barg" tabindex="0" data-tip="${esc(`${rep.buckets[i].span}: ${money(v, true)} · ${rep.buckets[i].jobs} jobs`)}"><rect class="tw-hit" x="${x - 1}" y="${P.t}" width="${bw}" height="${H - P.t - P.b}" /><path class="tw-bar" d="M${x} ${H - P.b}V${top + 4}q0 -4 4 -4h${Math.max(0, w - 8)}q4 0 4 4V${H - P.b}z" /></g>${i % step === 0 ? `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle" class="tw-axis">${s.labels[i]}</text>` : ''}`; }).join('')}
          </svg>
          <p class="tw-tip" data-tip-out hidden></p>
        </div>
        <details class="tw-tableview"><summary>Show as table</summary><table class="tw-table tw-table--sm"><thead><tr><th scope="col">${s.unit[0].toUpperCase() + s.unit.slice(1)}</th><th scope="col">Revenue</th><th scope="col">Jobs</th></tr></thead><tbody>${rep.buckets.map((b) => `<tr><td>${esc(b.span)}</td><td class="tw-num">${money(b.revenue, true)}</td><td class="tw-num">${b.jobs}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th><td class="tw-num">${money(total, true)}</td><td class="tw-num">${jobsN}</td></tr></tfoot></table></details>
      </figure>
      <figure class="tw-card tw-chart">
        <figcaption><h2>Job mix</h2><p class="tw-muted">${sumMix} completed jobs by type</p></figcaption>
        <div class="tw-donut"><div class="tw-chart__plot"><svg viewBox="-80 -80 160 160" role="img" aria-label="Donut chart of jobs by type">${arcs}<text y="-2" text-anchor="middle" class="tw-donut__n">${sumMix}</text><text y="14" text-anchor="middle" class="tw-axis">jobs</text></svg><p class="tw-tip" data-tip-out hidden></p></div>
          <ul class="tw-legend">${mix.map((m) => `<li><i class="tw-fill--${m.t}"></i>${typeInfo[m.t].label}<b>${m.n}</b></li>`).join('')}</ul></div>
      </figure>
      <div class="tw-card tw-lead">
        <h2>Technicians</h2>
        <table class="tw-table tw-ltable"><thead><tr><th scope="col">Technician</th><th scope="col">Revenue</th><th scope="col" class="tw-num">Jobs</th><th scope="col" class="tw-hide-s">Callbacks</th></tr></thead>
        <tbody>${leaders.map((l) => `<tr><th scope="row"><span class="tw-lname"><span class="tw-av tw-av--sm" data-color="${l.t.id}">${initials(l.t.name)}</span>${esc(l.t.name)}</span></th><td><div class="tw-lbar"><i><span data-w="${(l.rev / maxRev) * 100}"></span></i><b>${money(l.rev, true)}</b></div></td><td class="tw-num">${l.jobs}</td><td class="tw-num tw-hide-s">${l.cb}%</td></tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row">All technicians</th><td><div class="tw-lbar"><i></i><b>${money(total, true)}</b></div></td><td class="tw-num">${jobsN}</td><td class="tw-num tw-hide-s">${jobsN ? ((cbAll / jobsN) * 100).toFixed(1) : '0.0'}%</td></tr></tfoot></table>
      </div>
    </div>`;
  for (const el of $$<HTMLElement>('[data-w]', host)) css(el, { width: `${el.dataset.w}%` });
  for (const av of $$<HTMLElement>('[data-color]', host)) css(av, { '--c': techById[av.dataset.color!].color });
}
function startReports() {
  const host = $('[data-rep]');
  host.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-range]'); if (b) { range = Number(b.dataset.range) as Range; renderReports(); $<HTMLElement>(`[data-range="${range}"]`).focus(); } });
  const show = (e: Event) => {
    const g = (e.target as Element).closest<SVGElement>('[data-tip]');
    const plot = (e.target as Element).closest<HTMLElement>('.tw-chart__plot');
    if (!g || !plot) return;
    const out = $<HTMLElement>('[data-tip-out]', plot);
    out.textContent = g.dataset.tip!;
    out.hidden = false;
    const pr = plot.getBoundingClientRect(), gr = g.getBoundingClientRect();
    css(out, { left: `${Math.max(0, Math.min(pr.width - 150, gr.left - pr.left + gr.width / 2 - 75))}px`, top: `${Math.max(0, gr.top - pr.top - 40)}px` });
    $$('.is-hot', host).forEach((x) => x.classList.remove('is-hot'));
    g.classList.add('is-hot');
  };
  const hide = () => { $$<HTMLElement>('[data-tip-out]', host).forEach((t) => (t.hidden = true)); $$('.is-hot', host).forEach((x) => x.classList.remove('is-hot')); };
  let drawnAt = 0;
  addEventListener('resize', () => {
    if (host.closest<HTMLElement>('[data-view]')?.hidden) return;
    clearTimeout(drawnAt);
    drawnAt = window.setTimeout(() => { if ($('.tw-chart svg', host)?.getAttribute('viewBox') !== `0 0 ${chartWidth()} 240`) renderReports(); }, 200);
  });
  host.addEventListener('pointerover', show);
  host.addEventListener('focusin', show);
  host.addEventListener('pointerleave', hide);
  host.addEventListener('focusout', hide);
}

/* ================= service requests ================= */
// The customer-facing request form (as on Tidewater's website). A valid
// request becomes a new customer and an unassigned job, in this tab only.
const services: Record<string, { label: string; type: JobType; title: string }> = {
  noheat: { label: 'No heat', type: 'emergency', title: 'No heat' },
  heating: { label: 'Heating problem', type: 'repair', title: 'Heating problem' },
  cooling: { label: 'Cooling or heat pump', type: 'repair', title: 'Cooling or heat pump problem' },
  water: { label: 'Water heater', type: 'repair', title: 'Water heater problem' },
  leak: { label: 'Leak or drain', type: 'repair', title: 'Leak or drain' },
  maint: { label: 'Maintenance visit', type: 'maint', title: 'Maintenance visit' },
  quote: { label: 'Quote for a new system', type: 'estimate', title: 'New system quote' },
};
const validPhone = (v: string) => /^1?\d{10}$/.test(v.replace(/\D/g, ''));
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
let nextCust = 2000;

function startRequests() {
  const form = $<HTMLFormElement>('[data-reqform]');
  const body = $('[data-req-body]', form);
  const blank = body.innerHTML;
  const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
  const notes = () => {
    $('[data-town-note]', form).hidden = field('town').value !== 'other';
    const svc = (form.elements.namedItem('service') as RadioNodeList).value;
    $('[data-urgent-note]', form).hidden = !['noheat', 'leak'].includes(svc);
  };
  form.addEventListener('change', notes);
  form.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-req-again]')) { body.innerHTML = blank; field('name').focus(); }
    const see = t.closest<HTMLElement>('[data-req-see]');
    if (see) { go('dispatch'); openJob(see.dataset.reqSee!); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.querySelector('[data-req-err]')) return;
    const v = (n: string) => String(new FormData(form).get(n) ?? '').trim();
    const checks: [string, boolean, string][] = [
      ['name', !!v('name'), 'your name'],
      ['phone', validPhone(v('phone')), 'a 10-digit phone number'],
      ['email', !v('email') || validEmail(v('email')), 'a valid email address, or leave it blank'],
      ['street', !!v('street'), 'your street address'],
      ['town', !!v('town'), 'your town'],
      ['service', !!v('service'), 'what you need'],
      ['timing', !!v('timing'), 'how soon you need us'],
      ['desc', v('desc').length >= 10, 'a short description (a sentence is fine)'],
    ];
    $$<HTMLElement>('[aria-invalid]', form).forEach((i) => i.removeAttribute('aria-invalid'));
    const bad = checks.filter((c) => !c[1]);
    if (bad.length) {
      for (const [n] of bad) { const el = form.elements.namedItem(n); (el instanceof RadioNodeList ? $<HTMLElement>('[data-service]', form) : el as HTMLElement).setAttribute('aria-invalid', 'true'); }
      $('[data-req-err]', form).textContent = `Please add ${bad.map((c) => c[2]).join(', ')}.`;
      const first = form.elements.namedItem(bad[0][0]);
      ((first instanceof RadioNodeList ? first[0] : first) as HTMLElement).focus();
      return;
    }
    const svc = services[v('service')];
    const town = v('town') === 'other' ? 'Outside area' : v('town');
    const c: Customer = {
      id: `C${nextCust++}`, name: v('name'), phone: v('phone'), email: v('email'), address: v('street'), town, plan: 'none',
      since: new Date().getFullYear(), balance: 0, lifetime: 0, xy: [70 + Math.round(Math.random() * 180), 60 + Math.round(Math.random() * 170)],
      equipment: [], history: [], tags: ['New request'],
    };
    customers.push(c);
    custById[c.id] = c;
    const type: JobType = svc.type === 'emergency' && v('timing') !== 'As soon as possible' ? 'repair' : svc.type;
    const system = [v('system'), v('make')].filter(Boolean).join(', ');
    const j: Job = {
      id: `J-${nextJob++}`, customer: c.id, type, title: svc.title, tech: null, start: 13 * 60, dur: type === 'estimate' ? 90 : 60, value: 0, status: 'scheduled',
      notes: `Web request. ${system ? `System: ${system}. ` : ''}Timing: ${v('timing')}, ${v('window').toLowerCase()}. “${v('desc')}”`,
      checklist: checklists[type].map((label) => ({ label, done: false })),
    };
    jobs.push(j);
    body.innerHTML = `<div class="tw-reqdone" tabindex="-1">
      <p class="tw-eyebrow">Demo request · not sent</p><h2 id="tw-req-h">Request summary</h2>
      <dl class="tw-facts">
        <div><dt>Name</dt><dd>${esc(c.name)}</dd></div><div><dt>Phone</dt><dd>${esc(c.phone)}</dd></div>
        ${c.email ? `<div><dt>Email</dt><dd>${esc(c.email)}</dd></div>` : ''}
        <div><dt>Address</dt><dd>${esc(c.address)}, ${esc(town === 'Outside area' ? 'outside the service area' : town)}</dd></div>
        <div><dt>Service</dt><dd>${esc(svc.label)}</dd></div>
        ${system ? `<div><dt>System</dt><dd>${esc(system)}</dd></div>` : ''}
        <div><dt>Timing</dt><dd>${esc(v('timing'))}, ${esc(v('window').toLowerCase())}</dd></div>
        <div><dt>Description</dt><dd>${esc(v('desc'))}</dd></div>
      </dl>
      <p class="tw-alert tw-alert--info">Nothing was sent to a real company. No appointment is booked yet: a real office would call or email to arrange a time window.</p>
      <p>In this demo, the request is now in the dispatch board’s Unassigned tray as <b>${j.id}</b>.</p>
      <div class="tw-reqdone__btns"><button type="button" class="tw-btn tw-btn--primary" data-req-see="${j.id}">See it on the board</button><button type="button" class="tw-btn" data-req-again>Send another request</button></div>
    </div>`;
    $<HTMLElement>('.tw-reqdone', form).focus();
  });
}

export function start() {
  startDispatch();
  startRequests();
  startEstimates();
  startCustomers();
  startReports();
  startDemoForms();
  addEventListener('hashchange', route);
  route();
}
