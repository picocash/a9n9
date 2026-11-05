# Agent-to-agent and agent-to-service commerce: rails, real volumes, who pays (2025–2026)

Research thread 04 for a9n9 / picocash. Date: 2026-11-04. All figures carry the date and the page I opened; "unverified" marks claims I could only find in secondary or self-reported form. Headline first: **the only rail with measurable, organic, agent-to-service revenue today is x402 on Base, and genuine commerce there is roughly $1M/month, of which one inference reseller takes about a fifth.** Everything card-network-shaped is still "hundreds of transactions" and pilots; MPP has settled a few thousand dollars in total since launch; Lightning/L402 has no published volume at all.

## 1. Rail-by-rail

### x402 (Coinbase; Linux Foundation "x402 Foundation" since July 2026)
- **What/who.** HTTP 402 challenge → USDC payment (mostly Base, also Solana, Polygon, Arbitrum, Monad, World) → facilitator verifies and settles. Coinbase runs the dominant facilitator; Foundation premier members include Visa, Mastercard, Stripe, Google, AWS, Cloudflare, Coinbase, Amex, Solana Foundation (40 orgs, 17 premier) [Forkast/Yahoo, 2026-08-04].
- **Status.** Live since May 2025. Coinbase Agentic.Market directory launched 2026-05-15 with "hundreds" of services in seven categories (Bloomberg, CoinGecko, X, AWS Lambda, QuickNode, Alchemy featured) [printmoneylab timeline, 2026-05-20]. CDP Bazaar lists 25,560 resources; 21Shares estimates ~47% of registered services are dead [CURB, 2026-07-17].
- **Volumes (the numbers conflict; pick the adjusted ones).**
  - Raw cumulative: 195M tx / $52M (x402scan, to 2026-07-18); Coinbase's own Agentic.Market launch claim: 165M tx, ~69K active agents, $50M [TFTC, 2026-06-23].
  - Wash-adjusted (Visa × Artemis, to 2026-04-21): **109.6M tx, $15.0M, 422K buyers, ~5,300 sellers** [CURB].
  - Real daily commerce: **~$28K/day, ~$0.20 avg, ~half artificial** (CoinDesk/Artemis, Mar–Apr 2026) [presenc.ai; Forkast]. May 2026 adjusted monthly volume $1.19M, 2.89M tx, $0.52 avg, down 77% from the Nov 2025 PING-memecoin peak of $5.15M [CryptoSlate, 2026-05-27].
  - Trailing 30d (x402scan, mid-July 2026): 17.3M tx, $825K, 47K buyers, 62K "sellers" (addresses, not businesses) [CURB].
  - Chains: Base ≈ 90–97% of tx and volume; Solana a few percent [CURB; web3trackers 2026-04-14 shows Base 58% / Solana 38% cumulative, i.e., Solana share has collapsed].
- **Who earns (30-day revenue, July 2026, x402scan via CURB).** BlockRun (AI model routing) **$177K / 14.5M tx / ~1,130 buyers** = 21% of volume, 82% of tx; dTelecom (WebRTC/STT/TTS) $18.75K / 24 buyers; StableEnrich (data enrichment) $1.77K; twit.sh (X data) $621; agentutility (762-endpoint catalog) $589; JarvisClaw (OpenAI-compatible gateway) $560; Nansen $131; Otto AI $105; **OneSource (ETH RPC) $73 — that is the #10 seller.**
- **Price points.** Solana sample (1.5M payments): 78% of payments are under $0.10 but carry 7% of value; $1–10 payments are 8% of count and 54% of value [CURB]. Chainalysis: $1+ transactions went from 49% to 95% of Base value between early 2025 and early 2026 [Chainalysis, 2026-06-03]. CoinGecko charges 0.01 USDC/request [Catenaa, 2026-02-18].
- **Fees.** Zero protocol fee; Coinbase facilitator free for first 1,000 on-chain tx/month, then $0.001/tx; verification free; batch-settlement scheme claims vouchers in one on-chain tx [CDP docs].
- **Can a small seller earn today?** Yes mechanically (npm middleware + CDP facilitator + Bazaar/Agentic.Market listing, no KYC on the seller side for USDC). Economically the table above is the answer: outside inference resale the entire long tail earns tens to low hundreds of dollars a month.

### MPP — Machine Payments Protocol (Stripe + Tempo)
- **What/who.** Open HTTP-402 standard (IETF draft, Sept 2026), charge and session intents, methods: Tempo stablecoin, Stripe (fiat/card), Solana SDK; Visa extended it to cards, Lightspark to Lightning. Launched with Tempo mainnet 2026-03-18 [Fortune, 2026-03-18]. Directory at mpp.dev/services (curated, "live, production-ready services only", JSON + MCP endpoints) [mpp.dev].
- **Volumes.** MPPScan (Merit Systems) today: **174.4K total transactions, $2.19K total volume, 10K agents, 165 services** [mppscan.com, opened 2026-11-04]. Top services by count: Exa 9.2K tx / $63; APIbase 8.2K / $11; glim.sh 8.1K / $44; Codex 8.1K / $8; Firecrawl 6.8K / $16; OpenRouter 3.9K / $14; StableEnrich 1.5K / $76; Perplexity 1.5K / $10; CoinGecko 1.3K / $77. Formo's late-March snapshot showed 31K tx / $3.7K / 671 agents / 326 servers [Formo, 2026-03-30] — the volume figure moving *down* while tx count rose 5x suggests different counting windows or a reset; either way total settled value is in the low thousands of dollars after 7.5 months. Matt Huang at launch: "Agentic payments is very early" [Fortune].
- **Fees.** Zero protocol fee; sub-cent Tempo gas; Stripe fees on fiat; Stripe stablecoin acceptance US-only [Formo].
- **Small seller?** Yes, and a9n9 already is one (the a9n9 research MCP issues MPP-style payment challenges). Expect signalling value with Stripe/Tempo, not revenue.

### Google AP2 (Agent Payments Protocol)
- Spec v0.2, A2A extension, "Human Not Present x402" sample; standardisation moving to FIDO working groups; **no production claim, no transaction numbers on the protocol site** [ap2-protocol.org]. 60+ launch partners (Sept 2025), 120+ by April 2026 per a third party (unverified). It is an authorisation/mandate layer, not a settlement rail; its most concrete contribution is the "signed mandate" answer to the approval gap (below).

### Visa Intelligent Commerce / Trusted Agent Protocol
- TAP (Oct 2025, with Cloudflare; Nuvei processor; Coinbase working on x402 interop) — no transaction counts, no fees [Digital Transactions, 2025-10-14]. Q2 FY26 call (2026-04-28): "over 100 global partners", "more than 30 in sandbox", rollouts in APAC/CEMEA/LatAm; **no agentic transaction figure**; McInerney expects "agents will pay for their own data and resource consumption" [Stellagent Visa Q2]. Other coverage: "hundreds of controlled transactions" (unverified).

### Mastercard Agent Pay and AP4M
- First live agentic transaction in Hong Kong (one taxi booking, six issuing banks, 2026-03-27); authenticated transactions in 8–9 APAC markets; 17 processors/issuers in LatAm; Fiserv adopted the acceptance framework [Stellagent, 2026-04-02]. **Agent Pay for Machines (2026-06-10)**: credentialing ("Verifiable Intent"), permissioning, multi-rail settlement across cards, accounts, stablecoins; 30+ initial participants including Adyen, Checkout.com, Cloudflare, Coinbase, Stripe, **Tempo**, Nevermined, Skyfire, Solana Foundation; **live/pilot status, fees and onboarding not stated** [The Paypers, 2026-06-10].

### Stripe Agentic Commerce Suite / Shared Payment Tokens / OpenAI Instant Checkout (ACP)
- ACS (2025-12-11): single integration to sell across agents; SPTs pass scoped card credentials; named adopters Coach, URBN, Revolve, Etsy, Wix, Squarespace, WooCommerce, BigCommerce; **no merchant or transaction counts, no pricing** [Stripe newsroom]. a16z-cited claim that Link agentic purchases rose 38x in a month across ~1M merchants (secondary summary of a secondary, unverified) [ecosistemastartup, 2026-10-17].
- **Instant Checkout**: launched 2025-09-29 for US Etsy sellers; CNBC 2026-03-24: OpenAI moved to merchant-owned checkout with ChatGPT doing discovery; commercetools calls it "paused" as of 2026-09-15 [Ringly]. The flagship consumer agentic-checkout product did not survive six months.

### PayPal
- Agent Ready (accept payments from agents, buyer protection), Store Sync (catalogue to Perplexity etc.), launched Oct 2025, targeted early 2026; search found no 2026 results data (unverified status).

### Circle Nanopayments / Agent Stack
- Mainnet 2026-04-29 on 11 chains; gas-free USDC down to $0.000001 via Gateway deposits + batched settlement; "additive" to x402; early integrations Alchemy, QuickNode, blockrun.ai, Meridian, Goldsky, AgentCard [Circle blog]. No volume disclosed.

### Lightning / L402 (Lightning Labs, Alby, Fewsats)
- Lightning Labs released lightning-agent-tools 2026-02-18 (lnget L402 client, Aperture reverse proxy, scoped macaroons) [Catenaa]; Alby PaidMCP lets a server invoice per tool call. **No adoption numbers anywhere; Fewsats has no 2026 coverage at all.** The one pro-L402 piece I opened concedes Lightning agent volume is "an open question" [TFTC].

### Skyfire, Nevermined, Payman, Locus
- Skyfire: out of beta March 2025, "thousands of transactions daily" (self-reported), customers Pricing Culture, Zinc, Linkup, Bazaars; funding rails card/ACH/wire/USDC-Base [FF News, 2025-03-07]; no 2026 numbers. Nevermined: 1–2% per transaction, named customer Valory/Olas, supports x402/MCP/A2A/AP2 + Stripe/PayPal fiat; no volumes [Nevermined, 2026-06-04]. Payman: ~$14M raised (sources conflict), no customers found. Locus (YC F25): beta, USDC on Base, $10 sign-up credit, no customers named [YC launch].

### Virtuals ACP and Olas
- Virtuals: self-reported $470M aGDP and 1.77M jobs (Feb 2026); protocol revenue reportedly fell from $3.9M/month (Jan 2025 peak) to under $200K (early 2026) and real commerce is "concentrated in <0.3% of agents" (tracker figures, unverified); $1M/month Revenue Network subsidy to selling agents [Forkast, 2026-07-22]. The ground truth from one builder: PriceVerifier, $0.01/job, 20% protocol fee, three weeks to "graduate", **zero production jobs** at graduation, ~$7 spent [printmoneylab, 2026-04-02].
- Olas: Pearl 834 daily active agents; Polystrat/Omenstrat prediction agents; OLAS staking APR 138.5% is what pays for Mech requests; legacy Mech agents retired [Olas Q1 2026 roundup, 2026-04-03]. Agent-to-agent demand here is token-subsidised.

### Forecast reports
- Juniper: $8B agentic commerce in 2026 → $1.5T in 2030, consumer-agent shopping definition; leaderboard Mastercard, Visa, Stripe [Stellagent, 2026-04-09]. McKinsey via Nuvei: ~$1T by 2030 (unverified). Note the gap: measured machine-to-service spend on open rails is on the order of $10–20M/year; the forecasts are about humans shopping through agents with cards.

## 2. Analysis

**(1) Where real paying demand exists now.** Three places, in descending order of evidence. (a) x402 on Base: ~$1M/month genuine, ~$28K/day, 1–5K real sellers, a few thousand returning buyers, and the buyers are overwhelmingly *other agent developers' pipelines* buying inference, speech, data. (b) Card-network agentic checkout: real but counted in hundreds of transactions, each one a press release; the buyer is a consumer and the merchant is a retailer, so this is not a market a9n9 agent can sell into. (c) MPP: ~$2K settled, total. Everything else — AP2, AP4M, PayPal Agent Ready, Skyfire, Nevermined, Payman, Locus, L402 — is spec, pilot, or undisclosed. Virtuals/Olas volume is largely incentive-driven. Cloudflare's "one billion 402s a day" are paywall signals, not payments.

**(2) What sells.** Categories by revenue: AI inference and routing (BlockRun alone ≈ $179K/30d, i.e. agents buying LLM calls without an API key or KYC); speech/media; on-chain and market intel (many vendors, tiny revenue); data enrichment and search (StableEnrich, Exa, Firecrawl, ~$2K); social data (~$600); RPC. Price points: by count, $0.01–$0.10; by value, $1–$10. Top earners are *resellers of someone else's inference with a wallet in front* — a margin business that needs volume and a cheap settlement path. The #10 x402 seller makes $73/month; the #1 MPP service by count has settled $63 ever. There is no visible "agent pays agent for a skill" demand outside subsidised token ecosystems.

**(3) Should a9n9's agents sell on x402 / MPP / L402, and which first?** Yes, x402 first, MPP second (already done), L402 not at all. x402 is where the buyers, the directory traffic (Agentic.Market, Bazaar), the npm installs (1.2M/month for `x402`) and the facilitator subsidy (1,000 free tx/month) are. The cost is a day of middleware plus a Base wallet. Set expectations from the data: a non-inference niche seller should plan for $50–$500/month, and the value is distribution and learning (which agents call us, at what price, with what retention), not income. MPP: keep the a9n9 listing in mpp.dev and the Tempo method live; it costs nothing and keeps the Stripe/Tempo relationship warm, but the rail has settled $2K. L402: no measurable buyers; skip until a Bitcoin-native customer asks.

What to sell: the thing a9n9 already prices per call — deep research reports — plus any deterministic, cheap, cacheable endpoint (quick search/news, reserve-monitor data from apps/reserves, memo-attributed Tempo payout lookups). Price the cheap ones at $0.01–$0.05 (where the count is) and research at $1–$10 (where the value is). Avoid reselling inference: BlockRun owns it and the margin is thin.

**(4) Does picocash have a niche?** Test each candidate against the evidence.
- *Micro-payments below card minimums.* Incumbents have already shipped the fix on their own rails: Base batch settlement ($0.0001 viable, 2026-05-13), Circle Nanopayments ($0.000001, gas-free, 11 chains), MPP sessions ($0.0001/request escrow), Coinbase batch-settlement vouchers. eCash's "no per-payment on-chain fee" is no longer a differentiator buyers can see. **Refuted as an external niche.**
- *Privacy.* x402 payers are pseudonymous Base wallets; nobody in any source lists privacy as a purchase criterion, and the enterprise side (Visa, Mastercard, AP2) is moving the other way (Verifiable Intent, KYA, agent identity). **No supporting evidence.**
- *Agent-to-agent tips / skill payments.* The two live A2A marketplaces (Virtuals ACP, Olas Mech) show that at $0.01/job with zero subsidy you get zero jobs; what volume exists is paid for by token emissions. **Refuted for now.**
- *Pre-authorised spend without per-transaction approval.* This is the one real, documented pain: CryptoSlate's "approval gap" (Base MCP requires human approval on every write, 4,000–12,000 user-hours/month if applied to x402), and AP2 mandates, Mastercard Verifiable Intent, MPP sessions and Visa IC Connect are all attempts at "one authorisation, many payments." A picocash bearer token with a merchant-locked P2PK budget *is* a pre-authorised envelope, verified offline in ~47 ms. **Supported in principle — but MPP sessions and AP2 mandates address the same gap with far more distribution.** Picocash wins only where the payer must not touch a chain or a card network per spend and the payee must verify without calling anyone: an offline/edge or closed fleet.
- *Closed-loop credits.* This is where the evidence points. The best-performing x402 category is agents buying metered compute/inference; a9n9 runs a fleet that needs metered internal budgets, merchant-locked allowances, and a spend audit without per-call wallet signing. `PICOCASH_VAULT=credit` and the MPP explicit-unit change already make picocash a closed-loop credit over MPP. No external adoption is required for this to pay off, and it dodges the custody/legal gates in `spec/mainnet-plan.md`. **Supported, as an internal product; unproven as a product for third parties.**

**(5) Recommendation.**
1. **Ship a9n9 services on x402 (Base, CDP facilitator) within the week**: research quote/report, quick search, reserves data. List on Agentic.Market and the Bazaar. Instrument buyers, retention, and price elasticity. Budget: ~1 day. Revenue expectation: $50–$500/month in the first quarter; the payoff is distribution and data.
2. **Keep MPP live and listed** (already true); add the x402-compatible `exact` charge so one endpoint serves both. Do not invest further in MPP-specific features until MPPScan shows >$100K/month.
3. **Do not build for L402, Virtuals ACP, Olas, Skyfire, Nevermined, Payman or Locus.** None has disclosed volume; two are subsidy-driven. Revisit AP4M in 2027 only if Tempo/Coinbase publish live machine-payment volume.
4. **picocash stays parked as an external rail; promote it as the a9n9 fleet's internal credit.** Use closed-loop credit mode for agent budgets, merchant-locked allowances for per-service spend, and the owner MCP for audit. Accept picocash as an MPP method on a9n9's own endpoints at zero margining cost and log whether any external agent ever uses it — that log is the cheapest market test available. No outreach (consistent with the money-loop decision).
5. **Unpark triggers** (write them down so this isn't relitigated): wash-adjusted x402 volume >$10M/month; MPP >$100K/month; or a named customer (fleet operator, edge/offline deployment, or payout fintech) asking for offline-verifiable, pre-authorised agent spend. Any one of these reopens the mainnet plan.

## Sources (pages opened)

- https://www.chainalysis.com/blog/x402-agentic-payments-adoption/ (2026-06-03)
- https://finance.yahoo.com/markets/crypto/articles/x402-foundation-activated-27-old-152440828.html (Forkast, 2026-08-04)
- https://curb.numetal.xyz/dispatch/x402-economy-july-2026 (2026-07-17/18)
- https://www.web3trackers.com/x402-dashboard (2026-04-14)
- https://presenc.ai/research/x402-protocol-adoption-tracker-2026 (2026-05-15)
- https://www.tftc.io/agentic-payments-x402-above-one-dollar-chainalysis/ (2026-06-23)
- https://cryptoslate.com/?p=538356 (2026-05-27)
- https://www.printmoneylab.com/2026/05/x402-may-2026-timeline.html (2026-05-20)
- https://dev.to/ai-agent-economy/x402-demand-is-here-youre-just-not-looking-in-the-right-places-4f35 (2026-03-11, vendor-authored)
- https://dev.to/rumblingb/mcp-payment-extensions-in-june-2026-x402-v2-l402-and-what-actually-works-14jp (2026-06-12, vendor-authored)
- https://docs.cdp.coinbase.com/x402/core-concepts/facilitator (fees)
- https://formo.so/blog/mpp-machine-payments-protocol-explained (2026-03-30, updated)
- https://mppscan.com/ (opened 2026-11-04)
- https://mpp.dev/services
- https://www.fortune.com/2026/03/18/stripe-tempo-paradigm-mpp-ai-payments-protocol (2026-03-18)
- https://ap2-protocol.org/
- https://www.digitaltransactions.net/visa-launches-trusted-agent-an-agentic-commerce-protocol/ (2025-10-14)
- https://stellagent.ai/insights/visa-q1-fy26-agentic-commerce-growth-driver (Visa call 2026-04-28)
- https://stellagent.ai/insights/mastercard-first-live-agentic-transaction (2026-04-02)
- https://thepaypers.com/payments/news/mastercard-launches-agent-pay-for-machines-for-ai-commerce (2026-06-10)
- https://stripe.com/newsroom/news/agentic-commerce-suite (2025-12-11)
- https://www.ringly.io/blog/openai-instant-checkout-agentic-commerce-protocol (citing CNBC 2026-03-24)
- https://ecosistemastartup.com/a16z-las-guerras-de-billeteras-de-los-agentes-de-ia/ (2026-10-17, secondary)
- https://stellagent.ai/insights/agentic-commerce-1-5-trillion-forecast-2030 (Juniper, 2026-04-09)
- https://circle.com/blog/nanopayments-powered-by-circle-gateway-is-now-live-on-mainnet (2026-04-29)
- https://catenaa.com/industries/technology/lightning-labs-launches-ai-tools-for-native-bitcoin-lightning-payments (2026-02-18)
- https://www.lightning.engineering/posts/ (homepage only; L402-for-agents post 2026-03-11 not retrievable)
- https://ffnews.com/newsarticle/paytech/skyfire-exits-beta-with-enterprise-ready-payment-network-for-ai-agents/ (2025-03-07)
- https://nevermined.ai/blog/api-providers-accept-ai-agent-payments (2026-06-04, vendor)
- https://www.ycombinator.com/launches/Oj6-locus-payment-infrastructure-for-ai-agents
- https://forkast.news/the-machine-as-buyer-virtuals-acp-and-the-evaluator-problem/ (2026-07-22)
- https://www.printmoneylab.com/2026/04/acp-agent-episode-7-graduated-revenue-honest-numbers.html (2026-04-02)
- https://olas.network/blog/olas-q1-2026-roundup (2026-04-03)

Not retrievable (403/404/blocked, cited only via the pages above): classic.artemis.ai/asset/x402, x402scan.com (JS-rendered), coinbase.com Agentic.Market posts, fintechfutures Juniper release, beincrypto research report, docs.stripe.com machine-payments, x402.org/ecosystem, Fundstrat Virtuals Q2 PDF (image-only).
