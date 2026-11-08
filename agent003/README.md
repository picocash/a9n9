# agent003: travel (Travelpayouts)

Status 2026-11-08: site and publishing kit built and tested; container not created yet.

## What exists
- **Site:** `site/` (home, about, disclosure, privacy, robots, sitemap), deployed to `~/a9n9/agent003/site` and served by nginx container `a9n9-agent003-site` on 10.0.1.101:8900 (in `~/a9n9/docker-compose.yml`). Every page carries the Travelpayouts Drive script (marker 597751) in `<head>`, which is also the site-ownership check, plus an AI-authorship and affiliate notice.
- **Kit (`bin/`, mounted read-only at /agent once the container exists):**
  - `fares`: Aviasales Data API (cached prices, not live quotes), dated rows with labelled affiliate links, 300 calls/day.
  - `page`: queues a guide; rules in `bin/_rules.mjs` (600+ words, dated prices, labelled brand links ≤ 6, no first-person travel, no cashback, no raw HTML), 2 new pages and 4 updates a day, judge pass required.
  - `judge`, `journal`: as in agent002.
- **Host crons (every 2 min):** `scripts/site-build.mjs` re-checks queued pages and is the only writer of the live site; `agent002/scripts/judge-run.mjs` with `AGENT_ROOT=~/a9n9/agent003` scores drafts.
- Pipeline tested end to end in a sandbox on 2026-11-08 (refusal without a score, queue, render, `rel="sponsored nofollow"`, guide list, sitemap).

## Travelpayouts facts that shape the plan (from their help centre, 2026-11-08)
- Signing up auto-connects the account to every program open to the Project type; some brands review the Project first.
- Brands that review want **original travel content, updated regularly**. Pages that only hold widgets, or content that is unoriginal or stale, get rejected.
- Review minimums: websites from **1,000 monthly active users**; AI projects from 5,000; cashback/coupon sites from 20,000.
- Banned everywhere: spam, push and adult traffic, posting links on third-party sites without consent, brand bidding in paid search; many brands ban pop-ups and doorway pages.
- Website ownership is confirmed by installing **Drive** (`emrld.ltd` script) in `<head>`. Drive is their AI tool that turns links on the page into affiliate links and can add widgets. Our rule says labelled links, so the site-wide notice and disclosure page cover Drive, and Drive's automatic features should be switched off or kept minimal after verification.
- Data API (prices for dates, calendars) needs only the account plus a connection to the Aviasales program; token in Profile → API token. Cached prices, 2-7 days old.
- Payouts monthly, from the 11th to the 20th, once the method's minimum is reached. Contracting entity Travelspark Limited (Hong Kong); Hong Kong arbitration.

## To go live (Arun)
1. From the Mac session: tunnel ingress `agent003.a9n9.net` → `http://10.0.1.101:8900`, plus the CNAME (same as reserves.a9n9.net).
2. In Travelpayouts: make sure the Project URL is `https://agent003.a9n9.net`, then click **Check Drive connection**.
3. After verification: decide on Drive's automatic link and widget features (recommended: off).
4. Profile → API token → `~/a9n9/secrets/agent003-travelpayouts.env` as `TRAVELPAYOUTS_TOKEN=...` (mode 600); then `scripts/deploy.sh`.
5. An LLM account for agent003 (as agent002 has Nous Portal on agent002@a9n9.net).
6. Google Search Console for agent003.a9n9.net (DNS TXT from the Mac session).
7. Payout details when the balance nears the minimum.

## Then (Claude)
Create the Hermes container on the agent002 pattern (blank slate, bridge network, /agent read-only, state writable), the work cron, usage-watch with a daily cap, an OPERATOR.md, and a host audit of the live site (labels, disclosure, Drive present).

## Known gaps
- The judge was calibrated on dev.to tech posts, not travel pages. Re-calibrate on travel blog posts once there is traffic data.
