import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { plivoV3Signature, verifyPlivoV3 } from '../src/plivo.js';
import { Policy } from '../src/policy.js';
import { createRelay } from '../src/relay.js';
import { createCommsServer } from '../src/server.js';
import { hubSignature, parseWebhook, splitByNumber } from '../src/whatsapp.js';

const listen = async (s: { listen: Function; address: () => AddressInfo | string | null }) => { await new Promise<void>((r) => s.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${(s.address() as AddressInfo).port}`; };

describe('plivo V3 signature', () => {
  it('matches a vector produced by the official plivo SDK (validateV3Signature)', () => {
    const params = { From: '14155550100', To: '18885550123', Text: 'Hi there', Type: 'sms', MessageUUID: 'abc-123' };
    expect(plivoV3Signature('MAtesttoken0123456789', 'https://comms.a9n9.net/agent001/sms/plivo', params, '12345678901234567890')).toBe('vs5KQKB/4/xA83DP0o9UtM2Vwoy8POkdYKscfLOeiqU=');
    expect(verifyPlivoV3('MAtesttoken0123456789', 'https://comms.a9n9.net/agent001/sms/plivo', params, '12345678901234567890', 'old,vs5KQKB/4/xA83DP0o9UtM2Vwoy8POkdYKscfLOeiqU=')).toBe(true);
    expect(verifyPlivoV3('MAtesttoken0123456789', 'https://comms.a9n9.net/agent001/sms/plivo', { ...params, Text: 'tampered' }, '12345678901234567890', 'vs5KQKB/4/xA83DP0o9UtM2Vwoy8POkdYKscfLOeiqU=')).toBe(false);
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

describe('agent connector + relay, end to end (fake Meta, Plivo and inbox)', () => {
  it('routes each number to its own agent, enforces consent, adds the disclosure once', async () => {
    const ledger: any[] = []; const sentApi: any[] = [];
    const fakeFetch = (async (input: any, init?: any) => {
      const u = String(input);
      if (u.includes('/hooks/')) { ledger.push(JSON.parse(init.body)); return new Response('{}', { status: 201 }); }
      if (u.startsWith('https://graph.facebook.com/')) { sentApi.push({ u, body: JSON.parse(init.body) }); return Response.json({ messages: [{ id: `wamid.${sentApi.length}` }] }); }
      if (u.startsWith('https://api.plivo.com/')) { sentApi.push({ u, body: JSON.parse(init.body) }); return Response.json({ message_uuid: [`uuid-${sentApi.length}`] }, { status: 202 }); }
      return globalThis.fetch(input, init);
    }) as typeof fetch;
    const mk = (agentId: string, pid: string, number: string) => createCommsServer({
      agentId, display: `${agentId} (Visybl)`, publicUrl: 'https://comms.test/' + agentId, apiToken: 'tok-' + agentId, inbox: { url: 'http://inbox', secret: 's' },
      stateFile: join(mkdtempSync(join(tmpdir(), 'comms-')), 'state.json'), caps: { sms: 10, whatsapp: 10 },
      sms: { authId: 'MA1', authToken: 'plivo-token', number }, wa: { phoneNumberId: pid, accessToken: 'EAA', relaySecret: 'relay-' + agentId },
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

    // inbound SMS to agent001's own number, signed like Plivo does
    const params = { From: '14155550111', To: '18885550001', Text: 'hello', Type: 'sms', MessageUUID: 'sms-1' };
    const nonce = 'n0nce';
    const sig = plivoV3Signature('plivo-token', 'https://comms.test/agent001/sms/plivo', params, nonce);
    expect((await fetch(`${u1}/sms/plivo`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-plivo-signature-v3': sig, 'x-plivo-signature-v3-nonce': nonce }, body: new URLSearchParams(params) })).status).toBe(200);
    expect(ledger.at(-1)).toMatchObject({ agent: 'agent001', type: 'sms.received', from: '+14155550111' });
    expect((await send(u1, 'agent001', { channel: 'sms', to: '+14155550111', text: 'Hi, what can I check for you?' })).status).toBe(202);
    expect((await send(u1, 'agent001', { channel: 'sms', to: '+14155550111', text: 'Second reply.' })).status).toBe(202);
    const smsSends = sentApi.filter((s) => s.u.startsWith('https://api.plivo.com/'));
    expect(smsSends[0].body.text).toMatch(/^agent001 \(Visybl\): Hi.*STOP to opt out\.$/s); // first reply carries the disclosure
    expect(smsSends[1].body.text).toBe('Second reply.');
    expect(smsSends[0].body.src).toBe('18885550001');
    for (const s of [a1.server, a2.server, relay]) s.close();
  });
});
