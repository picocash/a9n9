#!/usr/bin/env node
// rules-feed-send.mjs — operator-side weekly sender for the stablecoin rules feed.
// Reads the digest the agent wrote (state/rules-feed/latest.md), lists active Stripe subscribers of the feed price,
// and emails each one through the a9n9 mail Worker with the CAN-SPAM footer. The agent never sees the Stripe key
// or the subscriber list; this runs from the host cron (Fridays 10:00 ET) and is idempotent per digest hash.
//
// Env (host only): STRIPE_API_KEY from ~/a9n9/secrets/stripe-admin.env; EMAIL_API_TOKEN from ~/a9n9/secrets/email.env;
// the Worker URL from ~/a9n9/secrets/email-worker.url. Flags: --dry-run (print, send nothing), --to <email> (one test recipient).
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const HOME = '/home/ubuntu/a9n9/agent001';
const FEED_PRICE = process.env.RULES_FEED_PRICE ?? 'price_1UYGi75Ap3pbykHObuNNa0qY';
const DIGEST = `${HOME}/state/rules-feed/latest.md`;
const SENT = `${HOME}/state/rules-feed/sent.json`;
const SUPPRESS = `${HOME}/state/rules-feed/unsubscribed.json`;
const argv = process.argv.slice(2); const dry = argv.includes('--dry-run'); const only = argv.includes('--to') ? argv[argv.indexOf('--to') + 1] : null;

const envFile = (p) => Object.fromEntries(fs.readFileSync(p, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const stripeKey = envFile('/home/ubuntu/a9n9/secrets/stripe-admin.env').STRIPE_API_KEY;
const mail = envFile('/home/ubuntu/a9n9/secrets/email.env'); const workerUrl = fs.readFileSync('/home/ubuntu/a9n9/secrets/email-worker.url', 'utf8').trim();

if (!fs.existsSync(DIGEST)) { console.log('no digest at', DIGEST); process.exit(0); }
const body = fs.readFileSync(DIGEST, 'utf8').trim();
const hash = createHash('sha256').update(body).digest('hex');
const sent = fs.existsSync(SENT) ? JSON.parse(fs.readFileSync(SENT, 'utf8')) : {};
if (sent[hash] && !only) { console.log('digest already sent', hash.slice(0, 12), sent[hash].at); process.exit(0); }
const suppressed = new Set((fs.existsSync(SUPPRESS) ? JSON.parse(fs.readFileSync(SUPPRESS, 'utf8')) : []).map((e) => String(e).toLowerCase()));

async function subscribers() {
  const out = new Set(); let starting_after;
  for (;;) {
    const u = new URL('https://api.stripe.com/v1/subscriptions'); u.searchParams.set('price', FEED_PRICE); u.searchParams.set('status', 'active'); u.searchParams.set('limit', '100'); u.searchParams.append('expand[]', 'data.customer');
    if (starting_after) u.searchParams.set('starting_after', starting_after);
    const r = await fetch(u, { headers: { authorization: `Bearer ${stripeKey}` } }); const j = await r.json();
    if (!r.ok) throw new Error(`stripe ${r.status}: ${j.error?.message}`);
    for (const s of j.data) { const em = s.customer?.email; if (em && !suppressed.has(em.toLowerCase())) out.add(em); starting_after = s.id; }
    if (!j.has_more) break;
  }
  return [...out];
}

const title = (body.match(/^#\s+(.+)$/m) ?? [, 'Stablecoin rules, this week'])[1].trim();
const footer = `\n\n—\nYou receive this because you subscribed to the stablecoin rules feed from agent001, an autonomous software agent run by a9n9, a Visybl Inc service (not a person). Every item links to its primary source; the hash is SHA-256 of what the agent read. This issue's hash: ${hash}.\nTo stop: reply STOP and the subscription is cancelled within one business day, or write to agent001@a9n9.net.\nVisybl Inc, 5100 Buckeystown Pike, Suite 250, Frederick, MD 21704, USA.`;
const text = `${body}${footer}`;

const to = only ? [only] : await subscribers();
console.log(`digest ${hash.slice(0, 12)} "${title}" → ${to.length} recipient(s)${dry ? ' [dry run]' : ''}`);
let ok = 0; const failures = [];
for (const addr of to) {
  if (dry) { console.log(' would send to', addr); continue; }
  const r = await fetch(`${workerUrl}/v1/send`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${mail.EMAIL_API_TOKEN}` }, body: JSON.stringify({ from: 'agent001@a9n9.net', to: addr, subject: title, text }) });
  if (r.ok) ok++; else failures.push({ addr, status: r.status, body: (await r.text()).slice(0, 200) });
}
if (!dry && !only) { sent[hash] = { at: new Date().toISOString(), title, recipients: to.length, ok }; fs.writeFileSync(SENT, JSON.stringify(sent, null, 1)); }
console.log(JSON.stringify({ ok, failures }, null, 1));
process.exit(failures.length && !ok ? 1 : 0);
