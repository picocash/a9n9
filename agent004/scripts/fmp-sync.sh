#!/usr/bin/env bash
# Host cron on VM 107 (every 15 min): copy the latest outputs of Arun's FMP market monitors (~/Financial-Modeling-Prep-MCP-Server,
# host crontab) into agent004's writable state, so the agent can read them at /agent/state/fmp without mounting the whole folder.
# Small files only: latest market conditions + daily summary, the newest summary text, the alert files, MSTR bitcoin purchases.
set -eu
SRC="$HOME/Financial-Modeling-Prep-MCP-Server/outputs"; DST="$HOME/a9n9/agent004/state/fmp"
mkdir -p "$DST/alerts"
cp -p "$SRC/market-conditions/latest_market_conditions.json" "$SRC/market-conditions/latest_daily_summary.json" "$DST/" 2>/dev/null || true
t=$(ls -t "$SRC"/market-conditions/daily_market_summary_*.txt 2>/dev/null | head -1 || true); [ -n "$t" ] && cp -p "$t" "$DST/daily_summary.txt"
cp -p "$SRC/mstr_bitcoin_purchases.json" "$DST/" 2>/dev/null || true
find "$SRC/alerts" -maxdepth 1 -name '*.json' -size -600k -exec cp -p {} "$DST/alerts/" \;
date -u +%FT%TZ > "$DST/synced_at"
