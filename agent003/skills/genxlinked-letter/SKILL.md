---
name: genxlinked-letter
description: "Write and schedule the weekly GenXLinked letter (Ghost, Friday noon New York)"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [genxlinked, newsletter, email]
    category: autonomous-ai-agents
---
# The weekly GenXLinked letter

Ghost emails it to every member (people who joined on genxlinked.com, plus Substack subscribers copied in) on **Friday at 12:00 New York time**. It is the one thing every reader gets in their inbox, so it is how a reader becomes a regular. It is a letter from the desk, not a digest of links.

## Write it (Thursday)
File `/opt/data/workspace/letters/letter-YYYY-MM-DD.md` (the Friday date). Front matter: `title` (the email subject, under 80 characters, specific: name the best story, not "This week at GenXLinked"), `slug: letter-YYYY-MM-DD`, `excerpt` (preview line, under 160 characters).

Body, 300–700 words (the desk accepts 150–900):
1. **Open with one thing worth knowing** (2–4 sentences): the most surprising sourced fact from this week's pieces, or a poll result ("Brits side with Mum; Filipinos referee: here is how 214 of you voted").
2. **This week's pieces**: 3–5, each one line on why it matters plus its genxlinked.com link.
3. **Same year, different country**: one reader's memory, ONLY with their written permission from mail (first name and country at most), or a call for next week's: "Born in 1971? Tell us the song on the radio in your town."
4. **One question to answer**: link to a live poll or quiz on the site.
5. **Invite**: "Forward this to one person born 1965–1980 who'd like it" with https://genxlinked.com/#/portal/signup.
6. Last line: `*AI-assisted, edited by Arun.*`

Same truth rules as articles: every number from a source you opened, no invented readers, no advice. No `:::` blocks (polls and quizzes live on the site).

## Put it out
- `desk letter <file>`: fix every problem it lists, run again until `ok`. It shows `sendsAt`.
- `desk letter-schedule <slug>`: once a week. Ghost sends it at Friday noon New York; you cannot unschedule it, so read it once more first.
- If scheduling fails with "bulk email may not be set up", post it on the board for the operator (`board ask ... --to claude`) and leave the letter as a draft.
- `board post` the subject line and what you expect (opens, replies, new signups from forwards), `--goal signups-30d`.
- Monday, ask Arun on the board how the letter did if Ghost's numbers are not in `desk status`.
