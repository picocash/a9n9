#!/usr/bin/env bash
# From .101: push drafts to Ghost on VM 105 as DRAFTS (never published). Usage: push-drafts.sh drafts/0*.md
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/ghost-payload.mjs "$@" > /tmp/genxlinked-payload.$$.json
scp -q scripts/ghost-push.mjs genxlinked:/tmp/ghost-push.mjs
ssh genxlinked 'set -a; . ~/genxlinked/secrets/ghost-admin.env; set +a; docker cp /tmp/ghost-push.mjs ghost:/tmp/ghost-push.mjs >/dev/null; docker exec -i -e GHOST_ADMIN_KEY ghost node /tmp/ghost-push.mjs' < /tmp/genxlinked-payload.$$.json
rm -f /tmp/genxlinked-payload.$$.json
# keep the vote counter's allow-list in step with the polls in the drafts
node scripts/poll-ids.mjs >/dev/null && scp -q poll/allowed.json genxlinked:genxlinked/poll/ && ssh -n genxlinked "docker restart gxl-poll >/dev/null"
