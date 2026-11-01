/**
 * Voice channel server.
 *
 *   POST /twilio/voice   Twilio's voice webhook for the number → TwiML that
 *                        connects the call to ConversationRelay at wss://<host>/relay
 *   WS   /relay          ConversationRelay session (handshake signature verified)
 *   POST /twilio/ended   <Connect action> callback when the session ends
 *   GET  /livez
 *
 * Env: VOICE_PORT (8820) VOICE_HOST (127.0.0.1) PUBLIC_HOST (e.g. voice.a9n9.net)
 *      TWILIO_AUTH_TOKEN (required in production; VOICE_SKIP_SIGNATURE=1 for local tests)
 *      INBOX_URL (e.g. http://127.0.0.1:8810) INBOX_WEBHOOK_SECRET
 *      AGENT_GREETING, VOICE_MAX_SECONDS (180), VOICE_MAX_SECONDS_STRANGER (120)
 *      LLM_BASE_URL LLM_API_KEY LLM_MODEL (unset → scripted responder)
 */
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import twilio from 'twilio';
import { WebSocketServer, type WebSocket } from 'ws';
import { LlmResponder, RelaySession, ScriptedResponder, type Responder, type SessionSummary, type Tier } from './relay.js';

export interface VoiceConfig {
  port: number;
  host: string;
  publicHost: string;
  authToken: string;
  skipSignature: boolean;
  inboxUrl: string;
  inboxSecret: string;
  greeting: string;
  maxSeconds: number;
  maxSecondsStranger: number;
  knownCallers: Set<string>;
  responder: Responder;
  log: (m: string) => void;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): VoiceConfig {
  const responder: Responder = env.LLM_BASE_URL
    ? new LlmResponder({
        baseUrl: env.LLM_BASE_URL,
        apiKey: env.LLM_API_KEY ?? '',
        model: env.LLM_MODEL ?? 'claude-haiku-4-5-20251001',
        systemPrompt: env.AGENT_VOICE_PROMPT ?? 'You are an autonomous software agent operated by a9n9, speaking on a phone call. Keep answers to two short sentences. Never pretend to be human.',
      })
    : new ScriptedResponder([
        { match: /who|what are you|human|robot|bot/i, reply: "I'm an autonomous software agent operated by a9n9. I'm not a person, and this call is recorded in my public log." },
        { match: /ousd|reserve|backed/i, reply: 'As of my last check, the issuer reports more in reserves than is outstanding. The exact figures are on reserves dot a9n9 dot net.' },
        { match: /bye|goodbye|thanks/i, reply: 'Thanks for calling. You can also email me at agent at a9n9 dot net. Goodbye.' },
      ]);
  return {
    port: Number(env.VOICE_PORT ?? 8820),
    host: env.VOICE_HOST ?? '127.0.0.1',
    publicHost: env.PUBLIC_HOST ?? 'localhost:8820',
    authToken: env.TWILIO_AUTH_TOKEN ?? '',
    skipSignature: env.VOICE_SKIP_SIGNATURE === '1',
    inboxUrl: env.INBOX_URL ?? '',
    inboxSecret: env.INBOX_WEBHOOK_SECRET ?? '',
    greeting: env.AGENT_GREETING ?? "Hello. You've reached an autonomous software agent operated by a9n9 — not a person. This call is logged. How can I help?",
    maxSeconds: Number(env.VOICE_MAX_SECONDS ?? 180),
    maxSecondsStranger: Number(env.VOICE_MAX_SECONDS_STRANGER ?? 120),
    knownCallers: new Set((env.VOICE_KNOWN_CALLERS ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
    responder,
    log: (m) => console.log(`${new Date().toISOString()} [voice] ${m}`),
  };
}

export const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function twiml(cfg: VoiceConfig): string {
  const wss = `wss://${cfg.publicHost}/relay`;
  const action = `https://${cfg.publicHost}/twilio/ended`;
  // No welcomeGreeting: the session speaks the greeting itself so it is in the transcript.
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect action="${escapeXml(action)}"><ConversationRelay url="${escapeXml(wss)}" interruptible="speech" dtmfDetection="true" /></Connect></Response>`;
}

async function readForm(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

function fullUrl(cfg: VoiceConfig, req: IncomingMessage): string {
  return `https://${cfg.publicHost}${req.url ?? '/'}`;
}

function validSignature(cfg: VoiceConfig, req: IncomingMessage, params: Record<string, string>): boolean {
  if (cfg.skipSignature) return true;
  const sig = (req.headers['x-twilio-signature'] as string | undefined) ?? '';
  const url = fullUrl(cfg, req);
  // Twilio's own validator; for websocket handshakes a trailing slash variant is sometimes needed.
  return twilio.validateRequest(cfg.authToken, sig, url, params) || twilio.validateRequest(cfg.authToken, sig, url.replace(/\/?$/, '/'), params);
}

async function postToInbox(cfg: VoiceConfig, summary: SessionSummary): Promise<void> {
  if (!cfg.inboxUrl) return;
  const payload = { type: 'voice.call', id: summary.callSid, ...summary };
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', cfg.inboxSecret).update(body).digest('hex');
  try {
    const res = await fetch(`${cfg.inboxUrl.replace(/\/$/, '')}/hooks/voice`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': 'voice.call', 'x-a9n9-id': summary.callSid }, body, signal: AbortSignal.timeout(8000) });
    cfg.log(`inbox ${res.status} for call ${summary.callSid}`);
  } catch (err) {
    cfg.log(`inbox post failed for ${summary.callSid}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function createVoiceServer(cfg: VoiceConfig) {
  const tierFor = (from: string): Tier =>
    cfg.knownCallers.has(from)
      ? { name: 'known', maxSeconds: cfg.maxSeconds, closing: "We're at my time limit for this call. Email me at agent at a9n9 dot net and I'll continue there. Goodbye." }
      : { name: 'stranger', maxSeconds: cfg.maxSecondsStranger, closing: "That's all the call time I can give right now. Email agent at a9n9 dot net and I'll pick this up in writing. Goodbye." };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const send = (status: number, body: string, type = 'application/json') => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
    try {
      if (url.pathname === '/livez') return send(200, '{"ok":true}');
      if (url.pathname === '/twilio/voice' && req.method === 'POST') {
        const params = await readForm(req);
        if (!validSignature(cfg, req, params)) { cfg.log(`rejected unsigned voice webhook from ${req.socket.remoteAddress}`); return send(403, '{"error":"bad signature"}'); }
        cfg.log(`incoming call ${params.CallSid ?? '?'} from ${params.From ?? '?'}`);
        return send(200, twiml(cfg), 'text/xml');
      }
      if (url.pathname === '/twilio/ended' && req.method === 'POST') {
        const params = await readForm(req);
        if (!validSignature(cfg, req, params)) return send(403, '{"error":"bad signature"}');
        cfg.log(`session ended ${params.CallSid ?? '?'} status=${params.SessionStatus ?? '?'} duration=${params.SessionDuration ?? '?'}`);
        return send(200, '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', 'text/xml');
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
      onEnd: (summary) => { cfg.log(`call ${summary.callSid} ended by ${summary.endedBy} after ${summary.seconds}s, ${summary.turns.length} turns`); return postToInbox(cfg, summary); },
    });
    ws.on('message', (data) => void session.handle(data.toString()));
    ws.on('close', () => void session.close('caller'));
    ws.on('error', () => void session.close('error'));
  });

  return { server, wss };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain) {
  const cfg = configFromEnv();
  if (!cfg.authToken && !cfg.skipSignature) { console.error('TWILIO_AUTH_TOKEN is required (or VOICE_SKIP_SIGNATURE=1 for local tests)'); process.exit(2); }
  const { server } = createVoiceServer(cfg);
  server.listen(cfg.port, cfg.host, () => cfg.log(`listening on http://${cfg.host}:${cfg.port}; TwiML points at wss://${cfg.publicHost}/relay; responder ${cfg.responder.constructor.name}`));
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.close(() => process.exit(0)));
}

export type { ServerResponse };
