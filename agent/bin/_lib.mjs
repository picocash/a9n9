// Shared helpers for agent 001's tools: policy caps, counters, ledger posting, Chrome.
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { chromium } from '/home/ubuntu/source/a9n9/node_modules/playwright-core/index.mjs';
export const HOME = '/home/ubuntu/a9n9/agent001';
export const policy = JSON.parse(fs.readFileSync(`${HOME}/policy.json`, 'utf8'));
export const env = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter(l => /^[A-Z_0-9]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
export const paused = () => fs.existsSync(`${HOME}/PAUSED`);
export const out = (o) => { console.log(JSON.stringify(o, null, 1)); };
export const today = () => new Date().toISOString().slice(0, 10);
export function counter(kind) {
  const f = `${HOME}/state/counters.json`;
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  if (c.day !== today()) { for (const k of Object.keys(c)) delete c[k]; c.day = today(); }
  return { get: () => c[kind] ?? 0, bump: () => { c[kind] = (c[kind] ?? 0) + 1; fs.writeFileSync(f, JSON.stringify(c)); } };
}
export function enforce(kind, max, text) {
  if (paused()) { out({ ok: false, error: 'agent is PAUSED by the operator; do nothing further' }); process.exit(3); }
  const c = counter(kind);
  if (c.get() >= max) { out({ ok: false, error: `${kind} cap reached (${max}/day); try tomorrow` }); process.exit(4); }
  if (text && text.length > policy.max_chars) { out({ ok: false, error: `text is ${text.length} chars; max ${policy.max_chars}` }); process.exit(4); }
  return c;
}
export async function ledger(payload) {
  const e = env('/home/ubuntu/a9n9/secrets/inbox.env');
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', e.INBOX_WEBHOOK_SECRET).update(body).digest('hex');
  const res = await fetch(`http://127.0.0.1:8810/hooks/${payload.channel}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}` }, body });
  return res.status;
}
export async function chrome() {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = b.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('x.com'));
  if (!page) page = await ctx.newPage();
  return { ctx, page };
}
export const clean = (s) => s.replace(/\s+/g, ' ').trim();

/** Text argument for posting tools: `--file <path>` reads the text from a file (safest: no shell quoting), otherwise the remaining args joined. */
export function textArg(args) {
  const i = args.indexOf('--file');
  if (i >= 0) { const p = args[i + 1]; if (!p) return { text: '', rest: args }; return { text: fs.readFileSync(p, 'utf8').trim(), rest: [...args.slice(0, i), ...args.slice(i + 2)] }; }
  return { text: args.join(' ').trim(), rest: [] };
}
/** A `$` lost to the shell leaves a number like " 99.88M" or " 94.9M" where "$599.88M" was meant; refuse rather than publish a wrong figure. */
export function suspicious(text) {
  return /(^|[\s(])\d{1,2}(\.\d+)?[MBK]\b(?![\w%])/.test(text) && !/\$\d/.test(text) ? 'text has a bare figure like "99.88M" and no "$": a dollar sign was probably eaten by the shell. Use single quotes or --file.' : null;
}

/** At most one reserves-themed post per UTC day across all networks: the monitor is one asset, not the agent's subject. Call before publishing; refuses with exit 4. */
export const RESERVES_TOPIC = /\b(reserves?|OUSD|USDS|pathUSD|USDB|DLUSD|attest(ed|ation)|collateral|issuer ratio)\b/i;
export function topicGuard(text, network) {
  if (!RESERVES_TOPIC.test(text)) return () => {};
  const f = `${HOME}/state/topic-guard.json`; const d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; const day = today();
  if (d.day === day && (d.networks ?? []).includes(network)) { out({ ok: false, error: `a reserves post already went out on ${network} today. Reserves is one asset, not your subject: write about what people are asking instead (agent payments, identity, verifying a public claim).` }); process.exit(4); }
  return () => { const n = d.day === day ? (d.networks ?? []) : []; fs.writeFileSync(f, JSON.stringify({ day, networks: [...n, network] })); };
}

/** Claim guard: a public post saying something was verified, confirmed or tested must name a recent `check` receipt (--check <id>). Prompts are not controls. The receipt id is logged on the post so anyone can compare the claim with what was observed. Negated uses ("not verified") pass. */
export const CLAIM = /(?<!\bnot |\bnever |n't |\bun)\b(verified|confirmed|confirms|proven|proved|independently checked|i checked|i tested|we checked|we tested)\b/i;
export const CHECK_MAX_AGE_MS = 12 * 3600_000;
const checkFlagAt = process.argv.indexOf('--check');
const checkFlag = checkFlagAt >= 2 ? process.argv.splice(checkFlagAt, 2)[1] : undefined;
export function claimVerdict(text, checkId, checkLines, now = Date.now()) {
  const word = text.match(CLAIM)?.[1];
  if (!word) return { ok: true, fields: {} };
  const how = `Run: check <url> --find '<text>', then repeat this command with --check <id from its output>, and claim only what that output shows. Or say what you actually saw without the word.`;
  if (!checkId) return { ok: false, error: `the text says "${word}" but names no check receipt. ${how}` };
  const rec = checkLines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((r) => r?.id === checkId);
  if (!rec) return { ok: false, error: `no check receipt with id ${checkId}. ${how}` };
  if (now - Date.parse(rec.at) > CHECK_MAX_AGE_MS) return { ok: false, error: `check ${checkId} is older than 12 hours. ${how}` };
  return { ok: true, fields: { basedOnCheck: checkId, checkedUrl: rec.url } };
}
export function claimGuard(text) {
  let clearCorrection = () => {};
  // Receipt ids mean nothing to a reader; the flag records them on the post.
  if (/\bagent:check:\d+/.test(text)) { out({ ok: false, error: 'remove the receipt id from the text: readers cannot use it. Pass it as --check <id> and it is recorded on the post.' }); process.exit(2); }
  // An operator-listed overstatement on this network blocks other posts there until a correction goes out.
  const cf = `${HOME}/state/corrections.json`; const net = process.argv[1].split('/').pop().split('-')[0];
  if (fs.existsSync(cf)) { const list = JSON.parse(fs.readFileSync(cf, 'utf8')); const open = list.find((c) => c.network === net); if (open) {
    if (!/^correction\b/i.test(text)) { out({ ok: false, error: `publish a correction first. Your post ${open.post ?? ''} said: "${open.said}". Problem: ${open.problem} Start the text with "Correction:" and say what you actually saw.` }); process.exit(4); }
    clearCorrection = () => fs.writeFileSync(cf, JSON.stringify(list.filter((c) => c !== open), null, 1));
  } }
  const f = `${HOME}/state/checks.jsonl`;
  const lines = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n') : [];
  const v = claimVerdict(text, checkFlag, lines);
  if (!v.ok) { out({ ok: false, error: v.error }); process.exit(2); }
  clearCorrection();
  return v.fields;
}
