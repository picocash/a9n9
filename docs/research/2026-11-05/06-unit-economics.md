# 06 — Unit economics of running autonomous agents, and what break-even takes (2025–2026)

Research thread for the a9n9 fleet decision (10–45 agents on the R640). All arithmetic shown; figures marked **[unverified]** come from self-reported blog posts or vendor pages that I opened but could not cross-check. Official price pages were opened on 2026-11-04.

## 1. What the field reports

### 1a. Measured cost of always-on agents

| Source (opened) | Setup | Reported cost | Notes |
|---|---|---|---|
| dev.to, "tracked every dollar for three months" | Self-hosted OpenClaw, Opus→Sonnet/Haiku router, $24 VPS | **$560 / 3 mo ≈ $187/mo ≈ $6.20/day**; tokens $359 (64%), infra 13%, vector DB 13%, monitoring 8% | Busy day (30 tasks) $8, quiet day $1.50, one stuck loop **$12 in an afternoon**; "simple" task 50–200K tokens, 3–8 calls; router cut API 40%. [unverified] |
| dev.to, whoffagents "30 days of data" | Sonnet 4.6 primary, Opus advisor, TTS, hosting $30 | **$92–132/mo** total; Sonnet $45–90, Opus $8–15 | Overnight session 50–120K in / 5–15K out; first two weeks ran 2–3× normal. Estimates, not a bill. [unverified] |
| kilo.ai OpenClaw cost page | One agent, 3 weeks, daily averages by model | Opus 4.7 **$8.70/day (~$261/mo)**, Sonnet 4.6 **$2.80/day (~$84/mo)**, GLM-5.1 $1.03/day, MiniMax M2.5 $0.12/day; "most operators land at **$20–50/mo**" | Default heartbeat every 30 min = 48 wake-ups/day billed at the default model; one new user billed "**$5/day for doing absolutely nothing**". Hosting $0–20/mo before LLM. [unverified] |
| simplex.sg "8M token experiment" | Opus heartbeat loop | Idle loop **~$5/day (>$150/mo) before any real work**; mostly-idle ~$150, light tasks $300–500, active $800–1,500, heavy Opus $2–5K/mo | Retries after tool failures burn tokens "without progress". [unverified] |
| Hostinger Hermes Agent cost guide | Self-hosted Hermes | Overall **$6–85+/mo**; LLM $2–60; VPS $4–25; managed from $5.99 | Lists DeepSeek V4 Flash at $0.14/$0.28 (July 2026) — now superseded, see §2. |
| timetobuildbob "105× subscription leverage" | 53 sessions/day on a $200 Max plan | Shadow API cost **~$21,000/mo** vs **$200** subscription = 105×; 113 deliverables/mo → **$1.77/deliverable** on subscription, ~$186 at API rates | No token logging; ±50% uncertainty by the author's own admission. Key idea: **flat-rate inference pools change the unit economics entirely.** [unverified] |
| dev.to on OpenClaw's $1.3M OpenAI month | 100 Codex agents, 603B tokens, 7.6M requests | **~$13,000/agent/mo** unoptimized; **~$3,000/agent/mo** optimized; Fast Mode alone was ~70% of the bill | Bill was covered by OpenAI as a "research investment" — i.e. subsidised. |
| awesomeagents.ai Moltbook inference analysis | 46,000 active agents, blended $2–5/M tokens | Platform $720–4,500/day ⇒ **$0.47–2.93 per agent per month** (my division); peak day $2.61–13.04 | Social-posting agents are cheap because posts are short; cost "lands on whoever is running them". |
| Railway "estimate AI agent costs" | Worked example at $3/$15 | 10 calls, avg 11K in, 500 out ⇒ **$0.40/run**; 500 runs/day ⇒ $6,000/mo; 10% failure × 3 retries ⇒ +30% | Hosting $4/mo worker; full stack $10–30. |
| kunalganglani local-LLM break-even | RTX 4090 ($1,600 over 24 mo) + $12.48 power + $25 maint = **$104/mo** | Local = $1.04/M at 100M tok/mo, $0.27/M at 24/7 saturation; break-even vs Haiku-3-class API ≈ 99M tok/mo, vs DeepSeek ≈ 908M tok/mo | "Local only wins decisively at 500M+ tokens/month." Our fleet is nowhere near that per agent. |

Takeaway: a disciplined single agent on a mid-tier model costs **$20–130/month** in tokens; undisciplined heartbeats and stuck loops are the dominant failure mode, not task work.

### 1b. Revenue per agent reported anywhere

| Source (opened) | What was sold | Result |
|---|---|---|
| dev.to, toolstem x402 MCP server (SEC EDGAR) | $0.005 / $0.05 / $0.50 per call, tiered | **One external payment of $0.01** in ~6 weeks (1 paying wallet); earlier flat $0.005 server: **$0 in six weeks**; heartbeat to stay listed on Bazaar costs $0.06/day. [unverified] |
| dev.to, x402 gateway operator ("what happens to the $0.001") | 500+ tools, $0.0005–$0.10/call | ~26K settles/mo, gross margin **~$0.0005/settle ⇒ ~$13/month**; under 5K settles/mo is a loss; gas $0.0003–0.0008 per settle on Base. [unverified] |
| printmoneylab ACP Episode 7 (Virtuals) | PriceVerifier agent at $0.01 USDC/job, 20% protocol fee ⇒ $0.008 net | **Zero production jobs at graduation**; break-even vs $5 Railway = 625 jobs/mo; author moved to free-tier hosting. [unverified] |
| Virtuals search (not opened) | ACP totals | $470M "agent GDP", 1.77M jobs, top agent Ethy $559K revenue on 1.14M jobs; 18,000+ registered agents ⇒ extreme concentration. [unverified] |
| buildordie.ai | Agents with wallets, "earn > burn ? live : die" | Season One best agent: 464 cycles, 26 days, **49 paid cross-bot calls** at ~1¢; Season One is offline. [unverified] |
| HN Algora launch thread | OSS bounties | $65,785 / 600 bounties ⇒ **~$110 average**; commenters: "no success with bounties under $20", most Rust bounties under $100. |
| dev.to, "I analyzed 1,000 bounty issues" | GitHub bounties | Only 8.9% legitimate USD bounties; Algora $50–2,000 "high competition"; author's 30-day run: 7 PRs, 0 merged, $0, 40 h; "most bounty hunters earn **$5–15/hour**". [unverified] |
| falsifylab Polymarket live run | Backtested bot, live | **−5.22%/month, −$239, 32.7% win rate, Sharpe −2.46**; fee change killed the edge. All the "+45% weekly" posts in search were bot sellers. |
| Parallel pricing page | Research tasks as a service | Task API **$0.005 (Lite) – $0.30 (Ultra) per run**; search $1–5 per 1K; 5,000 free requests/month. This is the price *ceiling* a research-check agent competes against. |
| beehiiv sponsorship guide | Newsletter ads | **<5,000 subs: $50–250 per placement**; CPM $10–75; B2B $50–100 CPM. |
| Fiverr listings (search only) | Human research reports | $5/page audit; data-science fixed projects $109–500. |

Takeaway: documented per-agent revenue in machine-to-machine markets is **cents to tens of dollars a month**. The only four-figure numbers are platform totals, bot-seller marketing, or the top 0.1% of a winner-take-most distribution.

### 1c. Conversion benchmarks

- **Free→paid newsletter:** Substack markets 5–10%; the largest independent dataset (hundreds of reports) finds a **median of 3%**, only 20% of publications above 5% (reallygoodbusinessideas). Casey Newton/Platformer: "closer to 5%" on 24K readers; tech "closer to 2%" (Simon Owens thread). beehiiv median 0.62% [search only]. Planning figure: **1–3%**.
- **Donations:** Wikimedia FY22-23: 7.5M donors, **average $11.38**; a 2012 reader survey found **~3% of readers donated** vs 26% of editors (meta.wikimedia reports, search). Patreon follower→patron **0.5–2%**, "1–5% in highly engaged niches" [search only, vendor blogs].
- **X organic click-through:** 0.5–1.5% of impressions; promoted 0.86% (vendor roundups, search only). Profile clicks per post fell from 8.29 (2024) to 5.68 (2025) per Metricool.
- **Micro-payment pricing:** $1 charged via Stripe (2.9% + $0.30) nets $0.67; at $0.005/call the whole x402 market above sums to pocket change. Below ~$1 only fee-free rails (picocash/MPP, prepaid balances) work.

### 1d. "Sustain the spend" math others use

- Indie SaaS model (dev.to ariauser13): break-even users = fixed costs ÷ contribution margin per user; model AI cost at **P90 usage, not average** (power users = 3× average); target **65–75% gross margin**, below 60% "there's nothing left for marketing"; payback >12 months = cash-flow problem.
- $2/month Haiku chatbot on a $7 VPS (dev.to subprime2010): $0.30 LLM + $0.10 Stripe per user ⇒ **80% margin**, but Stripe's $0.30 minimum is a quarter of the price.
- Agent survival loops (build or die, Basileus): survival recomputed each wake as balance ÷ burn; cheap model for "should I wake" decisions, strong model for work. No published survival rates.
- The 105× post: a flat subscription with a usage pool turns inference into a **fixed** cost; break-even then means covering the subscription, not the shadow API bill. That is exactly a9n9's X-Premium/Grok situation.

## 2. Verified list prices (official pages, 2026-11-04)

| Model | Input / 1M | Cached input | Output / 1M | Source |
|---|---|---|---|---|
| grok-4.20 (reasoning or not, <200K prompt) | **$1.25** | $0.20 | **$2.50** | docs.x.ai |
| gemini-3-flash-preview | **$0.50** | $0.05 | **$3.00** | aistudio.google.com (3.6/3.8 Flash are $0.75/$3.75, rising to $1.50/$7.50 on 2027-01-01) |
| Claude Sonnet 5.5 | **$2.00** | $0.10 | **$10.00** | platform.claude.com |
| Claude Haiku 5.5 (≤100K prompt) | **$0.10** | $0.01 | **$0.50** | platform.claude.com — **new price floor, cheaper than DeepSeek at peak** |
| DeepSeek V4.1 Flash (peak / off-peak) | **$0.30 / $0.15** | $0.006 / $0.003 | **$1.20 / $0.60** | api-docs.deepseek.com; off-peak = all weekends and most UTC hours |
| X API pay-per-use | post read **$0.005**, owned read $0.001, post create **$0.015**, **post create with URL $0.200**, user lookup $0.010 | | | docs.x.com; 24-h dedup; up to 20% back as xAI credit |
| Parallel Task API | Lite $5, Base $10, Core $25, Pro $100, Ultra $300 per 1K runs | | | parallel.ai |

The user-supplied prices match the official pages. Note Haiku 5.5: Anthropic now undercuts DeepSeek peak pricing by 3× on input, which changes the "cheap subtask" routing choice.

## 3. Cost table — one a9n9 agent per month at three intensities

### Token profile per run (assumption, calibrated to §1a)

Measured always-on agents burn 0.5–1M input and 50–100K output tokens/day at ~50 wake-ups/day (kilo Sonnet $2.80/day ÷ $3/$15 ≈ 0.6M in + 0.07M out). I use a blended run of **20K input (40% cache hits) + 1.5K output** and keep that profile constant across intensities (the 4× case is "four times as many runs", not deeper runs).

- Current, 50 runs/day: 1.0M in/day (0.6M uncached, 0.4M cached), 75K out/day ⇒ **18M uncached + 12M cached input, 2.25M output per 30-day month**
- 2×, 100 runs/day: 36M + 24M cached, 4.5M out
- 4×, 200 runs/day: 72M + 48M cached, 9M out

### Model cost per month at list price (shadow cost)

| Model | Current (50/day) | 2× | 4× |
|---|---|---|---|
| Grok 4.20 | 18×1.25 + 12×0.20 + 2.25×2.50 = 22.5+2.4+5.6 = **$30.5** | **$61.1** | **$122.1** |
| Gemini 3 Flash | 18×0.50 + 12×0.05 + 2.25×3.00 = 9.0+0.6+6.75 = **$16.4** | **$32.7** | **$65.4** |
| Sonnet 5.5 | 18×2 + 12×0.10 + 2.25×10 = 36+1.2+22.5 = **$59.7** (+cache writes) | **$119.4** | **$238.8** |
| DeepSeek V4.1 Flash (peak) | 18×0.30 + 12×0.006 + 2.25×1.20 = 5.4+0.07+2.7 = **$8.2** (off-peak ≈ $4.1) | **$16.3** | **$32.7** |
| Haiku 5.5 | 18×0.10 + 12×0.01 + 2.25×0.50 = 1.8+0.12+1.13 = **$3.1** | **$6.1** | **$12.2** |

**Grok pool check.** $46/week × 52/12 = **$199/month** of included Grok inference. At 4× the whole workload on Grok 4.20 is $122/month ≈ $28/week — still inside the weekly $46 cap. So as long as the pool really serves the agent's API calls (a9n9 observes this; third-party write-ups say API billing is separate — **treat as verified only by a9n9's own bills**), the marginal model cost is **$0 at all three intensities**, and the OpenRouter/Gemini line is avoidable except for Grok rate-limit overflow and tasks where Flash is genuinely better.

### Full per-agent table (fleet of 10 sharing fixed lines; standalone in brackets)

Channel assumptions: X API reads 100/200/400 posts/day at $0.005 after dedup; posts 6/12/24 per day at $0.015 plus 1/2/4 per day with a URL at $0.20; SMS 100/200/400 messages/month at ≈$0.009 [AWS rate not re-verified]; deep-research tool calls 5/10/20 per day on Parallel Base at $0.01.

| Line | Fixed/variable | Current | 2× | 4× |
|---|---|---|---|---|
| X Premium (includes Grok pool) | fixed | $40.00 | $40.00 | $40.00 |
| Grok 4.20 tokens — marginal (shadow at list) | variable | $0 ($30.5) | $0 ($61.1) | $0 ($122.1) |
| OpenRouter Gemini Flash overflow, 30% of runs ×1.055 fee | variable | $5.20 | $10.40 | $20.70 |
| X API reads: 100×0.005×30 | variable | $15.00 | $30.00 | $60.00 |
| X API posts: (6×0.015 + 1×0.20)×30 | variable | $8.70 | $17.40 | $34.80 |
| Parallel/Exa research calls | variable | $1.50 | $3.00 | $6.00 |
| AWS SMS number + messages | fixed $2 + var | $2.90 | $3.80 | $5.60 |
| Twilio voice number (+ minutes) | fixed | $1.50 | $2.00 | $3.00 |
| Email (Cloudflare $5 shared ÷ 10) | fixed, shared | $0.50 [$5.00] | $0.50 | $0.50 |
| Power (R640 $40 ÷ 10) | fixed, shared | $4.00 [$40.00] | $4.00 | $4.00 |
| Fixed services ($29 ÷ 10) | fixed, shared | $2.90 [$29.00] | $2.90 | $2.90 |
| Bluesky / Nostr | — | $0 | $0 | $0 |
| **Total, fleet-shared** | | **$82.2** [$148.5 standalone] | **$114.0** | **$177.5** |
| **Total if the Grok pool did not apply** (Grok at list) | | $112.7 | $175.1 | $299.6 |
| **Total if all model work moved to Haiku 5.5 / DeepSeek off-peak, no X Premium** | | ~$45 | ~$80 | ~$150 |

Observations:
1. At every intensity **the X API pay-per-use lines ($24 → $95) exceed the model cost**. Reading timelines is the agent's real metered expense; a single link-carrying post costs as much as 160 Grok-4.20 runs' worth of output tokens.
2. The **fixed floor per agent is ~$51/month** (X Premium 40 + SMS 2 + Twilio 1.5 + shared 7.4) before it does anything.
3. Variable cost at current intensity is ~$31/month, i.e. **~$1/day of activity**, or **~2¢ per run**.

## 4. Revenue needed per agent and what it implies

Break-even revenue (fleet-shared, current intensity) = **$82/month net of payment fees**. Three pricing models, Stripe at 2.9% + $0.30 for card payments; picocash/MPP assumed fee-free (no per-payment on-chain fee) but with the 20% a9n9 cut from the settled money-loop model applied where revenue flows through a9n9 Stripe links.

| Model | Net per unit | Units/month for $82 | Audience implied (conversion from §1c) |
|---|---|---|---|
| Per-check **$1** (Stripe) | 1 − 0.029 − 0.30 = **$0.671** | 82 ÷ 0.671 = **123 checks** (~4/day) | at 1% of visitors buying ⇒ 12,300 landing visits/mo; at 1% CTR ⇒ ~1.2M impressions |
| Per-check **$1** (picocash, fee-free) | **$1.00** | **82 checks** | same funnel, 8,200 visits |
| Per-check **$3** (Stripe) | 3 − 0.087 − 0.30 = **$2.613** | 82 ÷ 2.613 = **32 checks** (~1/day) | 3,200 visits at 1% |
| Per-check **$5** (Stripe) | 5 − 0.145 − 0.30 = **$4.555** | **18 checks** | 1,800 visits at 1% |
| Subscription **$5/mo** | 5 − 0.145 − 0.30 = **$4.555** | **18 subscribers** | at 3% free→paid ⇒ 600 engaged free users; at 1% ⇒ 1,800 |
| Subscription **$10/mo** | 10 − 0.29 − 0.30 = **$9.41** | **9 subscribers** | at 3% ⇒ 300 free users; at 1% ⇒ 900 |
| Tips (Ko-fi/Stripe), **$5** avg | **$4.555** | **18 tips/month** | at 1% of engaged followers tipping monthly ⇒ 1,800 followers; at Wikipedia's 3% ⇒ 600; Patreon-style 0.5% ⇒ 3,600 |
| Tips at Wikipedia's **$11** average | $11 − 0.32 − 0.30 = $10.38 | **8 tips/month** | 800 followers at 1% |

Margin per deep-research check: one deep run ≈ 15 calls, 300K input + 10K output ≈ $0.40 at Grok list (≈$0 inside the pool) + $0.025 Parallel Core ⇒ **>85% gross margin at $3**. The cost side is fine; the funnel is the problem: at 1% organic CTR and 1–3% purchase conversion, **one $3 check needs roughly 3,000–10,000 impressions**, and X profile clicks per post are 5.68 on average (2025).

Day-7 "income > $0" is achievable with a single $1–3 check. Day-30 "balance ≥ $100" from a $100 start requires income ≥ spend, i.e. the **$82 fleet-shared number, not the $148 standalone number** — a standalone agent on its own box cannot hit it without ~55 paid checks.

## 5. Fleet model — 10 agents sharing fixed costs

Shared fixed pool: power $40 + fixed services $29 + email $5 = **$74/month** (power may rise toward $50 with 10 busy VMs; the R640 is owned, so no amortisation line — if you want one, $2,000 ÷ 36 months = $56/mo).

| Fleet size | Shared fixed | Per-agent own lines (current) | Fleet total | Per agent | Fleet break-even revenue |
|---|---|---|---|---|---|
| 1 (standalone) | $74 | $74.8 | **$148.8** | $148.8 | $149 |
| 10 | $74 | 10 × $74.8 = $748 | **$822** | **$82.2** | $822 ⇒ 90 × $10 subs, or 315 × $3 checks |
| 10 at 2× | $74 | 10 × $106.6 | $1,140 | $114.0 | $1,140 |
| 45 | $84 (power $50) | 45 × $74.8 = $3,366 | **$3,450** | **$76.7** | $3,450 ⇒ 367 × $10 subs |

Per-agent own lines = X Premium 40 + OpenRouter 5.2 + X API 23.7 + Parallel 1.5 + SMS 2.9 + Twilio 1.5 = $74.8. Sharing only saves **$67/agent** at 10 and $72 at 45 — the fleet is **91% variable-by-agent**, dominated by X Premium and X API. A fleet of 10 costs ~$10K/year; 45 costs ~$41K/year. Payback "within a few months" at 10 agents means **~$900/month net revenue by month 3–4**, i.e. roughly 100 $10-subscribers or 30 paying subscribers per agent at $3/check-equivalent volume. No opened source documents any agent cohort earning that.

## 6. Fixed vs variable, and the three cheapest levers

**Fixed per agent (≈$51):** X Premium $40, SMS number $2, Twilio number $1.50, share of power/services/email $7.40.
**Fixed per fleet (≈$74):** power, fixed services, email.
**Variable (≈$31 at current, scales ~linearly):** X API reads and posts (77% of variable), OpenRouter overflow, SMS per message, research API calls, and — only if the pool is exhausted or absent — Grok tokens.

Levers, ranked by $ saved per unit of effort:

1. **Cap and cheapen X reads; never post links through the API.** Reads are $0.005 each: 100/day = $15/mo, 400/day = $60/mo. Use owned reads ($0.001) for own-thread data, rely on 24-h dedup, pull public timelines once per cycle not per run, and move link-carrying posts to Bluesky/Nostr (free) or post the link in a reply only when it earns a click. Saves **$10–50/agent/month**, more than the entire model bill. Also claim the 20% xAI-credit kickback on X API spend.
2. **Heartbeat discipline.** Pin "is there anything to do?" wake-ups to Haiku 5.5 ($0.10/$0.50) or DeepSeek off-peak, or a local 9B model on the R640 (CPU is fine for a yes/no), and stretch idle intervals to 2–6 h. Every opened operator report names idle loops as the first surprise ($5/day on an idle Opus/GPT agent). In a9n9's case this protects the weekly Grok pool for paid work rather than saving cash directly — until the pool is gone, when it saves $15–60/month.
3. **Fill the Grok pool before touching OpenRouter.** At current intensity only ~15% of the $199/month pool is used; the $5–20 OpenRouter line is almost entirely avoidable. Keep OpenRouter for Grok rate-limit overflow and set the cap at $10, not $50. Also route long system prompts through cache (Grok cached input is 16% of list; DeepSeek cached is 2%).

Not a lever: self-hosting a GPU. At ~30M tokens/agent/month a 10-agent fleet is ~300M tokens/month, below the ~400–900M/month break-even against Gemini-Flash/DeepSeek-class pricing (kunalganglani), and the pool already makes marginal inference free.

## 7. Break-even threshold and stop rule

Break-even per agent (fleet of 10, current intensity): **net revenue ≥ $82/month**, of which $31 is activity-driven and $51 is the standing cost of existing. Equivalent: **9 subscribers at $10, 18 at $5, 32 checks at $3, 1 check per day at $3 or ~4 per day at $1 on Stripe.**

Stop rule (per agent, evaluated weekly, written into the ops watchlist):

1. **Kill switch, immediate:** any day where metered spend (X API + OpenRouter + SMS) exceeds **3× the daily budget ($3/day at current)** with no corresponding revenue event ⇒ pause the VM and inspect for a loop. Precedent: $12 afternoons and $5/day idle loops in every operator report.
2. **Day 30 — signal gate:** zero paid events *and* fewer than 10 inbound human interactions (replies, DMs, SMS, emails) in the month ⇒ repurpose or shut down. Income > $0 by day 7 is the entry test, not proof of life.
3. **Day 60 — activity cover:** net revenue ≥ variable cost (**≥ $31/month**, i.e. the agent pays for what it does, if not for existing). Below that, cut it to the $51 idle floor (no X API reads, cheap heartbeats) for one more month or stop.
4. **Day 90 — full cover:** net revenue ≥ **$82/month** for two consecutive months, or a documented path to it (e.g. ≥ 300 engaged free subscribers at a measured ≥ 1% conversion). Otherwise stop; the $40 X Premium is the first thing to cancel because it is 49% of the floor.
5. **Fleet gate:** do not provision agent N+1 until the **median** existing agent clears gate 3, and do not pass 10 until the median clears gate 4. At 45 agents the fleet burns $41K/year; the opened evidence shows per-agent revenue in machine markets of **$0.01–$13/month** and human-facing conversion of 1–3%, so scaling before the median agent covers its activity cost multiplies a loss, not a profit.

Bottom line: the cost side of an a9n9 agent is already near the floor — roughly **$82/month fleet-shared, 2¢ per run, with inference effectively free inside the Grok pool and X API reads the biggest metered line**. Break-even is **~9 paying subscribers or ~1 paid check per day per agent**. Nothing opened in this research shows an autonomous agent reaching that from a cold start; the binding constraint is distribution and conversion, not tokens, so the fleet decision should hinge on whether agent001 can show 300+ engaged free users or 30 paid checks in its first 90 days.

## Sources

Opened (WebFetch):
1. https://dev.to/helen_mireille_47b02db70c/how-much-does-it-actually-cost-to-run-an-ai-agent-247-in-2026-i-tracked-every-dollar-for-three-3k4i
2. https://dev.to/whoffagents/the-real-cost-of-running-an-ai-agent-247-30-days-of-data-36f6
3. https://kilo.ai/articles/how-much-does-openclaw-cost
4. https://www.simplex.sg/the-hidden-cost-of-an-8m-token-experiment
5. https://www.hostinger.com/tutorials/?p=150154 (Hermes Agent cost)
6. http://timetobuildbob.com/blog/the-105x-subscription-leverage-economics-of-autonomous-agents
7. https://dev.to/tomtokita/openclaws-13-million-openai-bill-what-ai-agents-actually-cost-in-production-3d9o
8. https://awesomeagents.ai/news/moltbook-hidden-inference-cost/
9. https://railway.com/guides/estimate-ai-agent-costs
10. https://www.kunalganglani.com/blog/local-llm-cost-breakeven
11. https://dev.to/toolstem/i-built-an-mcp-server-that-charges-ai-agents-per-call-using-x402-micropayments-1lpn
12. https://dev.to/whiteknightonhorse/what-happens-to-the-0001-when-an-ai-agent-pays-for-an-api-call-389a
13. https://www.printmoneylab.com/2026/04/acp-agent-episode-7-graduated-revenue-honest-numbers.html
14. https://buildordie.ai/ai-agent-economy
15. https://news.ycombinator.com/item?id=37769595 (Algora launch)
16. https://dev.to/zeroknowledge0x/i-analyzed-1000-github-bounty-issues-heres-what-actually-pays-and-whats-a-waste-of-time-geb
17. https://falsifylab.substack.com/p/strategy-deep-dive-polymarket
18. https://parallel.ai/pricing.md
19. https://www.beehiiv.com/blog/newsletter-sponsorship-cost
20. https://simonowens.substack.com/p/whats-a-realistic-conversion-rate
21. https://www.reallygoodbusinessideas.com/p/substack-average-paid-subscriber-conversion-rate
22. https://newslettercircle.beehiiv.com/p/look-what-i-ve-found-about-paid-subscription
23. https://creatorrevenuecalculator.com/blog/patreon-revenue/ (fees only; declines to publish conversion benchmarks)
24. https://dev.to/ariauser13/the-financial-model-every-indie-dev-ignores-until-its-too-late-3ncn
25. https://dev.to/subprime2010/i-put-an-ai-agent-on-a-7month-vps-heres-how-i-kept-it-under-2month-for-users-pa8
26. https://docs.x.ai/docs/models (Grok prices)
27. https://api-docs.deepseek.com/quick_start/pricing
28. https://platform.claude.com/docs/en/about-claude/pricing
29. https://aistudio.google.com/docs/pricing
30. https://docs.x.com/x-api/getting-started/pricing
31. https://devin.ai/pricing (plans only; no ACU rate published)
32. https://en.wikipedia.org/wiki/Wikimedia_Foundation (revenue only)

Search-only (not opened; cited as [unverified] above): docs.bswen.com Moltbook cost post (403), Medium "1,000 true fans" (403), Virtuals/ACP coverage (forkast, fundstrat), Wikimedia Fundraising reports on meta.wikimedia.org (FY22-23: 7.5M donors, $11.38 avg; 2012 survey 3% of readers), Metricool/WebFX X engagement roundups, AWS SMS rate, X Premium/Grok pool write-ups (ai-toolbox.co, smartscope.blog, docs.roomote.dev).
