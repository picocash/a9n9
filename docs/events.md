# Events and the ledger

Every service posts what happened to the inbox as a signed webhook. The inbox
stores each event once, under `events/<channel>/<id>.json`, and appends a line
to `events/index.jsonl`. The ledger is derived from these events; nothing is
ever edited or deleted.

## Envelope

Every event has these fields. Adapters fill them; the inbox adds `receivedAt`.

| Field | Meaning |
|---|---|
| `id` | Stable, provider-derived where possible (Twilio CallSid or MessageSid, the Worker's message id). Re-delivery of the same id is a no-op. |
| `type` | `<channel>.<what>` — see the table below. |
| `channel` | `voice`, `sms`, `email`, later `telegram`, `nostr`, `web`, `x`, `money`, `agent`. |
| `receivedAt` | When the inbox stored it (ISO 8601). |
| `payload` | The channel-specific body; counterparties appear as the address the provider gave us. |

## Event types today

| Type | Emitted by | Carries | Ledger meaning |
|---|---|---|---|
| `voice.call` | phone | caller, callee, tier, duration, who ended it, interruptions, full transcript (system / caller / agent turns, tool calls) | one correspondence with a human; the transcript is the evidence |
| `sms.received` | phone | from, to, body, media, origin city | inbound correspondence |
| `sms.sent` | phone | to, body, provider sid | the agent's reply (self-report until the status arrives) |
| `sms.status` | phone (Twilio callback) | message sid, status, error code | delivery proof or failure |
| `nostr.mention` | nostr | author pubkey/npub, event id, text, thread id | public correspondence on an open network |
| `nostr.dm` | nostr | author, text, which encryption (NIP-04 or NIP-17 gift wrap), rumor id for NIP-17 | private correspondence |
| `nostr.post` / `nostr.dm.sent` | nostr | event id, text, relays that accepted it | the agent's own output (self-report; the relays hold the signed copy) |
| `email.received` | email worker | envelope, parsed headers, text, DKIM/SPF/DMARC verdicts, R2 key of the raw MIME | inbound correspondence with authentication result |

Planned: `email.sent`, `telegram.message`, `web.chat`, `x.post`,
`x.mention`, `money.receipt` (a settled picocash or Stripe payment),
`money.spend` (a metered tool call or rent), `agent.focus` (a declared focus
or a change to it, with reasoning), `agent.review` (the daily evidence
review), `registry.receipt` (a counterparty-signed "this helped").

## Daily digest and anchoring

`GET /v1/digest?day=YYYY-MM-DD` returns, for that UTC day, the ordered list of
event ids and a SHA-256 over the day's index lines (`events/index.jsonl`
filtered to that day, in order). The hash is what gets written to Tempo once
a day; anyone holding the exported events can recompute it. A day's hash
changes only if an event is added to that day after the fact, which the
anchoring job treats as an incident, not a correction.

## What the ledger counts

Weight follows cost to the counterparty: a settled payment, then a
counterparty-signed receipt, then a resolved output, then a public engagement,
then correspondence, then tenure; the agent's self-reports last. Anything from
a9n9, its operator or a sibling agent is recorded and weighted at zero.
