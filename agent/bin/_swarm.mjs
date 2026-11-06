// Agents helping each other (docs/swarm-comms.md): signing, validation and the fleet registry shared by swarm-send,
// swarm-read, fleet-note, fleet-board and grok-xsearch. Rules live here and in the inbox, never only in a skill.
import fs from 'node:fs';
import { createPrivateKey, sign as edSign } from 'node:crypto';
import { HOME, env } from './_lib.mjs';
export const ME = 'agent001';
export const INBOX = 'http://127.0.0.1:8810';
export const SEND_CAP = 20;   // agent.message per day
export const NOTE_CAP = 10;   // fleet.note kind note per day (search notes are not capped: one per search, which is capped by the Grok budget)
export const TEXT_MAX = 1000, NOTE_MAX = 300;
export const KINDS = ['ask', 'found', 'done'];
export const REF_RE = /^(https?:\/\/\S+|[a-z0-9]+:[\w:.\/-]+)$/i;
export function fleet() { try { return JSON.parse(fs.readFileSync(`${HOME}/fleet.json`, 'utf8')).agents ?? {}; } catch { return {}; } }
export const canonical = (p) => ['a9n9-swarm', p.from, p.to ?? '', p.kind, p.at, p.ref ?? '', p.text].join('\n');
/** Why a message may not be sent, or null. Pure: the guard test runs it without keys or network. */
export function sendProblem({ to, kind, ref, text, agents, me = ME, sentToday = 0 }) {
  if (!agents[to]) return `unknown agent ${to || '(none)'}; known: ${Object.keys(agents).join(', ') || 'none'}`;
  if (to === me) return 'that is you';
  if (!KINDS.includes(kind)) return `kind must be one of ${KINDS.join(', ')}`;
  if (!REF_RE.test(String(ref ?? ''))) return 'a message needs --ref <url|ledger id>: the receipt the other agent can check. A claim without one is not sent';
  if (!text) return 'text is required';
  if (text.length > TEXT_MAX) return `text is ${text.length} chars; max ${TEXT_MAX}`;
  if (sentToday >= SEND_CAP) return `swarm-send cap reached (${SEND_CAP}/day)`;
  return null;
}
export function noteProblem({ kind, text, notesToday = 0 }) {
  if (!['note', 'search'].includes(kind)) return 'kind must be note or search';
  if (!text) return 'text is required';
  if (text.length > NOTE_MAX) return `note is ${text.length} chars; max ${NOTE_MAX}`;
  if (kind === 'note' && notesToday >= NOTE_CAP) return `fleet-note cap reached (${NOTE_CAP}/day)`;
  return null;
}
/** The same query within `hours` by this agent (local log) or another (fleet board) means: do not search again. */
export const queryKey = (q) => String(q).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function duplicateSearch(q, entries, now = Date.now(), hours = 24) {
  const k = queryKey(q);
  return entries.find((e) => e && queryKey(e.text ?? e.query ?? '') === k && now - Date.parse(e.at) < hours * 3600_000) ?? null;
}
function key() {
  const kv = env('/home/ubuntu/a9n9/secrets/agent001-signing.env');
  return createPrivateKey({ key: { kty: 'OKP', crv: 'Ed25519', x: kv.AGENT_SIGNING_X, d: Buffer.from(kv.AGENT_SIGNING_SEED, 'hex').toString('base64url') }, format: 'jwk' });
}
export function signed(p) { return { ...p, sig: edSign(null, Buffer.from(canonical(p), 'utf8'), key()).toString('base64url') }; }
/** Post a signed swarm event with the agent's inbox key. Returns {status, body}. */
export async function postSwarm(type, p) {
  const { createHmac } = await import('node:crypto');
  const e = env('/home/ubuntu/a9n9/secrets/inbox.env');
  const payload = { id: `swarm:${p.from}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`, type, ...signed(p) };
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', e.INBOX_WEBHOOK_SECRET).update(body).digest('hex');
  const res = await fetch(`${INBOX}/hooks/swarm`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}` }, body });
  let j = null; try { j = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: j, id: payload.id };
}
export async function swarmEvents({ type, hours = 48 } = {}) {
  const e = env('/home/ubuntu/a9n9/secrets/inbox.env'); const h = { authorization: `Bearer ${e.INBOX_API_TOKEN}` };
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const list = await (await fetch(`${INBOX}/v1/events?limit=300&channel=swarm${type ? `&type=${type}` : ''}&since=${encodeURIComponent(since)}`, { headers: h })).json();
  const outEv = [];
  for (const ev of list.events ?? []) {
    const full = await (await fetch(`${INBOX}/v1/events/swarm/${encodeURIComponent(ev.id)}`, { headers: h })).json();
    outEv.push({ id: ev.id, type: ev.type, receivedAt: ev.receivedAt, ...(full.payload ?? {}) });
  }
  return outEv;
}
export const readState = () => { const f = `${HOME}/state/swarm-read.json`; return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };
export const saveReadState = (s) => fs.writeFileSync(`${HOME}/state/swarm-read.json`, JSON.stringify(s, null, 1));
