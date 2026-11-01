import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { RelaySession, ScriptedResponder, type OutboundMessage, type SessionSummary } from '../src/relay.js';
import { configFromEnv, createVoiceServer, twiml } from '../src/server.js';

const setup = { type: 'setup', sessionId: 'VX1', callSid: 'CA1', from: '+15551234567', to: '+15557654321' };

describe('RelaySession', () => {
  it('greets with the disclosure, answers prompts in streamed tokens, and summarises on close', async () => {
    const out: OutboundMessage[] = [];
    let summary: SessionSummary | null = null;
    const s = new RelaySession((m) => out.push(m), {
      responder: new ScriptedResponder([{ match: /backed/i, reply: 'Yes, as of my last check it is fully backed.' }]),
      tierFor: () => ({ name: 'stranger', maxSeconds: 120, closing: 'Time is up.' }),
      greeting: 'Hello, I am an autonomous agent operated by a9n9.',
      onEnd: (x) => { summary = x; },
      setTimer: () => ({ clear() {} }),
    });
    await s.handle(JSON.stringify(setup));
    expect(out[0]).toEqual({ type: 'text', token: 'Hello, I am an autonomous agent operated by a9n9.', last: true });
    await s.handle(JSON.stringify({ type: 'prompt', voicePrompt: 'Is OUSD backed?', lang: 'en-US', last: true }));
    const tokens = out.slice(1).filter((m): m is Extract<OutboundMessage, { type: 'text' }> => m.type === 'text');
    expect(tokens.map((t) => t.token).join('')).toBe('Yes, as of my last check it is fully backed.');
    expect(tokens.at(-1)!.last).toBe(true);
    expect(tokens.slice(0, -1).every((t) => !t.last)).toBe(true);
    // partial transcripts are ignored
    await s.handle(JSON.stringify({ type: 'prompt', voicePrompt: 'Is', last: false }));
    await s.close('caller');
    expect(summary!.callSid).toBe('CA1');
    expect(summary!.endedBy).toBe('caller');
    expect(summary!.turns.map((t) => t.role)).toEqual(['system', 'agent', 'caller', 'agent']);
    expect(out.some((m) => m.type === 'end')).toBe(false); // caller hung up; we do not send end
  });

  it('ends the call at the tier cap with a closing line and an end message', async () => {
    const out: OutboundMessage[] = [];
    let fire: (() => void) | null = null;
    let summary: SessionSummary | null = null;
    let t = 1_000_000;
    const s = new RelaySession((m) => out.push(m), {
      responder: new ScriptedResponder([]),
      tierFor: (from) => (from === '+15551234567' ? { name: 'stranger', maxSeconds: 120, closing: 'Time is up. Goodbye.' } : { name: 'known', maxSeconds: 180, closing: 'x' }),
      greeting: 'Hi.',
      onEnd: (x) => { summary = x; },
      now: () => t,
      setTimer: (fn, ms) => { expect(ms).toBe(120_000); fire = fn; return { clear() {} }; },
    });
    await s.handle(JSON.stringify(setup));
    t += 120_000;
    fire!();
    await new Promise((r) => setTimeout(r, 5));
    expect(out.at(-2)).toEqual({ type: 'text', token: 'Time is up. Goodbye.', last: true });
    expect(out.at(-1)).toEqual({ type: 'end' });
    expect(summary!.endedBy).toBe('cap');
    expect(summary!.seconds).toBe(120);
    expect(summary!.tier).toBe('stranger');
  });

  it('an interrupt aborts the reply in progress', async () => {
    const out: OutboundMessage[] = [];
    const slow = { async *respond() { yield 'one '; await new Promise((r) => setTimeout(r, 30)); yield 'two '; await new Promise((r) => setTimeout(r, 30)); yield 'three'; } };
    const s = new RelaySession((m) => out.push(m), { responder: slow, tierFor: () => ({ name: 'x', maxSeconds: 60, closing: '' }), greeting: 'Hi.', onEnd: () => {}, setTimer: () => ({ clear() {} }) });
    await s.handle(JSON.stringify(setup));
    const p = s.handle(JSON.stringify({ type: 'prompt', voicePrompt: 'tell me', last: true }));
    await new Promise((r) => setTimeout(r, 10));
    await s.handle(JSON.stringify({ type: 'interrupt', utteranceUntilInterrupt: 'one', durationUntilInterruptMs: 400 }));
    await p;
    const spoken = out.filter((m) => m.type === 'text').map((m) => (m as { token: string }).token).join('');
    expect(spoken).toContain('one');
    expect(spoken).not.toContain('three');
    expect(s.transcript.some((t) => t.role === 'system' && /interrupted/.test(t.text))).toBe(true);
  });
});

describe('voice server', () => {
  let inbox: Server;
  let inboxPort = 0;
  const received: Array<{ sig: string; body: string }> = [];
  let voice: ReturnType<typeof createVoiceServer>;
  let voicePort = 0;

  beforeAll(async () => {
    inbox = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { received.push({ sig: String(req.headers['x-a9n9-signature']), body: b }); res.writeHead(201); res.end('{}'); }); });
    inbox.listen(0, '127.0.0.1');
    await once(inbox, 'listening');
    inboxPort = (inbox.address() as { port: number }).port;
    const cfg = configFromEnv({ VOICE_SKIP_SIGNATURE: '1', PUBLIC_HOST: 'voice.a9n9.net', INBOX_URL: `http://127.0.0.1:${inboxPort}`, INBOX_WEBHOOK_SECRET: 'sek', VOICE_MAX_SECONDS_STRANGER: '1' });
    cfg.log = () => {};
    voice = createVoiceServer(cfg);
    voice.server.listen(0, '127.0.0.1');
    await once(voice.server, 'listening');
    voicePort = (voice.server.address() as { port: number }).port;
  });
  afterAll(async () => { voice.wss.close(); voice.server.close(); inbox.close(); });

  it('returns TwiML that connects the call to the relay websocket', async () => {
    const res = await fetch(`http://127.0.0.1:${voicePort}/twilio/voice`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CA9&From=%2B15550001111&To=%2B15550002222' });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<ConversationRelay url="wss://voice.a9n9.net/relay"');
    expect(xml).toContain('action="https://voice.a9n9.net/twilio/ended"');
    expect(xml).not.toContain('welcomeGreeting');
  });

  it('rejects an unsigned voice webhook when signature checking is on', async () => {
    const cfg = configFromEnv({ TWILIO_AUTH_TOKEN: 'tok', PUBLIC_HOST: 'voice.a9n9.net' });
    cfg.log = () => {};
    const strict = createVoiceServer(cfg);
    strict.server.listen(0, '127.0.0.1');
    await once(strict.server, 'listening');
    const port = (strict.server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/twilio/voice`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CA9' });
    expect(res.status).toBe(403);
    strict.wss.close();
    strict.server.close();
  });

  it('runs a full simulated ConversationRelay call: greeting, answer, cap, end, signed transcript to the inbox', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${voicePort}/relay`);
    const msgs: OutboundMessage[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    await once(ws, 'open');
    ws.send(JSON.stringify(setup));
    ws.send(JSON.stringify({ type: 'prompt', voicePrompt: 'Are you a human?', lang: 'en-US', last: true }));
    await once(ws, 'close'); // the 1-second stranger cap ends the call
    expect(msgs[0]!.type).toBe('text');
    expect((msgs[0] as { token: string }).token).toMatch(/autonomous software agent operated by a9n9/);
    const spoken = msgs.filter((m) => m.type === 'text').map((m) => (m as { token: string }).token).join('');
    expect(spoken).toMatch(/not a person/);
    expect(msgs.at(-1)).toEqual({ type: 'end' });
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(1);
    const { sig, body } = received[0]!;
    expect(sig).toBe(`sha256=${createHmac('sha256', 'sek').update(body).digest('hex')}`);
    const payload = JSON.parse(body) as SessionSummary & { type: string };
    expect(payload.type).toBe('voice.call');
    expect(payload.endedBy).toBe('cap');
    expect(payload.turns.filter((t) => t.role === 'caller')).toHaveLength(1);
  });

  it('twiml escapes the host', () => {
    expect(twiml({ ...configFromEnv({ PUBLIC_HOST: 'a"b' }) })).toContain('a&quot;b');
  });
});
