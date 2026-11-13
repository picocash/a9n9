# Agent fleet on the Dell R640 (Proxmox)

Status: proposal, 2026-11-04. Goal: a new agent goes from nothing to running in under 15 minutes of machine time, built only by the provisioner, never by hand.

## What we measured on the current box (2026-11-04)

- The shared services (inbox/ledger, comms, tools, phone, web, nostr, anchor, llm, sites) use about 300 MB together.
- An agent's footprint is its Hermes gateway plus Chrome. On this box Chrome, Hermes and Python together show about 12 GB resident memory (an overcount, since Chrome processes share pages). The agent's sandbox container uses less than 5 MB at rest.
- Models are remote (Grok/xAI), so the R640 needs no GPU. What it needs is RAM for browsers.

## Layout

```
R640  Proxmox VE (ZFS, LAN-only management UI)
├── vmbr0  management   Proxmox UI, IPMI/iDRAC. LAN and Tailscale only.
├── vmbr1  core         platform services, reachable by agents on fixed ports only
├── vmbr2  agents       one VM per agent; no agent-to-agent traffic, no LAN
│
├── VM core        (8 vCPU, 24 GB, 200 GB)
│     inbox/ledger, comms (WhatsApp/Telegram/SMS per agent), tools, phone, web,
│     llm gateway (holds provider keys, meters each agent), anchor, Postgres (LAN only),
│     status console and probes, cloudflared (the only inbound path), reverse proxy *.a9n9.net
├── VM agent-template  (golden image, never run)
├── VM agent001 … agentNNN  (2 vCPU, 4 GB, 40 GB each, linked clones)
│     Hermes (brain, cron jobs, skills, SOUL)
│     Open Terminal container (shell, own Chromium profile, egress allowlist, VNC takeover)
│     agent kit (tools and guards, read-only, pinned version)
│     state/  (the only writable agent data, backed up)
│     secrets/ (only this agent's own accounts, mode 600)
└── VM pbs or external Proxmox Backup Server (nightly)
```

## Why one VM per agent

Each agent holds its own identities: email, signing key, social accounts, phone numbers and money. A VM puts a kernel boundary around each of those, so one compromised or confused agent cannot read another's cookies or keys.

- **Cost:** linked clones make a VM cost seconds to create and little disk.
- **Density:** at 4 GB each, about 45 agents fit after reserving memory for the host, ZFS cache and the core VM.
- **Why not LXC:** LXC is lighter, but it shares the kernel, and Docker inside LXC needs nesting or privileged mode.
- **Why not containers in a shared VM:** that gives up the boundary we want.

## Storage

There are 4 × 1.92 TB SAS SSDs, about 7.7 TB raw. Use one ZFS pool of two striped mirrors (Proxmox installer: "ZFS RAID10"). It holds both the OS and the VM disks.

- **Usable space:** about 3.5 TB, kept under 80% full, so about 2.8 TB in practice. Agents need about 45 × 40 GB = 1.8 TB thin-provisioned (linked clones use far less), plus 200 GB for core.
- **Why not RAIDZ1** (about 5.2 TB usable): random I/O for a pool of many small VM disks runs at about the speed of one disk, and losing a second disk during a rebuild loses the pool.
- **Why not RAIDZ2:** the same usable space as RAID10, with worse I/O.
- **Setup:** the PERC controller must be in HBA (passthrough) mode, not RAID, so ZFS sees the raw disks. Use ashift=12, compression=lz4, and limit the ARC (zfs_arc_max) to 16 GB.
- **Backups:** the pool is not a backup. Proxmox Backup Server stores backups off the box (the NAS).

## Network rules (Proxmox firewall, default deny)

- **agent → core:** ledger, comms, llm gateway and tools on fixed ports only.
- **agent → internet:** through Open Terminal's domain allowlist, per agent, kept in its `policy.json`.
- **agent → agent, agent → LAN, agent → Proxmox:** denied.
- **Inbound:** only Cloudflare Tunnel into core, which reverse-proxies `agentNNN.a9n9.net` to that agent's public endpoints.
  - Set up `*.a9n9.net` once from the Mac session. After that, new agents need no DNS or tunnel change.
- **Postgres:** never through the tunnel.

## Models: one big, one small per agent (decided 2026-11-04, testing on agent001)

Each agent runs on two models and chooses between them per subtask:

- **Main model:** the agent's own X Premium Grok pool (`xai-oauth`), used in full. The pacing tool targets about 14% of the weekly pool a day with a 2% reserve; the research run fires every 30 minutes and the "under pace" advice asks for more searches and checks, never more posts (the posting caps stay).
- **Subtasks:** Hermes `delegate_task` with the official `advanced-delegation` plugin in **model routes** mode. Two routes, named so the agent picks by task, not by provider: `fast` (OpenRouter, `google/gemini-3-flash-preview`, the default) for reading a source, summarising a thread, extracting facts and drafting digest candidates; `deep` (Grok reasoning) for verifying a claim end to end and anything with money or identity. The explore skill tells the agent to hand all reading to `fast`.
- **Context compression** (`auxiliary.compression`) runs on the same Flash model, so long runs no longer burn Grok on compaction.
- **Keys:** one OpenRouter account for the organisation (Arun's), **one key per agent** with its own credit limit (agent001: $50). The key is written to the box by hand (`~/a9n9/secrets/<provider>.env`, mode 600, then `~/.hermes/.env`), never through chat. Hermes runs on the host; the agent's sandbox cannot read the key. On the fleet the key lives in the core llm gateway and the agent gets a gateway credential instead (see Secrets).
- **What to watch** on agent001 before this goes into the kit: that runs actually delegate (each result names its route), OpenRouter spend per day (`GET /api/v1/key`), and that Grok tokens per run fall while the number of checks per run rises.

## Secrets

- Platform keys stay in core: Stripe, model providers, Telnyx/AWS, Cloudflare. Agents call core APIs instead of holding them. The llm gateway enforces each agent's budget.
- Agent keys are generated on the agent VM at provision time: its Ed25519 signing key, Nostr key and Hermes auth. A copy goes to Vaultwarden.
- Account credentials an agent signs up for live only in that agent's `secrets/`.

## Provisioner: `a9n9 new-agent <id> --name <display> --soul <template>`

1. Linked-clone `agent-template` through the Proxmox API. Cloud-init sets the hostname, IP on vmbr2 and SSH key.
2. Ansible role installs pinned versions of Hermes, Open Terminal and the agent kit.
3. Generate the agent's keys, write `policy.json` and `SOUL.md` from the template, and install the skills.
4. Register the agent with core:
   - a ledger channel and token;
   - comms routes (the agent's own numbers come later);
   - a console entry and probes;
   - the reverse-proxy route `agentNNN.a9n9.net`.
   - a Bluesky account on our own server (see Bluesky below), with handle `agentNNN.a9n9.net` and the matching DNS record.
5. Start the Hermes cron jobs. The first run must leave a public action or a journal entry.

The slow part is not machines. It's the human steps:
- social accounts other than Bluesky;
- phone numbers and their registration;
- WhatsApp Business;
- the BotFather token.

The provisioner prints that checklist per agent, and the console shows which are done.

## Bluesky: our own server, handles and a labeler

The aim is fleet scale and verifiable identity. None of this adds reach: posts land in the same network and feeds either way.

**Domain handles (now).** Every agent's handle is `agentNNN.a9n9.net`, proven by DNS, so anyone can check that a9n9.net controls the account. agent001 already has one. The provisioner publishes the DNS record for each new agent.

**Our own server (Bluesky PDS), with agent002.** Run the official PDS container in the core VM, with a public hostname through the Cloudflare tunnel (set up from the Mac session).
- **Account creation:** the provisioner creates each agent's account through the server's admin API in seconds. No sign-up on Bluesky's own server, so no email checks and no CAPTCHA, which we never solve by machine.
- **Data:** posts, the repository and the signing keys stay on our hardware and go into PBS backups.
- **Moving agent001:** standard account migration; the account identity carries over, so followers and history stay.
- **Account cap:** Bluesky's network limits how many accounts a new server can host until it is trusted. Check the current limit and how to raise it before planning past a handful of agents.
- **Running it:** one more public service to monitor (a probe in the console) and keep current with upstream releases.

**Labeler (later, with the reputation product).** A Bluesky moderation service we run that labels each a9n9 agent account, for example "AI agent operated by Visybl, public receipts at agentNNN.a9n9.net", and could later label with track-record facts drawn from the ledger.
- **Fit:** this is verifiable reputation in Bluesky's own terms, and it fits the platform thesis.
- **Reach:** people see the labels only if they subscribe to our labeler, so it starts at zero.
- **Timing:** build it once several agents have a record worth labelling.
- **Blue check:** Bluesky grants verification only through organizations it chooses as trusted verifiers, so we don't plan on it.

## Skill set: what every agent starts with

Skills are instructions. They don't make an agent decide or learn on its own; the loop does: act, measure what happened, decide what to change, and remember it. Rules stay in tools (guards), never only in skills. Hermes already supports what the loop needs: built-in memory (on in cron runs, `skip_memory=False`), session search, and skill creation (`skills.creation_nudge_interval: 15`). On agent001, though, `~/.hermes/memories` is empty: everything it learns goes to its own journal, and nothing from it enters Hermes memory.

**How skills are loaded on a new agent**
- `hermes skills opt-out`: no seeding of the full bundled catalogue. Install only the allowlist below.
- The a9n9 kit's skills come from git through `skills.external_dirs` (read-only and versioned), so a skill fixed once is fixed for every agent.
- Each cron job names its skills (`skills: [...]`). Put `grok-budget` on every job; today agent001's jobs only mention it in the prompt.
- Skills an agent writes itself land in its own `~/.hermes/skills`. The weekly review diffs them, and good ones are promoted into the kit by a person.

**Format: the Agent Skills spec (agentskills.io/specification)**

Hermes reads the same format: `SKILL.md` with YAML frontmatter, plus optional `scripts/`, `references/` and `assets/`. The kit follows the spec, with two deliberate exceptions:
- **Hermes fields kept:** top-level `version`, `author` and `platforms`, and a nested `metadata.hermes` map. The spec allows only string-to-string `metadata`, but Hermes reads these fields. Stay compatible with Hermes first.
- **Guards stay out of `scripts/`:** tools that carry guards (`bin/`, `_lib.mjs`) live in the kit's read-only `bin`, never in a skill's `scripts/`. Skills are text the agent can rewrite; guards must not be.

**CI lint for every kit skill (it would have caught a real bug):**
- frontmatter parses as strict YAML;
- `name` matches the directory (lowercase letters, digits and single hyphens, at most 64 characters);
- `description` is 1–1024 characters and says what the skill does and when to use it;
- `platforms` is a list;
- the body is under 500 lines (spec: under about 5,000 tokens); longer material moves to `references/`;
- also run `skills-ref validate` and allow only the Hermes exceptions above.

**The bug the lint would have caught.** `a9n9-daily-review` had an unquoted colon in its description, so its frontmatter wasn't valid YAML. Hermes fell back to splitting lines on colons, read `platforms: [linux]` as the string `"[linux]"`, and the platform check rejected the skill. The nightly review and the weekly report therefore ran without their skill ("Skill(s) not found and skipped"). Fixed 2026-11-04 by quoting the description.

**Skills Hub policy (`hermes skills search/inspect/install`)**

The hub mixes Hermes's official skills with community registries (ClawHub, skills.sh, browse.sh). Community entries are anyone's text, and a skill is instructions the agent follows, so treat installing one like installing a dependency.
- **Official hub skills:** allowed through the allowlist above.
- **Agents install and write their own skills (Arun, 2026-11-04).** There are many ways to create value: content, digests for a group, forum answers, and more. An agent must be able to pick up the skill it needs. Writing skills uses Hermes's `skill_manage`. Installing goes through one kit tool, `skill-install <full identifier>`, never the raw CLI. The tool:
  - takes official skills and community skills from the named registries only;
  - runs Hermes's scan and refuses a blocked verdict (no `--force`);
  - refuses ambiguous short names;
  - caps installs at 3 a week;
  - records the source, commit and hash in the ledger, so every install is public;
  - quarantines the skill (agent-only, not shared) until the weekly review promotes it into the kit or removes it.
- **Why this is safe enough:** a skill is only instructions. Hard limits stay in tools and the environment:
  - posting caps and claim guards;
  - spend limits;
  - an egress allowlist;
  - platform secrets held in core, outside the sandbox.

  The worst a bad skill can do is persuade the agent to try something the tools refuse. Every refusal is logged.
- **Worth reading as source material for `a9n9-learn`, not for installing:** community `self-improve` and `reflection` skills; the Bluesky (`openclaw-bluesky`) and Nostr (`nak`) skills, for ideas only, because our guarded tools already post. For WhatsApp and Telegram use the official Hermes gateway (`hermes whatsapp-cloud`, Telegram platform), not community skills.

**1. Operating loop (a9n9 kit, ours).** Rule: every new kit skill and tool is proved on agent001 first, and goes to other agents only once it works.

| Skill | State | Job |
|---|---|---|
| `a9n9-explore` | exists | find questions, publish one checkable finding |
| `a9n9-respond` | exists | answer mentions and messages within the hour |
| `a9n9-bluesky` | exists | Bluesky conduct |
| `a9n9-daily-review` | exists | daily review, weekly report |
| `grok-budget` | exists; generalise to `llm-budget` | pace model spend |
| `a9n9-learn` | **built 2026-11-04, testing on agent001** (`bin/experiment`) | read yesterday's outcomes, keep or drop one change, write 3 lessons to Hermes memory, set one experiment with a hypothesis for today |
| `a9n9-outcomes` (tool + skill) | **built 2026-11-04, testing on agent001** (`bin/outcomes`, `--play` tag) | per post and network: replies from people, did-this-help clicks, follows, money; the learning loop's input |
| `a9n9-earn` | **to write** | the paid offering: take an order, deliver, receipt, refund rules |
| `a9n9-channels` | **to write** | WhatsApp, Telegram and SMS conversations: opt-in, STOP/HELP, handoff |
| `a9n9-survive` | **to write** | read `runway` daily; below the floor, cut spend and hibernate, never borrow or overspend |

**2. Bundled Hermes skills to enable**

| Skill | Why |
|---|---|
| `grounded-citations` | every claim tied to a source |
| `competitor-news-monitor` | watch named projects for news worth a finding |
| `product-price-monitor` | price checks (the Pay Safe kind) |
| `humanizer` | strip AI-isms from posts |
| `email-inbox-triage` | its own inbox, drafts held by guards |
| `weekly-review-planning` | weekly reset feeding `a9n9-learn` |
| `document-to-action-items` | turn specs and terms into checkable claims |
| `llm-wiki` | a long-term knowledge base it builds from its findings |
| `hermes-agent` | knowing its own harness |

**3. Optional Hermes skills to install**

| Skill | Why |
|---|---|
| `watchers`, `rss-feeds` | poll feeds and APIs instead of spending model calls on search |
| `duckduckgo-search` or `searxng-search` | free search to lower the Grok spend |
| `parallel-cli` | deep research (a Parallel.ai key already exists, via the egress proxy) |
| `one-three-one-rule` | decision briefs: problem, three options, one pick, written to the journal |
| `evm` | read-only on-chain checks (Tempo is EVM) |
| `mpp-agent` | pay HTTP 402 APIs; fits picocash; wallet limits stay in tools |

**4. Never enable (conflicts with standing rules)**
- **Bot-wall or Cloudflare bypass:** `blocked-page-recovery` and `scrapling`.
- **Posting or telephony outside our guarded tools:** `xurl` (posts to X without the claim, repeat and correction guards); `telephony` (Twilio, which is ignored for SMS).
- **Money or keys outside policy:** `stripe-link-cli` and `stripe-projects` (the agent never gets the Stripe key); `1password`.
- **Unbounded or offensive capability:**
  - `godmode`, `sherlock`, `unbroker`, `web-pentest`;
  - `computer-use`;
  - the coding-delegation CLIs (`claude-code`, `codex`, `opencode`, `grok`, `openhands`, `blackbox`);
  - `apple/*`.
- **Not our work:** creative video and music, mlops, gaming, health.

## Later: one router over the fleet (idea, 2026-11-05, not started)

When ten or more agents run, Arun wants one place to send a command and get status, with each agent behind it. The candidate is DeepSeek Harness (`dsh`, MIT) **on top of** Hermes, not instead of it: one `dsh` router session in core, and one `dsh` worker per agent that talks to that agent's Hermes (over its API server or kanban board). Agents keep running exactly as now; the router only dispatches and reports.

What the research found (2026-11-05, details in the session notes):

- `dsh` itself is a developer preview with breaking changes promised, no security audit, plugins running in-process, and roughly ten times the per-step token overhead of a thin harness. Its strengths are the append-only session log (every model request reconstructable), process sandboxing, subagents with per-child model and a structured output schema, schedules and a webhook runtime. Chat ingress is GitHub and Feishu only.
- The router/worker/watchdog design is `dsh-superagent-prototype`: a resident Router that evaluates and dispatches, one isolated Worker session per Ticket held in a worker slot, a scheduled Watchdog, and a Policy that admits work only when an allowed person asks or a written rule allows, and speaks only when a person must act. DeepSeek calls it research code.
- Hermes already covers the same shape for one box: `hermes kanban` (durable board, decompose, swarm, dispatch daemon, per-task model, worker profiles in isolated workspaces) plus `delegate_task` model routes and the chat gateways.

Decision for now: **no change to agent001.** Revisit when the fleet reaches about ten agents, and compare three options on the same test: (a) `dsh` router with one worker per Hermes agent; (b) a Hermes kanban board in core with each agent as a profile; (c) a small router of our own over the agents' ledgers and API servers. Whatever wins, keep two rules from the superagent design: a Policy that names who may ask and what rules admit work, and a log from which every model request can be rebuilt.

## Later: a private Nostr relay for swarm messages (idea, 2026-11-07, not started)

Swarm messages run through the inbox today (`docs/swarm-comms.md`: signed against `fleet.json`, written to the ledger, guards in code). On one box a relay would duplicate that; agents run on cron and read an unread count, so live push adds little.

**Revisit when** the first agent runs off this box (R640 VMs, or agent002 on a Nous cloud machine), or when agents from other operators need a two-way channel. Then:
- **Relay:** khatru (Go, MIT), because it supports NIP-42 auth natively and its read and write rules are code: only pubkeys in `fleet.json` may connect, read or write. LAN and Tailscale only. Storage LMDB or SQLite.
- **Not chosen:** strfry (NIP-42 only preliminary, mostly on writes; restricting reads needs a proxy), nostr-rs-relay (slow development, NIP-42 status unconfirmed), the Buzz relay on this box (Block's product; avoid the lock-in).
- **Shape:** messages are NIP-17/NIP-44 encrypted (client code in the picocash SDK: `nip44.ts`, `relay.ts`); a bridge subscribes and writes every event into the ledger, so the inbox stays the system of record and the existing guards keep working; `swarm-send` and `swarm-read` gain a relay option.
- **Test** on agent001 first; stop rule as in swarm-comms: drop it if no relay message leads to a help, a paid job or a verified finding in two weeks.

## Later: newsletter scorecard on Ghost (idea, 2026-11-07, waits for the R640)

Arun's Substack idea, reshaped. **Not** reselling or paraphrasing paid newsletters: Substack's terms (2026-10-06) forbid copying or redistributing others' content and storing significant portions of it, and writers license paid posts for personal, non-commercial use; a paid summary of paid newsletters is a market substitute, so fair use fails.

**Instead: a scorecard of public market calls.** The Substack finance paid bestsellers (read 2026-11-07: Citrini Research, Michael Burry's Cassandra Unchained, Doomberg, TMT Breakout, Capital Wars, Compounding Quality, Adam Mancini, Capital Flows, Kevin Muir's MacroTourist, Quoth the Raven, Macro Charts ...) mostly sell specific, dated, checkable calls, and nobody keeps public score. Each week log the calls these writers make in free posts, on X and in interviews (claim, date, number, link), then grade them against market data and filings: held, missed, still open.
- **Free:** weekly scorecard headlines. **Paid ($8-10/mo):** the full ledger, each call's history and sources, and "check this call" requests.
- **Platform:** Ghost, self-hosted (open source, Admin API so the agent can publish, paid members through our Stripe, 0% platform fee). The free edition is also posted to Substack by Arun from the agent's draft for discovery: Substack has no publishing API and its terms bar automated processes.
- **Rules:** public statements only, short quotes, every call linked; a miss is reported as a fact, never as a judgment of the person (defamation). General publication only: no personal advice, no "buy X", standing "AI, not investment advice" disclaimer (publisher's exclusion).
- **Pilot:** 4-5 writers who publish enough free material (to confirm per writer; candidates Citrini, Doomberg, Burry, Muir, Capital Flows); one free issue a week; paid tier after 100 free subscribers; stop if under 50 free subscribers after 3 issues.
- **When:** after the R640 is up (Ghost runs there, one more container in core). Fits agent001's fact-check identity, or a new agent with this as its beat.

## Work this needs before the first new agent

1. **Agent kit into git.** agent001's tools and guards live only in `~/a9n9/agent001/bin` today. Move them into this repo as a versioned kit that every agent installs, so a guard fixed once is fixed for all.
2. **Browser tools onto Open Terminal's API.** Replace Playwright over CDP (port 9222). Only `grok-usage` uses it today.
3. **Multi-agent core.** Several services assume one agent and must take an agent id:
   - the ledger;
   - comms;
   - the console;
   - the llm gateway budgets.
4. **Backups.**
   - Proxmox Backup Server nightly, off the R640 if possible. One server is one point of failure.
   - A UPS and both PSUs connected.

## Order

1. Install Proxmox on ZFS RAID10 (see Storage) and the management network. Build `agent-template`.
2. Core VM: move the shared services from the current box. Keep the current box running until probes are green on the new one.
3. agent002 as the pilot, built only by the provisioner. Fix the provisioner, not the VM.
   - 2026-11-13: agent002 was moved by hand ahead of the provisioner, onto VM 104 (the Beat The Chefs VM), at Arun's request: same container, state and cron lines, see `agent002/README.md`. It is a lift-and-shift, not the pilot; the pilot is still the first agent the provisioner builds, and agent002 gets its own VM then.
4. Move agent001 last, with its state, keys and Chrome logins re-done in its own browser profile.

## Hermes egress and secrets: test results (2026-11-04)

Tested in a throwaway Hermes home (proxy on port 9190, plain curl container on the default bridge). agent001 was not touched, and production egress stays disabled.

**Egress (iron-proxy v0.39.0, pinned by Hermes)**
- What works:
  - Allowlisted hosts pass. Unlisted hosts are refused (403 at CONNECT).
  - The proxy token is useless without the proxy: api.x.ai answers 400 when the token is sent to it directly.
- **Bug:** Hermes generates `require: true` for every mapped key. iron-proxy evaluates that on the CONNECT request, which never carries `Authorization`, so every call to a mapped provider is refused. With `require: false` the swap works: api.x.ai answers 200, and the log shows `swapped XAI_API_KEY header:Authorization`. Report this upstream. We would write our own config anyway (below).
- **Not a firewall by itself:** a container that ignores `HTTPS_PROXY` reaches the internet directly (example.com answered 200). Enforcement needs the network to allow nothing but the proxy. On the R640 that is the Proxmox firewall: agent VM → core:proxy only.
- **Hermes only maps LLM provider keys.** iron-proxy itself can swap any header, query or body value per host. So in the fleet we run iron-proxy in core with our own `proxy.yaml`:
  - Resend and X OAuth2 tokens: Bearer header swap.
  - Bluesky app password: body swap on `createSession`.
  - Our core services sit on private IPs, which the default deny list blocks. Add them to `NO_PROXY` or allow them explicitly.
- **Cannot be swapped: keys that sign locally.** Ed25519 identity, Nostr nsec, inbox HMAC and the payer wallet need a signer service in core: the agent asks core to sign, rate-limited and logged.
- **Today's real exposure on agent001:**
  - `~/.hermes/auth.json` (the Grok OAuth credential pool) is mounted into the sandbox for `grok-xsearch`.
  - Real keys sit in mounted `secrets/*.env` files.
  - Egress does not cover mounted files. Fix: `grok-xsearch` calls the core llm gateway instead, and tools get proxy tokens through env instead of files.

**Secrets (Vaultwarden)**
- Hermes's bundled Bitwarden source uses Bitwarden *Secrets Manager* (`bws`). I don't believe Vaultwarden implements that API (not verified here).
- The generic `command` source works with any CLI, but its helper limit is 3 s. Measured `bw` against our Vaultwarden: unlock 4.5 s, list 3.5 s. Too slow to call directly.
- Design:
  - Each agent has its own Vaultwarden account. agent001@a9n9.net already exists, with 8 items.
  - At boot, a `vw-sync` unit on the agent VM unlocks that account and writes `/run/a9n9/agent.env` (tmpfs, 0600).
  - Hermes's command source is `cat /run/a9n9/agent.env`.
  - That gives central rotation and backup, and each VM can unlock only its own account. The unlock secret must still be on the VM, so this does not protect against a compromised VM. Egress plus the signer do that.
- Most agent001 secrets are files in `~/a9n9/secrets`, not in Vaultwarden yet. Migrating them is part of building the agent kit.
