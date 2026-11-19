#!/usr/bin/env node
// GenXLinked quick polls: tiny vote counter. No accounts, no cookies, no IPs stored.
// GET  /gxl-api/poll/<id>          -> {id, counts:[...], total}
// POST /gxl-api/poll/<id> {"i":N}  -> counts after the vote. One vote per (salted daily hash of client IP + poll) ; the hash is
// kept only to stop repeat votes and the salt rotates every UTC day, so a hash cannot be tied back to an address later.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
// --- /gxl-api/join: create a free member (unsubscribed until they prove the address with the emailed code) ---
const GHOST = process.env.GHOST_INTERNAL_URL || 'http://ghost:2368', [GK_ID, GK_SECRET] = (process.env.GHOST_ADMIN_KEY || ':').split(':');
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const adminJwt = () => { const n = Math.floor(Date.now() / 1000), h = b64u({ alg: 'HS256', typ: 'JWT', kid: GK_ID }), b = b64u({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(GK_SECRET, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const admin = (m, p, body) => fetch(`${GHOST}/ghost/api/admin${p}`, { method: m, headers: { Authorization: `Ghost ${adminJwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(10000) }).then((r) => r.json().then((j) => [r.status, j]));
// --- Continue with Google: verify the Google ID token, upsert the member (email is verified by Google, so subscribe them), mint a sign-in URL ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const NEWSLETTER_ID = process.env.GHOST_NEWSLETTER_ID || '6afda7bc4d15660001e2b1df';
async function google(credential) {
  if (!GOOGLE_CLIENT_ID) return [503, { error: 'Google sign-in is not set up yet.' }];
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential || ''))}`, { signal: AbortSignal.timeout(8000) });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || t.aud !== GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) || String(t.email_verified) !== 'true' || !t.email) return [401, { error: 'Google did not confirm that address. Try the email code instead.' }];
  const email = String(t.email).toLowerCase(), name = String(t.given_name || t.name || '').slice(0, 80);
  const [, found] = await admin('GET', `/members/?filter=${encodeURIComponent(`email:'${email.replace(/'/g, '')}'`)}&limit=1`);
  let id = found.members?.[0]?.id;
  if (!id) {
    const [st, j] = await admin('POST', '/members/', { members: [{ email, ...(name ? { name } : {}), newsletters: [{ id: NEWSLETTER_ID }], labels: [{ name: 'joined-with-google' }] }] });
    if (st >= 300) return [400, { error: 'Could not create your account. Try the email code.' }];
    id = j.members[0].id;
  }
  const [st2, u] = await admin('GET', `/members/${id}/signin_urls/`);
  const url = u.member_signin_urls?.[0]?.url;
  if (st2 >= 300 || !url) return [500, { error: 'Could not sign you in. Try the email code.' }];
  return [200, { url }];
}
const joinHits = new Map(); let joinDay = '', joinCount = 0;
async function join(ip, email, name) {
  const now = Date.now(), h = joinHits.get(ip) || [0, now]; if (now - h[1] > 3600e3) { h[0] = 0; h[1] = now; } h[0]++; joinHits.set(ip, h);
  if (h[0] > 8) return [429, { error: 'Too many tries. Wait a little and try again.' }];
  const d = new Date().toISOString().slice(0, 10); if (d !== joinDay) { joinDay = d; joinCount = 0; } if (++joinCount > 500) return [429, { error: 'Busy, try later.' }];
  email = String(email || '').trim().toLowerCase(); name = String(name || '').trim().slice(0, 80);
  if (!/^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i.test(email)) return [400, { error: 'That email address does not look right.' }];
  const [, found] = await admin('GET', `/members/?filter=${encodeURIComponent(`email:'${email.replace(/'/g, "")}'`)}&limit=1`);
  if (!found.members?.length) {
    const [st, j] = await admin('POST', '/members/', { members: [{ email, ...(name ? { name } : {}), newsletters: [], labels: [{ name: 'joined-with-code' }] }] });
    if (st >= 300) return [400, { error: 'Could not start your sign-up. Try again.' }];
  }
  return [200, { ok: true }];
}

const DIR = process.env.POLL_DIR || '/data', FILE = `${DIR}/polls.json`, PORT = Number(process.env.PORT || 2370);
const MAX_POLLS = 500, MAX_OPTS = 6;
// Only poll/quiz ids that exist in the articles (allowed.json, written by scripts/poll-ids.mjs); health-check for the theme probe.
let ALLOWED = null; const reloadAllowed = () => { try { ALLOWED = new Set([...JSON.parse(fs.readFileSync(process.env.POLL_ALLOWED || '/app/allowed.json', 'utf8')), 'health-check']); } catch {} };
reloadAllowed(); setInterval(reloadAllowed, 60e3).unref(); // the desk adds new poll ids as agent003 drafts
let db = { polls: {} }; try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
let dirty = false;
setInterval(() => { if (!dirty) return; dirty = false; fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db)); fs.renameSync(`${FILE}.tmp`, FILE); }, 2000).unref();
let saltDay = '', salt = '', seen = new Set();
function voterKey(ip, id) { const d = new Date().toISOString().slice(0, 10); if (d !== saltDay) { saltDay = d; salt = crypto.randomBytes(16).toString('hex'); seen = new Set(); } return crypto.createHmac('sha256', salt).update(`${ip}|${id}`).digest('hex'); }
const hits = new Map(); // ip -> [count, windowStart] ; 30 votes / 10 min / ip
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h[1] > 600e3) hits.delete(k); }, 600e3).unref();
function limited(ip) { const now = Date.now(), h = hits.get(ip) || [0, now]; if (now - h[1] > 600e3) { h[0] = 0; h[1] = now; } h[0]++; hits.set(ip, h); return h[0] > 30; }
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': 'https://genxlinked.com' }); res.end(JSON.stringify(obj)); };
const view = (id) => { const p = db.polls[id] || { counts: [] }; return { id, counts: p.counts, total: p.counts.reduce((a, b) => a + b, 0) }; };
http.createServer((req, res) => {
  if (req.method === 'GET' && /^\/gxl-api\/feed\/substack(-next)?\.xml(\?.*)?$/.test(req.url)) {
    const f = req.url.includes('substack-next') ? 'substack-next.xml' : 'substack.xml'; // -next = one-off batch built by hand for Arun
    try { const body = fs.readFileSync(`${DIR}/${f}`); res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'max-age=300' }); return res.end(body); }
    catch { res.writeHead(503); return res.end('feed not built yet'); }
  }
  if (req.method === 'GET' && req.url.split('?')[0] === '/gxl-api/config') return send(res, 200, { googleClientId: GOOGLE_CLIENT_ID || null });
  if (req.method === 'POST' && req.url.split('?')[0] === '/gxl-api/google') {
    const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || ''), now = Date.now(), h = joinHits.get('g:' + ip) || [0, now];
    if (now - h[1] > 3600e3) { h[0] = 0; h[1] = now; } h[0]++; joinHits.set('g:' + ip, h); if (h[0] > 20) return send(res, 429, { error: 'Too many tries.' });
    let body = ''; req.on('data', (c) => { body += c; if (body.length > 8000) req.destroy(); });
    req.on('end', async () => { try { const j = JSON.parse(body || '{}'); const [st, out] = await google(j.credential); send(res, st, out); } catch (e) { send(res, 400, { error: 'Bad request' }); } });
    return;
  }
  if (req.method === 'POST' && req.url.split('?')[0] === '/gxl-api/join') {
    const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
    let body = ''; req.on('data', (c) => { body += c; if (body.length > 2000) req.destroy(); });
    req.on('end', async () => { try { const j = JSON.parse(body || '{}'); const [st, out] = await join(ip, j.email, j.name); send(res, st, out); } catch (e) { send(res, 400, { error: 'Bad request' }); } });
    return;
  }
  const m = req.url.match(/^\/gxl-api\/poll\/([a-z0-9-]{3,64})\/?$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const id = m[1];
  if (ALLOWED && !ALLOWED.has(id)) return send(res, 404, { error: 'no such poll' });
  if (req.method === 'GET') return send(res, 200, view(id));
  if (id === 'health-check') return send(res, 405, { error: 'read only' });
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
  if (limited(ip)) return send(res, 429, { error: 'slow down' });
  let body = ''; req.on('data', (c) => { body += c; if (body.length > 200) req.destroy(); });
  req.on('end', () => {
    let i; try { i = JSON.parse(body).i; } catch { return send(res, 400, { error: 'bad body' }); }
    if (!Number.isInteger(i) || i < 0 || i >= MAX_OPTS) return send(res, 400, { error: 'bad option' });
    if (!db.polls[id]) { if (Object.keys(db.polls).length >= MAX_POLLS) return send(res, 400, { error: 'too many polls' }); db.polls[id] = { counts: [] }; }
    const k = voterKey(ip, id);
    if (!seen.has(k)) { seen.add(k); const c = db.polls[id].counts; while (c.length <= i) c.push(0); c[i]++; dirty = true; }
    send(res, 200, view(id));
  });
}).listen(PORT, () => console.log(`poll on ${PORT}`));
