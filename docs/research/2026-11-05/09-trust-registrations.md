# agent001 trust & identity registrations — execution checklist (as of 2026-11-04)

Scope: register `agent001` (a9n9 / Visybl Inc, MD) with every established trust/identity program whose approval takes time, so approvals accumulate in parallel. Every item below was checked by opening the primary page (WebFetch, headless Chrome, raw GitHub, JSON-RPC, or the Bluesky public API) — not from search snippets. Items I could not confirm are marked **UNVERIFIED**.

Already true about agent001 (checked live 2026-11-04):
- `https://agent001.a9n9.net/.well-known/http-message-signatures-directory` returns 200 with `Content-Type: application/http-message-signatures-directory+json`, a JWKS `{"keys":[{"kty":"OKP","crv":"Ed25519","x":"GY0B…E6_4","kid":"H6QiDPV7xqd7RkD635Pft7DcUf7jc5snoTjQ-gvBnzc","use":"sig","alg":"EdDSA"}]}`, and `Signature`/`Signature-Input` headers with `tag="http-message-signatures-directory"`, `keyid` = JWK thumbprint, `("@authority";req)`, 300 s expiry. This already satisfies Cloudflare's, Fingerprint's and Akamai's directory requirements as documented.
- `/robots.txt` exists (Content Signals block).
- NOT present (404): `/.well-known/agent-card.json`, `/.well-known/agent-registration.json`, `/.well-known/nostr.json`, `/.well-known/web-bot-public-key.json`, `/llms.txt`.

Legend: **[H]** needs a human (login/CAPTCHA/KYC/sales call) · **[S]** scriptable by the agent tonight · **[H→S]** human does a one-time signup, rest scriptable.

---

## Part A — longest wait first (start tonight, approvals accumulate)

### A1. Visa Intelligent Commerce (VIC) + Trusted Agent Protocol (TAP) + Visa Agent Registry Service (VARS) — months **[H]**
Pages opened: `https://developer.visa.com/capabilities/visa-intelligent-commerce`, `…/visa-intelligent-commerce/docs-getting-started`, `https://developer.visa.com/capabilities/trusted-agent-protocol`, `https://developer.visa.com/docs/trusted-agent-protocol/trusted-agent-protocol-specifications` (rendered in Chrome), `https://developer.visa.com/docs/trusted-agent-protocol/product-terms` (rendered), `https://github.com/visa/trusted-agent-protocol` + raw `agent-registry/README.md`.

What the pages say:
- TAP docs are written for **merchants / site-protection providers**, not agent operators ("Available for use by: Merchants, Independent developers"). Agent Providers are defined as "certified AI platforms that have been onboarded as an 'Agent' to Payment Schemes and are approved and trusted by the respective Payment Schemes". There is **no self-serve agent registration form** anywhere on the TAP pages.
- The VIC getting-started page is the actual onboarding path for an agent operator: "Production access requires onboarding to Visa Intelligent Commerce and completion of applicable Visa onboarding processes"; also onboard to TAP, Visa Token Service (VTS), Visa Payment Passkeys; "You must also complete registration through the Visa Agent Registry Service (VARS)" (lets Visa "validate your agent signatures and merchant encryption keys"). Prereqs before first call: Visa Developer account/project; Visa-provisioned `externalClientId` (TRID) and `externalAppId` via VTS; a Business Identifier (BID) "obtained from your regional product team"; mutual-TLS client cert; onboarded asymmetric public key (JWE); Passkeys with device binding. Card eligibility: tokenizable, CTF-enrolled cards only.
- Environments: Sandbox (`sandbox.api.visa.com`) — "establishing connectivity takes approximately 10 business days"; then Certification (CTE); then Production. "Each environment requires Visa approval before you move to the next." No cost or further timelines stated.
- TAP signature format (for when we're in): RFC 9421, Ed25519, components `("@authority" "@path")`, params `created, expires, keyid, alg="Ed25519", nonce, tag="agent-browser-auth"|"agent-payer-auth"`. `keyid` is a JWK thumbprint; the merchant retrieves keys from a "Key Store" — Visa-run `GET /keys?keyID=` returning a JWK (`kty, kid, use, alg, …`). There is **no `Signature-Agent` header / self-hosted key directory in Visa's model**: keys are onboarded to Visa and served by Visa. (The GitHub `agent-registry` is a local sample: `POST /agents/register` with `name, domain, public_key, algorithm ("ed25519" = 44-char base64 raw key), key_id, description`.)
- Product terms (Oct 10, 2025): license to implement the spec; "You may implement the Specification … in Your production environment without the need to submit such use case to Visa for review" — that covers the *merchant/verifier* side, not being an approved Agent. Must update implementation within 6 months of any Visa Update.
Steps:
1. [H] Create a Visa Developer account (`developer.visa.com` → Sign up; business email, legal entity = Visybl Inc) and a project with "Visa Intelligent Commerce".
2. [H] Email/contact the regional product team for a BID + TRID (no public form; use VDP Support `https://developer.visa.com/support/faqs` → open a ticket, state "Agent Provider onboarding to VIC/VARS").
3. [H] Expect ~10 business days just for sandbox connectivity; certification/production: unstated (months).
Cost: not stated (VTS/VIC onboarding is a commercial agreement). What approval gives: agent001's Ed25519 key served from Visa's Key Store → merchants/CDNs recognise it as a "Visa-approved agent"; access to tokenised card credentials via VTS.

### A2. Mastercard Agent Pay / Agent Pay for Machines / Verifiable Intent — months, request-only **[H]**
Pages opened: `https://developer.mastercard.com/mastercard-agent-pay/documentation/…` (all three URLs redirect in Chrome to `https://developer.mastercard.com/account/log-in` showing "Almost there... Mastercard-agent-pay — You can request access for this page after logging in with your Mastercard Developers account"); `https://github.com/agent-intent/verifiable-intent`; `https://cryptobriefing.com/mastercard-agent-pay-machines-early-access/`; `https://coinmarketcap.com/academy/article/mastercard-agent-pay-machines-early-access`. (Mastercard press pages returned 403 to WebFetch.)
What the pages say:
- The Agent Pay docs (incl. "Verifiable Intent", "Card Enrollment", "Tutorials and Guides / Onboard to Sandbox") are **gated**: log in to Mastercard Developers, then click "request access" on the product. No published criteria.
- Agent Pay for Machines: early access opened **Oct 20, 2026** (Cloudflare Connect); includes buyer-side + seller-side APIs, toolkit, sandbox, docs; "pilot phase", no pricing, no GA date. Pilot partners: Cloudflare, Coinbase/CDP, Base, BVNK, Ant International, AIsa, Hype. No public sign-up URL found — **UNVERIFIED** whether a form exists beyond the gated "request access".
- Verifiable Intent (open-sourced Mar 5, 2026, Apache-2.0, Draft v0.1): layered SD-JWT credentials — L1 credential provider→user (~1 yr), L2 user→agent (15 min immediate / 24 h–30 d autonomous), L3 agent-signed split tokens (~5 min). README says "credential provider enrollment" and "key management/provisioning" are out of scope — **no agent-developer registry is defined in the spec**. Secondary sources claim Mastercard enrolls agents and issues an agent ID tied to a KYC'd entity — **UNVERIFIED**.
Steps:
1. [H] Create a Mastercard Developers account (`developer.mastercard.com` → Sign up; email, password; SSO/passkey available).
2. [H] Open `https://developer.mastercard.com/mastercard-agent-pay/documentation/` → "Request access" (fields unknown until logged in — **UNVERIFIED**).
3. [H] In parallel, email the Agent Pay for Machines early-access contact (none published; use the developer portal Support/Forum) stating: operator Visybl Inc, agent001, stablecoin settlement on Base/Tempo, x402/MPP seller side.
4. [S] Meanwhile implement Verifiable Intent L3 signing with agent001's key from the public spec so we're ready.
Cost: none published. Wait: weeks–months. What it gives: Agent Pay agent ID / registry entry, sandbox for Agent Pay for Machines.

### A3. HUMAN Security — "Request Verification for Your AI Agent" — weeks **[H]**
Pages opened: `https://www.humansecurity.com/ai-agent-verification/` (rendered in Chrome; the page 403s to non-browser fetchers), `https://github.com/HumanSecurity/human-verified-ai-agent` README (via gh api).
Form fields (exact, `*` = required): `First Name*`, `Last Name*`, `Work Email*`, `Company Name*`, `Homepage or GitHub*`, `AI Agent Name*`, `AI Agent Type*` (Browser-based / API-native / OSS crawler), `Where's your ".well-known/web-bot-public-key.json"?*`, `IP Range`, `User Agent:`, `Anything else we should know?`. Marketo form, marketing-consent text, **no CAPTCHA detected** in the DOM (no reCAPTCHA/hCaptcha/Turnstile iframe) — but it's a sales-lead form, so a human follow-up is likely. README: "If you are a commercial AI agent company … please contact us to submit a verification request via this email: agent.verification@humansecurity.com". README also: "No agent registry or certificate authority currently exists in production for this protocol"; public keys are "registered with HUMAN's verification service using the same key_id" (JWK thumbprint); recommended components `["@authority","signature-agent"]`; `Signature-Agent` points to the domain hosting the keys.
Steps:
1. [S] Serve `https://agent001.a9n9.net/.well-known/web-bot-public-key.json` (HUMAN's asked-for path; format not documented — **UNVERIFIED**; safest: serve the same JWKS as the signatures directory at that path too).
2. [H] Submit the form (Arun's name/work email; Homepage = `https://agent001.a9n9.net`; type = API-native; key URL; UA string agent001 sends).
3. [S] Also email agent.verification@humansecurity.com with the same info.
Cost: free. Wait: unstated (weeks, sales-qualified). Gives: trust-score bump / allow on HUMAN-protected sites.

### A4. Fingerprint — "Submit Your Bot" — 1–2 weeks **[H]**
Page opened: `https://docs.fingerprint.com/docs/bot-detection/web-bot-auth-implementation`.
Requirements: key directory at `/.well-known/http-message-signatures-directory` ("the full path is a requirement"), JWKS with `kty, crv, kid, x`, HTTPS, `Content-Type: application/http-message-signatures-directory+json`. `Signature-Agent` must be `https://`, bare domain (no path/query), double-quoted, no sf label (e.g. `"https://agent001.a9n9.net"`).
Steps: [H] log in to `https://dashboard.fingerprint.com/submit-bot` (needs a Fingerprint account; fields not listed — **UNVERIFIED**), submit; "please wait 1-2 weeks for the agent registration"; confirmation email. Questions: bot-registration@fingerprint.com. Cost: free. Gives: agent001 classified as a verified bot by Fingerprint customers.

### A5. Cloudflare Verified Bots (BotBase) incl. former "Signed Agents" — days to several weeks **[H→S]**
Pages opened: `https://developers.cloudflare.com/bots/concepts/bot/verified-bots/`, `…/verified-bots/policy/`, `…/verified-bots/web-bot-auth/`, `https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/`, `https://blog.cloudflare.com/signed-agents/`, `https://blog.cloudflare.com/botbase-for-operators/` (Aug 28, 2026), `https://github.com/cloudflareresearch/web-bot-auth`, IETF `draft-meunier-web-bot-auth-architecture` (archived) and `draft-meunier-webbotauth-registry-03`. (`/bots/reference/verified-bots-form/` and `/bots/reference/verified-bots-policy/` are 404; `radar.cloudflare.com/bots` 403 to fetcher.)
- **Form URL:** `https://dash.cloudflare.com/?to=/:account/application-security/botbase/form` (dashboard → Protect & Connect → Application Security → BotBase; older docs path: Manage Account → Configurations → "Bot Submission Form" tab). Requires a Cloudflare account (free plan is fine; "All customers can access this today"). Track at `https://dash.cloudflare.com/?to=/:account/application-security/botbase/history`.
- **Fields documented across the pages:** who operates it; what the bot does — select every **behavior** that applies (Search, Agent, Training, Transact, Data Collection, Security Testing, SEO, Ads Verification, Social / Link Preview, Feed Fetching, Monitoring & Operations); how it uses content (Content Signals levels); who runs it — **Direct** (single operator) vs **Intermediary** (end-user-directed agentic service; the old "signed agents" list — "Signed agents are now Verified", effective Jul 1, 2026); **Verification Method** = `Request Signature` (Web Bot Auth) or IP validation; **Validation Instructions** = the key directory URL, plus optional User-Agent values and match patterns. The full field list isn't published outside the logged-in form — **UNVERIFIED** (likely also bot name, public documentation URL, contact email).
- **CAPTCHA:** not documented; the form sits behind dashboard login. **UNVERIFIED.**
- **Request Signature requirements (exact):** directory at `/.well-known/http-message-signatures-directory` over HTTPS; `Content-Type: application/http-message-signatures-directory+json`; one `Signature` per key on the directory response with `Signature-Input` params `tag="http-message-signatures-directory"`, `keyid`=JWK thumbprint (RFC 7638/8037 A.3), `created`, `expires`, `@authority;req`; only `kty/crv/x` read; never include `d`. Requests: `Signature-Agent: "https://agent001.a9n9.net"` (sf-string, https, double quotes, **not** the dictionary form `sig2="…"`), `Signature-Input: sig2=("@authority" "signature-agent");created=…;keyid=…;alg="ed25519";expires=…;nonce=…;tag="web-bot-auth"`, short expiry ("A minute is often sufficient"); unsupported: `@query-params`, `@status`, params `sf,bs,key,req,name`; ASCII only. → **agent001's directory already passes all of this** (checked live).
- **Signature-Agent Card (registry draft -03, Cloudflare+Amazon):** a JSON doc dereferenced from a `client_id` HTTPS URL (found via `Signature-Agent` member with `type=cimd`, a registry, or out-of-band); fields `client_id` (required when resolved), `client_name`, `client_uri`, `logo_uri`, `contacts` (`mailto:`), `jwks_uri` **or** inline `jwks`, and a `web_bot_auth` object: `expected-user-agent`, `rfc9309-product-token`, `rfc9309-compliance`, `trigger` (`fetcher`|`crawler`), `purpose`, `targeted-content`, `rate-control` (TODO), `rate-expectation` (TODO), `known-urls`, `ips_uri`. No well-known path is mandated; served as `application/json`, must return 200, no redirects, `client_id` in body must equal the URL. A **registry** is a plain text file: one card URL per line (`https:` or `data:`), `#` comments. Cloudflare's form does not ask for a card today (not in any doc) — publishing one is optional future-proofing.
- **Review:** automated checks first (duplicate bot, UA pattern specificity/overlap, verification method fetch — "validates the Web Bot Auth signature"); pass → tracked right away; else routed to humans. Statuses: Waiting For Review / Accepted / Rejected (reason + steps shown) / Cancelled. Old policy text: "up to several weeks"; now "most submissions move faster than before" — no SLA.
Steps:
1. [S] Publish a signature-agent card at `https://agent001.a9n9.net/.well-known/signature-agent-card.json` (any URL works; set `client_id` to that URL, `jwks_uri` = the directory URL, `contacts`, `web_bot_auth.expected-user-agent`, `trigger:"fetcher"`, `purpose`, `known-urls`). Optional.
2. [H] Log in to Cloudflare (the a9n9 account), BotBase → Submit: behaviors = Agent + Transact (+ Monitoring & Operations), operator = Direct, Verification Method = Request Signature, Validation Instructions = `https://agent001.a9n9.net/.well-known/http-message-signatures-directory`, UA pattern agent001 actually sends.
3. [S] Make sure agent001 sends `Signature-Agent` + `tag="web-bot-auth"` on every outbound request *before* submitting (Cloudflare validates live).
Cost: free. Gives: listed in BotBase + Cloudflare Radar bots & agents directory; allowed through "AI Crawler and Agent access policies" on sites that admit verified agents.

### A6. DataDome — Verified Bot / AI agent form — unstated **[H]**
Page opened: `https://docs.datadome.co/docs/bot-authentication`. Requirements: dedicated User-Agent; an auth method (Web Bot Auth RFC 9421, reverse DNS, static IP list, dynamic IP list file, private AS); submit via `https://datadome.co/resources/bot-and-ai-agent-verification/` (general) or `https://datadome.co/resources/ai-agent-verification/` (Web Bot Auth). Fields not listed — **UNVERIFIED**. Cost/time not stated. Gives: "Verified Bot" category across DataDome customers.

### A7. Stripe Directory listing for an MPP seller (agent001 as a payable service) — weeks (preview, email-gated) **[H→S]**
Pages opened: `https://docs.stripe.com/agentic-commerce`, `https://docs.stripe.com/payments/machine`, `https://docs.stripe.com/directory`.
Exact path ("Submit your integration"): email **machine-payments@stripe.com** with: business name; Stripe account ID; Stripe profile ID (claim at `https://docs.stripe.com/get-started/account/profile`); link to `llms.txt` + any agent skills; whether you accept SPTs, stablecoins, or both; 1–3 example prompts. Directory preview waitlist: `curl https://docs.stripe.com/preview/register -X POST -H "Content-Type: application/json" -H "Referer: https://docs.stripe.com/directory" -d '{"email":"EMAIL","preview":"stripe_directory_mcp_server_listing_preview"}'` (scriptable). Prereqs: Stripe account (Visybl's exists), publish a public Stripe profile (`stripe.com/@handle`), enable "Stablecoins and Crypto" payment method in Dashboard → Stripe reviews access (MPP stablecoins: Tempo USDC.e, Solana USDC; x402: Base USDC; US businesses except NY). Stripe Directory indexes "Machine payments endpoints: Pay-per-call APIs on mpp.dev". Cost: Stripe fees only. Gives: agent001 discoverable/payable via `stripe directory search`.

### A8. GitHub organization domain verification ("Verified" badge) — ≤72 h DNS, then instant **[H→S]**
Page opened: `https://docs.github.com/en/organizations/managing-organization-settings/verifying-or-approving-a-domain-for-your-organization`. Steps: org Settings → Security → Verified and approved domains → Add a domain (`a9n9.net`) → add the DNS TXT record GitHub shows (name/value generated per org) → wait ("may take up to 72 hours") → Continue verifying → Verify. Org profile website/email must match the domain. Cost: free. Gives: "Verified" badge on the GitHub org.

### A9. MAS BuildFin.ai "Know Your Agent" (Visa + Mastercard + Ant) — no application exists **[H, long shot]**
Pages opened: `https://www.theasianbanker.com/press-releases/ant-international-mastercard-and-visa-initiate-collaboration-on-know-your-agent-interoperability-to-scale-agentic-commerce` (10 Sep 2026), `https://www.mas.gov.sg/schemes-and-initiatives/buildfinai` (buildfin.ai redirects there).
Finding: KYA is an early-stage principles effort (operator traceability, shared certification requirements, continuous monitoring) built on MAS's SAFR framework; "will now explore opportunities to work towards common principles"; **no application, pilot sign-up or registry**. BuildFin.AI itself is for "Financial institutions… Technology providers… Research institutions"; the only entry point is a registration/interest form `https://go.gov.sg/buildfin-registration` (fields not seen — **UNVERIFIED**). Action: [H] submit interest as a technology provider (Visybl / picocash: agent identity + eCash) — zero expected return before 2027; worth 10 minutes.

### A10. Anthropic Claude Connectors Directory / OpenAI ChatGPT apps — if agent001 exposes an MCP server **[H]**
Opened via search only (not primary pages) — **UNVERIFIED details**: Anthropic submission at `https://claude.com/docs/connectors/building/submission` (portal in Claude.ai admin settings; docs say Team/Enterprise org required, FAQ says any org; needs server name, URL, tagline, description, use cases, auth type, transport; tools need `title` + `readOnlyHint`/`destructiveHint`). OpenAI Apps SDK submissions open since Dec 2025, human review. Both are human + review; only worth it if agent001 ships a public remote MCP server.

---

## Part B — free and scriptable tonight (no human in the loop)

### B1. ERC-8004 Identity Registry — register on Base mainnet and Tempo mainnet **[S]**
Pages opened: `https://eips.ethereum.org/EIPS/eip-8004`, `https://erc-8004.quicknode.com/docs/contracts`, `https://erc-8004.quicknode.com/tutorials/register-agent`; plus live JSON-RPC checks (`eth_chainId`, `eth_getCode`, `cast estimate`) against `https://mainnet.base.org` and `https://rpc.tempo.xyz`. (`docs.base.org/ai-agents/reference/contracts` now redirects to a CDP migration notice; `erc-8004-contracts/config/chains.yml` raw 404 — chain list taken from QuickNode's page.)
- **Addresses (CREATE2, identical on every mainnet):** Identity `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, Reputation `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`, Validation `0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58` (mainnet-pending per QuickNode). Testnets: Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e`.
- **Verified live:** Base (`eth_chainId`=0x2105=8453) and Tempo (`eth_chainId`=**0x1079 = 4217**) both return bytecode at the Identity and Reputation addresses. QuickNode lists Tempo mainnet Identity deploy block 13,955,753 and Tempo Testnet 12,189,608.
- **Call:** `register(string agentURI) returns (uint256 agentId)` selector `0xf2c298be`; also `register()` `0x1aa3a008` and `register(string, MetadataEntry[] (string metadataKey, bytes metadataValue))`. Emits `Registered(uint256 indexed agentId, string agentURI, address indexed owner)`; agentId is the ERC-721 tokenId; `setAgentURI()` later.
- **Gas (measured with `cast estimate --from 0x…dEaD`, URI = `https://agent001.a9n9.net/.well-known/agent-registration.json`):** Base **163,292 gas** at gas price 0.006 gwei → ≈ 1e-6 ETH (well under $0.01). Tempo returned **1,842,232 gas** at `eth_gasPrice` 0.6 gwei — anomalously high vs Base (likely estimator behaviour for an unfunded `from`; Tempo fees are paid in a USD TIP-20 via the fee mechanism) — **re-estimate from the funded agent001 wallet before sending; UNVERIFIED cost on Tempo**.
- **Registration file JSON (EIP text):** `type` = `https://eips.ethereum.org/EIPS/eip-8004#registration-v1`, `name`, `description`, `image`, `services` [{`name` (web/A2A/MCP/OASF/ENS/DID/email), `endpoint`, opt `version`, `skills`, `domains`}], `x402Support` (bool), `active` (bool), `registrations` [{`agentId`, `agentRegistry`: `eip155:<chainId>:<identityRegistry>`}], optional `supportedTrust`. Serve at `agentURI` (https or ipfs).
- **Domain binding:** `https://agent001.a9n9.net/.well-known/agent-registration.json` containing at least `{"registrations":[{"agentId":N,"agentRegistry":"eip155:8453:0x8004A169…"},{"agentId":M,"agentRegistry":"eip155:4217:0x8004A169…"}]}` (or the full file). Not needed when the endpoint domain = the domain serving the agentURI, but publish it anyway.
- **Explorers:** `https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, `https://explore.tempo.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (200 OK), aggregator `https://erc-8004.quicknode.com/agents/<network-slug>/<tokenId>` (indexing "typically under a minute").
Steps tonight: (1) publish registration JSON at the agentURI with `registrations` left empty → (2) `cast send … "register(string)" <uri>` on Base, then Tempo → (3) decode agentIds from the `Registered` log → (4) rewrite the JSON + `.well-known/agent-registration.json` with both registrations → (5) confirm on explorers.

### B2. A2A Agent Card at `/.well-known/agent-card.json` **[S]**
Pages opened: `https://a2a-protocol.org/latest/specification/` (sections 4.4, 8, 14.3). Exact URI: `https://agent001.a9n9.net/.well-known/agent-card.json` (IANA well-known suffix `agent-card.json`, "MUST return an AgentCard"). Required fields: `name`, `description`, `supportedInterfaces` (array of AgentInterface: `url`, `protocolBinding`, `protocolVersion`), `version`, `capabilities` (`streaming`, `pushNotifications`, `extendedAgentCard`), `defaultInputModes`, `defaultOutputModes`, `skills` (AgentSkill[]). Optional: `provider`, `documentationUrl`, `securitySchemes`, `securityRequirements`, `iconUrl`, `signatures` (AgentCardSignature: `protected` base64url JWS header with `alg`, `kid` required, `typ:"JOSE"`, optional `jku`; `signature`; canonicalise with RFC 8785 before signing — sign with the Ed25519 key, `jku` = our JWKS directory). No central A2A registry exists in the spec. AP2 (`https://ap2-protocol.org/`, `https://github.com/google-agentic-commerce/AP2`) has **no registry or onboarding** — it's an A2A extension + FIDO working groups; nothing to register.

### B3. Nostr: NIP-05 identifier + NIP-24 `bot: true` **[S]**
Pages opened: `https://github.com/nostr-protocol/nips/blob/master/24.md`, `…/05.md`. Serve `https://agent001.a9n9.net/.well-known/nostr.json?name=_` → `{"names":{"_":"<hex pubkey>"},"relays":{"<hex pubkey>":["wss://…"]}}` with `Access-Control-Allow-Origin: *`, no redirects; then publish kind-0 with `"nip05":"_@agent001.a9n9.net"` (shown as `agent001.a9n9.net`), `"bot": true` ("a boolean to clarify that the content is entirely or partially the result of automation"), `name`, `display_name`, `website`, `picture`, `banner`. Free, instant.

### B4. Bluesky automation ("bot") label **[S]**
Verified via the Bluesky public API thread `at://bsky.app/app.bsky.feed.post/3mhgg5ja5gc2w` (2026-03-19: "Bot labels are here… mark it as such in your account settings… Settings → Account → Automation label… For now, bot labels are voluntary") and the app source `bluesky-social/social-app/src/screens/Settings/AutomationLabelSettings.tsx`. Mechanism: a **self-label `bot`** on the `app.bsky.actor.profile` record: `labels: {"$type":"com.atproto.label.defs#selfLabels","values":[{"val":"bot"}]}`. Scriptable with `com.atproto.repo.getRecord` + `putRecord` (collection `app.bsky.actor.profile`, rkey `self`) using the agent's app password. Shows on profile and posts; `profile.labels[].src == own DID`.

### B5. mpp.dev services directory + MPPScan (agent001 as an MPP seller) **[S]**
Pages opened: `https://mpp.dev/services`, `https://github.com/tempoxyz/mpp/blob/main/.github/PULL_REQUEST_TEMPLATE/service.md`, `https://www.mppscan.com/register`.
- mpp.dev: open a PR editing `schemas/services.ts` using the template — fields: **Service name, Live service URL, Provider URL, OpenAPI or API reference URL**; checklist: live + accepts MPP payments; endpoints/prices/payment methods match; stable docs + icon URLs; `pnpm generate:discovery`, `pnpm check:types`, `pnpm build` pass; sections Integration / Payment methods and intents / Provider relationship / Directory fit. Curated: "may decline duplicate or incomplete listings". Free; human maintainer review (days).
- MPPScan: single field (`https://` URL) + "Add API" button at `https://www.mppscan.com/register`; free; instant (web form, no CAPTCHA seen in text — **UNVERIFIED**).
- Also add `https://agent001.a9n9.net/llms.txt` (Stripe Directory asks for it).

### B6. x402 Bazaar / Agentic.Market (if agent001 sells over x402 on Base) **[S]**
Pages opened: `https://docs.cdp.coinbase.com/x402/bazaar`, `https://agentic.market/` (search-only for `…/x402/seller/get-discovered`). No registration: listing is automatic once the endpoint advertises Bazaar metadata with a valid input schema and **at least one payment has settled through the CDP facilitator**; Agentic.Market reads the same catalog (4,197 services, "No registration"). Free.

### B7. AWS WAF Bot Control / Akamai — nothing to submit **[S: already done by having the directory]**
Pages opened: `https://aws.amazon.com/blogs/security/authenticate-legitimate-ai-agent-traffic-with-aws-waf-bot-control`, `https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-browser-web-bot-auth-preview`, `https://www.akamai.com/blog/security/redefine-trust-web-bot-authentication`. AWS WAF "regularly polls these directories and maintains a valid key registry"; "registration APIs are on the roadmap" for non-AgentCore agents (no form today). AgentCore Browser registers identities only for agents it hosts. Akamai validates the directory at request time and classifies as "validated-bot traffic"; no operator form found — **UNVERIFIED** whether an allowlist submission exists.

### B8. Signature-agent card + registry file **[S]** — see A5 step 1; also publish `https://agent001.a9n9.net/.well-known/signature-agents` registry (one line: the card URL) so we are our own registry.

---

## Summary table

| # | Program | Who | Wait | Cost | Status/notes |
|---|---|---|---|---|---|
| A1 | Visa VIC/TAP/VARS | H | ≥10 bd sandbox; months | unstated | no self-serve; needs regional product team |
| A2 | Mastercard Agent Pay / AP4M / VI | H | months | unstated | docs gated: "request access" after login |
| A3 | HUMAN AI agent verification | H | weeks | free | form fields captured; email alt. |
| A4 | Fingerprint submit-bot | H | 1–2 wk | free | dashboard login |
| A5 | Cloudflare BotBase | H→S | days–weeks | free | directory already compliant |
| A6 | DataDome | H | unstated | free | two forms |
| A7 | Stripe Directory (MPP seller) | H→S | weeks | Stripe fees | email + curl waitlist |
| A8 | GitHub org verified domain | H→S | ≤72 h | free | DNS TXT |
| A9 | MAS BuildFin KYA | H | n/a | free | interest form only |
| A10 | Anthropic/OpenAI directories | H | weeks | free | only if MCP server |
| B1 | ERC-8004 Base + Tempo | S | minutes | <$0.01 Base; Tempo re-estimate | code verified on both chains |
| B2 | A2A agent-card.json | S | instant | free | sign with Ed25519 |
| B3 | NIP-05 + bot:true | S | instant | free | |
| B4 | Bluesky `bot` self-label | S | instant | free | putRecord |
| B5 | mpp.dev PR + MPPScan | S | days / instant | free | |
| B6 | x402 Bazaar | S | after 1st settlement | free | automatic |
| B7 | AWS WAF / Akamai | S | n/a | free | directory polled |
| B8 | Signature-agent card | S | instant | free | draft-03 format |

Pages opened (primary): 45+ (Cloudflare 7, IETF 2, Visa 7, Mastercard/VI 4, MAS 2, EIP/QuickNode 3 + 2 RPCs, Stripe 3, mpp/mppscan 3, Nostr 2, A2A/AP2 3, AWS 2, DataDome 1, Fingerprint 1, Akamai 1, HUMAN 2, Bluesky API + source 2, GitHub docs 1, Agentic.Market/x402 2, agent001 7 well-known probes).
