/**
 * a9n9 inbox — the home-box side of every channel. Channel adapters (the
 * Email Worker today; SMS, voice, Telegram and Nostr later) POST signed
 * events here. The inbox verifies the signature, stores the event once, and
 * exposes it to the agent runtime. It is deliberately dumb: no replies, no
 * model calls — those belong to the agent.
 *
 *   INBOX_PORT (8810)  INBOX_HOST (127.0.0.1)  INBOX_DATA (./data)
 *   INBOX_WEBHOOK_SECRET   HMAC key shared with the adapters (required)
 *   INBOX_API_TOKEN        bearer token for GET /v1/events (required)
 *   SWARM_KEYS_FILE        optional fleet registry {agents:{<id>:{x:<Ed25519 public key, base64url>}}}; without it every swarm event is refused
 *   DATABASE_URL           optional Postgres (a9n9.events): every stored event is also inserted there; the file store stays authoritative
 */
import { createHash, createHmac, createPublicKey, timingSafeEqual, verify as edVerify } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const env = process.env;
const PORT = Number(env.INBOX_PORT ?? 8810);
const HOST = env.INBOX_HOST ?? '127.0.0.1';
const DATA = env.INBOX_DATA ?? './data';
const SECRET = env.INBOX_WEBHOOK_SECRET ?? '';
const TOKEN = env.INBOX_API_TOKEN ?? '';
if (!SECRET || !TOKEN) {
  console.error('INBOX_WEBHOOK_SECRET and INBOX_API_TOKEN are required');
  process.exit(2);
}

const log = (m: string) => console.log(`${new Date().toISOString()} [inbox] ${m}`);
const AGENT = env.INBOX_AGENT ?? 'agent001';
/** Optional durable copy of every event in Postgres (schema a9n9, table events). Failures are logged, never fatal: the files are the source of truth. */
const pool = env.DATABASE_URL ? new pg.Pool({ connectionString: env.DATABASE_URL, max: 4, idleTimeoutMillis: 30_000 }) : null;
if (pool) pool.on('error', (e) => log(`pg pool error: ${e.message}`));
async function mirror(ev: StoredEvent): Promise<void> {
  if (!pool) return;
  try { await pool.query('INSERT INTO a9n9.events (id, agent, channel, type, received_at, payload) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [ev.id, AGENT, ev.channel, ev.type, ev.receivedAt, JSON.stringify(ev.payload)]); }
  catch (e) { log(`pg mirror failed for ${ev.id}: ${e instanceof Error ? e.message : String(e)}`); }
}

export interface StoredEvent {
  id: string;
  type: string;
  channel: string;
  receivedAt: string;
  payload: unknown;
}

/** The agent's sandbox signs with its own key, good only for what its tools report. Money received, receipts and anchors never come from the agent. */
const AGENT_SECRET = env.INBOX_AGENT_WEBHOOK_SECRET ?? '';
const AGENT_TYPES = /^(agent\.(review|focus|opportunity|note|message)|fleet\.note|x\.(post|reply|follow|delete|mention)|bsky\.(post|reply|follow|delete|mention)|email\.sent|money\.spend)$/;
/**
 * Agents helping each other (docs/swarm-comms.md): an `agent.message` or `fleet.note` on the `swarm` channel is accepted only
 * when `payload.sig` is the sender's Ed25519 signature (the same key as its HTTP message signatures) over the canonical
 * string, the sender is in the fleet registry, and a message names a registered recipient and carries a ref. The HMAC
 * proves "an agent sandbox"; the signature proves which agent, so one agent cannot speak as another.
 */
const SWARM_KEYS_FILE = env.SWARM_KEYS_FILE ?? '';
type SwarmPayload = { from?: unknown; to?: unknown; kind?: unknown; at?: unknown; ref?: unknown; text?: unknown; sig?: unknown };
export const swarmCanonical = (p: { from: string; to?: string | undefined; kind: string; at: string; ref?: string | undefined; text: string }): string =>
  ['a9n9-swarm', p.from, p.to ?? '', p.kind, p.at, p.ref ?? '', p.text].join('\n');
async function swarmKeys(): Promise<Record<string, string>> {
  if (!SWARM_KEYS_FILE) return {};
  try { const j = JSON.parse(await readFile(SWARM_KEYS_FILE, 'utf8')) as { agents?: Record<string, { x?: string }> }; return Object.fromEntries(Object.entries(j.agents ?? {}).filter(([, v]) => typeof v?.x === 'string').map(([k, v]) => [k, v.x as string])); } catch { return {}; }
}
/** null when acceptable, else the reason (400) or a signature/sender problem (401). */
export function swarmProblem(type: string, p: SwarmPayload, keys: Record<string, string>): { status: 400 | 401; error: string } | null {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const from = str(p.from), to = str(p.to), kind = str(p.kind), at = str(p.at), ref = str(p.ref), text = str(p.text), sig = str(p.sig);
  if (!keys[from]) return { status: 401, error: `unknown sender ${from || '(none)'}` };
  if (!text || text.length > 1000) return { status: 400, error: 'text is required, at most 1000 chars' };
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(at) || Math.abs(Date.now() - Date.parse(at)) > 10 * 60_000) return { status: 400, error: 'at must be an ISO time within 10 minutes' };
  if (type === 'agent.message') {
    if (!['ask', 'found', 'done'].includes(kind)) return { status: 400, error: 'kind must be ask, found or done' };
    if (!keys[to]) return { status: 400, error: `unknown recipient ${to || '(none)'}` };
    if (to === from) return { status: 400, error: 'a message to yourself' };
    if (!/^(https?:\/\/\S+|[a-z0-9]+:[\w:.\/-]+)$/i.test(ref)) return { status: 400, error: 'ref must be a URL or a ledger id: a claim without a receipt is not sent' };
  } else if (!['note', 'search'].includes(kind)) return { status: 400, error: 'kind must be note or search' };
  try {
    const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: keys[from] }, format: 'jwk' });
    if (!edVerify(null, Buffer.from(swarmCanonical({ from, to: to || undefined, kind, at, ref: ref || undefined, text }), 'utf8'), key, Buffer.from(sig, 'base64url'))) return { status: 401, error: 'bad signature' };
  } catch { return { status: 401, error: 'bad signature' }; }
  return null;
}
function verifyAgent(sigHeader: string | undefined, body: string): boolean {
  if (!AGENT_SECRET || !sigHeader) return false;
  const got = Buffer.from(sigHeader.replace(/^sha256=/, ''), 'hex'); const want = createHmac('sha256', AGENT_SECRET).update(body).digest();
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false;
  try { return AGENT_TYPES.test(String((JSON.parse(body) as { type?: unknown }).type)); } catch { return false; }
}
function verify(sigHeader: string | undefined, body: string): boolean {
  if (!sigHeader?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', SECRET).update(body).digest('hex');
  const given = sigHeader.slice(7);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
};

async function store(ev: StoredEvent): Promise<boolean> {
  const dir = join(DATA, 'events', ev.channel);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${ev.id}.json`);
  try {
    await readFile(file);
    return false; // duplicate delivery; adapters retry
  } catch {
    await writeFile(file, JSON.stringify(ev, null, 2));
    await appendFile(join(DATA, 'events', 'index.jsonl'), JSON.stringify({ id: ev.id, type: ev.type, channel: ev.channel, receivedAt: ev.receivedAt }) + '\n');
    return true;
  }
}

type IndexLine = Pick<StoredEvent, 'id' | 'type' | 'channel' | 'receivedAt'>;

async function indexLines(): Promise<string[]> {
  try {
    return (await readFile(join(DATA, 'events', 'index.jsonl'), 'utf8')).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Newest first; optional filters by channel, type prefix, and receivedAt lower bound. */
async function list(limit: number, f: { channel?: string | undefined; type?: string | undefined; since?: string | undefined } = {}): Promise<IndexLine[]> {
  const rows = (await indexLines()).map((l) => JSON.parse(l) as IndexLine);
  return rows
    .filter((r) => (!f.channel || r.channel === f.channel) && (!f.type || r.type.startsWith(f.type)) && (!f.since || r.receivedAt >= f.since))
    .slice(-limit)
    .reverse();
}

/**
 * The day's events in order and a SHA-256 over their index lines — the value
 * anchored on-chain once a day. Recomputable by anyone holding the export.
 */
export async function digest(day: string): Promise<{ day: string; count: number; ids: string[]; sha256: string }> {
  const lines = (await indexLines()).filter((l) => (JSON.parse(l) as IndexLine).receivedAt.startsWith(day));
  const sha256 = createHash('sha256').update(lines.join('\n')).digest('hex');
  return { day, count: lines.length, ids: lines.map((l) => (JSON.parse(l) as IndexLine).id), sha256 };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname === '/livez') return send(res, 200, { ok: true, pg: !!pool });

    const hook = url.pathname.match(/^\/hooks\/([a-z]+)$/);
    if (hook && req.method === 'POST') {
      const channel = hook[1]!;
      const body = await readBody(req);
      if (!verify(req.headers['x-a9n9-signature'] as string | undefined, body) && !verifyAgent(req.headers['x-a9n9-signature'] as string | undefined, body)) {
        log(`rejected unsigned ${channel} webhook from ${req.socket.remoteAddress}`);
        return send(res, 401, { error: 'bad signature' });
      }
      const payload = JSON.parse(body) as { id?: string; type?: string };
      if (channel === 'swarm' || /^(agent\.message|fleet\.note)$/.test(String(payload.type))) {
        if (channel !== 'swarm' || !/^(agent\.message|fleet\.note)$/.test(String(payload.type))) return send(res, 400, { error: 'swarm events go to /hooks/swarm as agent.message or fleet.note' });
        const problem = swarmProblem(String(payload.type), payload as SwarmPayload, await swarmKeys());
        if (problem) { log(`rejected swarm ${payload.type}: ${problem.error}`); return send(res, problem.status, { error: problem.error }); }
      }
      const ev: StoredEvent = { id: payload.id ?? crypto.randomUUID(), type: payload.type ?? `${channel}.event`, channel, receivedAt: new Date().toISOString(), payload };
      const fresh = await store(ev);
      if (fresh) void mirror(ev);
      log(`${fresh ? 'stored' : 'duplicate'} ${ev.type} ${ev.id}`);
      return send(res, fresh ? 201 : 200, { id: ev.id, stored: fresh });
    }

    if (url.pathname.startsWith('/v1/')) {
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
      if (url.pathname === '/v1/events' && req.method === 'GET') {
        const q = url.searchParams;
        return send(res, 200, { events: await list(Math.min(500, Number(q.get('limit') ?? 50)), { channel: q.get('channel') ?? undefined, type: q.get('type') ?? undefined, since: q.get('since') ?? undefined }) });
      }
      if (url.pathname === '/v1/digest' && req.method === 'GET') {
        const day = url.searchParams.get('day') ?? new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return send(res, 400, { error: 'day must be YYYY-MM-DD' });
        return send(res, 200, await digest(day));
      }
      if (url.pathname === '/v1/export' && req.method === 'GET') {
        const day = url.searchParams.get('day') ?? '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return send(res, 400, { error: 'day must be YYYY-MM-DD' });
        const lines = (await indexLines()).filter((l) => (JSON.parse(l) as IndexLine).receivedAt.startsWith(day));
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(lines.join('\n'));
      }
      const one = url.pathname.match(/^\/v1\/events\/([a-z]+)\/([0-9a-zA-Z_:.%-]{1,120})$/);
      if (one && req.method === 'GET') {
        const evId = decodeURIComponent(one[2]!);
        if (!/^[0-9a-zA-Z_:.-]{1,80}$/.test(evId)) return send(res, 404, { error: 'unknown event' });
        try {
          return send(res, 200, JSON.parse(await readFile(join(DATA, 'events', one[1]!, `${evId}.json`), 'utf8')));
        } catch {
          return send(res, 404, { error: 'unknown event' });
        }
      }
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    return send(res, 500, { error: 'internal' });
  }
});

await mkdir(join(DATA, 'events'), { recursive: true });
server.listen(PORT, HOST, () => log(`listening on http://${HOST}:${PORT}, data in ${DATA}`));
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));

// Keep readdir referenced for the directory-walk variant some adapters will want.
void readdir;
