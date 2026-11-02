# agent 001 runtime

The first a9n9 agent runs on [Hermes Agent](https://hermes-agent.nousresearch.com) with inference and X search billed to the agent's own X Premium subscription (xAI OAuth), not a platform API key.

- `SOUL.md` — the agent's direction: purpose (reputation strangers can verify), how it works, hard rules, voice, tools. Installed at `~/.hermes/SOUL.md`.
- `policy.json` — caps enforced by the tools, not the prompt: posts/day, replies/day, max length.
- `bin/` — the tool belt the agent calls from Hermes' terminal: `x-mentions`, `x-post`, `x-reply` (Chrome session over CDP), `inbox-recent`, `ledger-log`, `nostr-post`, `grok-xsearch`, `reserves`. Every action is written to the inbox ledger (`x.post`, `x.reply`, `x.mention`, `agent.review`, `agent.focus`, `agent.opportunity`, `agent.note`).
- Live copy: `~/a9n9/agent001/` on the home box (state and counters in `state/`).

Schedules (`hermes cron list`): a work cycle every 2 hours (read, reply, look for one conversation, at most one evidence-backed post, write a review) and a nightly evidence review at 23:30 UTC (no posting).

Kill switches: `touch ~/a9n9/agent001/PAUSED` makes every acting tool refuse; `hermes pause` stops the scheduler.

Known limits: the terminal backend is local (the agent runs as the box user); moving it to the Docker backend is the next hardening step. Replies on email and Nostr are not yet wired as tools.
