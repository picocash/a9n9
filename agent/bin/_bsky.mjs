// Bluesky (AT Protocol) client for agent 001: app password session with refresh, cached in state/bsky-session.json.
// Credentials in ~/a9n9/secrets/bluesky.env (BSKY_SERVICE, BSKY_HANDLE, BSKY_PASSWORD). Plain XRPC over fetch; no SDK.
import fs from 'node:fs';
import { HOME } from './_lib.mjs';
const kv = Object.fromEntries(fs.readFileSync('/home/ubuntu/a9n9/secrets/bluesky.env', 'utf8').split('\n').filter(l => /^[A-Z_0-9]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
export const SERVICE = kv.BSKY_SERVICE || 'https://bsky.social'; export const HANDLE = kv.BSKY_HANDLE;
const SF = `${HOME}/state/bsky-session.json`;
let session = fs.existsSync(SF) ? JSON.parse(fs.readFileSync(SF, 'utf8')) : null;
const save = (s) => { session = s; fs.writeFileSync(SF, JSON.stringify(s), { mode: 0o600 }); };
const expSoon = (jwt) => { try { const p = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()); return p.exp * 1000 - Date.now() < 60_000; } catch { return true; } };
async function login() { const r = await fetch(`${SERVICE}/xrpc/com.atproto.server.createSession`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: HANDLE, password: kv.BSKY_PASSWORD }) }); const j = await r.json(); if (!r.ok) throw new Error(`bsky login failed: ${j.message ?? r.status}`); save(j); return j; }
async function ensure() {
  if (!session) return login();
  if (!expSoon(session.accessJwt)) return session;
  if (!expSoon(session.refreshJwt)) { const r = await fetch(`${SERVICE}/xrpc/com.atproto.server.refreshSession`, { method: 'POST', headers: { authorization: `Bearer ${session.refreshJwt}` } }); if (r.ok) { save({ ...session, ...(await r.json()) }); return session; } }
  return login();
}
/** XRPC call. GET with query, or POST with JSON body. */
export async function xrpc(method, nsid, { query, body, headers } = {}) {
  const s = await ensure();
  const url = new URL(`${SERVICE}/xrpc/${nsid}`); for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${s.accessJwt}`, ...(body && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...(headers ?? {}) }, body: body ? (body instanceof Uint8Array ? body : JSON.stringify(body)) : undefined });
  const j = await r.json().catch(() => ({})); return { status: r.status, body: j, did: s.did };
}
/** Minimal rich-text facets for links and @mentions so they render as links. */
export async function facets(text) {
  const out = []; const enc = new TextEncoder(); const bytePos = (i) => enc.encode(text.slice(0, i)).length;
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) out.push({ index: { byteStart: bytePos(m.index), byteEnd: bytePos(m.index + m[0].length) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  for (const m of text.matchAll(/(^|\s)@([a-z0-9.-]+\.[a-z]{2,})/gi)) { const handle = m[2]; const r = await xrpc('GET', 'com.atproto.identity.resolveHandle', { query: { handle } }); if (r.body?.did) { const start = m.index + m[1].length; out.push({ index: { byteStart: bytePos(start), byteEnd: bytePos(start + handle.length + 1) }, features: [{ $type: 'app.bsky.richtext.facet#mention', did: r.body.did }] }); } }
  return out;
}
export async function createPost(text, reply) {
  const s = await ensure();
  const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString(), facets: await facets(text), ...(reply ? { reply } : {}) };
  return xrpc('POST', 'com.atproto.repo.createRecord', { body: { repo: s.did, collection: 'app.bsky.feed.post', record } });
}
export const postUrl = (uri) => { const m = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/); return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : uri; };
