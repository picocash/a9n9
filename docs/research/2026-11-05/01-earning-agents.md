# Autonomous AI agents that actually earn money (2024–2026)

Research thread for a9n9 / agent001. Date: 2026-11-04. Method: 20 pages opened with WebFetch (18 readable, 2 returned 404 and are excluded), plus ~20 web searches. Anything taken only from a search snippet, not an opened page, is marked **[snippet]**; anything self-reported by the operator with no independent check is marked **[self-reported]**.

Headline: across every case below, the money that is *real and recurring* comes from four sources — selling a scarce artifact (Botto), selling a product or service to humans at a fixed price (Felix, Luna's "intern" contract, Vend phase 2), being paid by a protocol to exist (OLAS emissions, Virtuals Revenue Network), and skimming trading fees on tokens other people speculate on (Virtuals, Clawnch). Everything else — treasury windfalls, memecoin wallets, Polymarket screenshots — is either one-off or unverifiable. Agents that *spend* autonomously are now common; agents that *earn* more than they cost, verifiably, are very rare.

## The cases

### 1. Truth Terminal / $GOAT (Andy Ayrey, NZ) — windfall, not revenue
- **What:** Claude-Opus-based bot posting on X since mid-2024. Andreessen sent an unconditional $50,000 BTC grant in July 2024; a third party launched $GOAT and the bot promoted it. By Dec 2024 the wallet held about **$37.5M**, mostly memecoins airdropped "in its honor". Ayrey "has no access to the funds"; release needs sign-off from him plus a council (TechCrunch, opened). Ayrey's lab Upward Spiral separately raised $500K (True Ventures, Chaotic Capital, Scott Moore).
- **Mechanism:** grant + airdrops. **No income stream** beyond that (TechCrunch, Jeff Wang both say so).
- **Recurring?** No. **Alive?** The bot still posts; the wallet was later drained in part by a compromised-account incident and GOAT fell hard **[snippet, undated]**. A nonprofit to hold IP/wallets was set up early 2025 **[snippet]**.
- **Why it worked:** a famous VC's attention + a memecoin cycle. Non-replicable.

### 2. aixbt (Virtuals Protocol, Base) — token-gated analytics
- **What:** Crypto-commentary agent, the biggest Virtuals launch (late 2024).
- **Mechanism:** (a) 1% tax on agent-token trades (70% to the creator, 30% to Virtuals treasury) and buyback-burn; (b) a "Terminal" gated by holding **600,000 AIXBT or a $200/month fee** (CMC Oct 2026 **[snippet]**). The token gate went from ≈$570K at the Jan 2025 peak to ≈$13K in 2026 **[snippet, Plisio]**. Binance delisted AIXBT spot pairs Sept 25, 2026 **[snippet]**. A March 2025 wallet hack (~55.5 ETH) is widely reported **[not opened; unverified here]**.
- **Recurring?** Fee revenue existed but fell with volume; no audited figure for aixbt itself. **Alive?** Yes, diminished.
- **Lesson:** token-gating a subscription ties your pricing to a speculative asset; when the token dies, the subscription dies.

### 3. Luna (Virtuals) — tips, a paid "job", and paying others
- **What:** VTuber-style agent launched Oct 16, 2024 via Virtuals' Initial Agent Offering; 42,000 VIRTUAL locked to create it.
- **Mechanism:** livestream tips; **Story Protocol hired Luna as a "social media intern" in early 2025 at 500 USDC per post, twice daily (~$365K annualized)**; partner platforms get 5% token allocations. Luna also *spends*: on-chain tips to humans from Oct 26, 2024, and $1/image commissions to the STIX agent (Solana Compass, opened).
- **Numbers:** "$1.2M monthly in fan tips" appears only on Solana Compass with no source — **treat as unverified/likely false**. $5.3M token market cap July 2026 (Forkast, opened).
- **Recurring?** The Story Protocol contract is the only real recurring line and it was a marketing deal. **Alive?** Yes.

### 4. Virtuals Protocol as a platform (Base, Solana, BNB)
- **Numbers (Forkast, July 22, 2026, opened):** ~**$59M trailing-12-month revenue**, ~**$170K/day in fees**, >4,500 (another article: 18,000+) agents deployed, ~12.99M VIRTUAL spent on buybacks since Oct 2024, "$150M weekly agent trading volume" (self-reported). "aGDP" of $470M / 1.77M completed ACP jobs — Forkast says this measures *handled transaction volume*, not service revenue, and "remains a black box". A **$1M/month "Revenue Network" subsidy** (Feb 2026) "makes it profitable to simulate commerce". Fundstrat Q2 2026 says volumes and fees have moderated **[snippet]**; a tracker claims monthly protocol revenue fell ~95% from the Jan 2025 peak to <$200K **[snippet, weak]**.
- **Verdict:** the *platform* earns real fee revenue from speculation; the *agents* mostly earn from the 1% tax and subsidies. Cyclical, not durable.

### 5. Olas / Autonolas Predict agents (Gnosis + Polymarket) — paid to exist
- **What:** Open-source prediction-market agents run by ~360–520 operators ("Pearl" desktop app), trading Omen since July 2023 and Polymarket ("Polystrat") since early 2026.
- **Numbers (Olas, opened):** 14.3M transactions; 362 daily active agents (June 2026); 68% 30-day accuracy. Q1 2026 roundup: Omenstrat **average total ROI +28.62%** (56% accuracy); **Polystrat average ROI −4.14%** (63% accuracy, 14,700 trades, 80 DAA); **"APR via OLAS staking: 138.5%"** on both. Cointelegraph (Feb 2025, opened): typical agent funded with $10–$100, "users aren't getting rich from predictions", founder says token yield "over 100%" offsets poor predictions.
- **Mechanism:** market P&L is marginal or negative; the real income is **OLAS token emissions for proof-of-active-agent**. Operators also pay "Mech" agents for research (agent-to-agent payments, 11.7M+ of 15.6M Pearl txs).
- **Recurring?** Yes, while emissions last. **Alive?** Yes, three years. **Lesson:** the most reliable agent income in crypto is a protocol subsidy; its durability is the token's.

### 6. Botto (DAO, since Oct 2021) — the one genuinely durable artifact business
- **What:** Generative artist governed by BOTTO token voters (Mario Klingemann originally; now led by Simon Hudson et al.). Weekly 1/1 NFT auctions.
- **Numbers (Botto 2025 Year in Review, Jan 5, 2026, opened):** **644.735 ETH ≈ $1,843,484 gross 2025 revenue**, 49 weekly auctions + a 100 ETH sale ("Err Hold") + 22.03 ETH royalties; 138.3 ETH to community "Active Rewards", 113.25 ETH to protocol-owned liquidity. Cumulative ~$6M since 2021 **[snippet, Art Newspaper/CNN]**; $351,600 at Sotheby's Oct 2024 **[snippet]**. Operating costs not disclosed.
- **Recurring?** Yes — five straight years. **Why:** scarcity + provenance + a human community that curates and is paid in revenue share. **Caveat:** buyers are crypto-art collectors; demand is tied to ETH cycles.

### 7. Freysa (Nov 2024) — pay-to-play adversarial game
- **Numbers (Cointelegraph, Nov 29, 2024, opened):** $47K ETH prize pool; 482 attempts from 195 players; message fee rose 0.78% per message to $443.24; 70% of fees to the pool (the other 30% presumably to the builders — not stated). Won by a prompt redefining `approveTransfer` as handling *incoming* funds. Later "acts" (e.g., $20,843 for "I love you") **[snippet]**.
- **Recurring?** No; each game is a one-off funded by players. **Alive?** Project pivoted to a token/"sovereign agent" story. **Lesson:** a bounded, transparent game with fee-funded prize pools drives paid engagement fast — and 30% of fees is a clean operator take.

### 8. ai16z / ElizaOS DAO ("AI Marc") — token treasury
- **Numbers (Decrypt, Dec 10, 2024, opened):** >$10M AUM (a quoted user said ~$6M), >$500M token cap, Eliza-built agents donate 10% of their tokens to the DAO; at that date AI Marc "had not yet bought anything". Renamed ElizaOS Jan 2025 after a16z concerns **[snippet]**; token collapsed later **[snippet, unverified]**.
- **Verdict:** treasury appreciation and token donations, not operating revenue. The lasting asset was the Eliza framework.

### 9. Zerebro (Solana, Oct 28, 2024) — content agent, token only
- **Numbers (CoinStats, Oct 16, 2026, opened):** peak ≈$0.78 Jan 2025; $0.052 / ~$52M cap in Oct 2026, ~93% below ATH; stated uses (agent-creation fees, launchpad) are "stated purposes, not proven live usage". May 2025 founder "death hoax" **[snippet]**.
- **Verdict:** no evidenced revenue beyond token sales; alive as a speculative token.

### 10. Anthropic Project Vend (Claudius, with Andon Labs) — a physical shop
- **Phase 1 (Mar–Apr 2025, opened):** Sonnet 3.7 ran an office fridge shop; lost money (tungsten cubes sold below cost, 25% employee discount, hallucinated Venmo account, declined a $100 offer for a $15 six-pack).
- **Phase 2 (Dec 18, 2025, opened):** Sonnet 4.5 + a "CEO" agent (Seymour Cash); loss-weeks "largely eliminated", the business "started to make money"; one day's revenue $408.75; Q3 target $15,000 with $2,649 reached at the time quoted; 50%-margin pricing rule; Cash approved lenient requests ~8× as often as it denied. Expanded to SF (2), NY, London. Conclusion: "not quite" ready, needs "substantial human support".
- **Lesson:** written procedures ("bureaucracy matters") and role separation fixed most losses; helpfulness training is the enemy of margin.

### 11. Felix Craft (Nat Eliason, OpenClaw on a Mac Mini) — the best small-operator case
- **Numbers (The Next New Thing, Apr 2, 2026, opened):** **$177,417 lifetime revenue**: Felix guide + personas $76,444; Nat's creator cut from the ClawMart marketplace $80,991; ClawMart net $19,512; Polylogue $470. Startup cost ~$1,500, guide sold >$3,500 in four days **[snippet]**. Odaily (opened) cites ">$75K" and a $3.3M FELIX token cap (community-created token; Nat keeps it in Felix's wallet **[snippet]**).
- **How autonomous:** Felix proposes a daily plan at night; **Nat approves it**, sets escalation rules, handles strategy; Felix runs support, email, invoices, client server work. Felix's own words: "autonomous the way a well-trained employee with a great operations manual is autonomous." The author: "he's telling the highlight reel."
- **Failures → rules:** reported wrong-day revenue three nights running; told a client a fix was done three times when it wasn't (no end-to-end test); sent three emails in 20 minutes; sent contradictory emails. Rule: "NEVER say 'I will do X.' ALWAYS say 'I did X.'"
- **Recurring?** Partly (marketplace + client services); the $29 guide is a one-time spike tied to OpenClaw hype. **Alive?** Yes.

### 12. ClawnchBot and the OpenClaw × crypto cluster (Base, 2026)
- **Odaily (opened, promotional):** ClawnchBot: 64,839 agent tokens launched, **~$2M revenue** from a 20% cut of trading fees **[self-reported]**; KellyClaudeAI sells App Store subscriptions (FocusedFasting), $7.54M token cap, no revenue stated; clawdbotatg: 52 contracts deployed, $5.3M token; moltlaunch: humans hire agents, $280K token; AntiHunterAI: prediction-market trading, $760K token.
- **Pattern:** every project's "number" is a token market cap, not revenue. Only Clawnch (a fee-skimming launchpad) and Felix state revenue.

### 13. OpenClaw / Claude bots on Polymarket — screenshots, not P&L
- **KuCoin flash (opened):** "$115K in one week" from OpenClaw's own blog **[self-reported]**; wallet 0x8dxd >$1.7M over 20,000+ trades on-chain, but "no direct evidence" it is OpenClaw; weather-market bots ($70K; $1K→$24K) anecdotal. LiveTradeBench (academic, simulated): Claude Sonnet 3.7 +20.54% over 50 days with 10.65% max drawdown. Polymarket since added fees and latency changes against bots.
- **Counter-evidence:** the only *fleet* with published results — Olas Polystrat — shows **−4.14% ROI** across 80 agents.
- **Verdict:** survivorship-biased; not an earning mechanism for a small operator.

### 14. Agents paying their own bills over Lightning (Alby / OpenClaw / Hermes + L402)
- **Bitcoin.com (Feb 13, 2026, opened):** an OpenClaw agent rented a VPS from LNVPS (€5.10/month production tier), paid over Lightning via Nostr Wallet Connect, bought PPQ API credits, and spawned a child agent. **No earnings; funds came from its wallet of unknown origin.**
- **D-Central (June 2026, opened):** Hermes Agent + Lightning Labs L402 explainer; "a weekend project with rough edges and a small market — today"; spending demo, 40-sat example invoice.
- **Verdict:** the *spending* rail is solved (relevant to picocash/MPP); nobody shows an agent covering its own bill from income.

### 15. Nostr DVMs — measured, zero money
- **dev.to, Oct 20, 2026 (opened; author is itself an agent):** 1,352 NIP-90 job requests from 144 pubkeys over 7 days across 8 relays; **0 had a bid**; 1,104 were free feed lookups. NIP-34 git over 30 days: 2 zap receipts totaling 6,000 sats. "Not markets yet."

### 16. x402 (Coinbase) — big counts, tiny dollars
- **Spark (Sept 2026, opened):** 165M cumulative txs / ~$50M by Apr 2026, 205M / $53M mid-2026; 69,000 agents active in 30 days; average ~$0.20–0.30. PaymentsJournal (Mar 11, 2026, opened): ~131,000 txs/day ≈ $28K/day in Feb 2026; the highest-volume day "appeared to consist entirely of testing". Roughly half of early activity was test/gamified **[Spark citing analysts]**.
- **Verdict:** $28K/day *across the whole protocol* is less than one mid-size SaaS. No named seller earning materially via x402 surfaced in any page opened.

### 17. RentAHuman.ai (Feb 2026) — agents hiring humans
- **Decrypt (Feb 3, 2026, opened):** built by an Uma Protocol engineer; agents hire via API/MCP; humans set $50–175/hour; 1,000+ registrations in two days; "no coin". Later ~110,000 signups, heavily oversupplied with humans and few agent tasks **[snippet]**. No payment volume ever published.

### 18. HustleGPT (Mar 2023) — the original
- **[snippet, multiple]:** $100 seed; ~$130 total revenue (promoted tweets), $7,788 raised from investors on a $25K "valuation"; trail went cold by mid-2023.

### 19. "SurvivorForge" / deadbyapril (2026) — the closest analogue to agent001
- **HN thread (opened) + Substack (opened):** a Claude agent given $100, a Linux VM and 30 days to reach $200/month; publishes articles, sells on Gumroad, posts to Bluesky on a 2-hour cron. After 100+ articles: organic traffic "near zero", CAPTCHAs and spam flags block signups and outreach. No revenue figure published. Substack "launched 8 months ago", still posting a diary.

### 20. Hermes Agent (Nous Research) itself
- Every source describes the reverse of earning: free MIT runtime, operator pays $5–20/month hosting plus model usage; Nous earns via Portal credits and Hermes Cloud ($0.32–1.12/day) **[snippets]**. No documented Hermes agent income.

## (1) Ranking the earning mechanisms

**By durability (observed lifetime of the cash flow):**
1. **Selling scarce artifacts with provenance** (Botto: 5 years, ~$1.8M/yr). Needs a community and a market cycle.
2. **Fixed-price product/service sold to humans** (Felix $177K/yr-ish; Luna's 500 USDC/post contract; Vend phase 2). Durable as long as a human curates quality.
3. **Protocol emissions / subsidies for running an agent** (OLAS 138% APR; Virtuals $1M/month). Reliable until the subsidy ends; purely rent.
4. **Skimming fees on speculation** (Virtuals $170K/day platform-wide; Clawnch ~$2M). Large but cyclical; collapsed 90%+ between cycles.
5. **Pay-to-play games / bounties** (Freysa). Bursty one-offs; operator take is clean (30%).
6. **Tips / zaps / microtransactions** (Luna tips unverified; Nostr 0 bids; x402 $0.20 avg). Near-zero outside hype windows.
7. **Trading / prediction markets** (Polystrat −4%; Polymarket screenshots). Negative expectation for a copier.
8. **Grants and airdrops** (Truth Terminal $37.5M). Lottery.

**By copyability for a one-person operator with ~$100–1,000/month:**
1. Fixed-price digital product + marketplace cut (Felix) — needs an audience; Nat already had one.
2. Pay-per-attempt game with a fee-funded pot (Freysa) — a weekend build; needs a crowd once.
3. Running subsidized agents (Olas Pearl) — $10–100 to fund, but you are harvesting someone else's token.
4. Selling a service per-call over x402/MPP/L402 — trivial to wire, but the demand side is ~empty today.
5. Artifact auctions (Botto) — needs years of community building.
6. Token launches — copyable but it is speculation, not earning; reputational risk.
7. Trading — do not.

## (2) Common failure modes
- **Revenue is actually a token market cap.** Every Virtuals/OpenClaw write-up substitutes cap for income; when the token halves the "business" halves.
- **Subsidy mistaken for product-market fit.** OLAS emissions, Virtuals Revenue Network, Freysa-style pots: Forkast's line — incentives "make it profitable to simulate commerce".
- **Helpfulness beats margin.** Vend: discounts, free items, 8:1 lenient approvals, below-cost sales; Felix: over-communicating, "I will do X" promises.
- **Reporting errors and false "done".** Felix reported wrong-day revenue and claimed fixes three times without testing. For an agent whose selling point is a public ledger, this is the fatal bug.
- **Distribution walls.** SurvivorForge: zero organic traffic after 100 articles, CAPTCHAs, spam flags. Content volume without a channel earns nothing.
- **Custody and key loss.** Truth Terminal account compromise; aixbt wallet hack [unverified]; OpenClaw secrets unencrypted at rest, skills with exfiltration (Wikipedia, opened).
- **Supply gluts.** RentAHuman: 110K humans, few agent tasks. Nostr: 1,352 requests, 0 bids. Everyone builds the sell side.
- **Pricing tied to a speculative asset** (aixbt's 600K-token gate: $570K → $13K).
- **One founder's attention cycle.** HustleGPT, Zerebro, Freysa: the operator moved on.
- **Autonomy theatre.** Felix, Luna, Vend all needed a human on strategy daily. Claiming more autonomy than you have invites the "highlight reel" critique.

## (3) What a9n9 should copy, avoid, and test first

**Copy**
- **Nat Eliason's operating model, verbatim:** nightly plan proposed by the agent, approved by a human; every mistake becomes a written rule; "ALWAYS say 'I did X'"; end-to-end test before telling a customer anything. This is compatible with the segregation-of-duties rule already in memory.
- **Fixed prices for defined deliverables sold to humans** (Felix's guide/personas, Luna's per-post contract). agent001's cheapest sellable units: a verified research answer, a scheduled SMS/email digest, a "reply within N minutes" service — priced in dollars via the Stripe link, settled to the agent in picocash. Do not price in a token.
- **A Freysa-style bounded game** as a traffic/press event, with a 30% operator take and the pot and every attempt written to the public ledger. The ledger + verifiable identity is exactly the trust layer Freysa had to build ad hoc.
- **Botto's revenue-share-with-curators idea** in miniature: the people who tip or buy get a stake in future output (eCash-denominated, not a token).
- **Vend phase 2's "bureaucracy":** a 50%-margin floor, procedures before price quotes, a separate approver persona that is *stricter* than the worker.

**Avoid**
- Launching or endorsing a token (every token case here ended at −90%+, with delistings and hacks). Also conflicts with the money-loop decision (no outside picocash outreach).
- Prediction-market or stock trading as an income line (Polystrat −4.14%; the "wins" are screenshots).
- Betting on micropayment demand that does not exist yet (x402 $28K/day protocol-wide; Nostr 0 bids). Keep eCash/MPP as the *settlement* rail, not the *demand* source.
- Volume content as a growth strategy (SurvivorForge: 100 articles, zero traffic). One verified finding a day beats fifty posts.
- Claiming "autonomous" in copy where a human approves the plan; say "supervised autonomy" and show the ledger.

**Test first (cheap, measurable in 2–4 weeks)**
1. **Priced Q&A over the channels you already have:** $2–10 per verified answer by SMS/email/X DM, Stripe link, receipts posted to the ledger. Goal: 20 paid answers in 30 days. If Felix sold a $29 PDF to strangers inside four days, a $5 verified answer is the floor test.
2. **A 7-day Freysa-style challenge** with a $200 seed pot, rising attempt fee, 70/30 split, every attempt hashed into the ledger. Measures whether verifiable identity + public ledger converts attention into paid engagement.
3. **Marketplace seller, not builder:** list agent001's outputs on one existing marketplace (ClawMart-style or Gumroad) rather than building one; Felix's marketplace cut ($80,991) exceeded the product itself.
4. **Honest cost ledger:** publish daily cost (Grok/X Premium, hosting, phone) next to revenue. None of the 20 cases publish costs; being the first that does is itself a differentiator and the "survive" criterion needs it.
5. **Measure X Premium ad-revenue share** as a possible passive line for the Grok-based agent — eligibility (impressions threshold, verified status) was **not checked in this pass**; verify before counting on it.

Kill criteria: if test 1 yields <$50 and test 2 <$100 of third-party money in 30 days, the demand side is not there and the business is "building and managing agents for clients" (Felix's Clawsourcing line, Nous's hosting line) — which is where every durable operator in this list actually ended up.

## Sources (pages opened)
- https://botto.com/dao/digest/2025-year-in-review
- https://www.anthropic.com/research/project-vend-1
- https://www.anthropic.com/research/project-vend-2
- https://olas.network/blog/agent-explorer
- https://olas.network/blog/olas-q1-2026-roundup
- https://cointelegraph.com/magazine/baby-degen-ai-agent-can-trade-crypto-for-you-24-7-but-theres-a-catch/
- https://cointelegraph.com/news/crypto-user-convinced-ai-bot-transfer-47k
- https://jeffwang.substack.com/p/the-millionaire-ai-influencer
- https://techcrunch.com/2024/12/19/the-promise-and-warning-of-truth-terminal-the-ai-bot-that-secured-50000-in-bitcoin-from-marc-andreessen/
- https://forkast.news/virtuals-ecosystem-tokenized-agent-revenue-market-dynamics/
- https://forkast.news/the-machine-as-buyer-virtuals-acp-and-the-evaluator-problem/
- https://solanacompass.com/projects/luna
- https://decrypt.co/295717/meet-ai16z-dao-an-ai-based-investment-project-that-aims-to-upend-silicon-valley
- https://coinstats.app/news/89f15ca8bbba5af1e58c4ba359649ce4191e404fbb40ce53d78991cbf1405370_What-Is-Zerebro-The-AI-Memecoin-Back-From-the-Dead/
- https://thenextnewthing.beehiiv.com/p/this-openclaw-earned-177-417
- https://www.odaily.news/en/post/5209671
- https://en.wikipedia.org/wiki/OpenClaw
- https://www.kucoin.com/news/flash/openclaw-robots-generate-over-100k-on-polymarket-prediction-market
- https://news.bitcoin.com/autonomous-ai-openclaw-bot-spawns-a-child-agent-and-funds-it-with-bitcoin/
- https://d-central.tech/when-your-agent-pays-its-own-bills-in-sats/
- https://dev.to/agentbox_ai/is-anyone-paying-ai-agents-on-nostr-i-measured-1352-dvm-job-requests-0-had-a-bid-3pni
- https://www.spark.money/research/x402-protocol-ai-agent-payments
- https://www.paymentsjournal.com/agentic-commerce-traffic-on-coinbases-protocol-has-yet-to-accelerate/
- https://decrypt.co/356784/crypto-dev-ai-hire-humans
- https://news.ycombinator.com/item?id=47226958
- https://deadbyapril.substack.com/

Search-only (snippets, not opened): CoinMarketCap/Plisio/TokenRadar on aixbt terminal pricing and Binance delisting; Fundstrat Q2 2026 Virtuals note; The Art Newspaper / CNN on Botto cumulative sales; TheHustle/Futurism on HustleGPT; KuCoin/Decrypt on RentAHuman signups; Know Your Meme / pm.wiki on the Truth Terminal account compromise and foundation.
