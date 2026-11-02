// X API v2 client for agent 001: OAuth 2.0 user context (PKCE, confidential client) with automatic refresh,
// tokens in ~/a9n9/secrets/x-api.env. Every call is appended to state/x-api-usage.jsonl with the list price
// so the agent can see what X charges it (pay-per-use: post $0.015, post with URL $0.20, own mentions $0.001/item, user lookup $0.01).
import fs from 'node:fs';
import { HOME } from './_lib.mjs';
const F = '/home/ubuntu/a9n9/secrets/x-api.env';
const read = () => Object.fromEntries(fs.readFileSync(F, 'utf8').split('\n').filter(l => /^[A-Z_0-9]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const write = (kv) => fs.writeFileSync(F, Object.entries(kv).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
export const ME_ID = '2116968866450477057';
async function token() {
  const kv = read();
  if (Number(kv.X_TOKEN_EXPIRES_AT) - Date.now() > 120_000) return kv.X_ACCESS_TOKEN;
  const basic = Buffer.from(`${kv.X_OAUTH2_CLIENT_ID}:${kv.X_OAUTH2_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.x.com/2/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: kv.X_REFRESH_TOKEN, client_id: kv.X_OAUTH2_CLIENT_ID }) });
  const tok = await res.json();
  if (!res.ok) throw new Error(`token refresh failed ${res.status}: ${JSON.stringify(tok).slice(0, 200)}`);
  write({ ...kv, X_ACCESS_TOKEN: tok.access_token, X_REFRESH_TOKEN: tok.refresh_token ?? kv.X_REFRESH_TOKEN, X_TOKEN_EXPIRES_AT: String(Date.now() + (tok.expires_in ?? 7200) * 1000) });
  return tok.access_token;
}
export const PRICE = { post: 0.015, postWithUrl: 0.2, mentionsItem: 0.001, userLookup: 0.01, followWrite: 0.015, deletePost: 0.01, postRead: 0.005 };
function usage(entry) { fs.appendFileSync(`${HOME}/state/x-api-usage.jsonl`, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); }
/** Authenticated request; returns { status, body }. Throws only on network/auth setup errors. */
export async function x(method, path, { body, query, price = 0, label = path } = {}) {
  const url = new URL(`https://api.x.com/2${path}`); for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, { method, headers: { authorization: `Bearer ${await token()}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  usage({ label, method, status: res.status, price: res.ok ? price : 0, rateRemaining: res.headers.get('x-rate-limit-remaining'), appLimit24h: res.headers.get('x-app-limit-24hour-remaining'), userLimit24h: res.headers.get('x-user-limit-24hour-remaining') });
  return { status: res.status, body: json };
}
export const hasUrl = (text) => /https?:\/\/|\b[a-z0-9-]+\.(net|com|org|xyz|io|dev|ai|cash)\b/i.test(text);
export function apiError(r) { const b = r.body ?? {}; return b.detail || b.title || (b.errors && b.errors.map(e => e.message || e.detail).join('; ')) || b.raw || `HTTP ${r.status}`; }
