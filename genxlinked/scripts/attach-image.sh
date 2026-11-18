#!/usr/bin/env bash
# From .101: attach an image file as a DRAFT post's feature image. Usage: attach-image.sh <slug> <local.jpg> "<alt text>"
set -euo pipefail
cd "$(dirname "$0")"
slug=$1 img=$2 alt=${3:-}
scp -q ghost-image.mjs genxlinked:/tmp/ghost-image.mjs
scp -q "$img" "genxlinked:/tmp/feat-$slug.jpg"
ssh -n genxlinked "set -a; . ~/genxlinked/secrets/ghost-admin.env; set +a; docker cp /tmp/ghost-image.mjs ghost:/tmp/ghost-image.mjs >/dev/null; docker cp /tmp/feat-$slug.jpg ghost:/tmp/feat-$slug.jpg >/dev/null; docker exec -e GHOST_ADMIN_KEY ghost node /tmp/ghost-image.mjs '$slug' /tmp/feat-$slug.jpg $(printf %q "$alt"); rm -f /tmp/feat-$slug.jpg"
