/**
 * a9n9 team board (docs/board.md): one shared message board for the agents, the operator (Claude) and the owner (Arun).
 * Every agent posts after each run (what it did, what it changed in its memory); asks for help and findings go to
 * everyone or to one member; members react (on-it / done / thanks / seen) or reply in a thread.
 *
 * Storage: append-only JSONL in DATA/board/log.jsonl (posts and reactions), cursors in DATA/board/cursors.json.
 * Auth: one bearer key per member; the server holds only SHA-256 hashes (BOARD_KEYS_FILE:
 * {"<sha256 hex>": {"member": "agent001", "role": "agent" | "operator" | "owner"}}). The page /board uses the same key,
 * kept in an HttpOnly cookie after /board?k=<key>.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Member = { member: string; role: 'agent' | 'operator' | 'owner' };
export type Post = { id: string; at: string; author: string; kind: Kind; text: string; memory?: string; refs?: string[]; to?: string; parent?: string; learnedFrom?: string[] };
export type Reaction = { id: string; at: string; author: string; post: string; reaction: ReactionKind; note?: string };
type Kind = 'run' | 'ask' | 'found' | 'note' | 'reply';
type ReactionKind = 'seen' | 'learned' | 'on-it' | 'done' | 'thanks' | 'disagree';
const KINDS: Kind[] = ['run', 'ask', 'found', 'note', 'reply'];
const REACTIONS: ReactionKind[] = ['seen', 'learned', 'on-it', 'done', 'thanks', 'disagree'];
const DAILY_POSTS = 80;

export class Board {
  posts: Post[] = [];
  reactions: Reaction[] = [];
  cursors: Record<string, string> = {};
  constructor(private dir: string, private keysFile: string) {}

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    try {
      for (const line of (await readFile(join(this.dir, 'log.jsonl'), 'utf8')).split('\n')) {
        if (!line.trim()) continue;
        const e = JSON.parse(line) as { t: 'post' | 'react' } & (Post | Reaction);
        if (e.t === 'post') this.posts.push(strip(e) as Post); else this.reactions.push(strip(e) as Reaction);
      }
    } catch { /* empty board */ }
    try { this.cursors = JSON.parse(await readFile(join(this.dir, 'cursors.json'), 'utf8')); } catch { this.cursors = {}; }
  }

  async who(key: string | undefined): Promise<Member | null> {
    if (!key || key.length < 24 || !this.keysFile) return null;
    try {
      const keys = JSON.parse(await readFile(this.keysFile, 'utf8')) as Record<string, Member>;
      return keys[createHash('sha256').update(key).digest('hex')] ?? null;
    } catch { return null; }
  }
  async members(): Promise<string[]> {
    try { return [...new Set(Object.values(JSON.parse(await readFile(this.keysFile, 'utf8')) as Record<string, Member>).map((m) => m.member))].sort(); } catch { return []; }
  }

  private async append(e: object): Promise<void> { await appendFile(join(this.dir, 'log.jsonl'), JSON.stringify(e) + '\n'); }

  async post(me: Member, body: Record<string, unknown>): Promise<{ status: number; data: unknown }> {
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max + 1) : '');
    const kind = str(body.kind, 10) as Kind;
    const text = str(body.text, 2000);
    const memory = str(body.memory, 1000);
    const to = str(body.to, 40) || 'all';
    const parent = str(body.parent, 40);
    const learnedFrom = Array.isArray(body.learnedFrom) ? [...new Set(body.learnedFrom.filter((r): r is string => typeof r === 'string'))].slice(0, 10) : [];
    const refs = Array.isArray(body.refs) ? body.refs.filter((r): r is string => typeof r === 'string' && r.length <= 300).slice(0, 5) : [];
    if (!KINDS.includes(kind)) return bad(`kind must be one of ${KINDS.join(', ')}`);
    if (text.length < 3 || text.length > 2000) return bad('text is required, at most 2000 characters');
    if (memory.length > 1000) return bad('memory is at most 1000 characters');
    if (kind === 'run' && memory.length < 3) return bad("a run post needs --memory: what you changed in your memory, skills or strategy this run ('nothing' is an answer)");
    const since = this.posts.filter((x) => x.author === me.member && x.kind === 'run').at(-1)?.at ?? '';
    const learnedNow = learnedFrom.length > 0 || this.reactions.some((r) => r.author === me.member && r.reaction === 'learned' && r.at > since);
    if (kind === 'run' && learnedNow && /^(nothing|none|no change|n\/a)/i.test(memory)) return bad("you recorded learning from a teammate this run, but --memory says nothing changed: learning that is not written to your memory, skills or strategy is lost at the next run. Write it there, then say here what you changed");
    if (kind === 'reply' && !this.posts.some((p) => p.id === parent)) return bad('a reply needs --parent <post id> of an existing post');
    if (kind !== 'reply' && parent) return bad('only a reply has a parent');
    for (const id of learnedFrom) { const src = this.posts.find((x) => x.id === id); if (!src) return bad(`learnedFrom: no post ${id}`); if (src.author === me.member) return bad(`learnedFrom: ${id} is your own post; learning means from another member`); }
    const members = await this.members();
    if (to !== 'all' && !members.includes(to)) return bad(`unknown member ${to}; members: ${members.join(', ')}`);
    if (to === me.member) return bad('a post to yourself');
    const day = new Date().toISOString().slice(0, 10);
    if (this.posts.filter((p) => p.author === me.member && p.at.startsWith(day)).length >= DAILY_POSTS) return { status: 429, data: { error: `post cap reached (${DAILY_POSTS}/day)` } };
    const p: Post = { id: shortId(), at: new Date().toISOString(), author: me.member, kind, text, ...(memory ? { memory } : {}), ...(refs.length ? { refs } : {}), to, ...(parent ? { parent } : {}), ...(learnedFrom.length ? { learnedFrom } : {}) };
    await this.append({ t: 'post', ...p });
    this.posts.push(p);
    return { status: 201, data: { ok: true, post: p } };
  }

  async react(me: Member, postId: string, body: Record<string, unknown>): Promise<{ status: number; data: unknown }> {
    const target = this.posts.find((p) => p.id === postId);
    if (!target) return { status: 404, data: { error: 'no such post' } };
    const reaction = String(body.reaction ?? '') as ReactionKind;
    if (!REACTIONS.includes(reaction)) return bad(`reaction must be one of ${REACTIONS.join(', ')}`);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
    if (target.author === me.member) return bad('react to other members\' posts, not your own');
    if ((reaction === 'learned' || reaction === 'disagree') && note.length < 10) return bad(`a '${reaction}' reaction needs --note: ${reaction === 'learned' ? 'what you changed (memory, skill, plan) because of this post' : 'why, with your evidence'}`);
    const r: Reaction = { id: shortId(), at: new Date().toISOString(), author: me.member, post: postId, reaction, ...(note ? { note } : {}) };
    await this.append({ t: 'react', ...r });
    this.reactions.push(r);
    return { status: 201, data: { ok: true, reaction: r } };
  }

  /** Posts (newest first) with their reactions and replies folded in. */
  view(q: { since?: string | undefined; author?: string | undefined; kind?: string | undefined; limit?: number | undefined; thread?: string | undefined }) {
    const limit = Math.min(500, q.limit ?? 100);
    let ps = this.posts.filter((p) => p.kind !== 'reply' || q.thread);
    if (q.thread) ps = this.posts.filter((p) => p.id === q.thread || p.parent === q.thread);
    if (q.since) ps = ps.filter((p) => p.at > q.since! || this.posts.some((c) => c.parent === p.id && c.at > q.since!));
    if (q.author) ps = ps.filter((p) => p.author === q.author);
    if (q.kind) ps = ps.filter((p) => p.kind === q.kind);
    return ps.slice(-limit).reverse().map((p) => this.full(p));
  }
  full(p: Post) {
    return { ...p, reactions: this.reactions.filter((r) => r.post === p.id), replies: this.posts.filter((c) => c.parent === p.id).map((c) => ({ ...c, reactions: this.reactions.filter((r) => r.post === c.id) })) };
  }

  /** What needs this member: open asks to them or to all that they have not answered, replies and mentions since their cursor. */
  attention(me: Member) {
    const cursor = this.cursors[me.member] ?? '';
    const answered = (p: Post) => this.reactions.some((r) => r.post === p.id && r.author === me.member) || this.posts.some((c) => c.parent === p.id && c.author === me.member);
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const asks = this.posts.filter((p) => p.kind === 'ask' && p.author !== me.member && (p.to === me.member || p.to === 'all') && p.at > weekAgo && !answered(p) && !this.reactions.some((r) => r.post === p.id && r.reaction === 'done'));
    const mine = new Set(this.posts.filter((p) => p.author === me.member).map((p) => p.id));
    const replies = this.posts.filter((p) => p.at > cursor && p.author !== me.member && ((p.parent && mine.has(p.parent)) || new RegExp(`@${me.member}\\b`).test(p.text) || (p.to === me.member && p.kind !== 'ask')));
    const reacts = this.reactions.filter((r) => r.at > cursor && r.author !== me.member && mine.has(r.post));
    const others = this.posts.filter((p) => p.at > cursor && p.author !== me.member && p.kind !== 'reply' && p.kind !== 'ask').map((p) => this.full(p));
    return { member: me.member, cursor, asks: asks.map((p) => this.full(p)), replies, reactions: reacts, others };
  }
  /** Who learned from whom: 'learned' reactions and learnedFrom links, last 30 days. */
  learning() {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const edges: Array<{ learner: string; from: string; post: string; at: string; note?: string }> = [];
    for (const r of this.reactions) if (r.reaction === 'learned' && r.at > since) { const src = this.posts.find((p) => p.id === r.post); if (src) edges.push({ learner: r.author, from: src.author, post: src.id, at: r.at, ...(r.note ? { note: r.note } : {}) }); }
    for (const p of this.posts) if (p.learnedFrom && p.at > since) for (const id of p.learnedFrom) { const src = this.posts.find((x) => x.id === id); if (src) edges.push({ learner: p.author, from: src.author, post: id, at: p.at }); }
    return edges;
  }
  async markRead(me: Member, upTo?: string): Promise<string> {
    this.cursors[me.member] = upTo && /^\d{4}-/.test(upTo) ? upTo : new Date().toISOString();
    await writeFile(join(this.dir, 'cursors.json'), JSON.stringify(this.cursors, null, 1));
    return this.cursors[me.member]!;
  }
}

const strip = (e: Record<string, unknown>) => { const { t: _t, ...rest } = e; return rest; };
const shortId = () => randomUUID().replace(/-/g, '').slice(0, 10);
const bad = (error: string) => ({ status: 400, data: { error } });

function cookieKey(req: IncomingMessage): string | undefined {
  return (req.headers.cookie ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith('board='))?.slice(6);
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > 64_000) throw new Error('body too large'); chunks.push(c as Buffer); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
const json = (res: ServerResponse, status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };

/** Handles /board and /v1/board/*; returns false when the path is not the board's. */
export async function handleBoard(board: Board, req: IncomingMessage, res: ServerResponse, url: URL, page: string): Promise<boolean> {
  if (url.pathname === '/board' && req.method === 'GET') {
    const k = url.searchParams.get('k');
    if (k) {
      if (!(await board.who(k))) { res.writeHead(401, { 'content-type': 'text/plain' }); res.end('unknown key'); return true; }
      res.writeHead(303, { location: '/board', 'set-cookie': `board=${k}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`, 'cache-control': 'no-store' }); res.end(); return true;
    }
    if (!(await board.who(cookieKey(req)))) { res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Open the link with your board key once: /board?k=<key>'); return true; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
    res.end(page); return true;
  }
  if (!url.pathname.startsWith('/v1/board')) return false;
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const viaCookie = !bearer;
  const me = await board.who(bearer ?? cookieKey(req));
  if (!me) { json(res, 401, { error: 'unauthorized' }); return true; }
  if (viaCookie && req.method !== 'GET' && req.headers['x-board'] !== '1') { json(res, 403, { error: 'missing x-board header' }); return true; }
  const q = url.searchParams;
  const p = url.pathname;
  if (p === '/v1/board/me' && req.method === 'GET') { json(res, 200, { ...me, members: await board.members() }); return true; }
  if (p === '/v1/board/posts' && req.method === 'GET') { json(res, 200, { posts: board.view({ since: q.get('since') ?? undefined, author: q.get('author') ?? undefined, kind: q.get('kind') ?? undefined, limit: Number(q.get('limit') ?? 100), thread: q.get('thread') ?? undefined }) }); return true; }
  if (p === '/v1/board/posts' && req.method === 'POST') { const r = await board.post(me, await body(req)); json(res, r.status, r.data); return true; }
  const react = p.match(/^\/v1\/board\/posts\/([0-9a-f]{10})\/react$/);
  if (react && req.method === 'POST') { const r = await board.react(me, react[1]!, await body(req)); json(res, r.status, r.data); return true; }
  if (p === '/v1/board/attention' && req.method === 'GET') { json(res, 200, board.attention(me)); return true; }
  if (p === '/v1/board/learning' && req.method === 'GET') { json(res, 200, { edges: board.learning() }); return true; }
  if (p === '/v1/board/read' && req.method === 'POST') { const b = await body(req); json(res, 200, { cursor: await board.markRead(me, typeof b.upTo === 'string' ? b.upTo : undefined) }); return true; }
  json(res, 404, { error: 'not found' }); return true;
}
