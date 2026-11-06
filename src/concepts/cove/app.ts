// Cove: booking wizard with live availability and a body-map intake,
// a "My visits" portal (stored on this device), memberships and a gift card
// designer. Concept demo: nothing is sent, booked or charged.
import { $, $$, esc, money, rng, daySeed, addDays, startOfDay, fmtTime, fmtDate, downloadIcs, store, toast, openDialog } from '../shared';
import { startDemoForms } from '../../scripts/demo-forms';
import { services, pros, addons, regions, plans, OPEN, CLOSE, type Service } from './data';

const KEY = 'cove-visits-v1';
const svcById = Object.fromEntries(services.map((s) => [s.id, s])) as Record<string, Service>;
const proById = Object.fromEntries(pros.map((p) => [p.id, p]));
interface Visit { id: string; service: string; min: number; pro: string; start: string; price: number; addons: string[]; name?: string }

/* ---------- availability ---------- */
function eligible(svc: Service) { return svc.who[0] === 'any' ? ['any'] : svc.who; }
function slotsFor(proId: string, day: Date, min: number) {
  if (proId !== 'any' && !proById[proId].days.includes(day.getDay())) return [];
  const r = rng(daySeed(day) * 31 + proId.charCodeAt(0) * 7 + proId.length);
  const now = new Date();
  const isToday = startOfDay(now).getTime() === startOfDay(day).getTime();
  const out: number[] = [];
  for (let m = OPEN; m + min <= CLOSE; m += 30) {
    const busy = r() < (proId === 'any' ? 0.25 : 0.5);
    if (busy) continue;
    if (isToday && m < now.getHours() * 60 + now.getMinutes() + 60) continue;
    out.push(m);
  }
  // Remove what's already booked on this device.
  const mine = store.get<Visit[]>(KEY, []).filter((v) => v.pro === proId && startOfDay(new Date(v.start)).getTime() === startOfDay(day).getTime());
  return out.filter((m) => !mine.some((v) => { const s = new Date(v.start); const vm = s.getHours() * 60 + s.getMinutes(); return m < vm + v.min && vm < m + min; }));
}
function slotsAny(svc: Service, day: Date, min: number) {
  const map = new Map<number, string>();
  for (const p of eligible(svc)) for (const m of slotsFor(p, day, min)) if (!map.has(m)) map.set(m, p);
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}
function nextOpening(svc: Service, pro: string) {
  for (let i = 0; i < 14; i++) {
    const d = addDays(startOfDay(new Date()), i);
    const s = pro === 'any' ? slotsAny(svc, d, svc.options[0].min)[0] : (() => { const m = slotsFor(pro, d, svc.options[0].min)[0]; return m === undefined ? undefined : [m, pro] as [number, string]; })();
    if (s) return { day: d, mins: s[0], pro: s[1], i };
  }
  return null;
}
const dayWord = (d: Date, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'long' }));

/* ---------- booking wizard ---------- */
const steps = ['Service', 'Therapist', 'Time', 'About you', 'Review'];
let bk = fresh();
function fresh() {
  return { step: 0, service: '', min: 0, pro: 'any', dayIdx: 0, time: -1, assigned: '', regions: new Set<string>(), pressure: 3, first: true, conditions: new Set<string>(), weeks: '', notes: '', name: '', email: '', phone: '', addons: new Set<string>(), replacing: '' as string, dayTouched: false, done: null as Visit | null };
}
function openBooking(preset: Partial<{ service: string; pro: string; step: number; dayIdx: number; time: number }> = {}) {
  bk = fresh();
  if (preset.service) { bk.service = preset.service; bk.min = svcById[preset.service].options[0].min; bk.step = 1; }
  if (preset.pro) { bk.pro = preset.pro; if (!bk.service) bk.step = 0; else bk.step = 2; }
  if (preset.dayIdx !== undefined) bk.dayIdx = preset.dayIdx;
  if (preset.time !== undefined) { bk.time = preset.time; bk.step = 3; }
  const dlg = $<HTMLDialogElement>('[data-booking]');
  renderBooking();
  openDialog(dlg);
  focusStep();
}
function focusStep() { requestAnimationFrame(() => $<HTMLElement>('[data-booking] .cv-bk__title')?.focus()); }
function price() {
  const svc = svcById[bk.service];
  if (!svc) return 0;
  const base = svc.options.find((o) => o.min === bk.min)?.price ?? 0;
  return base + [...bk.addons].reduce((s, a) => s + addons.find((x) => x.id === a)!.price, 0);
}
function canNext(): string {
  if (bk.step === 0 && !bk.service) return 'Choose a service.';
  if (bk.step === 2 && bk.time < 0) return 'Choose a time.';
  if (bk.step === 3) {
    if (!bk.name.trim()) return 'Add your name.';
    if (!/^\S+@\S+\.\S+$/.test(bk.email)) return 'Add a valid email.';
    if (bk.conditions.has('Pregnant') && !bk.weeks) return 'Tell us how many weeks along you are.';
  }
  return '';
}
function days() { return Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i)); }

function renderBooking() {
  const dlg = $<HTMLDialogElement>('[data-booking]');
  const svc = svcById[bk.service];
  if (bk.done) return renderDone(dlg);
  let body = '';
  if (bk.step === 0) {
    body = `<div class="cv-pickgrid">${services.map((s) => `<label class="cv-pick"><input type="radio" name="svc" value="${s.id}" ${bk.service === s.id ? 'checked' : ''} /><span><b>${esc(s.name)}</b><small>${s.options.map((o) => `${o.min} min · $${o.price}`).join('  ·  ')}</small></span></label>`).join('')}</div>
      ${svc && svc.options.length > 1 ? `<fieldset class="cv-len"><legend>Length</legend>${svc.options.map((o) => `<label class="cv-pill"><input type="radio" name="min" value="${o.min}" ${bk.min === o.min ? 'checked' : ''} /><span>${o.min} min · $${o.price}</span></label>`).join('')}</fieldset>` : ''}`;
  } else if (bk.step === 1) {
    const list = eligible(svc);
    body = list[0] === 'any' ? `<p class="cv-note">${esc(svc.name)} doesn’t need a therapist. Continue to choose a time.</p>` : `<div class="cv-pickgrid">
      <label class="cv-pick cv-pick--pro"><input type="radio" name="pro" value="any" ${bk.pro === 'any' ? 'checked' : ''} /><span class="cv-av cv-av--any" aria-hidden="true">✦</span><span><b>First available</b><small>Most openings</small></span></label>
      ${list.map((id) => { const p = proById[id]; const n = nextOpening(svc, id); return `<label class="cv-pick cv-pick--pro"><input type="radio" name="pro" value="${id}" ${bk.pro === id ? 'checked' : ''} /><span class="cv-av cv-av--${id}" aria-hidden="true">${p.initials}</span><span><b>${esc(p.name)}</b><small>${esc(p.focus)}</small><small class="cv-soon">${n ? `Next: ${dayWord(n.day, n.i)} ${fmtTime(n.mins)}` : 'Fully booked for two weeks'}</small></span></label>`; }).join('')}</div>`;
  } else if (bk.step === 2) {
    const ds = days();
    const count = (d: Date) => (bk.pro === 'any' ? slotsAny(svc, d, bk.min).length : slotsFor(bk.pro, d, bk.min).length);
    if (!bk.dayTouched && bk.time < 0 && !count(ds[bk.dayIdx])) { const j = ds.findIndex((d) => count(d) > 0); if (j >= 0) bk.dayIdx = j; }
    const day = ds[bk.dayIdx];
    const slots = bk.pro === 'any' ? slotsAny(svc, day, bk.min) : slotsFor(bk.pro, day, bk.min).map((m) => [m, bk.pro] as [number, string]);
    const counts = ds.map((d) => (bk.pro === 'any' ? slotsAny(svc, d, bk.min).length : slotsFor(bk.pro, d, bk.min).length));
    const groups: [string, [number, string][]][] = [['Morning', slots.filter(([m]) => m < 720)], ['Afternoon', slots.filter(([m]) => m >= 720 && m < 1020)], ['Evening', slots.filter(([m]) => m >= 1020)]];
    body = `<div class="cv-days" role="radiogroup" aria-label="Day">${ds.map((d, i) => `<button type="button" role="radio" class="cv-day" data-day="${i}" aria-checked="${i === bk.dayIdx}" tabindex="${i === bk.dayIdx ? 0 : -1}" ${counts[i] ? '' : 'aria-disabled="true"'}><small>${i === 0 ? 'Today' : fmtDate(d, { weekday: 'short' })}</small><b>${d.getDate()}</b><i class="cv-dots" aria-hidden="true">${'•'.repeat(Math.min(3, Math.ceil(counts[i] / 4)))}</i><span class="cv-vh">${counts[i]} openings</span></button>`).join('')}</div>
      <p class="cv-dayhead">${esc(fmtDate(day, { weekday: 'long', month: 'long', day: 'numeric' }))} · ${slots.length ? `${slots.length} openings` : 'No openings'}</p>
      ${slots.length ? groups.filter(([, g]) => g.length).map(([label, g]) => `<div class="cv-slotgroup"><p>${label}</p><div class="cv-slots" role="radiogroup" aria-label="${label} times">${g.map(([m, p]) => `<button type="button" role="radio" class="cv-slot" data-time="${m}" data-who="${p}" aria-checked="${bk.time === m}">${fmtTime(m)}${bk.pro === 'any' && p !== 'any' ? `<small>${esc(proById[p].name.split(' ')[0])}</small>` : ''}</button>`).join('')}</div></div>`).join('') : `<p class="cv-note">Nothing left this day. ${(() => { const j = counts.findIndex((c, i) => c && i > bk.dayIdx); return j > 0 ? `<button type="button" class="cv-link" data-day="${j}">Jump to ${esc(fmtDate(ds[j], { weekday: 'long' }))}</button>` : ''; })()}</p>`}`;
  } else if (bk.step === 3) {
    body = `<div class="cv-intake">
      <div class="cv-bodymap">
        <p class="cv-q" id="cv-map-l">Where would you like us to focus?</p>
        <svg viewBox="0 0 200 420" role="group" aria-labelledby="cv-map-l" data-map>${bodyMap()}</svg>
        <p class="cv-chosen" data-chosen aria-live="polite">${bk.regions.size ? esc([...bk.regions].join(', ')) : 'Tap areas on the figure. Tap again to clear.'}</p>
      </div>
      <div class="cv-intake__form">
        ${svc.cat === 'massage' ? `<label class="cv-rangef">Preferred pressure <output data-pout>${['', 'Very light', 'Light', 'Medium', 'Firm', 'Deep'][bk.pressure]}</output><input type="range" min="1" max="5" value="${bk.pressure}" data-pressure /></label>` : ''}
        <fieldset class="cv-conds"><legend>Anything we should know?</legend>${['Recent injury or surgery', 'High blood pressure', 'Pregnant', 'Sensitive skin or allergies'].map((c) => `<label class="cv-checkl"><input type="checkbox" value="${c}" data-cond ${bk.conditions.has(c) ? 'checked' : ''} />${c}</label>`).join('')}</fieldset>
        ${bk.conditions.has('Pregnant') ? `<label>How many weeks along?<select data-weeks><option value="">Choose</option>${['12–20', '21–28', '29–36', '37+'].map((w) => `<option ${bk.weeks === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label>${svc.id !== 'prenatal' && svc.cat === 'massage' ? '<p class="cv-hint">We’ll switch you to a prenatal setup. No change in price.</p>' : ''}` : ''}
        <div class="cv-two"><label>Name<input data-f="name" value="${esc(bk.name)}" autocomplete="name" /></label><label>Email<input data-f="email" type="email" value="${esc(bk.email)}" autocomplete="email" /></label></div>
        <label>Mobile <small>(for a reminder text)</small><input data-f="phone" type="tel" value="${esc(bk.phone)}" autocomplete="tel" /></label>
        <label class="cv-checkl"><input type="checkbox" data-first ${bk.first ? 'checked' : ''} /> This is my first visit to Cove</label>
      </div></div>`;
  } else {
    const start = new Date(days()[bk.dayIdx]); start.setHours(Math.floor(bk.time / 60), bk.time % 60);
    const who = bk.assigned && bk.assigned !== 'any' ? proById[bk.assigned].name : 'Studio suite';
    body = `<div class="cv-review">
      <dl class="cv-sum"><div><dt>Service</dt><dd>${esc(svc.name)}, ${bk.min} min</dd></div><div><dt>With</dt><dd>${esc(who)}</dd></div><div><dt>When</dt><dd>${esc(fmtDate(start, { weekday: 'long', month: 'long', day: 'numeric' }))}, ${fmtTime(bk.time)}</dd></div>${bk.regions.size ? `<div><dt>Focus</dt><dd>${esc([...bk.regions].join(', '))}</dd></div>` : ''}</dl>
      ${svc.cat === 'massage' ? `<fieldset class="cv-addons"><legend>Add to your session</legend>${addons.map((a) => `<label class="cv-checkl cv-checkl--box"><input type="checkbox" value="${a.id}" data-addon ${bk.addons.has(a.id) ? 'checked' : ''} /><span>${esc(a.name)}</span><em>+$${a.price}</em></label>`).join('')}</fieldset>` : ''}
      <p class="cv-policy">Free changes until ${esc(fmtDate(addDays(start, -1), { weekday: 'short', month: 'short', day: 'numeric' }))}, ${fmtTime(bk.time)}. Pay at the studio after your visit.</p></div>`;
  }
  const n = canNext();
  dlg.innerHTML = `<div class="cv-bk">
    <header class="cv-bk__head"><ol class="cv-prog" aria-label="Booking steps">${steps.map((s, i) => `<li class="${i < bk.step ? 'is-done' : i === bk.step ? 'is-now' : ''}" ${i === bk.step ? 'aria-current="step"' : ''}><span>${i < bk.step ? '✓' : i + 1}</span>${s}</li>`).join('')}</ol>
      <button type="button" class="cv-x" data-close aria-label="Close booking">×</button></header>
    <div class="cv-bk__main">
      <div class="cv-bk__body"><h2 id="cv-bk-title" class="cv-bk__title" tabindex="-1">${bk.replacing ? 'Reschedule: ' : ''}${['What would you like?', 'Who would you like to see?', 'Pick a time', 'A little about you', 'Review and confirm'][bk.step]}</h2>${body}</div>
      <aside class="cv-bk__side" aria-label="Your booking"><p class="cv-eyebrow">Your visit</p>
        <p><b>${svc ? esc(svc.name) : 'No service yet'}</b>${svc ? `<br />${bk.min} min` : ''}</p>
        ${bk.service && bk.pro !== 'any' ? `<p>${esc(proById[bk.pro]?.name ?? '')}</p>` : ''}
        ${bk.time >= 0 ? `<p>${esc(fmtDate(days()[bk.dayIdx], { weekday: 'short', month: 'short', day: 'numeric' }))}<br />${fmtTime(bk.time)}</p>` : ''}
        ${svc ? `<p class="cv-bk__price">${money(price(), true)}</p>` : ''}</aside>
    </div>
    <footer class="cv-bk__foot"><p class="cv-err" data-bk-err role="alert"></p>
      ${bk.step > 0 ? '<button type="button" class="cv-btn cv-btn--ghost" data-prev>Back</button>' : '<span></span>'}
      <button type="button" class="cv-btn cv-btn--accent" data-nextstep ${n && bk.step !== 3 ? 'aria-disabled="true"' : ''}>${bk.step === 4 ? `Confirm booking · ${money(price(), true)}` : 'Continue'}</button>
    </footer></div>`;
}
function bodyMap() {
  const R: Record<string, string> = {
    'Head and neck': '<circle cx="100" cy="38" r="22" /><rect x="91" y="58" width="18" height="16" rx="5" />',
    Shoulders: '<rect x="44" y="76" width="32" height="22" rx="10" /><rect x="124" y="76" width="32" height="22" rx="10" />',
    'Upper back': '<rect x="77" y="78" width="46" height="60" rx="10" />',
    'Lower back': '<rect x="77" y="140" width="46" height="46" rx="8" />',
    Arms: '<rect x="40" y="98" width="18" height="92" rx="9" /><rect x="142" y="98" width="18" height="92" rx="9" />',
    Hands: '<circle cx="49" cy="204" r="11" /><circle cx="151" cy="204" r="11" />',
    'Hips and glutes': '<rect x="68" y="188" width="64" height="36" rx="12" />',
    Thighs: '<rect x="70" y="226" width="28" height="70" rx="12" /><rect x="102" y="226" width="28" height="70" rx="12" />',
    Knees: '<circle cx="84" cy="308" r="12" /><circle cx="116" cy="308" r="12" />',
    Calves: '<rect x="73" y="322" width="22" height="62" rx="10" /><rect x="105" y="322" width="22" height="62" rx="10" />',
    Feet: '<ellipse cx="82" cy="398" rx="15" ry="9" /><ellipse cx="118" cy="398" rx="15" ry="9" />',
  };
  return regions.map((r) => `<g class="cv-region" role="checkbox" tabindex="0" aria-checked="${bk.regions.has(r)}" aria-label="${r}" data-region="${r}">${R[r]}</g>`).join('');
}
function renderDone(dlg: HTMLDialogElement) {
  const v = bk.done!;
  const s = new Date(v.start);
  dlg.innerHTML = `<div class="cv-bk cv-bk--done"><button type="button" class="cv-x" data-close aria-label="Close">×</button>
    <div class="cv-done" tabindex="-1">
      <svg class="cv-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
      <p class="cv-eyebrow">${bk.replacing ? 'Rescheduled' : 'Booked'} · demo</p>
      <h2 id="cv-bk-title" class="cv-bk__title" tabindex="-1">See you ${esc(dayWord(s, Math.round((startOfDay(s).getTime() - startOfDay(new Date()).getTime()) / 864e5)).toLowerCase())}, ${esc(bk.name.split(' ')[0])}.</h2>
      <p>${esc(svcById[v.service].name)} · ${v.min} min${v.pro !== 'any' ? ` with ${esc(proById[v.pro].name)}` : ''}<br /><b>${esc(fmtDate(s, { weekday: 'long', month: 'long', day: 'numeric' }))} at ${fmtTime(s.getHours() * 60 + s.getMinutes())}</b></p>
      <div class="cv-done__btns"><button type="button" class="cv-btn cv-btn--accent" data-ics="${v.id}">Add to calendar</button><button type="button" class="cv-btn cv-btn--ghost" data-show-visits>View my visits</button></div>
      <p class="demo-note">Nothing was sent and no time is held. This visit is saved on this device so you can try rescheduling and cancelling.</p>
    </div></div>`;
}
function confirm() {
  const start = new Date(days()[bk.dayIdx]); start.setHours(Math.floor(bk.time / 60), bk.time % 60, 0, 0);
  const v: Visit = { id: bk.replacing || Math.random().toString(36).slice(2, 8), service: bk.service, min: bk.min, pro: bk.assigned || bk.pro, start: start.toISOString(), price: price(), addons: [...bk.addons], name: bk.name };
  const list = store.get<Visit[]>(KEY, []).filter((x) => x.id !== bk.replacing);
  list.push(v);
  store.set(KEY, list);
  bk.done = v;
  renderBooking();
  updateDot();
  focusStep();
}
function startBooking() {
  const dlg = $<HTMLDialogElement>('[data-booking]');
  const err = (m: string) => { const e = $('[data-bk-err]', dlg); e.textContent = m; };
  dlg.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'svc') { bk.service = t.value; bk.min = svcById[t.value].options[0].min; bk.time = -1; bk.pro = svcById[t.value].who.includes(bk.pro) ? bk.pro : 'any'; renderBooking(); $<HTMLElement>(`input[name="svc"][value="${t.value}"]`, dlg).focus(); }
    if (t.name === 'min') { bk.min = Number(t.value); bk.time = -1; renderBooking(); $<HTMLElement>(`input[name="min"][value="${t.value}"]`, dlg).focus(); }
    if (t.name === 'pro') { bk.pro = t.value; bk.time = -1; renderBooking(); $<HTMLElement>(`input[name="pro"][value="${t.value}"]`, dlg).focus(); }
    if (t.matches('[data-cond]')) { t.checked ? bk.conditions.add(t.value) : bk.conditions.delete(t.value); if (t.value === 'Pregnant') { renderBooking(); $<HTMLElement>(`[data-cond][value="Pregnant"]`, dlg).focus(); } }
    if (t.matches('[data-weeks]')) bk.weeks = t.value;
    if (t.matches('[data-first]')) bk.first = t.checked;
    if (t.matches('[data-addon]')) { t.checked ? bk.addons.add(t.value) : bk.addons.delete(t.value); renderBooking(); $<HTMLElement>(`[data-addon][value="${t.value}"]`, dlg).focus(); }
  });
  dlg.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.f) (bk as unknown as Record<string, string>)[t.dataset.f] = t.value;
    if (t.matches('[data-pressure]')) { bk.pressure = Number(t.value); $('[data-pout]', dlg).textContent = ['', 'Very light', 'Light', 'Medium', 'Firm', 'Deep'][bk.pressure]; }
  });
  const toggleRegion = (g: Element) => {
    const r = (g as HTMLElement).dataset.region!;
    bk.regions.has(r) ? bk.regions.delete(r) : bk.regions.add(r);
    g.setAttribute('aria-checked', String(bk.regions.has(r)));
    $('[data-chosen]', dlg).textContent = bk.regions.size ? [...bk.regions].join(', ') : 'Tap areas on the figure. Tap again to clear.';
  };
  dlg.addEventListener('keydown', (e) => {
    const g = (e.target as Element).closest?.('[data-region]');
    if (g && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggleRegion(g); }
    const day = (e.target as HTMLElement).closest?.('[data-day]');
    if (day && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const all = $$<HTMLElement>('.cv-day:not([aria-disabled])', dlg);
      const i = all.indexOf(day as HTMLElement);
      const nx = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
      bk.dayTouched = true; bk.dayIdx = Number(nx.dataset.day); bk.time = -1; renderBooking(); $<HTMLElement>(`.cv-day[data-day="${bk.dayIdx}"]`, dlg).focus();
    }
  });
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-close]')) return dlg.close();
    const g = (t as Element).closest('[data-region]');
    if (g) return toggleRegion(g);
    const d = t.closest<HTMLElement>('[data-day]');
    if (d && d.getAttribute('aria-disabled') !== 'true') { bk.dayTouched = true; bk.dayIdx = Number(d.dataset.day); bk.time = -1; renderBooking(); $<HTMLElement>(`.cv-day[data-day="${bk.dayIdx}"]`, dlg).focus(); return; }
    const s = t.closest<HTMLElement>('[data-time]');
    if (s) { bk.time = Number(s.dataset.time); bk.assigned = s.dataset.who!; renderBooking(); $<HTMLElement>(`[data-time="${bk.time}"]`, dlg).focus(); return; }
    if (t.closest('[data-prev]')) { bk.step = Math.max(0, bk.step - 1); if (bk.step === 3 && bk.replacing) bk.step = 2; if (bk.step === 1 && eligible(svcById[bk.service])[0] === 'any') bk.step = 0; renderBooking(); focusStep(); return; }
    if (t.closest('[data-nextstep]')) {
      const m = canNext();
      if (m) { err(m); if (bk.step === 3) { const f = !bk.name.trim() ? 'name' : !/^\S+@\S+\.\S+$/.test(bk.email) ? 'email' : ''; if (f) { const inp = $<HTMLInputElement>(`[data-f="${f}"]`, dlg); inp.setAttribute('aria-invalid', 'true'); inp.focus(); } else $<HTMLElement>('[data-weeks]', dlg)?.focus(); } return; }
      if (bk.step === 4) return confirm();
      if (bk.step === 2 && !bk.assigned) bk.assigned = bk.pro;
      bk.step++;
      if (bk.step === 3 && bk.replacing) bk.step = 4;
      if (bk.step === 1 && eligible(svcById[bk.service])[0] === 'any') { bk.pro = 'any'; bk.step = 2; }
      if (bk.step === 3 && bk.conditions.has('Pregnant') && svcById[bk.service].cat === 'massage') { /* handled at confirm */ }
      renderBooking(); focusStep();
    }
    const ics = t.closest<HTMLElement>('[data-ics]');
    if (ics) icsFor(store.get<Visit[]>(KEY, []).find((v) => v.id === ics.dataset.ics)!);
    if (t.closest('[data-show-visits]')) { dlg.close(); openVisits(); }
  });
}
function icsFor(v: Visit) {
  downloadIcs({ title: `${svcById[v.service].name} at Cove (concept demo)`, start: new Date(v.start), minutes: v.min, location: '2 Ferry Landing, Gull Harbor (fictional)', description: v.pro !== 'any' ? `With ${proById[v.pro].name}` : 'Studio suite', file: 'cove-visit.ics' });
}

/* ---------- my visits ---------- */
function updateDot() {
  const up = store.get<Visit[]>(KEY, []).filter((v) => new Date(v.start) > new Date());
  $('[data-visits-dot]').hidden = !up.length;
}
let cancelAsk = '';
function openVisits() {
  const dlg = $<HTMLDialogElement>('[data-visits]');
  const list = store.get<Visit[]>(KEY, []).sort((a, b) => a.start.localeCompare(b.start));
  const now = new Date();
  const up = list.filter((v) => new Date(v.start) > now);
  const past = [{ id: 'sample', service: 'swedish', min: 60, pro: 'lena', start: (() => { const d = addDays(startOfDay(now), -24); d.setHours(10, 30); return d.toISOString(); })(), price: 110, addons: [] } as Visit, ...list.filter((v) => new Date(v.start) <= now)];
  const card = (v: Visit, isPast = false) => {
    const s = new Date(v.start);
    const hrs = (s.getTime() - now.getTime()) / 36e5;
    return `<li class="cv-vcard ${isPast ? 'is-past' : ''}"><div class="cv-vcard__date"><b>${s.getDate()}</b><small>${fmtDate(s, { month: 'short' })}</small></div>
      <div class="cv-vcard__info"><b>${esc(svcById[v.service].name)}</b><small>${fmtDate(s, { weekday: 'long' })}, ${fmtTime(s.getHours() * 60 + s.getMinutes())} · ${v.min} min${v.pro !== 'any' ? ` · ${esc(proById[v.pro].name.split(',')[0])}` : ''}</small>
      ${isPast ? `<button type="button" class="cv-link" data-rebook="${v.service}|${v.pro}">Book again</button>` : cancelAsk === v.id
        ? `<div class="cv-cancelq" role="group" aria-label="Confirm cancel"><p>${hrs < 24 ? 'This is within 24 hours, so half the visit would be charged.' : 'Free to cancel. Cancel this visit?'}</p><button type="button" class="cv-btn cv-btn--sm cv-btn--dark" data-cancel-yes="${v.id}">Yes, cancel</button><button type="button" class="cv-btn cv-btn--sm cv-btn--ghost" data-cancel-no>Keep it</button></div>`
        : `<div class="cv-vcard__btns"><button type="button" class="cv-link" data-ics="${v.id}">Calendar</button><button type="button" class="cv-link" data-resched="${v.id}">Reschedule</button><button type="button" class="cv-link" data-cancel="${v.id}">Cancel</button></div>`}
      </div></li>`;
  };
  dlg.innerHTML = `<div class="cv-vs"><header><h2 id="cv-vs-title">My visits</h2><button type="button" class="cv-x" data-close aria-label="Close">×</button></header>
    <p class="cv-eyebrow">Upcoming</p>
    ${up.length ? `<ul class="cv-vlist">${up.map((v) => card(v)).join('')}</ul>` : `<div class="cv-empty"><p>No upcoming visits.</p><button type="button" class="cv-btn cv-btn--accent" data-book-from-visits>Book a visit</button></div>`}
    <p class="cv-eyebrow">Past</p><ul class="cv-vlist">${past.map((v) => card(v, true)).join('')}</ul>
    <p class="cv-fine">Demo portal: visits are stored on this device only.</p></div>`;
  if (!dlg.open) openDialog(dlg);
}
function startVisits() {
  const dlg = $<HTMLDialogElement>('[data-visits]');
  $('[data-open-visits]').addEventListener('click', openVisits);
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-close]')) return dlg.close();
    const ics = t.closest<HTMLElement>('[data-ics]');
    if (ics) icsFor(store.get<Visit[]>(KEY, []).find((v) => v.id === ics.dataset.ics)!);
    const c = t.closest<HTMLElement>('[data-cancel]');
    if (c) { cancelAsk = c.dataset.cancel!; openVisits(); $<HTMLElement>('[data-cancel-yes]', dlg).focus(); }
    if (t.closest('[data-cancel-no]')) { const id = cancelAsk; cancelAsk = ''; openVisits(); $<HTMLElement>(`[data-cancel="${id}"]`, dlg)?.focus(); }
    const y = t.closest<HTMLElement>('[data-cancel-yes]');
    if (y) { store.set(KEY, store.get<Visit[]>(KEY, []).filter((v) => v.id !== y.dataset.cancelYes)); cancelAsk = ''; openVisits(); updateDot(); toast('Visit cancelled. Demo: nothing was sent.', 'cv-toast'); $<HTMLElement>('.cv-x', dlg).focus(); }
    const r = t.closest<HTMLElement>('[data-resched]');
    if (r) {
      const v = store.get<Visit[]>(KEY, []).find((x) => x.id === r.dataset.resched)!;
      dlg.close();
      openBooking({ service: v.service, pro: v.pro });
      bk.min = v.min; bk.replacing = v.id; bk.name = v.name || 'there'; bk.email = 'saved@example.com'; bk.addons = new Set(v.addons); bk.step = 2; renderBooking(); focusStep();
    }
    const rb = t.closest<HTMLElement>('[data-rebook]');
    if (rb) { const [s, p] = rb.dataset.rebook!.split('|'); dlg.close(); openBooking({ service: s, pro: p }); }
    if (t.closest('[data-book-from-visits]')) { dlg.close(); openBooking(); }
  });
  updateDot();
}

/* ---------- services tabs, team, hero ---------- */
function startPage() {
  const tabs = $$<HTMLButtonElement>('[data-tab]');
  const pick = (b: HTMLButtonElement) => {
    tabs.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; $(`#cv-panel-${x.dataset.tab}`).hidden = !on; });
    b.focus();
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => pick(b));
    b.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); pick(tabs[(i + k + tabs.length) % tabs.length]); } });
  });
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-book]')) openBooking();
    const s = t.closest<HTMLElement>('[data-book-service]');
    if (s) openBooking({ service: s.dataset.bookService });
    const p = t.closest<HTMLElement>('[data-book-pro]');
    if (p) { const svc = services.find((x) => x.who.includes(p.dataset.bookPro!))!; openBooking({ service: svc.id, pro: p.dataset.bookPro }); }
    const g = t.closest<HTMLElement>('[data-grab]');
    if (g) { const [s2, pro, di, m] = g.dataset.grab!.split('|'); openBooking({ service: s2, pro, dayIdx: Number(di), time: Number(m) }); bk.assigned = pro; renderBooking(); focusStep(); }
  });
  for (const el of $$('[data-pro-next]')) {
    const id = el.dataset.proNext!;
    const n = nextOpening(services.find((x) => x.who.includes(id))!, id);
    el.textContent = n ? `Next opening ${dayWord(n.day, n.i).toLowerCase()}, ${fmtTime(n.mins)}` : 'Fully booked';
  }
  const svc = svcById.deep;
  const n = nextOpening(svc, 'any');
  if (n) $('[data-next]').innerHTML = `<span class="cv-pulse" aria-hidden="true"></span><span>Next opening: <b>${esc(dayWord(n.day, n.i))}, ${fmtTime(n.mins)}</b> with ${esc(proById[n.pro].name.split(' ')[0])} · Deep tissue</span><button type="button" class="cv-link" data-grab="${svc.id}|${n.pro}|${n.i}|${n.mins}">Grab it</button>`;
  const c = $<HTMLElement>('[data-chip-next]');
  if (c && n) c.textContent = `${dayWord(n.day, n.i)}, ${fmtTime(n.mins)}`;
}

/* ---------- membership ---------- */
function startMembership() {
  const set = (y: boolean) => {
    $$('[data-bill]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.bill === 'y') === y)));
    for (const el of $$('[data-plan-price]')) { const p = Number(el.dataset.planPrice); el.textContent = money(y ? p * 10 : p, true); }
    $$('[data-plan-unit]').forEach((u) => (u.textContent = y ? '/year' : '/month'));
    for (const el of $$('[data-plan-save]')) el.textContent = y ? `Save ${money(Number(el.dataset.planSave) * 2, true)} a year` : '';
  };
  $$('[data-bill]').forEach((b) => b.addEventListener('click', () => set(b.dataset.bill === 'y')));
  const dlg = $<HTMLDialogElement>('[data-joindlg]');
  document.addEventListener('click', (e) => {
    const j = (e.target as HTMLElement).closest<HTMLElement>('[data-join]');
    if (!j) return;
    const p = plans.find((x) => x.id === j.dataset.join)!;
    const yearly = $('[data-bill="y"]').getAttribute('aria-pressed') === 'true';
    dlg.innerHTML = `<form class="cv-join" data-demo><header><h2 id="cv-join-title">Join ${esc(p.name)}</h2><button type="button" class="cv-x" data-close aria-label="Close">×</button></header>
      <p class="cv-join__price">${money(yearly ? p.price * 10 : p.price, true)}<small>${yearly ? '/year' : '/month'}</small></p>
      <ul>${p.perks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <label>Name<input name="name" autocomplete="name" required /></label><label>Email<input name="email" type="email" autocomplete="email" required /></label>
      <p class="demo-note">Demo form: nothing is sent or charged.</p>
      <button class="cv-btn cv-btn--accent cv-btn--block" type="submit">Start membership</button>
      <p class="cv-result" data-demo-result tabindex="-1" role="status"></p></form>`;
    dlg.querySelector('[data-close]')!.addEventListener('click', () => dlg.close());
    dlg.querySelector('form')!.addEventListener('submit', (ev) => { ev.preventDefault(); $('[data-demo-result]', dlg).textContent = 'This is a concept demo, so nothing was sent. On a real site, this would start the membership and take the first payment.'; $<HTMLElement>('[data-demo-result]', dlg).focus(); });
    openDialog(dlg);
  });
}

/* ---------- gift card ---------- */
function startGift() {
  const f = $<HTMLFormElement>('[data-giftform]');
  const card = $('[data-card3d]');
  const date = $<HTMLInputElement>('[data-gdate]');
  date.min = new Date().toISOString().slice(0, 10);
  date.value = date.min;
  const amount = () => { const v = (f.elements.namedItem('amt') as RadioNodeList).value; return v === 'custom' ? Math.max(0, Number((f.elements.namedItem('custom') as HTMLInputElement).value) || 0) : Number(v); };
  const upd = () => {
    const fd = new FormData(f);
    const custom = fd.get('amt') === 'custom';
    $('[data-custom]').hidden = !custom;
    const a = amount();
    $('[data-g-amt]').textContent = money(a, true);
    $('[data-g-for]').textContent = fd.get('to') ? `For ${fd.get('to')}` : 'For someone lovely';
    $('[data-g-msg]').textContent = String(fd.get('msg') || 'Take an afternoon just for you.');
    $('[data-g-from]').textContent = `— ${fd.get('from') || 'A friend'}`;
    $('[data-count]').textContent = `${String(fd.get('msg') ?? '').length}/120`;
    card.dataset.theme = String(fd.get('theme'));
    $('[data-g-buy]').textContent = `Buy gift card · ${money(a, true)}`;
  };
  f.addEventListener('input', (e) => { upd(); const t = e.target as HTMLElement; if (t.matches('textarea[name="msg"], input[name="from"]')) card.classList.add('is-flipped'); else if (t.matches('input[name="to"], input[name="amt"], input[name="custom"]')) card.classList.remove('is-flipped'); });
  $('[data-flip]').addEventListener('click', () => card.classList.toggle('is-flipped'));
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('[data-g-err]');
    const em = f.elements.namedItem('email') as HTMLInputElement;
    em.removeAttribute('aria-invalid');
    if (amount() < 25 || amount() > 1000) { err.textContent = 'Choose an amount from $25 to $1,000.'; return; }
    if (!/^\S+@\S+\.\S+$/.test(em.value)) { err.textContent = 'Add the recipient’s email.'; em.setAttribute('aria-invalid', 'true'); em.focus(); return; }
    err.textContent = '';
    const code = `COVE-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    $('.cv-gcard__code').textContent = code;
    card.classList.add('is-flipped', 'is-sold');
    toast(`Demo, nothing charged: ${money(amount(), true)} card ${code} would be emailed on ${fmtDate(new Date(date.value + 'T12:00'), { month: 'short', day: 'numeric' })}.`, 'cv-toast');
  });
  upd();
}

export function start() {
  startPage();
  startBooking();
  startVisits();
  startMembership();
  startGift();
  startDemoForms();
}
