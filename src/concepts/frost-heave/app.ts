// Frost Heave Creamery: a fictional ice cream shop. Concept demo: today's
// status, which seasonal flavors are in the case, and a small owner panel
// (sold-out flavors and a notice) kept in this browser (localStorage). The
// rules are in ./logic.ts.
import { $, $$, esc, css, store, toast, openDialog, pressFeedback } from '../shared';
import { flavors, flavorById, type Flavor } from './data';
import { emptyOverrides, statusAt, seasonFor, flavorState, backIn, monthName, dateKey, type Overrides } from './logic';

const OWNER = 'frost-heave-owner-v2';

const load = (): Overrides => {
  const o = { ...emptyOverrides(), ...store.get<Partial<Overrides>>(OWNER, {}) };
  return { soldOut: Array.isArray(o.soldOut) ? o.soldOut.filter((id) => flavorById[id]) : [], notice: o.notice && typeof o.notice.text === 'string' ? o.notice : null };
};
let ov = load();
const now = () => new Date();
const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** A light wash of the flavor's colour, mixed toward cream so dark flavors don't turn grey. */
function tint(f: Flavor) {
  const a = parseInt(f.look.base.slice(1), 16), c = [255, 246, 230];
  return '#' + [a >> 16, (a >> 8) & 255, a & 255].map((v, i) => Math.round(v * 0.38 + c[i] * 0.62).toString(16).padStart(2, '0')).join('');
}
const closeBtn = '<button type="button" class="fh-x" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

function renderStatus() {
  const t = now();
  const st = statusAt(t);
  $('[data-status]').classList.toggle('is-open', st.open);
  $('[data-status-text]').textContent = `${st.text} (sample)`;
  const visit = $('[data-visit-status]');
  visit.hidden = false;
  visit.textContent = `${st.open ? `Open now, until ${st.text.replace('Open until ', '')}` : `Closed now, ${st.text.replace('Closed · ', '')}`} · ${st.detail} (sample)`;
  const cur = seasonFor(t).id;
  for (const li of $$('[data-season]')) {
    li.classList.toggle('is-now', li.dataset.season === cur);
    $('.fh-season__now', li).hidden = li.dataset.season !== cur;
  }

  const notice = ov.notice && ov.notice.until >= dateKey(t) ? ov.notice : null;
  $('[data-notice]').hidden = !notice;
  $('[data-notice-text]').textContent = notice ? `${notice.text} (Sample notice from the owner panel.)` : '';
}

/** Out-of-season flavors leave the list, with one line saying when the next ones are back. Sold-out ones stay, marked. */
function renderFlavors() {
  const t = now();
  for (const li of $$('[data-flavor]')) {
    const st = flavorState(flavorById[li.dataset.flavor!], t, ov);
    li.hidden = st === 'rotating';
    li.dataset.state = st;
    $('[data-out]', li).hidden = st !== 'out';
  }
  const later = flavors.filter((f) => f.cat === 'season' && flavorState(f, t, ov) === 'rotating')
    .map((f) => ({ f, m: backIn(f, t)! }))
    .sort((a, b) => ((a.m - t.getMonth() + 11) % 12) - ((b.m - t.getMonth() + 11) % 12))
    .slice(0, 3);
  const p = $('[data-later]');
  p.hidden = !later.length;
  p.textContent = later.length ? `Coming later: ${list(later.map(({ f, m }) => `${f.name} (${monthName(m)})`))}.` : '';
}

/* ---------- owner panel (demo) ---------- */

function renderOwner() {
  const dlg = $<HTMLDialogElement>('[data-owner-dlg]');
  const t = now();
  const live = flavors.filter((f) => flavorState(f, t, ov) !== 'rotating');
  const n = ov.notice;
  dlg.innerHTML = `${closeBtn}<div class="fh-dlg__in fh-own">
    <p class="fh-kicker">Demo owner panel</p>
    <h2 id="fh-owner-title">Update the site</h2>
    <p class="fh-own__lede">How the shop would keep the day’s details current. In this demo, changes stay in this browser and nobody else sees them. A real site would put this behind a login.</p>
    <form class="fh-own__panel" data-own-notice novalidate>
      <label class="fh-field"><span>Notice across the top of the site</span><textarea name="text" rows="2" maxlength="140" placeholder="Closing at 6 tonight for a private event.">${esc(n?.text ?? '')}</textarea></label>
      <p class="fh-err" data-err role="alert"></p>
      <div class="fh-own__row"><button class="fh-btn fh-btn--small fh-btn--yellow" type="submit">Post for today</button>${n ? '<button class="fh-btn fh-btn--small fh-btn--ghost" type="button" data-own-unnotice>Take it down</button>' : ''}</div>
    </form>
    <fieldset class="fh-own__panel"><legend>Sold out today</legend>
      <ul class="fh-own__flavors" role="list">${live.map((f) => `<li><label class="fh-check"><input type="checkbox" data-own-out="${f.id}" ${ov.soldOut.includes(f.id) ? 'checked' : ''} /> <span>${esc(f.name)}</span></label></li>`).join('')}</ul>
    </fieldset>
    <div class="fh-own__foot"><button type="button" class="fh-linkbtn" data-own-reset>Reset to the sample data</button></div>
  </div>`;
  bindOwner(dlg);
}

function ownerChanged(msg: string) {
  store.set(OWNER, ov);
  renderAll();
  toast(`${msg} The site updated. Demo: saved in this browser only.`, 'fh-toast');
}

function bindOwner(dlg: HTMLDialogElement) {
  const form = $<HTMLFormElement>('[data-own-notice]', dlg);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const box = form.elements.namedItem('text') as HTMLTextAreaElement;
    const err = $('[data-err]', form);
    if (!box.value.trim()) { err.textContent = 'Write the notice first.'; box.setAttribute('aria-invalid', 'true'); box.focus(); return; }
    ov.notice = { text: box.value.trim(), until: dateKey(now()) };
    ownerChanged('Notice posted for today.');
    renderOwner();
  });
  dlg.querySelector('[data-own-unnotice]')?.addEventListener('click', () => { ov.notice = null; ownerChanged('Notice taken down.'); renderOwner(); });
  for (const c of $$<HTMLInputElement>('[data-own-out]', dlg)) c.addEventListener('change', () => {
    const id = c.dataset.ownOut!;
    ov.soldOut = ov.soldOut.filter((x) => x !== id);
    if (c.checked) ov.soldOut.push(id);
    ownerChanged(`${flavorById[id].name} marked ${c.checked ? 'sold out' : 'back in the case'}.`);
  });
  $('[data-own-reset]', dlg).addEventListener('click', () => { ov = emptyOverrides(); ownerChanged('Back to the sample data.'); renderOwner(); $<HTMLElement>('[data-own-reset]', dlg).focus(); });
}

/* ---------- start ---------- */

function renderAll() {
  renderStatus();
  renderFlavors();
}

export function start() {
  document.documentElement.classList.add('fh-js');
  pressFeedback('.fh-btn, .fh-check');
  for (const w of $$('[data-tint]')) css(w, { '--tint': tint(flavorById[w.dataset.tint!]) });
  $('[data-open-owner]').addEventListener('click', () => { renderOwner(); openDialog($<HTMLDialogElement>('[data-owner-dlg]')); });
  for (const dlg of $$<HTMLDialogElement>('dialog')) dlg.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) dlg.close(); });
  renderAll();
  setInterval(renderStatus, 60000);
  addEventListener('storage', (e) => { if (e.key === OWNER) { ov = load(); renderAll(); } });
}
