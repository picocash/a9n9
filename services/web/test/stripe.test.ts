import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { payerLabel, toLedgerEvent, verifyStripeSignature } from '../src/stripe.js';

const secret = 'whsec_test';
const now = 1_800_000_000;
const sign = (body: string, t = now, s = secret) => `t=${t},v1=${createHmac('sha256', s).update(`${t}.${body}`).digest('hex')}`;

describe('stripe signature', () => {
  it('accepts a correct signature, including alongside other schemes', () => {
    expect(verifyStripeSignature('{}', sign('{}'), secret, now)).toBe(true);
    expect(verifyStripeSignature('{}', `${sign('{}')},v0=abc`, secret, now)).toBe(true);
  });
  it('rejects tampering, wrong secrets, stale timestamps and missing headers', () => {
    expect(verifyStripeSignature('{"a":1}', sign('{}'), secret, now)).toBe(false);
    expect(verifyStripeSignature('{}', sign('{}', now, 'other'), secret, now)).toBe(false);
    expect(verifyStripeSignature('{}', sign('{}', now - 301), secret, now)).toBe(false);
    expect(verifyStripeSignature('{}', undefined, secret, now)).toBe(false);
    expect(verifyStripeSignature('{}', `t=${now},v1=zz`, secret, now)).toBe(false);
  });
});

describe('stripe ledger events', () => {
  const session = { id: 'cs_1', payment_status: 'paid', amount_total: 30000, currency: 'usd', payment_intent: 'pi_1', payment_link: 'plink_1', customer_details: { email: 'Buyer@Example.com', name: 'A Buyer' } };

  it('records a paid checkout as income without identifying the payer', () => {
    const e = toLedgerEvent({ id: 'evt_1', type: 'checkout.session.completed', livemode: true, data: { object: session } }, secret)!;
    expect(e).toMatchObject({ id: 'stripe:income:cs_1', type: 'money.income', channel: 'stripe', amount_usd: 300, payment_intent: 'pi_1', livemode: true });
    expect(JSON.stringify(e)).not.toMatch(/buyer/i);
    expect(e.payer).toBe(payerLabel('buyer@example.com', secret));
  });
  it('ignores unpaid sessions and unrelated events', () => {
    expect(toLedgerEvent({ type: 'checkout.session.completed', data: { object: { ...session, payment_status: 'unpaid' } } }, secret)).toBeNull();
    expect(toLedgerEvent({ type: 'customer.created', data: { object: {} } }, secret)).toBeNull();
  });
  it('does not treat other currencies as dollars', () => {
    const e = toLedgerEvent({ type: 'checkout.session.completed', data: { object: { ...session, currency: 'eur' } } }, secret)!;
    expect(e.amount_usd).toBeNull();
  });
  it('labels affiliated payers by domain so they stay out of the paid count', () => {
    expect(payerLabel('someone@flext.energy', secret)).toBe('affiliate:flext.energy');
    expect(payerLabel('x@sub.visybl.com', secret)).toBe('affiliate:sub.visybl.com');
    expect(payerLabel('x@notvisybl.com', secret)).toMatch(/^card:/);
  });
  it('records refunds and disputes against the payment', () => {
    expect(toLedgerEvent({ type: 'charge.refunded', data: { object: { id: 'ch_1', amount_refunded: 1000, currency: 'usd', payment_intent: 'pi_1' } } }, secret)).toMatchObject({ type: 'money.refund', amount_usd: 10, payment_intent: 'pi_1' });
    expect(toLedgerEvent({ type: 'charge.dispute.created', data: { object: { id: 'dp_1', amount: 1000, currency: 'usd', payment_intent: 'pi_1', reason: 'fraudulent' } } }, secret)).toMatchObject({ type: 'money.dispute', payment_intent: 'pi_1' });
  });
});
