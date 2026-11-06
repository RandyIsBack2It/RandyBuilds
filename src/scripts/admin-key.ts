// Admin sign-in: the >_ mark opens a prompt in place (“who are you?”)
// and the key is typed where the cursor was. Enter sends it to the gate (POST /api/admin/login, checked server-side); the right key
// opens the link manager, a wrong one shakes the field and clears it. Escape or
// leaving it empty closes it. It sits after the footer copyright on wide screens and at the
// bottom of the phone menu drawer below that.
// Easter egg (Randy, 2026-10-25): wrong answers say "wrong.", then "wrong!",
// then "intruder alert", and the third opens /watching/ (a parody notice).
// The count lasts for the browser session and starts over after that.
const STRIKES = 'rbt-admin-strikes';
const strikes = () => { try { return Number(sessionStorage.getItem(STRIKES)) || 0; } catch { return 0; } };
const setStrikes = (n: number) => { try { if (n) sessionStorage.setItem(STRIKES, String(n)); else sessionStorage.removeItem(STRIKES); } catch { /* storage blocked: counts per page */ } };

export function startAdminKey() {
  let count = strikes();
  // Two marks share the count: the footer's (wide screens) and the menu drawer's (phones and tablets).
  for (const box of document.querySelectorAll<HTMLElement>('.admin-key')) start(box);

  function start(box: HTMLElement) {
    const link = box.querySelector<HTMLAnchorElement>('.admin-key__link');
    const form = box?.querySelector<HTMLFormElement>('.admin-key__form');
    const field = form?.querySelector<HTMLInputElement>('.admin-key__field');
    const mark = form?.querySelector<HTMLButtonElement>('button');
    const status = form?.querySelector<HTMLElement>('[data-admin-status]');
    if (!link || !form || !field || !mark || !status) return;
    link.hidden = true;
    form.hidden = false;

    // In the phone menu drawer the on-screen keyboard would cover the prompt: while it is
    // open, the drawer ends where the keyboard starts and the prompt is scrolled into view.
    const drawer = box.closest<HTMLElement>('.site-nav__list');
    const vv = window.visualViewport;
    const fit = () => {
      if (!drawer || !vv) return;
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      drawer.style.bottom = covered ? `${covered}px` : '';
      field.scrollIntoView({ block: 'nearest' });
    };
    const set = (open: boolean) => {
      box.classList.toggle('is-open', open);
      mark.setAttribute('aria-expanded', String(open));
      field.tabIndex = open ? 0 : -1;
      if (drawer && vv) {
        if (open) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
        else { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); drawer.style.bottom = ''; }
      }
      if (open) { field.focus(); fit(); }
      else { field.value = ''; field.placeholder = ''; box.classList.remove('is-wrong'); }
    };
    const wrong = (text: string, placeholder: string) => {
      field.value = '';
      field.placeholder = placeholder;
      status.textContent = text;
      box.classList.remove('is-wrong');
      void box.offsetWidth;   // restart the shake
      box.classList.add('is-wrong');
      field.focus();
    };

    mark.addEventListener('click', () => {
      if (!box.classList.contains('is-open')) return set(true);
      if (field.value) form.requestSubmit(); else set(false);
    });
    field.addEventListener('input', () => box.classList.remove('is-wrong'));
    field.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); set(false); mark.focus(); } });   // the prompt, not the menu
    box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget as Node) && !field.value && !box.classList.contains('is-alert')) set(false); });

    const strike = (locked = false) => {
      count += 1;
      if (count >= 3) {
        setStrikes(0);
        wrong('Intruder alert.', 'intruder alert');
        box.classList.add('is-alert');
        field.disabled = true;
        return window.setTimeout(() => location.assign('/watching/'), 1600);
      }
      setStrikes(count);
      if (locked) return wrong('Too many attempts. Wait 15 minutes.', 'wait 15 min');
      wrong(count === 1 ? 'Wrong.' : 'Wrong!', count === 1 ? 'wrong.' : 'wrong!');
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (field.value.trim().length < 4) return strike();
      status.textContent = 'Checking…';
      let res: Response;
      try {
        res = await fetch(form.action, { method: 'POST', body: new URLSearchParams({ code: field.value }), credentials: 'same-origin' });
      } catch { return wrong('Couldn’t check the key. Try again.', 'retry'); }
      const to = new URL(res.url).pathname;
      if (res.redirected && to === '/admin/links/') { setStrikes(0); status.textContent = 'Signed in.'; return location.assign(res.url); }
      strike(to === '/admin/too-many-attempts/' || res.status === 429);
    });
  }
}
