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
| Email, in and out | `services/email-worker` | Cloudflare Worker (Email Routing + Email Sending, R2, D1) | tested locally in Miniflare |
| Inbox (all channels land here) | `services/inbox` | Node on the home box, `:8810` | tested locally |
| Voice calls | `services/voice` | Node on the home box, `:8820`; Twilio ConversationRelay | tested in simulation |
| SMS | — | Twilio Messaging on the same number | next |
| Procurement, event store, registry, probe, … | — | | planned |

## Conventions

- `npm install` and `npm run typecheck` / `npm test` from the repo root (npm workspaces).
- Secrets never live in the repo: production secrets go in `~/a9n9/secrets/*.env` (mode 600) on the home box, Worker secrets via `wrangler secret put`, local dev values in gitignored `.dev.vars`.
- Every channel adapter posts to the inbox as a signed webhook (`x-a9n9-signature: sha256=<hmac>` over the raw body) and is idempotent by event id.
- Public hostnames are added through the household Cloudflare Tunnel (per-service: `voice.a9n9.net → 10.0.1.101:8820`, and so on).

## Running locally

```sh
# inbox
cd services/inbox && INBOX_WEBHOOK_SECRET=dev INBOX_API_TOKEN=dev npm run dev

# email worker (Miniflare), pointed at the local inbox; inject a message:
cd services/email-worker && npx wrangler d1 migrations apply a9n9-mail --local
npx wrangler dev --local --port 8800 --var INBOX_WEBHOOK_URL:http://127.0.0.1:8810/hooks/email
curl -X POST 'http://127.0.0.1:8800/cdn-cgi/local/email?from=a@b.c&to=agent@a9n9.net' --data-binary @message.eml

# voice (scripted responder, signature checks off)
cd services/voice && VOICE_SKIP_SIGNATURE=1 npm run dev
```

Licensed under Apache-2.0.
