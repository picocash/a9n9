#!/bin/sh
# The agent's tools address platform services on loopback. The sandbox network holds only these three.
socat TCP-LISTEN:8810,bind=127.0.0.1,fork,reuseaddr TCP:inbox:8810 &
socat TCP-LISTEN:8830,bind=127.0.0.1,fork,reuseaddr TCP:nostr:8830 &
socat TCP-LISTEN:8860,bind=127.0.0.1,fork,reuseaddr TCP:tools:8860 &
exec "$@"
