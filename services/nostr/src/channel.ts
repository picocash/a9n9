/**
 * Pure pieces of the Nostr channel: the agent's profile event, the filters it
 * listens with, and the mapping from a relay event (a mention, a NIP-04 DM, or
 * an unwrapped NIP-17 rumor) to the inbox envelope documented in docs/events.md.
 */
import { finalizeEvent, getPublicKey, type Event as NostrEvent, type UnsignedEvent } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import * as nip19 from 'nostr-tools/nip19';
import { unwrapEvent } from 'nostr-tools/nip59';
import type { Filter } from 'nostr-tools/filter';

export interface Identity {
  sk: Uint8Array;
  pubkey: string;
  npub: string;
}

export function identityFromNsec(nsecOrHex: string): Identity {
  const sk = nsecOrHex.startsWith('nsec1') ? (nip19.decode(nsecOrHex).data as Uint8Array) : Uint8Array.from(Buffer.from(nsecOrHex, 'hex'));
  if (sk.length !== 32) throw new Error('NOSTR_NSEC must be an nsec or 32 hex bytes');
  const pubkey = getPublicKey(sk);
  return { sk, pubkey, npub: nip19.npubEncode(pubkey) };
}

export interface Profile {
  name: string;
  display_name?: string;
  about: string;
  website?: string;
  picture?: string;
  nip05?: string;
  bot?: boolean;
}

/** kind 0 (metadata) and kind 10002 (relay list, NIP-65) for the agent. */
export function profileEvents(id: Identity, profile: Profile, relays: string[], now = Math.floor(Date.now() / 1000)): NostrEvent[] {
  const meta: UnsignedEvent = { kind: 0, created_at: now, tags: [], content: JSON.stringify({ ...profile, bot: true }), pubkey: id.pubkey };
  const list: UnsignedEvent = { kind: 10002, created_at: now, tags: relays.map((r) => ['r', r]), content: '', pubkey: id.pubkey };
  return [finalizeEvent(meta, id.sk), finalizeEvent(list, id.sk)];
}

/** What the listener subscribes to: public mentions, legacy DMs, gift-wrapped DMs. */
export function inboundFilters(pubkey: string, since: number): Filter[] {
  return [
    { kinds: [1], '#p': [pubkey], since },
    { kinds: [4], '#p': [pubkey], since },
    // Gift wraps carry a randomised created_at (up to two days back), so look further.
    { kinds: [1059], '#p': [pubkey], since: since - 2 * 86400 },
  ];
}

export interface InboxEvent {
  id: string;
  type: 'nostr.mention' | 'nostr.dm';
  from: string;
  fromNpub: string;
  eventId: string;
  kind: number;
  createdAt: string;
  text: string;
  replyTo?: string;
  encrypted?: 'nip04' | 'nip17';
}

/** Map one relay event to an inbox event, or null if it is not for us / cannot be read. */
export function toInboxEvent(ev: NostrEvent, id: Identity): InboxEvent | null {
  if (ev.pubkey === id.pubkey) return null; // our own notes echo back from relays
  const base = (kind: number, from: string, eventId: string, createdAt: number, text: string) => ({
    from,
    fromNpub: nip19.npubEncode(from),
    eventId,
    kind,
    createdAt: new Date(createdAt * 1000).toISOString(),
    text,
  });
  if (ev.kind === 1) {
    const reply = ev.tags.find((t) => t[0] === 'e' && (t[3] === 'reply' || t[3] === 'root'))?.[1] ?? ev.tags.find((t) => t[0] === 'e')?.[1];
    return { id: `nostr:${ev.id}`, type: 'nostr.mention', ...base(1, ev.pubkey, ev.id, ev.created_at, ev.content), ...(reply ? { replyTo: reply } : {}) };
  }
  if (ev.kind === 4) {
    try {
      const text = nip04.decrypt(id.sk, ev.pubkey, ev.content);
      return { id: `nostr:${ev.id}`, type: 'nostr.dm', encrypted: 'nip04', ...base(4, ev.pubkey, ev.id, ev.created_at, text) };
    } catch {
      return null;
    }
  }
  if (ev.kind === 1059) {
    try {
      const rumor = unwrapEvent(ev, id.sk);
      if (rumor.kind !== 14) return null;
      return { id: `nostr:${rumor.id}`, type: 'nostr.dm', encrypted: 'nip17', ...base(14, rumor.pubkey, rumor.id, rumor.created_at, rumor.content) };
    } catch {
      return null;
    }
  }
  return null;
}
