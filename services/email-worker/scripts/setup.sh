#!/usr/bin/env bash
# One-time Cloudflare setup for the a9n9 Email Worker. Idempotent where the API allows.
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment
# (set -a; . ~/a9n9/secrets/cloudflare.env; set +a) and a verified forward address.
#   scripts/setup.sh <zone> <agent-address> <forward-to> <inbox-webhook-url>
#   scripts/setup.sh a9n9.net agent001@a9n9.net arun@example.com https://inbox.a9n9.net/hooks/email
set -euo pipefail
ZONE=${1:?zone}; AGENT=${2:?agent address}; FORWARD=${3:?forward-to address}; WEBHOOK=${4:?inbox webhook url}
cd "$(dirname "$0")/.."
W="npx wrangler"

echo "== who am I"; $W whoami | grep -E "Account|Token" || true

echo "== email routing on $ZONE (adds MX/SPF; the zone must have no other MX)"
$W email routing enable "$ZONE" || echo "(already enabled or needs dashboard)"
$W email routing dns get "$ZONE" || true

echo "== destination address $FORWARD (Cloudflare mails a verification link; click it)"
$W email routing addresses create "$FORWARD" || echo "(already exists)"

echo "== email sending on $ZONE (adds DKIM/SPF for cf-bounce)"
$W email sending enable "$ZONE" || echo "(already enabled or needs dashboard)"
$W email sending dns get "$ZONE" || true

echo "== storage"
$W r2 bucket create a9n9-mail || echo "(bucket exists)"
if ! grep -q 'database_id = "[0-9a-f-]\{36\}"' wrangler.toml; then
  OUT=$($W d1 create a9n9-mail 2>&1 || true); echo "$OUT" | tail -3
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [ -n "$ID" ] && sed -i "s/database_id = \"local-dev-database\"/database_id = \"$ID\"/" wrangler.toml && echo "d1 id $ID written to wrangler.toml"
fi
$W d1 migrations apply a9n9-mail --remote

echo "== vars + secrets"
sed -i "s#^FORWARD_TO = .*#FORWARD_TO = \"$FORWARD\"#; s#^INBOX_WEBHOOK_URL = .*#INBOX_WEBHOOK_URL = \"$WEBHOOK\"#" wrangler.toml
: "${INBOX_WEBHOOK_SECRET:?set from ~/a9n9/secrets/inbox.env}"; : "${EMAIL_API_TOKEN:?set from ~/a9n9/secrets/email.env}"
printf '%s' "$INBOX_WEBHOOK_SECRET" | $W secret put INBOX_WEBHOOK_SECRET
printf '%s' "$EMAIL_API_TOKEN" | $W secret put API_TOKEN

echo "== deploy"
$W deploy

echo "== routing rule: $AGENT -> worker a9n9-email"
$W email routing rules create "$ZONE" --name "$AGENT to a9n9-email" --matchers "to=$AGENT" --actions "worker=a9n9-email" || echo "(rule exists? check: npx wrangler email routing rules list $ZONE)"
echo "== done. Test: send a mail to $AGENT; then curl -H 'Authorization: Bearer \$EMAIL_API_TOKEN' https://<worker-url>/v1/mail"
