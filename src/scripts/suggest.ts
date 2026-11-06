// /resources/suggest/: shows only the fields for the chosen kind (a new
// resource, or a report about a listing) and words the message label to
// match. ?report=<listing id> starts on a report about that listing. Without
// JavaScript every field shows, each marked with what it's for. Sending and
// validation are scripts/contact.ts, the same as the contact form.
const LABELS = {
  resource: { message: 'How did it help, and what’s free about it?', hint: 'A sentence or two is plenty.' },
  report: { message: 'What’s wrong with the listing?', hint: 'For example: the link is broken, or the free plan has changed.' },
} as const;

export function startSuggestForm() {
  const form = document.querySelector<HTMLFormElement>('[data-resource-form]');
  if (!form) return;
  const radios = [...form.querySelectorAll<HTMLInputElement>('input[name="kind"]')];
  const listing = form.elements.namedItem('listing') as HTMLSelectElement;
  const message = form.querySelector<HTMLLabelElement>('label[for="cf-message"]')!;
  const hint = document.getElementById('cf-message-hint')!;
  // The "(for a suggestion)" notes are only needed while every field shows.
  form.querySelectorAll('.suggest__for').forEach((el) => el.remove());

  const set = (kind: 'resource' | 'report') => {
    form.querySelectorAll<HTMLElement>('[data-for]').forEach((el) => {
      const on = el.dataset.for === kind;
      el.hidden = !on;
      el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((c) => { c.disabled = !on; });
    });
    message.textContent = LABELS[kind].message;
    hint.textContent = LABELS[kind].hint;
  };
  const current = () => (radios.find((r) => r.checked)?.value === 'report' ? 'report' : 'resource');
  radios.forEach((r) => r.addEventListener('change', () => set(current())));

  const report = new URLSearchParams(location.search).get('report');
  if (report && [...listing.options].some((o) => o.value === report && o.value)) {
    radios.find((r) => r.value === 'report')!.checked = true;
    listing.value = report;
  }
  set(current());
}
