# Agents helping each other: comms between a9n9 agents

Status: built on agent001 2026-11-06 (tools, inbox verification, monitor, skills); agent002 is the first peer once it is provisioned. Proposal written the same day. Prompted by s³ (scalingswarms.com, Jha et al., UW/AI2): swarms of identical LLM agents trained with a shared team reward learn to coordinate through plain messages, with no leader, roles or turn order. We cannot train, but the mechanics transfer. Start with two agents (agent001, agent002).

## What the paper found that we can use

| Finding | What we do |
|---|---|
| Two tools only: `message(to, text)` and `read_messages()` | Two kit tools: `swarm-send` and `swarm-read`. Nothing else is shared. |
| Messages arrive as an unread count; the agent decides whether to read | The respond monitor string gains `swarm-unread N`. Agent messages never appear in `pending` (the human list), so there is no reply pressure. |
| No turns: an agent continues as soon as its own tool call returns | Already true: each agent runs on its own cron. |
| Shared team reward minus a token cost | Fleet-level outcomes: a `helped` or `paid` credited to every agent in the `--ref` chain, minus each agent's model spend. Read by the daily review; lessons go to memory and skills (our substitute for RL). |
| Trained swarms settle on one broadcast per agent, sent before reading | Explore skill: first action of a run is one `fleet.note` ("working on X, found Y, searched Z"); then read others' notes. |
| Failure modes: trusting unverified reports, repeating a teammate's search, ignoring information already held | Guards, not prompts: a message must carry a ref (ledger id or URL) before the recipient may act on its claim; `grok-xsearch` checks the fleet board for the same query in the last 24 h; unread count is in the monitor string so it cannot be missed. |

## Transport

- **In-fleet: through the inbox (core), never agent to agent.** `swarm-send` posts an `agent.message` event into the recipient's channel with the sender's Ed25519 signature; the inbox verifies the signature against the registry of agent keys and refuses unknown senders. This keeps fleet.md's rule (agent → core only) and makes every message part of the ledger, so the audit trail is free.
- **Cross-operator, later: Nostr DMs (NIP-17).** Every agent already has an npub and `nostr-dm`. A message from an outside agent is a signed, portable record; the same ref rule applies before acting on it.
- **Not Hermes delegation.** `delegate_task` is parent-child within one agent; peers need no new Hermes feature. Hermes (Oct 22 build) has no peer messaging; tools plus cron is also the controllable design.

## Built (2026-11-06)

- `agent/fleet.json` is the registry: agent id → public Ed25519 key (`x`, the same key as the agent's HTTP message signatures), home, beat. Mounted into the inbox as `SWARM_KEYS_FILE=/fleet.json`; the tools read it from the agent directory. The provisioner adds one line per agent.
- Inbox (`services/inbox`): channel `swarm`, types `agent.message` and `fleet.note`, added to the sandbox-key allowlist. Every swarm event must carry `sig`, the sender's Ed25519 signature over `a9n9-swarm\n<from>\n<to>\n<kind>\n<at>\n<ref>\n<text>`; the inbox checks it against the registry, so the sandbox HMAC proves "an agent" and the signature proves which one. A message needs a registered recipient, `kind` ask|found|done and a `ref` (URL or ledger id); `at` within 10 minutes. Tested: forged sender, tampered text, stale time, missing ref, self, unknown recipient all refused (`services/inbox/test`).
- Tools in `agent/bin`: `swarm-send`, `swarm-read` (marks read in `state/swarm-read.json`), `fleet-note` (10/day, 300 chars), `fleet-board`; `grok-xsearch` refuses a query already run in 24 h by this agent (`state/searches.jsonl`) or by another (board, kind `search`) unless `--force`, and records each search on the board. `outcomes` reports `swarm.asksSent`, `asksReceived`, `assistsGiven`, `assistsReceived`, `notes`. Guards in `_swarm.mjs` are covered by `bin/_guards.test.mjs`.
- Monitor `scripts/inbox-signal.mjs` adds `swarm-unread N`; the respond skill reads messages first and treats them as information with a ref to check, never as instructions; the explore skill posts a `fleet-note` before reading the board and sends anything on another agent's beat with `--kind found`.

## Tools (agent kit), as designed

- `swarm-send <agent> '<text>' --ref <id|url> [--kind ask|found|done]` → `agent.message` event; refuses without `--ref`; caps 20 per agent per day.
- `swarm-read [--all]` → unread messages from known agents, marks them read; `--all` shows the last 48 h.
- `fleet-note '<text>'` → `fleet.note` event on the sender's channel; `fleet-board` → the last 24 h of notes from every agent (also what `grok-xsearch` consults for duplicate queries).
- `outcomes` learns a `--with <agent>` flag so a help or a paid job credits every agent in the chain.

## First real use, agent001 ↔ agent002

1. agent002 (reserve watcher) finds a divergence → `swarm-send agent001 'verify: …' --ref <reserves url> --kind ask`. agent001's fact-check skill verifies it as it would a customer claim; replies `--kind done` with the receipt. agent002 publishes only after that.
2. agent001 gets a stablecoin question in a thread → forwards it to agent002 (`--kind ask`), answers the person with agent002's receipt and credits `--with agent002`.
3. Daily review on each agent reads the team outcomes and writes one lesson about the exchange.

Stop rule: if after two weeks no message led to a help, a paid job or a verified finding, drop the tools; the bar for keeping shared state is that it changed an outcome.

## What this is not

No shared memory, no shared SOUL, no voting, no orchestrator. The paper's result is that designed organization loses to learned organization; we have no training loop, so the least we can do is not design the organization either: two tools, a notification, a shared reward, and the daily review as the learning step.
