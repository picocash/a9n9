---
name: a9n9-parallel
description: Web research you pay for per call through ./bin/parallel (Parallel.ai via tools.a9n9.net): search with excerpts, extract a page, decide a yes/no with a probability and citations, run a researched task with per-field sources, build a dataset (findall), or set a standing watch (monitor). When to use which, what it costs, and what counts as verification.
version: 1.0.0
author: a9n9 (agent 001 runtime)
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, research, parallel, search, extract, decide, dataset, monitor]
    category: autonomous-ai-agents
---

# Paid web research: `./bin/parallel`

Six ways to ask the web a question, each a paid call (your price, shown by `./bin/parallel --help`; about $0.01 for the small ones). The cap is $1.50 a day (`policy.json`); the tool refuses beyond it and tells you. Every call is a `money.spend` line in your ledger, so spend where a finding, a reply or a job needs it, not out of curiosity. Free first: `./bin/bsky-search`, `./bin/grok-xsearch` (its own budget), `./bin/check`.

## Which one

| You want | Use | Cost | Returns |
|---|---|---|---|
| Sources for a claim or a topic, with the passages | `parallel search '<objective in a sentence>' [--queries 'a\|b'] [--domains .gov,site.com] [--after 2026-01-01]` | $0.01 | up to 10 URLs with excerpts and dates |
| What one page (or up to 10) actually says | `parallel extract <url> [--objective '<the claim>'] [--full]` | $0.01 | excerpts focused on the objective (or the page as markdown) |
| Is a statement true, with sources | `parallel decide --state '{"company":"X","website":"https://x"}' --ask name='<statement>'` (also `--choice`, `--score`) | $0.01 | a probability per statement plus citations |
| A few researched fields about one thing, with a source per field | `parallel task '<what>' --schema '<fields wanted>' [--processor lite\|base\|core]` | $0.05 | structured output, each field with citations, reasoning, confidence; waits up to 2 min |
| A list of things that meet conditions (a dataset) | `parallel findall '<objective>' --match 'name=condition' [--generator preview\|base] [--limit N]` | $1.20 | matched entities with evidence per condition, saved to `state/datasets/` |
| To be told when something new appears | `parallel monitor '<what to watch for>' [--weekly]`; later `parallel events <monitor_id>` (free) | $0.20 once | events with citations, daily or weekly, for about a month |

## Rules

- **Excerpts are not verification.** Before you write "verified", "checked" or "confirms", run `./bin/check <url> --find '<the words>'` on the source the excerpt came from; the post tools refuse those words without a check id. `parallel extract` tells you where to look; `check` is the receipt.
- **A probability is not a fact.** From `decide`, say "an estimated 0.93 that …, per <source>", never "true". A `refusal` is a separate outcome, not a no. Missing evidence is not false.
- **Datasets:** one `findall` a day at most, and only when someone asked for the list or a finding needs it. Journal the file path and what the matched set shows; a dataset is a candidate for a post or a job, not a post by itself.
- **Monitors:** at most 5, all on your beat (agent identity and money, stablecoin reserves and attestations, x402 and MPP). Read `parallel events <id>` in each explore run for the monitors you hold (`parallel monitors`); an event is a lead, and its citations get the same `check` before you repeat it. Cancelling is the operator's job; ask in the journal.
- **Inputs are public web only.** No logins, no paywalls, no personal data in `--state` or an objective.
- Single quotes or `--file`-style care for every text argument; `$` inside double quotes is destroyed by the shell.
