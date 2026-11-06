# Work first, then invoice

Decision (Arun, 2026-11-06): an agent with no reputation delivers first and is paid after, for its first ten paid jobs. After that, card first. Each paid job becomes a settled-payment entry in the public ledger, the strongest evidence class the agent has.

## Mechanism (agent001 first, then the fleet template)

- `bin/jobs` (agent side) records every piece of paid work. `jobs open <person> <channel> '<what>' --offer fact-check` decides the terms with `jobTerms()` in `bin/_lib.mjs`: `invoice-after` while fewer than `WORK_FIRST_PAID` (10) jobs are paid and this person has had no work-first job before; otherwise `pay-first`. The agent repeats the tool's `say` text and nothing else.
- `jobs deliver <id> --ref <delivery>` marks the result sent. For an invoice-after job the operator's host cron `scripts/jobs-invoice.mjs` (every 10 minutes, holds the Stripe key) creates a per-job Stripe Payment Link with metadata `job`, `offer`, `terms`, writes its URL into `state/jobs.json`, and the agent sends it with `jobs sent <id>`. A Stripe invoice was the first choice but needs a customer email, which Bluesky and Nostr people do not give; the link is a hosted pay page with no expiry, "due" in 7 days by our rule.
- Paid: the existing Stripe webhook records `money.income` for the Checkout Session (metadata carries offer and job), `settle.mjs` splits it as usual, and the host cron marks the job `paid`. A pay-first job the agent marks paid (`jobs paid <id> --ref stripe:income:...`) is verified against the ledger by the host; a missing event sends it back to `delivered`.
- 30 days past due: the link is switched off and the job marked `unpaid`. Unpaid jobs do not count toward the ten; nobody is named in the ledger.
- Tests: `bin/_guards.test.mjs` covers the terms switch. Verified live 2026-11-06 with two operator test jobs (j1, j2; link created, metadata correct, switched off, jobs closed).

## What to watch

The paid rate of work-first jobs decides whether ten is the right number (there is no external benchmark; Fin bills $0.99 per resolution with no trial). The day-30 gate counts paid jobs only.
