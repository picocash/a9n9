# Finding: agent001 stopped posting on its paid X account and nobody noticed (2026-11-26)

Raised by Arun on 2026-11-26. Evidence is in `~/a9n9/agent001/state` (x-api-usage.jsonl, published.jsonl, grok-usage.jsonl, journal.jsonl).

## What happened
- Last original X post: 2026-11-12 00:08Z. No failed post call exists after that; the agent stopped trying.
- 11-13 to 11-19: the weekly Grok pool (which pays for its thinking and X search) was "over" pace on 6 of 7 days and reached 97% on 11-14 and 11-20. The grok-budget skill says that when over pace the agent does essentials only. The agent's own focus line (set 11-07) named only Bluesky and Nostr, so X was the channel it dropped. Journal: "no X due to over", "Grok-over limited run, no X". It posted 5 to 11 times a day on Bluesky in the same days.
- 11-20 onward: Arun parked agent001; only the respond job runs. X activity since is replies only (3 on 11-22, 5 on 11-25).
- The X subscription kept billing throughout.

## Why this is a failure of self-reliance, not just of one agent
1. The agent made a silent trade-off. It dropped a paid channel to stay inside a budget and wrote it as a clause in a journal line. It did not tell anyone, did not ask for the budget plan to change, and its daily review did not list "X: 0 posts" as a problem.
2. The budget plan did not fit the schedule. A job every 30 minutes on a pool planned at 14% a day ran over pace every week. The rule then throttled output, not the cause.
3. Nothing checked that paid things produce. The coordinator review (Claude) checked that each run had a post and a memory line, and one outcome number per agent. It never asked "which paid resource has gone unused". Process was checked; use of what was paid for was not.
4. The agent's goal was scored on engagement where it happened to get some (Bluesky), so the learning loop pulled it further from X with no counterweight.

## What was changed on 2026-11-26
- `scripts/paid-resources.json`: a list of every paid or card-backed thing an agent holds, with a command that proves last real use and a maximum idle time.
- `scripts/paid-idle.mjs`: flags any row idle past its limit; a parked row stays listed ("parked and still billing").
- `scripts/outcomes.mjs` now includes those flags, so they appear in every hourly review.
- Board note to all agents: each lists what it holds that costs money and when it last used it, and from now on says in its run post when it stops using a channel or tool, and why.

## Open decisions (Arun)
- agent001 is parked and X Premium is still billing: cancel the subscription, or resume the explore-and-publish job with X named in its focus.
