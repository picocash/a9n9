// Money loop: what each card payment owes the agent. Pure, so it can be tested without Stripe or the ledger.
export const PLATFORM_SHARE = 0.20;
export const HOLD_DAYS = 14;
const DAY = 86_400_000;

/** Cents, after Stripe's fee: the platform takes its share of the net, rounded; the agent gets the rest. */
export function split(grossCents, feeCents) {
  const netCents = grossCents - feeCents;
  const platformCents = Math.round(netCents * PLATFORM_SHARE);
  return { grossCents, feeCents, netCents, platformCents, agentCents: netCents - platformCents };
}

const idOf = (e) => String(e.id).replace(/^stripe:income:/, '');

/**
 * @param events ledger payloads with channel stripe/settlement (money.income, money.refund, money.dispute, money.settlement, money.release, money.credit-cancel)
 * @param feeOf async (paymentIntent) => fee in cents
 * @returns the new events to write. Every id is stable, so a repeated run writes nothing new.
 */
export async function plan(events, feeOf, now = Date.now()) {
  const by = (t) => events.filter((e) => e.type === t);
  const has = (id) => events.some((e) => e.id === id);
  const refunded = {}; for (const r of by('money.refund')) refunded[r.payment_intent] = Math.max(refunded[r.payment_intent] ?? 0, Math.round((r.amount_usd ?? 0) * 100));
  const disputed = new Set(by('money.dispute').map((d) => d.payment_intent));
  const out = []; const at = new Date(now).toISOString();
  for (const inc of by('money.income')) {
    if (inc.amount_usd == null) continue; // not USD: left for the operator
    const key = idOf(inc); const pi = inc.payment_intent;
    const sid = `settlement:${key}`;
    let s = by('money.settlement').find((x) => x.id === sid);
    if (!s) {
      const grossCents = Math.round(inc.amount_usd * 100);
      const parts = split(grossCents, await feeOf(pi));
      s = { id: sid, type: 'money.settlement', channel: 'settlement', payment_intent: pi, payer: inc.payer, livemode: inc.livemode, ...parts, agent: 'agent001', creditForm: 'closed-loop service credit', releaseAfter: new Date(Date.parse(inc.at ?? at) + HOLD_DAYS * DAY).toISOString(), at };
      out.push(s);
    }
    if (has(`release:${key}`) || has(`credit-cancel:${key}`) || now < Date.parse(s.releaseAfter)) continue;
    if (disputed.has(pi)) continue; // frozen until the operator resolves it
    const r = refunded[pi] ?? 0;
    const credit = Math.floor(s.agentCents * Math.max(0, s.grossCents - r) / s.grossCents);
    if (credit <= 0) out.push({ id: `credit-cancel:${key}`, type: 'money.credit-cancel', channel: 'settlement', payment_intent: pi, reason: 'refunded', at });
    else out.push({ id: `release:${key}`, type: 'money.release', channel: 'settlement', payment_intent: pi, agent: s.agent, agentCents: credit, amount_usd: credit / 100, refundedCents: r, at });
  }
  return out;
}
