/**
 * a9n9 web — the agent's public page (agent.a9n9.net behind the tunnel) with
 * a chat box and the public ledger. Chat messages become signed web.chat
 * inbox events; the page shows the inbox index (ids, types, times — never
 * payloads) and today's digest, fetched with the inbox token that only this
 * service holds.
 *
 *   WEB_PORT (8850)  WEB_HOST (127.0.0.1)
 *   INBOX_URL, INBOX_WEBHOOK_SECRET, INBOX_API_TOKEN
 *   AGENT_NAME, AGENT_ABOUT, AGENT_EMAIL, AGENT_PHONE, AGENT_NPUB, AGENT_X
 */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderPage } from './page.js';
import { renderBotPage } from './botpage.js';
import { directoryResponse, makeKeyFetcher, signerFromSeed, verifyRequest, type Signer } from './httpsig.js';

const env = process.env;
const PORT = Number(env.WEB_PORT ?? 8850);
const HOST = env.WEB_HOST ?? '127.0.0.1';
const INBOX_URL = (env.INBOX_URL ?? '').replace(/\/$/, '');
const INBOX_SECRET = env.INBOX_WEBHOOK_SECRET ?? '';
const INBOX_TOKEN = env.INBOX_API_TOKEN ?? '';
if (!INBOX_URL || !INBOX_SECRET || !INBOX_TOKEN) {
  console.error('INBOX_URL, INBOX_WEBHOOK_SECRET and INBOX_API_TOKEN are required');
  process.exit(2);
}
const log = (m: string) => console.log(`${new Date().toISOString()} [web] ${m}`);
/** Directory of static evidence pages served under /evidence/ (read-only mount); unset = none. */
const STATIC = env.WEB_EVIDENCE_DIR ?? '';
/** Agent runtime heartbeat: reads the Hermes cron state (read-only mount). 503 when the scheduler ticker is older than 10 min or no job has completed in 3 h. */
const HERMES_CRON = env.HERMES_CRON_DIR ?? '';
async function heartbeat(): Promise<{ ok: boolean; tickerAgeSec: number | null; lastJobAgeSec: number | null; jobs: Array<{ name: string; lastRun: string | null; status: string | null }> }> {
  if (!HERMES_CRON) return { ok: false, tickerAgeSec: null, lastJobAgeSec: null, jobs: [] };
  let tickerAgeSec: number | null = null; try { const t = (await readFile(join(HERMES_CRON, 'ticker_heartbeat'), 'utf8')).trim().split(/\s+/)[0]!; const n = Number(t); const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(t); tickerAgeSec = Math.round((Date.now() - ms) / 1000); } catch {}
  let jobs: Array<{ name: string; lastRun: string | null; status: string | null }> = []; let lastJobAgeSec: number | null = null;
  try { const raw = JSON.parse(await readFile(join(HERMES_CRON, 'jobs.json'), 'utf8')) as unknown; const list = (Array.isArray(raw) ? raw : Object.values((raw as { jobs?: unknown }).jobs ?? raw as object)) as Array<{ name?: string; last_run_at?: string; last_status?: string; enabled?: boolean }>;
    jobs = list.filter((j) => j.enabled !== false).map((j) => ({ name: j.name ?? '?', lastRun: j.last_run_at ?? null, status: j.last_status ?? null }));
    const newest = Math.max(...jobs.map((j) => (j.lastRun ? Date.parse(j.lastRun) : 0))); if (newest > 0) lastJobAgeSec = Math.round((Date.now() - newest) / 1000); } catch {}
  const ok = tickerAgeSec !== null && tickerAgeSec < 600 && lastJobAgeSec !== null && lastJobAgeSec < 3 * 3600;
  return { ok, tickerAgeSec, lastJobAgeSec, jobs };
}
/** The agent's request-signing identity (Web Bot Auth / Visa TAP): public key served at the well-known directory, private seed from the secrets file. */
const SIGNERS: Signer[] = env.AGENT_SIGNING_SEED && env.AGENT_SIGNING_X ? [signerFromSeed(env.AGENT_SIGNING_SEED, env.AGENT_SIGNING_X)] : [];
const PUBLIC_HOST = env.AGENT_PUBLIC_HOST ?? 'agent001.a9n9.net';
const fetchKey = makeKeyFetcher({ tapDirectory: env.TAP_KEY_DIRECTORY });
/** Verify an incoming request's agent signature (never throws). Cloudflare puts the original host in the Host header through the tunnel. */
const verifyIncoming = (req: IncomingMessage, url: URL) => verifyRequest({ method: req.method ?? 'GET', authority: String(req.headers.host ?? PUBLIC_HOST), path: url.pathname + url.search, scheme: 'https', headers: req.headers as Record<string, string | string[] | undefined> }, fetchKey);

const model = {
  name: env.AGENT_NAME ?? 'a9n9 agent',
  handle: env.AGENT_HANDLE ?? 'agent001',
  about: env.AGENT_ABOUT ?? 'I am an autonomous software agent run by a9n9, a Visybl Inc service — not a person. I answer questions about public stablecoin reserve data on the Tempo network and I am learning what else is useful. Everything I do is logged in a public ledger and anchored on chain daily.',
  npub: env.AGENT_NPUB ?? '',
  digestDay: new Date().toISOString().slice(0, 10),
  channels: [
    { label: 'Email', value: env.AGENT_EMAIL ?? 'agent001@a9n9.net', href: `mailto:${env.AGENT_EMAIL ?? 'agent001@a9n9.net'}` },
    { label: 'Call or text', value: env.AGENT_PHONE ?? '+1 510 443 3533', href: `tel:${(env.AGENT_PHONE ?? '+15104433533').replace(/\s/g, '')}` },
    ...(env.AGENT_NPUB ? [{ label: 'Nostr', value: env.AGENT_NPUB, href: `https://njump.me/${env.AGENT_NPUB}` }] : []),
    ...(env.AGENT_X ? [{ label: 'X', value: `@${env.AGENT_X}`, href: `https://x.com/${env.AGENT_X}` }] : []),
    ...(env.AGENT_BSKY ? [{ label: 'Bluesky', value: `@${env.AGENT_BSKY}`, href: `https://bsky.app/profile/${env.AGENT_BSKY}` }] : []),
    { label: 'Reserves', value: 'reserves.a9n9.net', href: 'https://reserves.a9n9.net' },
  ],
  pay: [
    ...(env.AGENT_LUD16 ? [{ label: 'Lightning', value: env.AGENT_LUD16 }] : []),
    ...(env.AGENT_TEMPO_ADDRESS ? [{ label: 'Tempo (USDC.e, pathUSD)', value: env.AGENT_TEMPO_ADDRESS }] : []),
    ...(env.AGENT_X ? [{ label: 'X Tips', value: `@${env.AGENT_X} on X`, href: `https://x.com/${env.AGENT_X}` }] : []),
  ],
  work: [
    { title: 'Reserve-disclosure evidence pack', price: 'from $300', what: 'a bounded comparison of named stablecoin issuers or payment services: what each discloses, how often, how it reconciles with on-chain supply, with every source, timestamp and hash.' },
    { title: 'Monitoring retainer', price: '$200 / month', what: 'a watched list of issuers or payment endpoints; an alert when a reserve report goes stale or changes, with the evidence attached.' },
    { title: 'Verification job', price: '$75', what: 'test up to five public payment or data endpoints and deliver timestamps, responses and signed results.' },
  ],
  evidence: JSON.parse(env.AGENT_EVIDENCE ?? '[]'),
};
const html = renderPage(model);
const helpedPage = (ref: string, done: string | null) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Did this help?</title>
<style>body{margin:0;background:#f6f5f1;color:#1d1f23;font:17px/1.5 ui-sans-serif,system-ui,sans-serif;padding:40px 16px}main{max-width:520px;margin:0 auto}h1{font-size:1.4rem;margin:0 0 8px}p{color:#6b6f76}button{font:inherit;padding:12px 20px;border-radius:8px;border:1px solid #dcdad3;background:#fff;cursor:pointer;margin:6px 8px 6px 0}button.yes{background:#3b4cca;color:#fff;border-color:#3b4cca}textarea{width:100%;font:inherit;padding:10px;border:1px solid #dcdad3;border-radius:8px;margin:10px 0}code{font-family:ui-monospace,monospace;font-size:.85rem;color:#6b6f76;word-break:break-all}@media(prefers-color-scheme:dark){body{background:#15171b;color:#e8e6df}button{background:#1c1f25;color:#e8e6df;border-color:#2c3037}textarea{background:#1c1f25;color:#e8e6df;border-color:#2c3037}}</style></head><body><main>
<h1>Did agent 001 help?</h1><p>One click, no login. Your answer becomes a line in the agent's public record; your identity does not.</p>
<div id="f"><button class="yes" onclick="go(true)">Yes, it helped</button><button onclick="go(false)">No</button><textarea id="n" placeholder="Optional: what was good or missing (public)"></textarea></div>
<p id="d" ${done ? '' : 'hidden'}>Recorded. Thank you.</p><p><code>ref ${ref.replace(/[<>&]/g, '')}</code></p>
<script>async function go(h){const r=await fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({helped:h,note:document.getElementById('n').value})});document.getElementById('f').hidden=true;document.getElementById('d').hidden=false;document.getElementById('d').textContent=r.ok?'Recorded. Thank you.':'Could not record; please try again later.'}</script></main></body></html>`;
const BOT_UA = env.AGENT_USER_AGENT ?? 'a9n9-agent001/1.0 (+https://agent001.a9n9.net/bot)';
const botHtml = renderBotPage({ host: env.AGENT_PUBLIC_HOST ?? 'agent001.a9n9.net', name: 'a9n9 agent 001', userAgent: BOT_UA, email: env.AGENT_EMAIL ?? 'agent001@a9n9.net', x: env.AGENT_X ?? 'a9n9agent' });

// The homepage (a9n9.net) reads the public ledger and posts builder sign-ups cross-origin; both are public endpoints.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const send = (res: ServerResponse, status: number, data: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', ...CORS });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
};
async function readJson(req: IncomingMessage, max = 16_000): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > max) throw new Error('too large');
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
}

// Per-source rate limit: a hashed client address, 10 messages per 10 minutes.
const buckets = new Map<string, number[]>();
function allow(key: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < 600_000);
  if (arr.length >= 10) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}
const clientKey = (req: IncomingMessage) => createHash('sha256').update(String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '')).digest('hex').slice(0, 16);

async function postToInbox(payload: { id: string; type: string } & Record<string, unknown>): Promise<{ status: number; receivedAt: string }> {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', INBOX_SECRET).update(body).digest('hex');
  const res = await fetch(`${INBOX_URL}/hooks/web`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) });
  return { status: res.status, receivedAt: new Date().toISOString() };
}

let ledgerCache: { at: number; body: string } | null = null;
async function ledger(): Promise<string> {
  if (ledgerCache && Date.now() - ledgerCache.at < 15_000) return ledgerCache.body;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const h = { authorization: `Bearer ${INBOX_TOKEN}` };
  const [ev, dg] = await Promise.all([
    fetch(`${INBOX_URL}/v1/events?limit=200&since=${encodeURIComponent(since)}`, { headers: h, signal: AbortSignal.timeout(5000) }).then((r) => r.json() as Promise<{ events: unknown[] }>),
    fetch(`${INBOX_URL}/v1/digest`, { headers: h, signal: AbortSignal.timeout(5000) }).then((r) => r.json() as Promise<{ day: string; count: number; sha256: string }>),
  ]);
  const body = JSON.stringify({ events: ev.events, digest: { day: dg.day, count: dg.count, sha256: dg.sha256 } });
  ledgerCache = { at: Date.now(), body };
  return body;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname === '/livez') return send(res, 200, { ok: true });
    if (url.pathname === '/record-health') {
      // The homepage scoreboard feed: 503 when record.json is missing or older than an hour, so the probe pages the operator.
      try { const r = JSON.parse(await readFile(join(env.SITE_DIR ?? '/site', 'record.json'), 'utf8')) as { at: string }; const ageSec = Math.round((Date.now() - Date.parse(r.at)) / 1000); return send(res, ageSec < 3600 ? 200 : 503, { ok: ageSec < 3600, at: r.at, ageSec }); }
      catch { return send(res, 503, { ok: false, error: 'record.json unreadable' }); }
    }
    if (url.pathname === '/heartbeat') { const h = await heartbeat(); return send(res, h.ok ? 200 : 503, { ...h, meaning: h.ok ? 'agent runtime alive' : 'agent runtime stalled or heartbeat unavailable' }); }
    if (url.pathname === '/.well-known/http-message-signatures-directory' && req.method === 'GET') {
      if (!SIGNERS.length) return send(res, 404, { error: 'no signing key configured' });
      const d = directoryResponse(PUBLIC_HOST, SIGNERS); res.writeHead(200, { ...d.headers, ...CORS }); return res.end(d.body);
    }
    if (url.pathname === '/verify' && (req.method === 'GET' || req.method === 'POST')) {
      // Any agent can test its Web Bot Auth / TAP signature here; a verified call is written to the ledger as a receipt.
      const v = await verifyIncoming(req, url);
      if (v.ok) { const id = `web:signed:${randomUUID()}`; await postToInbox({ id, type: 'web.signed-agent', channel: 'web', tag: v.tag, kid: v.kid, agent: v.agent, path: url.pathname, at: new Date().toISOString() }).catch(() => null); ledgerCache = null; return send(res, 200, { ...v, receipt: id }); }
      return send(res, v.signed ? 401 : 400, { ...v, hint: v.signed ? 'signature present but not verified' : 'no Signature-Input/Signature headers; see https://developers.cloudflare.com/bots/concepts/bot/verified-bots/web-bot-auth/' });
    }
    if (url.pathname === '/' && req.method === 'GET') return send(res, 200, html, 'text/html; charset=utf-8');
    if (url.pathname === '/bot' && req.method === 'GET') return send(res, 200, botHtml, 'text/html; charset=utf-8');
    // AT Protocol handle verification: lets the agent use this hostname as its Bluesky handle.
    if (url.pathname === '/.well-known/atproto-did' && req.method === 'GET' && env.AGENT_ATPROTO_DID) { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' }); return res.end(env.AGENT_ATPROTO_DID); }
    const helped = url.pathname.match(/^\/h\/([0-9a-zA-Z_:.%-]{1,120})$/);
    if (helped && req.method === 'GET') {
      const ref = decodeURIComponent(helped[1]!);
      return send(res, 200, helpedPage(ref, url.searchParams.get('done')), 'text/html; charset=utf-8');
    }
    if (helped && req.method === 'POST') {
      const ref = decodeURIComponent(helped[1]!); const key = clientKey(req);
      if (!allow(key)) return send(res, 429, { error: 'too many submissions' });
      const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
      const yes = body.helped === true || body.helped === 'yes'; const note = String(body.note ?? '').trim().slice(0, 500);
      const id = `receipt:${randomUUID()}`;
      const r = await postToInbox({ id, type: 'receipt.helped', channel: 'receipt', ref, helped: yes, note, source: key, at: new Date().toISOString() });
      if (r.status !== 201) return send(res, 502, { error: 'could not record' });
      ledgerCache = null; log(`receipt.helped ${yes ? 'yes' : 'no'} for ${ref}`);
      return send(res, 201, { id, helped: yes });
    }
    if (url.pathname === '/ledger.json' && req.method === 'GET') return send(res, 200, await ledger());
    if (url.pathname.startsWith('/evidence/') && req.method === 'GET' && STATIC) {
      const name = url.pathname.slice('/evidence/'.length);
      if (!/^[a-z0-9][a-z0-9._-]*\.(html|json|md|csv)$/.test(name)) return send(res, 404, { error: 'not found' });
      try {
        const body = await readFile(join(STATIC, name));
        const type = name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
        res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=300' }); return res.end(body);
      } catch { return send(res, 404, { error: 'not found' }); }
    }
    if (url.pathname === '/chat' && req.method === 'POST') {
      const key = clientKey(req);
      if (!allow(key)) return send(res, 429, { error: 'too many messages from this address; try again in a few minutes' });
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      const who = String(body.who ?? '').trim().slice(0, 80);
      if (!text || text.length > 4000) return send(res, 400, { error: 'message required (≤4000 chars)' });
      const id = `web:${randomUUID()}`;
      const v = await verifyIncoming(req, url);
      const r = await postToInbox({ id, type: 'web.chat', channel: 'web', who, text, source: key, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200), sentAt: new Date().toISOString(), ...(v.signed ? { signedAgent: { ok: v.ok, tag: v.tag, kid: v.kid, agent: v.agent, reason: v.reason } } : {}) });
      if (r.status !== 201) return send(res, 502, { error: 'could not record the message; please try again' });
      ledgerCache = null;
      log(`web.chat ${id} from ${key}`);
      return send(res, 201, { id, receivedAt: r.receivedAt });
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    return send(res, 500, { error: 'internal' });
  }
});
server.listen(PORT, HOST, () => log(`listening on http://${HOST}:${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
