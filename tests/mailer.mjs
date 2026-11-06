// Mailer API tests against a fake Resend endpoint. Sends no real email.
//   node tests/mailer.mjs
import http from 'node:http';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sent = [];
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => { sent.push({ auth: req.headers.authorization, body: JSON.parse(b) }); res.writeHead(200); res.end('{"id":"x"}'); });
}).listen(0);
await new Promise((r) => fake.on('listening', r));
const dir = mkdtempSync(path.join(tmpdir(), 'rbt-mailer-'));
Object.assign(process.env, {
  RESEND_API_URL: `http://127.0.0.1:${fake.address().port}/emails`,
  RESEND_API_KEY: 'test-key', RBT_MAIL_TO: 'connect@randybuilds.tech', RBT_INQUIRY_LOG: path.join(dir, 'log.jsonl'),
});
const { handle, clientIp } = await import('../mailer/server.mjs');
const server = http.createServer(handle).listen(0);
await new Promise((r) => server.on('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const expect = (cond, msg) => { if (!cond) { failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const good = { name: 'Test Person', email: 'test@example.com', site: '', message: 'I need a new website for my shop.', t: String(Date.now() - 10000) };
const post = (body, { json = true, headers = {}, ip = '203.0.113.9' } = {}) => fetch(base + '/api/contact', {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded', 'X-Forwarded-For': `${ip}, 172.20.0.1`, ...headers },
  body: json ? JSON.stringify(body) : new URLSearchParams(body).toString(),
});

let r = await post(good);
expect(r.status === 200 && (await r.json()).ok, 'valid JSON post → 200 ok');
expect(sent.length === 1 && sent[0].body.reply_to === good.email && sent[0].body.to[0] === 'connect@randybuilds.tech', 'one email to connect@, reply-to the visitor');
expect(sent[0].auth === 'Bearer test-key', 'uses the API key');
expect(existsSync(process.env.RBT_INQUIRY_LOG) && readFileSync(process.env.RBT_INQUIRY_LOG, 'utf8').includes('Test Person'), 'inquiry logged');

r = await post({ ...good, name: '', email: 'nope', message: 'hi' }, { ip: '203.0.113.10' });
const body = await r.json();
expect(r.status === 422 && body.errors.name && body.errors.email && body.errors.message, 'invalid fields → 422 with messages');
r = await post({ ...good, site: 'mysite' }, { ip: '203.0.113.10' });
expect(r.status === 422 && (await r.json()).errors.site, 'bad website address → 422');

// Explore tool: answers come as `summary`; the visitor's own words are then optional.
const summary = 'My answers from Explore What’s Possible:\n- What are you working on? An existing business or organization\n<b>x</b>';
let n = sent.length;
r = await post({ ...good, message: '', summary }, { ip: '203.0.113.14' });
expect(r.status === 200 && sent.length === n + 1, 'summary without own words → sent');
const mail = sent.at(-1).body;
expect(mail.text.includes('An existing business') && mail.subject.endsWith('(Explore)'), 'summary in the email text, subject marked (Explore)');
expect(mail.html.includes('&lt;b&gt;x&lt;/b&gt;') && !mail.html.includes('<b>x</b>'), 'summary HTML-escaped');
expect(readFileSync(process.env.RBT_INQUIRY_LOG, 'utf8').includes('Explore What'), 'summary logged with the inquiry');
r = await post({ ...good, message: 'Also a shop.', summary }, { ip: '203.0.113.14' });
expect(r.status === 200 && sent.at(-1).body.text.indexOf('Also a shop.') < sent.at(-1).body.text.indexOf('My answers'), 'own words first, then the answers');
r = await post({ ...good, message: '', summary: '   ' }, { ip: '203.0.113.14' });
expect(r.status === 422 && (await r.json()).errors.message, 'blank summary and no message → 422');
r = await post({ ...good, summary: 'x'.repeat(5000) }, { ip: '203.0.113.15' });
expect(r.status === 200 && sent.at(-1).body.text.includes('x'.repeat(3000)) && !sent.at(-1).body.text.includes('x'.repeat(3001)), 'summary capped at 3,000 characters');

// Optional choices: project type, budget and a portfolio example, one line each, escaped.
r = await post({ ...good, type: 'A custom application or business tool', budget: '$1,000–$3,000', demo: 'Ember & Rye\r\nBcc: x' }, { ip: '203.0.113.16' });
const opt = sent.at(-1).body;
expect(r.status === 200 && opt.text.includes('Project type: A custom application or business tool') && opt.text.includes('Budget: $1,000–$3,000'), 'project type and budget in the email');
expect(opt.text.includes('Example they liked: Ember & Rye Bcc: x') && opt.subject.includes('(similar to Ember & Rye Bcc: x)') && opt.html.includes('Ember &amp; Rye'), 'example on one line, in the subject, HTML-escaped');
r = await post({ ...good, message: '', demo: 'Ember & Rye' }, { ip: '203.0.113.16' });
expect(r.status === 422 && (await r.json()).errors.message, 'an example alone still needs a short description');

// Resource hub form (/resources/suggest/): a suggestion or a listing report.
const sug = { name: 'Test Person', email: 'test@example.com', kind: 'resource', resource: 'https://example.org/guide', type: 'Accessibility', message: 'A clear free guide to forms.', t: String(Date.now() - 10000) };
r = await post(sug, { ip: '203.0.113.30' });
const sm = sent.at(-1).body;
expect(r.status === 200 && sm.subject === 'Resource suggestion from Test Person', 'resource suggestion → sent with its own subject');
expect(sm.text.includes('Suggested resource: https://example.org/guide') && sm.text.includes('Topic: Accessibility') && !sm.text.includes('Project type'), 'suggestion fields in the email, labelled for resources');
r = await post({ ...sug, resource: 'example' }, { ip: '203.0.113.30' });
expect(r.status === 422 && (await r.json()).errors.resource, 'suggestion without a full address → 422');
r = await post({ ...sug, message: 'hi' }, { ip: '203.0.113.30' });
expect(r.status === 422 && (await r.json()).errors.message === 'Add a sentence or two about it.', 'short suggestion message → resource wording');
r = await post({ ...sug, kind: 'report', resource: '', listing: 'webaim-wave', message: 'The link is broken now.' }, { ip: '203.0.113.31' });
expect(r.status === 200 && sent.at(-1).body.subject.includes('(webaim-wave)') && sent.at(-1).body.text.includes('Listing: webaim-wave'), 'listing report → sent, names the listing');
r = await post({ ...sug, kind: 'report', listing: '' }, { ip: '203.0.113.31' });
expect(r.status === 422 && (await r.json()).errors.listing, 'report without a listing → 422');
r = await post({ ...good, kind: 'admin' }, { ip: '203.0.113.32' });
expect(r.status === 200 && sent.at(-1).body.subject.startsWith('Project inquiry'), 'unknown kind is treated as a normal inquiry');

const before = sent.length;
r = await post({ ...good, hpot: 'Spam Inc' }, { ip: '203.0.113.11' });
expect(r.status === 200 && sent.length === before, 'honeypot → looks ok, nothing sent');
// iPhone AutoFill used to fill the old `company` trap: that value must not drop a real message.
r = await post({ ...good, company: 'Caron Builds' }, { ip: '203.0.113.17' });
expect(r.status === 200 && sent.length === before + 1, 'an AutoFilled company value is ignored and the message is sent');
r = await post({ ...good, t: String(Date.now()), e: '900' }, { ip: '203.0.113.11' });
expect(r.status === 429 && (await r.json()).error === 'too_fast' && sent.length === before + 1, 'sent within 3 s of opening → asked to send again, nothing sent');
// The phone's clock is a minute fast, but it spent 8 s on the page: that's a person.
r = await post({ ...good, t: String(Date.now() + 60000), e: '8000' }, { ip: '203.0.113.18' });
expect(r.status === 200 && sent.length === before + 2, 'a wrong device clock doesn\'t block a real message');

r = await post({ ...good, t: '' }, { json: false, ip: '203.0.113.12' });
expect(r.status === 303 && r.headers.get('location') === '/message-sent/', 'no-JS post → 303 /message-sent/');
r = await post({ ...good, email: 'x' }, { json: false, ip: '203.0.113.12' });
expect(r.status === 303 && r.headers.get('location') === '/message-not-sent/', 'no-JS invalid → 303 /message-not-sent/');

r = await post(good, { headers: { Origin: 'https://evil.example' }, ip: '203.0.113.13' });
expect(r.status === 403, 'foreign Origin → 403');

for (let i = 0; i < 5; i++) await post(good, { ip: '203.0.113.20' });
r = await post(good, { ip: '203.0.113.20' });
expect(r.status === 429, '6th message from one address within an hour → 429');

expect(clientIp('198.51.100.7, 172.20.0.1') === '198.51.100.7', 'client IP: last public entry');
expect(clientIp('1.2.3.4, 198.51.100.7, 10.0.0.2') === '198.51.100.7', 'client IP: spoofed leading entry ignored');

r = await fetch(base + '/api/health');
expect(r.status === 200 && (await r.json()).mail === true, 'health');

// Cloudflare Turnstile, against a fake siteverify: off without a secret (above), enforced with one.
const checks = [];
let verifyUp = true;
const verify = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    const p = new URLSearchParams(b); checks.push(Object.fromEntries(p));
    if (!verifyUp) { res.writeHead(500); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(p.get('response') === 'good-token' ? { success: true } : { success: false, 'error-codes': ['invalid-input-response'] }));
  });
}).listen(0);
await new Promise((r) => verify.on('listening', r));
process.env.TURNSTILE_VERIFY_URL = `http://127.0.0.1:${verify.address().port}/siteverify`;
process.env.TURNSTILE_SECRET_KEY = 'test-secret';
const { verifyTurnstile } = await import('../mailer/server.mjs');
expect(await verifyTurnstile('', '1.2.3.4') === false && checks.length === 0, 'turnstile: an empty token is refused without calling Cloudflare');
n = sent.length;
r = await post(good, { ip: '203.0.113.30' });
expect(r.status === 403 && (await r.json()).error === 'challenge' && sent.length === n, 'turnstile on: no token → 403, nothing sent');
r = await post({ ...good, 'cf-turnstile-response': 'bad-token' }, { ip: '203.0.113.31' });
expect(r.status === 403 && sent.length === n, 'turnstile on: a rejected token → 403, nothing sent');
r = await post({ ...good, 'cf-turnstile-response': 'good-token' }, { ip: '203.0.113.32' });
expect(r.status === 200 && sent.length === n + 1, 'turnstile on: an accepted token → sent');
const last = checks.at(-1);
expect(last.secret === 'test-secret' && last.response === 'good-token' && last.remoteip === '203.0.113.32', 'turnstile: secret, token and visitor IP go to siteverify');
r = await post({ ...good, 'cf-turnstile-response': 'good-token' }, { json: false, ip: '203.0.113.33' });
expect(r.status === 303 && r.headers.get('location') === '/message-sent/', 'turnstile on: a plain form post with a token → sent page');
r = await post(good, { json: false, ip: '203.0.113.34' });
expect(r.status === 303 && r.headers.get('location') === '/message-not-sent/', 'turnstile on: a plain post without a token (no JavaScript) → not-sent page');
r = await post({ ...good, hpot: 'x', 'cf-turnstile-response': 'bad-token' }, { ip: '203.0.113.35' });
expect(r.status === 200 && (await r.json()).ok, 'turnstile on: the honeypot still answers silently');
verifyUp = false;
r = await post({ ...good, 'cf-turnstile-response': 'good-token' }, { ip: '203.0.113.36' });
expect(r.status === 502 && sent.length === n + 2, 'turnstile on: Cloudflare unreachable → 502, nothing sent (fails closed)');
r = await fetch(base + '/api/health');
expect((await r.json()).turnstile === true, 'health reports the check is on');
verify.close();

server.close(); fake.close();
console.log(failures ? `\n${failures} failure(s)` : '\nAll mailer checks passed');
process.exit(failures ? 1 : 0);
