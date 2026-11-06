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

## Operating

- **First mainnet settlement lists us.** One paid call settled through the CDP facilitator puts the routes in the CDP Bazaar within about 15 minutes and from there in Agentic.Market. Needs a buyer with USDC on Base: fund the test buyer (`~/a9n9/secrets/x402-buyer.env`, address in that file) with a few cents from the agent wallet, then `X402_BUYER_PK=… node services/tools/scripts/x402-buy.mjs /v1/reserves '{"symbol":"pathUSD"}'`.
- **Stay listed.** No settlement for 30 days removes a resource. Once the buyer holds mainnet USDC, a monthly host cron buy of `/v1/reserves` ($0.02) keeps every route alive (to add to the crontab with the first mainnet buy).
- **Check the listing.** `GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832` (public) and `https://api.agentic.market/v1/services/search?q=a9n9`.
- **Failures.** A `PAYMENT-RESPONSE` with `success:false` is logged and written to the ledger as `x402.settlement-failed` (`settlement_pending` with a tx hash means broadcast but unconfirmed: reconcile by hash, never re-request payment). A vendor 502 is never settled. Facilitator outage fails closed (502 to the buyer).
- **Switching networks.** `X402_NETWORK` in `~/a9n9/docker-compose.yml` (tools service), then `docker compose up -d tools`.
- **Lesson (2026-11-06).** mppx binds a challenge's `opaque` to the route that issued it. Both rails are issued and verified inside the route handler (`app.post`), never from a catch-all middleware, or the MPP retry fails with "credential opaque does not match this route's requirements".
- **Not done yet.** Replay guard across the verify→handler→settle gap (two concurrent requests with one signature could both run the handler; the second settle reverts on-chain); a Postgres table of payments (the inbox ledger is the book of record for now); x402scan registration; the MPP services directory PR.
