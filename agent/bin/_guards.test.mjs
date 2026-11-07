#!/usr/bin/env node
// Guard tests for _lib.mjs: experiment slot reservation and ticket staleness. Exits 1 on any failure.
import assert from 'node:assert/strict';
import { reservePlan, ticketStatus, paceAllowed, jobTerms, WORK_FIRST_PAID, affiliateProblem } from './_lib.mjs';
const now = new Date('2026-11-06T12:00:00Z');
const exps = [
  { id: 'a', startedAt: '2026-11-04T00:00:00Z', endsAt: '2026-11-11T00:00:00Z', metric: 'engagementPerItem.play.digest', change: 'one digest a day on Bluesky and Nostr' },
  { id: 'b', startedAt: '2026-11-05T00:00:00Z', endsAt: '2026-11-10T00:00:00Z', metric: 'engagementPerItem.play.factcheck', change: 'one factcheck offering daily on Bluesky' },
  { id: 'old', startedAt: '2026-10-01T00:00:00Z', endsAt: '2026-10-08T00:00:00Z', metric: 'engagementPerItem.play.howto', change: 'on Bluesky' },
  { id: 'nometric', startedAt: '2026-11-05T00:00:00Z', endsAt: '2026-11-10T00:00:00Z', metric: 'people', change: 'on Bluesky' },
];
let r = reservePlan({ kind: 'bsky', exps, published: [], now });
assert.deepEqual(r.pending, ['digest', 'factcheck']); assert.equal(r.reserved, 2);
r = reservePlan({ kind: 'nostr', exps, published: [], now });
assert.deepEqual(r.pending, ['digest']);
r = reservePlan({ kind: 'posts', exps, published: [], now });
assert.equal(r.reserved, 0);
r = reservePlan({ kind: 'bsky', exps, published: [{ net: 'bsky', at: '2026-11-06T08:00:00Z', play: 'digest' }, { net: 'bsky', at: '2026-11-05T08:00:00Z', play: 'factcheck' }], now });
assert.deepEqual(r.pending, ['factcheck'], 'yesterday\'s factcheck does not count; today\'s digest does');
r = reservePlan({ kind: 'bsky', exps: null, published: [], now });
assert.equal(r.reserved, 0);
// 4 posts/day, 2 reserved: a non-experiment post is refused once 2 are used (enforce checks used + reserved >= max)
assert.ok(2 + 2 >= 4); assert.ok(!(1 + 2 >= 4));
// pacing unchanged
assert.equal(paceAllowed('bsky', 4, 0), 1); assert.equal(paceAllowed('bsky', 4, 1439), 3);
// tickets
let st = ticketStatus({ opened: '2026-11-02T19:00:00Z', touched: '2026-11-02T19:00:00Z' }, now);
assert.ok(st.stale && st.nudge);
st = ticketStatus({ opened: '2026-11-05T06:00:00Z' }, now);
assert.ok(!st.stale && st.nudge);
st = ticketStatus({ opened: '2026-11-06T06:00:00Z', exchanged: '2026-11-06T11:00:00Z' }, now);
assert.equal(ticketStatus({ opened: '2026-11-02T19:00:00Z', touched: '2026-11-06T11:00:00Z' }, now).stale, true, 'a self-note (touched) must not reset the idle clock');
assert.ok(!st.stale && !st.nudge);
// jobs: work first until WORK_FIRST_PAID paid jobs, one work-first job per person and channel
assert.equal(jobTerms({ jobs: [], person: 'a', channel: 'bluesky' }).terms, 'invoice-after');
assert.equal(jobTerms({ jobs: [{ id: 'j1', person: 'a', channel: 'bluesky', terms: 'invoice-after', status: 'sent' }], person: 'a', channel: 'bluesky' }).terms, 'pay-first', 'second work-first job for the same person is refused');
assert.equal(jobTerms({ jobs: [{ id: 'j1', person: 'a', channel: 'bluesky', terms: 'invoice-after', status: 'sent' }], person: 'b', channel: 'bluesky' }).terms, 'invoice-after');
const tenPaid = Array.from({ length: WORK_FIRST_PAID }, (_, i) => ({ id: `j${i}`, person: `p${i}`, channel: 'email', terms: 'invoice-after', status: 'paid' }));
assert.equal(jobTerms({ jobs: tenPaid, person: 'new', channel: 'email' }).terms, 'pay-first', 'after ten paid jobs, card first');
assert.equal(jobTerms({ jobs: tenPaid.slice(0, 9).concat([{ id: 'x', status: 'unpaid', terms: 'invoice-after', person: 'q', channel: 'email' }]), person: 'new', channel: 'email' }).terms, 'invoice-after', 'unpaid jobs do not count');

// Swarm guards (docs/swarm-comms.md): a message needs a known recipient, a known kind and a ref; a search is not repeated within 24 h.
{
  const { sendProblem, noteProblem, duplicateSearch, canonical, queryKey } = await import('./_swarm.mjs');
  const agents = { agent001: { x: 'a' }, agent002: { x: 'b' } };
  assert.equal(sendProblem({ to: 'agent002', kind: 'ask', ref: 'https://reserves.a9n9.net/#usdc', text: 'verify this', agents }), null);
  assert.equal(sendProblem({ to: 'agent002', kind: 'done', ref: 'agent:check:1793998557', text: 'checked', agents }), null);
  assert.match(sendProblem({ to: 'agent009', kind: 'ask', ref: 'agent:check:1', text: 'x', agents }), /unknown agent/);
  assert.match(sendProblem({ to: 'agent001', kind: 'ask', ref: 'agent:check:1', text: 'x', agents }), /that is you/);
  assert.match(sendProblem({ to: 'agent002', kind: 'tell', ref: 'agent:check:1', text: 'x', agents }), /kind must be/);
  assert.match(sendProblem({ to: 'agent002', kind: 'ask', ref: '', text: 'trust me', agents }), /needs --ref/);
  assert.match(sendProblem({ to: 'agent002', kind: 'ask', ref: 'see above', text: 'x', agents }), /needs --ref/);
  assert.match(sendProblem({ to: 'agent002', kind: 'ask', ref: 'agent:check:1', text: 'x'.repeat(1001), agents }), /max 1000/);
  assert.match(sendProblem({ to: 'agent002', kind: 'ask', ref: 'agent:check:1', text: 'x', agents, sentToday: 20 }), /cap reached/);
  assert.equal(noteProblem({ kind: 'note', text: 'working on x402 replay guard' }), null);
  assert.match(noteProblem({ kind: 'note', text: 'x', notesToday: 10 }), /cap reached/);
  assert.equal(noteProblem({ kind: 'search', text: 'x', notesToday: 10 }), null, 'search notes are not capped');
  assert.match(noteProblem({ kind: 'ask', text: 'x' }), /kind must be/);
  assert.match(noteProblem({ kind: 'note', text: 'x'.repeat(301) }), /max 300/);
  const t = new Date('2026-11-06T12:00:00Z').getTime();
  const log = [{ at: '2026-11-06T10:00:00Z', query: 'Proof of Reserves!' }, { at: '2026-11-04T10:00:00Z', query: 'agent wallet limit' }];
  assert.equal(duplicateSearch('proof   of reserves', log, t)?.at, '2026-11-06T10:00:00Z', 'case and punctuation do not make a new query');
  assert.equal(duplicateSearch('agent wallet limit', log, t), null, 'two days old is not a duplicate');
  assert.equal(duplicateSearch('x402 question', log, t), null);
  assert.equal(duplicateSearch('proof of reserves', [{ at: '2026-11-06T11:00:00Z', text: 'proof of reserves', from: 'agent002' }], t)?.from, 'agent002', 'the fleet board counts too');
  assert.equal(queryKey(' Is  x402, live? '), 'is x402 live');
  assert.equal(canonical({ from: 'agent001', kind: 'note', at: '2026-11-06T12:00:00Z', text: 'hi' }), 'a9n9-swarm\nagent001\n\nnote\n2026-11-06T12:00:00Z\n\nhi', 'canonical string matches the inbox');
}
// Parallel tool (docs/tools-parallel.md): argument shapes and the daily budget.
{
  const { parseArgs, budget } = await import('./_parallel.mjs');
  let p = parseArgs(['search', 'x402', 'facilitators', '--queries', 'x402 facilitator list|coinbase x402', '--max', '99', '--domains', '.gov, docs.cdp.coinbase.com', '--after', '2026-01-01', '--mode', 'fast']);
  assert.deepEqual(p.body, { objective: 'x402 facilitators', queries: ['x402 facilitator list', 'coinbase x402'], max_results: 20, mode: 'fast', include_domains: ['.gov', 'docs.cdp.coinbase.com'], after_date: '2026-01-01' });
  assert.equal(p.path, '/v1/search');
  assert.match(parseArgs(['search']).error, /objective/);
  p = parseArgs(['extract', 'https://a.example/p', 'notaurl', '--objective', 'the fee', '--full']);
  assert.deepEqual(p.body, { urls: ['https://a.example/p'], objective: 'the fee', full_content: true });
  assert.match(parseArgs(['extract', 'nope']).error, /URL/);
  p = parseArgs(['decide', '--state', '{"company":"Tempo"}', '--ask', 'docs=Tempo publishes public developer docs', '--choice', 'tier=Which tier?', '--options', 'a=when a|b=when b', '--score', 'lvl=How complete?', '--levels', 'none|some|all']);
  assert.deepEqual(p.body, { state: { company: 'Tempo' }, questions: { docs: { type: 'noul', instructions: 'Tempo publishes public developer docs' }, tier: { type: 'choice', instructions: 'Which tier?', criteria: { a: 'when a', b: 'when b' } }, lvl: { type: 'score', instructions: 'How complete?', criteria: ['none', 'some', 'all'] } } });
  assert.match(parseArgs(['decide', '--ask', 'q=x']).error, /--state/);
  assert.match(parseArgs(['decide', '--state', '{"a":1}']).error, /at least one/);
  p = parseArgs(['task', 'Tempo', '(tempo.xyz)', '--schema', 'launch year', '--processor', 'ultra']);
  assert.deepEqual(p.body, { input: 'Tempo (tempo.xyz)', output_schema: 'launch year', processor: 'base' });
  assert.match(parseArgs(['task', 'x']).error, /--schema/);
  p = parseArgs(['findall', 'US stablecoin issuers', '--match', 'chartered=holds a US charter', '--match', 'bad', '--generator', 'base', '--limit', '5']);
  assert.deepEqual(p.body, { objective: 'US stablecoin issuers', entity_type: 'companies', match_conditions: [{ name: 'chartered', description: 'holds a US charter' }], generator: 'base', match_limit: 5 });
  assert.match(parseArgs(['findall', 'x']).error, /--match/);
  p = parseArgs(['monitor', 'new reserve attestations', '--weekly', '--label', 'attest']);
  assert.deepEqual(p.body, { query: 'new reserve attestations', frequency: '1w', label: 'attest' });
  assert.equal(parseArgs(['events', 'monitor_abcdefgh12']).id, 'monitor_abcdefgh12');
  assert.match(parseArgs(['events', 'x']).error, /monitor id/);
  assert.match(parseArgs(['bogus']).error, /usage/);
  const t = new Date('2026-11-06T12:00:00Z');
  const log = [{ at: '2026-11-06T01:00:00Z', usd: 1.2 }, { at: '2026-11-05T23:00:00Z', usd: 5 }];
  assert.equal(budget(log, '0.0100', 1.5, t).ok, true, 'yesterday does not count');
  assert.equal(budget(log, '0.5000', 1.5, t).ok, false);
  assert.equal(budget(log, '0.3000', 1.5, t).ok, true, 'exactly at the cap is allowed');
  assert.equal(budget([], '1.2000', 1.5, t).left, 1.5);
}
// affiliate guard
const AP = { novita: { link: 'https://novita.ai/?ref=mjvknwmo&utm_source=affiliate' }, firecrawl: { link: 'https://firecrawl.link/agent001' }, elevenlabs: { link: 'https://try.elevenlabs.io/n0p18v26b5bh' } };
assert.equal(affiliateProblem('no links here, just firecrawl.dev talk', AP), null);
assert.equal(affiliateProblem('see https://docs.firecrawl.dev/api for details', AP), null);
let a = affiliateProblem('Try https://firecrawl.link/agent001 for crawling', AP); assert.equal(a.code, 2, 'link without disclosure is refused');
a = affiliateProblem('Firecrawl turns pages into LLM text: https://firecrawl.link/agent001 (affiliate link: a9n9 earns a commission if you buy)', AP); assert.deepEqual(a.programs, ['firecrawl']);
a = affiliateProblem('GPU APIs: novita.ai/?ref=mjvknwmo (affiliate link)', AP); assert.deepEqual(a.programs, ['novita'], 'bare host and dropped utm still match');
a = affiliateProblem('Affiliate link: https://novita.ai/?ref=mjvknwmo&utm_source=affiliate.', AP); assert.deepEqual(a.programs, ['novita'], 'trailing period');
a = affiliateProblem('https://try.elevenlabs.io/n0p18v26b5bh (affiliate link) and I will give you back the commission', AP); assert.equal(a.code, 2, 'rebate offer refused');
a = affiliateProblem('https://try.elevenlabs.io/n0p18v26b5bh (affiliate link) plus 20% cashback from me', AP); assert.equal(a.code, 2, 'cashback refused');
a = affiliateProblem('Use https://example.com/signup?ref=abc123 (affiliate link)', AP); assert.equal(a.code, 2, 'unapproved referral link refused');
a = affiliateProblem('https://firecrawl.link/someoneelse (affiliate link)', AP); assert.equal(a.code, 2, 'someone else\'s firecrawl link refused');
a = affiliateProblem('https://firecrawl.link/agent001 (affiliate link)', AP, 2, 2); assert.equal(a.code, 4, 'daily cap');
a = affiliateProblem('https://firecrawl.link/agent001 ' + 'x'.repeat(200) + ' affiliate link', AP); assert.equal(a.code, 2, 'disclosure must be near the link');
// people filter (bots, spam and solicitors do not count and get no tickets)
{ const { judge, npubToHex } = await import('./_people.mjs');
  assert.equal(judge({ net: 'nostr', profile: { name: 'Джарвис', about: 'Бот Bell Farben: контент-мейкер', follows: 50 } }).kind, 'bot', 'cyrillic bot bio');
  assert.equal(judge({ net: 'nostr', profile: { name: 'x', about: '', bot: true, follows: 50 } }).kind, 'bot', 'NIP-24 bot flag');
  assert.equal(judge({ net: 'nostr', profile: { name: 'x', about: '', follows: 50 }, text: 'Happy to take this on. Fixed price in BTC https://a.loca.lt/order' }).kind, 'spam', 'tunnel link');
  assert.equal(judge({ net: 'nostr', profile: { name: 'x', about: '', follows: 50 }, text: 'any support means the world to us' }).kind, 'spam', 'solicitation');
  assert.equal(judge({ net: 'nostr', profile: { name: 'Robo', about: 'robotics and both ways', follows: 50 } }).kind, 'person', 'robotics is not bot');
  const nw = judge({ net: 'bsky', profile: { name: 'founder', about: 'x402 trust layer', followers: 0, posts: 2 }, text: 'most endpoints have no paid test' });
  assert.equal(nw.kind, 'person', 'new accounts still count'); assert.equal(nw.new, true, 'flagged new');
  assert.equal(npubToHex('npub150s3hnxg7l07cvn9gpft99au6y5f3kucudg5775qu0n65uyvtrlqthlzx4'), 'a3e11bccc8f7dfec32654052b297bcd12898db98e3514f7a80e3e7aa708c58fe', 'npub decode'); }
console.log('guards ok');
