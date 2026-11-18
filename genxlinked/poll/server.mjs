#!/usr/bin/env node
// GenX Linked quick polls: tiny vote counter. No accounts, no cookies, no IPs stored.
// GET  /gxl-api/poll/<id>          -> {id, counts:[...], total}
// POST /gxl-api/poll/<id> {"i":N}  -> counts after the vote. One vote per (salted daily hash of client IP + poll) ; the hash is
// kept only to stop repeat votes and the salt rotates every UTC day, so a hash cannot be tied back to an address later.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
const DIR = process.env.POLL_DIR || '/data', FILE = `${DIR}/polls.json`, PORT = Number(process.env.PORT || 2370);
const MAX_POLLS = 500, MAX_OPTS = 6;
// Only poll/quiz ids that exist in the articles (allowed.json, written by scripts/poll-ids.mjs); health-check for the theme probe.
let ALLOWED = null; try { ALLOWED = new Set([...JSON.parse(fs.readFileSync(process.env.POLL_ALLOWED || '/app/allowed.json', 'utf8')), 'health-check']); } catch {}
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
  if (req.method === 'GET' && /^\/gxl-api\/feed\/substack\.xml(\?.*)?$/.test(req.url)) {
    try { res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'max-age=300' }); return res.end(fs.readFileSync(`${DIR}/substack.xml`)); }
    catch { res.writeHead(503); return res.end('feed not built yet'); }
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
