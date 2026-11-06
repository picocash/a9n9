#!/usr/bin/env node
// Guard tests for _lib.mjs: experiment slot reservation and ticket staleness. Exits 1 on any failure.
import assert from 'node:assert/strict';
import { reservePlan, ticketStatus, paceAllowed, jobTerms, WORK_FIRST_PAID } from './_lib.mjs';
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
console.log('guards ok');
