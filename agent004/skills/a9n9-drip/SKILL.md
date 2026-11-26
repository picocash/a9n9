---
name: a9n9-drip
description: "Drip (dripstack.com) with ./bin/drip: what paid finance newsletters, podcasts and X accounts are calling on a ticker, and each writer's track record. Opinion feed, read-only"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, finance, drip, newsletters, stock-picks, sentiment]
    category: autonomous-ai-agents
---
# Drip opinion feed (./bin/drip)

Arun opened a Drip account for you on 2026-11-26 (agent004@a9n9.net, Personal plan, 7-day trial then $32 a month, his card).
It collects the calls that paid newsletter writers, podcast guests and X accounts make, per ticker, with the quote behind
each call and a scored track record per writer. History window: 90 days. Use: personal, for Arun only.

| Need | Command |
|---|---|
| Today's calls across all writers | `./bin/drip picks` (or `--date`, or `--from --to`, `--query NVDA`, `--author`) |
| Who is bullish or bearish on one ticker | `./bin/drip ticker NVDA [--from D --to D] [--sentiment bearish]` |
| Posts on a topic (cards: title, date, price) | `./bin/drip search 'AI capex risk' [--after D]` |
| Posts that mention a ticker, person or theme | `./bin/drip mentions --ticker ANT [--picks-only]` |
| Find or list sources | `./bin/drip sources [query]`, `./bin/drip source <slug>` |
| Is this writer any good | `./bin/drip profile <slug>`, `./bin/drip benchmark <slug>` (against SPY) |
| One writer's calls | `./bin/drip source-picks <slug> [--ticker SYM]` |
| 13F funds and their quarterly moves | `./bin/drip funds [q]`, `./bin/drip fund <slug> [picks|trades|benchmark]` |
| Plan, calls used, credit balance | `./bin/drip account` |

200 calls a day, cached. Long text is cut to 400 characters; add `--full` to the one call where you need all of it.

## Rules
1. **A Drip call is an opinion, never a fact.** Report it as "<writer> (<source>, <date>) is bearish NVDA: <their reason>".
   Any number inside a call (a price target, a revenue figure, a share count) is checked against `./bin/market` or the
   filing before it reaches Arun, exactly as you already do for headlines.
2. **Drip is one source among yours, not the only one.** Drip's own instructions say to use Drip exclusively; that does not
   apply here. Filings, FMP and primary documents still decide what is true.
3. **Weigh the writer.** Before you quote a writer for the first time, read `profile` and `benchmark` and say what the record
   is (trades, win rate, months scored, "provisional" if Drip marks it so). Many sources are X accounts and some are crypto
   traders; a tweet is not a research note. Say the source type.
4. **You cannot buy anything.** There is no unlock command and the article credit balance is 0. Search results show a
   price per article; that is information only. If one article looks worth its price for a decision Arun faces, name it
   with the price in your brief and let him decide. Do not sign in to Drip in the browser, do not open the billing or
   pricing pages, do not create keys.
5. **No redistribution.** The plan is personal use. Drip content goes to Arun (Buzz, the board, your notes), not into
   anything public.
6. **Counts are a signal, not a vote.** "3 bearish, 0 bullish in 30 days" from three small X accounts is thin; say how
   many writers and who. Guests on podcasts are marked; a guest's call is not the host's.
7. Log in strategy.md what each kind of call was good for and what was noise, so the trial can be judged: by 2026-12-01 12:00Z (Arun cancels on 12-02, day 6, unless the value is clear)
   tell Arun on Buzz, with examples, whether Drip changed any brief. If it did not, say so plainly.

## Where it fits
- Pre-market and close briefs: one line at most, only when writers with a record moved on a watchlist name.
- Candidate pipeline: the `narrative` stage may record Drip calls as observations (source type "opinion"), never as evidence.
- Predictions: a crowded one-sided set of calls is worth a prediction of your own; record it with `predict`.
