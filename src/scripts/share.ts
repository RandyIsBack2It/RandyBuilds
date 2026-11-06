// Link manager (/admin/links/): open a card's share panel and copy its link.
// Clipboard API first, then the older copy command; if both fail, the link
// is selected in its field so it can be copied by hand.
export function startShare() {
  for (const box of document.querySelectorAll<HTMLElement>('[data-share]')) {
    const toggle = box.querySelector<HTMLButtonElement>('[data-share-toggle]');
    const panel = box.querySelector<HTMLElement>('.share__panel');
    const input = box.querySelector<HTMLInputElement>('.share__url');
    const copy = box.querySelector<HTMLButtonElement>('[data-share-copy]');
    const status = box.querySelector<HTMLElement>('[data-share-status]');
    if (!toggle || !panel || !input || !copy || !status) continue;
    const label = copy.innerHTML;
    let timer = 0;

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      if (!open) status.textContent = '';
    });
    input.addEventListener('focus', () => input.select());

    copy.addEventListener('click', async () => {
      clearTimeout(timer);
      let done = false;
      try { await navigator.clipboard.writeText(input.value); done = true; } catch { /* try the fallback */ }
      if (!done) {
        input.focus(); input.select();
        try { done = document.execCommand('copy'); } catch { done = false; }
      }
      status.dataset.state = done ? 'ok' : 'manual';
      if (done) {
        status.textContent = `Copied: ${input.value}`;
        copy.textContent = 'Copied';
        timer = window.setTimeout(() => { copy.innerHTML = label; }, 2500);
      } else {
        status.textContent = 'Couldn’t copy automatically. The link is selected: press Ctrl+C (⌘C on a Mac), or touch and hold to copy.';
      }
    });
  }
}
