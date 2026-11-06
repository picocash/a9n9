---
name: a9n9-daily-review
description: "The nightly evidence review: MVR progress from the ledger, the three-day focus rule, runway and spend, memory consolidation, and tomorrow's three concrete moves. No posting."
version: 1.0.0
author: a9n9 (agent 001 runtime)
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, review, mvr, focus, runway]
    category: autonomous-ai-agents
---

# Daily review

Once a day you judge the day on evidence someone else produced, decide whether your focus stands, and set up tomorrow. Nothing is posted in this job.

## Procedure
1. `./bin/mvr` — the five criteria from the ledger. Report the numbers against the day-30 marks (50 correspondents, 10 engagements, 10 helped receipts a week) and the MVR bar. Numbers only.
2. `./bin/tickets` (anything open for more than a day is a failure to name), `./bin/journal 40` and `./bin/inbox-recent 24` — who wrote, who wrote back a second time, which posts got replies or quotes from real accounts, which findings nobody touched.
3. `./bin/focus` — apply the rule: the focus changes only on evidence that has held for three days. If three days of evidence point somewhere else (people write about X, nobody writes about Y), `./bin/focus set '<new focus>' '<the three days of evidence>'`. If the evidence is thin, say so and keep exploring; do not change focus on one day's noise.
4. Money: `./bin/runway` for cost and days of runway; `./bin/grok-usage` for the Grok pool pace; the X API usage file `state/x-api-usage.jsonl` for today's spend; `state/counters.json` for caps. Report what the day cost and whether it bought anything a stranger confirmed.
5. Consolidate memory: one `./bin/journal add` entry that a future run can act on: what worked (query, territory, channel, time of day), what did not, who to follow up with tomorrow, and the three concrete moves for tomorrow, at least one of them toward the next MVR criterion that is furthest behind and one toward the paid offering (live by week five).
6. `./bin/x-stats` once, for the reach snapshot.
7. `./bin/ledger-log agent.review` with JSON: {mvr: {...numbers}, focus, focusDaysHeld, evidence: [...], cost: {...}, tomorrow: [3 moves]}. Quote the ledger id in your final message.

## Judgement rules
- Weight follows what it cost the other party: a payment > a signed receipt > a reply > a follow > your own report. A quiet day with one real correspondent beats a loud day with three posts and no replies.
- Affiliates (the operator, Visybl, a9n9, sibling agents) count for zero.
- If a run today produced nothing public and no learning, name it as a failed run and say what rule would have prevented it.
- If anything happened that the operator must know (a cap hit, an API refusal, money running low, a hostile message, a mistake you made), put it first in the final message.
