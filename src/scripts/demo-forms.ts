// Concept demos never contact anyone: forms show a note instead of sending,
// and call buttons (fictional 555 numbers) say what they would do.
export function startDemoForms() {
  for (const form of document.querySelectorAll<HTMLFormElement>('form[data-demo]')) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const out = form.querySelector<HTMLElement>('[data-demo-result]');
      if (out) {
        out.textContent = 'This is a concept demo, so nothing was sent. On a real site, this request would go straight to the business.';
        out.focus();
      }
    });
  }

  let toast: HTMLElement | undefined;
  let timer: number | undefined;
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="tel:"]');
    if (!link) return;
    e.preventDefault();
    if (!toast) {
      toast = document.createElement('p');
      toast.className = 'demo-toast';
      toast.setAttribute('role', 'status');
      document.body.append(toast);
    }
    toast.textContent = 'This is a concept demo, so no call is made. On a real site, this button would call the business.';
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (toast) toast.textContent = ''; }, 7000);
  });
}
