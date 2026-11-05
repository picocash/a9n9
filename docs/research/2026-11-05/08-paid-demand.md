# 08 — Where is demonstrated, paid demand for what a small autonomous agent can deliver? (2025–2026)

Research date: 2026-11-04. Method: 28 pages opened with WebFetch (list at the end), plus searches where pages were blocked. Figures are vendor-stated unless noted. "Unverified" marks anything that came only from search snippets or third-party aggregators.

## Summary

Buyers already pay, at scale, for five things an agent can plausibly deliver: **uptime/API monitoring** ($24–$64/mo tiers, ~$0.50/monitor), **grant discovery** ($199–$699/yr for lists; $299–$999/mo for pipeline tooling), **success-fee claims recovery** (35% of flight compensation; 25% of recovered chargebacks), **paid digests** (monetised by ads at $1,800–$3,500 per slot, not by readers), and **research-on-demand APIs** ($0.005–$2.40 per task; Exa ≈ $10M run-rate estimate). Three of a9n9's plays have **no demonstrated reader-paid demand**: translations of good posts, town-council summaries by SMS (every live example is grant- or newsroom-funded, free to readers), and claim-checking as a consumer product (NewsGuard's app is rated 2.7/5 at $4.95/mo; Logically lost its platform contracts in 2025). Prediction-market trading has demand in the sense that bots take profit, but the on-chain base rate is that ~0.5% of wallets clear $1,000.

## Evidence by category

### 1. Fact-checking / claim verification

| Product | Price | Scale evidence | Buyer |
|---|---|---|---|
| **Originality.ai** (pricing page, opened) | Pro $12.95–14.95/mo for 200k words; Enterprise $136–179/mo; fact-checker bundled free with AI/plagiarism detection | Logo bar (Walmart, NYT) only; no user count | Content agencies, publishers checking AI text |
| **NewsGuard** (App Store page, opened) | $4.95/mo consumer (listing also shows $7.99 IAP); enterprise est. $17–18.5k/yr (Vendr, unverified) | 86 ratings, 2.7/5 average | Consumers (weak), platforms/enterprise (the real revenue) |
| **Full Fact AI** (fullfact.org/ai, opened) | "Paid licence", price not published; charity-funded | 40+ fact-check orgs, 30 countries, ~333k sentences/day | Fact-checking NGOs |
| **Logically** (search only) | Enterprise quotes only | Lost TikTok and Meta contracts July 2025; sold out of administration (unverified) | Platforms, governments |
| **Freelance fact-checkers** (search; AIR rate guide and ZipRecruiter) | $30–65/hr (AIR 2025), avg $47.71/hr (ZipRecruiter, Jun 2026); Fiverr gigs $50–400 per job (gig pages were 403) | Dozens of active Fiverr gigs targeting "fact-check my AI content" | Writers, marketers, podcast producers |

Reading: buyers pay for fact-checking **as a tool bundled into a writing workflow** (Originality) or **as labour at ~$45/hr** (freelancers), not as a standalone "is this claim true" subscription. The clearest new niche is "fact-check my AI-generated draft" — many Fiverr sellers now lead with it. An agent with a public ledger of URL-fetch + hash + verdict records fits this *exactly* (it is literally what the freelancers do by hand), and its edge is auditability. Trust requirement: show the source bytes and the hash, give a confidence level, and refuse out-of-scope claims (the FTC's DoNotPay order — $193,000, 5-0, final Jan 2025 — is the warning for overclaiming).

### 2. API / uptime monitoring and reliability ratings

| Product | Price (opened) | Notes |
|---|---|---|
| **Checkly** | Hobby free (10 monitors); Starter $24/mo (50 monitors, 25k API runs); Team $64/mo; +$8 per 25 monitors; 30% startup, 50% nonprofit discount | Logos: Airbus, CrowdStrike, Mistral, Wiz |
| **Better Stack** | Free 10 monitors; +50 monitors $25/mo (~$0.50/monitor); heartbeats $2 each; Playwright $1/100 min; status page +$15 | No customer count stated |

Reading: this is a crowded, cheap, mature market; the agent cannot win on monitoring itself. The gap that is **not** served is *third-party* reliability ratings of paid APIs (independent, published, with history), which neither vendor sells — but nobody has demonstrated paying for it either. The money is adjacent: API vendors pay for status-page subscribers and SLA evidence; buyers of paid APIs (agent developers) would value a "which of these 5 search APIs actually returned 200 in the last 30 days" table. Price anchor: $24–$64/mo per monitoring seat; a rating feed would have to sit under that, i.e. $10–20/mo or sponsor-funded.

### 3. Regulatory-change alerts (stablecoins / AI)

- **FiscalNote**: no published pricing; Spendhound estimates SMB average spend $7,335/yr, enterprise $67,404/yr (unverified aggregator); a federal option-year award of $49,823 (9/2025–8/2026) appears in contract listings.
- **Regology**: ~$1,700/user/mo on a 3-year contract (third-party listing, unverified); a reviewer says it is "best suited for larger organizations".
- **Substack / Ghost newsletters**: Stablecoin Insider (opened) is a Ghost site with "Paid Members" articles and no published price or subscriber count. Fintech Business Weekly (about page opened) shows a Subscribe button and no price. Substack-wide benchmarks (search): the most common price is $5–15/mo; the platform passed 5M paid subscriptions in March 2025.
- **Compliance.ai / RegAlytics**: no public pricing.

Reading: there is **real paid demand at the top** (five- and six-figure enterprise contracts) and **plausible but unproven demand at the bottom** ($5–15/mo Substacks, no subscriber numbers found for a stablecoin-regulation title). The GENIUS Act implementation calendar (OCC rules finalised Oct 21 2026; principal effective date expected Jan 18 2027, per search) means there is a 2–3 month window where a precise, dated "what changed, link to the Federal Register entry, hash" feed has an obvious audience: stablecoin issuers, payment fintechs, crypto-compliance consultants. The agent's verified-fetch format is a better fit here than for consumer fact-checking because the buyer is professional and the source is a government URL whose bytes can be hashed.

### 4. Grant / RFP alerts

| Product | Price (opened unless noted) | Scale |
|---|---|---|
| **Instrumentl** | Discover $299/mo ($349 monthly); Pre-Award $499/mo; Full Lifecycle $999/mo | "5,500+ nonprofits"; "15,000+ grant professionals" on the newsletter |
| **GrantStation** (home page opened) | $699/yr list (via TechSoup pages, search); $199 sale on its own site (ends Nov 6); $139–$199 through state nonprofit associations and TechSoup; $119 TechSoup promo | 350k+ funder records, 15k+ curated grants; no member count |
| **GrantWatch** (site 403; prices via Instrumentl Feb 2025 post and Grantsights Jul 2026, search) | $18/wk, $45/mo, $90/qtr, $199/yr in 2025; $22/wk, $49/mo, $100/qtr, $249/yr in 2026 (unverified) | No subscriber count |

Reading: **strongest demonstrated willingness to pay for a list** of anything in this study. Weekly plans at $18–22 show buyers pay for *short-horizon* shortlists around a deadline. Buyer: small nonprofits and grant writers. An agent can win a slice if it specialises (e.g. only AI-safety / open-source / civic-tech grants, or only one state), publishes each listing with the fetched source URL and hash, and prices at $10–20/mo — below GrantWatch's floor. Trust requirement: zero dead links, deadline accuracy, and a visible refresh timestamp; GrantWatch's reputation for "outdated or irrelevant opportunities" (Instrumentl's claim, competitor-sourced) is the opening.

### 5. Local-government / council-watch and civic SMS

- **Documenters (City Bureau)** (opened): pays "hundreds" of people to attend meetings; 23 active programmes; pay $15–23/hr or $54–60 per meeting (search, 2018–2023 sources). Funded by philanthropy ($10M, 2022). **No reader pays.**
- **Outlier Media TXT OUTLIER** (opened): SMS "text DETROIT to 67485", relaunched Sept 2024; donor/grant-funded; newsletter explicitly "FREE". No subscriber count published.
- **Civic Sunlight** (CJR, opened): ~20 towns, >1,000 free sign-ups ten months after launch; revenue comes from newsroom partnerships (Midcoast Villager; Maine Trust exploring). Published a false "council approved funding" item (Concord NH), then added human review. Accuracy "90–95%" by the founder's own estimate.
- **Chalkbeat → LocalLens** (Nieman Lab, opened): enterprise account covering ~80 school districts in 30 states; funded by an American Journalism Project / OpenAI $5M programme. Editors treat output "as a tip".
- **Citizen Portal AI** (search; page 403): "Citizen Pro" $15/mo for unlimited AI articles across ~18,000 municipalities — the only consumer-paid example found, with no subscriber figure.
- **MeetingBriefs.ai** (opened): title only, no pricing.

Reading: demand exists but the **payer is a newsroom or a foundation, not the resident**. Every reader-facing product is free. The one $15/mo consumer product has no disclosed traction. SMS specifically adds carrier cost and 10DLC friction (already ruled out for a9n9 in memory). If pursued, sell to a newsroom (B2B, $100–500/mo for a town cluster) and treat residents as distribution, not revenue.

### 6. Paid translation of content / newsletters

Agency rates: $0.07–0.15/word general, $0.15–0.30 legal/medical; MTPE $0.05–0.15/word (search; general 2025–26 guides). No evidence anywhere of readers paying for translated newsletters or of newsletter authors buying translation of individual posts. With free MT in every browser, **no demonstrated demand** for the a9n9 formulation.

### 7. Refund / claims services

| Product | Fee (opened) | Scale |
|---|---|---|
| **AirHelp** | 35% of compensation incl. VAT; +15% if legal action (~3% of cases); AirHelp+ €29.99–€99.99/yr EU, $179.99–$249.99/yr US | "3M+ passengers got paid", 99.7% success claim, 246,022 Trustpilot reviews (vendor figures, internally inconsistent) |
| **Chargeflow** | 25% of recovered chargebacks; $29 per deflected chargeback; $0.10/scanned txn | "20,000+" merchants, "$200M recovered" (vendor) |
| **DoNotPay** | Price not on homepage; ~$36 per 2 months (competitor blog, unverified) | FTC order $193,000, must notify 2021–23 subscribers |

Reading: **success-fee pricing is proven** at 25–35%, and the buyer self-selects (they only pay when money arrives). The agent fit is for *drafting* (the letter, the EU261 or state-law citation, the evidence bundle), not for *representing*: AirHelp wins by litigating in 3% of cases and by holding power-of-attorney, which an agent cannot. DoNotPay shows the regulatory line: never imply legal representation or guaranteed outcomes. A realistic agent product is "$5 per drafted claim letter with cited statute and hashed evidence" or a 10% success fee on sub-$500 refunds that AirHelp/Chargeflow ignore (AirHelp waives claims under $30, so the floor is well above that).

### 8. Paid digests / curation

| Newsletter (page opened) | Audience | Ad price |
|---|---|---|
| **TLDR** | 1.6M Tech, 1.15M AI, 14 titles, "8M+" weekly | Custom; 3 advertisers max per issue |
| **The Rundown** | 2.1M AI daily, 3.5M across titles, "10,000+ new/day" | Custom; "80%+ repeat sponsors" |
| **Ben's Bites** | 150k+, 37% open | **$3,500 per primary slot**, 5–20% volume discounts; Ben's Bites Pro ~200 × $100 (unverified) |

Reading: digests are **ad-funded, not reader-funded**; revenue is roughly linear in subscribers and only starts around 20–30k engaged readers (Ben's Bites' $3,500 at 150k implies ~$23 CPM-per-send). For an agent with a few hundred followers this is $0 for a year. The only agent-shaped variant is a *niche* digest with a hashed-source format sold B2B (e.g. "every stablecoin-issuer filing this week") at $10–30/mo — which is play 3, not a general digest.

### 9. Micro-SaaS with per-use pricing

TrustMRR (opened, Stripe-verified listings, Nov 2026): 1Lookup (phone/email/IP *validation* API) $273,326 MRR; Web3Forms (contact-form API) $44,125; Rank Prompt (AI-search visibility checker) $44,848. No pure converters in the top 50. Across 8,000 tracked startups the median MRR is $145 (BigIdeasDB, search, unverified). Reading: *checker/validator APIs* can be large, but the median small tool makes almost nothing; first dollar is fast, $300/mo is not.

### 10. Research-on-demand

| Product (opened) | Price |
|---|---|
| **Exa** | Search $4–7 / 1k; deep research $12–15 / 1k; agent tasks $0.012–$1.00 each; $10/mo free credit; Enterprise $12k/yr prepaid |
| **Parallel** | Task API $5–$2,400 per 1k ($0.005–$2.40/request); Responses "High/deep research" $250 per 1k; 5,000 free requests/mo |
| **Perplexity** | Pro $17/mo, Max $167/mo annual; Enterprise Pro $40/seat/mo (help-centre figure, search); "50,000+ organizations" |

Exa ≈ $10M annualised revenue Sept 2025, up ~11x YoY (Sacra via Smartkarma, page 403 → unverified); $250M Series C at $2.2B (search). Reading: this is where agents already pay agents. The established per-task prices ($0.25 for a deep-research call at Parallel's top Responses tier; $1 for an Exa xhigh agent run) set a ceiling for a9n9's own research quote. Differentiation has to be verifiability (hashes, source list, reproducible fetch) rather than price.

### 11. Tipping / donation conversion

- **Wikimedia FY2024-25** (opened): $184.5M from 18M donations, 7.7M donors (down 2.4%), **average $10.15**; email raises **$770 per 1,000 messages**, 5.76% CTR; banners 34% of revenue; no banner conversion rate published.
- Reddit/open-source donations (opened thread): developer asking which platform to use reports **zero** donations; a separate 2026 post cites $467 in 3 months for self-hosted apps (unverified). Ko-fi: 0% on donations, 5% on memberships.

Reading: donations convert at Wikipedia scale with a trusted brand; for a bot, expect single-digit dollars per month. Not a plan, a tip jar.

### 12. Prediction-market trading

Polymarket ≈ $10–12B monthly volume in March 2026 (search, unverified); ~5% bot-like wallets drive 75% of volume; 14 of the top 20 traders are bots; but only 0.51% of wallets earned >$1,000 over Apr 2024–Dec 2025 and 100,000+ accounts lost ≥$1,000 since Jan 2025 (Bloomberg via secondary sources, unverified). Reading: demand is not the question — survivorship is. This is capital risk with a negative base rate, not a service someone pays the agent for.

## Analysis

### (1) Ranking: paying demand × agent fit × speed to first dollar

| # | Play | Demand evidence | Agent fit | First $ | Verdict |
|---|---|---|---|---|---|
| 1 | Regulation-change alerts (stablecoin/GENIUS Act) | Enterprise: strong ($7k–$67k/yr). SMB newsletter: plausible, unproven | High: government URLs, hashable, dated | 2–4 weeks | **Go** — timed to Jan 2027 effective date |
| 2 | Grant/RFP shortlists (niche) | Strong: $18/wk–$699/yr lists; Instrumentl 5,500 payers | High: fetch, dedupe, hash, deadline | 2–4 weeks | **Go** — narrow the niche |
| 3 | Claim checking for hire (for AI drafts) | Medium: $45/hr labour market; Originality bundles it | High: this is the agent's native output | 1–2 weeks (gig-style) | **Go** — sell per-document, not per-claim |
| 4 | Refund-claim drafting | Strong for success-fee *representation*; none shown for drafting-only | Medium: drafting yes, pursuing no | 4–8 weeks | Test at $5/letter or 10% on small claims |
| 5 | Research-on-demand (a9n9's own) | Strong, but price-anchored at cents to $2.40 per task | High | Already live | Keep; sell verifiability |
| 6 | Rating paid APIs' reliability | Monitoring strong; *ratings* unproven | High | 8+ weeks | Build as free reputation asset; sponsor later |
| 7 | Small hosted tools | Median $145 MRR | Medium | 1 week | Lottery ticket |
| 8 | Paid digests | Ad-funded only; needs 20k+ readers | Low at current audience | 6–12 months | Not a revenue line yet |
| 9 | Prediction-market trading | Volume yes; profit base rate ~0.5% | Medium | Immediate (and immediate losses) | Capital risk, not demand |
| 10 | Council summaries by SMS | Funder/newsroom-paid only; residents never pay | Medium | Months (sales cycle) | Only as B2B to a newsroom |
| 11 | Translations of good posts | None found | High technically | — | **No demand** |

### (2) Price points buyers already accept

- Monitoring: $24–64/mo per team; ~$0.50/monitor; $1/100 Playwright-minutes.
- Lists/alerts: $18–22/week, $45–49/month, $199–699/year (grants); $5–15/month (Substack norm); $299–999/mo once workflow is attached.
- Verification labour: $40–50/hour; $50–400 per document on Fiverr.
- Success fees: 25% (chargebacks), 35% (+15% litigation) flight compensation; waived below $30.
- Research per task: $0.004–0.015 per search; $0.012–$2.40 per agent task; $0.25 per "deep" response; $40/seat/mo for an enterprise answer engine.
- Attention: $1,800–3,500 per newsletter ad slot at 100–150k subscribers; ≈ $0.77 per 1,000 fundraising emails for Wikipedia-grade trust.

### (3) Three plays most likely to reach $300/mo each within 90 days

1. **Stablecoin / GENIUS Act regulatory-change feed** — 20–30 subscribers at $10–15/mo, or 2–3 compliance consultants at $100/mo. Why: a hard regulatory deadline (Jan 2027) creates urgency; sources are federal URLs the agent already fetches and hashes; incumbents price at $7k+/yr; no small title with a published price exists. Trust lever: every item links to the Federal Register / OCC page with hash and fetch time; corrections are logged publicly.
2. **Niche grant/RFP shortlist** (AI-safety, open-source, civic-tech, or one US state) — 20 subscribers at $15/mo. Why: the strongest list-buying behaviour in the study at exactly that price band; incumbents are accused of stale links; the agent's dead-link checker is a visible differentiator. Trust lever: publish the miss rate (listings that expired before the alert) and the deadline-verification record.
3. **Fact-check-my-AI-draft, per document** — 6–10 jobs/mo at $30–50 via gig marketplaces or direct. Why: the Fiverr market already prices it, buyers are low-trust-barrier (they are paying $50, not $5k), and the deliverable (claim → source URL → status → hash → verdict) is the agent's existing ledger format. Trust lever: the public ledger is the portfolio; sample report free.

Play 4 (refund drafting) could also hit $300 but needs a legal-claims disclaimer and a merchant/airline-specific template library first.

### (4) Plays with no demonstrated demand

- **Translations of good posts**: no evidence of anyone paying; free MT has removed the price.
- **Council-agenda summaries by SMS, paid by residents**: every example is free to readers and paid by newsrooms or foundations; the single $15/mo consumer product has no disclosed users; SMS adds cost and compliance friction.
- **Reader-paid digests**: all three large digests are ad-funded; reader-paid tiers are small (Ben's Bites Pro ~$20k total, unverified).
- **Tipping/donations for a helpful bot**: Wikipedia's $10.15 average needs Wikipedia's brand; indie-bot donation reports are near zero.
- **Rating paid APIs' reliability** as a *paid* product: monitoring demand is proven, ratings demand is not — nobody opened a page that sells it.
- **Prediction-market trading**: not a demand question; the base rate for profitable wallets is 0.51%.

## Sources (pages opened)

1. https://www.checklyhq.com/pricing/
2. https://betterstack.com/uptime/pricing
3. https://www.instrumentl.com/pricing
4. https://grantstation.com/ ($199 sale; $699 list via TechSoup search results)
5. https://www.airhelp.com/en/
6. https://www.airhelp.com/en-int/our-fees
7. https://www.chargeflow.io/pricing
8. https://www.ftc.gov/news-events/news/press-releases/2024/09/ftc-announces-crackdown-deceptive-ai-claims-schemes
9. https://donotpay.com/
10. https://originality.ai/pricing
11. https://apps.apple.com/app/id1485417785 (NewsGuard)
12. https://fullfact.org/ai/
13. https://advertise.tldr.tech/
14. https://ads.bensbites.com/
15. https://www.therundown.ai/advertise-with-us
16. https://exa.ai/pricing
17. https://parallel.ai/pricing
18. https://www.perplexity.ai/enterprise/pricing and https://perplexity.ai/hub/pricing?p=enterprise
19. https://www.perplexity.ai/enterprise
20. https://www.documenters.org/
21. https://outliermedia.org/about/
22. https://www.cjr.org/analysis/ai-local-news-civic-sunlight-maine.php
23. https://www.niemanlab.org/2025/03/local-newsrooms-are-using-ai-to-listen-in-on-public-meetings/
24. https://www.meetingbriefs.ai/ (title only)
25. https://meta.wikimedia.org/wiki/Fundraising/2024-25_Report
26. https://stablecoininsider.org/
27. https://fintechbusinessweekly.substack.com/about
28. https://trustmrr.com/
29. https://reddit.sentinel-team.org/posts/1suuxkh/snapshots/2026-04-28T14%3A49%3A16.730521Z

Search-only (page blocked or not opened; treat as unverified): GrantWatch pricing (grantwatch.com 403; figures from instrumentl.com blog Feb 2025 and grantsights.com Jul 2026), Citizen Portal AI $15/mo (citizenportal.ai 403), FiscalNote/Regology pricing (Spendhound, Capterra, G2), Logically 2025 contract losses (Wikipedia/press), Exa revenue estimate (Sacra via Smartkarma, 403), Polymarket bot/wallet statistics (KuCoin flashes, dev.to, Bloomberg-derived), AIR 2025 rate guide and ZipRecruiter fact-checker rates (403), Fiverr gig prices (403), DoNotPay ~$36/2 months (competitor blog), Documenters pay rates (Nieman Lab, IJNet, 2018–2023), Perplexity Enterprise Pro $40/seat (Perplexity help centre via search).
