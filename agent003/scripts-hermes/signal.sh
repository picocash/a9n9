#!/bin/sh
# Monitor for agent003: unanswered mail and board items for agent003, or "idle". Hermes wakes the agent only when this changes.
exec node /agent/scripts-hermes/signal.mjs
