import { createHmac } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 18810 + Math.floor(Math.random() * 1000);
const SECRET = 'test-secret';
const TOKEN = 'test-token';
let proc: ChildProcess;

const post = (channel: string, body: unknown, sig?: string) => {
  const raw = JSON.stringify(body);
  return fetch(`http://127.0.0.1:${PORT}/hooks/${channel}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': sig ?? `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}` }, body: raw });
};
const get = (path: string) => fetch(`http://127.0.0.1:${PORT}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });

describe('inbox', () => {
  beforeAll(async () => {
    const data = mkdtempSync(join(tmpdir(), 'inbox-'));
    proc = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { env: { ...process.env, INBOX_PORT: String(PORT), INBOX_HOST: '127.0.0.1', INBOX_DATA: data, INBOX_AGENT_WEBHOOK_SECRET: 'agent-secret', INBOX_WEBHOOK_SECRET: SECRET, INBOX_API_TOKEN: TOKEN }, stdio: ['ignore', 'pipe', 'pipe'] });
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/livez`)).ok) break; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 50)); }
  }, 20000);
  afterAll(() => { proc.kill(); });

  it('stores signed events once, rejects bad signatures, and filters by channel/type/since', async () => {
    expect((await post('email', { id: 'e1', type: 'email.received' })).status).toBe(201);
    expect((await post('email', { id: 'e1', type: 'email.received' })).status).toBe(200); // duplicate
    expect((await post('sms', { id: 's1', type: 'sms.received' })).status).toBe(201);
    expect((await post('sms', { id: 's1:delivered', type: 'sms.status' })).status).toBe(201);
    expect((await post('voice', { id: 'c1', type: 'voice.call' }, 'sha256=00')).status).toBe(401);
    expect((await fetch(`http://127.0.0.1:${PORT}/v1/events`)).status).toBe(401);
    const all = (await (await get('/v1/events')).json()).events as Array<{ id: string }>;
    expect(all.map((e) => e.id)).toEqual(['s1:delivered', 's1', 'e1']);
    const sms = (await (await get('/v1/events?channel=sms&type=sms.status')).json()).events as Array<{ id: string }>;
    expect(sms.map((e) => e.id)).toEqual(['s1:delivered']);
    const one = await (await get('/v1/events/sms/s1:delivered')).json();
    expect(one.type).toBe('sms.status');
    const none = (await (await get('/v1/events?since=2999-01-01')).json()).events;
    expect(none).toEqual([]);
  });

  it('the daily digest is a stable hash over that day\'s index lines', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const d1 = await (await get(`/v1/digest?day=${day}`)).json();
    expect(d1.count).toBe(3);
    expect(d1.ids).toEqual(['e1', 's1', 's1:delivered']);
    expect(d1.sha256).toMatch(/^[0-9a-f]{64}$/);
    const d2 = await (await get(`/v1/digest?day=${day}`)).json();
    expect(d2.sha256).toBe(d1.sha256);
    expect((await (await get('/v1/digest?day=1999-12-31')).json()).count).toBe(0);
    expect((await get('/v1/digest?day=yesterday')).status).toBe(400);
  });

  it('accepts the agent key only for what the agent reports', async () => {
    const sig = (b: unknown) => `sha256=${createHmac('sha256', 'agent-secret').update(JSON.stringify(b)).digest('hex')}`;
    const ok = { id: 'a1', type: 'agent.note' };
    expect((await post('agent', ok, sig(ok))).status).toBe(201);
    for (const type of ['money.income', 'money.fund', 'receipt.helped', 'ledger.anchor', 'email.received']) {
      const bad = { id: `f-${type}`, type };
      expect((await post('money', bad, sig(bad))).status).toBe(401);
    }
    const noType = { id: 'f-none' };
    expect((await post('money', noType, sig(noType))).status).toBe(401);
  });
});
