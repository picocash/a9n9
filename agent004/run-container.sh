#!/usr/bin/env bash
# (Re)create agent004's Hermes container on VM 107 (agent004, 10.0.1.46). Default bridge network, no published ports.
# One LLM login lives in hermes/ (Arun's setup-token); never run two copies.
set -euo pipefail
ROOT="${AGENT004_ROOT:-$HOME/a9n9/agent004}"; IMAGE="${HERMES_IMAGE:-hermes-agent:v0.22.5}"; NAME=a9n9-agent004
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then docker stop -t 60 "$NAME" >/dev/null; docker rm "$NAME" >/dev/null; fi
docker run -d --name "$NAME" --restart unless-stopped --memory 8g --memory-swap 12g --cpus 6 \
  -e HERMES_UID="$(id -u)" -e HERMES_GID="$(id -g)" -e AGENT_HOME=/agent \
  -v "$ROOT/hermes:/opt/data" -v "$ROOT:/agent:ro" -v "$ROOT/state:/agent/state" \
  "$IMAGE" gateway run
