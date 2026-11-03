#!/usr/bin/env node
// settle [--dry-run] — host cron. Turns Stripe income in the ledger into settlement records and, after the hold, agent credit releases.
// Runs outside the sandbox: it holds the Stripe key and the full ledger key; the agent has neither.
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
import { plan } from './settle-plan.mjs';
const S = '/home/ubuntu/a9n9/secrets'; const kv = (f) => Object.fromEntries(fs.readFileSync(`${S}/${f}`, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const inbox = kv('inbox.env'); const stripe = kv('stripe-admin.env'); const I = 'http://127.0.0.1:8810'; const h = { authorization: `Bearer ${inbox.INBOX_API_TOKEN}` };
const idx = (await (await fetch(`${I}/v1/events?limit=5000&type=money.&since=2026-11-01T00:00:00Z`, { headers: h })).json()).events;
const events = []; for (const e of idx) if (/^money\.(income|refund|dispute|settlement|release|credit-cancel)$/.test(e.type)) { const r = await (await fetch(`${I}/v1/events/${e.channel}/${encodeURIComponent(e.id)}`, { headers: h })).json(); events.push({ ...r.payload, id: e.id, type: e.type }); }
const feeOf = async (pi) => {
  const r = await fetch(`https://api.stripe.com/v1/payment_intents/${pi}?expand[]=latest_charge.balance_transaction`, { headers: { authorization: `Bearer ${stripe.STRIPE_API_KEY}` } }); const j = await r.json();
  const fee = j.latest_charge?.balance_transaction?.fee; if (!r.ok || typeof fee !== 'number') throw new Error(`no fee for ${pi}: HTTP ${r.status}`); return fee;
};
const todo = await plan(events, feeOf); const dry = process.argv.includes('--dry-run');
for (const ev of todo) {
  if (dry) { console.log('would write', JSON.stringify(ev)); continue; }
  const body = JSON.stringify(ev); const res = await fetch(`${I}/hooks/${ev.channel}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${createHmac('sha256', inbox.INBOX_WEBHOOK_SECRET).update(body).digest('hex')}` }, body });
  if (res.status >= 300) throw new Error(`ledger refused ${ev.id}: ${res.status}`);
  console.log('wrote', ev.id);
}
console.log(JSON.stringify({ ok: true, incomeEvents: events.filter((e) => e.type === 'money.income').length, newEvents: todo.length, dry }));
