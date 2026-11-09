// kpi collect (agent001): host side of agent001's KPI receipts (crontab, hourly). Reads sources the agent does not control and
// records what it read as typed facts in ~/a9n9/agent001/kpi/facts.jsonl (read-only to the agent at /agent/kpi), each naming
// the saved API response (kpi/raw/<sha256>.json) it came from, each line carrying the hash of the line before it.
// Sources and how far each can be trusted:
//   bsky    public Bluesky AppView (no login): followers, posts, and likes/replies/reposts/quotes on the last 100 posts
//   stripe  Stripe API with the operator's key: succeeded, unrefunded charges from payers not on the owner list
//   email   inbound mail in the inbox ledger with DKIM pass and a stored .eml: distinct senders that look human, and how many
//           of them the agent wrote back to. The ledger accepts agent-signed events, so these carry trust "ledger".
//   helped  "Did this help?" answers in the inbox ledger (trust "ledger")
import fs from 'node:fs';
import crypto from 'node:crypto';
const ROOT = process.env.AGENT_ROOT || '/home/ubuntu/a9n9/agent001';
const SECRETS = '/home/ubuntu/a9n9/secrets';
const K = `${ROOT}/kpi`, FACTS = `${K}/facts.jsonl`, RAW = `${K}/raw`;
fs.mkdirSync(RAW, { recursive: true });
const env = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let prev = 'genesis';
if (fs.existsSync(FACTS)) { const t = fs.readFileSync(FACTS, 'utf8').trimEnd(); if (t) prev = sha(t.slice(t.lastIndexOf('\n') + 1)); }
const lines = []; const add = (o) => { const line = JSON.stringify({ ...o, prev }); lines.push(line); prev = sha(line); };
const owners = fs.existsSync(`${ROOT}/../kpi-owner-addresses.txt`) ? fs.readFileSync(`${ROOT}/../kpi-owner-addresses.txt`, 'utf8').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
const at = new Date().toISOString(); const run = sha(at).slice(0, 12);
async function get(source, url, headers = {}) {
  const r = await fetch(url, { headers }); const body = await r.text(); if (!r.ok) throw new Error(`${source} ${r.status}`);
  const h = sha(body); if (!fs.existsSync(`${RAW}/${h}.json`)) fs.writeFileSync(`${RAW}/${h}.json`, body);
  add({ t: 'receipt', at, run, source, url: url.replace(/^https?:\/\/[^/]+/, '').split('?')[0], receipt: h }); return { receipt: h, json: JSON.parse(body) };
}
const fact = (receipt, metric, value, kind, trust, subject = 'agent001') => add({ t: 'fact', at, run, metric, subject, value, kind, trust, receipt });
const gap = (source, e) => add({ t: 'gap', at, run, source, reason: e.message });
// Bluesky
try {
  const did = env(`${SECRETS}/bluesky.env`).BSKY_DID; const B = 'https://public.api.bsky.app/xrpc';
  const p = await get('bsky', `${B}/app.bsky.actor.getProfile?actor=${did}`);
  fact(p.receipt, 'bsky.followers', p.json.followersCount, 'cumulative', 'independent'); fact(p.receipt, 'bsky.posts', p.json.postsCount, 'cumulative', 'independent');
  const f = await get('bsky', `${B}/app.bsky.feed.getAuthorFeed?actor=${did}&limit=100&filter=posts_with_replies`);
  const own = f.json.feed.filter((x) => x.post.author.did === did && !x.reason);
  const sum = (k) => own.reduce((n, x) => n + (x.post[k] ?? 0), 0);
  for (const [k, m] of [['likeCount', 'likes'], ['replyCount', 'replies'], ['repostCount', 'reposts'], ['quoteCount', 'quotes']]) fact(f.receipt, `bsky.${m}.last100`, sum(k), 'window-last100', 'independent');
} catch (e) { gap('bsky', e); }
// Stripe
try {
  const key = env(`${SECRETS}/stripe-admin.env`).STRIPE_API_KEY;
  const c = await get('stripe', 'https://api.stripe.com/v1/charges?limit=100', { authorization: `Bearer ${key}` });
  const paid = c.json.data.filter((x) => x.status === 'succeeded' && !x.refunded && x.currency === 'usd' && !owners.some((o) => (x.billing_details?.email ?? x.receipt_email ?? '').toLowerCase().endsWith(o)));
  fact(c.receipt, 'stripe.payments', paid.length, 'cumulative', 'independent'); fact(c.receipt, 'stripe.paidUsd', +(paid.reduce((n, x) => n + x.amount - (x.amount_refunded ?? 0), 0) / 100).toFixed(2), 'cumulative', 'independent');
  fact(c.receipt, 'stripe.payments10', paid.filter((x) => x.amount >= 1000).length, 'cumulative', 'independent');
} catch (e) { gap('stripe', e); }
// inbox ledger: email and helped receipts
try {
  const T = env(`${SECRETS}/inbox.env`).INBOX_API_TOKEN; const H = { authorization: `Bearer ${T}` };
  const cacheF = `${K}/.email-cache.json`; const cache = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, 'utf8')) : { seen: {}, senders: {}, inbound: {}, wroteTo: {} };
  const BULK = /^(no-?reply|noreply|do-?not-?reply|notifications?|news(letter)?|marketing|hello|team|info|support|billing|welcome|affiliates?|mailer|bounce|updates?|alerts?|accounts?|security|verify|service)([+.-]|@)/i;
  for (const type of ['email.received', 'email.sent', 'receipt.helped']) {
    const l = await get('ledger', `http://127.0.0.1:8810/v1/events?limit=500&type=${type}`, H);
    for (const ev of l.json.events) {
      if (cache.seen[ev.id]) continue;
      const d = await (await fetch(`http://127.0.0.1:8810/v1/events/${ev.channel}/${encodeURIComponent(ev.id)}`, { headers: H })).json(); const p = d.payload ?? d;
      if (type === 'email.received') { const to = (p.to ?? []).map((x) => (x.address ?? '').toLowerCase()); const from = (p.from?.address ?? '').toLowerCase();
        const real = to.includes('agent001@a9n9.net') && p.auth?.dkim === 'pass' && p.r2Key && from && !owners.some((o) => from.endsWith(o));
        if (real) { cache.inbound = cache.inbound ?? {}; cache.inbound[from] = cache.inbound[from] ?? ev.receivedAt; if (!BULK.test(from)) cache.senders[from] = cache.senders[from] ?? ev.receivedAt; } }
      if (type === 'email.sent') { const to = String(p.to ?? '').toLowerCase(); if (to) cache.wroteTo[to] = cache.wroteTo[to] ?? ev.receivedAt; }
      if (type === 'receipt.helped') { cache.helped = cache.helped ?? { yes: 0, no: 0 }; cache.helped[p.helped ? 'yes' : 'no']++; }
      cache.seen[ev.id] = 1;
    }
  }
  fs.writeFileSync(cacheF, JSON.stringify(cache));
  const h = sha(JSON.stringify({ senders: cache.senders, inbound: cache.inbound, wroteTo: cache.wroteTo, helped: cache.helped ?? null })); fs.writeFileSync(`${RAW}/${h}.json`, JSON.stringify({ senders: cache.senders, inbound: cache.inbound, wroteTo: cache.wroteTo, helped: cache.helped ?? null }));
  add({ t: 'receipt', at, run, source: 'ledger', url: 'derived: email senders and replies, helped answers', receipt: h });
  const humans = Object.keys(cache.senders);
  fact(h, 'email.correspondents', humans.length, 'cumulative', 'ledger'); fact(h, 'email.peopleAnswered', Object.keys(cache.inbound ?? {}).filter((s) => cache.wroteTo[s]).length, 'cumulative', 'ledger');
  fact(h, 'email.senderDomains', new Set(humans.map((s) => s.split('@')[1])).size, 'cumulative', 'ledger');
  fact(h, 'helped.yes', cache.helped?.yes ?? 0, 'cumulative', 'ledger');
} catch (e) { gap('ledger', e); }
add({ t: 'run', at, run, facts: lines.filter((l) => l.includes('"t":"fact"')).length });
fs.appendFileSync(FACTS, lines.join('\n') + '\n');
