---
name: genxlinked-desk
description: "Research, write, illustrate and publish one GenXLinked article to the house standard"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [genxlinked, writing, publishing]
    category: autonomous-ai-agents
---
# GenXLinked desk: one article, start to finish

The house rules are in `STYLE.md` next to this file. Read it in full before your first article of a run; follow it exactly. The desk refuses drafts that break the mechanical rules, but the truth rules are yours to keep.

## 1. Pick the piece (10 minutes, not more)
- `/agent/bin/desk status`: what is published (do not repeat a topic), drafts in progress, poll votes (results can become a piece).
- Choose from: questions Gen X actually ask (search the web, read r/GenX and r/GenXWomen top threads for themes; never quote or name posters), reader mail, poll results, a viral Gen X claim worth checking, a "same year, different country" year. Prefer topics where a specific, sourced answer exists, and where someone would search or ask an AI chatbot.
- Pillars (front matter `pillar:`): connection, sandwich, body, bucket-list, in-charge, analog-life, work-money. Rotate so no pillar goes two weeks without a piece.

## 2. Research
- Web search, then open every page you take a number from. Primary sources first (statistics offices, government, the study). Write down source name, year and URL as you go.
- At least 3 sources with URLs; one non-anglosphere data point (Philippines or Singapore) where it exists; a sourced human voice (named person, real quote) in the first 100 words.

## 3. Write the Markdown
- File: `/opt/data/workspace/drafts/<slug>.md`. Front matter: `title`, `slug` (a-z0-9-), `pillar`, `tags: [...]` (pillar first, then countries), `excerpt: "<under 200 chars>"`, `sources:` list of `  - "Name — URL"`, and `consent:` if a forum thread inspired it.
- Body: open with a 2–3 sentence direct answer. `::: stats` first, one `::: stat`, one `::: chart` (comparable numbers only), one `::: poll` (id = slug + `-1`) or `::: quiz`, short paragraphs, one reader question at the end (birth year, country, city), last line `*AI-assisted, edited by Arun.*`. 350–1,600 words.

## 4. Put it on the desk
- `desk draft <file>`: fix every problem it lists and run it again until `ok`.
- `desk image <slug> '<a story beat: who, doing what, where>' '<one analog object>'` (2 a day). The desk adds the house comic style; you only describe the moment.
- Read the draft back (`desk get <slug>`) once, as a sceptical Gen X reader: is every number sourced, is anything overclaimed?
- `desk publish <slug>`. Every second day, add `--substack` on the strongest new piece.

## 5. Tell the team
`board post` what you published (title, url, why this topic, what you expect it to do) and what you changed in memory or strategy.
