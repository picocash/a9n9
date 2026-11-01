/**
 * a9n9 telegram — long-polls the Bot API, posts every message to the inbox as
 * a signed event, and exposes POST /v1/send for the agent's replies. Owner
 * commands count only from TELEGRAM_OWNER_ID; nothing here replies on its own
 * except the optional immediate acknowledgement.
 *
 *   TELEGRAM_BOT_TOKEN      from BotFather — required
 *   TELEGRAM_OWNER_ID       numeric Telegram user id of the operator (owner commands)
 *   TELEGRAM_API_TOKEN      bearer for POST /v1/* — required
 *   TELEGRAM_ACK            optional text sent back immediately to every new private message
 *   TELEGRAM_PORT (8840)  TELEGRAM_HOST (127.0.0.1)  TELEGRAM_DATA (./data)
 *   INBOX_URL, INBOX_WEBHOOK_SECRET
 */
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toInboxEvent, type TgUpdate } from './channel.js';

const env = process.env;
const BOT = env.TELEGRAM_BOT_TOKEN ?? '';
const TOKEN = env.TELEGRAM_API_TOKEN ?? '';
const OWNER = env.TELEGRAM_OWNER_ID ? Number(env.TELEGRAM_OWNER_ID) : null;
const ACK = env.TELEGRAM_ACK ?? '';
const PORT = Number(env.TELEGRAM_PORT ?? 8840);
const HOST = env.TELEGRAM_HOST ?? '127.0.0.1';
const DATA = env.TELEGRAM_DATA ?? './data';
const INBOX_URL = env.INBOX_URL ?? '';
const INBOX_SECRET = env.INBOX_WEBHOOK_SECRET ?? '';
if (!BOT || !TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_API_TOKEN are required');
  process.exit(2);
}
const log = (m: string) => console.log(`${new Date().toISOString()} [telegram] ${m}`);
const API = `https://api.telegram.org/bot${BOT}`;

async function tg<T>(method: string, body?: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(timeoutMs) });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? res.status}`);
  return data.result;
}

async function postToInbox(payload: { id: string; type: string } & Record<string, unknown>): Promise<number> {
  if (!INBOX_URL || !INBOX_SECRET) return 0;
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', INBOX_SECRET).update(body).digest('hex');
  try {
    const res = await fetch(`${INBOX_URL.replace(/\/$/, '')}/hooks/telegram`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch (err) {
    log(`inbox post failed for ${payload.id}: ${err instanceof Error ? err.message : String(err)}`);
    return -1;
  }
}

interface SentMessage { message_id: number; chat: { id: number }; date: number }
async function sendText(chatId: number, text: string, replyTo?: number): Promise<SentMessage> {
  const sent = await tg<SentMessage>('sendMessage', { chat_id: chatId, text, ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}), link_preview_options: { is_disabled: true } });
  await postToInbox({ id: `tg:${chatId}:${sent.message_id}`, type: 'telegram.sent', channel: 'telegram', chat: { id: chatId }, text, replyTo: replyTo ?? null, sentAt: new Date(sent.date * 1000).toISOString() });
  return sent;
}

const offsetFile = join(DATA, 'telegram-offset.json');
let offset = 0;
try {
  offset = (JSON.parse(await readFile(offsetFile, 'utf8')) as { offset: number }).offset;
} catch {
  /* first run */
}

let botUsername = '';
async function poll(): Promise<void> {
  for (;;) {
    try {
      const updates = await tg<TgUpdate[]>('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'edited_message'] }, 60_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        const ev = toInboxEvent(u, OWNER);
        if (!ev) continue;
        const status = await postToInbox({ ...ev, channel: 'telegram' });
        log(`${ev.type} chat ${ev.chat.id}${ev.isOwner ? ' (owner)' : ''}${ev.command ? ' /' + ev.command : ''}${ev.ignoredCommand ? ' ignored-command' : ''} → inbox ${status}`);
        if (ACK && !ev.edited && ev.chat.type === 'private' && !ev.isOwner && status === 201) {
          await sendText(ev.chat.id, ACK, ev.id.split(':')[2] ? Number(ev.id.split(':')[2]) : undefined).catch((e) => log(`ack failed: ${e.message}`));
        }
      }
      if (updates.length) await writeFile(offsetFile, JSON.stringify({ offset })).catch(() => {});
    } catch (err) {
      log(`poll error: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
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
    if (url.pathname === '/livez') return send(res, 200, { ok: true, bot: botUsername, owner: OWNER !== null });
    if (!url.pathname.startsWith('/v1/')) return send(res, 404, { error: 'not found' });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' });
    if (url.pathname === '/v1/send' && req.method === 'POST') {
      const body = await readJson(req);
      const chatId = Number(body.chatId);
      const text = String(body.text ?? '').trim();
      if (!Number.isFinite(chatId) || !text || text.length > 4096) return send(res, 400, { error: 'chatId and text (≤4096) required' });
      const sent = await sendText(chatId, text, typeof body.replyTo === 'number' ? body.replyTo : undefined);
      return send(res, 201, { messageId: sent.message_id, chatId });
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    return send(res, 500, { error: 'internal' });
  }
});

await mkdir(DATA, { recursive: true });
const me = await tg<{ username: string; id: number }>('getMe');
botUsername = me.username;
server.listen(PORT, HOST, () => log(`listening on http://${HOST}:${PORT} as @${botUsername}; owner ${OWNER ?? 'unset'}; offset ${offset}`));
void poll();
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
