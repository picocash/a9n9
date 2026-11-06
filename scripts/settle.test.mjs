import test from 'node:test'; import assert from 'node:assert/strict';
import { plan, split } from './settle-plan.mjs';
const t0 = Date.parse('2026-11-03T00:00:00Z'); const DAY = 86400000;
const inc = (o = {}) => ({ id: 'stripe:income:cs_1', type: 'money.income', amount_usd: 10, payment_intent: 'pi_1', payer: 'card:x', livemode: true, at: new Date(t0).toISOString(), ...o });
const fee = async () => 59;
test('split takes 20% after the fee', () => { assert.deepEqual(split(1000, 59), { grossCents: 1000, feeCents: 59, netCents: 941, platformCents: 188, agentCents: 753 }); const b = split(30000, 900); assert.equal(b.platformCents + b.agentCents + b.feeCents, 30000); });
test('new income gets a settlement and no release during the hold', async () => { const o = await plan([inc()], fee, t0 + DAY); assert.equal(o.length, 1); assert.equal(o[0].type, 'money.settlement'); assert.equal(o[0].agentCents, 753); assert.equal(o[0].releaseAfter, new Date(t0 + 14 * DAY).toISOString()); });
test('releases after the hold, once', async () => { const [s] = await plan([inc()], fee, t0); const o = await plan([inc(), s], fee, t0 + 15 * DAY); assert.equal(o.length, 1); assert.equal(o[0].type, 'money.release'); assert.equal(o[0].agentCents, 753); assert.deepEqual(await plan([inc(), s, o[0]], fee, t0 + 16 * DAY), []); });
test('a full refund cancels the credit', async () => { const [s] = await plan([inc()], fee, t0); const o = await plan([inc(), s, { type: 'money.refund', id: 'r', payment_intent: 'pi_1', amount_usd: 10 }], fee, t0 + 15 * DAY); assert.equal(o[0].type, 'money.credit-cancel'); });
test('a partial refund reduces it; cumulative refunds count once', async () => { const [s] = await plan([inc()], fee, t0); const o = await plan([inc(), s, { type: 'money.refund', id: 'r1', payment_intent: 'pi_1', amount_usd: 2 }, { type: 'money.refund', id: 'r2', payment_intent: 'pi_1', amount_usd: 5 }], fee, t0 + 15 * DAY); assert.equal(o[0].agentCents, Math.floor(753 * 500 / 1000)); });
test('a dispute freezes the release', async () => { const [s] = await plan([inc()], fee, t0); assert.deepEqual(await plan([inc(), s, { type: 'money.dispute', id: 'd', payment_intent: 'pi_1' }], fee, t0 + 15 * DAY), []); });
test('non-USD is left alone', async () => { assert.deepEqual(await plan([inc({ amount_usd: null })], fee, t0), []); });

test('x402 income (rail != stripe) is left alone: no settlement, no release', async () => {
  const x = { id: 'x402:income:0xabc', type: 'money.income', channel: 'tools', rail: 'x402', amount_usd: 0.01, payer: '0xdef', at: new Date(t0).toISOString() };
  const out = await plan([x], async () => { throw new Error('feeOf must not be called for x402'); }, t0 + 30 * DAY);
  assert.deepEqual(out, []);
});
