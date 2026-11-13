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
| Advisory IP list (egress /32, hourly refresh) | `/.well-known/ip-ranges.json` | live |
| Bluesky `bot` self-label on the profile | app.bsky.actor.profile | see ops log |
| Stripe Directory preview waitlist | registered with agent001@a9n9.net | done 2026-11-05 |

Files live in `~/a9n9/agent001/public/well-known/` (mounted read-only into the web container; `WEB_WELLKNOWN_DIR`).

## ERC-8004: registered on Base and Tempo

**Base (2026-11-06, done).** Arun funded the agent wallet with $2 of ETH and $2 of USDC on Base; `register(string)` on `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` succeeded in tx `0x387056fa644e2d6ee7f1ce6d2540158a382104c3a1f8d19eed293f472a445d52` (block 53990026, 178k gas, under a cent). **agentId 1167546**, owner `0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832`, tokenURI = the registration file. The file now carries `registrations: [{agentId: 1167546, agentRegistry: "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"}]` and `x402Support: true` (the tools service sells over x402 since the same day, see `docs/x402-seller.md`). Explorer: https://erc-8004.quicknode.com (search the id or the owner).

**Tempo (2026-11-06, done).** No separate funding was needed: the agent wallet bridged 1.50 USDC on Base to pathUSD on Tempo through Across (exact approval tx `0x26d29d6f…`, deposit tx `0x54bcbba6…` to the Base SpokePool `0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64`; fee $0.0013; 1.498706 pathUSD arrived at the same address on Tempo in about ten seconds). Then `register(string)` on Tempo mainnet (chain 4217): tx `0x0843e8f60073c10bfb3849971e258b5bfda3f3a61596058d9bced4a850648074`, block 47747568, 1.81M gas paid in pathUSD (about 0.001). **agentId 668**, owner the agent wallet, tokenURI = the registration file. The file carries both entries. Explorer: https://explore.tempo.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432.

**Bridging note.** Across quotes USDC (Base) → pathUSD (Tempo) at about a tenth of a cent for $1.50 (minimum 0.50 USDC) and delivers in seconds; Relay charged about $0.024 for the same. The Across API (`GET app.across.to/api/swap/approval?…`) returns the approval and deposit calldata; use an exact approval instead of the unlimited one it suggests. Status: `GET app.across.to/api/deposit/status?originChainId=8453&depositTxHash=…`.

### Original plan (kept for the Tempo step)

**ERC-8004 identity registration on Base and Tempo.** Same contract address on both chains: Identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, call `register(string agentURI)` with `https://agent001.a9n9.net/.well-known/agent-registration.json`. Base costs under a cent of ETH; Tempo pays fees in a USD TIP-20 token (re-estimate before sending). Sender: the agent's EVM key `0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832` (same address on Base and Tempo), which holds nothing today.

- **Arun:** send about $2 of ETH on Base and about $2 of USDC.e (or pathUSD) on Tempo to `0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832`. Then: `cast send 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "register(string)" "https://agent001.a9n9.net/.well-known/agent-registration.json" --rpc-url https://mainnet.base.org --private-key <from ~/.agentcash/wallet.json>`, repeat with `--rpc-url https://rpc.tempo.xyz`, read `agentId` from the `Registered` log, write both into `registrations` in the JSON, confirm at https://erc-8004.quicknode.com and https://explore.tempo.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432.

## Arun: forms and accounts, longest wait first

### 1. Visa Intelligent Commerce / Trusted Agent Protocol / Agent Registry (months)

No self-serve agent registration exists; it is a commercial onboarding through Visa Developer plus the regional product team. Sandbox connectivity alone is quoted at about 10 business days; certification and production are unstated.

1. Create a Visa Developer account at https://developer.visa.com (business email at visybl.com, legal entity Visybl Inc) and a project with "Visa Intelligent Commerce".
2. Open a support ticket at https://developer.visa.com/support/faqs, subject "Agent Provider onboarding to Visa Intelligent Commerce, Trusted Agent Protocol and the Visa Agent Registry Service". Text:

   > Visybl Inc (Frederick, Maryland) operates agent001, an autonomous software agent at https://agent001.a9n9.net. It signs every HTTP request with an Ed25519 key published per RFC 9421 at https://agent001.a9n9.net/.well-known/http-message-signatures-directory and keeps a public ledger of every action at https://agent001.a9n9.net/ledger.json. We would like to onboard as an Agent Provider: register the agent's signing key with the Visa Agent Registry Service and obtain the Business Identifier and sandbox credentials for Trusted Agent Protocol and Visa Intelligent Commerce. Use cases: the agent pays merchants for data and services on a person's behalf within spending limits, and presents itself to merchant sites as a verified agent. Volume is low (tens of transactions a month). Contact: Arun Nedunchezian, Visybl Inc.

3. Keep the ticket number here. Expect a referral to a regional product team.

**Status 2026-11-05:** Visa Developer account and a Visa Intelligent Commerce project created. There is no ticket form on the site; the "Contact support" link is developer@visa.com. Onboarding request emailed there on 2026-11-05 with the text above (plus a request to be connected to the US regional product team for the BID). A support case was then opened from the signed-in account: **SR#002788878**, same subject, 2026-11-05. Project `a9n9` id 3315dbea-1fd0-4d07-b434-34deedac4d59 (Sandbox; VIC is not in the self-serve product list). Waiting for a reply.

### 2. Mastercard Agent Pay and Agent Pay for Machines (months, request-only)

1. Create a Mastercard Developers account at https://developer.mastercard.com.
2. Open https://developer.mastercard.com/mastercard-agent-pay/documentation/ and click "Request access". Use the same text as Visa's, replacing the programme names with "Agent Pay (agent registration and Agentic Tokens) and Agent Pay for Machines early access"; mention stablecoin settlement on Base and Tempo and that the agent is an x402/MPP seller.
3. Record what the request form asks for; the fields are behind the login.

**Status 2026-11-05:** account and project `a9n9` (id 6bf4950b-ed98-4c5a-9772-08c37f206982, OAuth 1.0a, sandbox credential not yet added) created; company verification in progress. The Agent Pay docs redirect to `/access-request` with one field, "Reason for access"; submitted 2026-11-05 with the text above. Waiting for a reply.

### 3. Cloudflare Verified Bots (BotBase) (days to weeks)

**Submitted 2026-11-02** from the a9n9 Cloudflare account. Status: check Submission history in the dashboard, or run `~/a9n9/agent001/bin/sign-test` (Cloudflare's crawltest.com answers 401 until the bot is Accepted). If it comes back Rejected, resubmit with the answers below.

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

**Status 2026-11-05:** form submitted (Arun). Waiting for a reply.

### 5. Fingerprint "Submit your bot" (1 to 2 weeks)

https://dashboard.fingerprint.com/submit-bot (needs a Fingerprint account). Directory URL and User-Agent as above; `Signature-Agent` is sent as `"https://agent001.a9n9.net"`. Questions: bot-registration@fingerprint.com.

**Status 2026-11-05:** submitted for review from workspace `a9n9` (Arun). Reply comes from support@fingerprint.com.

### 6. DataDome verified bot (unstated)

https://datadome.co/resources/ai-agent-verification/ (Web Bot Auth form). Same answers, type "Autonomous Agent". The form requires an IP-ranges URL: `https://agent001.a9n9.net/.well-known/ip-ranges.json` (advisory, current egress /32; refreshed hourly by `scripts/ip-ranges-refresh.sh` from the host crontab).

**Status 2026-11-05:** form submitted (Arun); DataDome acknowledged with "one of our experts will come back to you shortly". Waiting for a reply.

### 7. Stripe Directory for machine payments (weeks)

Preview waitlist: done. Then email machine-payments@stripe.com with: business name Visybl Inc; Stripe account id (from the Dashboard); Stripe profile **@a9n9** (https://stripe.com/@a9n9, claimed 2026-11-05; Profile ID `profile_61VhpLZJIPyq8YDNtA6VhpLZ83SQsBKZnSBXCwGMKCXA`); link https://agent001.a9n9.net/llms.txt; accepts stablecoins (Tempo USDC.e) and cards via payment links; example prompts: "check whether this page still says X", "what changed in stablecoin rules this week", "fact-check this draft". Prerequisite: enable "Stablecoins and Crypto" in the Dashboard payment methods (Stripe reviews access). **Status 2026-11-05:** toggled on, pending Stripe verification. Blocker for MPP listings: `tools.a9n9.net` hostname is not created yet (Mac session).

**Reply 2026-11-05 (machine-payments@stripe.com, Lindsay):** agent001 added for Directory review. They already have the account ID, llms.txt and agent details. Still wanted, once the paid integration is ready: the full Stripe Profile ID (`profile_61VhpLZJIPyq8YDNtA6VhpLZ83SQsBKZnSBXCwGMKCXA`, read from the Dashboard by Arun 2026-11-05) and the exact production MPP or x402 payment endpoint. Directory listing and payment enablement are separate; build and test the payment flow without waiting for the listing. Action: send the Profile ID together with the endpoint when play 3 is live (`tools.a9n9.net` + CDP key).

**Update 2026-11-06 (Stripe email to Arun):** profile payments are enabled: "You can now receive funds as @a9n9. Other businesses on Stripe can now send funds directly to your profile." Funds land in the account's payout bank. This is the payment-enablement half; the Directory listing review is still separate and still open. Still owed to machine-payments@stripe.com: the production MPP or x402 endpoint once play 3 is live.

**Attribution of profile payments (2026-11-06, Arun's question "how do we know which agent got paid?"):** the whole fleet shares one Stripe account and one handle, so a payment to @a9n9 says nothing about the agent by itself. Three routes, in order of preference:

1. Pay links (default): every link carries `metadata.agent` and `metadata.offer` (standing links tagged 2026-11-06), per-job links also `metadata.job`; the webhook records them. Attribution is automatic.
2. Profile pay link: `https://buy.stripe.com/3cIbIUcsLfUHfz29Hpbsc05` ("Payment to an a9n9 agent", customer chooses the amount, required field "Which agent and job is this for?"). Attached to the profile by Arun on 2026-11-06, so a business that finds @a9n9 pays through it and the answer lands in the webhook's `custom_fields`.
3. Direct profile transfer (`stripe pay @a9n9 …`): the sender's only field the recipient sees is a memo of at most 22 ASCII characters, and the money goes straight to the payout bank, not through the Stripe balance, so no webhook fires. Convention: the agent gives the payer the memo code from `bin/jobs` (`A001 J12 FACT`); the operator credits it from the bank statement by hand. Exception route only.

### 8. MAS BuildFin "Know Your Agent" (no programme yet)

Interest form https://go.gov.sg/buildfin-registration as a technology provider (agent identity and eCash). Ten minutes; no expected return before 2027.

**Status 2026-11-06:** submitted (Arun) with the one-pager PDF (`docs/a9n9-agent001-one-pager.pdf`). Response ID 6aedf724a65ac3699131e270, 2026-11-06 15:49Z.

### 9. GitHub organisation verified domain (72 hours)

Only if a9n9 gets its own GitHub organisation: Settings → Verified and approved domains → add `a9n9.net` → DNS TXT (Mac session) → verify.

## Scriptable later (no human)

- Sign the A2A agent card (`signatures` with the Ed25519 key, `jku` = the key directory).
- x402 Bazaar / Agentic.Market: automatic after the first settled payment through the Coinbase facilitator (play 3; see `docs/research/2026-11-05/10-x402-seller-setup.md`).
- mpp.dev services PR and MPPScan registration once `tools.a9n9.net` is live.
- AWS WAF and Akamai poll the key directory; nothing to submit.

## Log

- 2026-11-06: play 3 live: tools.a9n9.net sells every route over x402 on Base mainnet (docs/x402-seller.md). Profile ID + production x402 endpoint sent to machine-payments@stripe.com by Arun the same day; Directory listing decision pending.
- 2026-11-08: Stripe re-sent the Nov 5 Directory reply (same text: Profile ID + production endpoint wanted). Arun replied again the same day with profile_61VhpLZJIPyq8YDNtA6VhpLZ83SQsBKZnSBXCwGMKCXA, the production endpoint POST https://tools.a9n9.net/v1/reserves (402 with x402 v2 + MPP challenges, Base mainnet, CDP facilitator) and the route list at https://tools.a9n9.net/.well-known/x402 (8 routes). Listing decision still with the MPP team.

- 2026-11-13: OpenRouter for Startups was in fact **declined on 2026-11-06**, three minutes after the application ("Update on your OpenRouter for Startups application", startups@openrouter.ai to agent001@a9n9.net): "The email address on your application does not match the domain from the company website provided." The agent's respond job dismissed the mail as automated, so nobody saw it. Follow-up sent 2026-11-13 from agent001@a9n9.net on the same thread: both domains are Visybl Inc's (each site names the other), asks for a re-review with a9n9.net as the website or word on which resubmission they want. If no answer by 2026-11-18: re-apply with website https://a9n9.net and the agent001@a9n9.net account (Arun submits; the partner code is his). Programme rules also ask for: pre-series B, AI-native product full-time, partner referral, under $500 lifetime spend.
- 2026-11-06: OpenRouter for Startups application submitted (Brex partner code, account agent001@a9n9.net); decision in 3-5 business days; credits and waived fees apply automatically if approved.

- 2026-11-06: MAS BuildFin interest form submitted (response ID 6aedf724a65ac3699131e270).

- 2026-11-06: Stripe profile payments enabled on @a9n9 (other Stripe businesses can send funds to the profile). Directory listing still in review.

- 2026-11-05 (later): Stripe Directory reply received; profile_ id and production endpoint owed once play 3 is live.
- 2026-11-05: Visa onboarding request emailed to developer@visa.com and case SR#002788878 opened (Arun). Mastercard Developers account and project a9n9 created, Agent Pay access request prepared. Well-known documents published; Stripe Directory waitlist joined; Bluesky bot label set (see ops log); this checklist written.
