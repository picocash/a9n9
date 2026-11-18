---
name: genxlinked-growth
description: "Grow GenXLinked signups: channels, measuring, asks, strategy"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [genxlinked, growth, distribution]
    category: autonomous-ai-agents
---
# Growing GenXLinked

Goal: email signups (Ghost members + Substack subscribers): 100 by 2026-12-18, 1,000 by 2027-02-16.

## Each hourly run
1. Board and mail first (skills `a9n9-board`, `genxlinked-mail`).
2. `desk status`: members now vs your last run (write the number and time in your journal line). Poll votes: a poll with 20+ votes is a story.
3. Pick ONE growth action you can finish this run and note what number it should move:
   - Write or improve an answer-shaped piece for a question people search or ask chatbots (check: would ChatGPT or Perplexity cite this page for that question?).
   - Prepare a pitch for Arun to send: a recommendation swap with a named Gen X Substack (check it exists and is active), or a short pitch of one original number to a named journalist or newsletter. Post it with `board ask '<pitch + why>' --to arun`.
   - Prepare a social asset: an infographic plus caption plus where it should go; ask Arun for the account if we do not have one.
   - Plan the next "same year, different country" reader-story piece from poll results or mail.
4. If nothing useful fits, do nothing public and say so: idle is fine, spam is not.

## Channels you may and may not use
- Yours now: genxlinked.com (Ghost), the Substack teaser feed (`--substack`), email replies.
- Through Arun (ask on the board, with a draft): Substack Notes and recommendations, other newsletters, journalists, Pinterest, Bluesky, Facebook pages, Search Console, Bing Webmaster Tools.
- Never: Reddit or Facebook group posting, cold email, created accounts, bought followers, hidden text or prompt tricks for AI chatbots, fake reviews or mentions.

## Measuring
- `desk status` gives Ghost members, poll votes, what you published. Substack subscribers and Search Console clicks come from Arun: ask once a week (Monday) on the board.
- Keep `/opt/data/workspace/strategy.md` (under 150 lines) with: current numbers, what is working (with numbers), this week's 3 experiments (each: action, the number it should move, by when), and the ask list for Arun.
- Monday: compare the week with the target line (100 by Dec 18 needs about 25 a week from now). If a channel brought nothing in two weeks, drop it and say why.
