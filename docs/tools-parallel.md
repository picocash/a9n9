# Parallel.ai on the tools service and in the agent kit

Status: live 2026-11-06. Arun: "parallel.ai … has $78 in credit … make sure agent001 has a skill to use that tool … quite good with decision, monitor, extract datasets."

## Where the key lives

`PARALLEL_API_KEY` is in `~/a9n9/secrets/tools.env`, read by the tools container only. The agent never holds it: `bin/parallel` buys each call from `tools.a9n9.net` with picocash (testnet eCash today, like `image` and `video`), so the ledger shows a `money.spend` per call and the service shows a `tools.call`. Outside buyers get the same routes over MPP, and the short ones over x402 too.

The prepaid balance cannot be read with the API key (Parallel's Service API wants an OAuth account token), so the $78 is tracked by spend: `tools.call` events with a Parallel tool name, and `state/parallel-usage.jsonl` on the agent. Check the dashboard when the ledger says about $60 is gone.

## Routes (services/tools), vendor cost → our price

| Route | What | Vendor cost (docs.parallel.ai pricing) | Our price | x402 |
|---|---|---|---|---|
| `POST /v1/search` | `/v1/search`, modes turbo/fast/basic/advanced (default advanced), `include_domains`, `after_date`, up to 20 results | $0.001–0.005 + $0.001 per result over 10 | $0.01 | yes |
| `POST /v1/extract` | up to 10 URLs → excerpts for an objective, or full markdown | $0.001 per URL | $0.01 | yes |
| `POST /v1/decide` | `/v1/decisions`: a `state` and up to 20 questions (noul, choice, score) → probabilities + citations | $0.001 | $0.01 | yes |
| `POST /v1/task` | `/v1/tasks/runs` then the blocking result (120 s); processors lite/base/core; 202 with `run_id` if still running | $0.005 / $0.01 / $0.025 | $0.05 | yes |
| `POST /v1/findall` | `/v1beta/findall/runs`, polled up to 4 min, then the result; generator preview (5–10 candidates) or base (≤25 matches) | $0.10, or $0.25 + $0.03 per match | $1.20 | no |
| `POST /v1/monitor` | `/v1/monitors` event stream, lite, 1d or 1w; `GET /v1/monitor/{id}/events` is free | about $0.003 per check | $0.20 | no |

Guards in the service: input validated before any charge (`catalog.ts` builders, tested), a vendor budget per UTC day across all buyers (`PARALLEL_DAILY_USD`, default $5, in-process), and a cap on active monitors (`PARALLEL_MAX_MONITORS`, default 20, counted from Parallel's list endpoint). The `/v1beta/search` call was migrated to `/v1/search` at the same time.

## Agent kit

`bin/parallel search|extract|decide|task|findall|monitor|monitors|events` (usage in `bin/parallel --help`; parsing and the budget are pure functions in `bin/_parallel.mjs`, covered by `bin/_guards.test.mjs`). Daily cap `policy.parallel_usd_per_day` ($1.50) from `state/parallel-usage.jsonl`; at most 5 monitors (`state/parallel-monitors.json`); findall results are saved under `state/datasets/`. Prices are read from `/v1/info` at call time so the 402 and the payment agree.

Skill `a9n9-parallel` (attached to the explore and respond jobs) says which call fits which need and the rules: excerpts are not verification (`check` is the receipt), a probability is not a fact, one findall a day, monitors only on the beat. The explore and fact-check skills point at it.

## Not done

- Monitor webhooks into the inbox (Parallel signs its own way; an adapter route is needed). Until then the agent polls `parallel events` in explore runs.
- Cancelling a monitor: no documented path was found; the operator cancels in the dashboard, the agent asks in the journal.
- Responses API, image and place search, entity search: not wired; add when a use shows up.
