#!/usr/bin/env bash
# judge-remote: agent002's quality gate when the agent lives on another machine (crontab on the operator box, every 2 minutes).
# The judge's key stays here. Drafts the agent queued are pulled from its machine (and removed there), scored locally by
# judge-run.mjs against a staging folder, and the verdicts, the status file and the verdict log are pushed back.
set -euo pipefail
HOST="${AGENT002_HOST:-beatthechefs}"; REMOTE="${AGENT002_REMOTE_ROOT:-a9n9/agent002}"
STAGE="${AGENT002_JUDGE_STAGE:-$HOME/a9n9/agent002-judge}"; NODE="${NODE:-node}"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=8"
mkdir -p "$STAGE/state/judge/inbox" "$STAGE/judge/results"
exec 9>"$STAGE/.lock"; flock -n 9 || exit 0
rsync -a --remove-source-files --include='*.json' --exclude='*' -e "$SSH" "$HOST:$REMOTE/state/judge/inbox/" "$STAGE/state/judge/inbox/" 2>/dev/null || true   # no inbox yet = nothing queued
cd "$(dirname "$0")/.." && AGENT_ROOT="$STAGE" "$NODE" scripts/judge-run.mjs
rsync -a -e "$SSH" "$STAGE/judge/" "$HOST:$REMOTE/judge/"
[ -f "$STAGE/state/judge.jsonl" ] && rsync -a -e "$SSH" "$STAGE/state/judge.jsonl" "$HOST:$REMOTE/state/judge.jsonl"
exit 0
