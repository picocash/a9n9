/**
 * a9n9 comms — ONE agent's own messaging connector. Each agent runs its own copy with its own
 * numbers and credentials; nothing here knows about other agents.
 *
 *   POST /sms/telnyx      this agent's SMS number: inbound (→ sms.received) and delivery reports (→ sms.status), Ed25519-signed
 *   POST /whatsapp        this agent's WhatsApp traffic, forwarded by wa-relay (per-agent HMAC)
 *   POST /v1/send         {channel:'sms'|'whatsapp', to, text}  bearer COMMS_API_TOKEN; reply-first rules in policy.ts
 *   GET  /v1/status       bearer; which channels are live and what is left today
 *
 * Env: AGENT_ID, AGENT_DISPLAY (e.g. "a9n9 agent 001 (Visybl)"), PUBLIC_URL (this connector's public base URL,
 * used for delivery-report URLs), COMMS_API_TOKEN, INBOX_URL, INBOX_WEBHOOK_SECRET, COMMS_STATE (consent file),
 * SMS_DAILY_CAP (40), WA_DAILY_CAP (100), COMMS_HOST (127.0.0.1), COMMS_PORT (8870);
 * SMS: TELNYX_API_KEY, TELNYX_PUBLIC_KEY, SMS_NUMBER (+E.164), TELNYX_MESSAGING_PROFILE_ID (optional);  WhatsApp: WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_RELAY_SECRET.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Policy, type Channel, type SmsTexts } from './policy.js';
import { sendTelnyxSms, verifyTelnyx, type TelnyxAccount, type TelnyxEvent } from './telnyx.js';
import { parseWebhook, sendWhatsAppText, verifyHub, type WaAccount, type WaWebhook } from './whatsapp.js';

export interface CommsConfig {
  agentId: string;
  display: string;
  smsTexts: SmsTexts;
  publicUrl: string;
  apiToken: string;
  inbox?: { url: string; secret: string } | undefined;
  stateFile?: string | undefined;
  caps: Record<Channel, number>;
  sms?: TelnyxAccount | undefined;
  wa?: (WaAccount & { relaySecret: string }) | undefined;
  host: string;
  port: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (m: string) => void;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): CommsConfig {
  const need = (k: string) => { const v = env[k]; if (!v) throw new Error(`${k} is required`); return v; };
  return {
    agentId: need('AGENT_ID'),
    display: env.AGENT_DISPLAY ?? `${need('AGENT_ID')} (Visybl)`,
    smsTexts: smsTexts(env),
    publicUrl: need('PUBLIC_URL').replace(/\/$/, ''),
    apiToken: need('COMMS_API_TOKEN'),
    inbox: env.INBOX_URL && env.INBOX_WEBHOOK_SECRET ? { url: env.INBOX_URL, secret: env.INBOX_WEBHOOK_SECRET } : undefined,
    stateFile: env.COMMS_STATE ?? './data/comms-state.json',
    caps: { sms: Number(env.SMS_DAILY_CAP ?? 40), whatsapp: Number(env.WA_DAILY_CAP ?? 100) },
    sms: env.TELNYX_API_KEY && env.TELNYX_PUBLIC_KEY && env.SMS_NUMBER ? { apiKey: env.TELNYX_API_KEY, publicKey: env.TELNYX_PUBLIC_KEY, number: env.SMS_NUMBER, messagingProfileId: env.TELNYX_MESSAGING_PROFILE_ID } : undefined,
    wa: env.WA_PHONE_NUMBER_ID && env.WA_ACCESS_TOKEN && env.WA_RELAY_SECRET ? { phoneNumberId: env.WA_PHONE_NUMBER_ID, accessToken: env.WA_ACCESS_TOKEN, relaySecret: env.WA_RELAY_SECRET } : undefined,
    host: env.COMMS_HOST ?? '127.0.0.1',
    port: Number(env.COMMS_PORT ?? 8870),
  };
}

/** The texts published in the SMS program terms (visybl.com/sms); carriers compare live traffic against them. */
export function smsTexts(env: NodeJS.ProcessEnv = {}): SmsTexts {
  const brand = env.SMS_BRAND ?? 'Visybl', program = env.SMS_PROGRAM ?? 'Visybl Reserve Alerts', care = env.SMS_CARE ?? 'agent001@a9n9.net or visybl.com/sms';
  return {
    prefix: `${brand}: `,
    welcome: `${brand}: Thanks for texting ${program}. Replies come from ${brand}'s automated agent, not a person. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.`,
    help: `${brand}: ${program} from ${brand} Inc. Replies are automated. Help: ${care}. Msg & data rates may apply. Reply STOP to opt out.`,
    stop: `${brand}: You are unsubscribed from ${program} and will get no further messages. Reply START to rejoin.`,
  };
}

const readBody = (req: IncomingMessage, max = 256 * 1024) => new Promise<string>((resolve, reject) => {
  let n = 0; const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject);
});

function bearerOk(header: string | undefined, token: string) {
  const got = Buffer.from(header?.startsWith('Bearer ') ? header.slice(7) : ''); const want = Buffer.from(token);
  return token.length > 0 && got.length === want.length && timingSafeEqual(got, want);
}

export function createCommsServer(cfg: CommsConfig) {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const log = cfg.log ?? ((m: string) => console.log(`[comms ${cfg.agentId}] ${m}`));
  const policy = new Policy(cfg.stateFile, cfg.caps, cfg.now);

  async function ledger(channel: Channel, payload: { id: string; type: string } & Record<string, unknown>) {
    if (!cfg.inbox) return;
    const body = JSON.stringify({ agent: cfg.agentId, ...payload });
    const sig = createHmac('sha256', cfg.inbox.secret).update(body).digest('hex');
    await fetchImpl(`${cfg.inbox.url.replace(/\/$/, '')}/hooks/${channel}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) })
      .then((r) => { if (r.status >= 300) log(`inbox answered ${r.status} for ${payload.type}`); })
      .catch((e: Error) => log(`inbox post failed: ${e.message}`));
  }

  const send = (res: ServerResponse, status: number, body: unknown, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://local');
      if (url.pathname === '/livez') return send(res, 200, { ok: true, agent: cfg.agentId });

      if (req.method === 'POST' && url.pathname === '/sms/telnyx') {
        if (!cfg.sms) return send(res, 404, { error: 'sms not configured' });
        const raw = await readBody(req);
        const ok = verifyTelnyx(cfg.sms.publicKey, raw, req.headers['telnyx-signature-ed25519'] as string | undefined, req.headers['telnyx-timestamp'] as string | undefined, (cfg.now ?? Date.now)());
        if (!ok) { log(`rejected unsigned ${url.pathname} from ${req.socket.remoteAddress}`); return send(res, 401, { error: 'bad signature' }); }
        const ev = (JSON.parse(raw) as TelnyxEvent).data; const p = ev?.payload;
        if (!ev || !p) return send(res, 200, { ok: true });
        if (ev.event_type === 'message.sent' || ev.event_type === 'message.finalized') {
          const status = p.to?.[0]?.status ?? ev.event_type;
          await ledger('sms', { id: `sms:status:${p.id}:${status}`, type: 'sms.status', messageId: p.id, status, to: p.to?.[0]?.phone_number, error: p.errors?.[0]?.detail ?? p.errors?.[0]?.code, at: ev.occurred_at ?? new Date().toISOString() });
          return send(res, 200, { ok: true });
        }
        if (ev.event_type !== 'message.received') return send(res, 200, { ok: true });
        const from = p.from?.phone_number ?? '';
        if (!(p.to ?? []).some((t) => t.phone_number === cfg.sms!.number)) return send(res, 200, { ok: true }); // not this agent's number: ignore, never re-route
        const id = p.id ?? `sms-${Date.now()}`; const text = p.text ?? '';
        const kind = policy.inbound('sms', from, text, id);
        await ledger('sms', { id: `sms:in:${id}`, type: 'sms.received', from, to: cfg.sms.number, text, consent: kind, at: ev.occurred_at ?? new Date().toISOString() });
        const auto = policy.autoReply('sms', from, kind, cfg.smsTexts);
        if (auto) {
          // Program replies are not the agent's speech and do not count against its daily cap; a STOP confirmation may be refused by the carrier, which is fine.
          try { const mid = await sendTelnyxSms(cfg.sms, from, auto, `${cfg.publicUrl}/sms/telnyx`, fetchImpl); if (kind !== 'stop') policy.markDisclosed('sms', from); await ledger('sms', { id: `sms:out:${mid}`, type: 'sms.sent', to: from, text: auto, auto: kind, at: new Date().toISOString() }); }
          catch (e) { log(`auto-reply (${kind}) to ${from} failed: ${e instanceof Error ? e.message : String(e)}`); }
        }
        return send(res, 200, { ok: true });
      }

      if (req.method === 'POST' && url.pathname === '/whatsapp') {
        if (!cfg.wa) return send(res, 404, { error: 'whatsapp not configured' });
        const raw = await readBody(req);
        if (!verifyHub(cfg.wa.relaySecret, raw, req.headers['x-a9n9-relay-signature'] as string | undefined)) return send(res, 401, { error: 'bad signature' });
        for (const item of parseWebhook(JSON.parse(raw) as WaWebhook)) {
          if (item.phoneNumberId !== cfg.wa.phoneNumberId) continue; // relay bug or misroute: never act on another agent's number
          if (item.kind === 'message') {
            policy.inbound('whatsapp', item.from, item.text, item.id);
            await ledger('whatsapp', { id: `whatsapp:in:${item.id}`, type: 'whatsapp.received', from: item.from, name: item.name, text: item.text, messageType: item.type, at: item.at });
          } else {
            await ledger('whatsapp', { id: `whatsapp:status:${item.id}:${item.status}`, type: 'whatsapp.status', messageId: item.id, status: item.status, to: item.to, error: item.error, at: item.at });
          }
        }
        return send(res, 200, { ok: true });
      }

      if (url.pathname.startsWith('/v1/')) {
        if (!bearerOk(req.headers.authorization, cfg.apiToken)) return send(res, 401, { error: 'unauthorized' });
        if (req.method === 'GET' && url.pathname === '/v1/status') {
          return send(res, 200, { agent: cfg.agentId, sms: cfg.sms ? { number: cfg.sms.number, remainingToday: policy.remaining('sms') } : null, whatsapp: cfg.wa ? { phoneNumberId: cfg.wa.phoneNumberId, remainingToday: policy.remaining('whatsapp') } : null });
        }
        if (req.method === 'POST' && url.pathname === '/v1/send') {
          const b = JSON.parse((await readBody(req)) || '{}') as { channel?: string; to?: string; text?: string };
          const ch = b.channel as Channel;
          if (ch !== 'sms' && ch !== 'whatsapp') return send(res, 400, { error: "channel must be 'sms' or 'whatsapp'" });
          if (!b.to || !/^\+[1-9]\d{6,14}$/.test(b.to)) return send(res, 400, { error: 'to must be E.164, e.g. +14155550100' });
          let text = (b.text ?? '').trim();
          if (!text || text.length > 1500) return send(res, 400, { error: 'text must be 1–1500 characters' });
          if ((ch === 'sms' && !cfg.sms) || (ch === 'whatsapp' && !cfg.wa)) return send(res, 409, { error: `${ch} is not set up for this agent yet` });
          const refused = policy.refusal(ch, b.to);
          if (refused) return send(res, 403, { error: refused });
          // Every program text starts with the brand (published terms); the first-contact disclosure was already sent on inbound.
          if (ch === 'sms' && !text.startsWith(cfg.smsTexts.prefix)) text = cfg.smsTexts.prefix + text;
          if (ch === 'sms' && text.length > 1500) return send(res, 400, { error: 'text must be 1–1500 characters' });
          try {
            const id = ch === 'sms' ? await sendTelnyxSms(cfg.sms!, b.to, text, `${cfg.publicUrl}/sms/telnyx`, fetchImpl) : await sendWhatsAppText(cfg.wa!, b.to, text, fetchImpl);
            policy.sent(ch, b.to);
            await ledger(ch, { id: `${ch}:out:${id}`, type: `${ch}.sent`, to: b.to, text, at: new Date().toISOString() });
            return send(res, 202, { ok: true, id, channel: ch, remainingToday: policy.remaining(ch) });
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            log(`send ${ch} to ${b.to} failed: ${message}`);
            return send(res, 502, { error: message });
          }
        }
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      log(`error: ${e instanceof Error ? e.message : String(e)}`);
      return send(res, 400, { error: 'bad request' });
    }
  });
  return { server, policy };
}

const isMain = process.argv[1]?.endsWith('server.js');
if (isMain) {
  const cfg = configFromEnv();
  const { server } = createCommsServer(cfg);
  server.listen(cfg.port, cfg.host, () => console.log(`[comms ${cfg.agentId}] :${cfg.port} sms=${cfg.sms ? cfg.sms.number : 'off'} whatsapp=${cfg.wa ? cfg.wa.phoneNumberId : 'off'}`));
}
