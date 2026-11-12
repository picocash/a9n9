// Bluesky session and calls for bsky-post and bsky-read: plain XRPC over fetch, no library. The app password is in
// /agent/secrets/bsky.env (BSKY_HANDLE, BSKY_APP_PASSWORD), placed by the operator; the account is created by the operator too.
import fs from 'node:fs';
import { HOME, STATE, env } from './_kit.mjs';
const PDS = process.env.BSKY_PDS || 'https://bsky.social', SF = `${STATE}/bsky-session.json`;
export const ready = () => fs.existsSync(`${HOME}/secrets/bsky.env`);
export const NOT_READY = 'the Bluesky account is not set up yet (the operator creates it and places the app password). Nothing to do here until then; it is on the operator\'s list.';
async function login() {
  const e = env(`${HOME}/secrets/bsky.env`);
  const r = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: e.BSKY_HANDLE, password: e.BSKY_APP_PASSWORD }), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`Bluesky sign-in ${r.status}: ${j.message ?? j.error ?? ''}`);
  const s = { at: Date.now(), did: j.did, handle: j.handle, jwt: j.accessJwt }; fs.writeFileSync(SF, JSON.stringify(s), { mode: 0o600 }); return s;
}
export async function session(fresh = false) {
  if (!fresh) { try { const s = JSON.parse(fs.readFileSync(SF, 'utf8')); if (Date.now() - s.at < 50 * 60_000) return s; } catch {} }
  return login();
}
export async function xrpc(method, nsid, body, query) {
  for (let attempt = 0; ; attempt++) {
    const s = await session(attempt > 0);
    const url = `${PDS}/xrpc/${nsid}${query ? `?${new URLSearchParams(query)}` : ''}`;
    const r = await fetch(url, { method, headers: { authorization: `Bearer ${s.jwt}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { s, j };
    if (attempt === 0 && (r.status === 401 || j.error === 'ExpiredToken' || j.error === 'InvalidToken')) continue;
    throw new Error(`Bluesky ${nsid} ${r.status}: ${j.message ?? j.error ?? ''}`);
  }
}
export const graphemes = (t) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)].length;
// hashtags as Bluesky wants them: positions counted in UTF-8 bytes
export function tagFacets(text) {
  const enc = new TextEncoder(); const facets = []; const tags = [];
  for (const m of text.matchAll(/(^|\s)(#([\p{L}\p{N}_]{1,64}))/gu)) {
    const start = m.index + m[1].length; const byteStart = enc.encode(text.slice(0, start)).length;
    facets.push({ index: { byteStart, byteEnd: byteStart + enc.encode(m[2]).length }, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[3] }] }); tags.push(m[3].toLowerCase());
  }
  return { facets, tags };
}
