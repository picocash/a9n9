/**
 * wa-relay — the only shared piece in the message path, and only because Meta sends every number
 * under one app to one webhook URL. It checks Meta's signature, splits the webhook by business
 * number (phone_number_id), and forwards each part unchanged to the agent that owns that number,
 * signed with that agent's own secret. No storage, no logic, no message is ever read or kept.
 *
 *   GET  /whatsapp   Meta's subscription handshake (hub.verify_token → hub.challenge)
 *   POST /whatsapp   X-Hub-Signature-256 with WA_APP_SECRET; fan out per number
 *
 * Env: WA_APP_SECRET, WA_VERIFY_TOKEN, WA_ROUTES = JSON {"<phone_number_id>": {"url": "http://comms-agent001:8870/whatsapp", "secret": "…"}},
 *      RELAY_HOST (127.0.0.1), RELAY_PORT (8871)
 */
import { createServer, type IncomingMessage } from 'node:http';
import { hubSignature, splitByNumber, verifyHub, type WaWebhook } from './whatsapp.js';

export interface RelayConfig { appSecret: string; verifyToken: string; routes: Record<string, { url: string; secret: string }>; fetchImpl?: typeof fetch; log?: (m: string) => void }

const readBody = (req: IncomingMessage, max = 1024 * 1024) => new Promise<string>((resolve, reject) => {
  let n = 0; const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject);
});

export function createRelay(cfg: RelayConfig) {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const log = cfg.log ?? ((m: string) => console.log(`[wa-relay] ${m}`));
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === '/livez') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, numbers: Object.keys(cfg.routes).length })); }
    if (url.pathname !== '/whatsapp') { res.writeHead(404); return res.end(); }
    if (req.method === 'GET') {
      const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === cfg.verifyToken;
      res.writeHead(ok ? 200 : 403, { 'content-type': 'text/plain' });
      return res.end(ok ? url.searchParams.get('hub.challenge') ?? '' : 'forbidden');
    }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let raw: string;
    try { raw = await readBody(req); } catch { res.writeHead(413); return res.end(); }
    if (!verifyHub(cfg.appSecret, raw, req.headers['x-hub-signature-256'] as string | undefined)) { log(`rejected unsigned webhook from ${req.socket.remoteAddress}`); res.writeHead(401); return res.end(); }
    let parts: Map<string, WaWebhook>;
    try { parts = splitByNumber(JSON.parse(raw) as WaWebhook); } catch { res.writeHead(400); return res.end(); }
    let failed = 0;
    await Promise.all([...parts].map(async ([pid, part]) => {
      const route = cfg.routes[pid];
      if (!route) { log(`no agent owns phone_number_id ${pid}; dropped`); return; }
      const body = JSON.stringify(part);
      const r = await fetchImpl(route.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-relay-signature': hubSignature(route.secret, body) }, body, signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!r || r.status >= 300) { failed++; log(`forward to ${pid} failed (${r ? r.status : 'unreachable'})`); }
    }));
    // A non-2xx makes Meta retry the whole webhook; agents dedupe by message id in the ledger.
    res.writeHead(failed ? 502 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: failed === 0 }));
  });
}

if (process.argv[1]?.endsWith('relay.js')) {
  const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`${k} is required`); return v; };
  const server = createRelay({ appSecret: need('WA_APP_SECRET'), verifyToken: need('WA_VERIFY_TOKEN'), routes: JSON.parse(need('WA_ROUTES')) });
  const port = Number(process.env.RELAY_PORT ?? 8871);
  server.listen(port, process.env.RELAY_HOST ?? '127.0.0.1', () => console.log(`[wa-relay] :${port}`));
}
