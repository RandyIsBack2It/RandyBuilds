// Preview gate tests (gate/server.mjs), in-process. No network, no secrets.
//   node tests/gate.mjs
import http from 'node:http';
import { createHash } from 'node:crypto';

const sha = (s) => createHash('sha256').update(s).digest('hex');
Object.assign(process.env, {
  RBT_PREVIEW_SECRET: 'test-secret',
  RBT_PREVIEW_CODE_alpha: sha('k7mvq3xd9trp'),
  RBT_PREVIEW_CODE_beta: sha('aaaabbbbcccc'),
  RBT_CLIENT_CODE_gamma: sha('ggggkkkkmmmm'),
  RBT_MASTER_CODE: sha('masterkeytest'),
  RBT_PREVIEW_CODE_Bad: 'not-a-hash',
  RBT_ALLOWED_ORIGINS: 'https://randybuilds.tech',
});
const gate = await import('../gate/server.mjs');
const server = http.createServer(gate.handler).listen(0);
await new Promise((r) => server.on('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

const login = (code, { ip = '203.0.113.10', origin = 'https://randybuilds.tech' } = {}) => fetch(`${base}/api/preview/login`, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': `${ip}, 172.20.0.1`, ...(origin ? { Origin: origin } : {}) },
  body: new URLSearchParams({ code }).toString(),
});
const check = (uri, cookie) => fetch(`${base}/api/preview/check`, { headers: { 'X-Original-URI': uri, ...(cookie ? { Cookie: cookie } : {}) } }).then((r) => r.status);

// Codes
expect(gate.normalize('  k7mv-Q3XD 9trp \n') === 'k7mvq3xd9trp', 'normalize: trims, lowercases, drops hyphens/spaces');
expect([...gate.loadCodes().keys()].sort().join() === 'alpha,beta,gamma,master', 'only well-formed code entries load');
expect(gate.findPreview('K7MV-Q3XD-9TRP') === 'alpha', 'right code finds its preview');
expect(gate.findPreview(' k7mvq3xd9trp ') === 'alpha', 'case and whitespace ignored');
expect(gate.findPreview('alpha') === null && gate.findPreview('') === null, 'preview id is not a code');

// Login
let r = await login('k7mv-q3xd-9trp');
const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
expect(r.status === 303 && r.headers.get('location') === '/preview/alpha/', 'good code → 303 to its preview');
const sc = r.headers.get('set-cookie') || '';
expect(/HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Lax/.test(sc) && /Path=\/;/.test(sc), 'cookie is HttpOnly, Secure, SameSite=Lax, Path=/');
expect(r.headers.get('cache-control') === 'no-store', 'login response is no-store');
r = await login('WRONG-CODE-1234', { ip: '203.0.113.20' });
expect(r.status === 303 && r.headers.get('location') === '/preview/try-again/' && !r.headers.get('set-cookie'), 'wrong code → try-again, no cookie');
r = await login('k7mv-q3xd-9trp', { origin: 'https://evil.example' });
expect(r.status === 403, 'foreign Origin rejected');

// Session checks (nginx auth_request)
expect(await check('/preview/alpha/', cookie) === 204, 'session opens its own preview');
expect(await check('/preview/alpha/about/?x=1', cookie) === 204, '…and its sub-pages');
expect(await check('/preview/_assets/site.css', cookie) === 204, '…and shared build assets');
expect(await check('/preview/beta/', cookie) === 401, 'session for alpha cannot open beta');
expect(await check('/preview/alpha/../beta/', cookie) === 401, 'path traversal rejected');
expect(await check('/preview/alpha/', undefined) === 401, 'no cookie → 401');
expect(await check('/preview/_assets/site.css', undefined) === 401, 'assets need a session too');
const [id, exp, sig] = cookie.split('=')[1].split('.');
expect(await check('/preview/beta/', `rbt_preview=beta.${exp}.${sig}`) === 401, 'tampered id rejected');
expect(await check('/preview/alpha/', `rbt_preview=${id}.${Number(exp) + 999}.${sig}`) === 401, 'tampered expiry rejected');
const expired = gate.makeSession('alpha', Date.now() - 31 * 24 * 3600 * 1000);
expect(await check('/preview/alpha/', `rbt_preview=${expired}`) === 401, 'expired session rejected');

// Revocation: a session is tied to its code's hash.
const rotated = new Map(gate.loadCodes()); rotated.set('alpha', { hash: Buffer.from(sha('newcodenewcode'), 'hex'), area: 'preview' });
const value = cookie.split('=')[1];
expect(gate.readSession(`rbt_preview=${value}`, Date.now(), rotated) === null, 'rotating a code ends its sessions');
const revoked = new Map(gate.loadCodes()); revoked.delete('alpha');
expect(gate.readSession(`rbt_preview=${value}`, Date.now(), revoked) === null, 'revoking a code ends its sessions');
const beta = gate.makeSession('beta');
expect(gate.readSession(`rbt_preview=${beta}`, Date.now(), rotated) === 'beta', 'other previews unaffected');

// Clients area and master key
r = await login('GGGG-KKKK-MMMM');
const clientCookie = (r.headers.get('set-cookie') || '').split(';')[0];
expect(r.headers.get('location') === '/clients/gamma/', 'client code lands on /clients/gamma/');
expect(await check('/clients/gamma/', clientCookie) === 204 && await check('/clients/_assets/x.css', clientCookie) === 204, 'client session opens its project and the clients assets');
expect(await check('/preview/gamma/', clientCookie) === 401 && await check('/preview/_assets/x.css', clientCookie) === 401, 'client session can’t open the preview area');
expect(await check('/clients/gamma/', cookie) === 401, 'prospect session can’t open a client project');
expect(await check('/preview/vault/', cookie) === 401 && await check('/preview/vault/', clientCookie) === 401, 'only the master key opens the vault index');
r = await login('  Master Key-Test ');
const masterCookie = (r.headers.get('set-cookie') || '').split(';')[0];
expect(r.headers.get('location') === '/preview/vault/', 'master key lands on /preview/vault/ (case, spaces and dashes ignored)');
expect(await check('/preview/vault/', masterCookie) === 204 && await check('/preview/alpha/', masterCookie) === 204 && await check('/preview/beta/', masterCookie) === 204 && await check('/clients/gamma/', masterCookie) === 204, 'master session opens the vault and every project');
expect(await check('/elsewhere/', masterCookie) === 401 && await check('/preview/', masterCookie) === 401, 'master session is limited to project paths');
expect(await check('/preview/alpha/', `${clientCookie}; ${cookie}`) === 204, 'with two cookies, any one that grants the path is enough');
expect(gate.findPreview('mas') === null, 'codes under 4 characters are never checked');

// Share-link manager (/admin/): the master key only.
const adminLogin = (code, { ip = '203.0.113.30', origin = 'https://randybuilds.tech' } = {}) => fetch(`${base}/api/admin/login`, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': `${ip}, 172.20.0.1`, ...(origin ? { Origin: origin } : {}) },
  body: new URLSearchParams({ code }).toString(),
});
r = await adminLogin('masterkeytest');
const adminCookie = (r.headers.get('set-cookie') || '').split(';')[0];
expect(r.status === 303 && r.headers.get('location') === '/admin/links/' && /HttpOnly/.test(r.headers.get('set-cookie') || ''), 'master key on the admin form → /admin/links/ with an HttpOnly session');
expect(await check('/admin/links/', adminCookie) === 204 && await check('/admin/links/', masterCookie) === 204, 'master session opens the link manager');
expect(await check('/admin/links/', cookie) === 401 && await check('/admin/links/', clientCookie) === 401 && await check('/admin/links/', undefined) === 401, 'preview, client or no session can’t open it');
expect(await check('/admin/', masterCookie) === 401, 'admin area needs a page segment (the login page is public in nginx)');
r = await adminLogin('k7mv-q3xd-9trp', { ip: '203.0.113.31' });
expect(r.headers.get('location') === '/admin/try-again/' && !r.headers.get('set-cookie'), 'a preview code is refused on the admin form, no cookie');
r = await adminLogin('admin', { ip: '203.0.113.32' });
expect(r.headers.get('location') === '/admin/try-again/' && !r.headers.get('set-cookie'), '“admin” is not a password');
r = await adminLogin('masterkeytest', { origin: 'https://evil.example' });
expect(r.status === 403, 'admin login: foreign Origin rejected');
for (let i = 0; i < 5; i++) r = await adminLogin(`WRONG-${i}-XXXXXX`, { ip: '198.51.100.40' });
expect(r.headers.get('location') === '/admin/too-many-attempts/', 'admin login shares the rate limit');
r = await fetch(`${base}/api/admin/logout`, { method: 'POST', redirect: 'manual', headers: { Origin: 'https://randybuilds.tech', Cookie: adminCookie } });
expect(r.status === 303 && r.headers.get('location') === '/' && /rbt_preview=;.*Max-Age=0/.test(r.headers.get('set-cookie') || ''), 'sign out clears the session cookie');

// Rate limit: 5 failures per visitor per 15 minutes, then even the right code waits.
const ip = '198.51.100.7';
const locs = [];
for (let i = 0; i < 6; i++) locs.push((await login(`WRONG-${i}-XXXXXX`, { ip })).headers.get('location'));
expect(locs.slice(0, 4).every((l) => l === '/preview/try-again/') && locs[4] === '/preview/too-many-attempts/' && locs[5] === '/preview/too-many-attempts/', 'fifth failure → too-many-attempts');
r = await login('k7mv-q3xd-9trp', { ip });
expect(r.headers.get('location') === '/preview/too-many-attempts/' && !r.headers.get('set-cookie'), 'blocked visitor cannot log in even with the right code');
r = await login('k7mv-q3xd-9trp', { ip: '198.51.100.8' });
expect(r.headers.get('location') === '/preview/alpha/', 'other visitors unaffected');
const lim = gate.failureLimiter(5, 100, 1000);
for (let i = 0; i < 5; i++) lim.fail('x', 0);
expect(lim.blocked('x', 500) && !lim.blocked('x', 1500), 'limit lifts after the window');

server.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall gate tests passed');
process.exit(failures ? 1 : 0);
