#!/bin/sh
# agent003: events job (every 1m, monitor-gated) + work job (every 2h). Run inside the a9n9-agent003 container.
set -e
hermes cron edit 0513003b552a --name events --add-skill a9n9-parallel --add-skill genxlinked-growth --prompt "Something NEW happened: the MONITOR CHANGE block lists it (only new lines wake you). Handle every new line now:
- mail <id>: genxlinked-mail skill, every message, before anything else.
- board-ask / board-reply <id>: a9n9-board skill; answer each one.
- reminder <id> <what>: a promise you made to yourself. Do it now, then ./bin/remind done <id> '<what happened>'.
- members <n>: someone joined GenXLinked. Run desk status; find which page and which ref tag brought them (visits.byTag7d, topPages7d) and write it under What is working in strategy.md. If a cap allows, do more of what worked right now.
- ref <tag> <n>: someone clicked a link you placed (pitch, swap, guest piece). Note it in strategy.md; if that writer or editor has not replied, set ./bin/remind add +2d 'follow up with <who> (<tag>)'.
- monitor <id> <n>: ./bin/parallel events <id>. If a finding is news for our readers, check it on the cited page and draft it (genxlinked-desk) or put it in the queue.
Lines you have already handled (same id or same number as before) need nothing. Before you finish, every follow-up you promised must have a reminder (./bin/remind list). Finish with one board post with a true --memory line and the --goal that fits."
hermes cron edit f16e2ed5e223 --name work --schedule "every 120m" --prompt "Work run (every 2 hours; between runs the events job wakes you within a minute for mail, board, reminders, new members, link clicks and monitor hits). Read /agent/SOUL.md if you have not this session.
1) board catchup, mail list, ./bin/remind list: handle anything waiting or due first.
2) desk status: note members and visits.
3) Finish at least ONE growth action that a reader, writer or editor will see (skill genxlinked-growth). Use ./bin/parallel (skill a9n9-parallel): findall for whole lists of Gen X writers and outlets with public contacts, monitor for your beat, extract to read a page. If a daily cap blocks the obvious action, do the next item on your list (build the next draft, run a findall, prepare and schedule the next pitch). A run that only reports numbers is a failed run.
4) If today has no published article and it is past 13:00 UTC, write and publish one now (skill genxlinked-desk).
5) Every follow-up gets a reminder: ./bin/remind add <+2h|+2d|2026-11-25T09:00Z> '<what>'. Do not rely on a later run noticing.
6) Keep /opt/data/workspace/strategy.md current. 7) One board post with a true --memory line and --goal (signups-30d, signups-90d, daily-article, reach or upkeep)."
hermes cron list 2>&1 | grep -E "Name:|Schedule:|Skills:"
