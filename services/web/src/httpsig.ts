/**
 * HTTP Message Signatures (RFC 9421) for agents: the Web Bot Auth profile that
 * Cloudflare verifies and that Visa's Trusted Agent Protocol builds on.
 *
 *  - signing: an agent attaches Signature-Input, Signature and Signature-Agent to a
 *    request; the covered components are at least "@authority" and "signature-agent".
 *  - key directory: the agent's public keys are a JWKS served at
 *    /.well-known/http-message-signatures-directory, itself signed over ("@authority";req)
 *    with tag "http-message-signatures-directory", one signature per key.
 *  - verifying: a server parses the headers, fetches the key named by keyid from the
 *    directory the Signature-Agent header points to (or a configured TAP directory),
 *    rebuilds the signature base, checks the time window and nonce, and verifies Ed25519.
 *
 * Only Ed25519 (JWK OKP/Ed25519) is implemented; it is what both profiles use.
 */
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign as edSign, verify as edVerify, type KeyObject } from 'node:crypto';

export interface Jwk { kty: 'OKP'; crv: 'Ed25519'; x: string; kid?: string | undefined; use?: string | undefined; alg?: string | undefined }
export interface Signer { kid: string; jwk: Jwk; sign: (base: string) => Buffer }

/** RFC 7638 thumbprint of an Ed25519 JWK: SHA-256 over the canonical {crv,kty,x}. */
export function thumbprint(jwk: Jwk): string {
  return createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })).digest('base64url');
}

/** Build a signer from a 32-byte hex seed (the JWK "d" value) and its public "x". */
export function signerFromSeed(seedHex: string, x: string): Signer {
  const d = Buffer.from(seedHex, 'hex').toString('base64url');
  const key = createPrivateKey({ key: { kty: 'OKP', crv: 'Ed25519', d, x }, format: 'jwk' });
  const jwk: Jwk = { kty: 'OKP', crv: 'Ed25519', x };
  return { kid: thumbprint(jwk), jwk, sign: (base) => edSign(null, Buffer.from(base, 'utf8'), key) };
}

export interface Component { name: string; value: string; params?: string | undefined }

/** The signature base: one line per covered component, then the @signature-params line. No trailing newline. */
export function signatureBase(components: Component[], params: string): string {
  const lines = components.map((c) => `"${c.name}"${c.params ?? ''}: ${c.value}`);
  lines.push(`"@signature-params": ${params}`);
  return lines.join('\n');
}

const sfString = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export interface SignOptions {
  authority: string;            // host[:port], lowercase
  signatureAgent: string;       // https URL of the agent's key directory host, e.g. https://agent001.a9n9.net
  signer: Signer;
  tag?: string;                 // "web-bot-auth" (default) | "agent-browser-auth" | "agent-payer-auth"
  path?: string;                // include "@path" when given (TAP covers it)
  ttlSeconds?: number;          // default 60; TAP caps created→expires at 8 minutes
  now?: number;                 // seconds
  nonce?: string;
  label?: string;
}

/** Headers to attach to an outgoing request. */
export function signRequest(o: SignOptions): Record<string, string> {
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const tag = o.tag ?? 'web-bot-auth';
  const nonce = o.nonce ?? randomBytes(16).toString('base64url');
  const sa = sfString(o.signatureAgent);
  const comps: Component[] = [{ name: '@authority', value: o.authority.toLowerCase() }];
  if (o.path) comps.push({ name: '@path', value: o.path });
  comps.push({ name: 'signature-agent', value: sa });
  const params = `(${comps.map((c) => `"${c.name}"`).join(' ')});created=${now};expires=${now + (o.ttlSeconds ?? 60)};keyid=${sfString(o.signer.kid)};alg="ed25519";tag=${sfString(tag)};nonce=${sfString(nonce)}`;
  const sig = o.signer.sign(signatureBase(comps, params));
  const label = o.label ?? 'sig1';
  return { 'Signature-Input': `${label}=${params}`, Signature: `${label}=:${sig.toString('base64')}:`, 'Signature-Agent': sa };
}

/** The key directory response: a JWKS of public keys, signed once per key over ("@authority";req). */
export function directoryResponse(authority: string, signers: Signer[], now = Math.floor(Date.now() / 1000)): { body: string; headers: Record<string, string> } {
  const inputs: string[] = []; const sigs: string[] = [];
  signers.forEach((s, i) => {
    const params = `("@authority";req);created=${now};expires=${now + 300};keyid=${sfString(s.kid)};alg="ed25519";tag="http-message-signatures-directory"`;
    const base = signatureBase([{ name: '@authority', value: authority.toLowerCase(), params: ';req' }], params);
    inputs.push(`sig${i + 1}=${params}`); sigs.push(`sig${i + 1}=:${s.sign(base).toString('base64')}:`);
  });
  return {
    body: JSON.stringify({ keys: signers.map((s) => ({ kty: s.jwk.kty, crv: s.jwk.crv, x: s.jwk.x, kid: s.kid, use: 'sig', alg: 'EdDSA' })) }),
    headers: { 'content-type': 'application/http-message-signatures-directory+json', 'cache-control': 'public, max-age=300', 'Signature-Input': inputs.join(', '), Signature: sigs.join(', ') },
  };
}

// ---------- verification ----------

export interface ParsedInput { label: string; components: Array<{ name: string; params: string }>; params: Record<string, string | number>; raw: string }

/** Parse one member of a Signature-Input dictionary: label=("a" "b";req);created=1;keyid="k" */
export function parseSignatureInput(header: string): ParsedInput[] {
  const out: ParsedInput[] = [];
  // split on top-level commas (not inside quotes or parens)
  const members: string[] = []; let depth = 0, q = false, cur = '';
  for (const ch of header) { if (ch === '"' ) q = !q; if (!q) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { members.push(cur); cur = ''; continue; } } cur += ch; }
  if (cur.trim()) members.push(cur);
  for (const m of members) {
    const eq = m.indexOf('='); if (eq < 0) continue;
    const label = m.slice(0, eq).trim(); const rest = m.slice(eq + 1).trim();
    const close = rest.indexOf(')'); if (!rest.startsWith('(') || close < 0) continue;
    const inner = rest.slice(1, close).trim();
    const components = inner ? inner.split(/\s+(?=")/).map((c) => { const mm = c.match(/^"([^"]+)"(.*)$/); return mm ? { name: mm[1]!, params: mm[2] ?? '' } : { name: c, params: '' }; }) : [];
    const params: Record<string, string | number> = {};
    for (const p of rest.slice(close + 1).split(';')) { const t = p.trim(); if (!t) continue; const i = t.indexOf('='); if (i < 0) { params[t] = ''; continue; } const k = t.slice(0, i), v = t.slice(i + 1); params[k] = v.startsWith('"') ? v.slice(1, -1).replace(/\\(.)/g, '$1') : (/^\d+$/.test(v) ? Number(v) : v); }
    out.push({ label, components, params, raw: rest });
  }
  return out;
}

export function parseSignature(header: string): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  for (const m of header.split(/,(?=\s*[A-Za-z0-9_-]+=:)/)) { const mm = m.trim().match(/^([A-Za-z0-9_-]+)=:([A-Za-z0-9+/=]+):$/); if (mm) out[mm[1]!] = Buffer.from(mm[2]!, 'base64'); }
  return out;
}

export interface IncomingRequest { method: string; authority: string; path: string; scheme?: string; headers: Record<string, string | string[] | undefined> }
export interface VerifyResult { ok: boolean; signed: boolean; reason?: string | undefined; tag?: string | undefined; kid?: string | undefined; agent?: string | undefined; created?: number | undefined; expires?: number | undefined }
export type KeyFetcher = (agentDirectory: string | undefined, kid: string, tag: string) => Promise<Jwk | undefined>;

const seenNonces = new Map<string, number>();
function nonceSeen(n: string, now: number): boolean { for (const [k, t] of seenNonces) if (t < now - 600) seenNonces.delete(k); if (seenNonces.has(n)) return true; seenNonces.set(n, now); return false; }

/** Verify the first Ed25519 signature on an incoming request. Never throws; unsigned requests return {signed:false}. */
export async function verifyRequest(req: IncomingRequest, fetchKey: KeyFetcher, now = Math.floor(Date.now() / 1000)): Promise<VerifyResult> {
  const h = (n: string) => { const v = req.headers[n.toLowerCase()]; return Array.isArray(v) ? v.join(', ') : v; };
  const si = h('signature-input'), sg = h('signature');
  if (!si || !sg) return { ok: false, signed: false };
  const inputs = parseSignatureInput(si); const sigs = parseSignature(sg);
  const input = inputs.find((i) => sigs[i.label]); if (!input) return { ok: false, signed: true, reason: 'no matching Signature for Signature-Input' };
  const p = input.params; const tag = String(p.tag ?? ''); const kid = String(p.keyid ?? ''); const created = Number(p.created), expires = Number(p.expires);
  const agent = h('signature-agent')?.replace(/^"|"$/g, '');
  if (!kid || !created || !expires) return { ok: false, signed: true, reason: 'missing keyid/created/expires', tag, kid, agent };
  if (!['web-bot-auth', 'agent-browser-auth', 'agent-payer-auth', 'http-message-signatures-directory'].includes(tag)) return { ok: false, signed: true, reason: `unknown tag ${tag}`, tag, kid, agent };
  if (created > now + 30) return { ok: false, signed: true, reason: 'created is in the future', tag, kid, agent, created, expires };
  if (expires < now) return { ok: false, signed: true, reason: 'expired', tag, kid, agent, created, expires };
  if (expires - created > 8 * 60) return { ok: false, signed: true, reason: 'created→expires exceeds 8 minutes', tag, kid, agent, created, expires };
  if (p.alg !== undefined && String(p.alg).toLowerCase() !== 'ed25519') return { ok: false, signed: true, reason: `unsupported alg ${p.alg}`, tag, kid, agent };
  const comps: Component[] = [];
  for (const c of input.components) {
    let value: string | undefined;
    switch (c.name) {
      case '@authority': value = req.authority.toLowerCase(); break;
      case '@path': value = req.path; break;
      case '@method': value = req.method.toUpperCase(); break;
      case '@scheme': value = req.scheme ?? 'https'; break;
      case '@target-uri': value = `${req.scheme ?? 'https'}://${req.authority}${req.path}`; break;
      default: if (c.name.startsWith('@')) return { ok: false, signed: true, reason: `unsupported component ${c.name}`, tag, kid, agent }; value = h(c.name)?.trim();
    }
    if (value === undefined) return { ok: false, signed: true, reason: `covered header ${c.name} missing`, tag, kid, agent };
    comps.push({ name: c.name, value, params: c.params });
  }
  if (!comps.some((c) => c.name === '@authority')) return { ok: false, signed: true, reason: '@authority not covered', tag, kid, agent };
  const jwk = await fetchKey(agent, kid, tag).catch(() => undefined);
  if (!jwk) return { ok: false, signed: true, reason: 'public key not found', tag, kid, agent, created, expires };
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') return { ok: false, signed: true, reason: 'key is not Ed25519', tag, kid, agent };
  let key: KeyObject; try { key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' }); } catch { return { ok: false, signed: true, reason: 'bad public key', tag, kid, agent }; }
  const base = signatureBase(comps, input.raw);
  const good = edVerify(null, Buffer.from(base, 'utf8'), key, sigs[input.label]!);
  if (!good) return { ok: false, signed: true, reason: 'signature does not verify', tag, kid, agent, created, expires };
  if (p.nonce !== undefined && nonceSeen(`${kid}:${p.nonce}`, now)) return { ok: false, signed: true, reason: 'nonce replayed', tag, kid, agent, created, expires };
  return { ok: true, signed: true, tag, kid, agent, created, expires };
}

/** Default key fetcher: the Signature-Agent's well-known directory, else an optional TAP directory (JWKS URL) for TAP tags. */
export function makeKeyFetcher(opts: { tapDirectory?: string | undefined; fetchImpl?: typeof fetch | undefined } = {}): KeyFetcher {
  const f = opts.fetchImpl ?? fetch; const cache = new Map<string, { at: number; keys: Jwk[] }>();
  async function jwks(url: string): Promise<Jwk[]> {
    const c = cache.get(url); if (c && Date.now() - c.at < 300_000) return c.keys;
    const r = await f(url, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/http-message-signatures-directory+json, application/json' } });
    if (!r.ok) return [];
    const j = (await r.json()) as { keys?: Jwk[] }; const keys = (j.keys ?? []).filter((k) => k.kty === 'OKP' && k.crv === 'Ed25519' && typeof k.x === 'string');
    cache.set(url, { at: Date.now(), keys }); return keys;
  }
  return async (agent, kid, tag) => {
    const urls: string[] = [];
    if (agent && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(agent)) urls.push(`${agent}/.well-known/http-message-signatures-directory`);
    if (opts.tapDirectory && (tag === 'agent-browser-auth' || tag === 'agent-payer-auth')) urls.push(opts.tapDirectory);
    for (const u of urls) { const keys = await jwks(u); const k = keys.find((x) => x.kid === kid || thumbprint(x) === kid); if (k) return k; }
    return undefined;
  };
}
