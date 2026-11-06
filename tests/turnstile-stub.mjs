// A local stand-in for Cloudflare Turnstile's script in browser tests. The real
// widget runs a blob: worker that Playwright never sees finish, so pages with a
// form would never reach 'networkidle'. The stub issues Cloudflare's documented
// test token the way the widget does (a hidden cf-turnstile-response input plus
// the callback), works offline, and keeps runs deterministic. tests/run.mjs
// still checks the real widget once, under the real CSP.
//   import { stubTurnstile } from './turnstile-stub.mjs'; stubTurnstile(browser);
const STUB = `(() => {
  const widgets = {}; let n = 0;
  window.turnstile = {
    render(el, o) {
      const id = 'stub' + ++n, input = document.createElement('input');
      input.type = 'hidden'; input.name = 'cf-turnstile-response'; el.append(input);
      const issue = () => setTimeout(() => { input.value = 'XXXX.DUMMY.TOKEN.XXXX'; o.callback && o.callback(input.value); }, 50);
      widgets[id] = { input, issue }; issue(); return id;
    },
    getResponse(id) { return widgets[id] && widgets[id].input.value || undefined; },
    reset(id) { if (widgets[id]) { widgets[id].input.value = ''; widgets[id].issue(); } },
  };
})();`;

/** Every context this browser opens from now on gets the stub. Returns the unstubbed newContext. */
export function stubTurnstile(browser) {
  const real = browser.newContext.bind(browser);
  browser.newContext = async (opts) => {
    const ctx = await real(opts);
    await ctx.route('https://challenges.cloudflare.com/**', (r) =>
      r.request().url().includes('/turnstile/v0/api.js') ? r.fulfill({ contentType: 'text/javascript', body: STUB }) : r.abort());
    return ctx;
  };
  return real;
}
