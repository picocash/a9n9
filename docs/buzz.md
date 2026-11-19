# Buzz team relay

Self-hosted [Buzz](https://github.com/block/buzz) relay for Arun, claude and the agents (decided by Arun 2026-11-19).

- **Where:** Proxmox VM 106 "buzz", 10.0.1.45 (`ssh buzz`), Docker Compose bundle in `~/buzz-src/deploy/compose`
  (`./run.sh status|logs|restart`). Public: `https://buzz.a9n9.net` / `wss://buzz.a9n9.net` via the household tunnel.
  The relay picks the community by hostname, so clients and agents must use `buzz.a9n9.net` (the LAN IP returns 404).
- **Version:** pinned image `ghcr.io/block/buzz:sha-b68c4ed`. `buzz` CLI built from the same commit (`~/buzz-build/buzz` on the VM,
  copies at `.101:~/a9n9/bin/buzz` and `VM105:~/a9n9/agent003/bin/buzz`). Upgrade relay and CLI together, test before rollout.
- **Mode:** closed membership (`BUZZ_REQUIRE_RELAY_MEMBERSHIP=true`). Owner key and relay key live only on the VM (`~/buzz-keys`, `.env`, mode 600).
  Members are added with `docker exec buzz-prod-relay-1 buzz-admin add-member --pubkey <hex|npub> [--role admin]`.

## Members (public keys)

| who | pubkey | role |
|---|---|---|
| owner (VM-held key) | 4d0aeeb0f74bbbe3d4d9f7d6005d4f5295e33fd711033348319209d2abd3d369 | owner |
| claude | 862e247d1ea2cce295517f513b5a5de7f8fbada6d98acd5c02f4f79889d2bf91 | admin |
| agent001 | 7a9200c0393ed80a29b1e6612d73b8d1bd63b4ec4a23579d7b68d724c28382fd | member |
| agent002 | 6611f85f55b92a5669c1117679eb10e8cfe2e0dc43dcaaf5f46921c6d2a776e9 | member |
| agent003 | fbf005a42d232c471e5f74053c7cdb8e047062061e40807b27f21f19c59b6657 | member |

Agent private keys: `secrets/buzz.env` in each agent's home on its own host (`.101:~/a9n9/secrets/buzz-{claude,agent001}.env`).
These are separate work keys, not the agents' public Nostr identities.

## Channels

- `#team` bf0c0e7a-8d09-493a-b433-03caa1afa4d4: asks, decisions, hand-offs; @mention who you need.
- `#runs` 4dfe054e-d042-45a7-899c-5ffa05fc0e09: run posts (Hermes home channel); mute it.

## Hermes agents

Hermes v0.22.5 ships `plugins/platforms/buzz`, run by `hermes gateway run`. Per agent, in its Hermes `.env`:
`BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`, `BUZZ_CLI_PATH`, `BUZZ_CHANNELS` (team), `BUZZ_HOME_CHANNEL` (runs),
`BUZZ_ALLOWED_USERS` (claude + the other agents + Arun), `BUZZ_REQUIRE_MENTION=true`; and in config.yaml
`display.platforms.buzz.tool_progress: off` (otherwise "Running ..." lines are posted).
An agent wakes only on an @mention, a reply to its own message, or a DM. Hermes' bot-loop guard does NOT apply to Buzz
(the adapter never marks senders as bots), so agent-to-agent loops are limited by skill rules: answer `[SILENT]` when
nothing needs saying, at most 3 agent-to-agent turns per thread before a person or claude steps in.

Status 2026-11-19: agent003 connected and answered a test mention in #team. agent001/agent002 and Arun not yet connected.
