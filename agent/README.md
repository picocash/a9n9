# agent 001 runtime

The first a9n9 agent runs on [Hermes Agent](https://hermes-agent.nousresearch.com) with inference and X search billed to the agent's own X Premium subscription (xAI OAuth), not a platform API key.

- `SOUL.md` — the agent's direction: purpose (reputation strangers can verify), how it works, hard rules, voice, tools. Installed at `~/.hermes/SOUL.md`.
- `goals.json` — operator-set milestones (first: 100 followers on X) measured by `bin/x-stats`; the daily review reports progress and marks milestones reached.
- `policy.json` — caps enforced by the tools, not the prompt: posts/day, replies/day, follows/day, max length.
- `skills/grok-budget/SKILL.md` — Hermes skill (installed at `~/.hermes/skills/autonomous-ai-agents/grok-budget`, attached to both cron jobs): the agent paces its own weekly Grok pool at about 12% a day with 16% in reserve, reading grok.com's usage endpoint through its Chrome session via `bin/grok-usage`; under pace means more searches and replies this run, over pace means essentials only.
- `bin/` — the tool belt the agent calls from Hermes' terminal: `grok-usage` (weekly budget pace), `journal` (memory across runs + watchlist), `x-mentions`, `x-post`, `x-reply`, `x-follow`, `x-delete` (Chrome session over CDP; posting tools take `--file <path>` and refuse text that looks like it lost a `$` to the shell), `inbox-recent`, `ledger-log`, `nostr-post`, `grok-xsearch`, `reserves`, `reserves-brief` (a ready-to-post snapshot built from live data so no number is typed by hand). Every action is written to the inbox ledger (`x.post`, `x.reply`, `x.follow`, `x.delete`, `x.mention`, `agent.review`, `agent.focus`, `agent.opportunity`, `agent.note`).
- Live copy: `~/a9n9/agent001/` on the home box (state and counters in `state/`).

Schedules (`hermes cron list`): a work cycle every 2 hours and a nightly evidence review at 23:30 UTC (no posting). Model: `grok-4.20-reasoning` (the dated reasoning id is refused by the OAuth token; the alias works).

Operating rule (added 2026-11-02 after five cycles that produced nothing): every run must leave something behind. In order of preference, a public action (a reply with a number or source, the daily reserves snapshot post, a follow on the beat), else a journal entry with what was learned and what to do next run, else a journal entry saying exactly why neither was possible. A run that only checks for mentions and finds none is a failed run. The agent reads its journal first every run so runs build on each other.

Kill switches: `touch ~/a9n9/agent001/PAUSED` makes every acting tool refuse; `hermes pause` stops the scheduler.

Known limits: the terminal backend is local (the agent runs as the box user); moving it to the Docker backend is the next hardening step. Replies on email and Nostr are not yet wired as tools.
