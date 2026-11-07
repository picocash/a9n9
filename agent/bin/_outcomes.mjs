// Outcomes: what the agent's published items actually produced, from public data and the ledger. Numbers only; no opinions.
// Used by `outcomes` (report) and `experiment` (baseline and result), so both read the same numbers.
import fs from 'node:fs';
import { env, HOME } from './_lib.mjs';
import { judge, nostrProfiles, bskyProfiles } from './_people.mjs';

const ledgerEnv = env('/home/ubuntu/a9n9/secrets/inbox.env');
const H = { authorization: `Bearer ${ledgerEnv.INBOX_API_TOKEN}` };
const BSKY_DID = 'did:plc:spw47s5fjotldww3osv7doiq';
const NOSTR_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const ME = 'agent001';
const ITEM_TYPES = ['bsky.post', 'bsky.reply', 'x.post', 'x.reply', 'nostr.post', 'nostr.reply'];

async function ledgerEvents(since) {
  const r = await fetch(`http://127.0.0.1:8810/v1/events?limit=500&since=${encodeURIComponent(since)}`, { headers: H });
  return (await r.json()).events ?? [];
}
async function payload(ev) {
  const r = await fetch(`http://127.0.0.1:8810/v1/events/${ev.channel}/${encodeURIComponent(ev.id)}`, { headers: H });
  return (await r.json()).payload ?? {};
}
const rkeyOf = (url) => String(url ?? '').split('/').pop();
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

async function bskyMetrics(items) {
  const uris = items.map((i) => { const m = String(i.url).match(/profile\/([^/]+)\/post\/([^/?#]+)/); return m ? `at://${m[1]}/app.bsky.feed.post/${m[2]}` : null; });
  for (let k = 0; k < items.length; k += 25) {
    const batch = uris.slice(k, k + 25).filter(Boolean); if (!batch.length) continue;
    const q = batch.map((u) => `uris=${encodeURIComponent(u)}`).join('&');
    const posts = (await (await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?${q}`)).json()).posts ?? [];
    for (const p of posts) { const it = items[uris.indexOf(p.uri)]; if (it) Object.assign(it, { likes: p.likeCount ?? 0, repliesReceived: p.replyCount ?? 0, reposts: p.repostCount ?? 0, quotes: p.quoteCount ?? 0 }); }
  }
  // Distinct other people who replied (the reply count also includes the agent's own follow-ups).
  for (const [n, it] of items.entries()) {
    if (!it.repliesReceived) { it.people = []; continue; }
    const t = await (await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?depth=1&parentHeight=0&uri=${encodeURIComponent(uris[n])}`)).json();
    const others = (t.thread?.replies ?? []).filter((r) => r.post?.author?.did && r.post.author.did !== BSKY_DID);
    const profs = await bskyProfiles([...new Set(others.map((r) => r.post.author.did))]);
    const real = []; it.filtered = [];
    for (const r of others) { const v = judge({ net: 'bsky', profile: profs.get(r.post.author.did), text: r.post.record?.text ?? '' }); if (v.kind === 'person') real.push(r); else it.filtered.push({ who: r.post.author.handle, ...v }); }
    it.people = [...new Set(real.map((r) => r.post.author.handle))];
    it.repliesReceived = real.length;
  }
}

async function nostrMetrics(items, ownPubkey) {
  const ids = items.map((i) => i.eventId).filter(Boolean); if (!ids.length) return;
  const seen = new Map();
  await Promise.all(NOSTR_RELAYS.map((url) => new Promise((resolve) => {
    let ws; const done = () => { try { ws?.close(); } catch {} resolve(); }; const timer = setTimeout(done, 6000);
    try { ws = new WebSocket(url); } catch { clearTimeout(timer); return resolve(); }
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'o', { kinds: [1, 6, 7, 9735], '#e': ids, limit: 500 }]));
    ws.onmessage = (m) => { try { const d = JSON.parse(m.data); if (d[0] === 'EVENT') seen.set(d[2].id, d[2]); if (d[0] === 'EOSE') { clearTimeout(timer); done(); } } catch {} };
    ws.onerror = () => { clearTimeout(timer); done(); };
  })));
  for (const it of items) Object.assign(it, { likes: 0, repliesReceived: 0, reposts: 0, zaps: 0, people: [], filtered: [] });
  const profs = await nostrProfiles([...new Set([...seen.values()].map((e) => e.pubkey).filter((p) => p !== ownPubkey))]);
  // A pubkey that sent spam once is spam for all its events (a solicitor's like is part of the pitch).
  const spamKeys = new Set([...seen.values()].filter((e) => e.kind === 1 && judge({ net: 'nostr', profile: profs.get(e.pubkey), text: e.content }).kind !== 'person').map((e) => e.pubkey));
  for (const ev of seen.values()) {
    if (ev.pubkey === ownPubkey) continue;
    const v0 = judge({ net: 'nostr', profile: profs.get(ev.pubkey), text: ev.kind === 1 ? ev.content : '' });
    const v = v0.kind === 'person' && spamKeys.has(ev.pubkey) ? { kind: 'spam', why: 'same account sent spam' } : v0;
    if (v.kind !== 'person') { const ref0 = (ev.tags ?? []).filter((t) => t[0] === 'e').map((t) => t[1]).find((id) => ids.includes(id)); items.find((i) => i.eventId === ref0)?.filtered.push({ who: profs.get(ev.pubkey)?.name || ev.pubkey.slice(0, 12), ...v }); continue; }
    const ref = (ev.tags ?? []).filter((t) => t[0] === 'e').map((t) => t[1]).find((id) => ids.includes(id)); const it = items.find((i) => i.eventId === ref); if (!it) continue;
    if (ev.kind === 7) it.likes++; else if (ev.kind === 6) it.reposts++; else if (ev.kind === 9735) it.zaps++; else it.repliesReceived++;
    if (!it.people.includes(ev.pubkey)) it.people.push(ev.pubkey);
  }
}

async function xMetrics(items) {
  const { x, PRICE } = await import('./_x.mjs');
  for (let k = 0; k < items.length; k += 100) {
    const batch = items.slice(k, k + 100); const ids = batch.map((i) => rkeyOf(i.url)).filter((s) => /^\d+$/.test(s)); if (!ids.length) continue;
    const r = await x('GET', '/tweets', { query: { ids: ids.join(','), 'tweet.fields': 'public_metrics' }, price: PRICE.postRead * ids.length, label: 'outcomes tweets' });
    for (const t of r.body?.data ?? []) { const it = batch.find((i) => rkeyOf(i.url) === t.id); const m = t.public_metrics ?? {}; if (it) Object.assign(it, { likes: m.like_count ?? 0, repliesReceived: m.reply_count ?? 0, reposts: m.retweet_count ?? 0, quotes: m.quote_count ?? 0, impressions: m.impression_count ?? null }); }
  }
}

/**
 * Items published in [since, until) and what they produced so far, plus flat `metrics` for experiments.
 * readX: X charges per post read ($0.005 each), so X numbers are fetched only when asked (the daily review).
 */
export async function computeOutcomes({ since, until = new Date().toISOString(), readX = false }) {
  const evs = await ledgerEvents(since);
  const inWindow = (t) => t >= since && t < until;
  const published = readJsonl(`${HOME}/state/published.jsonl`);
  const items = [];
  for (const ev of evs.filter((e) => ITEM_TYPES.includes(e.type) && inWindow(e.receivedAt))) {
    const p = await payload(ev); const [net, kind] = ev.type.split('.');
    const pub = published.find((q) => q.net === net && q.text && p.text && (p.text.startsWith(q.text) || q.text.startsWith(p.text.slice(0, 120))));
    items.push({ net, kind, at: ev.receivedAt, url: p.url ?? (p.eventId ? `https://njump.me/${p.eventId}` : null), eventId: p.eventId ?? null, inReplyTo: p.inReplyTo ?? null, play: pub?.play ?? null, text: String(p.text ?? '').slice(0, 100) });
  }
  const nostrPub = (() => { try { return env('/home/ubuntu/a9n9/secrets/nostr.env').NOSTR_PUBKEY; } catch { return null; } })();
  const by = (n) => items.filter((i) => i.net === n);
  const errors = [];
  await bskyMetrics(by('bsky')).catch((e) => errors.push(`bsky: ${e.message}`));
  await nostrMetrics(by('nostr'), nostrPub).catch((e) => errors.push(`nostr: ${e.message}`));
  if (readX) await xMetrics(by('x')).catch((e) => errors.push(`x: ${e.message}`));

  // "Did this help?" answers, matched to the item whose link carried them (a reply's link names the post it answered).
  let helpedYes = 0, helpedNo = 0;
  for (const ev of evs.filter((e) => e.type === 'receipt.helped' && inWindow(e.receivedAt))) {
    const p = await payload(ev); if (p.helped) helpedYes++; else helpedNo++;
    const ref = String(p.ref ?? ''); const it = items.find((i) => ref.endsWith(rkeyOf(i.inReplyTo)) || ref.endsWith(rkeyOf(i.url)));
    if (it) { it.helpedYes = (it.helpedYes ?? 0) + (p.helped ? 1 : 0); it.helpedNo = (it.helpedNo ?? 0) + (p.helped ? 0 : 1); }
  }
  // Money in the window (income net of refunds is in `runway`; here only what arrived).
  let incomeUsd = 0; for (const ev of evs.filter((e) => e.type === 'money.income' && inWindow(e.receivedAt))) incomeUsd += Number((await payload(ev)).amount_usd ?? 0);
  const xApiUsd = readJsonl(`${HOME}/state/x-api-usage.jsonl`).filter((u) => inWindow(u.at)).reduce((a, u) => a + Number(u.price ?? 0), 0);
  // Agents helping each other (docs/swarm-comms.md): what you asked of other agents and finished for them, and the reverse. A `done`
  // carries a receipt, so an assist given is work another agent could publish; the team outcome is read in the daily review.
  const swarm = { asksSent: 0, asksReceived: 0, assistsGiven: 0, assistsReceived: 0, notes: 0 };
  for (const ev of evs.filter((e) => e.channel === 'swarm' && inWindow(e.receivedAt))) {
    const p = await payload(ev);
    if (ev.type === 'fleet.note') { if (p.kind === 'note' && p.from === ME) swarm.notes++; continue; }
    if (p.from === ME && p.kind === 'ask') swarm.asksSent++; if (p.to === ME && p.kind === 'ask') swarm.asksReceived++;
    if (p.from === ME && p.kind === 'done') swarm.assistsGiven++; if (p.to === ME && p.kind === 'done') swarm.assistsReceived++;
  }

  // Engagement of one item: what other people did with it. Only accounts `_people.mjs` judges a person count; bots, spam,
  // solicitors and brand-new accounts land in `item.filtered` and `filtered.<net>` instead (Bluesky likes are counts only, not filtered). A reply or "it helped" is worth more than a like.
  const engagement = (i) => (i.repliesReceived ?? 0) * 3 + (i.quotes ?? 0) * 3 + (i.reposts ?? 0) * 2 + (i.likes ?? 0) + (i.zaps ?? 0) * 3 + (i.helpedYes ?? 0) * 5;
  for (const i of items) i.engagement = engagement(i);
  const metrics = {};
  const add = (k, v) => { metrics[k] = +((metrics[k] ?? 0) + v).toFixed(4); };
  for (const i of items) {
    const measured = i.net !== 'x' || readX;
    add(`items.${i.net}`, 1); add(`items.${i.net}.${i.kind}`, 1);
    if (!measured) continue;
    add(`filtered.${i.net}`, (i.filtered ?? []).length);
    add(`engagement.${i.net}`, i.engagement); add(`repliesReceived.${i.net}`, i.repliesReceived ?? 0); add(`likes.${i.net}`, i.likes ?? 0);
    add('engagement', i.engagement); add('measuredItems', 1); add('repliesReceived', i.repliesReceived ?? 0);
    if (i.play) { add(`items.play.${i.play}`, 1); add(`engagement.play.${i.play}`, i.engagement); }
  }
  for (const n of ['bsky', 'x', 'nostr']) if (metrics[`items.${n}`] && metrics[`engagement.${n}`] !== undefined) metrics[`engagementPerItem.${n}`] = +(metrics[`engagement.${n}`] / metrics[`items.${n}`]).toFixed(3);
  for (const k of Object.keys(metrics)) { const m = k.match(/^items\.play\.(.+)$/); if (m) metrics[`engagementPerItem.play.${m[1]}`] = +((metrics[`engagement.play.${m[1]}`] ?? 0) / metrics[k]).toFixed(3); }
  metrics.engagementPerItem = metrics.measuredItems ? +(metrics.engagement / metrics.measuredItems).toFixed(3) : 0;
  metrics.people = new Set(items.flatMap((i) => i.people ?? [])).size;
  metrics.helpedYes = helpedYes; metrics.helpedNo = helpedNo; metrics.incomeUsd = +incomeUsd.toFixed(2); metrics.xApiUsd = +xApiUsd.toFixed(3);
  for (const [k, v] of Object.entries(swarm)) metrics[`swarm.${k}`] = v;
  return { since, until, readX, items, metrics, errors };
}

export const METRIC_HELP = 'engagement (people only: bots, spam, solicitors and new accounts are excluded and counted in filtered.<net>) = 3×replies from others + 3×quotes + 2×reposts + likes + 3×zaps + 5×"it helped". Useful keys: engagementPerItem, engagementPerItem.bsky, engagementPerItem.play.<play>, people, repliesReceived, helpedYes, incomeUsd, swarm.assistsGiven (work you finished for another agent, with a receipt), swarm.asksSent.';
