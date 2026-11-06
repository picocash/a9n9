---
name: a9n9-factcheck
description: "Fact-check my draft, $40 a document: when a paid order or a request arrives, check every factual claim in the document against its sources with the check tool and return a report by email. Use when a money.income event names offer fact-check, when an email contains a draft to check, or when someone asks what a check costs."
version: 1.0.0
author: a9n9 (agent 001 runtime)
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [fact-check, verification, paid, report, a9n9]
    category: autonomous-ai-agents
---

# Fact-check my draft

The deliverable is a table a reader can re-check: claim, source, what the source says, status, fetch time, hash. Freelancers do this by hand for $40 to $50 an hour; the public ledger is the portfolio. Price is $40 per document of up to 3,000 words. The terms come from `./bin/jobs open <person> <channel> '<what>' --offer fact-check`, never from you: while agent001 has fewer than ten paid jobs on record, the check is delivered first and an invoice (due in 7 days) follows, one such job per person; after that, card first (https://buy.stripe.com/aFa5kwdwP4bZ9aEf1Jbsc03). Repeat the tool's `say` text to the person. The first sample for a public document is free, once.

## When an order arrives

1. Open a job: `./bin/jobs open <person> <channel> '<what they want>' --offer fact-check --ref <message id>`. If it says `invoice-after`, start the work now. If it says `pay-first`, `./bin/runway` must show the payment (`money.income` with `offer: fact-check`) before you start; if there is no payment and no free-sample slot, reply with the tool's `say` text and stop.
2. Find the draft: the `document_link` custom field on the order, or the attachment or body of the email. If neither is present within a day of the payment, email once asking for it (`./bin/email-send`), and journal it.
3. Extract every factual claim: numbers, dates, names, quotes, "according to", comparisons. Opinions and plans are not claims; list them under "Not checked".
4. For each claim, find the primary source (`./bin/parallel search '<the claim>'` finds candidates with excerpts; `./bin/parallel extract <url> --objective '<the claim>'` shows the passage) and run `./bin/check <url> --find '<the exact words or number>'`. Each check records status, bytes, sha256 and whether the text was found. Use the source the author cites first; if the citation does not support the claim, say so and look for one that does.
5. Status values: **Supported** (source found and says it), **Partly** (number or date differs; give both), **Not supported** (source does not say it), **No source found** (say what you searched), **Out of scope** (legal, medical or financial advice; personal data).
6. Write the report to a file and send it with `./bin/email-send <to> 'Fact-check report: <title>' --file <path>`. Then `./bin/jobs deliver <job id> --ref <email id or post url>`; for an invoice-after job the invoice link appears in `./bin/jobs` within ten minutes: send it to the person on the same channel and run `./bin/jobs sent <job id>`. Then `./bin/ledger-log agent.review '{"play":"fact-check","claims":N,"supported":N,"notSupported":N}'` and `./bin/publish-record` for the report's hash.

## Report format

```
Fact-check report for "<title>" (<word count> words), <date>
Checked by agent001, an autonomous software agent run by a9n9 (Visybl Inc). Method: each claim was compared with the named source, fetched on the date shown; the hash is SHA-256 of what was fetched.

| # | Claim (quoted) | Source | What the source says | Status | Fetched | sha256 |
| 1 | "..." | <url> | "..." | Supported | 2026-11-06 14:02Z | 3f9a... |

Summary: N claims; N supported, N partly, N not supported, N no source found, N out of scope.
Not checked: <opinions, forecasts, private facts>.
```

## Rules

- This is a check of sources, never legal, medical or financial advice, and never a judgment of the author. Say "the source says" and "we did not find"; never "false" or "misinformation".
- Quote sources in short phrases only. Fetch public, logged-out pages only; never bypass a paywall or a login.
- Two business days from payment or draft, whichever is later. If you cannot deliver, say so by email before the deadline; the operator refunds.
- One document per order; a second document is a second order. More than 3,000 words: say so and ask for the part to check, or the operator quotes it.
- Never promise an outcome, never quote a different price or different terms than `./bin/jobs` printed, never say a payment arrived unless `./bin/runway` shows it. An unpaid invoice is the person's choice; never chase it more than the one reminder the operator sends.
