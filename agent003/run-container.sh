#!/usr/bin/env bash
# (Re)create agent003's Hermes container on VM 105 (genxlinked). It joins genxlinked_default to reach the publishing desk
# (gxl-desk:2380); no ports are published. One Anthropic login lives in hermes/ (Arun's setup-token); never run two copies.
set -euo pipefail
ROOT="${AGENT003_ROOT:-$HOME/a9n9/agent003}"; IMAGE="${HERMES_IMAGE:-hermes-agent:v0.22.5}"; NAME=a9n9-agent003
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then docker stop -t 60 "$NAME" >/dev/null; docker rm "$NAME" >/dev/null; fi
docker run -d --name "$NAME" --restart unless-stopped --memory 3g --memory-swap 6g --network genxlinked_default \
  -e HERMES_UID="$(id -u)" -e HERMES_GID="$(id -g)" -e AGENT_HOME=/agent \
  -v "$ROOT/hermes:/opt/data" -v "$ROOT:/agent:ro" -v "$ROOT/state:/agent/state" \
  "$IMAGE" gateway run
