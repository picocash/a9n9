#!/usr/bin/env node
// jobs-invoice [--dry-run] — host cron, every 10 minutes. The operator's half of "deliver first, invoice after":
//   - a delivered work-first job gets its own Stripe Payment Link (a Stripe invoice needs a customer email, and most people
//     write from Bluesky or Nostr); the link is written into state/jobs.json for the agent to send and is due in 7 days;
//   - a job is marked paid when a Checkout Session on that link is paid; the Stripe webhook already records money.income
//     for it (metadata carries offer and job), so settle.mjs splits it like any card payment; if the webhook missed it, the
//     event is written here in the same shape;
//   - a pay-first job the agent marked paid is checked against the ledger (the agent's word alone does not count);
//   - a link 30 days past due is switched off and the job marked unpaid.
// Runs outside the sandbox and holds the Stripe key and the ledger tokens; the agent has neither. Idempotent: every Stripe
// write carries an Idempotency-Key derived from the job id, and every ledger id is stable.
import fs from 'node:fs';
import { createHmac } from 'node:crypto';
const HOME = '/home/ubuntu/a9n9/agent001'; const F = `${HOME}/state/jobs.json`; const S = '/home/ubuntu/a9n9/secrets';
const kv = (f) => Object.fromEntries(fs.readFileSync(`${S}/${f}`, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const stripeKey = kv('stripe-admin.env').STRIPE_API_KEY; const inbox = kv('inbox.env'); const I = 'http://127.0.0.1:8810';
const PRICES = { 'fact-check': { price: 'price_1UYGi75Ap3pbykHOnaK1feFD', name: 'Fact-check my draft' } };
const dry = process.argv.includes('--dry-run'); const now = new Date(); const at = now.toISOString();
const UNPAID_AFTER_DAYS = 30;

async function stripe(method, path, params, idem) {
  const headers = { authorization: `Bearer ${stripeKey}` };
  if (params) headers['content-type'] = 'application/x-www-form-urlencoded';
  if (idem) headers['idempotency-key'] = idem;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers, body: params ? new URLSearchParams(params) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(`stripe ${method} ${path}: HTTP ${r.status} ${j.error?.message ?? ''}`); return j;
}
async function ledgerWrite(ev) {
  const body = JSON.stringify(ev);
  const res = await fetch(`${I}/hooks/${ev.channel}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${createHmac('sha256', inbox.INBOX_WEBHOOK_SECRET).update(body).digest('hex')}` }, body });
  if (res.status >= 300) throw new Error(`ledger refused ${ev.id}: ${res.status}`);
}
async function ledgerHas(channel, id) {
  const r = await fetch(`${I}/v1/events/${channel}/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${inbox.INBOX_API_TOKEN}` } });
  if (r.status === 404) return null; if (!r.ok) throw new Error(`ledger read ${id}: ${r.status}`); return (await r.json()).payload ?? null;
}

if (!fs.existsSync(F)) { console.log(JSON.stringify({ ok: true, note: 'no jobs file yet', dry })); process.exit(0); }
const d = JSON.parse(fs.readFileSync(F, 'utf8')); const done = []; let changed = false;
const note = (job, text) => { (job.hostNotes ??= []).push({ at, text }); changed = true; };

for (const job of d.jobs) {
  try {
    if (job.status === 'delivered' && job.terms === 'invoice-after' && !job.invoiceId) {
      const offer = PRICES[job.offer]; if (!offer) { note(job, `no price for offer ${job.offer}`); continue; }
      if (dry) { done.push({ job: job.id, would: 'create payment link' }); continue; }
      const desc = `${offer.name} by agent001, job ${job.id}, delivered ${String(job.deliveredAt).slice(0, 10)}. Work first, pay after: if it was not worth it, do not pay.`;
      const pl = await stripe('POST', 'payment_links', { 'line_items[0][price]': offer.price, 'line_items[0][quantity]': '1', 'metadata[job]': job.id, 'metadata[offer]': job.offer, 'metadata[agent]': 'agent001', 'metadata[terms]': 'invoice-after', 'payment_intent_data[description]': desc.slice(0, 1000), 'payment_intent_data[metadata][job]': job.id, 'payment_intent_data[metadata][offer]': job.offer, 'after_completion[type]': 'hosted_confirmation', 'after_completion[hosted_confirmation][custom_message]': 'Thank you. agent001 records this payment in its public ledger within the hour.' }, `job-${job.id}-link`);
      Object.assign(job, { invoiceId: pl.id, invoiceUrl: pl.url, invoiceDue: new Date(now.getTime() + 7 * 86_400_000).toISOString(), invoicedAt: at, status: 'invoiced' });
      changed = true; done.push({ job: job.id, link: pl.id });
    } else if ((job.status === 'invoiced' || job.status === 'sent') && job.invoiceId) {
      const sessions = (await stripe('GET', `checkout/sessions?payment_link=${job.invoiceId}&limit=10`)).data ?? [];
      const paid = sessions.find((s) => s.payment_status === 'paid');
      if (paid) {
        if (!dry) {
          const id = `stripe:income:${paid.id}`;
          if (!(await ledgerHas('stripe', id))) await ledgerWrite({ id, type: 'money.income', channel: 'stripe', rail: 'stripe', livemode: paid.livemode === true, at, amount_usd: String(paid.currency).toLowerCase() === 'usd' ? paid.amount_total / 100 : null, amount_minor: paid.amount_total, currency: paid.currency, payment_intent: paid.payment_intent, payment_link: job.invoiceId, offer: job.offer, job: job.id, terms: job.terms, payer: `invoice:${job.channel}` });
          Object.assign(job, { status: 'paid', paidAt: at, paidRef: id, verifiedPaid: true }); changed = true;
        }
        done.push({ job: job.id, paid: paid.id, dry });
      } else if (job.invoiceDue && now.getTime() - Date.parse(job.invoiceDue) > UNPAID_AFTER_DAYS * 86_400_000) {
        if (!dry) { await stripe('POST', `payment_links/${job.invoiceId}`, { active: 'false' }, `job-${job.id}-off`); Object.assign(job, { status: 'unpaid', unpaidAt: at, unpaidWhy: `${UNPAID_AFTER_DAYS} days past due; link switched off` }); changed = true; }
        done.push({ job: job.id, unpaid: 'past due', dry });
      }
    } else if (job.status === 'paid' && job.terms === 'pay-first' && job.paidRef && !job.verifiedPaid) {
      const p = await ledgerHas('stripe', job.paidRef);
      if (p && p.type === 'money.income') { if (!dry) { job.verifiedPaid = true; changed = true; } done.push({ job: job.id, verified: job.paidRef, dry }); }
      else { if (!dry) { Object.assign(job, { status: 'delivered', paidAt: undefined, paidRef: undefined, verifiedPaid: undefined }); note(job, `payment ${job.paidRef ?? ''} not found in the ledger; back to delivered`); } done.push({ job: job.id, rejectedPaid: true, dry }); }
    }
  } catch (e) { note(job, `host error: ${e.message}`); done.push({ job: job.id, error: e.message }); }
}
if (changed && !dry) fs.writeFileSync(F, JSON.stringify(d, null, 1));
console.log(JSON.stringify({ ok: true, at, actions: done, dry }));
