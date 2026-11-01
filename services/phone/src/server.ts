/**
 * Phone channel server — one Twilio number, voice and SMS.
 *
 *   POST /twilio/voice       voice webhook → TwiML connecting the call to ConversationRelay
 *   WS   /relay              ConversationRelay session (handshake signature verified)
 *   POST /twilio/ended       <Connect action> callback when a voice session ends
 *   POST /twilio/sms         inbound SMS/MMS → signed `sms.received` event to the inbox; no auto-reply
 *   POST /twilio/sms-status  delivery status for outbound SMS → `sms.status` event
 *   POST /v1/sms/send        the agent sends an SMS (bearer API_TOKEN); daily cap
 *   GET  /livez
 *
 * Env: PHONE_PORT (8820) PHONE_HOST (127.0.0.1) PUBLIC_HOST (phone.a9n9.net)
 *      TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN (signature checks) TWILIO_API_KEY_SID TWILIO_API_KEY_SECRET (sending)
 *      TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID (sender)
 *      API_TOKEN (bearer for /v1/*)  INBOX_URL INBOX_WEBHOOK_SECRET
 *      AGENT_GREETING VOICE_MAX_SECONDS (180) VOICE_MAX_SECONDS_STRANGER (120) VOICE_KNOWN_CALLERS
 *      SMS_DAILY_CAP (100)  LLM_BASE_URL LLM_API_KEY LLM_MODEL (unset → scripted responder)
 *      PHONE_SKIP_SIGNATURE=1 for local tests only
 */
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import twilio from 'twilio';
import { WebSocketServer, type WebSocket } from 'ws';
import { LEGAL_PAGES } from './legal.js';
import { LlmResponder, RelaySession, ScriptedResponder, type Responder, type SessionSummary, type Tier } from './relay.js';

export interface PhoneConfig {
  port: number;
  host: string;
  publicHost: string;
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiKeySecret: string;
  phoneNumber: string;
  messagingServiceSid: string;
  apiToken: string;
  skipSignature: boolean;
  inboxUrl: string;
  inboxSecret: string;
  greeting: string;
  maxSeconds: number;
  maxSecondsStranger: number;
  knownCallers: Set<string>;
  speechHints: string;
  smsDailyCap: number;
  responder: Responder;
  fetchImpl: typeof fetch;
  log: (m: string) => void;
}

/**
 * Live facts from the reserves monitor, compact enough to ride in a system
 * prompt, cached for a minute so a chatty call does not hammer it.
 */
export function reservesFacts(url: string, fetchImpl: typeof fetch = fetch, ttlMs = 60_000): () => Promise<string> {
  let cached = { at: 0, text: '' };
  const usd = (micros: string) => {
    const n = Number(BigInt(micros)) / 1e6;
    return n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion dollars` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} million dollars` : n >= 1e3 ? `${Math.round(n / 1e3)} thousand dollars` : `${n.toFixed(2)} dollars`;
  };
  return async () => {
    if (Date.now() - cached.at < ttlMs && cached.text) return cached.text;
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/v1/tokens`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`reserves ${res.status}`);
    const snap = (await res.json()) as { refreshedAt: string; tokens: Array<{ symbol: string; tracked: string[]; tempoSupply: string; status: string; issuer: { reportedSupply: string; reportedReserves: string } | null }> };
    // Recognized tokens with at least a dollar on Tempo; dust and wrappers are not facts worth speaking.
    const recognized = snap.tokens.filter((t) => t.tracked.some((r) => r !== 'active' && r !== 'collision') && BigInt(t.tempoSupply) >= 1_000_000n);
    const lines = recognized.map((t) => {
      const issuer = t.issuer ? `issuer reports ${usd(t.issuer.reportedReserves)} in reserves against ${usd(t.issuer.reportedSupply)} outstanding across all chains; status ${t.status === 'ok' ? 'reconciled' : t.status}` : 'no public issuer attestation';
      return `- ${t.symbol}: ${usd(t.tempoSupply)} on Tempo; ${issuer}.`;
    });
    const total = recognized.reduce((s, t) => s + BigInt(t.tempoSupply), 0n);
    cached = { at: Date.now(), text: `As of ${new Date(snap.refreshedAt).toUTCString()} (data refreshes every ten minutes):\n- Total recognized stablecoin supply on Tempo: ${usd(total.toString())}.\n${lines.join('\n')}` };
    return cached.text;
  };
}

export const DEFAULT_SPEECH_HINTS = 'Tempo, pathUSD, path USD, OUSD, USDB, USDS, DLUSD, USDC, USDT, stablecoin, reserves, issuer, Bridge, a9n9, agent';

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): PhoneConfig {
  const responder: Responder = env.LLM_BASE_URL
    ? new LlmResponder({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY ?? env.XAI_API_KEY ?? '',
        model: env.LLM_MODEL ?? 'grok-4.6',
        systemPrompt: env.AGENT_VOICE_PROMPT ?? [
          'You are an autonomous software agent operated by a9n9, speaking on a live phone call through text-to-speech. You are not a person and never pretend to be.',
          'Answer in one or two short, plain sentences. No lists, no markdown. Say web addresses as words ("reserves dot a9n9 dot net").',
          'What you do: you monitor stablecoin reserves on the Tempo network and answer questions about them. You can be reached by email at agent at a9n9 dot net.',
          'If the caller says only a filler like "yeah", "okay", "hello" or "thanks", answer with a few words at most; do not ask "how can I help" more than once in a call. If they ask for something outside your work, say so briefly and offer what you can do instead.',
          'Numbers: only ever state figures that appear in LIVE FACTS below. Never estimate, round from memory, or guess.',
        ].join(' '),
        facts: reservesFacts(env.RESERVES_URL ?? 'https://reserves.a9n9.net'),
      })
    : new ScriptedResponder([
        { match: /who|what are you|human|robot|bot/i, reply: "I'm an autonomous software agent operated by a9n9. I'm not a person, and this call is recorded in my public log." },
        { match: /ousd|reserve|backed/i, reply: 'As of my last check, the issuer reports more in reserves than is outstanding. The exact figures are on reserves dot a9n9 dot net.' },
        { match: /bye|goodbye|thanks/i, reply: 'Thanks for calling. You can also email me at agent at a9n9 dot net. Goodbye.' },
      ]);
  return {
    port: Number(env.PHONE_PORT ?? env.VOICE_PORT ?? 8820),
    host: env.PHONE_HOST ?? '127.0.0.1',
    publicHost: env.PUBLIC_HOST ?? 'localhost:8820',
    accountSid: env.TWILIO_ACCOUNT_SID ?? '',
    authToken: env.TWILIO_AUTH_TOKEN ?? '',
    apiKeySid: env.TWILIO_API_KEY_SID ?? '',
    apiKeySecret: env.TWILIO_API_KEY_SECRET ?? '',
    phoneNumber: env.TWILIO_PHONE_NUMBER ?? '',
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID ?? '',
    apiToken: env.API_TOKEN ?? '',
    skipSignature: env.PHONE_SKIP_SIGNATURE === '1' || env.VOICE_SKIP_SIGNATURE === '1',
    inboxUrl: env.INBOX_URL ?? '',
    inboxSecret: env.INBOX_WEBHOOK_SECRET ?? '',
    greeting: env.AGENT_GREETING ?? "Hello. You've reached an autonomous software agent operated by a9n9 — not a person. This call is logged. How can I help?",
    maxSeconds: Number(env.VOICE_MAX_SECONDS ?? 180),
    maxSecondsStranger: Number(env.VOICE_MAX_SECONDS_STRANGER ?? 120),
    knownCallers: new Set((env.VOICE_KNOWN_CALLERS ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
    speechHints: env.SPEECH_HINTS ?? DEFAULT_SPEECH_HINTS,
    smsDailyCap: Number(env.SMS_DAILY_CAP ?? 100),
    responder,
    fetchImpl: fetch,
    log: (m) => console.log(`${new Date().toISOString()} [phone] ${m}`),
  };
}

export const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function twiml(cfg: PhoneConfig): string {
  const wss = `wss://${cfg.publicHost}/relay`;
  const action = `https://${cfg.publicHost}/twilio/ended`;
  // No welcomeGreeting: the session speaks the greeting itself so it is in the transcript.
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect action="${escapeXml(action)}"><ConversationRelay url="${escapeXml(wss)}" interruptible="speech" dtmfDetection="true" /></Connect></Response>`;
}

export const MACHINE_MESSAGE = 'Hello, this is an autonomous software agent operated by a9n9, not a person. I called to introduce myself. You can reach me any time by email at agent at a9n9 dot net, or call this number back. Goodbye.';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
const parseForm = (body: string): Record<string, string> => Object.fromEntries(new URLSearchParams(body));

function validSignature(cfg: PhoneConfig, req: IncomingMessage, params: Record<string, string>): boolean {
  if (cfg.skipSignature) return true;
  const sig = (req.headers['x-twilio-signature'] as string | undefined) ?? '';
  if (!sig) { cfg.log(`no x-twilio-signature header on ${req.url}`); return false; }
  const path = req.url ?? '/';
  // Twilio signs webhooks against the https:// URL and ConversationRelay handshakes against the
  // wss:// URL from the TwiML; a trailing slash is sometimes added. Accept any of those forms.
  const candidates = [`https://${cfg.publicHost}${path}`, `wss://${cfg.publicHost}${path}`].flatMap((u) => [u, u.replace(/\/?(\?|$)/, '/$1')]);
  return candidates.some((u) => twilio.validateRequest(cfg.authToken, sig, u, params));
}

async function postEvent(cfg: PhoneConfig, channel: 'voice' | 'sms', payload: { type: string; id: string } & Record<string, unknown>): Promise<number> {
  if (!cfg.inboxUrl) return 0;
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', cfg.inboxSecret).update(body).digest('hex');
  try {
    const res = await cfg.fetchImpl(`${cfg.inboxUrl.replace(/\/$/, '')}/hooks/${channel}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch (err) {
    cfg.log(`inbox post failed for ${payload.id}: ${err instanceof Error ? err.message : String(err)}`);
    return -1;
  }
}

/** Outbound SMS through Twilio's Messaging API, with a per-day cap so a runaway loop cannot drain the balance. */
export class SmsSender {
  private day = '';
  private sentToday = 0;
  constructor(private readonly cfg: PhoneConfig) {}
  get remainingToday(): number {
    this.roll();
    return Math.max(0, this.cfg.smsDailyCap - this.sentToday);
  }
  private roll() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) { this.day = today; this.sentToday = 0; }
  }
  async send(to: string, body: string): Promise<{ sid: string; status: string }> {
    this.roll();
    if (this.sentToday >= this.cfg.smsDailyCap) throw new Error(`daily SMS cap of ${this.cfg.smsDailyCap} reached`);
    if (!/^\+[1-9]\d{6,14}$/.test(to)) throw new Error('to must be E.164');
    if (!body.trim() || body.length > 1600) throw new Error('body must be 1–1600 characters');
    const form = new URLSearchParams({ To: to, Body: body, StatusCallback: `https://${this.cfg.publicHost}/twilio/sms-status` });
    if (this.cfg.messagingServiceSid) form.set('MessagingServiceSid', this.cfg.messagingServiceSid);
    else form.set('From', this.cfg.phoneNumber);
    const res = await this.cfg.fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${this.cfg.apiKeySid}:${this.cfg.apiKeySecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as { sid?: string; status?: string; code?: number; message?: string };
    if (!res.ok || !data.sid) throw new Error(`twilio ${res.status}${data.code ? ` ${data.code}` : ''}: ${data.message ?? 'send failed'}`);
    this.sentToday++;
    return { sid: data.sid, status: data.status ?? 'queued' };
  }
}

export function createPhoneServer(cfg: PhoneConfig) {
  const tierFor = (from: string): Tier =>
    cfg.knownCallers.has(from)
      ? { name: 'known', maxSeconds: cfg.maxSeconds, closing: "We're at my time limit for this call. Email me at agent at a9n9 dot net and I'll continue there. Goodbye." }
      : { name: 'stranger', maxSeconds: cfg.maxSecondsStranger, closing: "That's all the call time I can give right now. Email agent at a9n9 dot net and I'll pick this up in writing. Goodbye." };
  const sms = new SmsSender(cfg);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const send = (status: number, body: string, type = 'application/json') => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
    try {
      if (url.pathname === '/livez') return send(200, JSON.stringify({ ok: true, smsRemainingToday: sms.remainingToday }));
      if (req.method === 'GET' && LEGAL_PAGES[url.pathname]) return send(200, LEGAL_PAGES[url.pathname]!, 'text/html; charset=utf-8');

      if (url.pathname.startsWith('/twilio/') && req.method === 'POST') {
        const params = parseForm(await readBody(req));
        if (!validSignature(cfg, req, params)) { cfg.log(`rejected unsigned ${url.pathname} from ${req.socket.remoteAddress}`); return send(403, '{"error":"bad signature"}'); }
        switch (url.pathname) {
          case '/twilio/voice': {
            // Outbound calls placed with MachineDetection report AnsweredBy; a machine gets a short message, not a conversation.
            const answeredBy = params.AnsweredBy ?? '';
            if (answeredBy.startsWith('machine') || answeredBy === 'fax') {
              cfg.log(`call ${params.CallSid ?? '?'} to ${params.To ?? '?'} answered by ${answeredBy}; leaving a message`);
              void postEvent(cfg, 'voice', { type: 'voice.call', id: params.CallSid ?? `machine-${Date.now()}`, from: params.From ?? '', to: params.To ?? '', answeredBy, endedBy: 'machine', turns: [{ role: 'agent', text: MACHINE_MESSAGE, at: new Date().toISOString() }], seconds: 0 });
              return send(200, `<?xml version="1.0" encoding="UTF-8"?><Response><Pause length="1"/><Say>${escapeXml(MACHINE_MESSAGE)}</Say><Hangup/></Response>`, 'text/xml');
            }
            cfg.log(`incoming call ${params.CallSid ?? '?'} from ${params.From ?? '?'}${answeredBy ? ` answered by ${answeredBy}` : ''}`);
            return send(200, twiml(cfg), 'text/xml');
          }
          case '/twilio/ended':
            cfg.log(`voice session ended ${params.CallSid ?? '?'} status=${params.SessionStatus ?? '?'} duration=${params.SessionDuration ?? '?'}`);
            return send(200, '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', 'text/xml');
          case '/twilio/sms': {
            const numMedia = Number(params.NumMedia ?? 0);
            const media = Array.from({ length: numMedia }, (_, i) => ({ url: params[`MediaUrl${i}`] ?? '', contentType: params[`MediaContentType${i}`] ?? '' }));
            const id = params.MessageSid ?? `sms-${Date.now()}`;
            cfg.log(`inbound sms ${id} from ${params.From ?? '?'} (${(params.Body ?? '').length} chars, ${numMedia} media)`);
            const status = await postEvent(cfg, 'sms', { type: 'sms.received', id, receivedAt: new Date().toISOString(), from: params.From ?? '', to: params.To ?? '', body: params.Body ?? '', media, fromCity: params.FromCity ?? null, fromState: params.FromState ?? null, fromCountry: params.FromCountry ?? null });
            if (status !== 201 && status !== 200) cfg.log(`inbox returned ${status} for ${id}`);
            return send(200, EMPTY_TWIML, 'text/xml'); // the agent replies asynchronously through /v1/sms/send
          }
          case '/twilio/sms-status': {
            const id = `${params.MessageSid ?? '?'}:${params.MessageStatus ?? '?'}`;
            await postEvent(cfg, 'sms', { type: 'sms.status', id, at: new Date().toISOString(), messageSid: params.MessageSid ?? '', status: params.MessageStatus ?? '', to: params.To ?? '', errorCode: params.ErrorCode ?? null });
            return send(204, '');
          }
          default:
            return send(404, '{"error":"not found"}');
        }
      }

      if (url.pathname.startsWith('/v1/')) {
        if (!cfg.apiToken || req.headers.authorization !== `Bearer ${cfg.apiToken}`) return send(401, '{"error":"unauthorized"}');
        if (url.pathname === '/v1/sms/send' && req.method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}') as { to?: string; body?: string };
          if (!body.to || !body.body) return send(400, '{"error":"to and body are required"}');
          try {
            const r = await sms.send(body.to, body.body);
            cfg.log(`outbound sms ${r.sid} to ${body.to} ${r.status}`);
            void postEvent(cfg, 'sms', { type: 'sms.sent', id: r.sid, at: new Date().toISOString(), to: body.to, body: body.body, status: r.status });
            return send(202, JSON.stringify(r));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            cfg.log(`outbound sms to ${body.to} failed: ${message}`);
            return send(/cap|E\.164|characters/.test(message) ? 429 : 502, JSON.stringify({ error: message }));
          }
        }
      }
      return send(404, '{"error":"not found"}');
    } catch (err) {
      cfg.log(`error: ${err instanceof Error ? err.message : String(err)}`);
      return send(500, '{"error":"internal"}');
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/relay') { socket.destroy(); return; }
    if (!validSignature(cfg, req, {})) { cfg.log(`rejected unsigned relay handshake from ${req.socket.remoteAddress}`); socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    const session = new RelaySession((m) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); if (m.type === 'end') setTimeout(() => ws.close(), 500); }, {
      responder: cfg.responder,
      tierFor,
      greeting: cfg.greeting,
      speechHints: cfg.speechHints,
      onEnd: async (summary: SessionSummary) => {
        cfg.log(`call ${summary.callSid} ended by ${summary.endedBy} after ${summary.seconds}s, ${summary.turns.length} turns`);
        const status = await postEvent(cfg, 'voice', { type: 'voice.call', id: summary.callSid, ...summary });
        cfg.log(`inbox ${status} for call ${summary.callSid}`);
      },
    });
    ws.on('message', (data) => void session.handle(data.toString()));
    ws.on('close', () => void session.close('caller'));
    ws.on('error', () => void session.close('error'));
  });

  return { server, wss, sms };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain) {
  const cfg = configFromEnv();
  if (!cfg.authToken && !cfg.skipSignature) { console.error('TWILIO_AUTH_TOKEN is required (or PHONE_SKIP_SIGNATURE=1 for local tests)'); process.exit(2); }
  const { server } = createPhoneServer(cfg);
  server.listen(cfg.port, cfg.host, () => cfg.log(`listening on http://${cfg.host}:${cfg.port}; public https://${cfg.publicHost}; sender ${cfg.messagingServiceSid || cfg.phoneNumber || 'unset'}; responder ${cfg.responder.constructor.name}`));
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
}

export type { ServerResponse };
