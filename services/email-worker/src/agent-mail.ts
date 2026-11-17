/**
 * Per-agent mail API (/v1/agent/*). Each agent holds its own key; the Worker stores only the key's SHA-256
 * (secret AGENT_MAIL_KEYS = JSON {"<sha256 hex>": {"agent": "agent002", "addresses": ["agent002@a9n9.net", ...]}}).
 * An agent can only see mail sent to its own addresses, and can only REPLY to a message it received:
 * the recipient is always the original sender, so the key cannot be used for cold email. 20 replies a day per agent.
 *
 *   GET  /v1/agent/mail?since=ISO&all=1        list (default: not yet handled)
 *   GET  /v1/agent/mail/:id                    one message, parsed (text capped at 20k chars)
 *   POST /v1/agent/mail/:id/reply {text}       reply from the address it was sent to, threaded; marks handled
 *   POST /v1/agent/mail/:id/done {note, operator?}  mark handled without a reply; operator=<what the operator must do>
 */
import PostalMime from 'postal-mime';

type Grant = { agent: string; addresses: string[] };
interface AgentEnv {
  MAIL: R2Bucket;
  MAIL_DB: D1Database;
  EMAIL?: { send(m: { to: string; from: string; subject: string; text?: string; headers?: Record<string, string> }): Promise<{ messageId?: string }> };
  AGENT_MAIL_KEYS?: string;
}
type Row = { id: string; message_id: string | null; in_reply_to: string | null; envelope_from: string; envelope_to: string; from_addr: string | null; from_name: string | null; subject: string | null; received_at: string; r2_key: string; dkim: string | null; spf: string | null; dmarc: string | null; handled_at: string | null; handled_by: string | null; handled_note: string | null; operator_flag: string | null };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const DAILY_REPLIES = 20;

export async function sha256Hex(s: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function grantFor(request: Request, env: AgentEnv): Promise<Grant | null> {
  const tok = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (tok.length < 24 || !env.AGENT_MAIL_KEYS) return null;
  let keys: Record<string, Grant>;
  try { keys = JSON.parse(env.AGENT_MAIL_KEYS); } catch { return null; }
  const g = keys[await sha256Hex(tok)];
  return g ? { agent: g.agent, addresses: g.addresses.map((a) => a.toLowerCase()) } : null;
}

const mine = (g: Grant) => `(${g.addresses.map((_, i) => `?${i + 1}`).join(',')})`;

async function own(env: AgentEnv, g: Grant, id: string): Promise<Row | null> {
  const row = await env.MAIL_DB.prepare(`SELECT * FROM mail WHERE id = ?${g.addresses.length + 1} AND lower(envelope_to) IN ${mine(g)}`).bind(...g.addresses, id).first<Row>();
  return row ?? null;
}

export async function handleAgent(request: Request, env: AgentEnv, url: URL): Promise<Response> {
  const g = await grantFor(request, env);
  if (!g) return json({ error: 'unauthorized' }, 401);
  const p = url.pathname;

  if (p === '/v1/agent/mail' && request.method === 'GET') {
    const since = url.searchParams.get('since') ?? new Date(Date.now() - 14 * 86400_000).toISOString();
    const all = url.searchParams.get('all') === '1';
    const { results } = await env.MAIL_DB.prepare(
      `SELECT id, envelope_to AS "to", from_addr AS "from", from_name AS fromName, subject, received_at AS receivedAt, dmarc, handled_at AS handledAt, handled_note AS handledNote, operator_flag AS operatorFlag
       FROM mail WHERE lower(envelope_to) IN ${mine(g)} AND received_at >= ?${g.addresses.length + 1} ${all ? '' : 'AND handled_at IS NULL'} ORDER BY received_at DESC LIMIT 100`,
    ).bind(...g.addresses, since).all();
    return json({ agent: g.agent, addresses: g.addresses, mail: results });
  }

  const m = p.match(/^\/v1\/agent\/mail\/([0-9a-f-]{36})(?:\/(reply|done))?$/);
  if (!m) return json({ error: 'not found' }, 404);
  const row = await own(env, g, m[1]!);
  if (!row) return json({ error: 'no such message for this agent' }, 404);

  if (!m[2] && request.method === 'GET') {
    const obj = await env.MAIL.get(row.r2_key);
    const parsed = obj ? await PostalMime.parse(await obj.arrayBuffer()) : null;
    return json({
      id: row.id, to: row.envelope_to, from: row.from_addr, fromName: row.from_name, subject: row.subject, receivedAt: row.received_at,
      auth: { dkim: row.dkim, spf: row.spf, dmarc: row.dmarc }, handledAt: row.handled_at, handledNote: row.handled_note, operatorFlag: row.operator_flag,
      text: (parsed?.text ?? '').slice(0, 20_000), attachments: (parsed?.attachments ?? []).map((a) => ({ filename: a.filename ?? null, mimeType: a.mimeType })),
    });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string; note?: string; operator?: string };
  const now = new Date().toISOString();

  if (m[2] === 'done' && request.method === 'POST') {
    const note = String(body.note ?? '').slice(0, 500);
    if (!note) return json({ error: 'note is required: say why no reply is needed' }, 400);
    const flag = body.operator ? String(body.operator).slice(0, 500) : null;
    await env.MAIL_DB.prepare('UPDATE mail SET handled_at = ?1, handled_by = ?2, handled_note = ?3, operator_flag = COALESCE(?4, operator_flag) WHERE id = ?5').bind(now, g.agent, note, flag, row.id).run();
    return json({ ok: true, id: row.id, handledAt: now, operatorFlag: flag });
  }

  if (m[2] === 'reply' && request.method === 'POST') {
    if (row.handled_note?.startsWith('replied')) return json({ error: 'already replied to this message; a follow-up from the same person arrives as a new message' }, 409);
    const text = String(body.text ?? '').trim();
    if (text.length < 2) return json({ error: 'text is required' }, 400);
    if (text.length > 20_000) return json({ error: 'text is over 20,000 characters' }, 400);
    const to = row.from_addr ?? row.envelope_from;
    if (!to || /mailer-daemon|no-?reply|postmaster/i.test(to)) return json({ error: `will not reply to ${to || 'an empty sender'}` }, 422);
    if (g.addresses.includes(to.toLowerCase())) return json({ error: 'will not reply to its own address' }, 422);
    const day = now.slice(0, 10);
    const sent = await env.MAIL_DB.prepare("SELECT COUNT(*) AS n FROM outbound WHERE agent = ?1 AND substr(sent_at, 1, 10) = ?2 AND status = 'sent'").bind(g.agent, day).first<{ n: number }>();
    if ((sent?.n ?? 0) >= DAILY_REPLIES) return json({ error: `reply cap reached (${DAILY_REPLIES}/day)` }, 429);
    if (!env.EMAIL) return json({ error: 'sending is not configured' }, 503);
    const from = row.envelope_to.toLowerCase();
    const subject = /^re:/i.test(row.subject ?? '') ? (row.subject ?? 'Re:') : `Re: ${row.subject ?? ''}`.trim();
    const headers: Record<string, string> = {};
    if (row.message_id) { headers['In-Reply-To'] = row.message_id; headers['References'] = [row.in_reply_to, row.message_id].filter(Boolean).join(' '); }
    const id = crypto.randomUUID();
    try {
      const res = await env.EMAIL.send({ from, to, subject, text, ...(Object.keys(headers).length ? { headers } : {}) });
      await env.MAIL_DB.prepare("INSERT INTO outbound (id, sent_at, from_addr, to_addr, subject, in_reply_to, provider_message_id, status, agent, mail_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'sent', ?8, ?9)")
        .bind(id, now, from, to, subject, row.message_id, res.messageId ?? null, g.agent, row.id).run();
      const flag = body.operator ? String(body.operator).slice(0, 500) : null;
      await env.MAIL_DB.prepare('UPDATE mail SET handled_at = ?1, handled_by = ?2, handled_note = ?3, operator_flag = COALESCE(?4, operator_flag) WHERE id = ?5').bind(now, g.agent, `replied ${id}`, flag, row.id).run();
      return json({ ok: true, id, from, to, subject, repliesToday: (sent?.n ?? 0) + 1, capPerDay: DAILY_REPLIES, operatorFlag: flag }, 202);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await env.MAIL_DB.prepare("INSERT INTO outbound (id, sent_at, from_addr, to_addr, subject, in_reply_to, status, error, agent, mail_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'failed', ?7, ?8, ?9)")
        .bind(id, now, from, to, subject, row.message_id, error, g.agent, row.id).run();
      return json({ error }, 502);
    }
  }
  return json({ error: 'not found' }, 404);
}
