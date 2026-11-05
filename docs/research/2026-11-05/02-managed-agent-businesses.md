# How managed-agent / "AI employee" businesses make money (2024–2026) — and what it implies for a9n9

Research thread 02. Date: 2026-11-04. 36 pages opened (list at end). Figures are as reported on the opened page; "[unverified]" marks claims that only appear in secondary blogs or search snippets, "[estimate]" marks Sacra-style third-party estimates. Vendors rarely publish rate cards; where I cite a competitor's write-up (e.g. Fin on Decagon) I say so.

## 1. Company-by-company

### Tier A — enterprise "AI employee" vendors (sales-led, six-figure contracts)

**Sierra (customer-service agents).** Customer pays per *outcome* (resolved conversation, saved cancellation, upsell) with criteria agreed upfront; unresolved and escalated conversations are "in most cases" free; greeter/routing traffic is billed per conversation (Sierra blog, 2024-12-10). No public rates; Sacra says the blend is negotiated per client. ARR [estimate, Sacra]: $26M end-2024 → $100M Nov 2025 → $200M May 2026 → $400M Oct 2026; $15.8B post-money May 2026; 40% of Fortune 50. Trust: outcome definition is contractual; delivery needs dedicated AI engineers per customer, which Sacra flags as the margin risk. Sources: sierra.ai blog; sacra.com/c/sierra.

**Decagon (customer-service agents).** Two meters: per conversation (flat, volume-discounted, charged even when escalated) or per resolution (higher rate, escalations free). Decagon's own post: "the vast majority of our customers choose per-conversation" for predictability, and warns that "what counts as a resolution" causes billing disputes (decagon.ai blog, 2024-12-10). Third-party (Fin, a competitor): ~$50K annual platform fee, ~$0.99/conversation, ~$0.50/resolution negotiated, Vendr median contract ~$386K [unverified]. Valuation $4.5B Jan 2026 [search-only]. Sources: decagon.ai; fin.ai.

**Intercom Fin (benchmark).** $0.99 per *outcome*: customer confirms resolution, or doesn't ask for more help, or Fin completes a procedure; one charge per conversation; no seat/platform fee; minimum commitment when used with an external helpdesk. This is the public price anchor the whole support category is measured against. Source: intercom.com/fin/pricing.

**Harvey (legal).** Per-seat SaaS plus custom-model fees; ~$1,200/lawyer/month, 12-month terms, ~20-seat minimums [estimate, Sacra]. ARR [estimate]: ~$100M Aug 2025, ~$195M end-2025, ~$400M Aug 2026; $15.5B Sept 2026; 1,500+ customers, 142,000+ lawyers, 50% of Am Law 100. Risks flagged: frontier models closing the gap, per-firm custom implementation limits scale. Per-seat works here because a human lawyer uses the tool and bears the professional liability. Source: sacra.com/c/harvey.

**11x (AI SDR "Alice"/"Julian").** Pays per digital worker per month, metered on monthly contact volume and channels; third-party estimates ~$5,000/mo Starter, $6,500–8,500 Growth, Vendr median ~$40K/yr, 12-month default terms, implementation fees $2.5–7.5K [unverified, landbase]. TechCrunch 2025-03-24: one-year contracts with a ~3-month break clause used as the trial; ARR cited as $14M when post-trial contracts totalled ~$3M; "losing 70–80% of customers that came through the door"; logos of ZoomInfo and Airtable (trial users) shown as customers; ZoomInfo's lawyer cited deceptive trade practices and false advertising; 11x's defence: contracted ARR reported to the board, current retention 79%. CEO stepped down May 2025. OnlyCFO's framing: this is "experimental run-rate revenue", not ARR. Sources: techcrunch.com (opened); onlycfo.io; landbase.com.

**Artisan (AI BDR "Ava").** TechCrunch 2025-04-09: $5M ARR, 250 customers; standard contracts carry break clauses; pilots can use "success-based pricing" through Paid.ai (pay per response); CEO claims Ava hallucinates "one in 10,000 emails, if that"; admits "relatively high churn" and now turns away whole industries. "Stop Hiring Humans" billboards (Oct 2024) were "mostly for attention" and drew death threats; eesel lists a $250/mo startup tier [unverified]. LinkedIn briefly banned Artisan in Jan 2026 [search-only]. Source: techcrunch.com (opened); eesel.ai.

**AI SDR category.** Leadgen-economy (secondary) collates: 50–70% annual churn (UserGems), gross retention <50% at 11x and <60% at Artisan/AiSDR [unverified], 12–20% of generated emails containing a false company-specific claim [unverified], a "90-day kill curve" driven by deliverability collapse and bad data, cost per meeting rising from ~$35 to $150–300 by month three. Source: leadgen-economy.com.

**Paid.ai (billing layer for agents).** Not an agent; sells results-based billing to agent makers (Artisan, IFS). $21.6M seed Sept 2025. Thesis: agents run in the background so value must be *demonstrated* or "the agent doesn't get paid"; per-seat fails because vendors pay per-token costs and flat credit plans fail because buyers resist paying for low-value output. Source: techcrunch.com.

### Tier B — platform vendors (self-serve, usage-metered)

**Devin (Cognition).** Today: Free; Pro $20/mo; Max $200/mo; Teams $80/mo + $40/seat; Enterprise custom; overage at API pricing (devin.ai/pricing, opened). History: launched at $500/mo with $2 ACUs, cut to $20 in April 2025 at $2.25/ACU (≈15 min of work) [search-only: VentureBeat/SiliconANGLE]. ARR [estimate, Sacra]: $1M Sept 2024 → $73M June 2025 (self-serve) → ~$492M May 2026 incl. Windsurf → ~$1B Sept 2026. Criticism: Answer.AI's month-long test, 20 tasks: 3 successes, 14 failures, "we could not predict which tasks would succeed"; failed tasks still consume ACUs. Sources: devin.ai; sacra.com/research/cognition; answer.ai.

**OpenAI agent tiers.** The Information (via The Decoder, 2025-03-06): planned $2,000/mo "basic" agents, $10,000/mo developer agents, $20,000/mo "PhD-level" research agents; agents expected to be 20–25% of long-term revenue; OpenAI also exploring credits and noted user "credit anxiety". Reported, never confirmed as shipped at those prices. The shipped product (ChatGPT agent, July 2025) is bundled into existing $20/$200 subscriptions [could not open openai.com, 403]. Source: the-decoder.com.

**Salesforce Agentforce.** Flex Credits $500 per 100K; standard action = 20 credits (~$0.10), voice action 30; legacy $2/conversation (not combinable with credits); $5/user/mo access licence; $125–150/user/mo unmetered add-ons; Max edition from $550/user/mo with 2.75M credits; "Help Agent Resolutions" listed at $2 — a per-resolution SKU appearing beside the per-action meter. Salesforce has now tried per-conversation, per-action and per-resolution in 18 months. Source: salesforce.com/agentforce/pricing.

**Microsoft Copilot Studio.** Pay-as-you-go $0.01 per Copilot Credit or $200 per 25K pack [search-only for price; rate table opened]: classic answer 1, generative answer 2, agent action 5, tenant-graph grounding 10, agent flows 13 per 100 actions, reasoning models 10 credits per 1,000 billed tokens (so a single turn can cost 141–461 credits), voice 10–75/minute; agents are blocked at 125% of prepaid capacity unless PAYG is attached. Source: learn.microsoft.com.

**Lindy.** Free ($50 one-time credits); Team from $29.99/active user/mo for 3,000 credits, scaling to $9,999.50 for 1.75M; top-ups $10/1,000; "everyday asks" 2–250 credits, "deep work" 250–1,000, "big builds" 1,000–2,500; credits pause when exhausted ("no surprise charges"); Enterprise adds HIPAA/BAA, SSO, audit logs. Source: lindy.ai/pricing.

**Relevance AI.** The live pricing page now shows only Enterprise ("Talk to sales", "decouple growth from headcount via an AI Workforce"); the model is Actions (what agents do) plus Vendor Credits (model cost pass-through) [docs via search]; earlier Pro ~$19–29/mo tiers appear retired [unverified]. Source: relevanceai.com/pricing.

**CrewAI.** Basic free (50 workflow executions/mo); Enterprise custom with "additional executions" metered, 45-day onboarding, forward-deployed engineering à la carte, VPC/self-host. A $25/mo Professional tier existed Oct 2025–spring 2026 and was removed [unverified]. Source: crewai.com/pricing.

**LangChain (LangSmith Deployment, ex-LangGraph Platform).** Developer free (1 seat, 5K traces); Plus $39/seat/mo (10K traces, one free small serverless deployment); Enterprise custom; usage in "LangChain Standard Units" at $1.00/LSU, e.g. 0.0675 LSU per vCPU-hour. Pure infrastructure pricing: seats for humans, metered compute for agents. Source: langchain.com/pricing.

### Tier C — open-source agent hosting (Hermes, OpenClaw) and indie operators

**Nous Research / Hermes.** Nous Portal: Free; Plus $20/mo ($22 credits); Super $100; Ultra $200; credits also sold à la carte. Hermes Cloud (preview): hosted Hermes instance billed hourly from credits — Small $0.29/day (~$8.70/mo), Medium ~$16.80, Large ~$32.70; stopped ~$0.90/mo; inference and tools billed on top; $10 minimum. This is the cost floor for "a hosted agent": under $10/month of compute. Source: dev.to (Nous Portal explainer).

**OpenClaw managed hosts.** MyClaw from $9/mo; Elestio from $14; DockClaw $19.99–49.99; xCloud ~$24; GetClaw ~$29; all bring-your-own-keys. The one *done-for-you* operator, SetupClaw: $3,000 one-time hosted setup, $5–6K with a Mac mini, +$1,500 per extra "executive agent", 14 days hypercare, aimed at founders with 4–50 staff (sponsored listing). Self-hosting is estimated at 3–6 hours/month of upkeep — that upkeep is the thing people pay operators for. Source: claudemarket.ai.

**Moltbook.** Reddit-style network for OpenClaw agents, launched 2026-01-28, 2.5M agents claimed; Wiz found an exposed production DB with ~1.5M API keys (Feb 2); Meta, Salesforce reportedly banned it internally; ~230 credential-stealing "skills" in ClawHub; acquired by Meta 2026-03-10 (terms undisclosed). No business model beyond the exit. Source: builtin.com.

**Indie "AI employee" subscriptions.** Sintra: 12 role-named "helpers" for $48.50/mo (list $97) or $15.60/mo on annual, single helper $39/mo, 250 credits, 14-day refund, "50,000 entrepreneurs" [unverified]. eesel's survey lists ten products across six meters (seat, credit, action, conversation/resolution, compute unit, quote-only) and warns edition floors and top-up rates double real cost. Sources: sintra.ai/pricing; eesel.ai.

**Freelance agent operators (Upwork/Fiverr).** Retainers are the model: AI social-media management $300–600/mo; automation builds $300–1,000 per project; other guides cite $1,500–2,500 setup + $400–800/mo maintenance and $60–150/hr [all unverified, affiliate-style sources]. A UK owner's 90-day test of a £47/mo lead-qualifying agent: 214 enquiries handled, 38 wrong answers, ~5 hours/month of hidden fixing, i.e. dearer than an offshore VA; it worked only after being narrowed to high-volume, low-stakes, first-pass work. Sources: dev.to; lilachbullock.com.

### Tier D — agent-to-agent marketplaces

**Virtuals ACP.** Four-phase request/negotiate/transact/evaluate with an on-chain evaluator; self-reported $470M "agent GDP" and 1.77M jobs (Feb 2026); $1M/month incentive programme; VIRTUAL protocol revenue fell ~95% from a $3.9M/month peak (Jan 2025) to <$200K (early 2026); real ACP commerce "concentrated in <0.3% of agents" [tracker site, unverified]; Fundstrat: ~$4.5M cumulative gross ACP fees, ~$452K protocol revenue [search-only]. Forkast's point: if evaluators are paid to signal, verification fails and "simulating commerce" becomes profitable. Sources: forkast.news; crypto-ai-tracker.

**Olas Mech Marketplace.** Mechs earn crypto when hired by other agents; 14.9M agent-to-agent transactions across seven chains, but total marketplace turnover (all fees ever collected) is **$110,688** as of 2026-11-05, and the showcased service has fulfilled 57 paid requests since launch. Sources: olas.network/mech-marketplace; build.olas.network/monetize.

**Merit / AgentCash.** Open-source router for x402/MPP-paid endpoints (July 2026): 44 origins, ~$40K revenue, ~765K transactions in 2026 — about five cents a call; no Merit fee stated. Merit's own newsletter counts 13.5M x402 payments industry-wide (July 2026), and Forkast notes >95% of x402 activity was protocol signalling, not buyer–seller exchange. Sources: merit.systems (two pages).

## 2. Analysis

### (1) Which pricing models hold up, and why

- **Per-outcome holds only where the outcome is cheap to adjudicate and the vendor controls enough of the loop.** Support resolution qualifies: Fin publishes $0.99/outcome, Sierra built a $400M-ARR [estimate] business on it. But even there Decagon reports most customers *choose* per-conversation for budget predictability, and Salesforce bolted a $2 "resolution" SKU onto a per-action meter rather than replacing it. Outcome billing migrates toward a *menu* (outcome for high-value cases, consumption for routine traffic) and lives or dies on the written definition of "done".
- **Per-seat survives where a human sits in the seat and carries the liability** (Harvey's lawyers, Devin Teams' developers, LangSmith's engineers). It fails for background agents — nobody is in the seat, and the vendor's own costs are per-token (Paid.ai's argument). Sierra's pitch against seat-based incumbents is explicitly that their revenue shrinks as automation improves.
- **Usage/credits dominate the self-serve tier** (Lindy, Copilot Studio, Devin ACUs, Relevance Actions) because they pass through model cost. Their failure modes are documented: unpredictability (Devin ACU refactors; a single Copilot Studio reasoning turn at 141–461 credits), paying for failures (ACUs on failed tasks), and "credit anxiety" (OpenAI's own finding). The mitigations that work are Lindy-style hard pauses ("no surprise charges") and prepaid caps.
- **Flat subscriptions win at the bottom** ($15–97/mo helpers, $20 Portal, $8.70/mo hosted agent) but they sell *access*, not outcomes, and churn with novelty.
- **Annual contracts with break clauses are the model that blew up.** 11x counted year-one values after 3-month exits; the category shows 50–70% annual churn [unverified] because the product's output (outbound email) degrades deliverability within 60 days. "Recurring" revenue for agents is only recurring when the agent's output is still wanted in month four.
- **Token/marketplace take rates are not a business yet**: $110K lifetime Olas turnover, ~$40K through Merit's router, Virtuals protocol revenue down ~95% with activity concentrated in a sliver of agents and an unsolved evaluator problem.

### (2) What buyers pay a tiny operator for vs. only an enterprise vendor

Tiny operators get paid for three things, at these observed prices: (a) **setup of a bounded agent** — $500–3,000 one-off (freelance guides; SetupClaw $3,000); (b) **keeping it running and corrected** — $300–800/mo retainers, which exist because self-hosting costs 3–6 hours/month and because the £47/mo agent needed 5 hours/month of human fixing; (c) **first-pass, high-volume, low-stakes, off-hours work** where the buyer can check the output themselves (lead sorting, triage, monitoring, drafting). Hosting alone is a $9–29/mo commodity with a $8.70/mo floor from Nous itself — not worth competing on.

Buyers pay only an enterprise vendor for: contractual outcome definitions with legal weight, platform fees that buy integrations into systems of record ($50K Decagon floor), compliance artefacts (SOC2/HIPAA/SSO/audit logs — every vendor gates these behind "Enterprise"), forward-deployed engineers, and indemnity. They will not pay a small shop to speak *as their brand* at scale to strangers (outbound email/calls): that is where hallucination rates, LinkedIn bans and the FTC's Air AI order ($18M judgment, ban on marketing business opportunities, "truth-in-advertising principles, just like everyone else") sit.

### (3) Where a verifiable public track record changes the decision

The AI-agent market's recurring failure is unverifiable claims: logo walls of non-customers, ARR that was contracted-not-earned, "1 in 10,000" hallucination claims against third-party measurements of 12–20%, self-reported "agent GDP", and marketplaces whose evaluators are paid to approve. A public, append-only record of what an agent did, what it charged, what was wrong and what was corrected changes a buyer's decision in four specific places:

1. **Outcome-billed work.** Decagon's stated reason to avoid per-resolution billing is definition disputes. A ledger that shows the deliverable, the acceptance criterion and the buyer's confirmation makes outcome billing auditable by both sides — the exact thing Sierra sells through contracts and Paid.ai sells as middleware.
2. **Procurement of a small vendor.** A buyer who cannot get SOC2 from a two-person shop can get the next best thing: a history of every output, the measured error rate, and the retention of past buyers. This substitutes for the logo wall that 11x faked.
3. **Regulatory exposure.** The FTC case turned on capability and earnings claims. Publishing measured performance instead of marketing claims is the cheapest truth-in-advertising defence a small operator has.
4. **Agent-to-agent markets.** Forkast's "evaluator problem" is a reputation problem; an off-chain verifiable record attached to an agent identity is what those marketplaces lack. (It is also the smallest market — treat as optional.)

Where it does *not* move the needle: consumer helper subscriptions (nobody reads a ledger before paying $39), and enterprise deals where the gating items are insurance, SSO and a named account team.

### (4) Recommendation for a9n9

**Sell, in this order:**

1. **Per-deliverable research and monitoring from agent001, now.** This is what the agent already does, it is the only category in the evidence where accuracy *is* the product, and the ledger already exists. Price as outcome billing with Sierra's rules: acceptance criterion stated upfront, no charge if rejected, pay on delivery. Points: $1–5 for a quick answer (the Fin $0.99 anchor shows buyers accept ~$1 per verified outcome), $20–50 for a cited deep report (OpenAI's reported $2,000/mo "basic agent" implies ~$100/day of agent work is a price enterprises will discuss; a9n9 should sit far below it). Stripe link for humans, picocash for agents; keep the settled 20% cut. Publish retention and error rate monthly — the inverse of the 11x playbook.
2. **Managed single-purpose agents for founders and small agencies, next quarter.** Package: $1,500 setup + $300–600/mo operation, bring-your-own model keys (as every OpenClaw host does), one bounded job (inbox triage, lead qualification, monitoring, scheduled reporting), each agent with its own public ledger page as the SLA artefact. These prices sit inside the observed freelance band and well under SetupClaw's $3,000+; the ledger is the differentiator no Upwork operator offers. Buyers: people already paying Fiverr/Upwork retainers; the ones with 4–50 staff SetupClaw targets.
3. **Do not sell**: hosting (commodity, $9/mo), AI SDR outbound (churn, deliverability, FTC and platform-ban evidence), per-seat anything (no humans in seats), enterprise support agents (needs $50K platform fee economics and FDEs), or marketplace/token listings as a revenue line (Olas $110K lifetime; Virtuals concentration). List on Olas/ACP only if it costs nothing and feeds the track record.
4. **Pricing mechanics to copy**: Lindy's hard stop when prepaid credits run out (no surprise charges); Sierra's upfront outcome criteria; Decagon's warning — write the definition of "done" before the first invoice; Artisan's lesson — qualify buyers and refuse whole categories; 11x's lesson — report churn consistently and never show a customer without consent.
5. **Metrics to publish from day one** (these become the sales deck): deliverables shipped, acceptance rate, corrections per 1,000 outputs, gross retention by cohort, spend per deliverable. The market's largest failures were all failures to publish exactly these.

## Sources (all opened with WebFetch unless marked search-only)

- https://techcrunch.com/2025/03/24/a16z-and-benchmark-backed-11x-has-been-claiming-customers-it-doesnt-have/
- https://www.onlycfo.io/p/ai-company-accused-of-fraud
- https://www.landbase.com/blog/11x-ai-pricing
- https://leadgen-economy.com/blog/ai-sdr-cancellation-wave-failure-forensics/
- https://techcrunch.com/2025/04/09/artisan-the-stop-hiring-humans-ai-agent-startup-raises-25m-and-is-still-hiring-humans/
- https://techcrunch.com/2025/09/28/paid-the-ai-agent-results-based-billing-startup-from-manny-medina-raises-huge-21m-seed/
- https://sierra.ai/blog/outcome-based-pricing-for-ai-agents
- https://www.sacra.com/c/sierra
- https://decagon.ai/blog/pricing-ai-agents
- https://fin.ai/learn/decagon-ai-pricing (competitor-authored)
- https://www.intercom.com/fin/pricing
- https://sacra.com/c/harvey/
- https://devin.ai/pricing
- https://sacra.com/research/cognition
- https://www.answer.ai/posts/2025-01-08-devin.html
- https://the-decoder.com/openai-prepares-to-launch-ai-agents-with-monthly-fees-up-to-20000/
- https://www.salesforce.com/agentforce/pricing/
- https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-messages-management
- https://www.lindy.ai/pricing
- https://relevanceai.com/pricing
- https://www.crewai.com/pricing
- https://www.langchain.com/pricing
- https://dev.to/zackchew/nous-portal-explained-plans-models-tools-and-hermes-cloud-9hh
- https://www.claudemarket.ai/blog/best-openclaw-managed-hosting-2026 (contains sponsored listings)
- https://builtin.com/articles/what-is-moltbook-openclaw
- https://forkast.news/the-machine-as-buyer-virtuals-acp-and-the-evaluator-problem/
- https://crypto-ai-tracker.vercel.app/projects/virtuals-protocol (unaudited tracker)
- https://olas.network/mech-marketplace
- https://build.olas.network/monetize
- https://merit.systems/blog/introducing-router
- https://merit.systems/blog/state-of-agentic-commerce
- https://www.eesel.ai/blog/ai-employee-pricing (vendor-authored)
- https://www.lilachbullock.com/ai-employee-real-cost-small-business/
- https://sintra.ai/pricing
- https://dev.to/ioneldigital/how-to-earn-3000-5000month-as-an-ai-freelancer-on-fiverr-and-upwork-2mlk
- https://www.cfodive.com/news/ai-startup-settles-ftc-deception-charges/815892/
- Search-only (not opened): VentureBeat/SiliconANGLE/TechCrunch on Devin 2.0 pricing (2025-04-03); Fundstrat Virtuals Q2 2026 PDF; TechCrunch on 11x CEO exit (2025-05-05) and Artisan LinkedIn ban (2026-01-07); openai.com ChatGPT agent page (403).
