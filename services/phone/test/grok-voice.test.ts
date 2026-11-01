import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { configFromEnv, createPhoneServer, twiml } from '../src/server.js';

/** A stand-in for api.x.ai/v1/realtime that speaks just enough of the protocol. */
function mockXai() {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  const received: Array<Record<string, unknown>> = [];
  let authHeader = '';
  wss.on('connection', (ws, req) => {
    authHeader = String(req.headers.authorization);
    ws.send(JSON.stringify({ type: 'conversation.created', conversation: { id: 'conv_1' } }));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as Record<string, unknown>;
      received.push(m);
      if (m.type === 'session.update') ws.send(JSON.stringify({ type: 'session.updated' }));
      if (m.type === 'response.create') {
        const n = received.filter((x) => x.type === 'response.create').length;
        ws.send(JSON.stringify({ type: 'response.created' }));
        if (n === 1) {
          // greeting, requested by the bridge right after session.updated
          ws.send(JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'Hello, I am an autonomous software agent operated by a9n9, not a person. ' }));
          ws.send(JSON.stringify({ type: 'response.output_audio.delta', delta: Buffer.from([0xff, 0xff, 0x7f]).toString('base64') }));
          ws.send(JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'This call is logged. How can I help?' }));
          ws.send(JSON.stringify({ type: 'response.done' }));
        } else if (n === 2) {
          // the bridge returned the tool output; the model answers with the grounded figure...
          ws.send(JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'pathUSD has forty point three million dollars on Tempo.' }));
          ws.send(JSON.stringify({ type: 'response.output_audio.delta', delta: Buffer.from([1, 2, 3]).toString('base64') }));
          ws.send(JSON.stringify({ type: 'response.done' }));
          // ...then the caller says goodbye (server VAD: the model responds on its own, no response.create from us)
          ws.send(JSON.stringify({ type: 'input_audio_buffer.speech_started' }));
          ws.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Thanks, goodbye.' }));
          ws.send(JSON.stringify({ type: 'response.created' }));
          ws.send(JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'Goodbye.' }));
          ws.send(JSON.stringify({ type: 'response.done' }));
          ws.send(JSON.stringify({ type: 'response.output_item.done', item: { type: 'function_call', name: 'end_call', call_id: 'call_2', arguments: '{}' } }));
        }
      }
      if (m.type === 'input_audio_buffer.append') {
        // First audio frame: with server VAD the model hears a question and decides to call the facts tool on its own.
        if (received.filter((x) => x.type === 'input_audio_buffer.append').length === 1) {
          ws.send(JSON.stringify({ type: 'input_audio_buffer.speech_started' }));
          ws.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'How much pathUSD is on Tempo?' }));
          ws.send(JSON.stringify({ type: 'response.created' }));
          ws.send(JSON.stringify({ type: 'response.output_item.done', item: { type: 'function_call', name: 'get_reserve_facts', call_id: 'call_1', arguments: '{}' } }));
          ws.send(JSON.stringify({ type: 'response.done' }));
        }
      }
    });
  });
  return { wss, received, get auth() { return authHeader; }, get port() { return (wss.address() as { port: number }).port; } };
}

describe('Grok speech-to-speech engine', () => {
  let inbox: Server;
  const inboxHits: Array<{ sig: string; body: string }> = [];
  let xai: ReturnType<typeof mockXai>;
  let phone: ReturnType<typeof createPhoneServer>;
  let port = 0;

  beforeAll(async () => {
    inbox = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { inboxHits.push({ sig: String(req.headers['x-a9n9-signature']), body: b }); res.writeHead(201); res.end('{}'); }); });
    inbox.listen(0, '127.0.0.1');
    await once(inbox, 'listening');
    xai = mockXai();
    await once(xai.wss, 'listening');
    const cfg = configFromEnv({ PHONE_SKIP_SIGNATURE: '1', PUBLIC_HOST: 'phone.a9n9.net', VOICE_ENGINE: 'grok', XAI_REALTIME_URL: `ws://127.0.0.1:${xai.port}`, XAI_API_KEY: 'xai-test', XAI_VOICE: 'ara', INBOX_URL: `http://127.0.0.1:${(inbox.address() as { port: number }).port}`, INBOX_WEBHOOK_SECRET: 'sek' });
    cfg.log = () => {};
    cfg.facts = async () => '- pathUSD: 40.3 million dollars on Tempo; issuer reports 40.3 million dollars in reserves.';
    phone = createPhoneServer(cfg);
    phone.server.listen(0, '127.0.0.1');
    await once(phone.server, 'listening');
    port = (phone.server.address() as { port: number }).port;
  });
  afterAll(() => { phone.wss.close(); phone.server.close(); xai.wss.close(); inbox.close(); });

  it('TwiML connects a Media Stream with from/to parameters when the engine is grok', () => {
    const cfg = configFromEnv({ PUBLIC_HOST: 'phone.a9n9.net', VOICE_ENGINE: 'grok' });
    const xml = twiml(cfg, { from: '+15550001111', to: '+15104433533' });
    expect(xml).toContain('<Stream url="wss://phone.a9n9.net/media">');
    expect(xml).toContain('<Parameter name="from" value="+15550001111"/>');
    expect(xml).not.toContain('ConversationRelay');
    expect(twiml(configFromEnv({ PUBLIC_HOST: 'phone.a9n9.net' }))).toContain('ConversationRelay');
  });

  it('bridges a simulated call: session setup, greeting audio to Twilio, caller audio to xAI, tool-grounded answer, barge-in clear, end_call, transcript to inbox', async () => {
    const tw = new WebSocket(`ws://127.0.0.1:${port}/media`);
    const toTwilio: Array<Record<string, unknown>> = [];
    tw.on('message', (d) => toTwilio.push(JSON.parse(d.toString())));
    await once(tw, 'open');
    tw.send(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }));
    tw.send(JSON.stringify({ event: 'start', start: { streamSid: 'MZ1', callSid: 'CA_grok', tracks: ['inbound'], customParameters: { from: '+15550001111', to: '+15104433533' }, mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 } } }));
    // wait for the greeting to arrive as media frames
    for (let i = 0; i < 100 && !toTwilio.some((m) => m.event === 'media'); i++) await new Promise((r) => setTimeout(r, 20));
    expect(toTwilio.some((m) => m.event === 'media' && (m.media as { payload: string }).payload === Buffer.from([0xff, 0xff, 0x7f]).toString('base64'))).toBe(true);
    // the caller speaks: one μ-law frame
    tw.send(JSON.stringify({ event: 'media', media: { track: 'inbound', payload: Buffer.alloc(160, 0xff).toString('base64') }, streamSid: 'MZ1' }));
    await once(tw, 'close'); // end_call tool → session finishes and closes the Twilio socket

    // xAI side: session configured for pcmu with our tools, audio forwarded, tool result returned
    expect(xai.auth).toBe('Bearer xai-test');
    const session = xai.received.find((m) => m.type === 'session.update') as { session: Record<string, unknown> };
    expect(session.session.voice).toBe('ara');
    expect(JSON.stringify(session.session.audio)).toContain('audio/pcmu');
    expect((session.session.tools as Array<{ name: string }>).map((t) => t.name)).toEqual(['get_reserve_facts', 'end_call']);
    expect(xai.received.some((m) => m.type === 'input_audio_buffer.append')).toBe(true);
    const toolOut = xai.received.find((m) => m.type === 'conversation.item.create' && (m.item as { type: string }).type === 'function_call_output') as { item: { call_id: string; output: string } };
    expect(toolOut.item.call_id).toBe('call_1');
    expect(toolOut.item.output).toContain('pathUSD: 40.3 million dollars');

    // Twilio side: barge-in cleared the buffer
    expect(toTwilio.some((m) => m.event === 'clear')).toBe(true);

    // inbox: signed voice.call with the transcript
    await new Promise((r) => setTimeout(r, 50));
    expect(inboxHits).toHaveLength(1);
    const { sig, body } = inboxHits[0]!;
    expect(sig).toBe(`sha256=${createHmac('sha256', 'sek').update(body).digest('hex')}`);
    const p = JSON.parse(body);
    expect(p.type).toBe('voice.call');
    expect(p.callSid).toBe('CA_grok');
    expect(p.endedBy).toBe('agent');
    const roles = p.turns.map((t: { role: string }) => t.role);
    expect(roles[0]).toBe('system');
    expect(p.turns.find((t: { role: string }) => t.role === 'agent').text).toMatch(/autonomous software agent operated by a9n9/);
    expect(p.turns.some((t: { role: string; text: string }) => t.role === 'caller' && /pathUSD/.test(t.text))).toBe(true);
    expect(p.turns.some((t: { text: string }) => t.text === 'tool get_reserve_facts')).toBe(true);
    expect(p.turns.some((t: { text: string }) => /forty point three million/.test(t.text))).toBe(true);
  }, 15000);
});
