/**
 * Who this agent may message, and how much: rules in code, not in the prompt.
 *
 * - Consent comes only from the person writing first on that channel. An inbound
 *   message records it (address, time, message id: the proof).
 * - SMS: STOP-family keywords revoke it; only START restores it.
 * - WhatsApp: free-form replies are allowed only within 24 hours of the person's
 *   last message (Meta's customer-service window). After that the agent waits.
 * - A daily cap per channel stops a runaway loop from spending the agent's money.
 */
import fs from 'node:fs';
import path from 'node:path';

export type Channel = 'sms' | 'whatsapp';
const STOP_RE = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|optout|revoke)\s*$/i;
const START_RE = /^\s*(start|unstop)\s*$/i;
const WA_WINDOW_MS = 24 * 3600 * 1000;

interface Contact { firstAt: string; firstMessageId: string; lastInboundAt: string; optedOut: boolean; disclosed?: boolean }
interface State { contacts: Record<string, Contact>; day: string; sent: Partial<Record<Channel, number>> }

export class Policy {
  private s: State = { contacts: {}, day: '', sent: {} };
  constructor(private readonly file: string | undefined, private readonly caps: Record<Channel, number>, private readonly now: () => number = Date.now) {
    if (file && fs.existsSync(file)) {
      // A corrupt file must not open sending: parse errors propagate and the connector refuses to start.
      this.s = JSON.parse(fs.readFileSync(file, 'utf8')) as State;
    }
  }

  private key(ch: Channel, addr: string) { return `${ch}:${addr}`; }
  private save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.s, null, 1));
    fs.renameSync(this.file + '.tmp', this.file);
  }
  private roll() { const d = new Date(this.now()).toISOString().slice(0, 10); if (d !== this.s.day) { this.s.day = d; this.s.sent = {}; } }

  /** Record an inbound message. Returns 'stop' | 'start' | 'message' so the caller can log it. */
  inbound(ch: Channel, from: string, text: string, messageId: string): 'stop' | 'start' | 'message' {
    const at = new Date(this.now()).toISOString();
    const k = this.key(ch, from);
    const c = this.s.contacts[k];
    const kind = ch === 'sms' && STOP_RE.test(text) ? 'stop' : ch === 'sms' && START_RE.test(text) ? 'start' : 'message';
    if (!c) this.s.contacts[k] = { firstAt: at, firstMessageId: messageId, lastInboundAt: at, optedOut: kind === 'stop' };
    else { c.lastInboundAt = at; if (kind === 'stop') c.optedOut = true; if (kind === 'start') c.optedOut = false; }
    this.save();
    return kind;
  }

  /** Why the agent may not send to `to` now, or null. */
  refusal(ch: Channel, to: string): string | null {
    this.roll();
    const c = this.s.contacts[this.key(ch, to)];
    if (!c) return `no consent: ${to} has never messaged this agent on ${ch}; agents only reply to people who write first`;
    if (c.optedOut) return `opted out: ${to} replied STOP; they must text START before this agent may text them again`;
    if (ch === 'whatsapp' && this.now() - Date.parse(c.lastInboundAt) > WA_WINDOW_MS) return `window closed: ${to} last wrote more than 24 hours ago; wait for them to write again`;
    if ((this.s.sent[ch] ?? 0) >= this.caps[ch]) return `daily cap: ${this.caps[ch]} ${ch} messages already sent today`;
    return null;
  }

  /** The first SMS reply to a contact must say who is texting and how to stop (carrier rules). */
  needsDisclosure(ch: Channel, to: string): boolean { return ch === 'sms' && !this.s.contacts[this.key(ch, to)]?.disclosed; }

  sent(ch: Channel, to: string) {
    this.roll(); this.s.sent[ch] = (this.s.sent[ch] ?? 0) + 1;
    const c = this.s.contacts[this.key(ch, to)]; if (c) c.disclosed = true;
    this.save();
  }
  remaining(ch: Channel) { this.roll(); return Math.max(0, this.caps[ch] - (this.s.sent[ch] ?? 0)); }
}
