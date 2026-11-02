// Agent 001's request signing (RFC 9421, Web Bot Auth / Visa TAP profile). Mirrors services/web/src/httpsig.ts.
// Key: ~/a9n9/secrets/agent001-signing.env (AGENT_SIGNING_SEED hex, AGENT_SIGNING_X, AGENT_SIGNING_KID, SIGNATURE_AGENT).
// Public key is published at https://agent001.a9n9.net/.well-known/http-message-signatures-directory.
import fs from 'node:fs';
import { createHash, createPrivateKey, randomBytes, sign as edSign } from 'node:crypto';
const kv = Object.fromEntries(fs.readFileSync('/home/ubuntu/a9n9/secrets/agent001-signing.env', 'utf8').split('\n').filter(l => /^[A-Z_0-9]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const jwk = { kty: 'OKP', crv: 'Ed25519', x: kv.AGENT_SIGNING_X };
export const KID = createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })).digest('base64url');
export const SIGNATURE_AGENT = kv.SIGNATURE_AGENT || 'https://agent001.a9n9.net';
const key = createPrivateKey({ key: { ...jwk, d: Buffer.from(kv.AGENT_SIGNING_SEED, 'hex').toString('base64url') }, format: 'jwk' });
const sf = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Headers that identify agent 001 on a request to `url`. tag: web-bot-auth (default) | agent-browser-auth | agent-payer-auth */
export function signHeaders(url, { tag = 'web-bot-auth', ttl = 60, withPath = false } = {}) {
  const u = new URL(url); const now = Math.floor(Date.now() / 1000);
  const comps = [['@authority', u.host.toLowerCase()]]; if (withPath) comps.push(['@path', u.pathname]); comps.push(['signature-agent', sf(SIGNATURE_AGENT)]);
  const params = `(${comps.map(([n]) => `"${n}"`).join(' ')});created=${now};expires=${now + ttl};keyid=${sf(KID)};alg="ed25519";tag=${sf(tag)};nonce=${sf(randomBytes(16).toString('base64url'))}`;
  const base = comps.map(([n, v]) => `"${n}": ${v}`).concat([`"@signature-params": ${params}`]).join('\n');
  const sig = edSign(null, Buffer.from(base, 'utf8'), key).toString('base64');
  return { 'Signature-Input': `sig1=${params}`, Signature: `sig1=:${sig}:`, 'Signature-Agent': sf(SIGNATURE_AGENT) };
}

/** fetch() that signs every request as agent 001. */
export function signedFetch(url, init = {}, opts = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...signHeaders(url, opts) } });
}
