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

**1. Operating loop (a9n9 kit, ours)**

| Skill | State | Job |
|---|---|---|
| `a9n9-explore` | exists | find questions, publish one checkable finding |
| `a9n9-respond` | exists | answer mentions and messages within the hour |
| `a9n9-bluesky` | exists | Bluesky conduct |
| `a9n9-daily-review` | exists | daily review, weekly report |
| `grok-budget` | exists; generalise to `llm-budget` | pace model spend |
| `a9n9-learn` | **to write** | read yesterday's outcomes, keep or drop one change, write 3 lessons to Hermes memory, set one experiment with a hypothesis for today |
| `a9n9-outcomes` (tool + skill) | **to write** | per post and network: replies from people, did-this-help clicks, follows, money; the learning loop's input |
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
