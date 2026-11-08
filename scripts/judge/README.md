# Content judge

Host-side quality judge for agent-written posts. Runs a different model family (xAI Grok) from the agents, and agents cannot read or edit it.

```sh
node judge.mjs score post.md            # median of 3 runs: pull 0-100 plus 7 criteria, weakest point and one fix
node judge.mjs compare ours.md theirs.md
```

## Calibration (2026-11-08, `calibration-report.json`)

78 real dev.to posts in agent002's tags (ai, python, webdev, llm, api, tutorial, productivity), published 21-180 days earlier, 4-15 minutes long, no organisation accounts, one per author. Three tiers: hit (30+ reactions, n=19), mid (3-10, n=30), zero (0 reactions, n=29). Base rate: across 15,703 posts collected the median gets 0 reactions and the 90th percentile gets 1.

| | AUC hit vs zero | AUC mid vs zero | AUC hit vs mid | Spearman vs reactions |
|---|---|---|---|---|
| pull | 0.82 | 0.79 | 0.49 | 0.38 |
| voice (best single criterion) | 0.84 | 0.79 | 0.54 | 0.44 |
| stakes (weakest) | 0.70 | 0.70 | 0.50 | 0.27 |

What it can and cannot do:
- It is a **floor check**. At pull >= 50 it passes about 74% of posts that got reactions and rejects about 72% of posts that got none.
- It **cannot pick hits**. Above the floor, reactions depend on things outside the text (author audience, timing, distribution).
- Single calls are noisy (one post scored 38 and 62), so `score` takes the median of three. The calibration used single calls; median-of-3 should do at least as well.
- Pairwise comparisons were weaker (68-75% vote accuracy, many order-dependent splits). Use `score` for gating.
- Its suggested fixes sometimes invent figures ("we burned $340 ..."). An agent acting on them must use only its own measured numbers.

Confounds not controlled: author follower counts (the dev.to API does not expose them) and topic trends.

## agent002, first test (2026-11-08)

| piece | pull (median of 3) | weakest |
|---|---|---|
| dev.to "Building LLM-Ready Datasets from the Web" | 62 | novelty: generic five-stage listicle with heavy product placement |
| dev.to "Email Enrichment API: Six Checks ..." | 78 | stakes: no concrete story of what went wrong |
| GitHub ai-cost-calculator README | 78 | stakes: no surprising worked example up front |

All three clear the floor, yet the two articles got 10 and 0 views. For agent002 the text is not what is failing at the floor; the reach is. The judge's repeated advice ("stakes": open with a real, costly example) is the cheapest improvement available.
