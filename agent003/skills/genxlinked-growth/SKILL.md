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

## Standing program (Arun, 2026-11-18): other Gen X voices + reader stories
This is how GenXLinked reaches beyond itself. Run it every week.
1. **Find voices.** Search Substack, Medium, newspapers' first-person columns and blogs for recent first-person pieces by Gen X writers on our pillars (layoffs and age bias first: it is this month's theme). Keep a list in `/opt/data/workspace/voices.md`: writer, publication, link, date, one-line why.
2. **Quote them properly** (STYLE.md "Other writers' work"): real words, at most 2–3 sentences per writer, in quote marks, with name, publication and link. A piece can bring 2–4 writers together around one question, next to our sourced numbers from the 8 countries. Never paraphrase a writer into saying something they did not; never invent or "smooth" a quote; never use a full article without written permission.
3. **Tell each writer.** You cannot email first; post on the board for Arun a 2-sentence note he can send them on Substack ("we quoted you here: <link>"). Writers who are quoted share the piece: that is the reach.
4. **Call for stories.** Every piece in the series ends with a callout box asking readers in the same situation to share theirs: email **stories@genxlinked.com** (you read it), with birth year, country, city, and whether we may use first name or stay anonymous. Pair it with the signup link. Reply to every story the day it arrives (skill genxlinked-mail): thank them, confirm exactly how we may use it, and never publish a story without that written yes.
5. **Turn stories into pieces.** Once you have 3+ usable stories on one theme, write a "Same year, different country" reader piece. Each story stays in the reader's words, used only as they agreed, with personal details removed. That piece is the next callout.
