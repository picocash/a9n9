# 10 — Selling a9n9 endpoints over x402 on Base (USDC): implementation note

Date: 2026-11-04. Scope: add x402 (v2) to `services/tools` paid routes (`POST /v1/exa`, `/v1/parallel`…, which today charge via MPP/picocash), receive USDC on Base mainnet, get listed in the Coinbase Bazaar / Agentic.Market, track buyers. `apps/reserves` is covered by the existing `/v1/reserves` tool route in `services/tools` (it already proxies `reserves.a9n9.net/v1/tokens` at $0.02) — do not bolt x402 onto the plain-`node:http` reserves server.

Legend: **[V]** verified by opening the primary source / running the check today; **[U]** unverified or inferred — treat as a claim to test. Sources are listed at the end; inline refs like [S3] point to that list.

---

## 0. TL;DR

- x402 is at **protocol v2** (`x402Version: 2`, shipped Dec 2025). The v1 packages (`x402`, `x402-hono`, `x402-fetch`, `@coinbase/x402`) are legacy; the live line is the scoped **`@x402/*` family, 2.30.0 as of today (2026-11-04)**, plus `@coinbase/cdp-sdk` 1.60.0 for the CDP facilitator client. [V]
- v2 wire: `402` + base64 JSON in **`PAYMENT-REQUIRED`** header; client retries with **`PAYMENT-SIGNATURE`**; server returns `200` + **`PAYMENT-RESPONSE`**. Networks are CAIP-2: Base = **`eip155:8453`**, Base Sepolia = **`eip155:84532`**. v1 `X-PAYMENT`/`"base"` is still parsed by the server SDK for backward compat. [V]
- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals, EIP-712 domain `name="USD Coin"`, `version="2"`. Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, `name="USDC"`, `version="2"`. (Both read live over RPC today.) `$0.01` ⇒ `amount: "10000"`. [V]
- Facilitator for mainnet: **CDP**, `https://api.cdp.coinbase.com/platform/v2/x402`; needs a CDP Secret API key for `/verify`, `/settle`, `/supported` (401 without); discovery endpoints are public. First 1,000 on-chain settlements per month free, then $0.001 each; only 2xx settles are billed; the facilitator pays gas. `x402.org/facilitator` is **testnets only** (no `eip155:8453`). [V]
- Bazaar listing = no form: declare `extensions.bazaar` on the route, settle **one real paid call through the CDP facilitator**, wait ≤15 min. Agentic.Market is fed from the Bazaar catalog (operated by Coinbase). Removal after 30 days without settlements. [V]
- Serving MPP and x402 on the **same path** is feasible: one 402 carrying both `PAYMENT-REQUIRED` and `WWW-Authenticate: Payment`; branch on the retry header. The MPP draft allows other headers/multiple challenges; x402 v2 keeps everything in its own headers and says the body is a server concern. Recommended; code below. [V spec-wise, U until tested]
- Seller KYC: none documented. The CDP facilitator OFAC/KYT-screens **both payer and payee** on every verify/settle; a CDP account is needed for the API key. Tax: ordinary crypto-property treatment per the one legal analysis found — not legal advice. [V for what docs say; U beyond]

---

## 1. Protocol: x402 v2 "exact" scheme on Base

### 1.1 Versions and headers [V — S1, S2, S3]

| | v1 (legacy) | **v2 (current)** |
|---|---|---|
| `x402Version` | `1` | `2` |
| Where requirements travel | 402 JSON **body** (`accepts[]`) | **`PAYMENT-REQUIRED`** response header (base64 JSON); body is "a server implementation concern" (SDK sends `{}` or your `unpaidResponseBody`) |
| Client payment header | `X-PAYMENT` | **`PAYMENT-SIGNATURE`** (base64 JSON `PaymentPayload`) |
| Settlement header | `X-PAYMENT-RESPONSE` | **`PAYMENT-RESPONSE`** (base64 JSON `{success, transaction, network, payer, errorReason?}`) |
| Network ids | `"base"`, `"base-sepolia"` | CAIP-2: `"eip155:8453"`, `"eip155:84532"` |
| Amount field | `maxAmountRequired` | `amount` |
| Resource metadata | `resource`, `description`, `mimeType`, `outputSchema` per accept | `resource: {url, description, mimeType}` once; discovery via `extensions.bazaar` |

`PaymentRequired` (v2) fields: `x402Version`, `error?`, `resource {url, description?, mimeType?}`, `accepts[] {scheme, network, amount, asset, payTo, maxTimeoutSeconds, extra?}`, `extensions?`. Reserved `extra` keys: `assetTransferMethod`, `paymentFlow`. `PaymentPayload`: `x402Version`, `resource?`, `accepted` (the chosen requirement), `payload` (scheme data), `extensions?`. Extensions are `{info, schema}` pairs; clients must echo at least the received `info`. [V — S1]

Example 402 as the CDP Bazaar sees them in the wild today (decoded from the public discovery feed) [V]:

```json
{"scheme":"exact","network":"eip155:8453","amount":"10000",
 "asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
 "extra":{"name":"USD Coin","version":"2"},
 "maxTimeoutSeconds":300,"payTo":"0xb3f4…194A"}
```

### 1.2 `exact` on EVM = EIP-3009 `transferWithAuthorization` [V — S2]

- Client signs an EIP-712 `TransferWithAuthorization` over the token's domain (`extra.name`/`extra.version`, chainId, verifyingContract = asset). Payload: `signature` + `authorization {from, to, value, validAfter, validBefore, nonce}`.
- `extra.assetTransferMethod` defaults to `"eip3009"`; Permit2 is the alternative for tokens without EIP-3009 (irrelevant for USDC).
- Facilitator verify: recover signer = `from`; balance ≥ value; window/amount meet requirements; token+network match; **simulate** the transfer. Settle: facilitator broadcasts `transferWithAuthorization` and **pays gas**; it "cannot modify the amount or destination". May return `settlement_pending` with the broadcast hash.
- In `@x402/evm@2.30.0` the client sets `validAfter: "0"`, `validBefore: now + maxTimeoutSeconds`, `nonce = createNonce()` (random 32 bytes). Server default `maxTimeoutSeconds` is **300** if you don't set one. [V — unpacked source]
- Flow (default `authorization` flow): client GET → 402 → client retries with signature → server `/verify` → **handler runs** → server `/settle` → 200 with `PAYMENT-RESPONSE`. (So the resource executes before settlement — see gotchas.) [V — S1]

### 1.3 Facilitator API shapes [V — S1]

- `POST /verify` `{x402Version, paymentPayload, paymentRequirements}` → `{isValid, invalidReason?, payer}`
- `POST /settle` same body → `{success, transaction, network, payer, errorReason?}` (+ optional `amount`, `extensions`)
- `GET /supported` → `{kinds[{x402Version, scheme, network, extra?}], extensions[], signers}`
- `GET /discovery/resources?type&payTo&scheme&network&extensions&limit&offset`, `GET /discovery/search?query=…` (Bazaar extension spec)

---

## 2. Facilitator options (as of 2026-11-04)

### 2.1 Coinbase CDP facilitator — use this for mainnet [V — S4, S5, S6, S7, probes]

- Base URL (hard-coded as `CDP_FACILITATOR_URL` in `@coinbase/cdp-sdk@1.60.0/_esm/x402/facilitator.js`): **`https://api.cdp.coinbase.com/platform/v2/x402`**.
- Auth: CDP **Secret API key** (`CDP_API_KEY_ID` + `CDP_API_KEY_SECRET`) → JWT bearer. Probed today: `GET …/supported` → **401** unauthenticated; `GET …/discovery/resources` → **200** public (catalog total today: **114,924** resources). Docs: "verify and settle require the key; discovery APIs need no key".
- Networks (v2): Base `eip155:8453`, Base Sepolia `eip155:84532`, Polygon, Arbitrum, Monad, World, World Sepolia (schemes `exact`, `upto`, `batch-settlement`); Solana mainnet/devnet. Any ERC-20 via EIP-3009 or Permit2.
- Pricing: **first 1,000 on-chain transactions per month free, then $0.001 each**; verification always free; only a `settle` returning 2xx is billable; failed/declined settles and discovery not billed; gas paid by facilitator (covered by the fee). Charging began Jan 2026 (first bill 2026-02-01) [V — S6 + news]. No minimum payment amount in the protocol; docs note a $0.001 endpoint nets nothing past the free tier.
- Compliance: every payment OFAC + KYT screened at verify and settle, **both payer and recipient**; a decline fails with `kyt_risk_detected` (buyer keeps funds, seller doesn't deliver).
- Creating the key [V — S8]: `https://portal.cdp.coinbase.com/api-keys/secret` → select project → "Secret API Keys" tab → Create → optional **IP allowlist** (put the tools box's egress IP), permission restrictions, algorithm **Ed25519** (recommended) → copy ID (UUID) and secret (base64, 64-byte Ed25519 seed+pub) straight into env. Whether a CDP project requires identity verification is not stated in the docs. [U]
- Also exposes `POST …/validate` (no key) that checks a public URL returns a 402 with a valid `extensions.bazaar` block (see §4).

### 2.2 `https://x402.org/facilitator` — testnets only [V — live `/supported` today]

Kinds: `eip155:84532` (exact/upto/batch-settlement), Solana devnet, Algorand/Aptos/Stellar/Hedera/XRPL testnets, plus v1 `base-sepolia`/`solana-devnet`. **No `eip155:8453`.** No auth. `/discovery/resources` → 404 (it keeps a separate, non-Bazaar catalog per CDP docs). Facilitator signer `0xd407e409E34E0b9afb99EcCeb609bDbcD5e7f1bf`. Good for the first local test; anything that must reach the Bazaar must go through CDP (testnet via CDP is indexed too).

### 2.3 Self-hosting / third parties

- `@x402/core` ships a `facilitator` module and the spec is open; a self-hosted facilitator needs a funded Base gas wallet, an RPC, `/verify` `/settle` `/supported`, and you lose Bazaar indexing + Coinbase's screening. The Braumiller legal note says a self-hosted facilitator that holds/routes third-party funds "would likely be treated as a money transmitter" — EIP-3009 facilitators never custody funds, but the analysis is thin. Not worth it at our volume. [V for the sources' statements; U as advice]
- Third-party hosted facilitators exist (PayAI claims 10,000 free settlements/month then $0.001; Heurist, xPay, etc.). Not opened in depth; only CDP settlements feed the Bazaar. [U]

---

## 3. Packages (npm registry, read today)

| Package | Latest | Published | Notes |
|---|---|---|---|
| `@x402/core` | **2.30.0** | 2026-11-04 | server/client/facilitator/http/types; dep `zod@^4` |
| `@x402/hono` | 2.30.0 | 2026-11-04 | peer **`hono >=4.13.7 <5`** (services/tools has `^4.6.14` — bump), peer `@x402/paywall` |
| `@x402/express`, `@x402/next` | 2.30.0 | 2026-11-04 | same API shape |
| `@x402/evm` | 2.30.0 | 2026-11-04 | `ExactEvmScheme` server/client; dep `viem@^2.48.11` |
| `@x402/extensions` | 2.30.0 | 2026-11-04 | `@x402/extensions/bazaar` (`declareDiscoveryExtension`), sign-in-with-x, payment-identifier |
| `@x402/fetch`, `@x402/axios` | 2.30.0 | 2026-11-04 | client wrappers |
| `@coinbase/cdp-sdk` | 1.60.0 | 2026-10-22 | `@coinbase/cdp-sdk/x402`: `createCdpFacilitatorClient`, `createX402Server`; peers `@x402/*@^2.25.0` |
| `@coinbase/x402` | 2.1.0 | 2025-12-23 | v1-era wrapper (README still shows `x402-express` + `"base-sepolia"`); **don't use** |
| `x402`, `x402-hono`, `x402-fetch` | 1.2.0 | 2026-04-16 | v1 line, maintenance only |

Release cadence is very fast (2.30.0 landed hours ago). Pin `~2.30.0` and keep all `@x402/*` on the same minor — `@x402/hono` depends on `@x402/core ~2.30.0`.

### 3.1 Server API [V — S9 README + unpacked typings]

```ts
paymentMiddleware(routes: RoutesConfig, server: x402ResourceServer,
                  paywallConfig?, paywall?, syncFacilitatorOnStart = true): MiddlewareHandler
```

`RoutesConfig = Record<"METHOD /path", RouteConfig>` (wildcards `*`, params `:id`/`[id]` supported). `RouteConfig` in 2.30.0:

```ts
interface PaymentOption { scheme: string; payTo: string | DynamicPayTo; price: Price | DynamicPrice;
                          network: Network; maxTimeoutSeconds?: number; extra?: Record<string, unknown>; }
interface RouteConfig {
  accepts: PaymentOption | PaymentOption[];
  resource?: string; description?: string; mimeType?: string;
  serviceName?: string; tags?: string[]; iconUrl?: string;     // Bazaar listing fields
  customPaywallHtml?: string;
  unpaidResponseBody?: (ctx) => { contentType; body };          // body of the 402 for API clients
  settlementFailedResponseBody?: (ctx, settleResult) => {...};
  extensions?: Record<string, unknown>;                         // ...declareDiscoveryExtension(...)
}
```

Price parsing: `"$0.01"` → `parseMoney` → `"0.01"` → `convertToTokenAmount(…, 6)` → `"10000"`; extra decimals beyond 6 are **truncated**, not rounded. Default asset for `eip155:8453` is USDC `0x8335…2913` (`USD Coin`/`2`), for `eip155:84532` `0x036C…CF7e` (`USDC`/`2`). Pass `price: { amount: "10000", asset: "0x…", extra: {...} }` for a non-default token. [V — unpacked `@x402/core`, `@x402/evm`]

Browser detection: `Accept: text/html` **and** UA contains `Mozilla` ⇒ HTML paywall instead of JSON; `curl` gets JSON. 402s carry `Cache-Control: no-store`. The server also reads a legacy `x-payment` header and handles `x402Version === 1` payloads. [V — unpacked]

### 3.2 Client API for tests [V — S10 README]

`wrapFetchWithPayment(fetch, x402Client)` with `new x402Client().register("eip155:*", new ExactEvmScheme(account))`, or `wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network, client }] })`; `decodePaymentResponseHeader(res.headers.get("PAYMENT-RESPONSE"))`. `paymentRequirementsSelector` picks among `accepts` (e.g. cheapest). Spend caps: `@x402/core` exports `PaymentPolicy`/`SpendControls`/`DEFAULT_MAX_AMOUNT_PER_PAYMENT` types — exact API not read; check `node_modules/@x402/core/dist/esm/client/index.d.mts` before relying on it. [U]

---

## 4. Bazaar and Agentic.Market

### 4.1 Mechanism [V — S11 get-discovered, S12 validate-endpoint, S13 bazaar spec, S14 bazaar README]

1. Route advertises `extensions.bazaar = {info: {input, output?}, schema}` in the 402. `declareDiscoveryExtension(...)` from `@x402/extensions/bazaar` builds it; the HTTP method is inferred from the route key (`"POST /v1/exa"`). For POST/PUT/PATCH: `bodyType: "json"|"form-data"|"text"` and an example `input` body are **required**; `inputSchema` (JSON Schema) and `output.example` are optional but drive ranking. Registering `bazaarResourceServerExtension` server-wide also fills in method from request context.
2. Client echoes the extension in `PaymentPayload.extensions.bazaar` (the `@x402/*` clients do); **no echo ⇒ no cataloging**.
3. **One successful paid call settled via the CDP facilitator** triggers indexing (≤15 min). Quality metrics recomputed every 6 h. Testnet resources are indexed too (useful to rehearse). `EXTENSION-RESPONSES` on verify/settle reports `bazaar.status ∈ {success, processing, rejected}` + `rejectedReason`.
4. Validate first (no key): `POST https://api.cdp.coinbase.com/platform/v2/x402/validate {"resource":"https://…/v1/exa","method":"POST"}` → `valid`, `simulation.outcome: "accepted"`, `preflight` (required + advisory), `bazaarExtension`.
5. Metadata rules: description < 500 chars, natural-language "what and when to call"; placeholder text scores 0; **no text that could instruct an agent** (screened before and after listing); icon via `iconUrl` (PNG/JPG/WebP/GIF, not SVG); bare-id path segments are collapsed into templates; shared tunnel domains (`ngrok.io`) rank lower — a9n9.net is fine.
6. Staying listed: updates propagate on the next successful payment; **no settlements for 30 days ⇒ removed**; failing health probes down-rank then drop from featured; stops returning 402 ⇒ removed; no delist API (to keep a route out, don't declare `bazaar` on it — the `@x402` packages only emit it for routes with the extension; CDP's `createX402Server` emits it for every route).
7. Ranking inputs: `quality.l30DaysTotalCalls`, `l30DaysUniquePayers`, `lastCalledAt`, completeness of description/schema/`serviceName`/`tags`. [V — live feed]
8. Check your listing: `GET …/x402/discovery/merchant?payTo=0x<our address>` (200, public), `…/discovery/search?query=…`, or `searchX402Resources`/`listX402DiscoveryMerchant` in `@coinbase/cdp-sdk`. Also the CDP SDK can run the catalog as "Bazaar MCP".

### 4.2 Agentic.Market [V — S15, S16 + API probe; U where noted]

- `https://agentic.market` — "operated by Coinbase", ~4,197 services in Inference/Data/Search/Media/Social/Trading/Infra/Storage/Travel; public API `GET https://api.agentic.market/v1/services` and `/v1/services/search?q=` (probed: returns `networks` as CAIP-2, per-endpoint `pricing`, `parameters`, `enriched: true`). No seller sign-up page exists; the CDP validate-endpoint page states "Agentic.market and the Bazaar list resources that pass screening and meet the other criteria", i.e. listing is derived from the Bazaar catalog. **Featured/curated tier is editorial**: live mainnet payments, ≥99% availability, agent-ready metadata.
- A third-party post claims Agentic.Market indexes automatically once the 402 has a valid Bazaar extension [U]. Treat "settle one mainnet call via CDP + pass validate" as the real requirement.
- Exa itself is listed first-party at `api.exa.ai/search` for ~$0.007 on Base; our `/v1/exa` at $0.01 competes as an aggregator route — the listing text should say what we add (normalised body, highlights, no key) or buyers will prefer first-party. [V observation]

### 4.3 x402scan [V — S17, S18]

Ecosystem explorer with per-server volume. Listing: submit at `https://www.x402scan.com/resources/register` ("Add API") — "Add Server" crawls `/openapi.json` (`x-payment-info` blocks) or `/.well-known/x402` (`{version, resources[]}`), else probes the URL for a parseable 402 (`Payment-Required` header or legacy body); "Register This URL Only" skips discovery. Routes without an input schema are marked non-invocable. Not needed for the Bazaar; useful for independent monitoring of our `payTo`.

---

## 5. Same path for MPP and x402, or separate paths?

**Recommendation: same path, one merged 402.** Reasons: the Bazaar and Agentic.Market key on the resource URL (one URL per product); MPP clients (`mppx`) parse only the `Payment` scheme out of `WWW-Authenticate` and ignore other headers; x402 v2 clients read only `PAYMENT-REQUIRED`/`PAYMENT-SIGNATURE`/`PAYMENT-RESPONSE` and the v2 transport spec says the body is a server concern. Branching on the retry is unambiguous: `PAYMENT-SIGNATURE` (or legacy `X-PAYMENT`) ⇒ x402; `Authorization: Payment …` ⇒ MPP. The MPP draft (draft-httpauth-payment-01, 2026-11-02) explicitly allows multiple `Payment` challenges per 402 and `Cache-Control: no-store` on 402s, which the x402 SDK already sets. One vendor guide (agent402.tools) ships exactly this dual-header design in production. [V — S3, S19, S20, mppx source]

Caveats: (a) MPP's `Payment-Receipt` must not be sent on x402-paid responses and vice-versa — handled naturally since each path sets its own; (b) MPP v1 x402 clients that read the **body** for `accepts` would see `{}` — acceptable (v1 is legacy; we can add `unpaidResponseBody` returning the v1 shape later if a buyer asks); (c) this is the one piece below that needs an integration test (§8 step A5). Fallback if it misbehaves: mount x402 under a prefix (`/x402/v1/exa`) with `resource` pointing at that URL — costs nothing but a second listing URL.

---

## 6. Step-by-step: add x402 to `POST /v1/exa` in `services/tools` (Hono)

Files: `~/source/a9n9/services/tools/src/app.ts` (`createToolsApp`, `gate()`), `catalog.ts` (prices as dollar strings — reuse them), `server.ts` (`@hono/node-server`, `TOOLS_PORT`).

### Step 1 — deps

```sh
cd ~/source/a9n9/services/tools
npm i @x402/core@~2.30.0 @x402/hono@~2.30.0 @x402/evm@~2.30.0 @x402/extensions@~2.30.0 @coinbase/cdp-sdk@^1.60.0
npm i hono@^4.13.7            # @x402/hono peer range
npm i -D @x402/fetch@~2.30.0 viem   # test client
```

Env (`.env`, gitignored):

```
X402_NETWORK=eip155:84532          # eip155:8453 for mainnet
X402_PAY_TO=0x<Base address>        # AgentCash wallet; consider a dedicated receive address per service
X402_FACILITATOR=cdp                # cdp | x402org
CDP_API_KEY_ID=…  CDP_API_KEY_SECRET=…
TOOLS_PUBLIC_URL=https://tools.a9n9.net   # explicit resource URLs (see gotcha G7)
```

### Step 2 — build the x402 resource server + routes

```ts
// services/tools/src/x402.ts
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { HTTPFacilitatorClient, type RoutesConfig } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { declareDiscoveryExtension } from '@x402/extensions/bazaar';
import { createCdpFacilitatorClient } from '@coinbase/cdp-sdk/x402';
import { CATALOG, type Tool } from './catalog.js';

export interface X402Options {
  network: 'eip155:8453' | 'eip155:84532';
  payTo: string;
  facilitator: 'cdp' | 'x402org';
  publicUrl: string;            // https://tools.a9n9.net
  tools?: Tool[];               // default: CATALOG minus 'video' (async flow) — start with exa/search/tavily/reserves
}

export function createX402(opts: X402Options) {
  const facilitator = opts.facilitator === 'cdp'
    ? createCdpFacilitatorClient()                                     // reads CDP_API_KEY_ID/SECRET
    : new HTTPFacilitatorClient({ url: 'https://x402.org/facilitator' }); // testnets only
  const server = new x402ResourceServer(facilitator).register(opts.network, new ExactEvmScheme());

  const routes: RoutesConfig = {};
  for (const tool of opts.tools ?? CATALOG.filter((t) => t.name !== 'video')) {
    routes[`POST ${tool.path}`] = {
      accepts: [{ scheme: 'exact', network: opts.network, payTo: opts.payTo,
                  price: `$${tool.price}`,            // "0.0100" -> "$0.0100" -> amount "10000"
                  maxTimeoutSeconds: 300 }],
      resource: `${opts.publicUrl}${tool.path}`,     // explicit public HTTPS URL (G7)
      description: tool.description,                 // <500 chars, descriptive, no instructions
      mimeType: 'application/json',
      serviceName: 'a9n9 tools',
      tags: ['search', 'agents', tool.name],
      extensions: { ...declareDiscoveryExtension(discovery(tool)) },
    };
  }
  return { server, routes, middleware: paymentMiddleware(routes, server) };
}

// Option names per @x402/extensions bazaar README: input (example), inputSchema, bodyType, output.{example,schema}.
// Re-check against node_modules/@x402/extensions/dist/esm/bazaar/index.d.mts after install.  [U: exact typings]
function discovery(tool: Tool) {
  if (tool.name === 'exa') return {
    bodyType: 'json' as const,
    input: { query: 'latest research on stablecoin reserve attestations', num_results: 5, type: 'auto' },
    inputSchema: { type: 'object', required: ['query'], properties: {
      query: { type: 'string', description: 'Search query (natural language or keywords)' },
      num_results: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
      type: { type: 'string', enum: ['auto', 'neural', 'keyword', 'fast'], default: 'auto' } } },
    output: { example: { results: [{ title: 'Example', url: 'https://example.com', highlights: ['…'] }] } },
  };
  // … one block per tool; keep examples real and cheap for the Bazaar health probe (it replays the example)
  return { bodyType: 'json' as const, input: {}, output: { example: {} } };
}
```

Notes: `ExactEvmScheme()` from `@x402/evm/exact/server` takes no args for default assets [V — Hono README]. The CDP quickstart's `createX402Server` is an alternative that wires everything (and auto-declares bazaar for every route) but it targets Express; for Hono use the Foundation packages + `createCdpFacilitatorClient` as above [V — S21].

### Step 3 — wire it into `createToolsApp` next to the MPP gate

```ts
// in app.ts, after `const app = new Hono();`
const x402 = createX402({ network, payTo, facilitator, publicUrl });
const paidRoutes = new Set(Object.keys(x402.routes));

// (a) ledger: outermost, sees the final response. PAYMENT-RESPONSE is base64 JSON.
app.use('*', async (c, next) => {
  await next();
  const pr = c.res.headers.get('payment-response');
  if (!pr) return;
  try {
    const s = JSON.parse(Buffer.from(pr, 'base64').toString('utf8')) as
      { success: boolean; transaction: string; network: string; payer: string; errorReason?: string };
    void recordX402({ path: c.req.path, ...s, at: new Date().toISOString() });   // Postgres table, see §7
  } catch (e) { log(`x402 ledger decode failed: ${(e as Error).message}`); }
});

// (b) protocol switch on paid routes
app.use('*', async (c, next) => {
  if (!paidRoutes.has(`${c.req.method} ${c.req.path}`)) return next();
  const h = c.req.raw.headers;
  if (h.has('payment-signature') || h.has('x-payment')) {
    // x402 retry: verify -> handler (with MPP gate bypassed) -> settle
    return x402.middleware(c, async () => { c.set('paidVia', 'x402'); await next(); });
  }
  if (h.get('authorization')?.startsWith('Payment ')) return next();           // MPP retry -> existing gate()
  // unpaid: merged 402 = x402 headers + MPP WWW-Authenticate
  const xres = await x402.middleware(c, async () => {});                       // returns 402 Response (no next)
  const tool = CATALOG.find((t) => t.path === c.req.path)!;
  const mres = await mppx.charge!({ amount: tool.price })(c, async () => {});  // mppx 402 with WWW-Authenticate
  const out = new Response(xres!.body, { status: 402, headers: new Headers(xres!.headers) });
  const www = mres?.headers.get('www-authenticate');
  if (www) out.headers.set('WWW-Authenticate', www);
  return out;
});
```

and in `gate()`:

```ts
if (c.get('paidVia') === 'x402') {            // already verified by x402; settlement happens after we return
  stats.calls++;
  const res = await run();
  c.res = new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'X-Price': tool.price } });
  void report({ …, rail: 'x402' });
  return c.res;
}
```

Declare `type Vars = { paidVia?: 'x402' }` on the Hono generic so `c.set/get` type-check. The x402 middleware buffers the handler body (`arrayBuffer()`) to settle, then re-emits it with `PAYMENT-RESPONSE` and `Cache-Control: private`; a 4xx/5xx from the handler is not settled (the SDK checks the status before `processSettlement`) — our 502 "vendor call failed" therefore does not charge the buyer, same as the MPP path's intent. [V — unpacked `@x402/hono` middleware; the exact status cut-off was not read, U]

### Step 4 — `/v1/info` and `.well-known`

Add `rails: ['mpp/picocash', 'x402']`, `x402: { network, payTo, asset }` to `/v1/info`, and serve `GET /.well-known/x402` → `{ "version": 2, "resources": [ "https://tools.a9n9.net/v1/exa", … ] }` for x402scan's crawler. [V — S18]

### Step 5 — test client (`scripts/x402-buy.ts`)

```ts
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.BUYER_PK as `0x${string}`);
const client = new x402Client().register('eip155:*', new ExactEvmScheme(account));
const payFetch = wrapFetchWithPayment(fetch, client);

const res = await payFetch(`${process.env.TOOLS_URL}/v1/exa`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'tempo stablecoin reserves', num_results: 3 }),
});
console.log(res.status, (await res.json()));
const pr = res.headers.get('PAYMENT-RESPONSE');
if (pr) console.log(decodePaymentResponseHeader(pr));   // {success, transaction, network, payer}
```

---

## 7. Tracking buyers

- Per paid call you get `payer` (buyer EOA), `transaction` (Base tx hash), `network`, `amount` (our price) from `PAYMENT-RESPONSE` / the settle result; persist `(at, path, payer, amount_atomic, network, tx, success, error_reason)` in the existing Postgres (`pgstore.ts`) — one table `x402_payments`, indexed on `payer`. This is the same identity the Bazaar's `l30DaysUniquePayers` is built from.
- Repeat-buyer features later: `@x402/extensions/sign-in-with-x` (CAIP-122 wallet auth "for repeat access without repaying") and `payment-identifier` (client idempotency id). [V — extensions README]
- Independent check: our `payTo` on `https://basescan.org/token/0x8335…2913?a=<payTo>` (every settle is an on-chain USDC transfer from `payer`), `GET …/x402/discovery/merchant?payTo=…`, and x402scan.
- CDP billing/usage: CDP portal (per-project on-chain transaction count). Not opened. [U]

---

## 8. Test plan

### A. Base Sepolia (`eip155:84532`)

1. **Fund a buyer**: `https://faucet.circle.com` → Base Sepolia USDC, 20 USDC per request, one request per asset+network per 2 h, no login [V — S22]. Buyer needs **no ETH** (EIP-3009; facilitator pays gas). Keep the buyer key in `.env` only.
2. Run tools with `X402_NETWORK=eip155:84532`, facilitator `x402org` first (no key), then `cdp` (same key works for testnet [V — docs say testnet is served by CDP]).
3. `curl -i -X POST https://tools.a9n9.net/v1/exa -H 'content-type: application/json' -d '{"query":"x"}'` ⇒ `402`, headers `PAYMENT-REQUIRED` (base64 → check `accepts[0]` = `exact`/`eip155:84532`/`amount "10000"`/`asset 0x036C…`/`extra {name:"USDC",version:"2"}`/`payTo`), `WWW-Authenticate: Payment …` (MPP), `Cache-Control: no-store`. Also `curl -H 'Accept: text/html' -A Mozilla` ⇒ HTML paywall (expected).
4. `scripts/x402-buy.ts` ⇒ `200`, `PAYMENT-RESPONSE.success=true`, tx visible at `https://sepolia.basescan.org/tx/<hash>`; ledger row written; `/v1/info` stats incremented; inbox `tools.call` event has `rail: 'x402'`.
5. **Dual-rail regression**: MPP buyer (`@picocash/mppx-method` agent) still pays the same path; `Authorization: Payment` retry never hits the x402 middleware; the underpay guard still works.
6. **Negative**: replay the same `PAYMENT-SIGNATURE` twice (second must be 402 `invalid`/nonce used — note the race in G2); tamper `amount`; wait > `maxTimeoutSeconds` before retrying (expired); handler 502 ⇒ no settle, no charge.
7. `POST https://api.cdp.coinbase.com/platform/v2/x402/validate {"resource":"https://tools.a9n9.net/v1/exa","method":"POST"}` ⇒ `valid: true`, `simulation.outcome: "accepted"`, read `preflight` advisories. Then one CDP-settled testnet call ⇒ within 15 min `GET …/discovery/merchant?payTo=<testnet payTo>` lists it (rehearses the Bazaar flow end-to-end).

### B. Base mainnet (`eip155:8453`)

1. CDP Secret API key (Ed25519, IP-allowlisted to the box's egress IP), stored via the existing secrets path; never in git.
2. Flip `X402_NETWORK=eip155:8453`, `X402_PAY_TO=<AgentCash Base address>`; restart; `curl -i` ⇒ 402 with `asset 0x8335…2913`, `extra {name:"USD Coin",version:"2"}`.
3. Pay **one call from our own funded Base wallet** ($0.01 USDC) → `success`, tx on basescan; this is the indexing trigger.
4. 15 min later: `discovery/merchant?payTo=…` and `discovery/search?query=exa search`; then `api.agentic.market/v1/services/search?q=a9n9`. If `EXTENSION-RESPONSES`/validate says `rejected`, fix schema (`input` must match `schema.properties.input`).
5. Register at `x402scan.com/resources/register`.
6. Run for a week on the free tier; watch: settle latency (CDP P95 target 900 ms on Base), `settlement_pending` count, unique payers. Keep ≥1 settlement/30 days per route (our own synthetic buy if needed) or the listing drops.

---

## 9. Known gotchas (G1–G14)

- **G1 Clock skew / window.** Client computes `validBefore = now + maxTimeoutSeconds` from *its* clock; server/facilitator judge it. Keep `maxTimeoutSeconds` 60–300 (SDK default 300), NTP on the box, log `validBefore` vs server-now on every rejection. [V spec + source; practitioner post S23]
- **G2 Replay and the verify→handler→settle gap.** The EIP-3009 nonce is one-time **on-chain**, so a second settle of the same signature reverts — but two concurrent requests with the same `PAYMENT-SIGNATURE` can both pass `/verify` (a simulation) and both run the handler before the first settles. Mitigation: a tiny in-process/PG set of `(from, nonce)` seen-at-verify, rejected on reuse for ~`maxTimeoutSeconds`. The NDSS 2026 "two-phase gap" paper is about this. [V for mechanism; U for the paper]
- **G3 `settlement_pending`.** CDP returns HTTP 500 `{success:false, errorReason:"settlement_pending", transaction, network}` when the tx broadcast but didn't confirm in the sync window; the `@x402` server SDK retries once with the identical request; **never** issue a new 402 or re-request payment — reconcile by tx hash. Treat `success:false` + hash as "unresolved", not failed. [V — S24]
- **G4 Facilitator outage = fail closed.** Return 502/503, never the resource; set a short verify timeout. [V — S23]
- **G5 Pricing floor.** No protocol minimum (1 atomic = $0.000001), but beyond 1,000 settlements/month each costs $0.001 — at $0.01 that's 10 % take; `$0.001` endpoints net zero. Price truncates past 6 decimals. Our $0.01–$0.05 band is fine. [V]
- **G6 Gas.** Buyer needs zero ETH; facilitator pays gas and bills it into the $0.001. Permit2/EIP-2612 sponsorship only matters for non-EIP-3009 tokens. [V]
- **G7 `resource.url` behind the tunnel.** `@hono/node-server` builds `c.req.url` from the `Host` header over plain HTTP, so the auto-derived resource could be `http://…`. Bazaar requires public HTTPS and the resource URL is the catalog key — set `resource` explicitly. [V for the field; U for the exact derived value — check the 402]
- **G8 Browser sniffing.** `Accept: text/html` + UA `Mozilla` ⇒ HTML paywall; health checks and agents sending browser-like headers get HTML. Not an issue for API clients; `unpaidResponseBody` customizes the JSON 402 body.
- **G9 Hono peer range.** `@x402/hono` needs `hono >=4.13.7`; tools pins `^4.6.14`. Bump and run the suite.
- **G10 Versions.** `@x402/*` ships new minors constantly (2.30.0 today); `@coinbase/cdp-sdk` peers `^2.25.0`. Pin `~2.30.0`, upgrade deliberately. Don't mix with the v1 `x402-*` packages or `@coinbase/x402`.
- **G11 v1 clients.** Server SDK still accepts `X-PAYMENT`/`x402Version:1` payloads; whether the CDP facilitator still settles v1 `"base"` kinds is not visible without a key (`/supported` is 401). x402.org still lists v1 `base-sepolia`. [U]
- **G12 Bazaar content policy / collapse rules.** No imperative text in descriptions; bare-id path segments collapse into one template; keep examples cheap — the health probe replays them (unpaid, expects 402).
- **G13 Domain names differ per chain.** Base USDC is `USD Coin`/`2`, Base Sepolia `USDC`/`2` (verified over RPC today). The SDK's default table is correct; only matters if you hand-roll `extra`.
- **G14 Video route.** `/v1/video` returns 202 + poll URL for long renders; with x402 the settle happens on the 202 (if the SDK settles 2xx) — decide whether that's acceptable or keep video MPP-only for now.

---

## 10. Tax / KYC / compliance (not legal advice)

- Coinbase/CDP docs: no seller KYC, no "Coinbase account for the payee" — `payTo` can be any self-custody address; what's needed is a CDP project + Secret API key for the facilitator. Every payment is OFAC + KYT screened against **payer and recipient**; a flagged payee means every settle fails `kyt_risk_detected`. [V — S7]
- Braumiller Group legal note (Legal 500, 2025-12-02): a US merchant that merely receives USDC via Coinbase's hosted facilitator is "analogous to a merchant using Stripe or PayPal… not an MSB, absent unusual facts"; running your own facilitator that holds/converts/routes funds would likely be money transmission. Tax: digital assets are property; assume x402 receipts carry the same obligations as any crypto receipt; Form 1099-DA reporting lands on brokers, not sellers; basis tracking across micro-receipts is the practical burden. Recommends posting terms of use (governing law, liability limits) on the paid resource. [V — S25]
- Practical: record USD value at receipt (USDC ≈ $1, so income = amount), keep the ledger from §7 as the book of record, use a **dedicated receive address per service** so Visybl's accountant can reconcile from basescan alone. Whether Visybl needs anything beyond ordinary sales-income treatment is a question for the accountant. [U]

---

## Sources opened (all on 2026-11-04)

- S1 `github.com/coinbase/x402/specs/x402-specification-v2.md` (raw)
- S2 `…/specs/schemes/exact/scheme_exact_evm.md`
- S3 `…/specs/transports-v2/http.md`
- S4 `docs.cdp.coinbase.com/x402/core-concepts/facilitator`
- S5 `docs.cdp.coinbase.com/x402/network-support.md`
- S6 `docs.cdp.coinbase.com/x402/seller/facilitator.md`
- S7 `docs.cdp.coinbase.com/x402/support/faq.md`
- S8 `docs.cdp.coinbase.com/get-started/authentication/cdp-api-keys.md`
- S9 `github.com/coinbase/x402/typescript/packages/http/hono/README.md` (+ `examples/typescript/servers/hono`)
- S10 `…/typescript/packages/http/fetch/README.md`; `…/mechanisms/evm/README.md`
- S11 `docs.cdp.coinbase.com/x402/seller/get-discovered.md`
- S12 `docs.cdp.coinbase.com/x402/validate-endpoint.md`
- S13 `…/specs/extensions/bazaar.md`
- S14 `…/typescript/packages/extensions/src/bazaar/README.md` (+ extensions README)
- S15 `agentic.market` + `agentic.market/llms.txt`; `api.agentic.market/v1/services/search` (probe)
- S16 `docs.cdp.coinbase.com/x402/bazaar`
- S17 `github.com/Merit-Systems/x402scan` README; S18 `docs/DISCOVERY.md`; `x402scan.com/resources/register`
- S19 `paymentauth.org/draft-httpauth-payment-01.html` (MPP, 2026-11-02)
- S20 `agent402.tools/guides/x402-and-mpp`
- S21 `docs.cdp.coinbase.com/sdks/cdp-sdks-v2/typescript/x402/functions/createCdpFacilitatorClient.md`; `docs.cdp.coinbase.com/x402/quickstart-for-sellers`
- S22 `faucet.circle.com`; `developers.circle.com/stablecoins/usdc-contract-addresses`
- S23 dev.to/payload-tools "x402 in production: the failure modes nobody warns you about"
- S24 `docs.cdp.coinbase.com/x402/seller/settlement-pending.md`
- S25 Legal 500 / Braumiller "Activating HTTP 402…" (2025-12-02)
- `…/specs/x402-specification-v1.md` (legacy fields)
- Live probes: `x402.org/facilitator/supported`; `api.cdp.coinbase.com/platform/v2/x402/{supported,discovery/resources,discovery/search,discovery/merchant}`; Base + Base Sepolia RPC `name()/version()/decimals()` on both USDC contracts; npm registry metadata; unpacked `@x402/{core,evm,hono,extensions}@2.30.0`, `@coinbase/x402@2.1.0`, `@coinbase/cdp-sdk@1.60.0/_esm/x402/facilitator.js`.
- Not reachable today: npmjs.com HTML pages (403 — used the registry API instead), `x402.gitbook.io` migration page (404), `docs.x402scan.com` (404).
