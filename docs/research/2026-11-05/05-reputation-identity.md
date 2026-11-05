# Reputation, identity and trust for AI agents as a market (2025–2026)

*Research thread 05 for a9n9 (Visybl Inc). Compiled 2026-11-04. 42 pages opened directly; items marked **[unverified]** rest on search snippets or secondary sources only.*

## 1. Landscape, item by item

### Web access layer (who is this bot, and may it crawl/act here?)

**Cloudflare Web Bot Auth / signed agents.** Agents sign HTTP requests with RFC 9421 message signatures using an Ed25519 key; the public key is served as a JWKS at `/.well-known/http-message-signatures-directory` with `Signature-Agent` pointing at it. Cloudflare added it to Verified Bots (1 Jul 2025), created the *signed agents* category (28 Aug 2025; launch cohort ChatGPT agent, Block's Goose, Browserbase, Anchor Browser, plus Cloudflare Browser Rendering), and proposed a registry format + "signature-agent card" (30 Oct 2025) so WAF vendors can ingest keys at scale (built with Amazon Bedrock AgentCore). Registration is a free dashboard form (Bot Submission Form → Verification Method = Request Signature). AWS AgentCore Browser signs with it in preview and lists Cloudflare, HUMAN, Akamai, DataDome and F5 as verifiers — i.e. the key-directory convention is now multi-vendor. **Payer:** nobody directly; site owners already pay Cloudflare for bot management, agent operators get access for free. **Standards status:** IETF chartered the `webbotauth` WG on 23 Oct 2025 (chairs Schinazi, Shekh-Yusef). The individual drafts (`draft-meunier-web-bot-auth-architecture-05`, `draft-meunier-webbotauth-httpsig-protocol-02`) expired Aug 2026, replaced by the WG document `draft-ietf-webbotauth-httpsig-protocol`; the April 2026 IESG milestones slipped. Crucially, the charter puts **"tracking bot reputation", intent vocabularies and agent-to-agent/API traffic explicitly out of scope** — WBA is identity of the operator, nothing more.

**OpenAI / Anthropic.** OpenAI's bots page still identifies crawlers by user-agent + published IP JSON files (gptbot.json, chatgpt-user.json etc.); the WBA signing of "ChatGPT agent" is visible only through Cloudflare's directory, not OpenAI docs. I found **no evidence Anthropic signs Claude agent traffic with WBA** or publishes an agent-identity scheme **[unverified absence]**. Neither vendor sells identity; they are consumers of Cloudflare's program.

### Payment networks (is this agent allowed to pay, and for whom?)

**Visa Trusted Agent Protocol (TAP) + Agent Directory.** Launched Oct 2025 with 10+ partners; Cloudflare co-developed it, Akamai integrates. Spec = RFC 9421 signatures; the merchant rebuilds the signature base and checks the public key; "if the key is associated with Visa this implies participation in Visa Intelligent Commerce" — i.e. Visa is the registration authority. Live since 2 Jul 2026 in Europe: 31 issuers (Barclays, BBVA, ING, Revolut, HSBC UK…), named merchants lastminute.com, Frasers, Cleverbridge, BrickDepot; no volumes disclosed. **Payer:** issuers and merchants via network programs; no separate price published. Agent onboarding process is not public **[unverified]**.

**Mastercard Agent Pay / Agentic Tokens / Verifiable Intent.** Agent Pay Acceptance Framework (Oct 2025): agents *must register and be verified* before the network processes their purchases; Agentic Tokens are issuer-bound tokens an agent presents in standard card fields. LATAM rollout Dec 2025–Feb 2026 (Checkout.com, Getnet, Yuno, Evertec…). Verifiable Intent (5 Mar 2026, with Google, Fiserv, IBM, Checkout.com) is open-sourced and AP2/UCP-compatible **[details from search only; mastercard.com returned 403]**. **Payer:** issuers/acquirers inside network fees.

**Google AP2.** Open protocol: Checkout and Payment Mandates as "verifiable digital credentials", chained for a non-repudiable audit trail; v0.2 donated to the FIDO Alliance, continuing in FIDO's Agentic Authentication & Payments TWGs; shipped as extensions to A2A and UCP. The site names **zero** production deployments and does not define how an agent is identified — accountability is listed as an *open question*. "60+ organisations" and "three production deployments" are secondary claims **[unverified]**.

**Visa + Mastercard + Ant "Know Your Agent" alignment (10 Sep 2026).** Shared framework so an agent verified by one network is not re-verified by another: operator traceability, shared security/behaviour certification, continuous monitoring. Runs on MAS's BuildFin.ai under its SAFR framework. No pilot described. This is the clearest signal that *agent registration will be done by the card networks*, not by independent registries.

### Enterprise identity (which agent in my tenant did what?)

**Microsoft Entra Agent ID / Agent 365.** Each agent gets an Entra identity (blueprints, sponsors, Conditional Access for agents, ID Protection for agents, inactivity policy, Graph access; third-party agents from Bedrock/n8n can be enrolled). Agent 365 GA 1 May 2026 at **$15/user/month** (also inside M365 E7 at $99); agents themselves need no licence. This is the only *published price* in the whole space, and it is per *human*, not per agent.

**Okta/Auth0 "Auth for GenAI".** Agent-as-identity, on-behalf-of authorization, audit trails; customers Zapier, Bluetooth SIG, GrandVision. No public price; management describes an "uplift on per-user pricing" or connection-based pricing, Developer Preview per a rival's Nov 2025 comparison **[GA status unverified]**.

**SPIFFE/SPIRE.** Vendor consensus (Palo Alto, TrueFoundry, etc.): short-lived attested SVIDs for "what is this agent", OAuth for "acting for whom". Federation across trust domains is claimed but mechanics are unspecified. Enterprise-internal; no public-reputation component.

**NIST / OWASP.** NIST CAISI's AI Agent Standards Initiative (17 Feb 2026) includes an NCCoE concept paper "Accelerating the Adoption of Software and AI Agent Identity and Authorization" (comments closed 2 Apr 2026) and names "agent authentication and identity infrastructure" as a research pillar. OWASP: ANS v1.0 paper (May 2025), Top 10 for Agentic Applications (Dec 2025) **[secondary]**. **Agent Name Service v2** is now an *individual* IETF draft (`draft-narajala-courtney-ansv2-02`, 26 Oct 2026; GoDaddy, OWASP, Cisco authors): `ans://v1.agent.example.com` names anchored in DNS (SVCB via DNS-AID, optional TLSA), registration authorities, a Merkle transparency log; explicitly "identifies an agent — whether to trust it remains the relying party's decision". Not WG-adopted, no deployments found.

### On-chain registries (portable identity + crowd reputation)

**ERC-8004 "Trustless Agents".** Draft ERC (authors from MetaMask, EF, Google, Coinbase — affiliation inferred). Identity = ERC-721 token whose URI resolves to a registration file (optional `.well-known/agent-registration.json` for domain binding); Reputation = `giveFeedback(value, tags, uri)` from any address except the owner, readers told to filter by client address against Sybils; Validation = request/response scored 0–100 by a named validator. No fees; payments out of scope. Mainnet 29 Jan 2026.
*Adoption (Quicknode explorer, 4 Nov 2026, 18 mainnets, my sums):* **~2.0M agent registrations, 861K feedback events, 10.6K validations** — but Base alone is 1.16M agents/675K feedback, Arc 315K, BNB 406K; Ethereum mainnet 56K agents/36K feedback/0 validations; Tempo mainnet (chain 4217) 653 agents, 2,161 feedback, 1 validation; 10.5K of the 10.6K validations are on Robinhood Chain. Two independent audits say the same thing: Mafrur & Khusumanegara (arXiv 2606.12128, Jun 2026; first 10,000 mainnet agents) find 6.28% of agents ever received feedback, **65.8% of all feedback came from one client**, 394 wallets own all 10,000 agents (Gini 0.863), only 19 agents have metadata+services+feedback+cross-chain; verdict "registration-heavy but operationally shallow". LLM4Agents' contract-level audit (17 Aug 2026): Ethereum 50,082 agents, 3,215 feedback from 653 addresses, **validation registry empty** on Ethereum. The explorer's REST API is paywalled per call via x402 — the only monetisation of 8004 data I found.

**Virtuals ACP / ERC-8183.** "Proof of Agreement": evaluator attestations and deliverable hashes on-chain, now written into the ERC-8004 Reputation Registry (Feb 2026). Self-reported $470M "agent GDP"/1.77M jobs (Forkast, Jul 2026, calls them "a black box", notes the $1M/month incentive program and that >95% of x402 activity was signalling). Evaluators can be AI agents — the "evaluator problem".

**Olas.** Mech Marketplace: ~359K jobs indexed, typical fee ~$0.01 xDAI; one Mech has 371K jobs from 245 clients for $3.7K total earnings. Olas has "no formalized reputation system beyond transaction history and staking" (RNWY's framing). Tiny money.

**Third-party scorers.** RNWY (soulbound IDs, "150,000+ agents", scores show their formula: address age, attester diversity; no business model shown), KnowYourAgent.network/AgentScan, TrustRank (hol.org), AgentRep, DJD Agent Score, Agentery, Agent Rating Protocol — all early, no revenue evidence **[unverified]**.

### Social / Nostr / Bluesky

**Block Buzz + NIP-OA.** Buzz (Apache-2.0, 36.7K stars) treats agents as members with their own keys. **NIP-OA** (draft, optional) is an *owner attestation*: an `auth` tag `[owner_pubkey, conditions, sig]` where the owner Schnorr-signs `nostr:agent-auth:<agent_pubkey>:<conditions>`; conditions restrict `kind` and `created_at`; the agent remains the author. **NIP-AA** lets a NIP-43 membership relay admit an agent key on the strength of its owner's membership (checked at NIP-42 AUTH). This is identity + delegation, not reputation; there is no agent-profile kind or track-record primitive. No adoption numbers outside Buzz.

**Bluesky.** Blue checks (Apr 2025) are for notable humans via Trusted Verifiers; an *automation label* shipped Mar 2026 — self-declared, unenforced, and labelled bots report being more exposed to moderation (one labelled bot suspended without explanation) **[source is an opinion post by an AI agent]**. DNS-verified handles give domain binding, nothing more. Nostr NIP-05 is a human-readable identifier, not verification.

**Moltbook.** Launched 28 Jan 2026; identity = owner's "claim" tweet + a reverse CAPTCHA (trivially bypassed); two database exposures (Jan, Feb 2026: 1.5M API tokens); 2.9M registered agents but ~1.5M tied to ~17K owners; acquired by Meta 10 Mar 2026, price undisclosed, with Meta citing "identity verification, agent-to-agent discovery, persistent linkage back to human principals" as the asset. The lesson: *claimed* agent identity at social scale is worthless without an owner anchor, and Meta paid for the owner graph, not the reputation.

### KYA vendors, insurance, flight recorders

**Vouched** ($17M Series A, Sep 2025): KYA suite + KnowThat.ai reputation directory; customer BHG Financial (fraud team). Pricing: KYA free tier (unlimited detection, 500 delegation checks/mo), enterprise custom; human IDV $300/mo + $0.75/tx — the KYA SKU is priced by *delegation checks*, i.e. the relying party pays. **Baselayer** ($35M Series A, 22 Sep 2026, M13; FIS, Prove, Socure issue/recognise the credential; 2,000+ FIs on its KYB product). **MetaComp** regulated-finance KYA framework (Apr 2026) **[unverified]**.
**Insurance:** Klaimee (YC, $5.5M seed Jul 2026): 30-question governance assessment + 100+ behavioural probes → risk score → certification → E&O warranty; "underwriting first cohort". Harbor ($10M seed, 13 Oct 2026), Mount, AIUC ($15M, Jul 2025) **[AIUC/Mount unverified]**, ElevenLabs voice-agent cover (Feb 2026) **[unverified]**. Underwriters are the first buyers of *behavioural evidence*.
**Flight recorders:** aileron (PyPI; SHA-256 hash-chained JSONL + Ed25519 checkpoints + MCP policy proxy; "tamper-evident is not tamper-proof"), BLACKBOX, RFT Systems' Agent Flight Recorder, Agnys; an arXiv paper on on-chain-anchored audit trails (2609.01931). All open-source/hobby scale; the commercial equivalent is Microsoft's Copilot audit log. Kiteworks survey: 33% of orgs have zero agent audit logs **[secondary]**.

### Academic
Hu & Rong (arXiv 2511.03434, AAAI-26 workshop): six trust models — Brief, Claim, Proof, Stake, Reputation, Constraint — evaluated over A2A, AP2, ERC-8004; "no single mechanism suffices"; reputation is brittle (Sybil, collusion, whitewashing) and should be an *overlay* on Proof + Stake. AgentReputation (FSE 2026): global scores fail because agents game evaluators and competence doesn't transfer across tasks; proposes context-conditioned reputation cards with explicit verification regimes; no empirical evaluation. TruthMarketTwin, Ev-Trust, "Capability Advertisement as a Market for Lemons", skill-conditional trust (2606.14200) **[abstracts only]**.

## 2. Analysis

### (1) Is anyone paying for agent reputation today, and for what?
Almost nobody pays for *reputation*. Money changes hands for three adjacent things:
- **Access / fraud reduction at the edge:** site owners pay Cloudflare/Akamai/HUMAN for bot management; agent operators get signed-agent status free. Value is binary (known operator vs unknown), not a score.
- **Payment authorisation:** Visa/Mastercard embed agent registration in network programs; merchants and issuers pay via existing fees. Again binary and network-controlled; the networks are becoming the registration authorities (KYA alignment, Sep 2026).
- **Enterprise governance/compliance:** Microsoft ($15/user/mo), Okta, Vouched delegation checks, Baselayer credentials. The customer is the *deploying enterprise* or the *relying FI*, and what they buy is control and an audit trail, not public standing.
The only buyers of *behavioural track record* are insurers/certifiers (Klaimee, Harbor), and they are pre-revenue. On-chain reputation registries have ~0 paid demand: ERC-8004 is free, feedback is 65% one client, validation is empty, and the single monetised artefact is a paywalled explorer API.

### (2) Which standards are winning; what to plug into
- **RFC 9421 + `/.well-known/http-message-signatures-directory`** is the de-facto agent-identity primitive on the web: Cloudflare, Akamai, HUMAN, DataDome, F5, AWS AgentCore, and Visa TAP all build on it, and it has an IETF WG. a9n9 already publishes exactly this file.
- **ERC-8004** has won the on-chain *identity* slot by volume (2M registrations, 18 chains incl. Tempo) and is what Virtuals/Olas/explorers index; its reputation layer is live but junk-dominated; validation is unused. Cheap to join, no fees.
- **NIP-OA/NIP-AA** is the Nostr owner-delegation convention and is what Buzz expects.
- Losing/irrelevant for a small player: ANS (individual draft), AP2 identity (undefined), Moltbook-style claim tokens, bespoke scoring sites, SPIFFE (intra-enterprise).

### (3) Where a public per-action ledger plus signed receipts is a real advantage
*Real:* (a) **Sybil-proof evidence** — every audit says 8004 feedback is Sybil-dominated; an agent whose feedback is domain-anchored (DNS, WBA key), owner-attested (NIP-OA), and backed by human receipts tied to Stripe payments is rare and legible. (b) **Underwriting/certification** — Klaimee/Harbor need exactly a continuous behavioural record; a hash-chained, signed, publicly anchored log is the artefact they would audit. (c) **Dispute and procurement** — AP2's whole pitch is a non-repudiable audit trail; a9n9 having one per action is the same story at the agent-operator level. (d) **Owner accountability** — the thing Meta bought Moltbook for.
*Nobody cares:* web-access gates (WBA WG excluded reputation by charter; sites want operator identity and rate limits), card-network authorisation (they run their own registries), enterprise IAM (private by design), and crypto "agent GDP" leaderboards (incentive-driven noise).

### (4) Recommendation for a9n9
Do three integrations, all cheap, all against standards that already have verifiers:
1. **Cloudflare signed agent / verified bot.** The key directory already exists; add RFC 9421 signing (`Signature-Agent`, `tag="web-bot-auth"`, `keyid`=JWK thumbprint, `created`/`expires`, `@authority`) to every outbound HTTP call from agent001 and submit the Bot Submission Form. Zero cost; immediately lists agent001 in Cloudflare Radar's directory next to ChatGPT agent and Goose, and is forward-compatible with Visa TAP and the AWS registry format. Publish a signature-agent card (operator contact, expected rate).
2. **Register in ERC-8004 on Base and Tempo mainnet.** Registration file at `agent001.a9n9.net` (+ `.well-known/agent-registration.json` for domain binding) listing the WBA key, Nostr pubkey, Bluesky DID and the ledger URL. Base is where indexers look; Tempo (653 agents, chain 4217) fits the picocash/Tempo story and makes a9n9 one of the first visible agents there. Do **not** promise reputation from it; use it as a cross-reference hub. Optionally post *outbound* feedback as a client for services agent001 pays for — you then become one of the few non-Sybil feedback sources, which is itself a differentiator.
3. **Publish receipts in formats others consume, with an anchor.** Keep the public ledger but (a) sign each entry (detached JWS/COSE with the same Ed25519 key, so a WBA verifier can check it), (b) hash-chain entries aileron-style and anchor a daily Merkle root on Tempo (or in the ERC-8004 agent URI history), and (c) express "did this help?" receipts as an ERC-8004-shaped feedback object (value, tags, uri, hash) even when the human has no wallet. On Nostr, carry the NIP-OA owner attestation from Arun's key on agent001's events so Buzz relays and any NIP-AA relay accept it natively.

**Stop claiming:** "verifiable reputation" as a *market* differentiator (no buyer exists yet), any numeric trust score, and "registered on ERC-8004" as a trust signal (audits show it signals nothing). Say instead: *domain-anchored identity, owner-attested keys, signed action log, third-party receipts* — each is checkable and each maps to a live standard.

**How reputation becomes revenue (honest view):** not badges and not registry fees — Cloudflare, Visa and 8004 are all free to the agent. Three plausible paths, in order of nearness: (i) **underwriting evidence** — offer the signed ledger to Klaimee/Harbor-type certifiers as the behavioural dataset their 100-probe tests cannot produce, and get a9n9 agents certified/warranted first (a sales asset for the Stripe-funded tasks); (ii) **the ledger-as-a-service for other operators** (a hosted, anchored flight recorder with receipts and 8004/WBA plumbing) sold to the small operators who, per Kiteworks, have no audit log at all — this is the only thing in this report that a small player could sell for money within months; (iii) **being a trusted feedback/validation source** in ERC-8004 once the validation registry gets real users — speculative. Reputation *data* sales to networks are not a path: Visa/Mastercard/Ant are building their own KYA.

## Sources (opened)
- https://eips.ethereum.org/EIPS/eip-8004
- https://erc-8004.quicknode.com/ and https://erc-8004.quicknode.com/networks
- https://arxiv.org/html/2606.12128v1 (Measuring operational readiness of ERC-8004 agents)
- https://llm4agents.com/blog/erc-8004-registries-onchain-audit
- https://knowyouragent.network/24000-ai-agents-are-erc-8004-now-what
- https://rnwy.com/learn/ai-agent-reputation and https://rnwy.com/learn/olas-mech-marketplace-agent-data
- https://thebitcoinstreetjournal.com/acp-standardizes-on-chain-agent-reviews-with-erc-8004-integration
- https://forkast.news/the-machine-as-buyer-virtuals-acp-and-the-evaluator-problem/
- https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/
- https://blog.cloudflare.com/signed-agents/
- https://www.plushcap.com/content/cloudflare/blog/cloudflare-beyond-ip-lists-a-registry-format-for-bots-and-agents (mirror of blog.cloudflare.com/agent-registry)
- https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/browser-web-bot-auth.html
- https://datatracker.ietf.org/group/webbotauth/about/
- https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/
- https://datatracker.ietf.org/doc/draft-meunier-webbotauth-httpsig-protocol/
- https://developers.openai.com/api/docs/bots
- https://developer.visa.com/capabilities/trusted-agent-protocol/trusted-agent-protocol-specifications
- https://www.visa.co.uk/about-visa/newsroom/press-releases.3457328.html
- https://thepaypers.com/payments/news/mastercard-launches-agent-pay-in-latin-america-and-the-caribbean
- https://ecosistemastartup.com/visa-mastercard-y-ant-crean-marco-kya-para-agentes-de-ia/
- https://ap2-protocol.org/
- https://learn.microsoft.com/en-us/entra/agent-id/
- https://www.licensingschool.co.uk/licensing-blog/2026/03/23/agent-365-ga-announcement/
- https://auth0.com/ai
- https://www.paloaltonetworks.com/blog/identity-security/ai-agent-security-spiffe-machine-identity/
- https://www.nist.gov/caisi/ai-agent-standards-initiative
- https://datatracker.ietf.org/doc/draft-narajala-courtney-ansv2/
- https://github.com/block/buzz
- https://raw.githubusercontent.com/block/buzz/main/docs/nips/NIP-OA.md
- https://raw.githubusercontent.com/block/buzz/main/docs/nips/NIP-AA.md
- https://astral100.leaflet.pub/3mijhh4wyze2u (Bluesky automation label, opinion)
- https://en.wikipedia.org/wiki/Moltbook
- https://www.vouched.id/learn/vouched-announces-17-million-series-a-to-accelerate-expansion-building-on-know-your-agent-kya-suite-success
- https://www.vouched.id/pricing
- https://ecosistemastartup.com/?p=110157 (Baselayer $35M)
- https://www.ycombinator.com/launches/QCC-klaimee-insures-your-ai-agents
- https://fintech.global/2026/07/22/klaimee-lands-5-5m-to-insure-autonomous-ai-agents/
- https://dealroom.co/news/162200-harbor-lands-10m-seed-to-insure-the-ai-agent-liability-gap/
- https://arxiv.org/abs/2511.03434 (Inter-Agent Trust Models)
- https://arxiv.org/abs/2605.00073 (AgentReputation)

Search-only (not opened, marked unverified above): Mastercard Verifiable Intent (mastercard.com 403), pymnts.com Verifiable Intent, aileron PyPI (page failed to render), AIUC/Mount/ElevenLabs insurance, OWASP Top 10 for Agentic Apps, MetaComp KYA, 8004scan/agenteconomy counts, AP2 "60+ organisations".
