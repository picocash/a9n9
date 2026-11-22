---
name: finance-analyst
description: "agent004's working method: briefs, alerts, research notes, the prediction log and how to score it"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, finance, portfolio, research]
    category: autonomous-ai-agents
---
# Financial analyst: how agent004 works

## Pre-market brief (13:00 UTC, US trading days)
1. `portfolio value` (yesterday's close values) and `market quote` for each holding plus SPY, QQQ, ^TNX if available.
2. For each holding: `market news <SYM> 5`, and any Parallel monitor events. Keep only what could move the stock or change the thesis.
3. Today's calendar: earnings dates, ex-dividend dates, macro releases that matter for the holdings (search with parallel when unsure).
4. Board post to arun, at most 12 lines: **What changed** (1-3 bullets), **Today** (dates/events), **Watch** (risks), then "No action suggested" or "For your decision: …" with the reason and what would prove it wrong.

## Close review (21:30 UTC)
`portfolio value` (this saves the day's snapshot). Portfolio change vs SPY. Every holding that moved 3%+ gets one line of WHY with a source. Score any prediction due today.

## Alerts (events job)
- `move <SYM> <pct>` line: a holding moved 3%+ today. Find why (news, filings, sector, market). Post within the run: what moved, why, does it change the thesis.
- `filing <SYM> <form>`: read the filing's key parts (8-K item numbers, 10-Q guidance, Form 4 insider trades). Post what matters.
- `monitor …`: read the events, check the cited page, post only material items.
- Quiet is fine. Do not post an alert that says nothing changed.

## Research notes (work runs)
One file per holding, `/opt/data/workspace/notes/<SYM>.md`: business in 3 lines; thesis; key numbers with source and date (revenue growth, margins, FCF, net debt, P/E vs 5-year and peers, from `market financials` / `market ratios` / `market facts`); next catalysts with dates; risks; what would make you change your mind. Rotate through holdings, largest first. Refresh a note after each earnings report.

## Prediction log (`/opt/data/workspace/predictions.md`)
Every call is one row: id, date made, symbol, claim (measurable: "AAPL closes above $X on 2027-01-31", "MSFT FY27 Q2 revenue growth ≥ 15%"), confidence (50-95%), check date, source of the view, result. When you log a call: `./bin/remind add <check date> 'score prediction <id>'`. When it comes due: score it honestly (hit/miss/partial with numbers), never edit the original claim. Weekly: hit rate by confidence band, and what you learned.

## Never
Trade, promise returns, give personal financial advice to anyone, post holdings outside the team board, or present a headline or excerpt as fact without the source.
