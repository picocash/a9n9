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
 *   POST /v1/agent/pitch {to, subject, text}   FIRST-CONTACT email, only for agents granted it in AGENT_SENDING
 *                                              (Arun, 2026-11-19: agents send press pitches themselves). Guardrails:
 *                                              per-day and per-week caps, one pitch per recipient per 30 days, no
 *                                              one who opted out, a genxlinked.com link, and a fixed AI-disclosure
 *                                              footer the agent cannot remove. Replies come back as normal mail.
 *   POST /v1/agent/suppress {to, note}         never pitch this address again (they said no / unsubscribe)
 *
 * AGENT_SENDING (var, JSON) = {"agent003": {"sendAs": ["stories@genxlinked.com"], "pitchPerDay": 3, "pitchPerWeek": 10}}
 * sendAs also limits which address a REPLY may come from: mail to arun@genxlinked.com is answered from sendAs[0],
 * never from Arun's own address.
 */
import PostalMime from 'postal-mime';

type Grant = { agent: string; addresses: string[] };
interface AgentEnv {
  MAIL: R2Bucket;
  MAIL_DB: D1Database;
  EMAIL?: { send(m: { to: string; from: string; subject: string; text?: string; headers?: Record<string, string> }): Promise<{ messageId?: string }> };
  AGENT_MAIL_KEYS?: string;
  SENDER_DOMAINS?: string;
  AGENT_SENDING?: string;
}
type Sending = { sendAs?: string[]; pitchPerDay?: number; pitchPerWeek?: number; notePerDay?: number; notePerWeek?: number; footer?: string };
function sendingFor(env: AgentEnv, agent: string): Sending {
  try { return (JSON.parse(env.AGENT_SENDING || '{}') as Record<string, Sending>)[agent] ?? {}; } catch { return {}; }
}
const DEFAULT_FOOTER = '\n\n--\nThis email was written and sent by agent003, the AI agent that runs the GenXLinked desk (https://genxlinked.com) with its editor, Arun. A reply reaches the desk and Arun reads every message. If you would rather not hear from us again, reply "no" and we will not write again.';
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

  if ((p === '/v1/agent/pitch' || p === '/v1/agent/suppress') && request.method === 'POST') return pitch(request, env, g, p);

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
    // Reply from the address it was sent to when that domain can send; otherwise from the agent's own sending address
    // (e.g. arun@genxlinked.com is read by agent003 but genxlinked.com is not a sending domain yet).
    const sendable = (a: string) => (env.SENDER_DOMAINS || 'a9n9.net').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean).some((d) => a.endsWith(`@${d}`));
    const orig = row.envelope_to.toLowerCase();
    const sendAs = (sendingFor(env, g.agent).sendAs ?? []).map((a) => a.toLowerCase()).filter(sendable);
    const from = sendAs.length ? (sendAs.includes(orig) ? orig : sendAs[0]!) : sendable(orig) ? orig : (g.addresses.map((a) => a.toLowerCase()).find(sendable) ?? orig);
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

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i;

async function pitch(request: Request, env: AgentEnv, g: Grant, p: string): Promise<Response> {
  const s = sendingFor(env, g.agent);
  const body = (await request.json().catch(() => ({}))) as { to?: string; subject?: string; text?: string; note?: string; kind?: string };
  const to = String(body.to ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return json({ error: 'to must be one email address' }, 400);
  const now = new Date().toISOString();
  if (p === '/v1/agent/suppress') {
    await env.MAIL_DB.prepare('INSERT OR REPLACE INTO pitch_suppress (addr, at, agent, note) VALUES (?1, ?2, ?3, ?4)').bind(to, now, g.agent, String(body.note ?? '').slice(0, 300)).run();
    return json({ ok: true, suppressed: to });
  }
  // Two buckets (agent003 ask c978a90ee7, 2026-11-27): a pitch goes to press and organisations; a note goes to a writer the site
  // already quoted, credited and linked. Each has its own caps; the one-per-person-per-30-days rule and the stop list cover both.
  const isNote = body.kind === 'note', what = isNote ? 'note' : 'pitch';
  const perDay = (isNote ? s.notePerDay : s.pitchPerDay) ?? 0, perWeek = (isNote ? s.notePerWeek : s.pitchPerWeek) ?? perDay * 3;
  if (!perDay) return json({ error: `${g.agent} is not allowed to send a first-contact ${what}` }, 403);
  const sendable = (a: string) => (env.SENDER_DOMAINS || 'a9n9.net').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean).some((d) => a.endsWith(`@${d}`));
  const from = (s.sendAs ?? []).map((a) => a.toLowerCase()).find(sendable);
  if (!from) return json({ error: 'no sending address configured for this agent' }, 503);
  if (g.addresses.includes(to) || to.endsWith('@a9n9.net') || to.endsWith('@genxlinked.com')) return json({ error: 'pitches go to outside people only' }, 422);
  if (/mailer-daemon|no-?reply|postmaster|abuse@/i.test(to)) return json({ error: `will not write to ${to}` }, 422);
  const subject = String(body.subject ?? '').trim();
  const text = String(body.text ?? '').trim();
  if (subject.length < 5 || subject.length > 120) return json({ error: 'subject must be 5-120 characters' }, 400);
  if (text.length < 200 || text.length > 6000) return json({ error: 'text must be 200-6000 characters: one person, one specific reason' }, 400);
  if (!/https:\/\/(www\.)?genxlinked\.com\//.test(text)) return json({ error: 'text must link the genxlinked.com page you are pitching' }, 400);
  if (/\barun\s+here\b|this is arun\b|^arun\s*$/im.test(text)) return json({ error: 'a pitch must not read as written by Arun' }, 422);
  const sup = await env.MAIL_DB.prepare('SELECT addr FROM pitch_suppress WHERE addr = ?1 OR addr = ?2').bind(to, '@' + to.split('@')[1]).first();
  if (sup) return json({ error: `${to} asked not to be contacted` }, 403);
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const prior = await env.MAIL_DB.prepare("SELECT sent_at FROM outbound WHERE agent = ?1 AND lower(to_addr) = ?2 AND mail_id IS NULL AND status = 'sent' AND sent_at >= ?3 LIMIT 1").bind(g.agent, to, since30).first<{ sent_at: string }>();
  if (prior) return json({ error: `already wrote to ${to} on ${prior.sent_at.slice(0, 10)}; no follow-ups — if they reply, answer with mail reply` }, 409);
  const count = async (since: string) => (await env.MAIL_DB.prepare("SELECT COUNT(*) AS n FROM outbound WHERE agent = ?1 AND mail_id IS NULL AND status = 'sent' AND sent_at >= ?2 AND " + (isNote ? "kind = 'note'" : "kind IS NULL")).bind(g.agent, since).first<{ n: number }>())?.n ?? 0;
  const today = await count(now.slice(0, 10)), week = await count(new Date(Date.now() - 7 * 86400_000).toISOString());
  if (today >= perDay) return json({ error: `${what} cap reached (${perDay}/day)` }, 429);
  if (week >= perWeek) return json({ error: `${what} cap reached (${perWeek}/week)` }, 429);
  if (!env.EMAIL) return json({ error: 'sending is not configured' }, 503);
  const full = text + (s.footer ?? DEFAULT_FOOTER);
  const id = crypto.randomUUID();
  try {
    const res = await env.EMAIL.send({ from, to, subject, text: full, headers: { 'X-GenXLinked-Sender': `${g.agent} (AI agent)` } });
    await env.MAIL_DB.prepare("INSERT INTO outbound (id, sent_at, from_addr, to_addr, subject, provider_message_id, status, agent, kind) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'sent', ?7, ?8)").bind(id, now, from, to, subject, res.messageId ?? null, g.agent, isNote ? 'note' : null).run();
    return json({ ok: true, id, kind: what, from, to, subject, pitchesToday: today + 1, capPerDay: perDay, pitchesThisWeek: week + 1, capPerWeek: perWeek }, 202);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await env.MAIL_DB.prepare("INSERT INTO outbound (id, sent_at, from_addr, to_addr, subject, status, error, agent) VALUES (?1, ?2, ?3, ?4, ?5, 'failed', ?6, ?7)").bind(id, now, from, to, subject, error, g.agent).run();
    return json({ error }, 502);
  }
}
