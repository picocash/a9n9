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
// Pacing: a day's budget is spread over the UTC day instead of being spent in the first hours (with 30-minute runs the
// 4 Bluesky posts were all gone by 02:35Z, leaving nothing for the US daytime). `head` is how many may go at any time
// of day; the rest unlock evenly: allowed = head + floor((max-head) * minuteOfDay / 1440).
// Replies and DMs are answers to people (mentions arrive at any hour) and are never paced: only the hard cap applies.
const PACE_HEAD = { bskyReplies: Infinity, replies: Infinity, nostrDm: Infinity };
export function paceAllowed(kind, max, minuteOfDay) { const head = Math.min(max, PACE_HEAD[kind] ?? 1); return Math.min(max, head + Math.floor((max - head) * minuteOfDay / 1440)); }
export function paceNextSlot(kind, max, used) { const head = Math.min(max, PACE_HEAD[kind] ?? 1); if (used < head || max === head) return 0; return Math.ceil((used - head + 1) * 1440 / (max - head)); }
// Experiments hold a slot. While an open experiment names a play (metric engagementPerItem.play.<play>) and that play has not
// been published today on this network, one of the day's posts is held back for it; a post tagged with that play also skips
// pacing (it is at most one a day). Reason: 30-minute explore runs spent all 4 Bluesky posts before the daily digest and
// factcheck experiments could run (daily review 2026-11-06).
const NET_OF = { bsky: 'bsky', nostr: 'nostr', posts: 'x' };
const TOOL_OF = { bsky: 'bsky-post', nostr: 'nostr-post', posts: 'x-post' };
export function reservePlan({ kind, exps, published, now }) {
  const net = NET_OF[kind]; if (!net || !Array.isArray(exps)) return { plays: [], pending: [], reserved: 0 };
  const iso = now.toISOString(); const day = iso.slice(0, 10);
  const doneToday = new Set(published.filter((r) => r && r.net === net && String(r.at).slice(0, 10) === day && r.play).map((r) => r.play));
  const plays = [];
  for (const e of exps) {
    if (!e || (e.endsAt && e.endsAt < iso) || (e.startedAt && e.startedAt > iso)) continue;
    const m = /^engagementPerItem\.play\.([a-z0-9-]+)$/.exec(e.metric ?? ''); if (!m) continue;
    const text = String(e.change ?? ''); const nets = [];
    if (/bluesky|bsky/i.test(text)) nets.push('bsky'); if (/nostr/i.test(text)) nets.push('nostr'); if (/\bX\b|twitter/.test(text)) nets.push('x');
    if (!nets.length) nets.push('bsky');
    if (nets.includes(net) && !plays.includes(m[1])) plays.push(m[1]);
  }
  const pending = plays.filter((p) => !doneToday.has(p));
  return { plays, pending, reserved: pending.length };
}
export function experimentPlays(kind, now = new Date()) {
  const rd = (f, fb) => { try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fb; } catch { return fb; } };
  const exps = rd(`${HOME}/state/experiments.json`, []);
  const pf = `${HOME}/state/published.jsonl`;
  const published = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }) : [];
  return reservePlan({ kind, exps, published, now });
}
// Work first, then invoice (Arun, 2026-11-06): until the agent has WORK_FIRST_PAID paid jobs on record, a job is delivered
// before any payment and a Stripe invoice (net 7) follows, one such job per person and channel; after that, card first.
// The tool decides the terms; the agent only repeats them. The operator's host script creates the invoice.
export const WORK_FIRST_PAID = 10;
export function jobTerms({ jobs, person, channel }) {
  const paid = jobs.filter((j) => j.status === 'paid').length;
  const left = Math.max(0, WORK_FIRST_PAID - paid);
  if (!left) return { terms: 'pay-first', paid, left, reason: `${paid} paid jobs on record: card first` };
  const prior = jobs.find((j) => j.terms === 'invoice-after' && j.person === person && j.channel === channel);
  if (prior) return { terms: 'pay-first', paid, left, reason: `${person} already had a work-first job (${prior.id}, ${prior.status}): card first` };
  return { terms: 'invoice-after', paid, left, reason: `${paid} of ${WORK_FIRST_PAID} paid jobs so far: deliver first, the invoice follows` };
}
// Tickets: a conversation nobody has touched for 3 days is closed as "no reply" by the tool itself (the daily review kept
// asking the agent to close them and it never did); after 24 hours the listing says "note or close today".
export const TICKET_NUDGE_H = 24, TICKET_STALE_H = 72;
// Idle time counts from the last exchange with the person (ticket opened, or a note carrying --ref for a message sent or
// received), never from the agent's own notes: a "will close in 24 h" note must not reset the clock.
export function ticketStatus(t, now = new Date()) {
  const idleHours = Math.round((now.getTime() - Date.parse(t.exchanged || t.opened)) / 36e5);
  return { idleHours, stale: idleHours > TICKET_STALE_H, nudge: idleHours > TICKET_NUDGE_H };
}
export function enforce(kind, max, text) {
  if (paused()) { out({ ok: false, error: 'agent is PAUSED by the operator; do nothing further' }); process.exit(3); }
  const c = counter(kind);
  if (c.get() >= max) { out({ ok: false, error: `${kind} cap reached (${max}/day); try tomorrow` }); process.exit(4); }
  const now = new Date(); const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const ex = experimentPlays(kind, now); const isExperiment = playFlag !== undefined && ex.pending.includes(playFlag);
  if (!isExperiment && ex.reserved && c.get() + ex.reserved >= max) {
    out({ ok: false, error: `${kind}: ${c.get()} of ${max} used today and ${ex.reserved} slot(s) are held for the open experiment play(s) ${ex.pending.join(', ')}, not yet published on this network today. Publish those first (--play ${ex.pending[0]}), or journal this item for tomorrow.`, reservedFor: ex.pending });
    process.exit(4);
  }
  if (!isExperiment && c.get() >= paceAllowed(kind, max, minute)) {
    const slot = paceNextSlot(kind, max, c.get()); const hh = String(Math.floor(slot / 60)).padStart(2, '0'), mm = String(slot % 60).padStart(2, '0');
    out({ ok: false, error: `${kind} is paced: ${c.get()} of ${max} used by ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC; the day's budget is spread over 24 hours so people in other time zones see you too. The next slot opens at ${hh}:${mm} UTC (in ${slot - minute} min). Journal what you wanted to publish and post it in a later run; use the time on checks and reading.${ex.pending.length ? ` Exception: the open experiment play(s) ${ex.pending.join(', ')} are still owed on ${NET_OF[kind]} today and are not paced here. Run bin/${TOOL_OF[kind]} --play ${ex.pending[0]} '<text>' now, on this network, not another one.` : ''}`, nextSlotUtc: `${hh}:${mm}`, ...(ex.pending.length ? { unpacedPlays: ex.pending } : {}) });
    process.exit(4);
  }
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
  const text = args.join(' ').trim();
  // A flag such as --help or -h is a question to the tool, never post text: treat it as missing text so the tool prints its usage.
  if (/^-{1,2}[a-z]/i.test(text)) return { text: '', rest: args };
  return { text, rest: [] };
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

/** Affiliate guard (FTC rules + program terms). An affiliate link may go out only for an approved program in affiliates.json,
 * with the words "affiliate link" within 120 characters of it, never with an offer to pass the commission back to the buyer
 * (most programs ban rebates), and at most policy.affiliate_posts_per_day (default 2) per UTC day across all networks.
 * affiliateProblem is pure (tested); affiliateGuard exits 2/4 on a problem and counts the post only when it really went out. */
export const AFFILIATE_PATTERN = /[?&](ref|via|aff|affiliate|fpr|tap_a|partner|referral|refcode|utm_source=affiliate)=|\b(try\.elevenlabs\.io|firecrawl\.link|partnerstack\.com|tapfiliate\.com|firstpromoter\.com|awin1\.com|shareasale\.com|amzn\.to|hasoffers\.com|go2cloud\.org)\b/i;
export const REBATE = /\b(cash ?back|rebates?|kickback|refund (you|your)|(pay|give|send) you (back|the commission|my cut|our cut|the cut)|split (the|my|our) (commission|cut)|share (the|my|our) commission)\b/i;
const normUrl = (u) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[.,;:!?)\]]+$/, '').replace(/([?&])utm_[a-z]+=[^&]*/gi, '$1').replace(/[?&]+$/, '').replace(/\?&+/, '?').replace(/\/(\?|$)/, '$1').toLowerCase();
export function affiliatePrograms() { try { return JSON.parse(fs.readFileSync(`${HOME}/affiliates.json`, 'utf8')).programs ?? {}; } catch { return {}; } }
export function affiliateProblem(text, programs, usedToday = 0, cap = 2) {
  const approved = Object.entries(programs).map(([id, p]) => [id, normUrl(p.link)]);
  const found = [];
  for (const m of text.matchAll(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s"'<>]*)?/gi)) {
    const raw = m[0]; if (!raw.includes('/') && !raw.includes('?') && !approved.some(([, a]) => a === normUrl(raw))) continue;
    const n = normUrl(raw); const hit = approved.find(([, a]) => n === a || n.startsWith(a + '/') || n.startsWith(a + '&') || (a.includes('?') && n.startsWith(a)));
    if (hit) found.push({ id: hit[0], at: m.index, len: raw.length });
    else if (AFFILIATE_PATTERN.test(raw)) return { code: 2, error: `"${raw}" looks like an affiliate or referral link that is not in your approved list. Only links from bin/affiliate may be posted. Nothing was published.` };
  }
  if (!found.length) return null;
  if (REBATE.test(text)) return { code: 2, error: 'the text offers to pass a commission or cash back to the buyer. The programs forbid rebates. Recommend the product on its merits and mention only the discount the program itself gives (bin/affiliate shows it). Nothing was published.' };
  for (const f of found) { const win = text.slice(Math.max(0, f.at - 120), f.at + f.len + 120);
    if (!/\baffiliate link\b/i.test(win)) return { code: 2, error: `the ${f.id} link has no disclosure next to it. Write "affiliate link" right beside it, e.g. "(affiliate link: a9n9 earns a commission if you buy)". A profile note is not enough. Nothing was published.` }; }
  if (usedToday >= cap) return { code: 4, error: `affiliate links are capped at ${cap} posts a day across all networks and ${usedToday} went out today. Post useful work without a link, or journal this for tomorrow.` };
  return { programs: [...new Set(found.map((f) => f.id))] };
}
export function affiliateGuard(text) {
  const c = counter('affiliate'); const cap = policy.affiliate_posts_per_day ?? 2;
  const r = affiliateProblem(text, affiliatePrograms(), c.get(), cap);
  if (!r) return null;
  if (r.error) { out({ ok: false, error: r.error }); process.exit(r.code); }
  process.on('exit', (code) => { if (code === 0) { counter('affiliate').bump(); fs.appendFileSync(`${HOME}/state/affiliate-posts.jsonl`, JSON.stringify({ at: new Date().toISOString(), tool: process.argv[1].split('/').pop(), programs: r.programs, text: text.slice(0, 300) }) + '\n'); } });
  return r.programs;
}

/** Claim guard: a public post saying something was verified, confirmed or tested must name a recent `check` receipt (--check <id>). Prompts are not controls. The receipt id is logged on the post so anyone can compare the claim with what was observed. Negated uses ("not verified") pass. */
export const CLAIM = /(?<!\bnot |\bnever |n't |\bun)\b(verified|confirmed|confirms|proven|proved|independently checked|i checked|i tested|we checked|we tested)\b/i;
export const CHECK_MAX_AGE_MS = 12 * 3600_000;
const checkFlagAt = process.argv.indexOf('--check');
const checkFlag = checkFlagAt >= 2 ? process.argv.splice(checkFlagAt, 2)[1] : undefined;
// --play <name>: which way of creating value this item tries (e.g. answer, digest, finding, tutorial). Recorded with the item so `outcomes` can compare plays.
const playFlagAt = process.argv.indexOf('--play');
const playFlag = playFlagAt >= 2 ? process.argv.splice(playFlagAt, 2)[1] : undefined;
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
/** Share of the shorter text's content words (4+ letters, links and the feedback footer dropped) that also appear in the other. */
const words = (t) => new Set(t.toLowerCase().replace(/https?:\/\/\S+/g, '').replace(/did this help\?.*/s, '').match(/[a-z0-9]{4,}/g) ?? []);
export function overlap(a, b) { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)); }
export const REPEAT_MAX = 0.45, REPEAT_WINDOW_MS = 48 * 3600_000;
export function claimGuard(text) {
  if (/^-{1,2}[a-z][\w-]*$/i.test(text.trim())) { out({ ok: false, error: `"${text.trim()}" looks like a flag, not a post: nothing was published. Run the tool with no arguments to see its usage.` }); process.exit(2); }
  let clearCorrection = () => {};
  affiliateGuard(text);
  // Internal plumbing (tool names, flags, search parameters, file paths) means nothing to readers and leaks how the agent works.
  const internal = text.match(/\.\/bin\/|\bbin\/[a-z]|\b(bsky-delete|bsky-follow|bsky-mentions|bsky-post|bsky-profile|bsky-reply|bsky-search|email-send|grok-usage|grok-xsearch|inbox-recent|ledger-log|nostr-delete|nostr-dm|nostr-post|nostr-reply|publish-record|reserves-brief|sign-test|x-delete|x-follow|x-mentions|x-post|x-reply|x-stats)\b|\bisQuestion\b|--(play|check|file)\b|\bstate\/[a-z-]+\.json/i);
  if (internal) { out({ ok: false, error: `the text mentions your internal tooling ("${internal[0]}"). Readers cannot use it. Nothing was published. Say what you found or how a person could do it themselves, in plain words.` }); process.exit(2); }
  // A backslash before a quote is shell escaping that leaked into the text; readers would see the backslash.
  if (/\\["'`]/.test(text)) { out({ ok: false, error: 'the text contains a backslash before a quote (\\" or \\\'): shell escaping leaked into it and readers would see the backslash. Nothing was published. Write the text to a file and pass --file <path>, or use plain quotes inside single-quoted text.' }); process.exit(2); }
  // Receipt ids mean nothing to a reader; the flag records them on the post.
  if (/\bagent:check:\d+|\bcheck\s*#?\s*(id\s*)?\d{10,}|\b\d{13}\b/i.test(text)) { out({ ok: false, error: 'remove the receipt id from the text: readers cannot use it. Pass it as --check <id> and it is recorded on the post.' }); process.exit(2); }
  // An operator-listed overstatement on this network blocks other posts there until a correction goes out.
  const cf = `${HOME}/state/corrections.json`; const net = process.argv[1].split('/').pop().split('-')[0];
  if (fs.existsSync(cf)) { const list = JSON.parse(fs.readFileSync(cf, 'utf8')); const open = list.find((c) => c.network === net); if (open) {
    if (!/^correction\b/i.test(text)) { out({ ok: false, error: `publish a correction first. Your post ${open.post ?? ''} said: "${open.said}". Problem: ${open.problem} Start the text with "Correction:" and say what you actually saw.` }); process.exit(4); }
    // A correction belongs under the post it corrects, where that post's readers will see it: only a reply to that exact post counts.
    if (open.post) { const rkey = open.post.split('/').pop(); const tool = process.argv[1].split('/').pop(); const target = process.argv[2] ?? '';
      // The correction must not repeat what it corrects (operator lists the phrases in `forbid`).
      const hit = (open.forbid ?? []).find((f) => new RegExp(f, 'i').test(text));
      if (hit) { out({ ok: false, error: `the correction repeats the claim being corrected ("${hit}"). Drop it and say only what is true: ${open.problem}` }); process.exit(4); }
      if (!tool.endsWith('-reply') || target.split('/').pop() !== rkey) { out({ ok: false, error: `a correction must be a reply to the post it corrects, so its readers see it: run ${net}-reply ${open.post} 'Correction: ...'` }); process.exit(4); } }
    // Clear only once the post is really out: every posting tool exits 0 on success and non-zero on any refusal or failure.
    clearCorrection = () => process.on('exit', (code) => { if (code === 0) fs.writeFileSync(cf, JSON.stringify(list.filter((c) => c !== open), null, 1)); });
  } }
  // Repeat guard: refuse a post that makes the same point as one this agent published on this network in the last 48 hours. Corrections are exempt.
  const pf = `${HOME}/state/published.jsonl`;
  const published = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  if (!/^correction\b/i.test(text)) { const prev = published.filter((p) => p.net === net && Date.now() - Date.parse(p.at) < REPEAT_WINDOW_MS).find((p) => overlap(text, p.text) >= REPEAT_MAX);
    if (prev) { out({ ok: false, error: `this makes the same point as your ${net} post at ${prev.at}: "${prev.text.slice(0, 140)}". Saying it again adds nothing for readers. Write about something you have not covered in the last 48 hours: a new question someone asked, a new source, or a check of something else.` }); process.exit(4); } }
  if (playFlag !== undefined && !/^[a-z][a-z0-9-]{1,29}$/.test(playFlag)) { out({ ok: false, error: `--play must be a short lowercase name like answer, digest or finding (got "${playFlag}"). Nothing was published.` }); process.exit(2); }
  // A digest retells other people's work: it must link the original so the reader can find it and the author gets the credit.
  if (playFlag === 'digest' && !/https?:\/\/\S+/.test(text)) { out({ ok: false, error: 'a digest must link the original (the post or page you are retelling) so readers can find it and its author gets credit. Nothing was published.' }); process.exit(2); }
  process.on('exit', (code) => { if (code === 0) fs.appendFileSync(pf, JSON.stringify({ net, at: new Date().toISOString(), text, ...(playFlag ? { play: playFlag } : {}) }) + '\n'); });
  const f = `${HOME}/state/checks.jsonl`;
  const lines = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n') : [];
  const v = claimVerdict(text, checkFlag, lines);
  if (!v.ok) { out({ ok: false, error: v.error }); process.exit(2); }
  clearCorrection();
  return v.fields;
}
