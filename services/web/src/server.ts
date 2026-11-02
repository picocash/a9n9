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
import { renderPage } from './page.js';

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
    { label: 'Reserves', value: 'reserves.a9n9.net', href: 'https://reserves.a9n9.net' },
  ],
};
const html = renderPage(model);

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
    if (url.pathname === '/' && req.method === 'GET') return send(res, 200, html, 'text/html; charset=utf-8');
    if (url.pathname === '/ledger.json' && req.method === 'GET') return send(res, 200, await ledger());
    if (url.pathname === '/chat' && req.method === 'POST') {
      const key = clientKey(req);
      if (!allow(key)) return send(res, 429, { error: 'too many messages from this address; try again in a few minutes' });
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      const who = String(body.who ?? '').trim().slice(0, 80);
      if (!text || text.length > 4000) return send(res, 400, { error: 'message required (≤4000 chars)' });
      const id = `web:${randomUUID()}`;
      const r = await postToInbox({ id, type: 'web.chat', channel: 'web', who, text, source: key, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200), sentAt: new Date().toISOString() });
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
