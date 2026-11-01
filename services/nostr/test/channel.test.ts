import { describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import { wrapEvent } from 'nostr-tools/nip17';
import { identityFromNsec, inboundFilters, profileEvents, toInboxEvent } from '../src/channel.js';

const agent = identityFromNsec(Buffer.from(generateSecretKey()).toString('hex'));
const otherSk = generateSecretKey();
const other = getPublicKey(otherSk);
const now = Math.floor(Date.now() / 1000);

describe('nostr channel', () => {
  it('publishes a bot-flagged profile and a relay list', () => {
    const [meta, relays] = profileEvents(agent, { name: 'a9n9agent', about: 'x' }, ['wss://a', 'wss://b'], now);
    expect(JSON.parse(meta!.content)).toMatchObject({ name: 'a9n9agent', bot: true });
    expect(relays!.kind).toBe(10002);
    expect(relays!.tags).toEqual([['r', 'wss://a'], ['r', 'wss://b']]);
  });

  it('listens for mentions, NIP-04 and gift-wrapped DMs addressed to the agent', () => {
    const f = inboundFilters(agent.pubkey, now);
    expect(f.map((x) => x.kinds![0])).toEqual([1, 4, 1059]);
    expect(f.every((x) => x['#p']![0] === agent.pubkey)).toBe(true);
  });

  it('maps a public reply to nostr.mention with the thread id', () => {
    const ev = finalizeEvent({ kind: 1, created_at: now, tags: [['e', 'a'.repeat(64), '', 'root'], ['p', agent.pubkey]], content: 'hello agent' }, otherSk);
    expect(toInboxEvent(ev, agent)).toMatchObject({ id: `nostr:${ev.id}`, type: 'nostr.mention', from: other, text: 'hello agent', replyTo: 'a'.repeat(64) });
  });

  it('decrypts a NIP-04 DM', () => {
    const ev = finalizeEvent({ kind: 4, created_at: now, tags: [['p', agent.pubkey]], content: nip04.encrypt(otherSk, agent.pubkey, 'secret hi') }, otherSk);
    expect(toInboxEvent(ev, agent)).toMatchObject({ type: 'nostr.dm', encrypted: 'nip04', text: 'secret hi', from: other });
  });

  it('unwraps a NIP-17 DM and keys the event by the rumor id', () => {
    const wrap = wrapEvent(otherSk, { publicKey: agent.pubkey }, 'wrapped hi');
    const out = toInboxEvent(wrap, agent);
    expect(out).toMatchObject({ type: 'nostr.dm', encrypted: 'nip17', text: 'wrapped hi', from: other, kind: 14 });
    expect(out!.id).not.toBe(`nostr:${wrap.id}`);
  });

  it('ignores the agent\'s own notes and wraps it cannot open', () => {
    const own = finalizeEvent({ kind: 1, created_at: now, tags: [], content: 'me' }, agent.sk);
    expect(toInboxEvent(own, agent)).toBeNull();
    const notForUs = wrapEvent(otherSk, { publicKey: other }, 'nope');
    expect(toInboxEvent(notForUs, agent)).toBeNull();
  });
});
