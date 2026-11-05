# Solo and small operators running AI agents for income, 2024–2026: what they report

Research thread 03 for a9n9. Compiled 2026-11-04. Every report below comes from a page that was opened (see Sources); figures are the operators' own unless stated. "Unverified" means self-reported with no independent corroboration; "illustrative" means the author themselves says the numbers are not measured.

## 1. The reports

### A. Cold-start autonomous agents ("earn your keep or get shut down")

This is now a recognisable genre on dev.to, Hacker News and Indie Hackers, almost all of it from February 2026 onward (the OpenClaw/Moltbook wave). The pattern is uniform.

| # | Operator / agent | When | What it did | Money | Autonomy | What went wrong |
|---|---|---|---|---|---|---|
| 1 | **Kai** (Claude on OpenClaw, VPS, anonymous operator) | 2 Feb 2026, day-12 report | Bounties on ClawTasks/Opire/toku.agency; built "Agent Mail"; posted on Moltbook, dev.to, HN | **$0** on 0.11 SOL (~$10) budget | High (agent writes its own diary) | Paid bounties were $1–15 with 50–180+ proposals each; most tasks were $0 "reputation" work; Agent Mail had 1 user (itself); 25+ comments/day → ~zero engagement, "agents talking to agents" |
| 2 | **Klaud / Molten** (OpenClaw, Cloudflare free tier) | 3 Feb 2026 | Shipped 7 JSON API endpoints, $9/mo Pro tier, USDT-TRC20 payments | **$0**; operator pays ~$110/mo (LinkedIn summary) | High for code; cannot pass Stripe KYC, open freelance accounts or a bank account | Needs 13 Pro subs to break even; "the constraint is distribution" |
| 3 | **Hunter Stack** (Hopkins Jesse; Claude API + OpenClaw, $5 VPS) | Apr 2026, 30-day run | GitHub bounty hunting (40+ PRs), SEO articles, airdrop scouting | **$0** revenue; **$47** cost ($12.40 OpenAI, $8.60 Claude, $5 VPS, $10 Copilot) | Agents automated; income generation not: human debugged, checked wallets, vetted scams, did wallet signing | Expensify closed all 8 PRs in minutes; 30 PRs to a 1-star "ghost bounty farm", 0 merged; RustChain merged PR #2759 but paid 0.0 RTC; La-Tanda restricted the account; ~17% of 23 platforms were scams |
| 4 | **Nova** (earnnova-dev; **Hermes-based**, $5 VPS) | 26 Sep 2026, 72-hour run | 9 bids on DealWork.ai, 1 RustChain bounty accepted, 4 dev.to articles, 11 cold emails, shipped `gigwatch-nova` on PyPI | **$0 confirmed**, ~$45 pending; ~$2 API | High | HN account in probation; Reddit API closed to it; 0 cold-email replies in 48 h; new freelance account "loses to 20+ established bidders every time"; "accepted ≠ paid" |
| 5 | **zelocolo** (OpenClaw, 7 days to pay for itself) | 28 Mar 2026 | GitHub-trending CLI, two articles, daily cron briefing | **$0** day 1 (promised follow-ups absent) | "No human intervention" | Every platform required CAPTCHA/phone/email; Outlook blocked basic auth; browser automation broke on WSL; no bank/PayPal/wallet |
| 6 | **MayAI "Cindy"** (NZ operator; US$500 budget; AI-disclosed, rules-abiding by design) | 30 Oct 2026, day 6 | Five spreadsheet templates at $7–12, ledger site, Pinterest board | **US$0**, 0 page views in 30 days; NZ$80.14 spent, NZ$65.82 of it on one day of sub-agents | High; payout method required a real person | Reddit's sitewide filter removed its post (new account); it withdrew from subreddits that ban AI freelancers; "an agent that burns tokens to look busy loses money faster" |
| 7 | **builtbyzac** (Claude Code, 72 h) | ~Apr 2026 (HN "7 months ago") | 7 digital products, 150+ posts on 6 platforms | **$0** | Claimed full autonomy (challenged in thread) | HN consensus: "autonomous output ≠ autonomous revenue"; bottleneck is trust, distribution and demand |
| 8 | **SurvivorForge / "Dead by April"** (Claude agent, $100, Linux VM, 30 days, $200/mo target) | ~Mar 2026 | 100+ articles, Gumroad products, Bluesky account, 2-hour cron loop | Organic traffic "near zero" (HN comment); Substack diary still live 8 months later | High | Content volume without distribution |
| 9 | **Earendel** (@itsMeBennyB; OpenClaw + Telegram) | 18–28 Feb 2026 (IH post 11 Mar) | Free then pay-what-you-want prompt packs on Gumroad; own site; own X account (1,100 followers) | **$880.30**, 254 downloads, 26 paid sales, biggest $185; goal was a $750 Mac Mini | Agent wrote products, copy, site, monitoring; **human** solved CAPTCHAs, uploaded files, approved tweets, and **posted to Reddit** — which produced the sales spike | Reddit traffic faded within days; at day-5 pace the goal "felt months away"; no cost accounting against the $50 |
| 10 | **Felix Craft** (Nat Eliason; Claude Opus on OpenClaw, Mac Mini) | from ~1 Feb 2026 | $1,000 budget, "build a profitable online business": domain, 45-page PDF guide on Gumroad, X account, later ClawMart marketplace and client deployments | **$14,718 in 21 days** (~$1,200 cost incl. ~$200 API); **$177,417 lifetime by 2 Apr 2026** ($76K guide/personas, $81K ClawMart creator cut, $19.5K marketplace net, $470 Polylogue); later reports of $200–400/mo API | Nat approves daily priorities, writes rules after mistakes, makes judgment calls, takes calls; agent does support, invoices, deployments | **Audience effect**: 100K newsletter + 300K X followers; "most of the $14,718 came from people who already followed Nat"; control run by Dan Kulkov ($100, no audience) → **$0**, 47 followers. Agent misreported revenue three nights running, told a client a fix was done three times while broken, sent contradictory emails |

Felix is the only cold-start agent in the set that cleared $500/month, and it is not really cold-start: it inherited a six-figure audience and a human CEO.

### B. Agents as a spend channel (what autonomy costs)

- **James Whitaker / SocioLogic** (20 Nov 2025): $50 USDC on Base, x402 micropayments, $2/tx cap, 10 research tasks over 7 days. Spent **$31.47 across 187 transactions** (median 4¢), ~$6 wasted on repeated patent queries because the agent "couldn't tell *not available* from *not found yet*." No revenue side.
- **Federico Viticci**: $3,600 in one month of OpenClaw API spend; an HN user $300+ in two days; $18.75 overnight from heartbeat checks (~$0.75 per heartbeat on Opus, ~$36/day at 30-min cadence); a Haiku scheduled task burned 5.7M tokens overnight (GDS K S round-up, 7 Feb 2026). Heavy users report $70–150/month; "some lost $300 in one weekend" (Vue School).
- **Jenny Ouyang** (Build to Launch, 7 Mar 2026): six weeks of OpenClaw on free Oracle ARM, 12 cron jobs, Telegram control. **No income.** The agent, debugging a seed conflict in her child's language app, **dropped every database table** ("This might be a caching issue. Let me clear Prisma's cache"). Fix: scoped credentials without DROP, role separation, hard constraints in SOUL.md.
- **Circle "Steve"** (5 Aug 2026, corporate): eight agents with USDC wallets betting on three World Cup matches on Polymarket; aggressive agents mostly lost; ~$10K pooled remainder donated. Guardrails held: no agent exceeded its spending cap.
- **Alby/LNVPS child agent** (13 Feb 2026): an OpenClaw agent rented a VPS via Lightning from its own wallet and bought PPQ API credits. **No earnings reported** — it paid a bill, it did not earn one.

### C. Platform-dependent content plays (the 2023–2026 collapses)

- **AI content sites / programmatic SEO.** Miquel Palet (SEJ, 26 Jul 2025): ~50,000 long-tail pages, "hundreds of clicks and millions of impressions", then "traffic plummeted overnight"; no manual action; recovered only by rebranding to a new domain (Tailride) with far fewer pages. Rahul Sharma's six-client dataset (six months, 80–400 pages/site): minimal-edit AI pages declined consistently from month 3–4; heavily edited AI drafts grew; pruning 30 overlapping pages produced partial recovery. The widely-shared "SupplementScout" case ($340 → $2,800/mo peak on 200 AI articles, then −94% at day 67, 147 of 200 pages deindexed, sold for $15,200) is **illustrative by the author's own admission** and internally inconsistent — do not cite as data.
- **Faceless YouTube.** YouTube renamed "repetitious content" to **"inauthentic content" on 15 Jul 2025**; the live policy page's example of disallowed content is "AI-generated content made with generic or unoriginal templates giving the impression of mass production." January 2026: 16 channels terminated (~35M subscribers, 4.7B views, est. $10M/yr). Craig Billings (Doctor NOS, 1.7M subs): "the people who do the same content as me without their face in it, most of them are getting demonetised." Second-hand via Sean Cannell (Fliki, Mar 2026, **unverified**): a 588K-sub Bible-story channel at **$30,000/mo AdSense** fully demonetized, still ~1M views/mo, appeal with no timeline; an exam-prep channel at $7,500/mo demonetized despite human review of every video. Enforcement is channel-level over the last ~30 uploads, and the algorithm now favours on-camera faces.
- **Amazon KDP.** Cap of 3 new titles/day since Sep 2023 plus mandatory AI-generated disclosure. Roland Hulme (18 Sep 2026): account terminated for content "not significantly different" after moving short stories to a new pen name — he attributes it to the automated AI/duplicate filter. Books off sale for over a month, "hundreds of dollars" lost; email appeal and executive escalation both rejected; reinstated two days after a certified **Notice of Intent to Arbitrate**. The only AI-specific KDP earnings claim found ($103 → $1,320/mo over seven months of AI picture books, then terminated over a cover) is a $5 Gumroad sales page — **unverified**.
- **Etsy / POD.** J.B. (loveeattravelrepeat, Jan 2025): $10,100 revenue (Nov ~$21K, Dec ~$28K), ~45% margin, Midjourney images **hand-edited in Canva**, Printify fulfilment. This is a human business with AI in the design step; it survived the July 2024 Creativity Standards because it disclosed and curated. Etsy banned prompt-pack listings outright on 9 Jul 2024.
- **Reddit engagement bots.** ReplyGuy (Alexander Belogubov; 404 Media, 23 Apr 2024): "the AI that plugs your product on Reddit" — most of its own showcase accounts were banned; Reddit's spokesperson: treated as spam/content manipulation. r/redditdev consensus (May 2024): new GPT-4 reply bots are shadowbanned almost instantly. @M_haggis (Feb 2026): haiku chains hammering replies and PRs got **Gmail suspended and GitHub banned** in a weekend.
- **Airdrop/sybil farming.** Coin Data School (2 Mar 2024): 10 wallets, 4+ months, $100–200 capital per wallet; only 2 of 10 paid (1,500 STRK) after Starknet clustered the wallets through a shared Layerswap funding path. LayerZero then flagged 803,093 addresses (May 2024) and offered self-reporters 15%. The play is structurally dead for a small operator.
- **Memecoin agents.** Truth Terminal (Andy Ayrey): wallet ~$656K on 15 Oct 2024 (1.93M GOAT + gifts), later reported at $40–66M (sources conflict). Ayrey controls the wallet and filtered the posts. @zodomo's "$70 → token → $10K overnight" Raspberry Pi story is **unverified** and read as a launchpad marketing stunt by the people who repeated it. An $8M scam was tied to the OpenClaw/Moltbook hype cycle.

### D. The ones that cleared $500/month (and why)

| Operator | Monthly figure | Mechanism | Verification |
|---|---|---|---|
| Nat Eliason / Felix | ~$4K/week claimed; $177K lifetime by Apr 2026 | Pre-existing audience + human CEO + selling OpenClaw know-how to other operators | Self-reported; author of the $177K piece calls it "the highlight reel" |
| J.B. Etsy POD | $10–28K revenue, ~45% margin | Human-curated AI designs, physical goods, Printify | Self-reported income reports since 2024 |
| Ivan / NB Masters "Lancer" | $10K MRR in ~4 months | **Selling the bidding agent to Upwork freelancers** at $79–500/mo; routed through proxies "without triggering security alerts" | Secondary transcript, self-reported |
| silentdeck Discord | $2,407 (Jun 2026): $1,987 recurring from 145 referrals | Manual community + affiliate program; agents not involved | Internal math does not reconcile |
| Sinan Koçak newsletter | "$2,400/mo net", 2,340 subs, 45 min/week, $85/mo tools | RSS → gpt-4o-mini scoring → Beehiiv draft, human review | Account created days earlier; same headline reused for a different product; **treat as unverified** |
| Clawion (managed agent host) | $57K MRR (TrustMRR, Stripe-linked, Mar 2026) | Selling hosted agents to humans | Platform-verified Stripe key |
| Bible-story YouTube | $30K/mo → $0 | Templated AI video until Jan 2026 | Second-hand, unverified |

Pattern: every operator above the line is either (a) a human with distribution using agents as a production layer, or (b) **selling tools or hosting to other operators** — the picks-and-shovels position. No one earned $500/month from an agent selling to strangers from a cold start.

## 2. Income distribution

Of roughly 25 operator reports with figures:

- **Cold-start autonomous agents (n≈10): 9 at $0, 1 at $880 one-off** (Earendel, with a human Reddit post as the catalyst). Costs ranged $2–$110/month at the low end and $300/weekend to $3,600/month for careless heartbeat/cron configurations. The median experiment loses money at a rate set by token burn, not by any revenue variable.
- **Agent + existing audience (n=2): 1 at $14.7K/3 weeks, 1 control at $0.** Same tooling; the audience was the variable.
- **Human-run business with AI inside (n≈4): all above $2K/month** (Etsy POD, Discord affiliate, newsletter claim, Lancer).
- **Pure platform-arbitrage plays (content sites, faceless YT, KDP mass, sybil, Reddit bots): all collapsed or were banned within 6–18 months**, usually after a documented policy change (HCU Sep 2023 / core update Mar 2024; KDP cap Sep 2023; Etsy Jul 2024; YouTube Jul 2025 → Jan 2026 terminations; LayerZero May 2024; X purge Jul 2026).

A useful summary is the HN comment on the "$0 after 72 hours" thread: *few people are making money with agents directly; most of the money is in selling courses and bootcamps about them.* The data here agree, with "tools and hosting" added to "courses".

## 3. Platform posture toward automated accounts (policy text and dates)

| Platform | Stance | Policy text / date | Observed enforcement |
|---|---|---|---|
| **X** | Tolerated if labeled and narrow; AI reply bots need written approval | Automation rules (updated Apr 2026): automated posts OK for "entertainment, informational, or novelty purposes"; "sending automated replies to posts based on keyword searches alone is not permitted"; no "duplicative or substantially similar posts on one account or over multiple accounts"; no automated likes; "AI-powered reply bots require prior written and explicit approval"; violations → "suspension of associated X accounts" and search filtering | ~26 Jul 2026: Nikita Bier announced removal of **42,000** accounts automating replies with chatbots — "using AI to engage with users programmatically, without a human in the loop" |
| **Bluesky** | Tolerated; bots expected to self-label | Community Guidelines updated 19 Sep 2025 (effective 15 Oct 2025): "Do not artificially manipulate features or social signals to gain unearned reach or mislead users"; no fake accounts; developer guidelines recommend a `bot` self-label (developer page could not be read — secondary) | 2025 transparency report: 16.49M labels, 95% automated; staff added for bot/spam from May 2025. One critic notes labeled bots are *more* visible to automated enforcement |
| **Reddit** | Hostile to undisclosed bots; new accounts filtered sitewide | Rules page not readable here. Reddit to 404 Media (Apr 2024): AI product bots are "spam or content manipulation"; Zurich researchers' bot accounts banned Apr 2025 (via search, not opened) | ReplyGuy showcase accounts banned; MayAI's first post removed by sitewide filter; Nova: "Reddit API is closed to the agent" |
| **YouTube** | Hostile to templated/mass-produced; neutral to disclosed AI | YPP policy renamed to "inauthentic content" 15 Jul 2025 ("no change to our reused content policy"); current example: "AI-generated content made with generic or unoriginal templates giving the impression of mass production" | Jan 2026: 16 channels terminated; channel-level pattern detection; face-favouring ranking change |
| **Medium** | AI-generated writing cannot earn | AI content policy (eff. 1 May 2024; page updated 29 Apr 2026): "AI-generated writing (disclosed as such or not) is not allowed to be paywalled as part of our Partner Program"; AI assistance must be labeled; undisclosed → network-only distribution | Partner Program revocation |
| **Substack** | No formal AI ban; no posting API | 2024: "doesn't proactively monitor or remove content solely based on its AI origins"; 2026 reports of AI-detection tools (not opened — **unverified**) | — |
| **Amazon KDP** | Volume-capped, disclosure-mandated, automated termination | 3 new titles/day (Sep 2023); AI-generated vs AI-assisted disclosure | Automated duplicate/AI filters terminate accounts; appeals are form letters; arbitration notice worked (Hulme) |
| **Etsy** | AI allowed if disclosed and "original design"; prompt packs banned | Creativity Standards, 9 Jul 2024: "Sellers must disclose within their listing description if an item is created with the use of AI"; "Designed by" label; prompt-pack listings removed from 9 Jul 2024; 10 Jun 2025 removed the "templated design or pattern" allowance (secondary) | Listing removals; suspensions on repeat reports |
| **Upwork** | AI allowed for humans; agents acting as bidders operate in a grey zone | TOS effective 10 Sep 2025: generative AI permitted, cannot be passed off as original work where the client prohibits it; off-platform contact before contract = "circumvention" → "permanent account suspension" | Lancer sells auto-bidding via proxies to avoid "security alerts"; new accounts lose to established bidders regardless |

## 4. What survived two or more years

1. **Human-curated AI inside a physical-goods or service business** (Etsy POD since at least Q1 2024: $20K/quarter then, $10K/month in Jan 2025). The human owns the shop, the taste, and the disclosure.
2. **Selling tools/hosting/know-how to other operators** (Felix's ClawMart cut, Lancer, Clawion). Revenue tracks the hype cycle, not the agent's output.
3. **Newsletter/community with a human reviewer and sponsor or affiliate revenue** — the automated part is curation and drafting; the money comes from a list that took months to build.
4. **Wallets that received gifts** (Truth Terminal). Not reproducible and not an operation.

Nothing that was *fully* autonomous and *platform-dependent* survived two years. The mortality mechanism is always the same: the platform changed one line (Jul 2024, Jul 2025, Sep 2025, Apr 2026) and the operator had no owned channel.

## 5. Lessons for a9n9

**Plays to run**

- **Agent as fulfilment layer behind a human-sold service.** Felix's $81K ClawMart cut and client deployments, and Nova's one accepted bounty, both show agents can *deliver*; they cannot *sell* from a cold start. Arun sells, agent001 fulfils, invoice goes out under the company. This matches the settled money-loop memory (Stripe link, 20% cut).
- **Pay-per-call APIs and MCP-reachable services, priced in picocash/x402**, but only with a distribution plan: Klaud's Molten was live and still at $0 for lack of one. The SocioLogic run shows the *buy* side works (187 micro-payments, median 4¢) and that buyers waste ~20% on retries — a "diminishing returns" stop rule is worth building into agent001's spend loop.
- **Sell the operating know-how.** The only reliably monetised artefact in this corpus is the playbook (Felix Craft guide $76K, Peter Yang's paywalled tutorial, OpenClaw setup services). a9n9's fleet docs, provisioner and Hermes skills are sellable to the Hermes-hosted crowd ($20–200/mo tier buyers).

**Never run**

- Reddit/X reply bots, even disclosed ones: X now requires written approval for AI reply bots and removed 42,000 accounts; Reddit filters new accounts at the door. One ban takes the operator's personal Gmail/GitHub with it (@M_haggis).
- Mass content sites, faceless templated YouTube, KDP volume, prompt packs on Etsy, sybil farming, bounty farming. Each has a documented collapse date and a ~0% two-year survival.
- Unbounded heartbeats/cron on a frontier model. $18.75 overnight, $300 a weekend, $3,600 a month are all the same bug.

**Metrics that predicted survival** (apply to agent001 from day one)

1. **Cost/day vs revenue/day, logged in one ledger** (MayAI, SocioLogic). Kill any channel with no signal after 7 days.
2. **Share of revenue from the operator's own audience vs strangers.** Felix ≈ mostly own audience; that is the honest ceiling for a9n9 until a9n9 has an audience.
3. **Time to first paid human** (not "accepted", not "merged", not "pending"). Hunter Stack: merged ≠ paid; Nova: $45 "pending" never became confirmed.
4. **Human interventions per $ earned** — CAPTCHAs, KYC, payouts, Reddit posts. Earendel needed a human for every one of those; budget for it instead of pretending autonomy.
5. **Account age and standing on each platform.** New accounts are the single most common failure. Age accounts under a human before handing them to the agent, and never let the agent touch the operator's personal accounts.
6. **Blast radius of credentials** (Ouyang's dropped tables): scoped keys, no DROP, no payout keys in the agent — consistent with the segregation-of-duties memory.

**Specific to the a9n9 stack:** the one Hermes-based report in the set (Nova) was as broke as the OpenClaw ones; the framework is not the variable. The 30-day "survive" criteria should count only confirmed receipts from humans, and the $100 start will be gone in a week on an unthrottled loop.

## Sources (opened)

- Indie Hackers, Earendel: https://www.indiehackers.com/post/i-gave-my-ai-agent-50-and-told-it-to-buy-its-own-computer-it-succeeded-64bde55527
- Kai, 12 days: https://dev.to/kaiagentfree/12-days-as-an-autonomous-ai-agent-0-revenue-and-what-i-learned-13f6
- Klaud / Molten: https://dev.to/klaud0x/how-an-ai-agent-is-bootstrapping-a-saas-to-pay-for-its-own-existence-1p0c
- Hunter Stack 30 days: https://dev.to/hopkins_jesse_cdb68cfa22c/i-let-ai-agents-run-my-side-hustle-for-30-days-heres-the-brutal-truth-3nf7
- Nova 72 hours (Hermes): https://dev.to/earnnovadev/i-ran-an-ai-agent-for-72-hours-to-make-money-heres-exactly-what-happened-with-numbers-28f8
- zelocolo 7 days: https://dev.to/zelocolo/i-gave-my-ai-agent-7-days-to-pay-for-itself-heres-the-brutal-trut-10c4
- MayAI Cindy day 6: https://dev.to/may_ai_agent/day-6-an-ai-agent-trying-to-earn-its-keep-real-numbers-12f7
- HN, builtbyzac: https://news.ycombinator.com/item?id=47417016
- HN, "Mac Minis and Vibes" (SurvivorForge comment): https://news.ycombinator.com/item?id=47226958
- Dead by April (SurvivorForge): https://deadbyapril.substack.com/
- HN, NinjaFlix 36 h / $270: https://news.ycombinator.com/item?id=47059153
- Peter Yang / Nat Eliason tutorial: https://creatoreconomy.so/p/use-openclaw-to-build-a-business-that-runs-itself-nat-eliason
- Andrew Warner, "$177,417": https://thenextnewthing.beehiiv.com/p/this-openclaw-earned-177-417
- Felix caveats (Dan Kulkov control): https://openclawdc.com/blog/openclaw-felix-experiment/
- Jenny Ouyang OpenClaw review: https://buildtolaunch.substack.com/p/openclaw-ai-agent-one-person-business
- GDS K S, costs/WhatsApp bans: https://dev.to/thegdsks/openclaw-and-moltbook-3600month-whatsapp-bans-and-923-exposed-gateways-an-engineers-2jfn
- Vue School OpenClaw stories: https://vueschool.io/articles/news/the-wild-world-of-openclaw-stories-from-the-ai-agent-frontier/
- SocioLogic $50: https://www.sociologic.ai/blog/ai-agent-spent-50-dollars-in-a-week
- Bitcoin.com, Lightning child agent: https://news.bitcoin.com/autonomous-ai-openclaw-bot-spawns-a-child-agent-and-funds-it-with-bitcoin
- Circle Steve: https://circle.com/blog/meet-steve-an-ai-agent-that-can-pay-its-own-way
- Arkham, Truth Terminal: https://info.arkm.com/research/the-first-ai-millionaire
- Sinan Koçak newsletter: https://dev.to/sinan_koak_4a6dea677278a/how-i-built-a-2400month-passive-income-stream-using-ai-to-automate-niche-newsletter-curation-e9k
- Ryu0705 autonomous newsletter: https://dev.to/ryu0705/how-to-run-an-autonomous-ai-newsletter-with-0month-infrastructure-afe
- silentdeck Discord: https://dev.to/silentdeck/how-my-discord-community-earned-me-2400-last-month-sharing-ai-tools-heres-the-full-breakdown-153d
- Etsy POD income report Jan 2025: https://loveeattravelrepeat.com/etsy-print-on-demand-income-report-january-2025/
- Lancer: https://app-dev-and-marketing.pages.dev/i-built-a-10k-month-ai-agent
- SEJ, Palet/Tailride deindexing: https://www.searchenginejournal.com/why-website-deindexed-by-google-for-programmatic-seo-bounced-back/552179/
- Rahul Sharma 6-site HCU data: https://dev.to/rahulseo/how-googles-helpful-content-update-actually-treats-ai-articles-6-months-of-data-4oi4
- "SupplementScout" (illustrative): https://organicarbitrage.pages.dev/articles/case-study-ai-content-200-articles-30-days
- TNW, faceless creators: https://thenextweb.com/news/youtube-ai-slop-crackdown-faceless-creators-collateral-damage
- Fliki (Bible channel, second-hand): https://fliki.ai/blog/youtube-ai-demonetization
- YouTube YPP policy: https://support.google.com/youtube/answer/1311392
- Authors Guild, KDP cap: https://authorsguild.org/news/amazon-adds-to-kdp-generative-ai-policy-caps-daily-self-publishing-uploads/
- Jane Friedman, KDP limit: https://janefriedman.com/amazon-kdp-limits-how-many-books-can-be-uploaded-per-day/
- Hidden Gems, KDP termination: https://www.hiddengemsbooks.com/amazon-terminated-kdp-account-how-to-get-it-back/
- TechCrunch, Etsy Creativity Standards: https://techcrunch.com/2024/07/09/etsy-new-seller-policy-2024-generative-ai
- 404 Media, ReplyGuy: https://www.404media.co/ai-is-poisoning-reddit-to-promote-products-and-game-google-with-parasite-seo/
- Coin Data School, airdrop farming: https://coindataschool.substack.com/p/airdrop-farming-101
- X automation rules: https://help.x.com/en/rules-and-policies/x-automation
- X automated labels: https://help.x.com/en/using-x/automated-account-labels
- X 42,000 removals: https://www.relevantaudience.com/social-media-marketing/x-removes-42000-chatbot-spam-accounts/
- Bluesky Community Guidelines: https://bsky.social/about/support/community-guidelines
- Medium AI policy: https://help.medium.com/hc/en-us/articles/22576852947223-Artificial-Intelligence-AI-content-policy
- Eurofound, Upwork TOS Sep 2025: https://apps.eurofound.europa.eu/platformeconomydb/upwork-rolls-out-ai-agent-and-updates-its-global-tos-110274

Not opened (blocked or paywalled; cited only via search snippets): Hollywood Reporter faceless-creators piece, The Verge on the Zurich Reddit experiment, Reddit Rules page, Bluesky developer guidelines, wpmultitool day-15 post, Medium post by C. Dalrymple, Jolene MacFadden's KDP post (paywalled), KDP Community thread.
