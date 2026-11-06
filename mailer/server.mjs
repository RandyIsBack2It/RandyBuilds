// RandyBuilds.tech — contact form mailer. No dependencies.
//
// POST /api/contact (JSON from the page script, or a plain urlencoded post
// without JavaScript) → one email to RBT_MAIL_TO via the Resend HTTP API,
// Reply-To = the visitor, plus a line in the inquiry log. GET /api/health.
//
// Env (this project's .env only): RESEND_API_KEY (required to send),
// RBT_MAIL_TO, RBT_MAIL_FROM, RBT_ALLOWED_ORIGINS, RBT_INQUIRY_LOG, and
// TURNSTILE_SECRET_KEY: when set, every message needs a Cloudflare Turnstile
// token (`cf-turnstile-response`, added by the widget) that siteverify accepts.
import http from 'node:http';
import { appendFile } from 'node:fs/promises';

const PORT = Number(process.env.PORT || 8081);
const API = process.env.RESEND_API_URL || 'https://api.resend.com/emails'; // test hook
const KEY = process.env.RESEND_API_KEY || '';
const TO = process.env.RBT_MAIL_TO || 'connect@randybuilds.tech';
const FROM = process.env.RBT_MAIL_FROM || '"RandyBuilds.tech" <forms@getunmaskd.com>';
const ORIGINS = (process.env.RBT_ALLOWED_ORIGINS || 'https://randybuilds.tech,https://www.randybuilds.tech').split(',');
const LOG_FILE = process.env.RBT_INQUIRY_LOG || '/data/inquiries.jsonl';
const MIN_FILL_MS = 3000;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function limiter(limit, windowMs) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= limit) { hits.set(key, list); return true; }
    list.push(now); hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    return false;
  };
}
const perIp = limiter(5, HOUR);
const overall = limiter(60, HOUR);

const clean = (v, max) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');
const oneLine = (v) => v.replace(/[\r\n]+/g, ' ');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const PRIVATE = /^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|f[cd]|fe80)/i;

// Cloudflare appends the visitor's address to X-Forwarded-For; the proxies
// after it (tunnel, Caddy) are private. The last public entry is the visitor.
export function clientIp(xff, fallback = 'unknown') {
  const parts = String(xff || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) if (!PRIVATE.test(parts[i])) return parts[i];
  return parts[0] || fallback;
}

export const MESSAGES = {
  name: 'Enter your name.',
  email: 'Enter an email address I can reply to.',
  site: 'Enter the full address, starting with https://, or leave it blank.',
  message: 'Tell me a little about your project.',
  resource: 'Enter the resource’s full address, starting with https://.',
  listing: 'Choose the listing this is about.',
  about: 'Add a sentence or two about it.',
};

// The resource hub's form (/resources/suggest/) uses this endpoint too:
// kind=resource (a suggested resource's URL in `resource`) or kind=report
// (a listing id in `listing`). Anything else is a project inquiry.
const KINDS = ['resource', 'report'];
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]+$/i;

export function validate(raw, now = Date.now()) {
  const data = {
    name: oneLine(clean(raw.name, 100)),
    email: oneLine(clean(raw.email, 254)),
    site: oneLine(clean(raw.site, 200)),
    message: clean(raw.message, 5000),
    // Answers from the Explore tool (/explore/), edited by the visitor. Optional.
    summary: clean(raw.summary, 3000),
    // Optional choices: project type, budget, and a portfolio example they liked.
    type: oneLine(clean(raw.type, 120)),
    budget: oneLine(clean(raw.budget, 60)),
    demo: oneLine(clean(raw.demo, 120)),
    kind: KINDS.includes(raw.kind) ? raw.kind : '',
    resource: oneLine(clean(raw.resource, 300)),
    listing: oneLine(clean(raw.listing, 80)),
  };
  const errors = {};
  if (!data.name) errors.name = MESSAGES.name;
  if (!EMAIL_RE.test(data.email)) errors.email = MESSAGES.email;
  if (data.site && !URL_RE.test(data.site)) errors.site = MESSAGES.site;
  if (data.kind === 'resource' && !URL_RE.test(data.resource)) errors.resource = MESSAGES.resource;
  if (data.kind === 'report' && !data.listing) errors.listing = MESSAGES.listing;
  if (!data.summary && data.message.length < 10) errors.message = data.kind ? MESSAGES.about : MESSAGES.message;
  // The page script sends `e`, the time spent on the page measured on the device (so a wrong
  // phone clock can't make a person look like a bot), and `t`, its load time. Older pages send
  // only `t`. A no-JS post has neither and is judged on the honeypot and rate limits alone.
  const t = Number(raw.t), e = Number(raw.e);
  const elapsed = raw.e !== undefined && raw.e !== '' && Number.isFinite(e) ? e
    : raw.t !== undefined && raw.t !== '' && Number.isFinite(t) ? now - t : null;
  // The trap is `hpot`. It used to be `company`, which iPhone AutoFill filled in, so real
  // messages were dropped; a `company` value is now ignored.
  const trap = clean(raw.hpot, 200) !== '';
  // Only the trap is silent. A too-quick send is answered (people can just send again).
  const spam = trap ? 'trap' : elapsed !== null && elapsed > MAX_AGE_MS ? 'too_old' : '';
  const tooFast = elapsed !== null && elapsed < MIN_FILL_MS;
  return { data, errors, spam, tooFast };
}

async function send(d) {
  const subject = d.kind === 'resource' ? `Resource suggestion from ${d.name}`
    : d.kind === 'report' ? `Resource listing report from ${d.name} (${d.listing})`
    : `Project inquiry from ${d.name}${d.demo ? ` (similar to ${d.demo})` : d.summary ? ' (Explore)' : ''}`;
  const fields = (d.kind
    ? [['Name', d.name], ['Email', d.email], ['Suggested resource', d.kind === 'resource' ? d.resource : ''], ['Listing', d.kind === 'report' ? d.listing : ''], ['Topic', d.type]]
    : [['Name', d.name], ['Email', d.email], ['Project type', d.type], ['Budget', d.budget], ['Example they liked', d.demo], ['Website', d.site]]).filter(([, v]) => v);
  const blocks = [d.message, d.summary].filter(Boolean);
  const text = `${fields.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${blocks.join('\n\n---\n')}\n\n— sent from the randybuilds.tech ${d.kind ? 'resource form' : 'contact form'}`;
  const html = `<p>${fields.map(([k, v]) => `<strong>${esc(k)}:</strong> ${esc(v)}`).join('<br>')}</p>${blocks.map((b) => `<p style="white-space:pre-wrap">${esc(b)}</p>`).join('<hr>')}<p style="color:#777">Sent from the randybuilds.tech contact form. Reply to answer ${esc(d.name)} directly.</p>`;
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: d.email, subject, text, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

// Cloudflare Turnstile: each token is checked once, server-side, with the secret.
// Read per request so the check can be switched on with the .env alone.
const turnstileSecret = () => process.env.TURNSTILE_SECRET_KEY || '';
const verifyUrl = () => process.env.TURNSTILE_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify'; // test hook
export async function verifyTurnstile(token, ip) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const res = await fetch(verifyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: turnstileSecret(), response: token, ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`siteverify ${res.status}`);
  const out = await res.json();
  if (!out.success) log('challenge_failed', { codes: out['error-codes'] });
  return out.success === true;
}

async function record(entry) {
  try { await appendFile(LOG_FILE, JSON.stringify(entry) + '\n', { mode: 0o600 }); }
  catch (e) { log('record_failed', { error: String(e.message || e) }); }
}
const log = (event, extra = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...extra }));

function readBody(req, max = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function reply(res, status, body, json) {
  if (json) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  } else {
    // No-JS form post: send the visitor to a plain result page.
    res.writeHead(303, { Location: body.ok ? '/message-sent/' : '/message-not-sent/', 'Cache-Control': 'no-store' });
    res.end();
  }
}

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mail: Boolean(KEY), turnstile: Boolean(turnstileSecret()) }));
  }
  if (url.pathname !== '/api/contact') { res.writeHead(404); return res.end(); }
  if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); }

  const type = String(req.headers['content-type'] || '');
  const json = type.includes('application/json');
  const origin = req.headers.origin;
  if (origin && !ORIGINS.includes(origin)) return reply(res, 403, { ok: false, error: 'origin' }, json);

  let raw;
  try {
    const body = await readBody(req);
    raw = json ? JSON.parse(body || '{}') : Object.fromEntries(new URLSearchParams(body));
  } catch { return reply(res, 400, { ok: false, error: 'bad_request' }, json); }

  const now = Date.now();
  const ip = clientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress);
  const { data, errors, spam, tooFast } = validate(raw, now);
  if (Object.keys(errors).length) return reply(res, 422, { ok: false, errors }, json);
  // Spam gets the same answer as success, so bots learn nothing.
  if (spam) { log('spam_dropped', { reason: spam }); return reply(res, 200, { ok: true }, json); }
  if (tooFast) { log('too_fast'); return reply(res, 429, { ok: false, error: 'too_fast' }, json); }
  if (perIp(ip, now) || overall('all', now)) { log('rate_limited'); return reply(res, 429, { ok: false, error: 'rate_limited' }, json); }
  if (!KEY) { log('no_api_key'); return reply(res, 503, { ok: false, error: 'unavailable' }, json); }
  if (turnstileSecret()) {
    let passed = false;
    try { passed = await verifyTurnstile(raw['cf-turnstile-response'], ip); }
    catch (e) { log('challenge_unavailable', { error: String(e.message || e) }); return reply(res, 502, { ok: false, error: 'send_failed' }, json); }
    if (!passed) return reply(res, 403, { ok: false, error: 'challenge' }, json);
  }

  try {
    await send(data);
    await record({ at: new Date(now).toISOString(), ...data });
    log('sent');
    return reply(res, 200, { ok: true }, json);
  } catch (e) {
    log('send_failed', { error: String(e.message || e) });
    return reply(res, 502, { ok: false, error: 'send_failed' }, json);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  http.createServer((req, res) => handle(req, res).catch(() => { res.writeHead(500); res.end(); }))
    .listen(PORT, () => log('listening', { port: PORT, mail: Boolean(KEY) }));
}
