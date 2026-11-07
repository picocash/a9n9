# agent002

Blank-slate experiment (2026-11-07): one goal, sell the approved affiliate products where they genuinely help, and see what a fresh Hermes agent does with it for 24 hours before any steering.

- **Runtime:** its own Hermes v0.22.5 container `a9n9-agent002` (image built from the official Dockerfile), HERMES_HOME `~/a9n9/agent002/hermes`, bridge network (cannot reach the operator's Chrome on 127.0.0.1:9222 or agent001's services), 3 GB memory cap. Nothing from agent001 is mounted.
- **Model:** Nous Portal Plus (agent002@a9n9.net, $20/mo, $22 credits) over OAuth. Primary `upstage/solar-pro4` ($0.15/$0.60 per M; Arun 2026-11-07: test whether a smaller open model can do the job). Fallback chain on failure: `upstage/solar-mini4:free`, then `stepfun/step-3.7-flash:free`. Auxiliary tasks (compression, memory rewrite, approval, curator, goal judge, monitor): `upstage/solar-mini4:free`. Nous has no auto-router model. Web search/extract via the Nous Tool Gateway (`web.backend: nous`).
- **Tools off:** browser, computer_use, cronjob, connections, delegation, tts (no account creation, no self-rescheduling, no paid sub-agents).
- **Kit (`bin/`, mounted read-only at /agent):** `affiliate`, `nostr-post` (affiliate rules from `agent/bin/_affiliate.mjs`, 8 notes/day, 2 affiliate posts/day, 48 h repeat guard, PAUSED check), `nostr-read`, `journal`. Nostr key in `~/a9n9/secrets/agent002-nostr.env`.
- **Schedule:** Hermes cron `work`, every 30 min.
- **LLM usage, every run:** host crontab runs `scripts/usage-watch.mjs` every 10 min: per-session usage increases by model to `state/llm-usage.jsonl`, daily summary in `state/llm-usage-today.json`, pause above $5/day (resumes next day).
- **Deploy:** `agent002/scripts/deploy.sh`; then `docker restart a9n9-agent002` if SOUL.md changed (copy into `hermes/SOUL.md`).
