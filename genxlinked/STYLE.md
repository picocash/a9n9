# GenX Linked house style (from the wave-1 reviews, 2026-11-18)

Keep (what worked):
- Open in the reader's life, not the data ("becomes a Tuesday-night phone call").
- Deadpan, never jokey ("it did not achieve substantial results").
- Puncture nostalgia kindly; say plainly what we couldn't find, ONCE.
- One concrete, repeatable fact per country.
- Short sharp metaphors ("You are the switchboard"). Reassure, never prescribe.

Rules (what failed):
1. A human voice in the first 100 words: a sourced archive/press quote from a real named person, or a real reader reply. Never invent people, quotes or memories.
2. Headline written last, and it promises only what the data delivers. No "Gen X" claim unless a source measures roughly 1965-80 / ages 45-60; otherwise say the age band.
3. Global: at least one non-anglosphere country (Philippines or Singapore) with real data, or a reader callout aimed there. Not US+UK by default.
4. Sources: statistics offices / government / the study itself first; Wikipedia only for background. Vendor or PR surveys name the funder in the sentence ("ResMed, which sells sleep-apnoea machines, found..."). Give the survey year next to every number.
5. Caveats: one line, not a section. No closing "what it adds up to / patterns" section: end on the most striking fact, then ONE reader question (year, country, city).
6. Vary the format: 400-word prompts, 700-1,000-word features, reader-reply pieces. No fixed template.
7. Facts that change (heads of government, results): re-check on publication day against an official page.
8. No medical, money or legal advice; no politics; no generation-bashing. Last line: *AI-assisted, edited by Arun.*

## Images: "Comic panel" (house look, replaces Faded snapshot, 2026-11-18)

Arun: photo-real AI images look too AI-generated. Every header image is a single comic-book panel, like a page from a late-1980s comic printed on cheap newsprint. Illustrated people, never realistic ones.

Palette (same six colours, flat fills; hex for the site):
| Name | Hex | Use |
|---|---|---|
| Faded mustard | #D9A441 | skies, warm fills |
| Rust orange | #C1622D | one accent object per panel |
| Deep teal | #2F6F73 | shadows, night, walls |
| Denim blue | #5B7A99 | clothing, secondary fills |
| Newsprint cream | #EFE3C8 | paper and highlights, never pure white |
| Ink brown | #2B2622 | bold outlines, never pure black |

Rules:
- Style: bold hand-inked outlines, flat colour fills, Ben-Day halftone dots in shadows, slight colour misregistration, newsprint paper texture. Stylised cartoon people (simple faces, exaggerated poses), clearly drawn, never photographic.
- People: aged 45-60, mixed backgrounds, expressive but generic; nobody resembling a real person.
- One analog object in every panel, the series signature: landline phone, cassette, Walkman, Polaroid, paper map, bus ticket, vinyl record, film camera, handwritten letter, rotary dial.
- Composition: one panel, 16:9 landscape, a clear moment (like a story beat), calm space on one side.
- Never: real or recognisable people, logos, brand names, flags as the subject, anything sexual, and NO words: no speech-bubble text, captions, signs or lettering (AI lettering comes out garbled). Empty speech bubbles are fine.
- Caption on every image: "AI illustration (Grok)."

Prompt template (fill the [ ]):
"Single comic book panel, late-1980s American comic style, bold ink outlines, flat colours, Ben-Day halftone dots, slight colour misregistration, printed on yellowed newsprint. [STORY BEAT: who, aged 45-60, doing what, where]. Includes [ONE ANALOG OBJECT]. Limited palette: mustard yellow, rust orange, deep teal, denim blue, cream paper, dark brown ink. Stylised cartoon people, not realistic, not photographic. No text, no letters, no words in speech bubbles, no logos. 16:9."

## Article blocks (every piece, 2026-11-18: "no one reads text anymore")

Write these in the Markdown; scripts/ghost-payload.mjs turns them into Ghost HTML cards.

1. Stat strip, first thing in the body (2-3 items): number | what it means (under 70 chars) | source + year
```
::: stats
49% | of Americans aged 45–49 said they were lonely | AARP, 2025
60% | of Filipinos aged 60+ live with at least one child | LSAHP, 2018–19
:::
```
2. One pull-stat mid-article (the single most striking number):
```
::: stat
1 in 2 | younger Gen Xers in the US say they're lonely | AARP, 2025
:::
```
3. One chart (the infographic): 3-8 rows comparing countries, years or groups; same unit; highlight the row the story is about.
```
::: chart
title: Walking home alone, England, ages 7-11
subtitle: Share allowed to walk home from school alone
unit: %
source: Policy Studies Institute, 2011
highlight: 1971
1971 | 86
1990 | 35
2010 | 25
:::
```
4. One quick poll, roughly two-thirds down (id = slug + -1; 2-5 options in Gen X voice; one tap):
```
::: poll
id: better-friendships-1
question: More friends at 15, or now?
- At 15, easily
- Now, honestly
- About the same, just fewer phone calls
:::
```
Rules: every number in a block must already be in the article and its sources (no new facts); no block repeats a number from another block; charts never mix units, years or age bands without saying so in the subtitle; keep paragraphs short (3 sentences max) so blocks break the text every 150-250 words.

5. Quiz (optional, for quiz pieces): 5-8 questions, 3-4 answers each with points, 3-4 results covering every possible score with no gaps or overlaps; results are friendly, never shaming, never advice. id = slug + -quiz.
```
::: quiz
id: are-you-a-prepper-quiz
title: Are you a prepper?
q: How much bottled water is in the house right now?
- None, there's a tap | 0
- A few bottles | 1
- Enough for three days for everyone | 2
result: 0-3 | Grasshopper | You'd be in the supermarket queue with everyone else.
result: 4-8 | Sensible | ...
:::
```
Pillars (tag slugs): connection, sandwich, body, bucket-list, in-charge, analog-life.
