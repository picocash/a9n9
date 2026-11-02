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
 *   DATABASE_URL           optional Postgres (a9n9.events): every stored event is also inserted there; the file store stays authoritative
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
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
      if (!verify(req.headers['x-a9n9-signature'] as string | undefined, body)) {
        log(`rejected unsigned ${channel} webhook from ${req.socket.remoteAddress}`);
        return send(res, 401, { error: 'bad signature' });
      }
      const payload = JSON.parse(body) as { id?: string; type?: string };
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
      const one = url.pathname.match(/^\/v1\/events\/([a-z]+)\/([0-9a-zA-Z_:.-]{1,80})$/);
      if (one && req.method === 'GET') {
        try {
          return send(res, 200, JSON.parse(await readFile(join(DATA, 'events', one[1]!, `${one[2]}.json`), 'utf8')));
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
