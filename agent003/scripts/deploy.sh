#!/bin/bash
# deploy agent003's kit to ~/a9n9/agent003 (the container will mount it at /agent read-only, with state/ writable; site/ and
# judge/ are written only by host scripts and served by the a9n9-agent003-site nginx container on :8900).
set -euo pipefail
SRC=$(cd "$(dirname "$0")/.." && pwd); DST=${AGENT_ROOT:-$HOME/a9n9/agent003}
mkdir -p "$DST/bin" "$DST/state" "$DST/hermes" "$DST/secrets" "$DST/site" "$DST/judge/results"
cp "$SRC"/bin/* "$DST/bin/"; chmod +x "$DST"/bin/[a-z]*
cp "$SRC/SOUL.md" "$DST/SOUL.md"; printf '{"type":"module"}\n' > "$DST/package.json"
for f in "$SRC"/site/*; do b=$(basename "$f"); [ "$b" = index.html ] && [ -f "$DST/site/index.html" ] && continue; [ "$b" = sitemap.xml ] && [ -f "$DST/site/sitemap.xml" ] && continue; cp "$f" "$DST/site/"; done
[ -f "$HOME/a9n9/secrets/agent003-travelpayouts.env" ] && install -m 600 "$HOME/a9n9/secrets/agent003-travelpayouts.env" "$DST/secrets/travelpayouts.env"
echo "deployed to $DST"
