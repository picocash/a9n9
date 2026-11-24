#!/usr/bin/env bash
# One-time setup of agent004's candidate pipeline inside its container (idempotent). Run on VM 107:
#   docker exec -u hermes a9n9-agent004 sh /agent/scripts/desk-setup.sh
# Creates the three Hermes profiles (evidence, narrative, analyst) with their role files, limits their toolsets, lets them use the
# ONE Claude login already in /opt/data/.claude (symlinks, never a copy: token refreshes stay in one file), and makes the kanban
# board `desk`. Kanban workers run with HOME=<profile>/home, so the login must be reachable there too; that includes the default
# profile's own workers (/opt/data/home/.claude).
set -eu
cd /opt/data
ln -sfn /opt/data/.claude /opt/data/home/.claude
for p in evidence narrative analyst; do
  d=/opt/data/profiles/$p
  [ -d "$d" ] || hermes profile create "$p" --clone --no-alias >/dev/null
  cp /agent/profiles/$p/SOUL.md "$d/SOUL.md"
  cp -p /opt/data/auth.json "$d/auth.json"            # pool entry only: no token inside
  ln -sfn /opt/data/.claude "$d/.claude"; ln -sfn /opt/data/.claude "$d/home/.claude"
  for s in finance-analyst portfolio-desk desk-pipeline agent004-mail a9n9-board a9n9-parallel; do rm -rf "$d/skills/autonomous-ai-agents/$s"; done
done
hermes profile describe evidence "Fact collector: records dated, sourced facts about one stock candidate from market data and SEC filings. No opinions." >/dev/null
hermes profile describe narrative "Claim tracer: finds what is being said about one stock candidate, the origin of the claim, and independent sources versus repeats." >/dev/null
hermes profile describe analyst "View writer: turns the recorded evidence and narrative for one candidate into a testable view in a fixed format." >/dev/null
OFF="browser code_execution vision image_gen tts memory session_search connections clarify delegation cronjob computer_use"
hermes -p evidence tools disable web $OFF >/dev/null; hermes -p analyst tools disable web $OFF >/dev/null; hermes -p narrative tools disable $OFF >/dev/null
hermes kanban boards list 2>/dev/null | grep -q ' desk ' || hermes kanban boards create desk >/dev/null
hermes config set kanban.max_in_progress 2 >/dev/null   # one login: at most two stages at a time
hermes profile list
