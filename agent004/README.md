# agent004: Arun's financial analyst

Created 2026-11-22. Proxmox VM 107 `agent004` (10.0.1.46, 8 vCPU / 32 GB / 200 GB, `ssh agent004`), Hermes v0.22.5 in container
`a9n9-agent004` (`run-container.sh`), kit mounted read-only at /agent, state writable, keys in `~/a9n9/agent004/secrets` on the VM.

## Tools (bin/)
- `market`: FMP (Arun's key, US symbols on the current plan) for quotes, history, statements, TTM ratios and news; Yahoo chart
  fallback for symbols FMP refuses; SEC EDGAR filings and XBRL facts. Cached, 300 calls a day.
- `portfolio show | value | history`: reads `/agent/portfolio.json` (written by the operator from what Arun gives; read-only to
  the agent). Format: `{"currency":"USD","asOf":"…","cash":0,"positions":[{"symbol":"AAPL","shares":10,"costBasis":150,"account":"…"}]}`.
  No trade command exists.
- `mail list | read | reply | done`: agent004@a9n9.net (routing rule → a9n9-email Worker, key in AGENT_MAIL_KEYS; reply-only, 20/day).
- `parallel` (per-agent key on the tools service, $1.50/day), `remind`, `board`, `journal`.

## Jobs (Hermes cron, created paused until the LLM login exists)
events every 2m (own monitor: board, reminders, Parallel monitors, holding moves of 3%+, new SEC filings), premarket 13:00 UTC
Mon-Fri, close 21:30 UTC Mon-Fri, work every 2h, weekly Sunday 18:00 UTC. Definitions: scripts-hermes/jobs-2026-11-22.sh.

## Market monitors moved here (2026-11-22)
Arun's Financial-Modeling-Prep-MCP-Server folder (FMP MCP server plus his market monitors) moved from the home box to the VM at
`/home/ubuntu/Financial-Modeling-Prep-MCP-Server` (old copy archived on the home box in ~/archive). Its 6 cron jobs run on the
VM's host crontab, unchanged: market conditions every 15 min 9-16 Mon-Fri, daily summary 20:40 Mon-Fri, weekend summary Sat 10:00,
MSTR monitor 12:00 and 16:00, NAKA monitor every 15 min. The VM clock is America/New_York (as on the home box), so these are
Eastern times; the agent's container stays on UTC. Node 22.22.1 is in /usr/local on the VM. Not mounted into the agent yet.

## Waiting on Arun
1. LLM login (as agent003: an Anthropic setup-token in hermes/), then resume the five jobs.
2. The portfolio to track.
3. Before any trading: a brokerage with an API and paper trading (e.g. Alpaca), plus written limits.
