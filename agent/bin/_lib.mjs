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
