#!/usr/bin/env bash
# run-container: (re)create agent002's Hermes container on the machine that hosts it (VM 104 on the R640 since 2026-11-13).
# Same settings the container has always had; no ports are published (it needs none, and published ports bypass ufw).
# Never run it on two machines at once: the Nous login in hermes/auth.json must have one live holder.
set -euo pipefail
ROOT="${AGENT002_ROOT:-$HOME/a9n9/agent002}"
IMAGE="${HERMES_IMAGE:-hermes-agent:v0.22.5}"
NAME=a9n9-agent002
[ -f "$ROOT/hermes/auth.json" ] || { echo "no Hermes home at $ROOT/hermes"; exit 1; }
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then docker stop -t 60 "$NAME" >/dev/null; docker rm "$NAME" >/dev/null; fi
docker run -d --name "$NAME" --restart unless-stopped \
  --memory 3g --memory-swap 6g \
  -e HERMES_UID="$(id -u)" -e HERMES_GID="$(id -g)" -e AGENT_HOME=/agent \
  -v "$ROOT/hermes:/opt/data" \
  -v "$ROOT:/agent:ro" \
  -v "$ROOT/state:/agent/state" \
  "$IMAGE" gateway run
