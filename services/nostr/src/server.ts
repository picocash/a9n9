/**
 * a9n9 nostr — the agent's Nostr presence. On start it (re)publishes the
 * profile, then keeps a subscription open for mentions and DMs and posts each
 * one to the inbox as a signed event. A small local API lets the agent post
 * notes and send DMs; nothing here decides what to say.
 *
 *   NOSTR_NSEC            the agent key (nsec or hex) — required
 *   NOSTR_RELAYS          comma-separated wss:// list
 *   NOSTR_PORT (8830)     NOSTR_HOST (127.0.0.1)   NOSTR_DATA (./data)
 *   NOSTR_API_TOKEN       bearer for POST /v1/*  — required
 *   INBOX_URL, INBOX_WEBHOOK_SECRET   where inbound events go
 *   AGENT_NAME, AGENT_ABOUT, AGENT_WEBSITE, AGENT_PICTURE, AGENT_NIP05, AGENT_LUD16   profile fields
 */
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import WebSocket from 'ws';
import { finalizeEvent, type Event as NostrEvent } from 'nostr-tools/pure';
import { wrapEvent } from 'nostr-tools/nip17';
import * as nip19 from 'nostr-tools/nip19';
import { identityFromNsec, inboundFilters, profileEvents, toInboxEvent } from './channel.js';

const env = process.env;
const PORT = Number(env.NOSTR_PORT ?? 8830);
const HOST = env.NOSTR_HOST ?? '127.0.0.1';
const DATA = env.NOSTR_DATA ?? './data';
const TOKEN = env.NOSTR_API_TOKEN ?? '';
const RELAYS = (env.NOSTR_RELAYS ?? 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://purplepag.es').split(',').map((s) => s.trim()).filter(Boolean);
const INBOX_URL = env.INBOX_URL ?? '';
const INBOX_SECRET = env.INBOX_WEBHOOK_SECRET ?? '';
if (!env.NOSTR_NSEC || !TOKEN) {
  console.error('NOSTR_NSEC and NOSTR_API_TOKEN are required');
  process.exit(2);
}
const log = (m: string) => console.log(`${new Date().toISOString()} [nostr] ${m}`);
const id = identityFromNsec(env.NOSTR_NSEC);
// Node's built-in WebSocket throws from close() inside an error handler; the ws package does not.
useWebSocketImplementation(WebSocket);
const pool = new SimplePool();
process.on('unhandledRejection', (e) => log(`unhandled rejection: ${e instanceof Error ? e.message : String(e)}`));
process.on('uncaughtException', (e) => log(`uncaught: ${e.message}`));

const profile = {
  name: env.AGENT_NAME ?? 'a9n9agent',
  display_name: env.AGENT_DISPLAY_NAME ?? 'a9n9 agent',
  about: env.AGENT_ABOUT ?? 'Autonomous software agent run by a9n9 (a Visybl Inc service), not a person. Answers questions about public stablecoin reserve data on Tempo. Everything I do is logged and daily-anchored on chain.',
  website: env.AGENT_WEBSITE ?? 'https://a9n9.net',
  ...(env.AGENT_PICTURE ? { picture: env.AGENT_PICTURE } : {}),
  ...(env.AGENT_NIP05 ? { nip05: env.AGENT_NIP05 } : {}),
  ...(env.AGENT_LUD16 ? { lud16: env.AGENT_LUD16 } : {}),
};

async function publish(ev: NostrEvent): Promise<{ ok: string[]; failed: Record<string, string> }> {
  const ok: string[] = [];
  const failed: Record<string, string> = {};
  const results = await Promise.allSettled(pool.publish(RELAYS, ev));
  results.forEach((r, i) => {
    const relay = RELAYS[i]!;
    if (r.status === 'fulfilled') ok.push(relay);
    else failed[relay] = r.reason instanceof Error ? r.reason.message : String(r.reason);
  });
  return { ok, failed };
}

async function postToInbox(payload: { id: string; type: string } & Record<string, unknown>): Promise<number> {
  if (!INBOX_URL || !INBOX_SECRET) return 0;
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', INBOX_SECRET).update(body).digest('hex');
  try {
    const res = await fetch(`${INBOX_URL.replace(/\/$/, '')}/hooks/nostr`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch (err) {
    log(`inbox post failed for ${payload.id}: ${err instanceof Error ? err.message : String(err)}`);
    return -1;
  }
}

// Watermark so a restart does not replay the whole history into the inbox (the inbox de-dups anyway).
const stateFile = join(DATA, 'nostr-state.json');
async function loadSince(): Promise<number> {
  try {
    return (JSON.parse(await readFile(stateFile, 'utf8')) as { since: number }).since;
  } catch {
    return Math.floor(Date.now() / 1000) - 3600;
  }
}
let since = await loadSince();
const saveSince = () => writeFile(stateFile, JSON.stringify({ since })).catch(() => {});

const seen = new Set<string>();
function listen(): void {
  pool.subscribeMany(RELAYS, inboundFilters(id.pubkey, since)[0]!, { onevent: handle, onclose: (reasons) => log(`sub(mentions) closed: ${reasons.join(',')}`) });
  pool.subscribeMany(RELAYS, inboundFilters(id.pubkey, since)[1]!, { onevent: handle, onclose: (reasons) => log(`sub(dm4) closed: ${reasons.join(',')}`) });
  pool.subscribeMany(RELAYS, inboundFilters(id.pubkey, since)[2]!, { onevent: handle, onclose: (reasons) => log(`sub(dm17) closed: ${reasons.join(',')}`) });
}
async function handle(ev: NostrEvent): Promise<void> {
  if (seen.has(ev.id)) return;
  seen.add(ev.id);
  if (seen.size > 5000) seen.delete(seen.values().next().value as string);
  const inbox = toInboxEvent(ev, id);
  if (!inbox) return;
  const status = await postToInbox({ ...inbox, channel: 'nostr' });
  log(`${inbox.type} from ${inbox.fromNpub.slice(0, 16)}… → inbox ${status}`);
  if (ev.kind !== 1059 && ev.created_at > since) {
    since = ev.created_at;
    void saveSince();
  }
}

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
};
async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname === '/livez') return send(res, 200, { ok: true, npub: id.npub, relays: RELAYS });
    if (!url.pathname.startsWith('/v1/')) return send(res, 404, { error: 'not found' });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
    if (url.pathname === '/v1/profile' && req.method === 'POST') {
      const out = [];
      for (const ev of profileEvents(id, profile, RELAYS)) out.push({ kind: ev.kind, ...(await publish(ev)) });
      return send(res, 200, { npub: id.npub, published: out });
    }
    if (url.pathname === '/v1/notes' && req.method === 'POST') {
      const body = await readJson(req);
      const text = String(body.text ?? '').trim();
      if (!text || text.length > 4000) return send(res, 400, { error: 'text required (≤4000 chars)' });
      const tags: string[][] = [];
      if (typeof body.replyTo === 'string') tags.push(['e', body.replyTo, '', 'reply']);
      if (typeof body.replyToPubkey === 'string') tags.push(['p', body.replyToPubkey]);
      const ev = finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content: text }, id.sk);
      const r = await publish(ev);
      await postToInbox({ id: `nostr:${ev.id}`, type: 'nostr.post', channel: 'nostr', eventId: ev.id, text, relays: r.ok, replyTo: body.replyTo ?? null });
      return send(res, r.ok.length ? 201 : 502, { id: ev.id, note: nip19.noteEncode(ev.id), ...r });
    }
    if (url.pathname === '/v1/dm' && req.method === 'POST') {
      const body = await readJson(req);
      const to = String(body.to ?? '');
      const text = String(body.text ?? '').trim();
      const pubkey = to.startsWith('npub1') ? (nip19.decode(to).data as string) : to;
      if (!/^[0-9a-f]{64}$/.test(pubkey) || !text) return send(res, 400, { error: 'to (npub or hex) and text required' });
      const wrap = wrapEvent(id.sk, { publicKey: pubkey }, text);
      const r = await publish(wrap);
      await postToInbox({ id: `nostr:${wrap.id}`, type: 'nostr.dm.sent', channel: 'nostr', to: pubkey, toNpub: nip19.npubEncode(pubkey), text, relays: r.ok });
      return send(res, r.ok.length ? 201 : 502, { id: wrap.id, ...r });
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    return send(res, 500, { error: 'internal' });
  }
});

await mkdir(DATA, { recursive: true });
server.listen(PORT, HOST, () => log(`listening on http://${HOST}:${PORT} as ${id.npub}; relays ${RELAYS.join(' ')}`));
for (const ev of profileEvents(id, profile, RELAYS)) {
  const r = await publish(ev);
  log(`profile kind ${ev.kind}: ok ${r.ok.length}/${RELAYS.length}${Object.keys(r.failed).length ? ' failed ' + JSON.stringify(r.failed) : ''}`);
}
listen();
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { pool.close(RELAYS); server.close(() => process.exit(0)); });
