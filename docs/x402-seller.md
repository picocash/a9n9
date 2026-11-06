# x402 seller: tools.a9n9.net on Base (play 3)

Live since 2026-11-06. Every tool route except video answers an unpaid POST with one 402 that carries both the x402 v2 `PAYMENT-REQUIRED` header (USDC on Base, `exact` scheme) and the MPP/picocash challenge; the paid retry is routed by its header. Design and sources: `docs/research/2026-11-05/10-x402-seller-setup.md`.

| Item | Value |
|---|---|
| Network | `eip155:8453` (Base mainnet); rehearsal on `eip155:84532` passed 2026-11-06 (tx 0x212d8dd4…, settled in 1.7 s, resource delivered, ledger row written) |
| Asset | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| payTo | agent001's wallet `0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832` (income is the agent's, on-chain; no platform split) |
| Facilitator | Coinbase CDP, `api.cdp.coinbase.com/platform/v2/x402`; key in `~/a9n9/secrets/cdp.env`, read by the tools container only; first 1,000 settlements a month free, then $0.001 each |
| Prices | catalog prices: reserves $0.02, exa/search/tavily $0.01, web-search $0.008, image $0.03 |
| Code | `services/tools/src/x402.ts` (routes, Bazaar declarations), `cdp-auth.ts` (EdDSA JWT), `app.ts` (merged 402, protocol switch, ledger), buyer `services/tools/scripts/x402-buy.mjs` |
| Ledger | each settlement → inbox `money.income` with `rail: x402` (public at agent001.a9n9.net/ledger.json); `tools.call` carries `rail`; `settle.mjs` ignores non-Stripe rails |
| Discovery | `GET /.well-known/x402` lists the resources; `POST api.cdp.coinbase.com/platform/v2/x402/validate` says `valid: true`, simulation accepted |

## First mainnet sales (2026-11-06 18:06Z)

Arun funded the agent wallet; the agent wallet sent 0.25 USDC to the test buyer (`0x376Cd793B06569F65e5ABf9949d3A3DBBB567b55`, tx 0xce82c4ea…), and the buyer paid one call on each sellable route: reserves (tx 0x80dc0211…, 2.1 s end to end), exa, search, tavily, image. All five settled through the CDP facilitator on `eip155:8453`; five `x402:income` rows in the ledger ($0.07). The Bazaar listed `/v1/reserves` within a minute of its settlement (`discovery/merchant?payTo=…` total 1) and Agentic.Market picked it up as `tools-a9n9-net`; the other four routes settled at 18:07-18:08Z and should follow. The two `x402:income` rows from 16:44Z and 16:53Z are the Base Sepolia rehearsal (`network: eip155:84532`), not income.

`/v1/web-search` was advertised but answers 503 (no Brave key on this deployment): since this day `sellable()` in `x402.ts` drops any tool whose vendor key is missing from the x402 routes and `/.well-known/x402`, so a broken route can never be listed (test in `test/x402.test.ts`). The `x402.stats` counter in `/v1/info` is per process and resets on deploy; the ledger is the book of record.

## Operating

- **A settlement lists a route.** One paid call settled through the CDP facilitator puts that route in the CDP Bazaar (observed: under a minute) and from there in Agentic.Market. Manual buy: `cd services/tools && set -a && . ~/a9n9/secrets/x402-buyer.env && set +a && node scripts/x402-buy.mjs /v1/reserves '{"symbol":"pathUSD"}'`.
- **Stay listed.** No settlement for 30 days removes a resource, and each route is listed on its own first settlement. Host cron `30 9 1,15 * *` runs `services/tools/scripts/x402-keepalive.mjs` (log `~/a9n9/agent001/state/x402-keepalive.log`): tops the test buyer up with 0.25 USDC from the agent wallet when it holds under $0.10, then buys one call on every route in `/.well-known/x402` (about $0.07 a round, paid back to the agent wallet minus nothing; the vendor calls cost their usual cents). `--dry-run` prints balances and the route list.
- **Check the listing.** `GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832` (public) and `https://api.agentic.market/v1/services/search?q=a9n9`.
- **Failures.** A `PAYMENT-RESPONSE` with `success:false` is logged and written to the ledger as `x402.settlement-failed` (`settlement_pending` with a tx hash means broadcast but unconfirmed: reconcile by hash, never re-request payment). A vendor 502 is never settled. Facilitator outage fails closed (502 to the buyer).
- **Switching networks.** `X402_NETWORK` in `~/a9n9/docker-compose.yml` (tools service), then `docker compose up -d tools`.
- **Lesson (2026-11-06).** mppx binds a challenge's `opaque` to the route that issued it. Both rails are issued and verified inside the route handler (`app.post`), never from a catch-all middleware, or the MPP retry fails with "credential opaque does not match this route's requirements".
- **Not done yet.** Replay guard across the verify→handler→settle gap (two concurrent requests with one signature could both run the handler; the second settle reverts on-chain); a Postgres table of payments (the inbox ledger is the book of record for now); x402scan registration; the MPP services directory PR.
