/**
 * a9n9 Email Worker.
 *
 * Inbound (Email Routing → `email()`): store the raw MIME in R2, index it in
 * D1, forward a copy to the operator, and POST a signed webhook to the home
 * box inbox so the agent hears about it within seconds. The Worker never
 * decides anything about the message; it records and relays.
 *
 * Outbound (`POST /v1/send`): the home box sends mail through this Worker
 * using a shared bearer token, so Cloudflare credentials never leave
 * Cloudflare. Every send is logged in D1.
 */
import PostalMime from 'postal-mime';

export interface Env {
  MAIL: R2Bucket;
  MAIL_DB: D1Database;
  EMAIL?: SendEmail;
  FORWARD_TO: string;
  INBOX_WEBHOOK_URL: string;
  ALLOWED_SENDERS: string;
  SENDER_DOMAINS?: string;
  INBOX_WEBHOOK_SECRET?: string;
  API_TOKEN?: string;
  /** Comma-separated https URLs the cron probes; a 2xx within 10 s is healthy. */
  PROBE_TARGETS?: string;
  /** Where the page goes (defaults to FORWARD_TO) and who it is from. */
  PROBE_PAGE_TO?: string;
  PROBE_FROM?: string;
}

/** Cloudflare Email Sending binding (object form). */
interface SendEmail {
  send(message: { to: string | string[]; from: string; subject: string; text?: string; html?: string; headers?: Record<string, string> }): Promise<{ messageId?: string }>;
}

export interface InboundWebhook {
  type: 'email.received';
  id: string;
  receivedAt: string;
  envelope: { from: string; to: string };
  from: { address: string; name: string } | null;
  to: Array<{ address: string; name: string }>;
  subject: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  text: string;
  html: string | null;
  attachments: Array<{ filename: string | null; mimeType: string; size: number }>;
  auth: { dkim: string | null; spf: string | null; dmarc: string | null };
  size: number;
  r2Key: string;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
}

/** Authentication-Results is the only trustworthy record of DKIM/SPF/DMARC; pull the three verdicts out of it. */
export function parseAuthResults(header: string | null): InboundWebhook['auth'] {
  const pick = (name: string) => {
    const m = header?.match(new RegExp(`(?:^|;)\\s*${name}=([a-z]+)`, 'i'));
    return m?.[1]?.toLowerCase() ?? null;
  };
  return { dkim: pick('dkim'), spf: pick('spf'), dmarc: pick('dmarc') };
}

async function readAll(stream: ReadableStream<Uint8Array>, size: number): Promise<Uint8Array> {
  const out = new Uint8Array(size);
  let off = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (off + value.length > out.length) {
      // rawSize is advisory; grow if the stream is longer.
      const grown = new Uint8Array(Math.max(out.length * 2, off + value.length));
      grown.set(out.subarray(0, off));
      return concatRest(grown, off, value, reader);
    }
    out.set(value, off);
    off += value.length;
  }
  return out.subarray(0, off);
}
async function concatRest(buf: Uint8Array, off: number, first: Uint8Array, reader: ReadableStreamDefaultReader<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [buf.subarray(0, off), first];
  let total = off + first.length;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) out.set(c, p), (p += c.length);
  return out;
}

async function postWebhook(env: Env, payload: InboundWebhook): Promise<number> {
  if (!env.INBOX_WEBHOOK_URL) return 0;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id };
  if (env.INBOX_WEBHOOK_SECRET) headers['x-a9n9-signature'] = `sha256=${await hmacHex(env.INBOX_WEBHOOK_SECRET, body)}`;
  try {
    const res = await fetch(env.INBOX_WEBHOOK_URL, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch {
    return -1;
  }
}

const authorized = (req: Request, env: Env) => !!env.API_TOKEN && req.headers.get('authorization') === `Bearer ${env.API_TOKEN}`;

/**
 * Off-box probe. Cloudflare runs this every five minutes from outside the
 * house, so a dead tunnel, box or container is noticed even when the home-box
 * probe would be dead with it. Each target is paged once when it goes down
 * and once when it comes back; state lives in D1.
 */
export async function runProbe(env: Env, now = new Date()): Promise<Array<{ target: string; ok: boolean; error?: string | undefined; paged?: boolean }>> {
  const targets = (env.PROBE_TARGETS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!targets.length) return [];
  const results: Array<{ target: string; ok: boolean; error?: string | undefined; paged?: boolean }> = [];
  const checks = await Promise.all(targets.map(async (target) => {
    try {
      const res = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'a9n9-probe/1' } });
      return { target, ok: res.status >= 200 && res.status < 300, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { target, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }));
  const iso = now.toISOString();
  for (const c of checks) {
    const prev = await env.MAIL_DB.prepare('SELECT ok, since, paged_at FROM probe_state WHERE target = ?1').bind(c.target).first<{ ok: number; since: string; paged_at: string | null }>();
    const changed = !prev || Boolean(prev.ok) !== c.ok;
    const since = changed ? iso : prev!.since;
    let paged = false;
    // Page on the transition to down (after it has been down for two consecutive checks) and on recovery.
    const downFor = !c.ok && prev && !prev.ok ? now.getTime() - new Date(prev.since).getTime() : 0;
    const shouldPage = (!c.ok && prev && !prev.ok && !prev.paged_at && downFor >= 4 * 60_000) || (c.ok && prev && !prev.ok && prev.paged_at);
    if (shouldPage && env.EMAIL) {
      const to = env.PROBE_PAGE_TO || env.FORWARD_TO;
      const from = env.PROBE_FROM || 'agent001@a9n9.net';
      const subject = c.ok ? `[a9n9 probe] UP again: ${new URL(c.target).host}` : `[a9n9 probe] DOWN: ${new URL(c.target).host}`;
      const text = c.ok
        ? `${c.target} answers again as of ${iso}. It had been failing since ${prev!.since}.`
        : `${c.target} has failed every check since ${prev!.since} (${Math.round(downFor / 60_000)} min). Last error: ${c.error}. Checks run from Cloudflare every 5 minutes; this is the only page until it recovers.`;
      try {
        await env.EMAIL.send({ from, to, subject, text });
        paged = true;
      } catch (err) {
        console.error('probe page failed', err instanceof Error ? err.message : String(err));
      }
    }
    const pagedAt = c.ok ? null : paged ? iso : prev && !prev.ok ? prev.paged_at : null;
    await env.MAIL_DB.prepare('INSERT INTO probe_state (target, ok, since, last_checked, last_error, paged_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(target) DO UPDATE SET ok = excluded.ok, since = excluded.since, last_checked = excluded.last_checked, last_error = excluded.last_error, paged_at = excluded.paged_at')
      .bind(c.target, c.ok ? 1 : 0, since, iso, c.error ?? null, pagedAt).run();
    results.push({ ...c, paged });
  }
  return results;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runProbe(env).then((r) => console.log('probe', JSON.stringify(r))));
  },
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const raw = await readAll(message.raw, message.rawSize);
    const r2Key = `mail/${receivedAt.slice(0, 7)}/${id}.eml`;
    await env.MAIL.put(r2Key, raw, { httpMetadata: { contentType: 'message/rfc822' }, customMetadata: { from: message.from, to: message.to, receivedAt } });

    const parsed = await PostalMime.parse(raw);
    const auth = parseAuthResults(message.headers.get('authentication-results'));
    const payload: InboundWebhook = {
      type: 'email.received',
      id,
      receivedAt,
      envelope: { from: message.from, to: message.to },
      from: parsed.from ? { address: parsed.from.address ?? '', name: parsed.from.name ?? '' } : null,
      to: (parsed.to ?? []).map((a) => ({ address: a.address ?? '', name: a.name ?? '' })),
      subject: parsed.subject ?? '',
      messageId: parsed.messageId ?? null,
      inReplyTo: parsed.inReplyTo ?? null,
      references: parsed.references ? parsed.references.split(/\s+/).filter(Boolean) : [],
      text: parsed.text ?? '',
      html: parsed.html ?? null,
      attachments: parsed.attachments.map((a) => ({ filename: a.filename ?? null, mimeType: a.mimeType, size: typeof a.content === 'string' ? a.content.length : a.content.byteLength })),
      auth,
      size: raw.byteLength,
      r2Key,
    };

    let forwarded = 0;
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
        forwarded = 1;
      } catch (err) {
        console.error('[email] forward failed:', err instanceof Error ? err.message : String(err));
      }
    }

    await env.MAIL_DB.prepare(
      `INSERT INTO mail (id, message_id, in_reply_to, envelope_from, envelope_to, from_addr, from_name, subject, received_at, size, r2_key, dkim, spf, dmarc, forwarded)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    )
      .bind(id, payload.messageId, payload.inReplyTo, message.from, message.to, payload.from?.address ?? null, payload.from?.name ?? null, payload.subject, receivedAt, raw.byteLength, r2Key, auth.dkim, auth.spf, auth.dmarc, forwarded)
      .run();

    ctx.waitUntil(
      postWebhook(env, payload).then((status) => env.MAIL_DB.prepare('UPDATE mail SET webhook_status = ?1 WHERE id = ?2').bind(status, id).run()),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      const row = await env.MAIL_DB.prepare('SELECT COUNT(*) AS n, MAX(received_at) AS last FROM mail').first<{ n: number; last: string | null }>();
      return json({ ok: true, inbound: row?.n ?? 0, lastReceivedAt: row?.last ?? null, forwardTo: !!env.FORWARD_TO, webhook: !!env.INBOX_WEBHOOK_URL, sending: !!env.EMAIL });
    }
    if (!url.pathname.startsWith('/v1/')) return json({ error: 'not found' }, 404);
    if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);

    if (url.pathname === '/v1/mail' && request.method === 'GET') {
      const limit = Math.min(200, Number(url.searchParams.get('limit') ?? 50));
      const { results } = await env.MAIL_DB.prepare('SELECT id, message_id, in_reply_to, envelope_from, envelope_to, from_addr, from_name, subject, received_at, size, dkim, spf, dmarc, webhook_status, forwarded FROM mail ORDER BY received_at DESC LIMIT ?1').bind(limit).all();
      return json({ mail: results });
    }
    const rawMatch = url.pathname.match(/^\/v1\/mail\/([0-9a-f-]{36})\/raw$/);
    if (rawMatch && request.method === 'GET') {
      const row = await env.MAIL_DB.prepare('SELECT r2_key FROM mail WHERE id = ?1').bind(rawMatch[1]).first<{ r2_key: string }>();
      if (!row) return json({ error: 'unknown message' }, 404);
      const obj = await env.MAIL.get(row.r2_key);
      if (!obj) return json({ error: 'raw message missing from storage' }, 410);
      return new Response(obj.body, { headers: { 'content-type': 'message/rfc822', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/v1/probe' && request.method === 'GET') {
      const rows = await env.MAIL_DB.prepare('SELECT target, ok, since, last_checked, last_error, paged_at FROM probe_state ORDER BY target').all();
      return json({ targets: rows.results });
    }
    if (url.pathname === '/v1/send' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as { from?: string; to?: string; subject?: string; text?: string; html?: string; inReplyTo?: string; references?: string } | null;
      if (!body?.from || !body.to || !body.subject || (!body.text && !body.html)) return json({ error: 'from, to, subject and text or html are required' }, 400);
      // Only the zone's own addresses may send; an explicit allow-list narrows that further.
      const from = body.from.toLowerCase();
      const domains = (env.SENDER_DOMAINS || 'a9n9.net').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!domains.some((d) => from.endsWith(`@${d}`))) return json({ error: `sender ${body.from} is not on a sending domain (${domains.join(', ')})` }, 403);
      const allowed = env.ALLOWED_SENDERS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (allowed.length && !allowed.includes(from)) return json({ error: `sender ${body.from} is not allowed` }, 403);
      if (!env.EMAIL) return json({ error: 'sending is not configured on this deployment' }, 503);
      const id = crypto.randomUUID();
      const sentAt = new Date().toISOString();
      const headers: Record<string, string> = {};
      if (body.inReplyTo) headers['In-Reply-To'] = body.inReplyTo;
      if (body.references) headers['References'] = body.references;
      try {
        const res = await env.EMAIL.send({ from: body.from, to: body.to, subject: body.subject, ...(body.text ? { text: body.text } : {}), ...(body.html ? { html: body.html } : {}), ...(Object.keys(headers).length ? { headers } : {}) });
        await env.MAIL_DB.prepare('INSERT INTO outbound (id, sent_at, from_addr, to_addr, subject, in_reply_to, provider_message_id, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
          .bind(id, sentAt, body.from, body.to, body.subject, body.inReplyTo ?? null, res.messageId ?? null, 'sent')
          .run();
        return json({ id, messageId: res.messageId ?? null }, 202);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await env.MAIL_DB.prepare('INSERT INTO outbound (id, sent_at, from_addr, to_addr, subject, in_reply_to, status, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
          .bind(id, sentAt, body.from, body.to, body.subject, body.inReplyTo ?? null, 'failed', error)
          .run();
        return json({ id, error }, 502);
      }
    }
    return json({ error: 'not found' }, 404);
  },
};
