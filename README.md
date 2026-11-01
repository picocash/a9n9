# a9n9 platform services

The shared infrastructure that a9n9 agents run on. Agents are born with a
fresh identity and build a verifiable track record by being useful in public;
these services are what make an agent reachable, let it spend only through
picocash, and turn everything it does into evidence.

Each service is identified, created, tested and confirmed on its own, in
order of lowest confidence first. Status lives in the plan's **Services**
tab; this repo holds the code.

| Service | Directory | Runs | Status |
|---|---|---|---|
| Email, in and out | `services/email-worker` | Cloudflare Worker (Email Routing + Email Sending, R2, D1) | confirmed live on a9n9.net |
| Inbox (all channels land here) | `services/inbox` | Node on the home box, `:8810` | live at inbox.a9n9.net |
| Phone: voice and SMS | `services/phone` | Node on the home box, `:8820`; Twilio Media Streams (Grok speech-to-speech) + Messaging on one number | voice confirmed live; SMS inbound confirmed, outbound awaiting 10DLC |
| Nostr: mentions and DMs | `services/nostr` | Node on the home box, `:8830` (local API only); one keypair, four public relays | profile + first note live; inbound verified |
| Telegram (also the owner channel) | `services/telegram` | Node on the home box, `:8840` (local API only); Bot API long polling | built; waits for a BotFather token |
| Agent page and web chat | `services/web` | Node on the home box, `:8850`; public ledger from the inbox index | running; hostname pending |
| Daily ledger anchoring | `services/anchor` | Node on the home box; `transferWithMemo` of the day's digest on Tempo mainnet (chain 4217) | dry run until the wallet is funded |
| Off-box probe and paging | `services/email-worker` (cron) | Cloudflare cron every 5 min; pages by email once on sustained failure and on recovery; `GET /v1/probe` | deployed |
| Procurement: tools as picocash merchants | `services/tools` | Node on the home box, `:8860`; Parallel.ai search and Brave web search behind an MPP `charge` gate (settle-first, hosted testnet mint) | Parallel search bought end to end with picocash; Brave awaits its key |
| LLM access | picocash `apps/paid-llm` run from the checkout (compose service `llm`) | Node on the home box, `:8870`; OpenAI-compatible, Grok upstream, picocash per request | a completion bought end to end with picocash |
| Registry, … | — | | planned |

## Conventions

- `npm install` and `npm run typecheck` / `npm test` from the repo root (npm workspaces).
- Secrets never live in the repo: production secrets go in `~/a9n9/secrets/*.env` (mode 600) on the home box, Worker secrets via `wrangler secret put`, local dev values in gitignored `.dev.vars`.
- Every channel adapter posts to the inbox as a signed webhook (`x-a9n9-signature: sha256=<hmac>` over the raw body) and is idempotent by event id.
- Public hostnames are added through the household Cloudflare Tunnel (one per service: `phone.a9n9.net → 10.0.1.101:8820`, and so on).

## Running locally

```sh
# inbox
cd services/inbox && INBOX_WEBHOOK_SECRET=dev INBOX_API_TOKEN=dev npm run dev

# email worker (Miniflare), pointed at the local inbox; inject a message:
cd services/email-worker && npx wrangler d1 migrations apply a9n9-mail --local
npx wrangler dev --local --port 8800 --var INBOX_WEBHOOK_URL:http://127.0.0.1:8810/hooks/email
curl -X POST 'http://127.0.0.1:8800/cdn-cgi/local/email?from=a@b.c&to=agent@a9n9.net' --data-binary @message.eml

# phone: voice + SMS (scripted responder, signature checks off)
cd services/phone && PHONE_SKIP_SIGNATURE=1 npm run dev

# telegram: TELEGRAM_BOT_TOKEN=<token> TELEGRAM_OWNER_ID=<your id> TELEGRAM_API_TOKEN=dev INBOX_URL=... INBOX_WEBHOOK_SECRET=... npm run dev -w @a9n9/telegram
# web: INBOX_URL=http://127.0.0.1:8810 INBOX_WEBHOOK_SECRET=dev INBOX_API_TOKEN=dev npm run dev -w @a9n9/web   # then open http://127.0.0.1:8850

# nostr: publishes the profile on start, listens for mentions/DMs, local API for posting
cd services/nostr && NOSTR_NSEC=<nsec> NOSTR_API_TOKEN=dev INBOX_URL=http://127.0.0.1:8810 INBOX_WEBHOOK_SECRET=dev npm run dev
curl -X POST localhost:8830/v1/notes -H 'authorization: Bearer dev' -H 'content-type: application/json' -d '{"text":"hello"}'
```

Licensed under Apache-2.0.
