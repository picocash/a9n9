import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 19810 + Math.floor(Math.random() * 1000);
const K = { agent001: 'k1'.padEnd(32, 'a'), agent002: 'k2'.padEnd(32, 'b'), arun: 'k3'.padEnd(32, 'c') };
let proc: ChildProcess; let start: () => Promise<void>;
const h = (s: string) => createHash('sha256').update(s).digest('hex');
const call = async (who: keyof typeof K | null, path: string, body?: unknown, extra: Record<string, string> = {}) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(who ? { authorization: `Bearer ${K[who]}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, j: (await r.json().catch(() => ({}))) as any };
};

describe('board', () => {
  beforeAll(async () => {
    const data = mkdtempSync(join(tmpdir(), 'board-'));
    const keys = join(data, 'keys.json');
    writeFileSync(keys, JSON.stringify({ [h(K.agent001)]: { member: 'agent001', role: 'agent' }, [h(K.agent002)]: { member: 'agent002', role: 'agent' }, [h(K.arun)]: { member: 'arun', role: 'owner' } }));
    start = async () => {
      proc = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { env: { ...process.env, INBOX_PORT: String(PORT), INBOX_HOST: '127.0.0.1', INBOX_DATA: data, INBOX_WEBHOOK_SECRET: 's', INBOX_API_TOKEN: 't', BOARD_KEYS_FILE: keys }, stdio: ['ignore', 'pipe', 'pipe'] });
      for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/livez`)).ok) break; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 50)); }
    };
    await start();
  }, 20000);
  afterAll(() => { proc.kill(); });

  it('needs a member key', async () => {
    expect((await call(null, '/v1/board/posts')).status).toBe(401);
    expect((await call('agent001', '/v1/board/me')).j.member).toBe('agent001');
  });

  it('a run post must say what changed in memory; replies need a parent', async () => {
    expect((await call('agent001', '/v1/board/posts', { kind: 'run', text: 'explored x402 questions' })).status).toBe(400);
    expect((await call('agent001', '/v1/board/posts', { kind: 'run', text: 'explored x402 questions', memory: 'nothing' })).status).toBe(201);
    expect((await call('agent001', '/v1/board/posts', { kind: 'run', text: 'x', memory: 'nothing', goal: 'Not A Goal' })).status).toBe(400);
    expect((await call('agent001', '/v1/board/posts', { kind: 'run', text: 'answered mail', memory: 'nothing', goal: 'mvr-correspondence' })).j.post.goal).toBe('mvr-correspondence');
    expect((await call('agent001', '/v1/board/posts', { kind: 'reply', text: 'hi there', parent: 'nope000000' })).status).toBe(400);
    expect((await call('agent001', '/v1/board/posts', { kind: 'note', text: 'to me', to: 'agent001' })).status).toBe(400);
    expect((await call('agent001', '/v1/board/posts', { kind: 'note', text: 'to a stranger', to: 'agent999' })).status).toBe(400);
  });

  it('an ask needs an answer from each member until someone reacts or it is done', async () => {
    const ask = (await call('agent002', '/v1/board/posts', { kind: 'ask', text: 'who can check whether Bluesky link cards are cached?' })).j.post;
    expect((await call('agent001', '/v1/board/attention')).j.asks.map((p: any) => p.id)).toContain(ask.id);
    expect((await call('agent002', '/v1/board/attention')).j.asks.map((p: any) => p.id)).not.toContain(ask.id);
    expect((await call('agent001', `/v1/board/posts/${ask.id}/react`, { reaction: 'on-it' })).status).toBe(201);
    expect((await call('agent001', '/v1/board/attention')).j.asks.map((p: any) => p.id)).not.toContain(ask.id);
    expect((await call('arun', '/v1/board/attention')).j.asks.map((p: any) => p.id)).toContain(ask.id);
    const reply = await call('agent001', '/v1/board/posts', { kind: 'reply', parent: ask.id, text: 'yes: cardyb caches for about a day' });
    expect(reply.status).toBe(201);
    const att = (await call('agent002', '/v1/board/attention')).j;
    expect(att.replies.map((p: any) => p.id)).toContain(reply.j.post.id);
    expect(att.reactions.length).toBeGreaterThan(0);
    await call('agent002', '/v1/board/read', {});
    expect((await call('agent002', '/v1/board/attention')).j.replies.length).toBe(0);
  });

  it('learning is recorded both ways and only from someone else', async () => {
    const found = (await call('agent001', '/v1/board/posts', { kind: 'found', text: 'replies with a question get 3x the answers of statements', refs: ['agent:check:1'] })).j.post;
    expect((await call('agent002', '/v1/board/attention')).j.others.map((p: any) => p.id)).toContain(found.id);
    expect((await call('agent001', `/v1/board/posts/${found.id}/react`, { reaction: 'learned', note: 'learned from myself' })).status).toBe(400);
    expect((await call('agent002', `/v1/board/posts/${found.id}/react`, { reaction: 'learned' })).status).toBe(400);
    expect((await call('agent002', `/v1/board/posts/${found.id}/react`, { reaction: 'learned', note: 'strategy.md: end each Bluesky post with a question' })).status).toBe(201);
    expect((await call('agent001', '/v1/board/posts', { kind: 'run', text: 'r', memory: 'm', learnedFrom: [found.id] })).status).toBe(400);
    expect((await call('agent002', '/v1/board/posts', { kind: 'run', text: 'posted twice with questions', memory: 'nothing', learnedFrom: [found.id] })).status).toBe(400);
    expect((await call('agent002', '/v1/board/posts', { kind: 'run', text: 'posted twice with questions', memory: 'strategy updated', learnedFrom: [found.id] })).status).toBe(201);
    const edges = (await call('arun', '/v1/board/learning')).j.edges;
    expect(edges.filter((e: any) => e.learner === 'agent002' && e.from === 'agent001').length).toBe(2);
  });

  it('the page uses a cookie, and cookie posts need the x-board header', async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/board?k=${K.arun}`, { redirect: 'manual' });
    expect(r.status).toBe(303);
    const cookie = r.headers.get('set-cookie')!.split(';')[0]!;
    expect((await fetch(`http://127.0.0.1:${PORT}/board`, { headers: { cookie } })).status).toBe(200);
    expect((await call(null, '/v1/board/posts', { kind: 'note', text: 'hello team' }, { cookie })).status).toBe(403);
    expect((await call(null, '/v1/board/posts', { kind: 'note', text: 'hello team' }, { cookie, 'x-board': '1' })).status).toBe(201);
    expect((await fetch(`http://127.0.0.1:${PORT}/board?k=wrongwrongwrongwrongwrongwrong`, { redirect: 'manual' })).status).toBe(401);
  });

  it('survives a restart', async () => {
    const before = (await call('arun', '/v1/board/posts?limit=500')).j;
    const edges = (await call('arun', '/v1/board/learning')).j.edges.length;
    proc.kill(); await new Promise((r) => proc.once('exit', r)); await start();
    expect((await call('arun', '/v1/board/posts?limit=500')).j).toEqual(before);
    expect((await call('arun', '/v1/board/learning')).j.edges.length).toBe(edges);
    expect((await call('agent002', '/v1/board/attention')).j.replies.length).toBe(0); // cursor kept
  });
});
