#!/bin/bash
# deploy agent002's kit to ~/a9n9/agent002 (the container mounts it at /agent, read-only, with state/ writable).
set -euo pipefail
SRC=$(cd "$(dirname "$0")/.." && pwd); REPO=$(cd "$SRC/.." && pwd); DST=${AGENT002_ROOT:-$HOME/a9n9/agent002}
mkdir -p "$DST/bin" "$DST/state" "$DST/hermes" "$DST/secrets" "$DST/node_modules"
cp "$SRC"/bin/* "$DST/bin/"; cp "$REPO/agent/bin/_affiliate.mjs" "$DST/bin/"; chmod +x "$DST"/bin/[a-z]*
cp "$SRC/SOUL.md" "$DST/SOUL.md"; cp "$REPO/agent/affiliates.json" "$DST/affiliates.json"
printf '{"type":"module"}\n' > "$DST/package.json"
for m in nostr-tools @noble @scure; do rm -rf "$DST/node_modules/$m"; cp -r "$REPO/node_modules/$m" "$DST/node_modules/"; done
install -m 600 "$HOME/a9n9/secrets/agent002-nostr.env" "$DST/secrets/nostr.env"
echo "deployed to $DST"
