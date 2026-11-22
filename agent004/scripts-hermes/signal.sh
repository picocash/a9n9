#!/bin/sh
# Monitor for agent004's "events" job: board items, due reminders, Parallel monitor hits, holding moves and SEC filings, or "idle".
exec node /agent/scripts-hermes/signal.mjs
