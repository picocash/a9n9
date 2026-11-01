/**
 * Twilio ConversationRelay session handling, independent of the transport so
 * it can be driven by a real websocket or by a test.
 *
 * Inbound from Twilio: setup, prompt (the caller's words), interrupt, dtmf,
 * error, info. Outbound: text tokens (streamed, `last: true` closes the turn)
 * and `end`. Shapes follow Twilio's websocket message reference.
 */

export interface SetupMessage {
  type: 'setup';
  sessionId: string;
  accountSid?: string;
  callSid: string;
  from: string;
  to: string;
  customParameters?: Record<string, string>;
}
export interface PromptMessage {
  type: 'prompt';
  voicePrompt: string;
  lang?: string;
  last?: boolean;
}
export interface InterruptMessage {
  type: 'interrupt';
  utteranceUntilInterrupt?: string;
  durationUntilInterruptMs?: number;
}
export interface DtmfMessage {
  type: 'dtmf';
  digit: string;
}
export interface ErrorMessage {
  type: 'error';
  description?: string;
}
export interface InfoMessage {
  type: 'info';
  name?: string;
  value?: unknown;
}
export type InboundMessage = SetupMessage | PromptMessage | InterruptMessage | DtmfMessage | ErrorMessage | InfoMessage;

export type OutboundMessage = { type: 'text'; token: string; last: boolean; interruptible?: boolean } | { type: 'end'; handoffData?: string };

export interface Turn {
  role: 'caller' | 'agent' | 'system';
  text: string;
  at: string;
}

/** What answers the caller. Yields reply text in chunks; the session streams them to Twilio. */
export interface Responder {
  respond(input: { transcript: Turn[]; callerText: string; from: string; to: string }): AsyncIterable<string>;
}

export interface Tier {
  name: string;
  /** Hard cap on the whole call. */
  maxSeconds: number;
  /** Spoken before the cap ends the call. */
  closing: string;
}

export interface SessionOptions {
  responder: Responder;
  tierFor: (from: string) => Tier;
  greeting: string;
  /** Called when the session ends, with the full transcript, for the inbox. */
  onEnd: (summary: SessionSummary) => void | Promise<void>;
  now?: () => number;
  /** Test hook: schedule the cap with a custom timer. */
  setTimer?: (fn: () => void, ms: number) => { clear(): void };
}

export interface SessionSummary {
  callSid: string;
  sessionId: string;
  from: string;
  to: string;
  tier: string;
  startedAt: string;
  endedAt: string;
  seconds: number;
  turns: Turn[];
  endedBy: 'cap' | 'caller' | 'error' | 'agent';
  interruptions: number;
}

export class RelaySession {
  private setup: SetupMessage | null = null;
  private readonly turns: Turn[] = [];
  private startedMs = 0;
  private tier: Tier | null = null;
  private capTimer: { clear(): void } | null = null;
  private ended = false;
  private endedBy: SessionSummary['endedBy'] = 'caller';
  private interruptions = 0;
  private speaking: AbortController | null = null;
  private readonly now: () => number;
  private readonly setTimer: NonNullable<SessionOptions['setTimer']>;

  constructor(
    private readonly send: (m: OutboundMessage) => void,
    private readonly o: SessionOptions,
  ) {
    this.now = o.now ?? Date.now;
    this.setTimer = o.setTimer ?? ((fn, ms) => { const t = setTimeout(fn, ms); return { clear: () => clearTimeout(t) }; });
  }

  get transcript(): readonly Turn[] {
    return this.turns;
  }

  async handle(raw: string): Promise<void> {
    let m: InboundMessage;
    try {
      m = JSON.parse(raw) as InboundMessage;
    } catch {
      return;
    }
    switch (m.type) {
      case 'setup':
        return this.onSetup(m);
      case 'prompt':
        if (m.last === false) return; // partial transcripts are not acted on
        return this.onPrompt(m.voicePrompt);
      case 'interrupt':
        this.interruptions++;
        this.speaking?.abort();
        this.note('system', `caller interrupted after ${m.durationUntilInterruptMs ?? 0} ms`);
        return;
      case 'dtmf':
        return this.onPrompt(`[pressed ${m.digit}]`);
      case 'error':
        this.note('system', `twilio error: ${m.description ?? 'unknown'}`);
        return;
      case 'info':
        return;
    }
  }

  private onSetup(m: SetupMessage): void {
    this.setup = m;
    this.startedMs = this.now();
    this.tier = this.o.tierFor(m.from);
    this.note('system', `call from ${m.from} to ${m.to}, tier ${this.tier.name}, cap ${this.tier.maxSeconds}s`);
    // The greeting is spoken by us, not by Twilio's welcomeGreeting, so it is in the transcript and always says what the agent is.
    this.say(this.o.greeting);
    this.capTimer = this.setTimer(() => void this.endForCap(), this.tier.maxSeconds * 1000);
  }

  private async onPrompt(text: string): Promise<void> {
    if (!this.setup || this.ended) return;
    this.note('caller', text);
    this.speaking?.abort();
    const ac = new AbortController();
    this.speaking = ac;
    let spoken = '';
    try {
      for await (const chunk of this.o.responder.respond({ transcript: this.turns, callerText: text, from: this.setup.from, to: this.setup.to })) {
        if (ac.signal.aborted || this.ended) break;
        spoken += chunk;
        this.send({ type: 'text', token: chunk, last: false });
      }
    } catch (err) {
      spoken += spoken ? '' : "I'm sorry, I can't answer that right now.";
      this.note('system', `responder error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!ac.signal.aborted && !this.ended) this.send({ type: 'text', token: '', last: true });
    if (spoken) this.note('agent', spoken);
  }

  private say(text: string): void {
    this.send({ type: 'text', token: text, last: true });
    this.note('agent', text);
  }

  private async endForCap(): Promise<void> {
    if (this.ended || !this.tier) return;
    this.endedBy = 'cap';
    this.speaking?.abort();
    this.say(this.tier.closing);
    await this.finish();
  }

  /** The caller hung up or the socket closed. */
  async close(reason: 'caller' | 'error' = 'caller'): Promise<void> {
    if (this.ended) return;
    this.endedBy = reason;
    await this.finish(false);
  }

  private async finish(sendEnd = true): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.capTimer?.clear();
    this.speaking?.abort();
    if (sendEnd) this.send({ type: 'end' });
    if (!this.setup) return;
    const endedMs = this.now();
    await this.o.onEnd({
      callSid: this.setup.callSid,
      sessionId: this.setup.sessionId,
      from: this.setup.from,
      to: this.setup.to,
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

/** A responder for tests and for the dry run: answers from a script, falls back to a fixed line. */
export class ScriptedResponder implements Responder {
  constructor(private readonly script: Array<{ match: RegExp; reply: string }>, private readonly fallback = "I heard you, but I don't have an answer for that yet.") {}
  async *respond({ callerText }: { callerText: string }): AsyncIterable<string> {
    const hit = this.script.find((s) => s.match.test(callerText));
    const reply = hit?.reply ?? this.fallback;
    // Stream in word groups so the TTS can start early, as a model would.
    const words = reply.split(' ');
    for (let i = 0; i < words.length; i += 4) yield words.slice(i, i + 4).join(' ') + (i + 4 < words.length ? ' ' : '');
  }
}

/**
 * A responder backed by any OpenAI-compatible chat endpoint — in production
 * the a9n9 paid-LLM proxy, so every call turn is metered in picocash.
 */
export class LlmResponder implements Responder {
  constructor(
    private readonly cfg: { baseUrl: string; apiKey: string; model: string; systemPrompt: string; maxTokens?: number; fetchImpl?: typeof fetch },
  ) {}
  async *respond({ transcript, callerText }: { transcript: Turn[]; callerText: string }): AsyncIterable<string> {
    const f = this.cfg.fetchImpl ?? fetch;
    const history = transcript
      .filter((t) => t.role !== 'system')
      .slice(-12)
      .map((t) => ({ role: t.role === 'caller' ? 'user' : 'assistant', content: t.text }));
    const res = await f(`${this.cfg.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
      body: JSON.stringify({ model: this.cfg.model, stream: true, max_tokens: this.cfg.maxTokens ?? 160, messages: [{ role: 'system', content: this.cfg.systemPrompt }, ...history, { role: 'user', content: callerText }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok || !res.body) throw new Error(`llm ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const delta = (JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* ignore malformed keep-alives */
        }
      }
    }
  }
}
