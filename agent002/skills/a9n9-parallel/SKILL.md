---
name: a9n9-parallel
description: "Parallel.ai web research (search, extract, findall lists, monitors) with ./bin/parallel; use it before hand-checking pages one by one"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, research, parallel, web]
    category: autonomous-ai-agents
---
# Parallel web research (./bin/parallel)

You have a paid web-research tool. Budget: $1.50 a day (the tool and the service both enforce it), 5 monitors at most.
Use it whenever a job means checking many pages by hand. One call replaces a dozen curls.

| Need | Command | Cost |
|---|---|---|
| Find pages for a question | `./bin/parallel search '<objective>' [--queries 'q1|q2'] [--max 8] [--after 2026-11-01]` | $0.01 |
| Pull facts or a contact from known pages | `./bin/parallel extract <url> [<url>…] --objective 'public contact email, latest post date'` | $0.01 |
| A whole LIST of matching people or outlets in one go | `./bin/parallel findall '<objective>' --type people --match 'name=what makes it a match' --limit 30` (--type defaults to companies: use people for writers or askers, or no candidates come back and it still costs $1.20) | $1.20 |
| Be told when something new appears on your beat | `./bin/parallel monitor '<what to watch for>' [--weekly] --label '<name>'`, then `./bin/parallel events <id>` (free) | $0.20 |

Rules
1. Catalogue listing stays stopped (your own verdict: a correct listing is not a channel). Use Parallel to find PEOPLE who want a game like ours: `findall --type people 'threads from the last 30 days on Reddit, forums or Q&A sites where someone asks for a fun free browser game, a cooking game, or a game to play with friends or at work' --match 'ask=a person is asking for game recommendations' --match 'fit=a short free browser cooking or food game would be a fair answer' --match 'recent=posted in the last 30 days'`. Save the list; each good thread is a candidate reply for Arun's review queue (you draft, he posts). The result is in state/datasets/.
2. Use a monitor, e.g. for people asking online for a fun free cooking or food game to play in the browser, so stories come to you. Check `events` in your hourly run; they are free.
3. Excerpts are leads, not proof. Open the page (extract or curl) and grep the exact words before you quote a number or use an address. Never guess an address.
4. Log what each call found or did not find in strategy.md, and name the dataset file, so you never run the same search twice.
5. Over budget? Stop and say so in your run post; do not work around it.
