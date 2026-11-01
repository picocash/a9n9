import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configFromEnv, createPhoneServer, SmsSender } from '../src/server.js';

describe('SMS', () => {
  let inbox: Server;
  const received: Array<{ sig: string; path: string; body: string }> = [];
  let phone: ReturnType<typeof createPhoneServer>;
  let port = 0;
  const twilioCalls: Array<{ url: string; body: string; auth: string }> = [];

  beforeAll(async () => {
    inbox = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { received.push({ sig: String(req.headers['x-a9n9-signature']), path: req.url ?? '', body: b }); res.writeHead(201); res.end('{}'); }); });
    inbox.listen(0, '127.0.0.1');
    await once(inbox, 'listening');
    const inboxPort = (inbox.address() as { port: number }).port;
    const cfg = configFromEnv({ PHONE_SKIP_SIGNATURE: '1', PUBLIC_HOST: 'phone.a9n9.net', INBOX_URL: `http://127.0.0.1:${inboxPort}`, INBOX_WEBHOOK_SECRET: 'sek', API_TOKEN: 'tok', TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_API_KEY_SID: 'SKtest', TWILIO_API_KEY_SECRET: 'secret', TWILIO_MESSAGING_SERVICE_SID: 'MGtest', SMS_DAILY_CAP: '2' });
    cfg.log = () => {};
    // Mock Twilio's Messages API; everything else goes to the real fetch (the inbox mock).
    const real = fetch;
    cfg.fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://api.twilio.com/')) {
        twilioCalls.push({ url, body: String(init?.body), auth: String((init?.headers as Record<string, string>).authorization) });
        return new Response(JSON.stringify({ sid: `SM${twilioCalls.length}`, status: 'queued' }), { status: 201 });
      }
      return real(input, init);
    }) as typeof fetch;
    phone = createPhoneServer(cfg);
    phone.server.listen(0, '127.0.0.1');
    await once(phone.server, 'listening');
    port = (phone.server.address() as { port: number }).port;
  });
  afterAll(() => { phone.wss.close(); phone.server.close(); inbox.close(); });

  it('inbound SMS becomes a signed sms.received event and gets an empty TwiML (no auto-reply)', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/twilio/sms`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ MessageSid: 'SMin1', From: '+15550001111', To: '+15104433533', Body: 'Is OUSD backed?', NumMedia: '1', MediaUrl0: 'https://api.twilio.com/m/1', MediaContentType0: 'image/jpeg', FromCity: 'OAKLAND' }).toString() });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    const ev = received.find((r) => r.path === '/hooks/sms')!;
    expect(ev.sig).toBe(`sha256=${createHmac('sha256', 'sek').update(ev.body).digest('hex')}`);
    const p = JSON.parse(ev.body);
    expect(p).toMatchObject({ type: 'sms.received', id: 'SMin1', from: '+15550001111', body: 'Is OUSD backed?', fromCity: 'OAKLAND' });
    expect(p.media).toEqual([{ url: 'https://api.twilio.com/m/1', contentType: 'image/jpeg' }]);
  });

  it('delivery status callbacks become sms.status events', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/twilio/sms-status`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'MessageSid=SM1&MessageStatus=delivered&To=%2B15550001111' });
    expect(res.status).toBe(204);
    const ev = received.filter((r) => r.path === '/hooks/sms').map((r) => JSON.parse(r.body)).find((p) => p.type === 'sms.status');
    expect(ev).toMatchObject({ id: 'SM1:delivered', status: 'delivered' });
  });

  it('the agent sends through the Messaging API with the API key, logs an sms.sent event, and hits the daily cap', async () => {
    const send = (to: string, body: string, token = 'tok') => fetch(`http://127.0.0.1:${port}/v1/sms/send`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ to, body }) });
    expect((await send('+15550001111', 'hi', 'wrong')).status).toBe(401);
    expect((await send('5550001111', 'hi')).status).toBe(429); // not E.164
    const ok = await send('+15550001111', 'Yes — as of my last check it is fully backed. Details: https://reserves.a9n9.net');
    expect(ok.status).toBe(202);
    expect(await ok.json()).toEqual({ sid: 'SM1', status: 'queued' });
    expect(twilioCalls[0]!.url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json');
    expect(twilioCalls[0]!.auth).toBe(`Basic ${Buffer.from('SKtest:secret').toString('base64')}`);
    const form = new URLSearchParams(twilioCalls[0]!.body);
    expect(form.get('MessagingServiceSid')).toBe('MGtest');
    expect(form.get('StatusCallback')).toBe('https://phone.a9n9.net/twilio/sms-status');
    expect((await send('+15550001111', 'second')).status).toBe(202);
    const capped = await send('+15550001111', 'third');
    expect(capped.status).toBe(429);
    expect((await capped.json()).error).toMatch(/daily SMS cap of 2/);
    await new Promise((r) => setTimeout(r, 20));
    expect(received.map((r) => JSON.parse(r.body)).filter((p) => p.type === 'sms.sent')).toHaveLength(2);
  });

  it('SmsSender rejects an empty or oversized body before calling Twilio', async () => {
    const cfg = configFromEnv({ TWILIO_PHONE_NUMBER: '+15104433533' });
    const s = new SmsSender(cfg);
    await expect(s.send('+15550001111', '   ')).rejects.toThrow(/1–1600/);
    await expect(s.send('+15550001111', 'x'.repeat(1601))).rejects.toThrow(/1–1600/);
  });
});

describe('grounding', () => {
  it('reservesFacts turns the monitor snapshot into spoken-form facts for recognized tokens only', async () => {
    const { reservesFacts } = await import('../src/server.js');
    const snap = { refreshedAt: '2026-11-01T16:40:00Z', tokens: [
      { symbol: 'pathUSD', tracked: ['attested', 'listed'], tempoSupply: '39370804012684', status: 'ok', issuer: { reportedSupply: '39370804012684', reportedReserves: '39370804010000' } },
      { symbol: 'DLUSD', tracked: ['attested'], tempoSupply: '3233458000000', status: 'ok', issuer: { reportedSupply: '3233470330000', reportedReserves: '3538312190000' } },
      { symbol: 'USDC.e', tracked: ['major', 'active'], tempoSupply: '26106768000000', status: 'unattested', issuer: null },
      { symbol: 'ORD', tracked: ['active'], tempoSupply: '599963177000000', status: 'unattested', issuer: null },
    ] };
    let calls = 0;
    const facts = reservesFacts('https://reserves.example', (async () => { calls++; return new Response(JSON.stringify(snap)); }) as typeof fetch);
    const text = await facts();
    expect(text).toContain('pathUSD: 39.4 million dollars on Tempo');
    expect(text).toContain('DLUSD: 3.2 million dollars on Tempo');
    expect(text).toContain('USDC.e: 26.1 million dollars on Tempo; no public issuer attestation');
    expect(text).not.toContain('ORD'); // merely-active wrappers are not facts the agent should quote
    expect(text).toContain('Total recognized stablecoin supply on Tempo: 68.7 million dollars');
    await facts();
    expect(calls).toBe(1); // cached
  });
  it('LlmResponder puts the facts and the no-invention rule into the system prompt', async () => {
    const { LlmResponder } = await import('../src/relay.js');
    let sentBody = '';
    const r = new LlmResponder({ baseUrl: 'https://llm.example', apiKey: 'k', model: 'm', systemPrompt: 'base', facts: async () => '- pathUSD: 39.4 million dollars on Tempo.', fetchImpl: (async (_u: unknown, init?: RequestInit) => { sentBody = String(init?.body); return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n', { status: 200 }); }) as typeof fetch });
    const out: string[] = [];
    for await (const c of r.respond({ transcript: [], callerText: 'how big is pathUSD' })) out.push(c);
    expect(out.join('')).toBe('ok');
    const sys = JSON.parse(sentBody).messages[0].content as string;
    expect(sys).toContain('LIVE FACTS');
    expect(sys).toContain('pathUSD: 39.4 million dollars');
    expect(sys).toMatch(/Never estimate or invent a number/);
  });
});

describe('call hygiene', () => {
  it('a farewell ends the session after a short grace instead of waiting for the cap', async () => {
    const { RelaySession, ScriptedResponder } = await import('../src/relay.js');
    const out: Array<{ type: string }> = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    let ended: string | null = null;
    const s = new RelaySession((m) => out.push(m), {
      responder: new ScriptedResponder([{ match: /bye/i, reply: 'Thanks for calling. Goodbye.' }]),
      tierFor: () => ({ name: 'stranger', maxSeconds: 120, closing: 'cap' }),
      greeting: 'Hi.',
      onEnd: (x) => { ended = x.endedBy; },
      setTimer: (fn, ms) => { timers.push({ fn, ms }); return { clear() {} }; },
    });
    await s.handle(JSON.stringify({ type: 'setup', sessionId: 'VX', callSid: 'CA', from: '+1', to: '+2' }));
    await s.handle(JSON.stringify({ type: 'prompt', voicePrompt: 'ok thanks, bye', last: true }));
    const grace = timers.find((t) => t.ms === 1500)!;
    expect(grace).toBeDefined();
    grace.fn();
    await new Promise((r) => setTimeout(r, 5));
    expect(out.at(-1)).toEqual({ type: 'end' });
    expect(ended).toBe('agent');
  });
  it('an outbound call answered by a machine gets a short message and a hangup, not a ConversationRelay session', async () => {
    const { configFromEnv, createPhoneServer, MACHINE_MESSAGE } = await import('../src/server.js');
    const cfg = configFromEnv({ PHONE_SKIP_SIGNATURE: '1', PUBLIC_HOST: 'phone.a9n9.net' });
    cfg.log = () => {};
    const p = createPhoneServer(cfg);
    p.server.listen(0, '127.0.0.1');
    await new Promise((r) => p.server.once('listening', r));
    const port = (p.server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/twilio/voice`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CA1&From=%2B15104433533&To=%2B14343686621&AnsweredBy=machine_end_beep' });
    const xml = await res.text();
    expect(xml).toContain('<Say>');
    expect(xml).toContain('<Hangup/>');
    expect(xml).not.toContain('ConversationRelay');
    expect(xml).toContain(MACHINE_MESSAGE.slice(0, 40));
    const human = await (await fetch(`http://127.0.0.1:${port}/twilio/voice`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CA2&From=%2B1&To=%2B2&AnsweredBy=human' })).text();
    expect(human).toContain('ConversationRelay');
    p.wss.close(); p.server.close();
  });
});
