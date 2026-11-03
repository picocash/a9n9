# Agent messaging: each agent's own SMS and WhatsApp

Every agent owns its numbers and credentials and runs its own copy of `services/comms`.
Messages are routed by address: an SMS to agent001's number reaches only agent001's
connector, and a WhatsApp message names the business number (`phone_number_id`) it was
sent to. Adding an agent means adding a container and its numbers. Shared code changes
only for new features.

Shared pieces:
- `wa-relay` (`services/comms/src/relay.ts`). Meta delivers every number under one app to
  a single webhook. The relay checks Meta's signature, splits the payload by number, and
  forwards each part unchanged to its agent, signed with that agent's own secret. It
  stores nothing.
- The rules in `src/policy.ts`, enforced in code:
  - Agents reply only to people who wrote first. Consent belongs to the agent that was
    written to, per channel.
  - SMS STOP/START handling.
  - WhatsApp's 24-hour reply window.
  - Daily caps.
  - On SMS, the first reply always says it comes from an automated agent and how to opt
    out.

## Per agent
| Env | What |
|---|---|
| `AGENT_ID`, `AGENT_DISPLAY` | e.g. `agent001`, `a9n9 agent 001 (Visybl)` |
| `PUBLIC_URL` | this connector's public base, e.g. `https://comms.a9n9.net/agent001` (Plivo signs the full URL) |
| `COMMS_API_TOKEN` | the agent's tool bearer for `/v1/send` and `/v1/status` |
| `INBOX_URL`, `INBOX_WEBHOOK_SECRET` | the agent's own inbox (ledger) |
| `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `SMS_NUMBER` | SMS, once the number is verified |
| `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_RELAY_SECRET` | WhatsApp, once the number is registered |

## SMS: toll-free numbers on Plivo
Plivo's toll-free verification is free and can be resubmitted after a rejection (Plivo
support: "free of charge", reviewed manually in 24 to 72 hours). We use it instead of
10DLC, where each rejection cost money.
1. Operator: create a Plivo account for Visybl Inc and add a card.
2. Buy one toll-free number per agent (about $1 to $2 a month).
3. Submit toll-free verification per number:
   - use case: conversational replies to people who text first;
   - opt-in: a single path, the person texts the number first;
   - privacy policy URL: www.visybl.com/privacy;
   - terms URL: www.visybl.com/sms;
   - samples: the agent's real replies.
4. Point the number's message URL to `PUBLIC_URL/sms/plivo`.

Carriers may ask for a justification once a business has more than five toll-free
numbers, so plan the agent count with that in mind.

## WhatsApp: Meta Cloud API, direct (no reseller)
1. Operator: create a Meta Business portfolio for Visybl Inc and start business
   verification. Unverified accounts get 1 or 2 numbers; verified accounts get more.
2. Create one Meta app with a system user token. Register each agent's number on the
   WhatsApp Business Account; the agent's toll-free number can serve, using the voice
   verification code.
3. Set the webhook to the relay's public `/whatsapp`, with `WA_VERIFY_TOKEN`, and
   subscribe to `messages`.
4. Add each number to `WA_ROUTES`.

Replies inside 24 hours of the person's last message use free-form text. The agent never
starts a conversation, so it needs no paid templates.
