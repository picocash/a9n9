#!/usr/bin/env bash
# From .101: upload infographics/*.png to Ghost and record slug -> url in infographics/urls.json (merged).
set -euo pipefail
cd "$(dirname "$0")/.."
files=("$@"); [ ${#files[@]} -gt 0 ] || files=(infographics/*.png)
ssh -n genxlinked 'rm -rf /tmp/gxl-ig && mkdir -p /tmp/gxl-ig'
scp -q scripts/ghost-upload.mjs "${files[@]}" genxlinked:/tmp/gxl-ig/
new=$(ssh -n genxlinked 'set -a; . ~/genxlinked/secrets/ghost-admin.env; set +a; docker exec ghost rm -rf /tmp/gxl-ig >/dev/null 2>&1; docker cp /tmp/gxl-ig ghost:/tmp/gxl-ig >/dev/null; docker exec -e GHOST_ADMIN_KEY ghost sh -c "node /tmp/gxl-ig/ghost-upload.mjs /tmp/gxl-ig/*.png"')
node -e 'const fs=require("fs");const f="infographics/urls.json";const a=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};Object.assign(a,JSON.parse(process.argv[1]));fs.writeFileSync(f,JSON.stringify(a,null,1));console.log(Object.keys(a).length,"urls")' "$new"
