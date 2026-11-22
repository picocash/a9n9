---
name: a9n9-parallel
description: "Parallel.ai web research (search, extract, findall lists, monitors) with ./bin/parallel; use it before hand-checking pages one by one"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, research, parallel, web]
    category: autonomous-ai-agents
---
# Parallel web research (./bin/parallel)

You have a paid web-research tool. Budget: $1.50 a day (the tool and the service both enforce it), 5 monitors at most.
Use it whenever a job means checking many pages by hand. One call replaces a dozen curls.

| Need | Command | Cost |
|---|---|---|
| Find pages for a question | `./bin/parallel search '<objective>' [--queries 'q1|q2'] [--max 8] [--after 2026-11-01]` | $0.01 |
| Pull facts or a contact from known pages | `./bin/parallel extract <url> [<url>…] --objective 'public contact email, latest post date'` | $0.01 |
| A whole LIST of matching people or outlets in one go | `./bin/parallel findall '<objective>' --match 'name=what makes it a match' --limit 30` | $1.20 |
| Be told when something new appears on your beat | `./bin/parallel monitor '<what to watch for>' [--weekly] --label '<name>'`, then `./bin/parallel events <id>` (free) | $0.20 |

Rules
1. One monitor per holding for MATERIAL news (earnings, guidance, M&A, regulatory action, management change, rating changes), e.g. `./bin/parallel monitor 'material news about Apple Inc (AAPL): earnings, guidance, regulatory, M&A, management changes' --label AAPL`. Five monitors at most: cover the largest positions first and say which ones are uncovered. Your events job wakes you when a monitor finds something.
2. Use search/extract for the WHY behind a move (analyst notes, conference calls, industry news), task for a structured comparison (peers, valuation table), and findall only for lists (e.g. all companies in a sector that cut guidance this quarter).
3. Excerpts are leads, not proof. Open the page (extract or curl) and grep the exact words before you quote a number or use an address. Never present an excerpt as a fact without the page.
4. Log what each call found or did not find in strategy.md, and name the dataset file, so you never run the same search twice.
5. Over budget? Stop and say so in your run post; do not work around it.
