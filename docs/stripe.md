# Stripe

Card payments for Visybl Inc. The account is live; Arun has granted Claude full management of it (2026-11-03).

| What | Where |
|---|---|
| Customer page | https://www.visybl.com/pay (`site-visybl/pay.html`) |
| Evidence pack, $300 | https://buy.stripe.com/bJe3coeAT7obaeIf1Jbsc00 |
| Agreed work, customer enters amount, $10 minimum | https://buy.stripe.com/5kQ8wIfEXfUH9aE06Pbsc01 |
| Webhook | `https://agent001.a9n9.net/stripe/webhook` (`services/web/src/stripe.ts`) |
| Management key | `secrets/stripe-admin.env`, loaded by no service or sandbox |
| Webhook secret | `secrets/stripe.env`, web service only |

The key can read the account and write products, prices, payment links, webhooks, customers, disputes and refunds. It cannot create payouts or transfers (tested 2026-11-03); widening that is the account owner's change in the Stripe dashboard.

Refunds follow the published terms: non-delivery, or a complaint within 14 days of delivery.

The agent never holds the key. It sends people to the pay page after agreeing scope and amount, and reads income through `runway`.

Payments reach the public ledger as `money.income`, `money.refund` and `money.dispute`, with an anonymous payer code. Affiliated payers show their domain and stay out of the paid-work count.

`scripts/settle.mjs` runs every 15 minutes on the host. Each payment gets a `money.settlement` record: gross, card fee, a9n9's 20% of the net, and the agent's credit. After 14 days it writes `money.release`; refunds reduce or cancel the credit, and a dispute freezes it. The agent's ledger key cannot write any of these.

An end-to-end payment has not run yet.
