#!/bin/sh
# treasury — the operator's picocash wallet (member "a9n9" in wallet-peers.json; board notes go to claude).
#   scripts/treasury.sh balance | collect | pay <member> <usd> '<what for>' | history
# Refill from testnet: in picocash/packages/mint, `npx tsx scripts/fund-token.ts <usd>` prints tokens; each goes to
# `picocash-wallet receive` with the treasury env (see the script header there). The key and wallet file are in ~/a9n9.
exec env BOARD_ENV="$HOME/a9n9/secrets/board-claude.env" WALLET_KEY_ENV="$HOME/a9n9/secrets/treasury-picocash.env" WALLET_STATE="$HOME/a9n9/treasury" node "$(dirname "$0")/../agent/bin/wallet" "$@"
