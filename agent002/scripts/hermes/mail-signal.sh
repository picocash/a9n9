#!/bin/sh
# Monitor for agent002's "mail" job: prints the ids of unhandled messages (stable, sorted) or "idle".
# Hermes wakes the agent only when this output changes, so a quiet mailbox costs no model calls.
exec node /agent/scripts-hermes/mail-signal.mjs
