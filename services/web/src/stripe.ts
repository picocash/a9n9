/**
 * Stripe webhook: verifies Stripe's signature over the raw body and turns settled card payments
 * into ledger events. The ledger is public, so nothing identifying the payer is written: a payer
 * is a keyed hash of their email, or their domain when they are affiliated with a9n9 (so the
 * record's paid-work count can exclude them).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const AFFILIATE_DOMAINS = /(^|\.)(visybl\.com|a9n9\.net|flext\.energy)$/i;
const TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('=', 2) as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  if (!t || !/^\d+$/.test(t) || Math.abs(nowSeconds - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  return parts.filter(([k]) => k === 'v1').some(([, v]) => {
    const got = Buffer.from(v ?? '', 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export function payerLabel(email: unknown, secret: string): string {
  const addr = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!addr) return 'card:unknown';
  const domain = addr.split('@')[1] ?? '';
  if (AFFILIATE_DOMAINS.test(domain)) return `affiliate:${domain}`;
  return `card:${createHmac('sha256', secret).update(addr).digest('hex').slice(0, 16)}`;
}

const usd = (cents: unknown, currency: unknown): number | null =>
  typeof cents === 'number' && String(currency).toLowerCase() === 'usd' ? cents / 100 : null;

type StripeEvent = { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
export type LedgerEvent = { id: string; type: string; channel: 'stripe' } & Record<string, unknown>;

/** Returns the ledger event for a Stripe event, or null for events the ledger does not record. */
export function toLedgerEvent(ev: StripeEvent, secret: string, at = new Date().toISOString()): LedgerEvent | null {
  const o = ev.data?.object ?? {};
  const base = { channel: 'stripe' as const, rail: 'stripe', livemode: ev.livemode === true, stripe_event: ev.id, at };
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    if (o.payment_status !== 'paid') return null;
    const details = o.customer_details as { email?: unknown } | undefined;
    return { ...base, id: `stripe:income:${String(o.id)}`, type: 'money.income', amount_usd: usd(o.amount_total, o.currency), amount_minor: o.amount_total, currency: o.currency, payment_intent: o.payment_intent, payment_link: o.payment_link ?? null, payer: payerLabel(details?.email, secret) };
  }
  if (ev.type === 'charge.refunded') {
    return { ...base, id: `stripe:refund:${String(o.id)}:${String(o.amount_refunded)}`, type: 'money.refund', amount_usd: usd(o.amount_refunded, o.currency), currency: o.currency, payment_intent: o.payment_intent };
  }
  if (ev.type === 'charge.dispute.created') {
    return { ...base, id: `stripe:dispute:${String(o.id)}`, type: 'money.dispute', amount_usd: usd(o.amount, o.currency), currency: o.currency, payment_intent: o.payment_intent, reason: o.reason };
  }
  return null;
}
