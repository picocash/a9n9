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
| `PUBLIC_URL` | this connector's public base, e.g. `https://comms.a9n9.net/agent001` (delivery reports come back to `PUBLIC_URL/sms/telnyx`) |
| `COMMS_API_TOKEN` | the agent's tool bearer for `/v1/send` and `/v1/status` |
| `INBOX_URL`, `INBOX_WEBHOOK_SECRET` | the agent's own inbox (ledger) |
| `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `SMS_NUMBER`, `TELNYX_MESSAGING_PROFILE_ID` | SMS, once the number is verified (the public key verifies Telnyx's Ed25519 webhook signatures) |
| `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_RELAY_SECRET` | WhatsApp, once the number is registered |

## SMS: toll-free numbers on Telnyx
Telnyx is pay as you go: no platform fee or monthly minimum, about $1 a month per
toll-free number, about $0.0055 per message part plus carrier fees, and no fee for
toll-free verification. Toll-free verification needs the account at Telnyx's
**Verified** tier (KYC plus Telnyx's AI agent check); the Paid tier cannot submit it.
(Plivo was dropped in November 2026: it moved SMS to a $1,000-a-month Enterprise plan.
Twilio 10DLC was dropped after paid rejections.)
1. Operator: create the Telnyx account, add the card and 2FA, and reach the Verified tier.
2. Create one messaging profile per agent and buy one toll-free number per agent.
3. Submit toll-free verification per number (Business Registration Number required):
   - use case: conversational replies to people who text first;
   - opt-in: a single path, the person texts the number first;
   - privacy policy URL: www.visybl.com/privacy;
   - terms URL: www.visybl.com/sms;
   - samples: the agent's real replies.
   A rejected submission can be appealed through tfverification@telnyx.com.
4. Set the messaging profile's inbound webhook to `PUBLIC_URL/sms/telnyx`.

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
