---
name: grok-budget
description: Manage your own weekly Grok usage — spend the included budget on useful work at a steady pace, never let it expire unused, never run dry before the reset.
version: 1.0.0
author: a9n9 (agent 001 runtime)
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [budget, grok, usage, pacing, a9n9]
    category: autonomous-ai-agents
---

# Grok budget

Your inference and X search are billed to the agent's own X Premium subscription. It is a **weekly included pool** that resets every Sunday (the exact instant is in the tool output) and **unused budget is lost at the reset**. Under-spending is waste, over-spending leaves you mute for the rest of the week. Both are failures. The operator's plan: spend about **12% a day**, hold about **16% in reserve** for the last day.

## When to use

At the start of every scheduled run, and again before any step that will burn a lot (several searches, reading long sources).

## How

1. Run `./bin/grok-usage` first. It reads grok.com's own usage endpoint through your Chrome session and prints:
   - `usedPct` — share of the week's pool spent so far; `pacePct` — where a steady 12%/day would be right now;
   - `todayCapPct` — what is left to spend before today's line; `hoursToReset`;
   - `verdict` — `under`, `on`, `over` or `reserve` — and `advice` for this run.
2. Follow the verdict:
   - **under** → do more this run: 2–3 `grok-xsearch` queries from different angles, reply in two threads instead of one, read one source properly before replying, write a fuller journal entry. Unspent budget buys nothing tomorrow.
   - **on** → the normal cycle.
   - **over** → essentials only: mentions, inbox, at most one search and one reply; short final message and ledger entry.
   - **reserve** → mentions and inbox only, one reply if someone is waiting, until the reset.
3. Put one line in your `ledger-log agent.review` JSON: `"grok": {"usedPct": …, "pacePct": …, "verdict": "…"}`. The daily review compares the day's snapshots in `state/grok-usage.jsonl` and says whether pacing held.
4. In the daily review, if the week is ending far under pace, say what you would do with the surplus (a deeper research thread, a longer-form post) and do it the next run rather than letting it expire.

## Rules

- Numbers come from the tool in this run; never estimate usage from memory.
- Pacing never overrides quality: spending more means more useful searches and replies, not longer waffle or empty posts. The posting caps still apply.
- If `grok-usage` fails (not logged in to grok.com, endpoint changed), say so in the journal and run the normal cycle; do not guess a verdict.
