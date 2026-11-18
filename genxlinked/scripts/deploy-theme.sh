#!/usr/bin/env bash
# Build + deploy the GenX Linked theme to prod Ghost (VM 105). CSS/JS get content-hashed file names so Cloudflare's
# year-long asset cache can never serve a stale copy (Ghost's ?v= hash does not always change between uploads).
set -euo pipefail
cd "$(dirname "$0")/.."
B=$(mktemp -d); cp -r theme/genxlinked "$B/genxlinked"; T="$B/genxlinked"
css=$(md5sum "$T/assets/css/genxlinked.css" | cut -c1-10); js=$(md5sum "$T/assets/js/gxl.js" | cut -c1-10)
mv "$T/assets/css/genxlinked.css" "$T/assets/css/gxl-$css.css"; mv "$T/assets/js/gxl.js" "$T/assets/js/gxl-$js.js"
sed -i "s#{{asset \"css/genxlinked.css\"}}#{{asset \"css/gxl-$css.css\"}}#; s#{{asset \"js/gxl.js\"}}#{{asset \"js/gxl-$js.js\"}}#" "$T/default.hbs"
grep -q "gxl-$css.css" "$T/default.hbs" && grep -q "gxl-$js.js" "$T/default.hbs"
(cd "$T" && zip -qr ../genxlinked.zip .)
scp -q "$B/genxlinked.zip" scripts/ghost-site.mjs genxlinked:/tmp/
ssh -n genxlinked 'set -a; . ~/genxlinked/secrets/ghost-admin.env; set +a; docker cp /tmp/ghost-site.mjs ghost:/tmp/ >/dev/null; docker cp /tmp/genxlinked.zip ghost:/tmp/ >/dev/null; docker exec -e GHOST_ADMIN_KEY ghost node /tmp/ghost-site.mjs /tmp/genxlinked.zip' | grep -E "themes"
rm -rf "$B"; echo "deployed css gxl-$css.css js gxl-$js.js"
