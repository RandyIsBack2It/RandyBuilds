// "Explore what's possible": turns the server-rendered question fieldsets into
// one question per screen, then shows the results from content/explore.ts.
// Answers stay in this tab (sessionStorage) and are sent only if the visitor
// submits the contact form below the results.
import { serviceBySlug } from '../content/services';
import { demoBySlug } from '../content/demos';
import { fillSummary, revealSummary } from './contact';
import { activeSteps, prune, recommend, isUnsure, summarize, labelOf, steps, type Answers, type StepId } from '../content/explore';

const KEY = 'rbt-explore';
const SHARE_URL = new URL('/explore/', location.origin).href;

type State = { answers: Answers; at: StepId | 'results' };

const load = (): State | null => {
  try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && typeof s === 'object' && s.answers ? s : null; }
  catch { return null; }
};
const save = (s: State) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: progress isn't kept */ } };
const forget = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

const el = <T extends HTMLElement>(tag: string, cls?: string, text?: string) => {
  const e = document.createElement(tag) as T;
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function startExplore() {
  const root = document.querySelector<HTMLElement>('[data-explore]');
  const form = root?.querySelector<HTMLFormElement>('form.xp');
  if (!root || !form) return;
  const page = root.closest<HTMLElement>('.explore')!;
  const fieldsets = new Map([...form.querySelectorAll<HTMLFieldSetElement>('fieldset[data-step]')].map((f) => [f.dataset.step as StepId, f]));
  const count = root.querySelector<HTMLElement>('.xp__count')!;
  const bar = root.querySelector<HTMLElement>('.xp__bar span')!;
  const back = form.querySelector<HTMLButtonElement>('[data-back]')!;
  const next = form.querySelector<HTMLButtonElement>('[data-next]')!;
  const results = root.querySelector<HTMLElement>('.xp__results')!;
  const inquiry = document.querySelector<HTMLElement>('.xp__inquiry')!;
  const summary = inquiry.querySelector<HTMLTextAreaElement>('#cf-summary')!;

  let state: State = { answers: {}, at: 'stage' };

  root.querySelector('.xp__nojs')?.remove();
  form.hidden = false;
  root.querySelector<HTMLElement>('.xp__progress')!.hidden = false;

  const read = (id: StepId) => [...fieldsets.get(id)!.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
  const write = (a: Answers) => {
    for (const [id, f] of fieldsets) for (const i of f.querySelectorAll<HTMLInputElement>('input')) i.checked = a[id]?.includes(i.value) ?? false;
    for (const id of fieldsets.keys()) limit(id);
  };

  // Checkbox groups: at most `max` choices; "not sure" stands alone.
  const limit = (id: StepId) => {
    const step = steps.find((s) => s.id === id)!;
    if (!step.max) return;
    const inputs = [...fieldsets.get(id)!.querySelectorAll<HTMLInputElement>('input')];
    const n = inputs.filter((i) => i.checked).length;
    for (const i of inputs) i.disabled = !i.checked && n >= step.max;
    const left = fieldsets.get(id)!.querySelector<HTMLElement>('.xp__limit');
    if (left) left.textContent = n >= step.max ? `${step.max} of ${step.max} chosen. Clear one to pick another.` : '';
  };
  form.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.name as StepId;
    const step = steps.find((s) => s.id === id);
    if (step?.exclusive && input.checked) {
      for (const i of fieldsets.get(id)!.querySelectorAll<HTMLInputElement>('input')) {
        if (i !== input && (input.value === step.exclusive || i.value === step.exclusive)) i.checked = false;
      }
    }
    limit(id);
    clearError(id);
    state.answers = prune({ ...state.answers, [id]: read(id) });
    save(state);
  });

  const errorOf = (id: StepId) => fieldsets.get(id)!.querySelector<HTMLElement>('.xp__error')!;
  const clearError = (id: StepId) => { errorOf(id).hidden = true; };

  const show = (at: State['at'], focus = true) => {
    state.at = at;
    save(state);
    const list = activeSteps(state.answers);
    for (const [id, f] of fieldsets) f.hidden = id !== at;
    const done = at === 'results';
    form.hidden = done;
    results.hidden = !done;
    page.classList.toggle('is-results', done);
    if (!done) inquiry.hidden = true;
    const i = done ? list.length : list.findIndex((s) => s.id === at);
    count.textContent = done ? 'Your results' : `Question ${i + 1} of ${list.length}`;
    bar.style.transform = `scaleX(${done ? 1 : (i + 1) / (list.length + 1)})`;
    back.hidden = i === 0;
    next.textContent = i === list.length - 1 ? 'See ideas' : 'Continue';
    if (done) renderResults();
    if (focus) {
      const target = done ? results.querySelector<HTMLElement>('h2')! : fieldsets.get(at as StepId)!.querySelector<HTMLElement>('.xp__q')!;
      target.focus({ preventScroll: true });
      // Keep the question in view on small screens, under the fixed header.
      const top = (done ? results : root).getBoundingClientRect().top;
      if (top < 72 || top > innerHeight * 0.5) scrollTo({ top: scrollY + top - 88, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = state.at as StepId;
    const value = read(id);
    if (!value.length) {
      const err = errorOf(id);
      err.hidden = false;
      fieldsets.get(id)!.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
      return;
    }
    state.answers = prune({ ...state.answers, [id]: value });
    const list = activeSteps(state.answers);
    const i = list.findIndex((s) => s.id === id);
    show(list[i + 1]?.id ?? 'results');
  });
  back.addEventListener('click', () => {
    const list = activeSteps(state.answers);
    const i = list.findIndex((s) => s.id === state.at);
    if (i > 0) show(list[i - 1].id);
  });

  const renderResults = () => {
    const found = recommend(state.answers);
    const cards = results.querySelector<HTMLElement>('.xp__recs')!;
    cards.replaceChildren(...found.map(({ rec, why }) => {
      const li = el<HTMLLIElement>('li', 'xp__rec');
      li.dataset.rec = rec.id;
      const h = el('h3', '', rec.title);
      const what = el('p', 'xp__what', rec.what);
      const dl = el<HTMLDListElement>('dl');
      for (const [term, text] of [['Why it may fit', why], ['What it could help with', rec.helps], ['For example', rec.example]]) {
        const div = el('div');
        div.append(el('dt', '', term), el('dd', '', text));
        dl.append(div);
      }
      const more = el<HTMLAnchorElement>('a', 'textlink', `More about ${serviceBySlug[rec.service].short.toLowerCase()}`);
      more.href = `/services/${rec.service}/`;
      li.append(h, what, dl, more);
      const demo = rec.demo && demoBySlug[rec.demo];
      if (demo) {
        const ex = el<HTMLAnchorElement>('a', 'textlink', `See a working example: ${demo.title}`);
        ex.href = demo.url;
        li.append(ex);
      }
      return li;
    }));
    results.querySelector<HTMLElement>('.xp__unsure')!.hidden = !isUnsure(state.answers);

    // Your answers, each with a way back to change it.
    const list = results.querySelector<HTMLElement>('.xp__answers')!;
    list.replaceChildren(...activeSteps(state.answers).map((s) => {
      const li = el('li');
      const text = el('div');
      text.append(el('span', 'xp__answers-q', s.question), el('span', 'xp__answers-a', (state.answers[s.id] ?? []).map((v) => labelOf(s.id, v)).join(', ')));
      const change = el<HTMLButtonElement>('button', 'xp__change', 'Change');
      change.type = 'button';
      change.setAttribute('aria-label', `Change your answer to: ${s.question}`);
      change.addEventListener('click', () => show(s.id));
      li.append(text, change);
      return li;
    }));

    // Keeps the visitor's own edits to the summary; otherwise refreshes it.
    fillSummary(summarize(state.answers, found));
  };

  results.querySelector('[data-talk]')!.addEventListener('click', () => {
    revealSummary({ label: 'Your own words', hint: 'Anything else you’d like me to know. Optional while your answers are included.' });
    inquiry.hidden = false;
    const h = inquiry.querySelector<HTMLElement>('h2')!;
    h.focus({ preventScroll: true });
    h.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  results.querySelector('[data-restart]')!.addEventListener('click', () => {
    state = { answers: {}, at: 'stage' };
    forget();
    write({});
    summary.value = '';
    delete summary.dataset.filled;
    for (const id of fieldsets.keys()) clearError(id);
    show('stage');
  });

  // Shares the tool's address only, never the answers.
  const share = results.querySelector<HTMLButtonElement>('[data-share]')!;
  const shareStatus = results.querySelector<HTMLElement>('.xp__share-status')!;
  share.addEventListener('click', async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Explore what’s possible', url: SHARE_URL });
        return;
      }
      await navigator.clipboard.writeText(SHARE_URL);
      shareStatus.textContent = 'Link copied. It opens the questions, not your answers.';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      shareStatus.textContent = `Copy this link: ${SHARE_URL}`;
    }
  });

  // Start: saved progress in this tab, or a first answer chosen on the home page.
  const saved = load();
  const first = new URLSearchParams(location.search).get('start');
  if (saved) {
    state = { answers: prune(saved.answers), at: saved.at };
    const valid = state.at === 'results' || activeSteps(state.answers).some((s) => s.id === state.at);
    if (!valid) state.at = 'stage';
  } else if (first && steps[0].options.some((o) => o.value === first)) {
    state = { answers: { stage: [first] }, at: 'start' };
  }
  if (first) history.replaceState(null, '', location.pathname);
  write(state.answers);
  // Results need every question answered; otherwise resume at the first gap.
  if (state.at === 'results' && activeSteps(state.answers).some((s) => !state.answers[s.id]?.length)) state.at = 'stage';
  show(state.at, Boolean(first));
}
