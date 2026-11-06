// Ember & Rye: pickup ordering and table reservations for a fictional
// restaurant. Concept demo: orders and reservations are simulated in the
// browser and never leave it. The cart is kept in localStorage so a reload
// keeps it. Prices, totals and pickup times come from ./order.ts; seatings
// and capacity from ./reserve.ts.
import { $, $$, esc, money, addDays, fmtTime, fmtDate, downloadIcs, store, toast, openDialog, reducedMotion, pressFeedback } from '../shared';
import { startDemoForms } from '../../scripts/demo-forms';
import { categories, tagLabel, allergenLabel, TIPS, TAX, HOLD_MINUTES, MAX_QTY, MAX_PARTY, TABLE_HOLD, BOOKING_DAYS, hours, dayNames, prepMinutes, type Item } from './data';
import { byId, unitPrice, lineTotal, totals, clampQty, orderingOpen, asapTime, pickupSlots, validPhone, type Line } from './order';
import { seatings, slotState, dayState, nextOpenDay, bookingProblem, dateKey, fromKey, startOf, type Booking, type DayState } from './reserve';

interface Cart { lines: Line[]; tip: number }

const KEY = 'ember-rye-cart-v2';
let cart: Cart = store.get<Cart>(KEY, { lines: [], tip: 0 });
cart.lines = cart.lines.filter((l) => byId[l.id] && !byId[l.id].dineIn).map((l) => ({ ...l, qty: clampQty(l.qty) }));
if (!TIPS.includes(cart.tip)) cart.tip = 0;
const save = () => store.set(KEY, cart);
const sum = () => totals(cart.lines, cart.tip);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/* ---------- sample hours ---------- */
function renderStatus() {
  const now = new Date();
  const h = hours[now.getDay()];
  const m = now.getHours() * 60 + now.getMinutes();
  let text = 'Sample hours';
  if (h && m >= h[0] && m < h[1]) text = `Sample hours · open until ${fmtTime(h[1])}`;
  else for (let i = h && m < h[0] ? 0 : 1; i < 8; i++) {
    const hh = hours[addDays(now, i).getDay()];
    if (hh) { text = `Sample hours · opens ${i === 0 ? 'today' : dayNames[addDays(now, i).getDay()].slice(0, 3)} ${fmtTime(hh[0])}`; break; }
  }
  $('[data-status-text]').textContent = text;
  for (const tr of $$('[data-day]')) tr.classList.toggle('is-today', Number(tr.dataset.day) === now.getDay());
}

/* ---------- cart lines ---------- */
function optSummary(item: Item, opts: Record<string, string[]>) {
  const parts: string[] = [];
  for (const g of item.options ?? []) {
    const picked = g.choices.filter((c) => opts[g.id]?.includes(c.id));
    if (!picked.length) continue;
    // Skip the default first choice of a required group (it says nothing new).
    if (g.required && picked.length === 1 && picked[0] === g.choices[0]) continue;
    parts.push(picked.map((c) => c.label).join(', '));
  }
  return parts.join(' · ');
}

/** Adds (or, with replaceKey, updates) a line. Returns false if it hit the per-item limit. */
function addLine(id: string, opts: Record<string, string[]>, qty: number, note: string, replaceKey?: string) {
  const sig = id + JSON.stringify(opts) + note;
  if (replaceKey) cart.lines = cart.lines.filter((l) => l.key !== replaceKey);
  const same = cart.lines.find((l) => l.id + JSON.stringify(l.opts) + l.note === sig);
  const want = (same?.qty ?? 0) + qty;
  if (same) same.qty = clampQty(want);
  else cart.lines.push({ key: Math.random().toString(36).slice(2, 9), id, qty: clampQty(want), opts, note });
  save();
  updateBadges(true);
  return want <= MAX_QTY;
}
const limitMsg = `Online orders take up to ${MAX_QTY} of one item. For more, call the restaurant.`;

function defaults(item: Item) {
  const o: Record<string, string[]> = {};
  for (const g of item.options ?? []) o[g.id] = g.required ? [g.choices[0].id] : [];
  return o;
}

function updateBadges(bump = false) {
  const t = sum();
  const badge = $('[data-count]');
  badge.textContent = String(t.count);
  badge.setAttribute('aria-label', `${plural(t.count, 'item')} in your order`);
  if (bump && !reducedMotion()) { badge.classList.remove('is-bump'); void badge.offsetWidth; badge.classList.add('is-bump'); }
  const fl = $('.er-floatcart');
  fl.hidden = t.count === 0;
  $('[data-float-count]').textContent = plural(t.count, 'item');
  $('[data-float-total]').textContent = money(t.total);
}

/* ---------- menu: filters, search, section tracking ---------- */
function startMenu() {
  const search = $<HTMLInputElement>('[data-search]');
  const filters = $$<HTMLInputElement>('[data-filter]');
  const live = $('[data-menu-live]');
  const apply = () => {
    const q = search.value.trim().toLowerCase();
    const want = filters.filter((f) => f.checked).map((f) => f.value);
    let shown = 0;
    for (const li of $$('.er-item')) {
      const tags = (li.dataset.tags ?? '').split(' ');
      // Vegan dishes are also vegetarian.
      const ok = want.every((t) => tags.includes(t) || (t === 'v' && tags.includes('vg'))) && (!q || li.dataset.text!.includes(q));
      li.hidden = !ok;
      if (ok) shown++;
    }
    for (const sec of $$('.er-cat')) sec.hidden = !$$('.er-item', sec).some((li) => !li.hidden);
    for (const a of $$<HTMLAnchorElement>('[data-cat-link]')) a.hidden = $(`#cat-${a.dataset.catLink}`).hidden;
    $('[data-empty]').hidden = shown > 0;
    $('[data-clear-inline]').hidden = !q && !want.length;
    live.textContent = !q && !want.length ? '' : shown ? `${plural(shown, 'dish', 'dishes')} shown.` : 'No dishes match.';
  };
  search.addEventListener('input', apply);
  filters.forEach((f) => f.addEventListener('change', apply));
  const clear = () => { search.value = ''; filters.forEach((f) => (f.checked = false)); apply(); search.focus(); };
  $$('[data-clear]').forEach((b) => b.addEventListener('click', clear));

  const links = $$<HTMLAnchorElement>('[data-cat-link]');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach((a) => a.toggleAttribute('aria-current', a.dataset.catLink === (e.target as HTMLElement).dataset.cat));
      const cur = links.find((a) => a.hasAttribute('aria-current'));
      cur?.parentElement?.scrollTo({ left: cur.offsetLeft - 16, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.er-cat').forEach((s) => io.observe(s));

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const open = t.closest<HTMLElement>('[data-open]');
    const quick = t.closest<HTMLElement>('[data-quick]');
    if (open) openItem(open.dataset.open!);
    if (quick) {
      const item = byId[quick.dataset.quick!];
      if (item.options?.length) openItem(item.id);
      else toast(addLine(item.id, {}, 1, '') ? `${item.name} added to your order.` : limitMsg, 'er-toast');
    }
  });
}

/* ---------- item dialog ---------- */
const containsText = (item: Item) => item.contains.length
  ? `Contains ${item.contains.map((a) => allergenLabel[a]).join(', ')}`
  : 'None of the listed allergens';

function openItem(id: string, edit?: Line) {
  const item = byId[id];
  const dlg = $<HTMLDialogElement>('[data-item-dlg]');
  const opts = edit ? structuredClone(edit.opts) : defaults(item);
  let qty = edit?.qty ?? 1;
  const head = `
      <header class="er-dlg__head">
        <div class="er-dish" aria-hidden="true"><span></span></div>
        <div>
          <p class="er-kicker">${esc(categories.find((c) => c.id === item.cat)!.label)}</p>
          <h2 id="er-item-title">${esc(item.name)}</h2>
          <p>${esc(item.desc)}</p>
          <p class="er-meta">${item.tags.map((t) => `<span class="er-tag er-tag--${t}">${esc(tagLabel[t])}</span>`).join('')}</p>
          <p class="er-allergen"><b>Sample allergen info:</b> ${esc(containsText(item))}.</p>
          ${item.note ? `<p class="er-note">${esc(item.note)}</p>` : ''}
        </div>
        <button type="button" class="er-x" data-close aria-label="Close">×</button>
      </header>`;
  if (item.dineIn) {
    dlg.innerHTML = `<div class="er-dlg__in">${head}
      <div class="er-dlg__body"><p class="er-dinein">${esc(item.dineIn)} Book a table to order it at the restaurant.</p></div>
      <footer class="er-dlg__foot"><a class="er-btn er-btn--ember er-btn--grow" href="#reserve" data-book>Book a table</a><button class="er-btn er-btn--ghostdark" type="button" data-close>Close</button></footer></div>`;
    $$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
    // Closing returns focus to the dish first; then move on to reservations.
    $('[data-book]', dlg).addEventListener('click', (e) => {
      e.preventDefault();
      dlg.addEventListener('close', () => setTimeout(() => {
        $('#reserve').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
        $<HTMLElement>('[data-party]').focus({ preventScroll: true });
      }), { once: true });
      dlg.close();
    });
    if (!dlg.open) openDialog(dlg);
    return;
  }
  dlg.innerHTML = `
    <form method="dialog" class="er-dlg__in" data-item-form>
      ${head}
      <div class="er-dlg__body">
        ${(item.options ?? []).map((g) => `
          <fieldset class="er-opt">
            <legend>${esc(g.label)} <small>${g.required ? 'Required' : g.max ? `Up to ${g.max}` : 'Optional'}</small></legend>
            ${g.choices.map((c) => `
              <label class="er-choice"><input type="${g.type === 'one' ? 'radio' : 'checkbox'}" name="${g.id}" value="${c.id}" ${opts[g.id]?.includes(c.id) ? 'checked' : ''} />
                <span>${esc(c.label)}</span><em>${c.price ? '+' + money(c.price) : ''}</em></label>`).join('')}
          </fieldset>`).join('')}
        <label class="er-notes">Special instructions <small>(optional)</small><textarea name="note" rows="2" maxlength="140" placeholder="No basil, extra crispy, cut in squares">${esc(edit?.note ?? '')}</textarea></label>
      </div>
      <footer class="er-dlg__foot">
        <div class="er-stepper er-stepper--sm" role="group" aria-label="Quantity">
          <button type="button" data-q="-1" aria-label="One fewer">−</button><output data-qty aria-live="polite">${qty}</output><button type="button" data-q="1" aria-label="One more">+</button>
        </div>
        <button class="er-btn er-btn--ember er-btn--grow" type="submit" data-addbtn>${edit ? 'Update' : 'Add to order'} · <span data-price></span></button>
      </footer>
    </form>`;
  const form = $<HTMLFormElement>('[data-item-form]', dlg);
  const refresh = () => {
    for (const g of item.options ?? []) {
      opts[g.id] = $$<HTMLInputElement>(`input[name="${g.id}"]`, form).filter((i) => i.checked).map((i) => i.value);
      if (g.max) for (const i of $$<HTMLInputElement>(`input[name="${g.id}"]`, form)) i.disabled = !i.checked && opts[g.id].length >= g.max;
    }
    $('[data-qty]', form).textContent = String(qty);
    $<HTMLButtonElement>('[data-q="-1"]', form).disabled = qty <= 1;
    $<HTMLButtonElement>('[data-q="1"]', form).disabled = qty >= MAX_QTY;
    $('[data-price]', form).textContent = money(unitPrice(item, opts) * qty);
  };
  form.addEventListener('change', refresh);
  form.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-q]');
    if (b) { qty = clampQty(qty + Number(b.dataset.q)); refresh(); if ((b as HTMLButtonElement).disabled) $<HTMLElement>('[data-q]:not([disabled])', form).focus(); }
    if ((e.target as HTMLElement).closest('[data-close]')) dlg.close();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = addLine(item.id, opts, qty, (form.elements.namedItem('note') as HTMLTextAreaElement).value.trim(), edit?.key);
    dlg.close();
    if (edit) renderCart();
    if (!ok) toast(limitMsg, 'er-toast');
    else if (!edit) toast(`${qty} × ${item.name} added. Subtotal ${money(sum().sub)}.`, 'er-toast');
  });
  refresh();
  if (!dlg.open) openDialog(dlg);
}

/* ---------- cart dialog: order → details → summary ---------- */
let stage: 'cart' | 'checkout' | 'done' = 'cart';
let placed: { no: string; name: string; phone: string; when: string; lines: Line[]; t: ReturnType<typeof totals>; tip: number; utensils: boolean } | null = null;

function openCart() {
  const dlg = $<HTMLDialogElement>('[data-cart-dlg]');
  if (stage === 'done' && !placed) stage = 'cart';
  if (stage === 'checkout' && !cart.lines.length) stage = 'cart';
  renderCart();
  if (!dlg.open) openDialog(dlg);
}

const steps = () => `<ol class="er-steps" aria-label="Progress">${['Order', 'Details', 'Summary'].map((s, i) => `<li ${['cart', 'checkout', 'done'][i] === stage ? 'aria-current="step"' : ''}>${s}</li>`).join('')}</ol>`;
const totalsList = (t: ReturnType<typeof totals>, tipPct: number) => `<dl class="er-totals">
    <div><dt>Subtotal</dt><dd>${money(t.sub)}</dd></div>
    <div><dt>Sample tax (${Math.round(TAX * 100)}%)</dt><dd>${money(t.tax)}</dd></div>
    <div><dt>Tip${tipPct ? ` (${tipPct}%)` : ''}</dt><dd>${money(t.tip)}</dd></div>
    <div class="is-total"><dt>Total</dt><dd>${money(t.total)}</dd></div>
  </dl>`;

function renderCart() {
  const dlg = $<HTMLDialogElement>('[data-cart-dlg]');
  if (stage === 'done' && placed) return renderDone(dlg);
  const t = sum();
  const head = `<header class="er-sheet__head"><h2 id="er-cart-title">${stage === 'cart' ? 'Your pickup order' : 'Pickup details'}</h2>
    <button type="button" class="er-x" data-close aria-label="Close">×</button></header>`;
  if (!cart.lines.length) {
    stage = 'cart';
    dlg.innerHTML = `<div class="er-sheet">${head}<div class="er-sheet__empty"><div class="er-dish er-dish--empty" aria-hidden="true"><span></span></div>
      <p><b>Your order is empty.</b></p><p>Add dishes from the menu, then choose a pickup time.</p>
      <a class="er-btn er-btn--ember" href="#menu" data-close>Browse the menu</a></div></div>`;
    return;
  }
  const upsell = ['fries', 'skillet', 'soda'].filter((id) => !cart.lines.some((l) => l.id === id)).slice(0, 2);
  const body = stage === 'cart' ? `
      <p class="er-pickupnote">Pickup only. Sample prep time for ${plural(t.count, 'item')}: about ${prepMinutes(t.count)} minutes.</p>
      <ul class="er-lines" role="list">
        ${cart.lines.map((l) => { const it = byId[l.id]; const sumTxt = optSummary(it, l.opts); return `
          <li class="er-line">
            <div class="er-line__info"><b>${esc(it.name)}</b>${sumTxt ? `<small>${esc(sumTxt)}</small>` : ''}${l.note ? `<small class="er-line__note">Note: ${esc(l.note)}</small>` : ''}
              <small>${money(unitPrice(it, l.opts))} each</small>
              <span class="er-line__acts">${it.options?.length || l.note ? `<button type="button" class="er-linkbtn" data-edit="${l.key}">Edit<span class="er-vh"> ${esc(it.name)}</span></button>` : ''}
              <button type="button" class="er-linkbtn" data-remove="${l.key}">Remove<span class="er-vh"> ${esc(it.name)}</span></button></span></div>
            <div class="er-stepper er-stepper--sm" role="group" aria-label="Quantity of ${esc(it.name)}">
              <button type="button" data-line="${l.key}" data-d="-1" aria-label="One fewer ${esc(it.name)}" ${l.qty <= 1 ? 'disabled' : ''}>−</button>
              <output aria-live="polite">${l.qty}</output>
              <button type="button" data-line="${l.key}" data-d="1" aria-label="One more ${esc(it.name)}" ${l.qty >= MAX_QTY ? 'disabled' : ''}>+</button>
            </div>
            <span class="er-line__price">${money(lineTotal(l))}</span>
          </li>`; }).join('')}
      </ul>
      ${upsell.length ? `<div class="er-upsell"><p>Goes well with</p>${upsell.map((id) => `<button type="button" class="er-up" data-quickadd="${id}"><b>${esc(byId[id].name)}</b><span>Add · ${money(byId[id].price)}</span></button>`).join('')}</div>` : ''}
      <fieldset class="er-tip"><legend>Tip for the kitchen team <small>(optional)</small></legend>
        ${TIPS.map((p) => `<label><input type="radio" name="tip" value="${p}" ${cart.tip === p ? 'checked' : ''} data-tip /><span>${p ? p + '%' : 'None'}</span></label>`).join('')}
      </fieldset>`
    : checkoutBody(t.count);
  const canPlace = stage === 'checkout' && (asapTime(new Date(), t.count) !== null || pickupSlots(new Date(), t.count) !== null);

  dlg.innerHTML = `<div class="er-sheet">${head}${steps()}
    <div class="er-sheet__body">${body}</div>
    <footer class="er-sheet__foot">
      ${totalsList(t, cart.tip)}
      ${stage === 'cart'
        ? `<button class="er-btn er-btn--ember er-btn--block" type="button" data-go="checkout">Continue to pickup details</button>
           <p class="demo-note">Demo order: nothing is sent and no payment is taken.</p>`
        : `<div class="er-two"><button class="er-btn er-btn--ghostdark" type="button" data-go="cart">Back</button><button class="er-btn er-btn--ember er-btn--grow" type="submit" form="er-checkout" ${canPlace ? '' : 'disabled'}>Place demo order</button></div>
           <p class="demo-note">Nothing is sent to a restaurant and no payment is taken.</p>`}
    </footer></div>`;
}

function checkoutBody(count: number) {
  const now = new Date();
  const asap = asapTime(now, count);
  const later = pickupSlots(now, count);
  if (asap === null && !later) return `<p class="er-err">No pickup times are available in the next week. Try again later.</p>`;
  const dayLabel = later ? (later.today ? 'Today' : fmtDate(later.day, { weekday: 'long', month: 'short', day: 'numeric' })) : '';
  return `<form id="er-checkout" class="er-co" data-checkout novalidate>
    <fieldset class="er-when"><legend>Pickup time</legend>
      ${asap !== null ? `<label class="er-choice"><input type="radio" name="when" value="asap" checked /><span>As soon as it’s ready</span><em>about ${fmtTime(asap)}</em></label>` : `<p class="er-note">${orderingOpen(now) ? 'It’s too close to closing for an order now.' : 'Online ordering is closed right now.'} Choose a time for ${later!.today ? 'later today' : esc(dayLabel)}.</p>`}
      ${later ? `<label class="er-choice"><input type="radio" name="when" value="later" ${asap === null ? 'checked' : ''} /><span>Schedule</span>
        <select name="slot" aria-label="Pickup time, ${esc(dayLabel)}">${later.slots.map((m) => `<option value="${m}">${esc(dayLabel)}, ${fmtTime(m)}</option>`).join('')}</select></label>` : ''}
    </fieldset>
    <div class="er-two">
      <label>Name<input name="name" autocomplete="name" required aria-describedby="er-co-err" /></label>
      <label>Mobile<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(207) 555-0100" aria-describedby="er-co-hint er-co-err" /><small id="er-co-hint">A real restaurant would text you when it’s ready.</small></label>
    </div>
    <label class="er-check"><input type="checkbox" name="utensils" /> Add utensils and napkins</label>
    <div class="er-pay"><b>Payment</b><p>Pay at the counter when you pick up. This demo collects no payment details.</p></div>
    <p class="er-err" role="alert" id="er-co-err" data-co-err></p>
  </form>`;
}

function renderDone(dlg: HTMLDialogElement) {
  const p = placed!;
  dlg.innerHTML = `<div class="er-sheet">
    <header class="er-sheet__head"><h2 id="er-cart-title">Demo order summary</h2><button type="button" class="er-x" data-close aria-label="Close">×</button></header>
    ${steps()}
    <div class="er-sheet__body er-done" tabindex="-1">
      <p class="er-notsent"><b>Not sent.</b> This order exists only in your browser. No restaurant received it and no payment was taken.</p>
      <dl class="er-facts">
        <div><dt>Sample order number</dt><dd>${esc(p.no)}</dd></div>
        <div><dt>Pickup</dt><dd>${esc(p.when)}</dd></div>
        <div><dt>Name</dt><dd>${esc(p.name)}</dd></div>
        <div><dt>Mobile</dt><dd>${esc(p.phone)}</dd></div>
      </dl>
      <ul class="er-receipt" role="list">${p.lines.map((l) => { const it = byId[l.id]; const s = optSummary(it, l.opts); return `<li><span>${l.qty} × ${esc(it.name)}${s ? `<small>${esc(s)}</small>` : ''}${l.note ? `<small>Note: ${esc(l.note)}</small>` : ''}</span><span>${money(lineTotal(l))}</span></li>`; }).join('')}
        ${p.utensils ? '<li><span>Utensils and napkins</span><span>—</span></li>' : ''}</ul>
      ${totalsList(p.t, p.tip)}
      <div class="er-real"><h3>In a real restaurant’s system</h3>
        <ul>
          <li>The order would go to the restaurant’s order system and print in the kitchen.</li>
          <li>You would get a text or email confirming the pickup time.</li>
          <li>Staff would call if a dish had sold out.</li>
          <li>You would pay at the counter, and the order would be held for ${HOLD_MINUTES} minutes after the pickup time.</li>
        </ul></div>
    </div>
    <footer class="er-sheet__foot"><div class="er-two"><button class="er-btn er-btn--ghostdark" type="button" data-close>Close</button><button class="er-btn er-btn--ember er-btn--grow" type="button" data-neworder>Start a new order</button></div></footer></div>`;
}

function startCart() {
  const dlg = $<HTMLDialogElement>('[data-cart-dlg]');
  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
  const focusIn = (sel: string) => ($<HTMLElement>(sel, dlg) ?? $<HTMLElement>('.er-x', dlg)).focus();
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-close]')) return dlg.close();
    const line = t.closest<HTMLButtonElement>('[data-line]');
    if (line) {
      const l = cart.lines.find((x) => x.key === line.dataset.line)!;
      l.qty = clampQty(l.qty + Number(line.dataset.d));
      save(); updateBadges(); renderCart();
      const same = $<HTMLButtonElement>(`[data-line="${l.key}"][data-d="${line.dataset.d}"]`, dlg);
      (same && !same.disabled ? same : $<HTMLElement>(`[data-line="${l.key}"]:not([disabled])`, dlg)).focus();
      return;
    }
    const rm = t.closest<HTMLElement>('[data-remove]');
    if (rm) {
      const i = cart.lines.findIndex((x) => x.key === rm.dataset.remove);
      const [l] = cart.lines.splice(i, 1);
      save(); updateBadges(); renderCart();
      toast(`${byId[l.id].name} removed.`, 'er-toast');
      const next = $$<HTMLElement>('[data-remove]', dlg);
      (next[Math.min(i, next.length - 1)] ?? $<HTMLElement>('.er-x', dlg)).focus();
      return;
    }
    const edit = t.closest<HTMLElement>('[data-edit]');
    if (edit) { const l = cart.lines.find((x) => x.key === edit.dataset.edit)!; return openItem(l.id, l); }
    const qa = t.closest<HTMLElement>('[data-quickadd]');
    if (qa) {
      const it = byId[qa.dataset.quickadd!];
      addLine(it.id, defaults(it), 1, ''); renderCart(); focusIn('[data-quickadd]');
      toast(`${it.name} added.`, 'er-toast');
      return;
    }
    const go = t.closest<HTMLElement>('[data-go]');
    if (go) { stage = go.dataset.go as typeof stage; renderCart(); focusIn(stage === 'checkout' ? '.er-co input, .er-co select' : '[data-go]'); return; }
    if (t.closest('[data-neworder]')) { placed = null; stage = 'cart'; dlg.close(); document.getElementById('menu')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); }
  });
  dlg.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-tip]')) { cart.tip = Number(t.value); save(); updateBadges(); renderCart(); $<HTMLElement>(`[data-tip][value="${cart.tip}"]`, dlg).focus(); }
    if (t.name === 'slot') $<HTMLInputElement>('input[name="when"][value="later"]', dlg).checked = true;
  });
  dlg.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-checkout]')) return;
    e.preventDefault();
    const name = $<HTMLInputElement>('[name="name"]', form);
    const phone = $<HTMLInputElement>('[name="phone"]', form);
    const problems: [HTMLInputElement, string][] = [];
    if (!name.value.trim()) problems.push([name, 'your name']);
    if (!validPhone(phone.value)) problems.push([phone, 'a 10-digit mobile number']);
    $$('input', form).forEach((i) => i.removeAttribute('aria-invalid'));
    if (problems.length) {
      problems.forEach(([i]) => i.setAttribute('aria-invalid', 'true'));
      $('[data-co-err]', form).textContent = `Please add ${problems.map((p) => p[1]).join(' and ')}.`;
      problems[0][0].focus();
      return;
    }
    const fd = new FormData(form);
    const now = new Date();
    const t = sum();
    const asap = fd.get('when') === 'asap' ? asapTime(now, t.count) : null;
    const later = pickupSlots(now, t.count);
    if (asap === null && !later) { $('[data-co-err]', form).textContent = 'That pickup time is no longer available. Go back and try again.'; return; }
    const slot = Number(fd.get('slot'));
    const when = asap !== null
      ? `Today, about ${fmtTime(asap)}`
      : `${later!.today ? 'Today' : fmtDate(later!.day, { weekday: 'long', month: 'short', day: 'numeric' })}, ${fmtTime(later!.slots.includes(slot) ? slot : later!.slots[0])}`;
    placed = {
      no: `ER-${String(1000 + Math.floor(Math.random() * 9000))}`, name: name.value.trim(), phone: phone.value.trim(), when,
      lines: cart.lines, t, tip: cart.tip, utensils: fd.get('utensils') === 'on',
    };
    cart = { ...cart, lines: [] };
    save(); updateBadges();
    stage = 'done';
    renderCart();
    $<HTMLElement>('.er-done', dlg).focus();
  });
}

/* ---------- reservations ---------- */
const RES_KEY = 'ember-rye-res-v2';
// Only date, time and party size are kept (sessionStorage, this tab only), so a
// booked time shows as taken. Names and contact details are never stored.
const session = {
  get(): Booking[] { try { return JSON.parse(sessionStorage.getItem(RES_KEY) ?? '[]') as Booking[]; } catch { return []; } },
  set(v: Booking[]) { try { sessionStorage.setItem(RES_KEY, JSON.stringify(v)); } catch { /* storage unavailable: bookings last until reload */ } },
};
const longDate = (d: Date) => fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' });
const shortDate = (d: Date) => fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' });

function startReservations() {
  const form = $<HTMLFormElement>('[data-resform]');
  const details = $('[data-resdetails]', form);
  const detailsHtml = details.innerHTML;
  const grid = $('[data-cal-grid]', form);
  const timesEl = $('[data-times]', form);
  let mine = session.get().filter((b) => fromKey(b.date) >= startOf(new Date()));
  // Looked up each time: `details` is re-rendered after a booking.
  const ui = () => ({ sum: $('[data-ressum]', details), err: $('[data-res-err]', details) });

  const now = () => new Date();
  const first = startOf(now());
  const last = new Date(first.getFullYear(), first.getMonth(), first.getDate() + BOOKING_DAYS - 1);
  const res = { party: 2, day: nextOpenDay(first, 2, now(), mine) as Date | null, time: null as number | null, note: '' };
  let view = new Date((res.day ?? first).getFullYear(), (res.day ?? first).getMonth(), 1);
  let focusKey = dateKey(res.day ?? first);

  const dayLabel = (d: Date, st: DayState) => {
    const own = mine.find((b) => b.date === dateKey(d));
    return `${longDate(d)}${own ? ', your demo reservation' : { open: '', full: `, fully booked for ${res.party}`, closed: ', closed', past: ', no more times today', beyond: '' }[st]}`;
  };
  const renderCal = () => {
    const y = view.getFullYear(), m = view.getMonth();
    $('[data-cal-title]', form).textContent = fmtDate(view, { month: 'long', year: 'numeric' });
    $<HTMLButtonElement>('[data-month="-1"]', form).disabled = y * 12 + m <= first.getFullYear() * 12 + first.getMonth();
    $<HTMLButtonElement>('[data-month="1"]', form).disabled = y * 12 + m >= last.getFullYear() * 12 + last.getMonth();
    const lead = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const cells = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => `<span class="er-cal__wd" aria-hidden="true">${w}</span>`);
    for (let i = 0; i < lead; i++) cells.push('<span aria-hidden="true"></span>');
    for (let n = 1; n <= count; n++) {
      const d = new Date(y, m, n);
      const key = dateKey(d);
      if (d < first || d > last) { cells.push(`<span class="er-cal__out" aria-hidden="true">${n}</span>`); continue; }
      const st = dayState(d, res.party, now(), mine);
      const own = mine.some((b) => b.date === key);
      const picked = !!res.day && dateKey(res.day) === key;
      cells.push(`<button type="button" class="er-cal__day is-${st}${own ? ' is-mine' : ''}" data-date="${key}" aria-pressed="${picked}" ${st === 'open' ? '' : 'aria-disabled="true"'} tabindex="${key === focusKey ? 0 : -1}" aria-label="${esc(dayLabel(d, st))}">${n}</button>`);
    }
    grid.innerHTML = cells.join('');
    if (!grid.querySelector('[tabindex="0"]')) grid.querySelector<HTMLElement>('.er-cal__day')?.setAttribute('tabindex', '0');
  };

  const renderTimes = () => {
    const d = res.day;
    if (!d) { timesEl.innerHTML = '<p class="er-note">Choose a date to see times.</p>'; return; }
    const st = dayState(d, res.party, now(), mine);
    const nextBtn = () => {
      const n = nextOpenDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), res.party, now(), mine);
      return n ? ` <button type="button" class="er-linkbtn" data-goto="${dateKey(n)}">Next available: ${esc(shortDate(n))}</button>` : '';
    };
    const own = mine.find((b) => b.date === dateKey(d));
    if (own) { res.time = null; timesEl.innerHTML = `<p class="er-note">You already have a demo reservation on ${esc(shortDate(d))} at ${fmtTime(own.time)}.</p>`; return; }
    if (st === 'closed') { res.time = null; timesEl.innerHTML = `<p class="er-note">We’re closed on ${dayNames[d.getDay()]}s.${nextBtn()}</p>`; return; }
    const slots = seatings(d).map((t) => ({ t, s: slotState(d, t, res.party, now(), mine) })).filter((x) => x.s !== 'past');
    if (!slots.length) { res.time = null; timesEl.innerHTML = `<p class="er-note">No more times today.${nextBtn()}</p>`; return; }
    if (res.time !== null && slots.find((x) => x.t === res.time)?.s !== 'open') {
      res.note = `${fmtTime(res.time)} is full for ${plural(res.party, 'guest')}. Choose another time.`;
      res.time = null;
    }
    const full = st === 'full';
    timesEl.innerHTML = slots.map(({ t, s }) => `<button type="button" role="radio" class="er-time" data-time="${t}" aria-checked="${t === res.time}" tabindex="-1" ${s === 'open' ? '' : 'aria-disabled="true"'} aria-label="${fmtTime(t)}${s === 'open' ? '' : ', full'}">${fmtTime(t).replace(' ', '')}${s === 'open' ? '' : '<small>Full</small>'}</button>`).join('')
      + (full ? `<p class="er-note">Every time is full for ${plural(res.party, 'guest')} on ${esc(shortDate(d))}.${nextBtn()}</p>` : '');
    const tab = timesEl.querySelector<HTMLElement>('[aria-checked="true"]') ?? timesEl.querySelector<HTMLElement>('.er-time:not([aria-disabled])');
    tab?.setAttribute('tabindex', '0');
  };

  const renderSummary = () => {
    const { sum } = ui();
    if (!sum) return;
    const p = bookingProblem(res.day, res.time, res.party, now(), mine);
    sum.innerHTML = !p
      ? `<b>${esc(longDate(res.day!))}</b> at <b>${fmtTime(res.time!)}</b><br />${plural(res.party, 'guest')}`
      : esc(res.note || p);
    res.note = '';
  };
  const all = () => { renderCal(); renderTimes(); renderSummary(); };

  const selectDay = (d: Date) => {
    res.day = d; res.time = null; focusKey = dateKey(d);
    if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1);
    all();
  };
  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (b) { selectDay(fromKey(b.dataset.date!)); $<HTMLElement>(`[data-date="${b.dataset.date}"]`, grid).focus(); }
  });
  grid.addEventListener('keydown', (e) => {
    const k = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>)[e.key];
    const cur = (e.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (!k || !cur) return;
    e.preventDefault();
    const d = fromKey(cur.dataset.date!);
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
    if (to < first || to > last) return;
    focusKey = dateKey(to);
    view = new Date(to.getFullYear(), to.getMonth(), 1);
    renderCal();
    $<HTMLElement>(`[data-date="${focusKey}"]`, grid).focus();
  });
  $$<HTMLButtonElement>('[data-month]', form).forEach((b) => b.addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() + Number(b.dataset.month), 1);
    const inView = (d: Date) => d.getMonth() === view.getMonth() && d >= first && d <= last;
    focusKey = dateKey(res.day && inView(res.day) ? res.day : [...Array(31)].map((_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)).find(inView)!);
    renderCal();
    (b.disabled ? $<HTMLElement>(`[data-month="${-Number(b.dataset.month)}"]`, form) : b).focus();
  }));

  timesEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const go = t.closest<HTMLElement>('[data-goto]');
    if (go) { selectDay(fromKey(go.dataset.goto!)); $<HTMLElement>(`[data-date="${go.dataset.goto}"]`, grid).focus(); return; }
    const b = t.closest<HTMLElement>('[data-time]');
    if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') { ui().sum.textContent = `${fmtTime(Number(b.dataset.time))} is full for ${plural(res.party, 'guest')}. Choose another time.`; return; }
    res.time = Number(b.dataset.time); renderTimes(); renderSummary();
    $<HTMLElement>(`[data-time="${res.time}"]`, timesEl).focus();
  });
  timesEl.addEventListener('keydown', (e) => {
    const items = $$<HTMLElement>('.er-time:not([aria-disabled])', timesEl);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const k = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    if (!k || i < 0) return;
    e.preventDefault();
    items[(i + k + items.length) % items.length].click();
  });

  const partyOut = $('[data-party-out]', form);
  const partyBtns = $$<HTMLButtonElement>('[data-party]', form);
  const renderParty = () => {
    partyOut.textContent = plural(res.party, 'guest');
    partyBtns.forEach((b) => (b.disabled = Number(b.dataset.party) < 0 ? res.party <= 1 : res.party >= MAX_PARTY));
    $('[data-party-note]', form).hidden = res.party < MAX_PARTY;
  };
  partyBtns.forEach((b) => b.addEventListener('click', () => {
    res.party = Math.max(1, Math.min(MAX_PARTY, res.party + Number(b.dataset.party)));
    renderParty(); all();
    if (b.disabled) partyBtns.find((x) => x !== b)!.focus();
  }));

  const restore = (message = '') => {
    form.classList.remove('is-done');
    details.innerHTML = detailsHtml;
    all();
    if (message) ui().sum.textContent = message;
  };
  details.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-res-again]')) { restore(); $<HTMLElement>('[data-date][tabindex="0"]', grid).focus(); }
    const cancel = t.closest<HTMLElement>('[data-res-cancel]');
    if (cancel) {
      mine = mine.filter((b) => b.ref !== cancel.dataset.resCancel);
      session.set(mine);
      restore('Demo reservation cancelled. That time is free again.');
      $<HTMLElement>('[data-date][tabindex="0"]', grid).focus();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.classList.contains('is-done')) return;
    const { err } = ui();
    const field = (n: string) => $<HTMLInputElement>(`[name="${n}"]`, details);
    const name = field('name'), phone = field('phone'), email = field('email');
    [name, phone, email].forEach((i) => i.removeAttribute('aria-invalid'));
    const p = bookingProblem(res.day, res.time, res.party, now(), mine);
    if (p) { err.textContent = p; all(); ($<HTMLElement>('.er-time[tabindex="0"]', timesEl) ?? $<HTMLElement>('[data-date][tabindex="0"]', grid)).focus(); return; }
    const problems: [HTMLInputElement, string][] = [];
    if (!name.value.trim()) problems.push([name, 'your name']);
    if (!validPhone(phone.value)) problems.push([phone, 'a 10-digit mobile number']);
    if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) problems.push([email, 'a valid email address, or leave it blank']);
    if (problems.length) {
      problems.forEach(([i]) => i.setAttribute('aria-invalid', 'true'));
      err.textContent = `Please add ${problems.map((x) => x[1]).join(' and ')}.`;
      problems[0][0].focus();
      return;
    }
    const d = res.day!, time = res.time!;
    const b: Booking = { date: dateKey(d), time, party: res.party, ref: `ER-${Math.random().toString(36).slice(2, 7).toUpperCase()}` };
    mine = [...mine, b];
    session.set(mine);
    const notes = String(new FormData(form).get('notes') ?? '').trim();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(time / 60), time % 60);
    form.classList.add('is-done');
    details.innerHTML = `<div class="er-confirm" tabindex="-1">
      <p class="er-kicker">Demo reservation · not sent</p><h3>Reservation summary</h3>
      <dl class="er-facts">
        <div><dt>Date</dt><dd>${esc(longDate(d))}</dd></div>
        <div><dt>Time</dt><dd>${fmtTime(time)}</dd></div>
        <div><dt>Guests</dt><dd>${res.party}</dd></div>
        <div><dt>Name</dt><dd>${esc(name.value.trim())}</dd></div>
        <div><dt>Mobile</dt><dd>${esc(phone.value.trim())}</dd></div>
        ${email.value.trim() ? `<div><dt>Email</dt><dd>${esc(email.value.trim())}</dd></div>` : ''}
        ${notes ? `<div><dt>Requests</dt><dd>${esc(notes)}</dd></div>` : ''}
        <div><dt>Sample reference</dt><dd>${b.ref}</dd></div>
      </dl>
      <p class="er-notsent">Nothing was sent to a restaurant, and no text or email went out. Your name and contact details aren’t saved.</p>
      <div class="er-real"><h3>With a real restaurant</h3><ul>
        <li>The booking would appear in the restaurant’s reservation list.</li>
        <li>You’d get a confirmation text or email with a link to change or cancel.</li>
        <li>The table would be held for ${TABLE_HOLD} minutes after ${fmtTime(time)}.</li>
      </ul></div>
      <button class="er-btn er-btn--ember er-btn--block" type="button" data-ics>Add to calendar</button>
      <div class="er-two"><button class="er-btn er-btn--ghostdark" type="button" data-res-cancel="${b.ref}">Cancel this reservation</button><button class="er-btn er-btn--ghostdark" type="button" data-res-again>Make another</button></div>
    </div>`;
    $('[data-ics]', details).addEventListener('click', () => downloadIcs({ title: 'Dinner at Ember & Rye (concept demo, not a real booking)', start, minutes: 105, location: '14 Wharf Lane, Port Alder (fictional)', description: `Demo only. ${plural(b.party, 'guest')}. ${b.ref}`, file: 'ember-and-rye-demo.ics' }));
    res.time = null;
    renderCal(); renderTimes();
    $<HTMLElement>('.er-confirm', details).focus();
  });

  renderParty();
  all();
}

const PRESSABLE = '.er-btn, .er-cartbtn, .er-floatcart, .er-quick, .er-item__open, .er-chip, .er-cats a, .er-x, .er-stepper button, .er-cal__day, .er-cal__nav, .er-time, .er-tip label, .er-up, .er-choice, .er-check';

export function start() {
  pressFeedback(PRESSABLE);
  renderStatus();
  setInterval(renderStatus, 60000);
  updateBadges();
  startMenu();
  startCart();
  startReservations();
  startDemoForms();
  // Keep the cart in sync across tabs.
  addEventListener('storage', (e) => { if (e.key === KEY) { cart = store.get<Cart>(KEY, cart); updateBadges(); } });
}
