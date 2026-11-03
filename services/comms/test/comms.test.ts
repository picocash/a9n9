import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyTelnyx } from '../src/telnyx.js';
import { Policy } from '../src/policy.js';
import { createRelay } from '../src/relay.js';
import { createCommsServer, smsTexts } from '../src/server.js';
import { hubSignature, parseWebhook, splitByNumber } from '../src/whatsapp.js';

const listen = async (s: { listen: Function; address: () => AddressInfo | string | null }) => { await new Promise<void>((r) => s.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${(s.address() as AddressInfo).port}`; };

// A Telnyx-style key pair: the portal shows the public key as base64 of the raw 32 bytes.
const tx = generateKeyPairSync('ed25519');
const txPub = (tx.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(12).toString('base64');
const txSign = (body: string, ts: string) => sign(null, Buffer.from(`${ts}|${body}`), tx.privateKey).toString('base64');

describe('telnyx Ed25519 webhook signature', () => {
  it('accepts a good signature (raw or SPKI key), rejects tampering, wrong keys and stale timestamps', () => {
    const now = Date.parse('2026-11-03T12:00:00Z'); const ts = String(now / 1000); const body = '{"data":{"event_type":"message.received"}}';
    const spki = (tx.publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
    expect(verifyTelnyx(txPub, body, txSign(body, ts), ts, now)).toBe(true);
    expect(verifyTelnyx(spki, body, txSign(body, ts), ts, now)).toBe(true);
    expect(verifyTelnyx(txPub, body.replace('received', 'sent'), txSign(body, ts), ts, now)).toBe(false);
    const other = (generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(12).toString('base64');
    expect(verifyTelnyx(other, body, txSign(body, ts), ts, now)).toBe(false);
    expect(verifyTelnyx(txPub, body, txSign(body, ts), ts, now + 301_000)).toBe(false);
    expect(verifyTelnyx(txPub, body, undefined, ts, now)).toBe(false);
  });
});

describe('policy', () => {
  it('reply-first, STOP/START, WhatsApp 24h window, daily cap', () => {
    let now = Date.parse('2026-11-03T12:00:00Z');
    const p = new Policy(undefined, { sms: 2, whatsapp: 5 }, () => now);
    expect(p.refusal('sms', '+14155550100')).toMatch(/no consent/);
    p.inbound('sms', '+14155550100', 'what is the pathUSD supply?', 'm1');
    expect(p.refusal('sms', '+14155550100')).toBeNull();
    expect(p.refusal('whatsapp', '+14155550100')).toMatch(/no consent/); // consent is per channel
    p.inbound('sms', '+14155550100', ' Stop ', 'm2');
    expect(p.refusal('sms', '+14155550100')).toMatch(/opted out/);
    p.inbound('sms', '+14155550100', 'hello again', 'm3');
    expect(p.refusal('sms', '+14155550100')).toMatch(/opted out/); // only START re-opts in
    p.inbound('sms', '+14155550100', 'START', 'm4');
    expect(p.refusal('sms', '+14155550100')).toBeNull();
    p.sent('sms', '+14155550100'); p.sent('sms', '+14155550100');
    expect(p.refusal('sms', '+14155550100')).toMatch(/daily cap/);
    p.inbound('whatsapp', '+447700900123', 'hi', 'w1');
    now += 25 * 3600 * 1000;
    expect(p.refusal('whatsapp', '+447700900123')).toMatch(/window closed/);
    expect(p.refusal('sms', '+14155550100')).toBeNull(); // new day resets the cap
    const t = smsTexts();
    expect(p.autoReply('sms', '+14155550199', p.inbound('sms', '+14155550199', 'hi', 'n1'), t)).toBe(t.welcome);
    p.markDisclosed('sms', '+14155550199');
    expect(p.autoReply('sms', '+14155550199', p.inbound('sms', '+14155550199', 'more', 'n2'), t)).toBeNull();
    expect(p.autoReply('sms', '+14155550199', p.inbound('sms', '+14155550199', ' HELP ', 'n3'), t)).toBe(t.help);
    expect(p.autoReply('sms', '+14155550199', p.inbound('sms', '+14155550199', 'stop', 'n4'), t)).toBe(t.stop);
    expect(p.autoReply('whatsapp', '+447700900123', 'message', t)).toBeNull();
  });
});

const waBody = (pid: string, from: string, id: string, text: string) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: pid }, contacts: [{ wa_id: from, profile: { name: 'Ana' } }], messages: [{ from, id, timestamp: '1793700000', type: 'text', text: { body: text } }] } }] }] });

describe('whatsapp parsing and splitting', () => {
  it('tags each message with the number it was sent to and splits mixed webhooks', () => {
    const mixed = { object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [...waBody('111', '14155550100', 'a', 'x').entry[0]!.changes, ...waBody('222', '447700900123', 'b', 'y').entry[0]!.changes] }] };
    const items = parseWebhook(mixed);
    expect(items.map((i) => [i.phoneNumberId, (i as any).from])).toEqual([['111', '+14155550100'], ['222', '+447700900123']]);
    const parts = splitByNumber(mixed);
    expect([...parts.keys()]).toEqual(['111', '222']);
    expect(parseWebhook(parts.get('222')!)).toHaveLength(1);
  });
});

describe('agent connector + relay, end to end (fake Meta, Telnyx and inbox)', () => {
  it('routes each number to its own agent, enforces consent, adds the disclosure once', async () => {
    const ledger: any[] = []; const sentApi: any[] = [];
    const fakeFetch = (async (input: any, init?: any) => {
      const u = String(input);
      if (u.includes('/hooks/')) { ledger.push(JSON.parse(init.body)); return new Response('{}', { status: 201 }); }
      if (u.startsWith('https://graph.facebook.com/')) { sentApi.push({ u, body: JSON.parse(init.body) }); return Response.json({ messages: [{ id: `wamid.${sentApi.length}` }] }); }
      if (u.startsWith('https://api.telnyx.com/')) { sentApi.push({ u, auth: init.headers.authorization, body: JSON.parse(init.body) }); return Response.json({ data: { id: `msg-${sentApi.length}` } }); }
      return globalThis.fetch(input, init);
    }) as typeof fetch;
    const mk = (agentId: string, pid: string, number: string) => createCommsServer({
      agentId, display: `${agentId} (Visybl)`, smsTexts: smsTexts(), publicUrl: 'https://comms.test/' + agentId, apiToken: 'tok-' + agentId, inbox: { url: 'http://inbox', secret: 's' },
      stateFile: join(mkdtempSync(join(tmpdir(), 'comms-')), 'state.json'), caps: { sms: 10, whatsapp: 10 },
      sms: { apiKey: 'KEYtelnyx', publicKey: txPub, number }, wa: { phoneNumberId: pid, accessToken: 'EAA', relaySecret: 'relay-' + agentId },
      host: '127.0.0.1', port: 0, fetchImpl: fakeFetch, log: () => {},
    });
    const a1 = mk('agent001', '111', '+18885550001'); const a2 = mk('agent002', '222', '+18885550002');
    const u1 = await listen(a1.server); const u2 = await listen(a2.server);
    const relay = createRelay({ appSecret: 'meta-secret', verifyToken: 'vt', routes: { '111': { url: `${u1}/whatsapp`, secret: 'relay-agent001' }, '222': { url: `${u2}/whatsapp`, secret: 'relay-agent002' } }, fetchImpl: fakeFetch, log: () => {} });
    const ur = await listen(relay);

    expect(await (await fetch(`${ur}/whatsapp?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=42`)).text()).toBe('42');
    const send = (u: string, agent: string, b: unknown) => fetch(`${u}/v1/send`, { method: 'POST', headers: { authorization: `Bearer tok-${agent}` }, body: JSON.stringify(b) });

    // nobody wrote yet: refused
    expect((await send(u1, 'agent001', { channel: 'whatsapp', to: '+14155550100', text: 'hi' })).status).toBe(403);

    // Meta webhook for agent002's number arrives at the relay
    const body = JSON.stringify(waBody('222', '14155550100', 'wamid.in1', 'is USDB reconciled?'));
    expect((await fetch(`${ur}/whatsapp`, { method: 'POST', headers: { 'x-hub-signature-256': 'sha256=bad' }, body })).status).toBe(401);
    expect((await fetch(`${ur}/whatsapp`, { method: 'POST', headers: { 'x-hub-signature-256': hubSignature('meta-secret', body) }, body })).status).toBe(200);
    expect(ledger.at(-1)).toMatchObject({ agent: 'agent002', type: 'whatsapp.received', from: '+14155550100', text: 'is USDB reconciled?' });
    // agent002 may now reply; agent001 still may not (consent belongs to the agent written to)
    expect((await send(u2, 'agent002', { channel: 'whatsapp', to: '+14155550100', text: 'Yes, as of 12:00 UTC.' })).status).toBe(202);
    expect((await send(u1, 'agent001', { channel: 'whatsapp', to: '+14155550100', text: 'hi' })).status).toBe(403);
    // agent001 cannot be fed by forging relay traffic without its own secret
    expect((await fetch(`${u1}/whatsapp`, { method: 'POST', headers: { 'x-a9n9-relay-signature': hubSignature('relay-agent002', body) }, body })).status).toBe(401);

    // inbound SMS to agent001's own number, signed like Telnyx does
    const ts = String(Math.floor(Date.now() / 1000));
    const inbound = JSON.stringify({ data: { event_type: 'message.received', id: 'ev-1', payload: { id: 'sms-1', text: 'hello', from: { phone_number: '+14155550111' }, to: [{ phone_number: '+18885550001', status: 'webhook_delivered' }] } } });
    const post = (b: string, sig: string) => fetch(`${u1}/sms/telnyx`, { method: 'POST', headers: { 'content-type': 'application/json', 'telnyx-signature-ed25519': sig, 'telnyx-timestamp': ts }, body: b });
    expect((await post(inbound, 'AAAA')).status).toBe(401);
    expect((await post(inbound, txSign(inbound, ts))).status).toBe(200);
    expect(ledger.find((e) => e.type === 'sms.received')).toMatchObject({ agent: 'agent001', from: '+14155550111' });
    expect(ledger.at(-1)).toMatchObject({ type: 'sms.sent', auto: 'message' });
    expect((await send(u1, 'agent001', { channel: 'sms', to: '+14155550111', text: 'Hi, what can I check for you?' })).status).toBe(202);
    expect((await send(u1, 'agent001', { channel: 'sms', to: '+14155550111', text: 'Second reply.' })).status).toBe(202);
    const smsSends = sentApi.filter((s) => s.u.startsWith('https://api.telnyx.com/'));
    expect(smsSends[0].body.text).toBe(smsTexts().welcome); // the published first reply goes out on first contact
    expect(smsSends[1].body.text).toBe('Visybl: Hi, what can I check for you?'); // agent texts carry the brand
    expect(smsSends[2].body.text).toBe('Visybl: Second reply.');
    expect(smsSends[0].body).toMatchObject({ from: '+18885550001', to: '+14155550111', webhook_url: 'https://comms.test/agent001/sms/telnyx' });
    expect(smsSends[0].auth).toBe('Bearer KEYtelnyx');
    // a delivery report lands in the ledger as sms.status
    const dlr = JSON.stringify({ data: { event_type: 'message.finalized', occurred_at: '2026-11-03T12:00:05Z', payload: { id: 'msg-3', to: [{ phone_number: '+14155550111', status: 'delivered' }], errors: [] } } });
    expect((await post(dlr, txSign(dlr, ts))).status).toBe(200);
    expect(ledger.at(-1)).toMatchObject({ type: 'sms.status', messageId: 'msg-3', status: 'delivered', to: '+14155550111' });
    for (const s of [a1.server, a2.server, relay]) s.close();
  });
});
