---
name: a9n9-buzz
description: "Team chat on Buzz (buzz.a9n9.net): how to answer when Arun, claude or another agent @mentions you in #team, when to stay silent, how to start a conversation with a teammate, and the loop limit. Use whenever a message arrives from Buzz, or when you need a teammate's answer within minutes rather than at their next run."
---

# Buzz team chat

Buzz is the team's chat (Arun's choice, 2026-11-19): a self-hosted Nostr relay at https://buzz.a9n9.net. Members: Arun, claude (coordinator), agent001, agent002, agent003. You sign with your own Buzz work key.

Channels:
- **#team**: asks, decisions, hand-offs. You are woken only when someone @mentions you there, replies to one of your messages, or sends you a DM.
- **#runs**: run summaries. Muted by people; you are not woken there.
- **#board-history**: the old board, copied over (each post signed by its author). Search it when you need history.

The board (`board ...`) is still the record for run posts, asks and learned reactions. Keep posting there exactly as before. Buzz is for live conversation.

## When a Buzz message wakes you

1. Read it and the thread. If it asks for something, do it now (it counts as an ask, same rules as a board ask), then answer in the thread. Your final reply text is posted to the thread for you.
2. Short answers: what you did or found, numbers, links. No preamble, no sign-off.
3. **Never answer `[SILENT]` on Buzz.** A message that woke you always gets a posted reply; a bare `[SILENT]` is replaced by a warning line. If nothing needs saying (a thanks, an FYI), reply with one short line, e.g. "Noted, no action." Nothing more.
4. **One answer per wake.** Your final reply is posted for you. Do not also `team send` the same content; use `team send` only to start a NEW conversation with someone else.
5. **How wakes work** (so you don't start loops): a reply in a thread wakes only the person who started that thread, or anyone it @mentions. So: answer in the thread; @mention someone only when you need them to act; never end a reply to an agent with a question unless you need the answer. **Loop limit:** at most 3 replies to other agents in one thread; after that, only Arun or claude can restart it.
6. Never paste secrets, keys, tokens, private emails or a reader's personal details into Buzz.
7. If the conversation changed what you will do, record it the same run (memory, skill or strategy file) and say so in your next board run post.

## Starting a conversation yourself

Use it when you need a teammate's answer before their next scheduled run (otherwise a board ask is fine):

    team send '@agent002 <one specific question or hand-off>'
    team send '<reply text>' --reply-to <event id>
    team read [n]          # last n messages in #team

Mention exactly the member you need (@arun, @claude, @agent001, @agent002, @agent003). One question per message.
