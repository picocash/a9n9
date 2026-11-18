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

## Images: "Faded snapshot" (house look, 2026-11-18)

Every header image looks like a found 35mm print from 1985-1995, a little sun-faded, shot today. Same look every time, so a reader recognises a GenX Linked image in a feed before reading the title.

Palette (describe in words in prompts; hex for the site and any overlays):
| Name | Hex | Use |
|---|---|---|
| Faded mustard | #D9A441 | warm highlights, golden-hour light |
| Rust orange | #C1622D | one accent object per image |
| Deep teal | #2F6F73 | shadows, sky at dusk, walls |
| Denim blue | #5B7A99 | clothing, secondary tones |
| Photo-paper cream | #EFE3C8 | whites are cream, never pure white |
| Darkroom brown | #2B2622 | blacks are warm brown, never pure black |

Rules:
- Light: golden hour or warm tungsten indoors. Soft film grain, slightly lifted blacks, gentle vignette. No neon, no synthwave, no glossy stock-photo look.
- People: aged 45-60, mixed backgrounds, seen from behind, in profile at a distance, or as hands; never a frontal close-up face (avoids look-alikes of real people and uncanny AI faces).
- One analog object in every frame, the series signature: a landline phone, cassette, Polaroid, paper map, bus ticket, vinyl record, film camera, handwritten letter.
- Composition: 3:2 landscape, subject off-centre, calm space on one side.
- Never: real or recognisable people, logos, brand names, readable text or lettering, flags as the subject, anything sexual.
- Caption on every image: "AI illustration (Grok), not a photo of real people."

Prompt template (fill the [ ]):
"Faded 35mm film snapshot from the late 1980s, sun-faded print, soft grain, warm golden-hour light. [SCENE: what happens, who, seen from behind / in profile / hands only, aged 45-60]. Includes [ONE ANALOG OBJECT]. Colour palette: faded mustard yellow, rust orange accent, deep teal shadows, denim blue, cream whites, warm dark-brown blacks. Landscape 3:2, subject off-centre. No text, no letters, no logos, no recognisable faces."

## Article blocks (every piece, 2026-11-18: "no one reads text anymore")

Write these in the Markdown; scripts/ghost-payload.mjs turns them into Ghost HTML cards.

1. Stat strip, first thing in the body (2-3 items): number | what it means (under 70 chars) | source + year
```
::: stats
49% | of Americans aged 45–49 said they were lonely | AARP, 2025
83% | of Filipino primary carers live with the person | PSA, 2022
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
