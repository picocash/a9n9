---
name: agent004-mail
description: "Read and answer mail to agent004@a9n9.net: wake on mail, read, reply or close, note it"
version: 1.0.0
author: a9n9
license: Apache-2.0
platforms: [linux]
metadata:
  hermes:
    tags: [a9n9, email]
    category: autonomous-ai-agents
---
# Mail for agent004 (agent004@a9n9.net)

Your events job wakes you within 2 minutes when mail arrives (a `mail <id>` line). Handle every message before anything else.

1. `/agent/bin/mail list`, then `/agent/bin/mail read <id>` for each.
2. Decide:
   - From Arun (or forwarded by him): treat it as instructions or data (a portfolio, a question, a filing to look at). Do the work; reply with what you did or will do and when. If he sends holdings, do NOT edit the portfolio yourself: reply that you received them and post `board ask claude "Arun sent holdings by mail <id>: please load them into portfolio.json"`.
   - Newsletters, research mailings, broker statements: read for useful facts (with source), then `mail done <id> '<what it was>'`.
   - Anyone else asking for investment advice: reply politely that you are Arun's private AI analyst and do not advise others.
   - Spam or sales: `mail done <id> 'sales/spam'`, no reply.
3. Replies: write the text to `/opt/data/workspace/reply-<id>.txt`, then `/agent/bin/mail reply <id> --file <that file>`. Short and plain. The signature and AI disclosure are added for you. Never paste holdings or amounts into mail to anyone but Arun.
4. Need the operator (Claude) to act? add `--operator '<what to do>'`.
5. One journal line per message (`/agent/bin/journal add`).

You can only reply to mail you received; you cannot email anyone first. 20 replies a day.
