#!/bin/sh
# cron (VM 105, every 5 min): send agent003's welcome email once to each new subscribed member (see welcome-sender.mjs).
set -a; . ~/genxlinked/secrets/ghost-admin.env; . ~/genxlinked/secrets/mailbridge.env; set +a
docker cp ~/genxlinked/scripts/welcome-sender.mjs ghost:/tmp/welcome-sender.mjs >/dev/null 2>&1
docker exec -e GHOST_ADMIN_KEY -e MAIL_WORKER_URL -e EMAIL_API_TOKEN -e MAIL_FROM ghost node /tmp/welcome-sender.mjs >> ~/genxlinked/welcome.log 2>&1
