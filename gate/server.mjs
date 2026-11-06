// RandyBuilds.tech — access gate for private client previews. No dependencies.
//
// POST /api/preview/login (urlencoded `code` from the /preview/ vault form) → checks
// the code against SHA-256 hashes, sets a signed HttpOnly session cookie, 303 →
// the project it opens. GET /api/preview/check is nginx's auth_request: 204 if
// the cookie grants the requested path, otherwise 401. GET /api/health.
// POST /api/admin/login takes only the master key and opens /admin/links/
// (the share-link manager); POST /api/admin/logout ends the session.
//
// Two areas: /preview/<id>/ (concepts for prospects) and /clients/<id>/ (full
// projects for clients who said yes). A code opens exactly one project; the
// master key opens /preview/vault/ (an index of every project), all of them,
// and /admin/ (the share-link manager). No other code opens /admin/.
//
// Env (this project's .env.previews only, never in git; values are SHA-256 hex
// of the normalized code):
//   RBT_PREVIEW_SECRET          HMAC key for session cookies (hex)
//   RBT_PREVIEW_CODE_<id>       one per prospect preview → /preview/<id>/
//   RBT_CLIENT_CODE_<id>        one per client project   → /clients/<id>/
//   RBT_MASTER_CODE             the master key (Randy)   → /preview/vault/
//   RBT_ALLOWED_ORIGINS         origins allowed to post the login form
// Removing or changing a line and restarting the gate revokes that code and
// every session it issued.
import http from 'node:http';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8082);
const SECRET = process.env.RBT_PREVIEW_SECRET || randomBytes(32).toString('hex');
const ORIGINS = (process.env.RBT_ALLOWED_ORIGINS || 'https://randybuilds.tech,https://www.randybuilds.tech').split(',');
const SESSION_S = 30 * 24 * 60 * 60;
const COOKIE = 'rbt_preview';
const WINDOW_MS = 15 * 60 * 1000;
const PER_IP_FAILS = 5;
const ALL_FAILS = 100; // across all visitors per window

const ID_RE = /^[a-z0-9]{2,40}$/;
const HEX_RE = /^[0-9a-f]{64}$/;

export const MASTER = 'master'; // reserved id
const AREAS = ['preview', 'clients', 'admin'];
export const ADMIN_HOME = '/admin/links/';

export function loadCodes(env = process.env) {
  const codes = new Map();
  for (const [k, v] of Object.entries(env)) {
    const hash = String(v || '').trim().toLowerCase();
    if (!HEX_RE.test(hash)) continue;
    if (k === 'RBT_MASTER_CODE') { codes.set(MASTER, { hash: Buffer.from(hash, 'hex'), area: '*' }); continue; }
    const m = /^RBT_(PREVIEW|CLIENT)_CODE_(.+)$/.exec(k);
    if (!m) continue;
    const id = m[2].toLowerCase();
    if (ID_RE.test(id) && id !== MASTER && id !== 'vault') codes.set(id, { hash: Buffer.from(hash, 'hex'), area: m[1] === 'CLIENT' ? 'clients' : 'preview' });
  }
  return codes;
}
const CODES = loadCodes();

// Case-insensitive; surrounding whitespace and the hyphens/spaces between
// groups don't matter ("k7mv q3xd-9trp " === "K7MV-Q3XD-9TRP").
export const normalize = (code) => String(code || '').trim().toLowerCase().replace(/[\s-]+/g, '');
export const hashCode = (code) => createHash('sha256').update(normalize(code)).digest();

export function findPreview(code, codes = CODES) {
  const n = normalize(code);
  if (n.length < 4 || n.length > 64) return null;
  const h = hashCode(n);
  let found = null;
  for (const [id, want] of codes) if (timingSafeEqual(h, want.hash) && !found) found = id; // check all, no early exit
  return found;
}

/** Where a code lands after login. */
export function destination(id, codes = CODES) {
  if (id === MASTER) return '/preview/vault/';
  return `/${codes.get(id)?.area || 'preview'}/${id}/`;
}

// Session: <id>.<expiry>.<sig>. The signature covers the code's hash, so a
// rotated or removed code invalidates its sessions without touching others.
const sign = (id, exp, codes, secret) =>
  createHmac('sha256', secret).update(`${id}.${exp}.${codes.get(id).hash.toString('hex')}`).digest('base64url');

export function makeSession(id, now = Date.now(), codes = CODES, secret = SECRET) {
  const exp = Math.floor(now / 1000) + SESSION_S;
  return `${id}.${exp}.${sign(id, exp, codes, secret)}`;
}

function readOne(value, now, codes, secret) {
  const [id, exp, sig] = value.split('.');
  if (!(ID_RE.test(id || '')) || !codes.has(id) || !/^\d+$/.test(exp || '') || Number(exp) * 1000 < now) return null;
  const want = Buffer.from(sign(id, exp, codes, secret));
  const got = Buffer.from(sig || '');
  return got.length === want.length && timingSafeEqual(got, want) ? id : null;
}

/** Every valid session in the Cookie header (a browser may hold one per path). */
export function readSessions(cookieHeader, now = Date.now(), codes = CODES, secret = SECRET) {
  return String(cookieHeader || '').split(/;\s*/).filter((c) => c.startsWith(`${COOKIE}=`))
    .map((c) => readOne(c.slice(COOKIE.length + 1), now, codes, secret)).filter(Boolean);
}
export const readSession = (cookieHeader, now = Date.now(), codes = CODES, secret = SECRET) => readSessions(cookieHeader, now, codes, secret)[0] || null;

// /<area>/<id>/… needs a session for <id> in that area; /<area>/_assets/…
// (shared build assets) needs any session for that area. The master session
// opens everything, including /preview/vault/ and /admin/<page>/ (master
// only). Anything else is denied.
export function allowed(uri, id, codes = CODES) {
  if (!id) return false;
  let p;
  try { p = decodeURIComponent(new URL(String(uri || '/'), 'http://x').pathname); } catch { return false; }
  if (p.includes('..')) return false;
  const [, area, seg = ''] = p.split('/');
  if (!AREAS.includes(area) || !seg) return false;
  if (id === MASTER) return true;
  const entry = codes.get(id);
  return !!entry && area !== 'admin' && entry.area === area && (seg === id || seg === '_assets');
}

const PRIVATE = /^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|f[cd]|fe80)/i;
// Same rule as the mailer: the last public address in X-Forwarded-For.
export function clientIp(xff, fallback = 'unknown') {
  const parts = String(xff || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) if (!PRIVATE.test(parts[i])) return parts[i];
  return parts[0] || fallback;
}

export function failureLimiter(perKey = PER_IP_FAILS, total = ALL_FAILS, windowMs = WINDOW_MS) {
  const hits = new Map();
  let all = [];
  const recent = (list, now) => list.filter((t) => now - t < windowMs);
  return {
    blocked(key, now = Date.now()) {
      all = recent(all, now);
      return all.length >= total || recent(hits.get(key) || [], now).length >= perKey;
    },
    fail(key, now = Date.now()) {
      const list = recent(hits.get(key) || [], now);
      list.push(now); hits.set(key, list); all.push(now);
      if (hits.size > 5000) hits.clear();
    },
  };
}
const limiter = failureLimiter();

function readBody(req, max = 2048) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const redirect = (res, to, extra = {}) => { res.writeHead(303, { Location: to, ...NO_STORE, ...extra }); res.end(); };
const sessionCookie = (id) => `${COOKIE}=${makeSession(id)}; Path=/; Max-Age=${SESSION_S}; HttpOnly; Secure; SameSite=Lax`;
const sameOrigin = (req) => !req.headers.origin || ORIGINS.includes(req.headers.origin);

/** Shared by both login forms: origin check, rate limit, code check. `accept(id)` decides whether that code may sign in here. */
function login(req, res, { accept, ok, denied, sealed, event }) {
  if (!sameOrigin(req)) { res.writeHead(403, NO_STORE); return res.end(); }
  const ip = clientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress);
  if (limiter.blocked(ip)) return redirect(res, sealed);
  readBody(req).then((body) => {
    const id = findPreview(new URLSearchParams(body).get('code'));
    if (!id || !accept(id)) {
      limiter.fail(ip);
      console.log(JSON.stringify({ t: new Date().toISOString(), event, ip }));
      return redirect(res, limiter.blocked(ip) ? sealed : denied);
    }
    redirect(res, ok(id), { 'Set-Cookie': sessionCookie(id) });
  }).catch(() => { res.writeHead(413, NO_STORE); res.end(); });
}

export function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/health') { res.writeHead(200, NO_STORE); return res.end('ok'); }

  if (req.method === 'GET' && url.pathname === '/api/preview/check') {
    const ok = readSessions(req.headers.cookie).some((id) => allowed(req.headers['x-original-uri'], id));
    res.writeHead(ok ? 204 : 401, NO_STORE);
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/api/preview/login') {
    return login(req, res, {
      accept: () => true, ok: (id) => destination(id), event: 'preview-code-rejected',
      denied: '/preview/try-again/', sealed: '/preview/too-many-attempts/',
    });
  }

  // Share-link manager: the master key only. A client's preview code is
  // refused here like a wrong one, so this form says nothing about it.
  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    return login(req, res, {
      accept: (id) => id === MASTER, ok: () => ADMIN_HOME, event: 'admin-login-rejected',
      denied: '/admin/try-again/', sealed: '/admin/too-many-attempts/',
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    if (!sameOrigin(req)) { res.writeHead(403, NO_STORE); return res.end(); }
    return redirect(res, '/', { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
  }

  res.writeHead(404, NO_STORE);
  res.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.RBT_PREVIEW_SECRET) console.log('! RBT_PREVIEW_SECRET not set: sessions end when the gate restarts');
  console.log(`gate listening on :${PORT}; active codes: ${[...CODES].map(([id, c]) => id === MASTER ? 'master key' : `${c.area}/${id}`).join(', ') || 'none'}`);
  http.createServer(handler).listen(PORT);
}
