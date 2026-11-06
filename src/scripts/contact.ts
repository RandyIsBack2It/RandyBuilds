// Progressive enhancement for the contact form. Without JavaScript the form
// posts normally and the mailer redirects to /message-sent/ or /message-not-sent/.
import { site } from '../site';

// Keep in step with MESSAGES in mailer/server.mjs.
const MESSAGES: Record<string, string> = {
  name: 'Enter your name.',
  email: 'Enter an email address I can reply to.',
  site: 'Enter the full address, starting with https://, or leave it blank.',
  message: 'Tell me a little about your project.',
  resource: 'Enter the resource’s full address, starting with https://.',
  listing: 'Choose the listing this is about.',
  about: 'Add a sentence or two about it.',
};
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]+$/i;
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const FAILED = `Your message didn’t send. Try again, or email ${site.contact.email}.`;
const LIMITED = `Too many messages from here in the last hour. Please email ${site.contact.email} instead.`;
const TOO_FAST = 'That was quick. Please wait a moment, then send it again.';
const CHALLENGE = `The spam check didn’t pass. Try again, or email ${site.contact.email}.`;
const NO_CHALLENGE = `The spam check didn’t load. Reload the page, or email ${site.contact.email}.`;
// Why there was no Turnstile token, each with its own message.
const NO_TOKEN: Record<string, string> = {
  missing: NO_CHALLENGE,
  interactive: 'Tick the box above Send to finish the spam check, then send again.',
  error: `The spam check couldn’t verify this browser. Send again, try another browser, or email ${site.contact.email}.`,
  slow: `The spam check is taking longer than usual. Wait a moment and send again, or email ${site.contact.email}.`,
};

/** Shows a status message; the email address in it becomes a tappable mailto: link. */
function say(el: HTMLElement, text: string) {
  const email = site.contact.email;
  const [before, ...after] = text.split(email);
  if (!after.length) { el.textContent = text; return; }
  const a = document.createElement('a');
  a.href = `mailto:${email}`;
  a.textContent = email;
  el.replaceChildren(before, a, after.join(email));
}

// Cloudflare Turnstile. The script loads only when a form comes near the screen,
// so pages without one, and the top of the home page, never fetch it. The widget
// stays invisible unless Cloudflare needs the visitor to click. It adds the token
// to the form as `cf-turnstile-response`; the mailer verifies it with the secret.
// Cloudflare's documented test key (always passes) on localhost.
type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  getResponse: (id: string) => string | undefined;
  reset: (id: string) => void;
};
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const siteKey = local ? '1x00000000000000000000AA' : site.turnstileSiteKey;
let turnstileScript: Promise<Turnstile> | null = null;
function loadTurnstile() {
  turnstileScript ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => {
      const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (t) return resolve(t);
      turnstileScript = null;
      reject(new Error('turnstile'));
    };
    s.onerror = () => { turnstileScript = null; reject(new Error('turnstile')); };
    document.head.append(s);
  });
  return turnstileScript;
}

/** Renders the widget near the form's button once the form is close to the screen.
    `token()` waits (up to 15 s) for a token, or returns '' at once when the visitor
    has to tick the box; `problem()` then says why there is none. `reset()` gets a
    fresh token after one was used. */
function startTurnstile(form: HTMLFormElement) {
  if (!siteKey) return null;
  const box = document.createElement('div');
  // Takes no room (not even the form's gap) unless Cloudflare asks the visitor to click.
  box.className = 'cform__turnstile is-idle';
  form.querySelector('.cform__actions')!.before(box);
  let id: string | null = null, api: Turnstile | null = null;
  // loading: no answer yet · ready: a token was issued · interactive: waiting for the
  // visitor to tick the box · error: the check failed or this browser is unsupported ·
  // missing: the script didn't load.
  let state: 'loading' | 'ready' | 'interactive' | 'error' | 'missing' = 'loading';
  let waiters: ((t: string) => void)[] = [];
  const settle = (t: string) => { const w = waiters; waiters = []; w.forEach((f) => f(t)); };
  const fail = (code: unknown) => {
    state = 'error';
    console.warn('[spam check] Turnstile error', code);   // so a screenshot or report names the cause
    settle('');
  };
  const render = () => loadTurnstile().then((t) => {
    if (id !== null) return;
    api = t;
    id = t.render(box, {
      sitekey: siteKey, theme: 'dark', size: 'flexible', appearance: 'interaction-only',
      action: form.querySelector('[name="kind"]') ? 'resource' : 'contact',
      callback: (token: string) => { state = 'ready'; settle(token); },
      'error-callback': (code: string) => fail(code),
      'unsupported-callback': () => fail('unsupported'),
      // Turnstile refreshes an expired token itself (refresh-expired: auto); wait for the new one.
      'expired-callback': () => { state = 'loading'; },
      'before-interactive-callback': () => {
        state = 'interactive';
        box.classList.remove('is-idle');
        settle('');   // a Send that is waiting now asks the visitor to tick the box
      },
      'after-interactive-callback': () => box.classList.add('is-idle'),
    });
  }).catch(() => { state = 'missing'; settle(''); });
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); render(); } }, { rootMargin: '600px' });
  io.observe(form);
  form.addEventListener('focusin', () => { io.disconnect(); render(); }, { once: true });
  return {
    token: () => {
      const now = id !== null && api ? api.getResponse(id) : undefined;
      if (now) return Promise.resolve(now);
      if (state === 'interactive') return Promise.resolve('');
      if (id === null) { state = 'loading'; render(); }                   // first try, or load the script again
      else if (state === 'error') { state = 'loading'; api!.reset(id); }  // run a failed check again
      return new Promise<string>((resolve) => { waiters.push(resolve); setTimeout(() => resolve(''), 15000); });
    },
    /** Why `token()` gave none: a key of NO_TOKEN. */
    problem: () => (id === null ? 'missing' : state === 'interactive' || state === 'error' ? state : 'slow'),
    /** The box, when it's waiting for the visitor to tick it. */
    box: () => (state === 'interactive' ? box : null),
    reset: () => { if (id !== null && api) { state = 'loading'; api.reset(id); } },
  };
}

function check(fd: FormData) {
  const v = (k: string) => String(fd.get(k) ?? '').trim();
  const errors: Record<string, string> = {};
  if (!v('name')) errors.name = MESSAGES.name;
  if (!EMAIL_RE.test(v('email'))) errors.email = MESSAGES.email;
  if (v('site') && !URL_RE.test(v('site'))) errors.site = MESSAGES.site;
  // The resource form (/resources/suggest/): a suggestion needs its address, a report its listing.
  const kind = v('kind');
  if (kind === 'resource' && !URL_RE.test(v('resource'))) errors.resource = MESSAGES.resource;
  if (kind === 'report' && !v('listing')) errors.listing = MESSAGES.listing;
  // With answers from the Explore tool included, the visitor's own words are optional.
  if (!v('summary') && v('message').length < 10) errors.message = kind ? MESSAGES.about : MESSAGES.message;
  return errors;
}

export function startContactForm() {
  const form = document.querySelector<HTMLFormElement>('form[data-contact]');
  if (!form) return;
  form.noValidate = true;
  (form.elements.namedItem('t') as HTMLInputElement).value = String(Date.now());
  // Time on the page, measured on this device: unaffected by its clock being off.
  const loaded = performance.now();
  prefillTopic(form);
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = button.textContent;
  const status = form.querySelector<HTMLElement>('.cform__status')!;
  const turnstile = startTurnstile(form);

  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const clearErrors = () => {
    form.querySelectorAll('.field__error').forEach((e) => e.remove());
    form.querySelectorAll('[aria-invalid]').forEach((el) => {
      el.removeAttribute('aria-invalid');
      const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter((id) => !id.endsWith('-error'));
      ids.length ? el.setAttribute('aria-describedby', ids.join(' ')) : el.removeAttribute('aria-describedby');
    });
  };
  const showErrors = (errors: Record<string, string>) => {
    let first: HTMLElement | null = null;
    for (const [name, msg] of Object.entries(errors)) {
      const el = field(name);
      if (!el) continue;
      const id = `${el.id}-error`;
      const p = document.createElement('p');
      p.className = 'field__error';
      p.id = id;
      p.textContent = msg;
      el.insertAdjacentElement('afterend', p);
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), id].filter(Boolean).join(' '));
      first ??= el;
    }
    first?.focus();
  };

  // Clear a field's error as soon as it's corrected.
  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.getAttribute('aria-invalid') && !check(new FormData(form))[el.name]) {
      document.getElementById(`${el.id}-error`)?.remove();
      el.removeAttribute('aria-invalid');
      const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter((id) => !id.endsWith('-error'));
      ids.length ? el.setAttribute('aria-describedby', ids.join(' ')) : el.removeAttribute('aria-describedby');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    status.textContent = '';
    const fd = new FormData(form);
    const errors = check(fd);
    if (Object.keys(errors).length) return showErrors(errors);

    let sent = false, used = false;
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    try {
      if (turnstile) {
        const token = await turnstile.token();
        if (!token) {
          say(status, NO_TOKEN[turnstile.problem()]);
          turnstile.box()?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          return;
        }
        fd.set('cf-turnstile-response', token);
        used = true;
      }
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(fd), e: String(Math.round(performance.now() - loaded)) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        const name = String(fd.get('name')).trim().split(/\s+/)[0];
        const email = String(fd.get('email')).trim();
        sent = true;
        showSent(form, name, email, form.dataset.sent, form.dataset.sentTitle);
        return;
      }
      if (res.status === 422 && body.errors) showErrors(body.errors);
      else say(status, res.status === 429 ? (body.error === 'too_fast' ? TOO_FAST : LIMITED) : body.error === 'challenge' ? CHALLENGE : FAILED);
    } catch {
      say(status, FAILED);
    } finally {
      // A token works once: after one was sent, get a fresh one for the next try.
      // (Without one, keep the widget as it is: a box waiting to be ticked stays put.)
      if (used && !sent) turnstile?.reset();
      if (form.isConnected && !sent) {
        button.disabled = false;
        button.textContent = label;
        form.removeAttribute('aria-busy');
      }
    }
  });
}

// After the mailer accepts a message: the form scans away, a terminal line
// types out, a trace draws to a node and two checks tick in, then the
// confirmation. About 2.4 s; instant with reduced motion. The terminal lines
// are decoration (aria-hidden); the confirmation text is there from the start.
function showSent(form: HTMLFormElement, name: string, email: string, text?: string, title = 'Message sent.') {
  const el = (tag: string, cls: string, text = '') => { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; };
  const done = el('div', 'cform__done');
  done.tabIndex = -1;
  const term = el('div', 'cform__term');
  term.setAttribute('aria-hidden', 'true');
  const cmd = el('p', 'cform__cmd');
  cmd.append(el('span', 'cform__prompt', '$'), ' ./send --to randy');
  const trace = el('span', 'cform__trace');
  trace.append(el('i', ''));
  term.append(cmd, trace, el('p', 'cform__ok', '✓ message checked'), el('p', 'cform__ok', '✓ handed to mail server'));
  done.append(term, el('p', 'cform__done-title', title), el('p', 'cform__done-text', text ?? `Thanks, ${name}. I’ll reply to ${email}.`));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let swapped = false;
  const swap = () => {
    if (swapped) return;
    swapped = true;
    if (!still) {
      // Start at the form's height and fold down to the card's own while the command types.
      done.style.minHeight = `${form.offsetHeight}px`;
      requestAnimationFrame(() => requestAnimationFrame(() => { done.style.minHeight = '0px'; }));
    }
    form.replaceWith(done);
    done.focus({ preventScroll: true });
    // The card is shorter than the form, so the page shrinks under a phone's scroll position:
    // keep the card in view, now and once it has folded.
    const keepInView = () => {
      const r = done.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight) done.scrollIntoView({ block: r.height > innerHeight - 140 ? 'start' : 'center', behavior: still ? 'auto' : 'smooth' });
    };
    keepInView();
    if (!still) setTimeout(keepInView, 1000);
  };
  if (still) { done.classList.add('is-still'); swap(); return; }
  form.classList.add('is-leaving');
  form.addEventListener('animationend', swap, { once: true });
  setTimeout(swap, 700);
}

// The optional, editable summary field (<ContactForm summary />), used by the
// Explore tool and the demo gallery to carry context into a message.

/** Sets the summary text, unless the visitor has edited what was filled in before. */
export function fillSummary(text: string) {
  const summary = document.querySelector<HTMLTextAreaElement>('#cf-summary');
  if (!summary) return;
  if (!summary.value || summary.value === summary.dataset.filled) summary.value = text;
  summary.dataset.filled = text;
}

/** Shows the summary field; the visitor's own words become optional. */
export function revealSummary({ label, hint }: { label: string; hint: string }) {
  const summary = document.querySelector<HTMLTextAreaElement>('#cf-summary');
  const message = document.querySelector<HTMLTextAreaElement>('#cf-message');
  if (!summary || !message) return;
  summary.closest<HTMLElement>('[data-summary-field]')!.hidden = false;
  summary.disabled = false;
  message.required = false;
  const hintEl = document.getElementById('cf-message-hint');
  if (hintEl) hintEl.textContent = hint;
  const labelEl = document.querySelector<HTMLLabelElement>('label[for="cf-message"]');
  if (labelEl) {
    const opt = document.createElement('span');
    opt.className = 'field__opt';
    opt.textContent = '(optional)';
    labelEl.replaceChildren(`${label} `, opt);
  }
}

/** Selects an option by its text, if the select has it. */
function choose(id: string, value: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el && [...el.options].some((o) => o.value === value)) el.value = value;
}

/**
 * Names a portfolio example in the form (from "Discuss a similar project" or
 * ?similar=<slug>) and suggests the matching project type, unless the visitor
 * already chose one. Returns the example's title, or undefined for an unknown slug.
 */
export function pickDemo(slug: string) {
  const form = document.querySelector<HTMLFormElement>('form[data-contact]');
  if (!form?.dataset.demos) return;
  let demos: Record<string, { title: string; type: string }> = {};
  try { demos = JSON.parse(form.dataset.demos); } catch { return; }
  const d = Object.hasOwn(demos, slug) ? demos[slug] : undefined;
  if (!d) return;
  choose('cf-demo', d.title);
  if (!(document.getElementById('cf-type') as HTMLSelectElement | null)?.value) choose('cf-type', d.type);
  const hint = document.getElementById('cf-message-hint');
  if (hint) hint.textContent = `What would you like that’s similar to ${d.title}? A different kind of business, other features or a different look are all fine.`;
  return d.title;
}

/**
 * A link like /?topic=websites#contact (from a service page) preselects the
 * project type. Only services the page lists in data-topics are accepted; the
 * query is removed from the address afterwards.
 */
function prefillTopic(form: HTMLFormElement) {
  const topic = new URLSearchParams(location.search).get('topic');
  if (!topic || !form.dataset.topics) return;
  let topics: Record<string, string> = {};
  try { topics = JSON.parse(form.dataset.topics); } catch { return; }
  const label = Object.hasOwn(topics, topic) ? topics[topic] : undefined;
  if (!label) return;
  choose('cf-type', label);
  history.replaceState(null, '', location.pathname + location.hash);
}
