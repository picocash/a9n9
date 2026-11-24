---
name: desk-pipeline
description: "Run agent004's candidate pipeline as orchestrator: open leads, let the evidence/narrative/analyst profiles work, run the risk engine, report to Arun on Buzz"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, finance, pipeline, kanban, risk]
    category: autonomous-ai-agents
---
# Desk pipeline (you are the orchestrator)

A candidate goes through six stages. Three are code, three are your sub-agents (Hermes profiles). You open, check risk and report.

| Stage | Who | What it leaves in the journal |
|---|---|---|
| Scout | code (events monitor) | a lead: symbol, event, source, time, trigger rule. Repeats collapse into one candidate. |
| Evidence | profile `evidence` | dated, sourced facts and what is missing. A code-gathered fact pack comes first. |
| Narrative | profile `narrative` | the claim, its origin, independent sources vs repeats, what is unverified |
| Analyst | profile `analyst` | view, supporting observations (each tied to a recorded fact), strongest objection, missing, invalidation, proposal, prediction |
| Risk engine | code (`pipeline risk`) | named pass/fail checks against /agent/desk/risk.json (read-only; versioned) |
| Journal | code | every step, refusal and rejection, append-only: `pipeline journal [cid]` |

## When a `lead <cid> <SYM> <rule>` line wakes you
1. `/agent/bin/pipeline open <cid>`. It gathers the fact pack and creates four tasks on the kanban board `desk`:
   evidence and narrative (run first), analyst (after both), and a "risk + report" task assigned to you.
2. You do nothing else for that candidate until your "risk + report" task arrives. Do not do the sub-agents' work yourself.
3. `open` refuses a lead at VERIFY (no source) and stops at the daily cap. A refusal is an answer: tell Arun only if it matters.

## When Arun asks you to look at a stock ("run the desk on XYZ")
`/agent/bin/pipeline lead XYZ --event '<what he asked, in his words>' --rule 'Arun asked' --source 'buzz <message id>'`, then `pipeline open <cid>`.
Tell him it is running and roughly when to expect it (three model stages, about 10 to 20 minutes).

## Your "risk + report" task
1. `/agent/bin/pipeline risk <cid>`: the hard checks. You cannot argue with a failed check, change a limit or resize to squeeze under one.
2. `/agent/bin/pipeline show <cid>` and write to Arun on Buzz (`/agent/bin/team send '<text>' --mention <Arun's pubkey>`), at most 12 lines:
   the view; the 2 strongest observations with their sources; the strongest objection; what is missing; the invalidation;
   the risk result (PASS, or FAIL with each failed check by name); the intended paper order if it passed. Mark it "for your decision".
   Nothing is executed: there is no trading tool. Say "paper" for any order.
3. Add the analyst's prediction to predictions.md and `/agent/bin/remind add` for its check date.
4. `/agent/bin/pipeline close <cid> --note '<what you sent and the Buzz event id>'`, then complete the kanban task.

## Keeping it healthy (work runs)
- `/agent/bin/pipeline list`: a candidate that has been OPEN for over an hour is stuck. Look: `hermes kanban --board desk list` and
  `hermes kanban --board desk show <task id>`. A blocked or failed stage: read its error, `hermes kanban --board desk unblock <id>` once;
  if it fails again, tell Arun on Buzz what broke and close the candidate with that note.
- The sub-agents can only record their own stage; a "refused" or "rejected" entry in the journal is the tool working, not a fault.
- Limits live in /agent/desk/risk.json. If you think one is wrong, say so to Arun once with the evidence. Only he changes it.
