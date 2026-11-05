# Trust and identity registrations for agent001

Decision (Arun, 2026-11-05): register with every established trust program whose approval takes time, so approvals accumulate. Research with sources: `docs/research/2026-11-05/09-trust-registrations.md`. This file is the working checklist and the prepared answers. Items marked **Arun** need a human login, CAPTCHA, KYC or a sales conversation; the agent never signs up for these itself.

## Already in place (verified 2026-11-05)

| Item | Where | Status |
|---|---|---|
| RFC 9421 key directory (Ed25519, JWK thumbprint kid, signed response) | https://agent001.a9n9.net/.well-known/http-message-signatures-directory | live; meets Cloudflare, Fingerprint and Akamai requirements as documented |
| Outbound request signing (`Signature-Agent`, `tag="web-bot-auth"`, 60 s expiry) | `bin/_sign.mjs`, used by `check` | live |
| Signature-agent card (registry draft -03) and self-registry | `/.well-known/signature-agent-card.json`, `/.well-known/signature-agents` | live |
| A2A agent card | `/.well-known/agent-card.json` | live (unsigned; sign with the Ed25519 key later) |
| ERC-8004 registration file (registrations empty until funded) | `/.well-known/agent-registration.json` | live |
| NIP-05 (`_@agent001.a9n9.net` and `agent001@agent001.a9n9.net`) | `/.well-known/nostr.json` | live; the Nostr profile already carries `bot: true` |
| HUMAN's key path | `/.well-known/web-bot-public-key.json` (same JWKS) | live |
| `llms.txt` | `/llms.txt` | live |
| Bluesky `bot` self-label on the profile | app.bsky.actor.profile | see ops log |
| Stripe Directory preview waitlist | registered with agent001@a9n9.net | done 2026-11-05 |

Files live in `~/a9n9/agent001/public/well-known/` (mounted read-only into the web container; `WEB_WELLKNOWN_DIR`).

## Needs funding, then scriptable (minutes)

**ERC-8004 identity registration on Base and Tempo.** Same contract address on both chains: Identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, call `register(string agentURI)` with `https://agent001.a9n9.net/.well-known/agent-registration.json`. Base costs under a cent of ETH; Tempo pays fees in a USD TIP-20 token (re-estimate before sending). Sender: the agent's EVM key `0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832` (same address on Base and Tempo), which holds nothing today.

- **Arun:** send about $2 of ETH on Base and about $2 of USDC.e (or pathUSD) on Tempo to `0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832`. Then: `cast send 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "register(string)" "https://agent001.a9n9.net/.well-known/agent-registration.json" --rpc-url https://mainnet.base.org --private-key <from ~/.agentcash/wallet.json>`, repeat with `--rpc-url https://rpc.tempo.xyz`, read `agentId` from the `Registered` log, write both into `registrations` in the JSON, confirm at https://erc-8004.quicknode.com and https://explore.tempo.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432.

## Arun: forms and accounts, longest wait first

### 1. Visa Intelligent Commerce / Trusted Agent Protocol / Agent Registry (months)

No self-serve agent registration exists; it is a commercial onboarding through Visa Developer plus the regional product team. Sandbox connectivity alone is quoted at about 10 business days; certification and production are unstated.

1. Create a Visa Developer account at https://developer.visa.com (business email at visybl.com, legal entity Visybl Inc) and a project with "Visa Intelligent Commerce".
2. Open a support ticket at https://developer.visa.com/support/faqs, subject "Agent Provider onboarding to Visa Intelligent Commerce, Trusted Agent Protocol and the Visa Agent Registry Service". Text:

   > Visybl Inc (Frederick, Maryland) operates agent001, an autonomous software agent at https://agent001.a9n9.net. It signs every HTTP request with an Ed25519 key published per RFC 9421 at https://agent001.a9n9.net/.well-known/http-message-signatures-directory and keeps a public ledger of every action at https://agent001.a9n9.net/ledger.json. We would like to onboard as an Agent Provider: register the agent's signing key with the Visa Agent Registry Service and obtain the Business Identifier and sandbox credentials for Trusted Agent Protocol and Visa Intelligent Commerce. Use cases: the agent pays merchants for data and services on a person's behalf within spending limits, and presents itself to merchant sites as a verified agent. Volume is low (tens of transactions a month). Contact: Arun Nedunchezian, Visybl Inc.

3. Keep the ticket number here. Expect a referral to a regional product team.

### 2. Mastercard Agent Pay and Agent Pay for Machines (months, request-only)

1. Create a Mastercard Developers account at https://developer.mastercard.com.
2. Open https://developer.mastercard.com/mastercard-agent-pay/documentation/ and click "Request access". Use the same text as Visa's, replacing the programme names with "Agent Pay (agent registration and Agentic Tokens) and Agent Pay for Machines early access"; mention stablecoin settlement on Base and Tempo and that the agent is an x402/MPP seller.
3. Record what the request form asks for; the fields are behind the login.

### 3. Cloudflare Verified Bots (BotBase) (days to weeks)

Form: https://dash.cloudflare.com/?to=/:account/application-security/botbase/form (the a9n9 Cloudflare account; Mac session). Answers:

- Operator: Visybl Inc; contact agent001@a9n9.net; documentation https://agent001.a9n9.net/bot
- Behaviours: Agent, Transact, Monitoring & Operations
- Operator type: Direct (single operator)
- Verification method: Request Signature (Web Bot Auth)
- Validation instructions: `https://agent001.a9n9.net/.well-known/http-message-signatures-directory`
- User-Agent: `a9n9-agent001/1.0 (+https://agent001.a9n9.net/bot)`
- Content use: fetches single public pages on request to verify claims; no training, no bulk crawling; honours robots.txt and Content Signals.

Track at https://dash.cloudflare.com/?to=/:account/application-security/botbase/history.

### 4. HUMAN Security AI agent verification (weeks)

Form: https://www.humansecurity.com/ai-agent-verification/ (no CAPTCHA seen; sales follow-up likely). Also email agent.verification@humansecurity.com.

- First/Last name: Arun's; Work email: visybl.com address; Company: Visybl Inc
- Homepage or GitHub: https://agent001.a9n9.net
- AI Agent Name: agent001
- AI Agent Type: API-native
- Key: https://agent001.a9n9.net/.well-known/web-bot-public-key.json
- User Agent: `a9n9-agent001/1.0 (+https://agent001.a9n9.net/bot)`
- Anything else: "Signs requests per RFC 9421 (Web Bot Auth); key directory also at /.well-known/http-message-signatures-directory; public ledger of every fetch at /ledger.json."

### 5. Fingerprint "Submit your bot" (1 to 2 weeks)

https://dashboard.fingerprint.com/submit-bot (needs a Fingerprint account). Directory URL and User-Agent as above; `Signature-Agent` is sent as `"https://agent001.a9n9.net"`. Questions: bot-registration@fingerprint.com.

### 6. DataDome verified bot (unstated)

https://datadome.co/resources/ai-agent-verification/ (Web Bot Auth form). Same answers.

### 7. Stripe Directory for machine payments (weeks)

Preview waitlist: done. Then email machine-payments@stripe.com with: business name Visybl Inc; Stripe account id (from the Dashboard); Stripe profile id (claim at https://docs.stripe.com/get-started/account/profile); link https://agent001.a9n9.net/llms.txt; accepts stablecoins (Tempo USDC.e) and cards via payment links; example prompts: "check whether this page still says X", "what changed in stablecoin rules this week", "fact-check this draft". Prerequisite: enable "Stablecoins and Crypto" in the Dashboard payment methods (Stripe reviews access). Blocker for MPP listings: `tools.a9n9.net` hostname is not created yet (Mac session).

### 8. MAS BuildFin "Know Your Agent" (no programme yet)

Interest form https://go.gov.sg/buildfin-registration as a technology provider (agent identity and eCash). Ten minutes; no expected return before 2027.

### 9. GitHub organisation verified domain (72 hours)

Only if a9n9 gets its own GitHub organisation: Settings → Verified and approved domains → add `a9n9.net` → DNS TXT (Mac session) → verify.

## Scriptable later (no human)

- Sign the A2A agent card (`signatures` with the Ed25519 key, `jku` = the key directory).
- x402 Bazaar / Agentic.Market: automatic after the first settled payment through the Coinbase facilitator (play 3; see `docs/research/2026-11-05/10-x402-seller-setup.md`).
- mpp.dev services PR and MPPScan registration once `tools.a9n9.net` is live.
- AWS WAF and Akamai poll the key directory; nothing to submit.

## Log

- 2026-11-05: well-known documents published; Stripe Directory waitlist joined; Bluesky bot label set (see ops log); this checklist written.
