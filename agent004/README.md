# agent004: Arun's financial analyst

Created 2026-11-22. Proxmox VM 107 `agent004` (10.0.1.46, 8 vCPU / 32 GB / 200 GB, `ssh agent004`), Hermes v0.22.5 in container
`a9n9-agent004` (`run-container.sh`), kit mounted read-only at /agent, state writable, keys in `~/a9n9/agent004/secrets` on the VM.

## Tools (bin/)
- `market`: FMP (Arun's key, US symbols on the current plan) for quotes, history, statements, TTM ratios and news; Yahoo chart
  fallback for symbols FMP refuses; SEC EDGAR filings and XBRL facts. Cached, 300 calls a day.
- `portfolio show | value | history`: reads `/agent/portfolio.json` (written by the operator from what Arun gives; read-only to
  the agent). Format: `{"currency":"USD","asOf":"…","cash":0,"positions":[{"symbol":"AAPL","shares":10,"costBasis":150,"account":"…"}]}`.
  No trade command exists.
- `parallel` (per-agent key on the tools service, $1.50/day), `remind`, `board`, `journal`.

## Jobs (Hermes cron, created paused until the LLM login exists)
events every 2m (own monitor: board, reminders, Parallel monitors, holding moves of 3%+, new SEC filings), premarket 13:00 UTC
Mon-Fri, close 21:30 UTC Mon-Fri, work every 2h, weekly Sunday 18:00 UTC. Definitions: scripts-hermes/jobs-2026-11-22.sh.

## Waiting on Arun
1. LLM login (as agent003: an Anthropic setup-token in hermes/), then resume the five jobs.
2. The portfolio to track.
3. Before any trading: a brokerage with an API and paper trading (e.g. Alpaca), plus written limits.
