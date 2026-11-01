/**
 * Grok speech-to-speech engine: bridges a Twilio Media Stream (μ-law 8 kHz,
 * base64, both directions) to xAI's realtime voice API. No audio conversion —
 * Twilio's pcmu frames go straight to `input_audio_buffer.append` and the
 * model's `response.output_audio.delta` frames go straight back.
 *
 * The agent still identifies itself first, still answers numbers only from
 * the live reserves facts (now fetched through a tool call the model makes),
 * still hangs up on a farewell or at the tier cap, and still writes the same
 * `voice.call` transcript event to the inbox as the ConversationRelay engine.
 *
 * Protocol shapes follow xAI's Twilio example (xai-cookbook/examples/voice-agent-phone).
 */
import type { WebSocket } from 'ws';
import type { SessionSummary, Tier, Turn } from './relay.js';

export interface GrokVoiceOptions {
  realtimeUrl: string;
  apiKey: string;
  voice: string;
  instructions: string;
  tierFor: (from: string) => Tier;
  /** Live facts the model can ask for; returned as the tool result. */
  facts: () => Promise<string>;
  onEnd: (summary: SessionSummary) => void | Promise<void>;
  /** Opens the websocket to xAI; injectable for tests. */
  connect: (url: string, headers: Record<string, string>) => WebSocket;
  log?: (m: string) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => { clear(): void };
}

type TwilioIn =
  | { event: 'connected' }
  | { event: 'start'; start: { streamSid: string; callSid: string; customParameters?: Record<string, string> } }
  | { event: 'media'; media: { track: string; payload: string } }
  | { event: 'dtmf'; dtmf: { digit: string } }
  | { event: 'mark' }
  | { event: 'stop' };

const FAREWELL = /\b(good\s?bye|bye|talk to you later|have a (good|nice) (day|one))\b/i;

export const RESERVE_TOOL = {
  type: 'function',
  name: 'get_reserve_facts',
  description: 'Fetch the live, verified stablecoin reserve figures for the Tempo network. Call this before stating ANY number about a stablecoin, its supply, or its reserves. Returns plain-language facts with amounts in dollars.',
  parameters: { type: 'object', properties: {}, required: [] },
};
export const END_CALL_TOOL = {
  type: 'function',
  name: 'end_call',
  description: 'Hang up the call. Call this only after you have said goodbye and the caller has nothing more to ask.',
  parameters: { type: 'object', properties: {}, required: [] },
};

export class GrokVoiceSession {
  private streamSid = '';
  private callSid = '';
  private from = '';
  private to = '';
  private tier: Tier | null = null;
  private xai: WebSocket | null = null;
  private ready = false;
  private ended = false;
  private endedBy: SessionSummary['endedBy'] = 'caller';
  private readonly turns: Turn[] = [];
  private agentUtterance = '';
  private startedMs = 0;
  private interruptions = 0;
  private capTimer: { clear(): void } | null = null;
  private pendingAudio: string[] = [];
  private readonly now: () => number;
  private readonly setTimer: NonNullable<GrokVoiceOptions['setTimer']>;
  private readonly log: (m: string) => void;

  constructor(
    private readonly twilio: WebSocket,
    private readonly o: GrokVoiceOptions,
  ) {
    this.now = o.now ?? Date.now;
    this.setTimer = o.setTimer ?? ((fn, ms) => { const t = setTimeout(fn, ms); return { clear: () => clearTimeout(t) }; });
    this.log = o.log ?? (() => {});
    twilio.on('message', (d) => void this.onTwilio(d.toString()));
    twilio.on('close', () => void this.finish('caller'));
    twilio.on('error', () => void this.finish('error'));
  }

  get transcript(): readonly Turn[] {
    return this.turns;
  }

  private async onTwilio(raw: string): Promise<void> {
    let m: TwilioIn;
    try {
      m = JSON.parse(raw) as TwilioIn;
    } catch {
      return;
    }
    switch (m.event) {
      case 'start': {
        this.streamSid = m.start.streamSid;
        this.callSid = m.start.callSid;
        this.from = m.start.customParameters?.from ?? '';
        this.to = m.start.customParameters?.to ?? '';
        this.startedMs = this.now();
        this.tier = this.o.tierFor(this.from);
        this.note('system', `call from ${this.from} to ${this.to}, tier ${this.tier.name}, cap ${this.tier.maxSeconds}s, engine grok`);
        this.capTimer = this.setTimer(() => void this.endForCap(), this.tier.maxSeconds * 1000);
        this.openXai();
        return;
      }
      case 'media':
        if (m.media.track !== 'inbound') return;
        if (!this.ready || !this.xai || this.xai.readyState !== this.xai.OPEN) return;
        this.xai.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: m.media.payload }));
        return;
      case 'dtmf':
        this.note('caller', `[pressed ${m.dtmf.digit}]`);
        return;
      case 'stop':
        await this.finish('caller');
        return;
      default:
        return;
    }
  }

  private openXai(): void {
    const ws = this.o.connect(this.o.realtimeUrl, { Authorization: `Bearer ${this.o.apiKey}` });
    this.xai = ws;
    ws.on('open', () => this.log(`xai websocket open for ${this.callSid}`));
    ws.on('message', (d) => void this.onXai(d.toString()));
    ws.on('error', (err) => { this.note('system', `xai error: ${err instanceof Error ? err.message : String(err)}`); void this.finish('error'); });
    ws.on('close', () => { if (!this.ended) void this.finish('error'); });
  }

  private sendXai(msg: unknown): void {
    if (this.xai && this.xai.readyState === this.xai.OPEN) this.xai.send(JSON.stringify(msg));
  }
  private sendTwilio(msg: unknown): void {
    if (this.twilio.readyState === this.twilio.OPEN) this.twilio.send(JSON.stringify(msg));
  }

  private async onXai(raw: string): Promise<void> {
    let m: { type: string; [k: string]: unknown };
    try {
      m = JSON.parse(raw) as { type: string };
    } catch {
      return;
    }
    switch (m.type) {
      case 'conversation.created':
        this.sendXai({
          type: 'session.update',
          session: {
            instructions: this.o.instructions,
            voice: this.o.voice,
            audio: { input: { format: { type: 'audio/pcmu' } }, output: { format: { type: 'audio/pcmu' } } },
            turn_detection: { type: 'server_vad' },
            tools: [RESERVE_TOOL, END_CALL_TOOL],
          },
        });
        return;
      case 'session.updated':
        this.ready = true;
        // The agent speaks first: the disclosure greeting, in its own words but with fixed content.
        this.sendXai({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'The call has just connected. Greet the caller: say you are an autonomous software agent operated by a9n9, not a person, that this call is logged, and ask how you can help. One or two sentences.' }] } });
        this.sendXai({ type: 'response.create' });
        return;
      case 'response.output_audio.delta':
        if (typeof m.delta === 'string' && this.streamSid) this.sendTwilio({ event: 'media', streamSid: this.streamSid, media: { payload: m.delta } });
        return;
      case 'response.output_audio_transcript.delta':
        if (typeof m.delta === 'string') this.agentUtterance += m.delta;
        return;
      case 'response.done': {
        const said = this.agentUtterance.trim();
        this.agentUtterance = '';
        if (said) this.note('agent', said);
        return;
      }
      case 'input_audio_buffer.speech_started':
        // Barge-in: drop whatever Twilio has buffered of the agent's speech.
        if (this.agentUtterance) { this.interruptions++; this.note('system', 'caller interrupted'); }
        if (this.streamSid) this.sendTwilio({ event: 'clear', streamSid: this.streamSid });
        return;
      case 'conversation.item.input_audio_transcription.completed':
        if (typeof m.transcript === 'string' && m.transcript.trim()) {
          this.note('caller', m.transcript.trim());
          if (FAREWELL.test(m.transcript)) this.endedBy = 'agent';
        }
        return;
      case 'response.output_item.done': {
        const item = m.item as { type?: string; name?: string; call_id?: string } | undefined;
        if (item?.type !== 'function_call') return;
        if (item.name === 'get_reserve_facts') {
          let output: string;
          try {
            output = await this.o.facts();
          } catch (err) {
            output = `Live facts are unavailable right now (${err instanceof Error ? err.message : 'error'}). Do not state any figures; point the caller to reserves dot a9n9 dot net.`;
          }
          this.note('system', 'tool get_reserve_facts');
          this.sendXai({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output } });
          this.sendXai({ type: 'response.create' });
        } else if (item.name === 'end_call') {
          this.note('system', 'tool end_call');
          this.sendXai({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: 'ok, hanging up in 2 seconds' } });
          this.endedBy = 'agent';
          this.setTimer(() => void this.finish(), 2500);
        }
        return;
      }
      case 'error':
        this.note('system', `xai error: ${JSON.stringify((m as { error?: unknown }).error ?? m).slice(0, 200)}`);
        return;
      default:
        return;
    }
  }

  private async endForCap(): Promise<void> {
    if (this.ended || !this.tier) return;
    this.endedBy = 'cap';
    this.sendXai({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `Time is up. Say exactly this and nothing else: "${this.tier.closing}"` }] } });
    this.sendXai({ type: 'response.create' });
    this.setTimer(() => void this.finish(), 9000);
  }

  private async finish(reason?: SessionSummary['endedBy']): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    if (reason && this.endedBy === 'caller') this.endedBy = reason;
    this.capTimer?.clear();
    try { this.xai?.close(); } catch { /* already closed */ }
    try { if (this.twilio.readyState === this.twilio.OPEN) this.twilio.close(); } catch { /* already closed */ }
    if (!this.callSid) return;
    const endedMs = this.now();
    await this.o.onEnd({
      callSid: this.callSid,
      sessionId: this.streamSid,
      from: this.from,
      to: this.to,
      tier: this.tier?.name ?? 'unknown',
      startedAt: new Date(this.startedMs).toISOString(),
      endedAt: new Date(endedMs).toISOString(),
      seconds: Math.round((endedMs - this.startedMs) / 1000),
      turns: [...this.turns],
      endedBy: this.endedBy,
      interruptions: this.interruptions,
    });
  }

  private note(role: Turn['role'], text: string): void {
    this.turns.push({ role, text, at: new Date(this.now()).toISOString() });
  }
}

export const GROK_VOICE_INSTRUCTIONS = [
  'You are an autonomous software agent operated by a9n9, a Visybl Inc service, speaking on a live phone call. You are not a person and never pretend to be; if asked, say so plainly.',
  'Speak in short, plain sentences — one or two at a time. Say web addresses as words ("reserves dot a9n9 dot net"). Do not read lists.',
  'What you do: you monitor stablecoin reserves on the Tempo blockchain network and answer questions about them. People can also reach you by email at agent at a9n9 dot net.',
  'Numbers: before stating ANY figure about a stablecoin, its supply or its reserves, call the get_reserve_facts tool and use only what it returns, in spoken form ("forty point three million dollars"). If the tool has no figure for what was asked, say you do not have it on this call and point to reserves dot a9n9 dot net. Never estimate or invent a number.',
  'If the caller says only a filler like "yeah", "okay" or "hello", reply with a few words at most, and do not ask "how can I help" more than once in a call. If they ask for something outside your work, say so briefly and offer what you can do instead.',
  'When the caller says goodbye or has nothing more, say a short goodbye and then call the end_call tool.',
].join(' ');
