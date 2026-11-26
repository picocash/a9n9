# agent004: Arun's financial analyst

Created 2026-11-22. Proxmox VM 107 `agent004` (10.0.1.46, 8 vCPU / 32 GB / 200 GB, `ssh agent004`), Hermes v0.22.5 in container
`a9n9-agent004` (`run-container.sh`), kit mounted read-only at /agent, state writable, keys in `~/a9n9/agent004/secrets` on the VM.

## Tools (bin/)
- `market`: FMP (Arun's key, US symbols on the current plan) for quotes, history, statements, TTM ratios and news; Yahoo chart
  fallback for symbols FMP refuses; SEC EDGAR filings and XBRL facts. Cached, 300 calls a day.
- `portfolio show | value | history | set | remove | cash`: holdings in `/agent/state/portfolio.json` (falls back to the operator's
  `/agent/portfolio.json`). The agent records holdings only when Arun himself gives them (Buzz/mail, `--from` required); every
  change is logged in `state/portfolio-changes.jsonl`. Skill `portfolio-desk` (2026-11-24) covers prices, holdings and the monitors. Format: `{"currency":"USD","asOf":"…","cash":0,"positions":[{"symbol":"AAPL","shares":10,"costBasis":150,"account":"…"}]}`.
  No trade command exists.
- `mail list | read | reply | done`: agent004@a9n9.net (routing rule → a9n9-email Worker, key in AGENT_MAIL_KEYS; reply-only, 20/day).
- `drip` (2026-11-26): Drip (dripstack.com) opinion feed, read-only: analyst calls per day and per ticker, post cards, writer
  track records, 13F fund moves. Arun's account agent004@a9n9.net, Personal plan (7-day trial from 11-26, then $32/month, his
  card; he cancels on 12-02 unless agent004's 12-01 verdict shows value). Key in `secrets/drip.env` (operator copy on .101 in
  `~/a9n9/secrets/agent004-drip.env`). No unlock/buy command; article credits stay at 0. 350 calls a day. Skill `a9n9-drip`.
- `parallel` (per-agent key on the tools service, $1.50/day), `remind`, `board`, `journal`.

- `alerts add|list|remove` (state/price-alerts.json, checked by signal.mjs every 10 min in market hours → `price-alert` wake line) and
  `team send|read` (Buzz #team with agent004's own key). 2026-11-24: ANT below 78 and SPCX below 120 set for Arun.

## Candidate pipeline (2026-11-24)
Six stages per candidate; three are code, three are Hermes profiles (sub-agents) on the kanban board `desk`:
Scout (code, in `scripts-hermes/signal.mjs`: moves, material filings, price alerts become leads; repeats collapse) -> `evidence`
and `narrative` profiles -> `analyst` profile -> risk engine (code, `pipeline risk`, limits in `desk/risk.json`, read-only to the
agent, versioned, paper mode only) -> agent004 reports to Arun on Buzz. The journal (`state/desk/journal.jsonl`, append-only)
records every step, refusal and rejection; raw tool answers are kept in `state/desk/raw/<cid>/`.
- Tool: `bin/pipeline` (+ `bin/_desk.mjs`). Each profile can record only its own stage (checked by HERMES_PROFILE); the analyst's
  supporting points must reference recorded observations. Role files: `profiles/<name>/SOUL.md`. Orchestrator skill: `desk-pipeline`.
- Setup (profiles, toolsets, shared login symlinks, board): `scripts/desk-setup.sh`, run inside the container. Profiles live in
  `hermes/profiles/` on the VM. All profiles use the ONE Claude login via symlinks; `kanban.max_in_progress: 2`.
- First run: c1124-ANT-1 (ANT below Arun's $78 alert), 30 observations, origin traced to Reuters, bearish "watch", risk PASS, reported on Buzz.
- Known limits: profiles share one container and user, so "only its tools" is toolset config + role file + the stage check, not a
  sandbox. No trading tool exists; a PASS records an intended paper order only. `paperCapitalUsd` (100000) sizes orders until a portfolio is on file.

## Jobs (Hermes cron; resumed 2026-11-24 after Arun's model login)
events every 2m (own monitor: board, reminders, Parallel monitors, holding moves of 3%+, new SEC filings), premarket 13:00 UTC
Mon-Fri, close 21:30 UTC Mon-Fri, work every 2h, weekly Sunday 18:00 UTC. Definitions: scripts-hermes/jobs-2026-11-22.sh.

## Market monitors moved here (2026-11-22)
Arun's Financial-Modeling-Prep-MCP-Server folder (FMP MCP server plus his market monitors) moved from the home box to the VM at
`/home/ubuntu/Financial-Modeling-Prep-MCP-Server` (old copy archived on the home box in ~/archive). Its cron jobs run on the
VM's host crontab, unchanged: market conditions every 15 min 9-16 Mon-Fri, daily summary 20:40 Mon-Fri, weekend summary Sat 10:00,
NAKA monitor every 15 min. The VM clock is America/New_York (as on the home box), so these are
Eastern times; the agent's container stays on UTC. Node 22.22.1 is in /usr/local on the VM. Not mounted into the agent: instead
`scripts/fmp-sync.sh` (host cron every 15 min) copies the latest outputs to `state/fmp/` (market conditions, daily summary, alert
files). MSTR monitor cron removed 2026-11-24 (Arun: no longer used). Logs rotate via `/etc/logrotate.d/fmp-monitors` (weekly or 20 MB, 4 gzipped copies, copytruncate).

## Desktop for Arun (2026-11-22)
**CURRENT STATE (2026-11-25, evening): the VM is on Ubuntu 26.04.1 and the remote desktop is GNOME's own RDP server, set up like the .101 box.** Everything below this paragraph about xrdp, XFCE and lightdm is history.
- Arun asked for the OS upgrade after GNOME over xrdp lagged. `do-release-upgrade` 24.04 -> 26.04.1, no errors; backup of `~/a9n9/agent004` taken first to .101 `~/a9n9/backups/agent004-pre-2604-20261125.tar.gz`.
- Remote desktop: gdm3 + `gnome-remote-desktop` in system mode (`grdctl --system`, TLS files in `/etc/gnome-remote-desktop/`), port 3389, LAN only (ufw). xrdp and lightdm are disabled. Login: `sdl-freerdp /v:10.0.1.46 /u:ubuntu /cert:tofu /dynamic-resolution +clipboard`, then it shows a login screen: pick Ubuntu and type the account password. **Two separate passwords since 11-25:** the RDP connection password (set with `sudo grdctl --system rdp set-credentials`, takes effect only after `systemctl restart gnome-remote-desktop`; Arun kept the original one) and the `ubuntu` account password (Arun changed it 11-25; that new one is what `~/a9n9/secrets/agent004-rdp.txt` on .101 now holds). Claude must not change either.
- `desktop/gnome-remote-desktop-after-gdm.conf` (drop-in in `/etc/systemd/system/gnome-remote-desktop.service.d/`) starts the RDP server after gdm; without it the server sometimes starts too early at boot and never listens.
- **The agent's Chrome no longer lives in the desktop session.** In this kind of session a browser dies when the viewer disconnects. It now runs as the user service `agent004-chrome.service` (copy in `desktop/`, linger on for `ubuntu`) on its own virtual screen (Xvfb), from boot, no login needed, same profile, same port 9222, `--password-store=basic`. To look at what it is doing, open `chrome://inspect` in a browser on the VM desktop and add `127.0.0.1:9222`. Restart it with `systemctl --user restart agent004-chrome`.
- `/etc/netplan/99-keep-networkd.yaml` still pins the network to systemd-networkd.


**2026-11-25: switched to the Ubuntu GNOME desktop** (Arun asked). `ubuntu-desktop-minimal` installed; the xrdp session now starts GNOME through `~/.xsession` (`gnome-session --session=ubuntu`) and `~/.xsessionrc` (copies in `desktop/`); the XFCE line is kept in `~/.xsession.xfce-backup`. `desktop/45-xrdp-desktop.rules` (in `/etc/polkit-1/rules.d/`) stops the colour-profile password popups. The desktop packages make NetworkManager the netplan default, so `/etc/netplan/99-keep-networkd.yaml` pins `renderer: networkd`; do not remove it. Tested with a throwaway account over FreeRDP (GNOME shell came up), account deleted. The agent's Chrome autostarts from `~/.config/autostart` in GNOME too, but only once someone logs in over RDP after a reboot. Disconnect by closing the window, not by logging out.
First GNOME login hung behind a modal "keyring is locked" box (Chrome asking for the old keyring). Fixed the same day: `/etc/pam.d/xrdp-sesman` now has the two `pam_gnome_keyring.so` lines (auth + session auto_start) so the keyring opens with the RDP login password; the old keyring is in `~/.local/share/keyrings.bak-1125`; the first-run wizard, update notifier and release-upgrade prompt are switched off.

**Same day, later: back to XFCE for the remote session.** GNOME over xrdp 0.9 was laggy and froze on resize for Arun. Tried GNOME's own remote login (gdm + `grdctl --system`, as on the .101 box, which is Ubuntu 26.04): on 24.04 (GDM 46) the remote login screen only came up once; with a local login screen present the hand-off between login screen and session fails ("No connection waiting for handover"). Reverted fully: xrdp + lightdm + XFCE as on 11-22; gnome-remote-desktop system service disabled. GNOME stays installed (`~/.xsession.gnome` and `~/.xsessionrc.gnome` hold the GNOME session lines). Use a fixed `/size:` with FreeRDP, not `/dynamic-resolution`. A smooth GNOME remote desktop needs the VM on Ubuntu 26.04.
xrdp + XFCE on the VM, port 3389 open to 10.0.1.0/24 only (ufw). Log in as `ubuntu`; the password is in the home box's
`~/a9n9/secrets/agent004-rdp.txt` (SSH stays key-only). From a LAN machine: `sdl-freerdp3 /v:10.0.1.46 /u:ubuntu /cert:ignore /dynamic-resolution`.

## Waiting on Arun
1. LLM login (as agent003: an Anthropic setup-token in hermes/), then resume the five jobs.
2. The portfolio to track.
3. Before any trading: a brokerage with an API and paper trading (e.g. Alpaca), plus written limits.

## Browser (Chrome over CDP), 2026-11-22
- Chrome stable on the VM desktop, started by `~/bin/agent004-chrome` (copy in `desktop/`). It autostarts with the XFCE session and has a desktop icon. It uses its own profile in `~/.config/agent004-chrome`, never a personal one, with DevTools on 127.0.0.1:9222.
- `cdp-bridge.service` (socat, copy in `desktop/`) exposes it on 172.17.0.1:9222 for the container only. ufw allows 9222 in on docker0, and nothing from the LAN.
- In Hermes `config.yaml`: `browser.cdp_url: http://172.17.0.1:9222` and `restrict_evaluate: true`.
- Chrome lives in Arun's RDP session. If that session is logged out (not just disconnected), Chrome stops; log in again or run `~/bin/agent004-chrome`.
- Anything signed in inside this profile is usable by agent004. Sign in only to what it should use.
