#!/bin/sh
# Agent sandbox network may reach the internet and its own bridge, nothing on the host or the LAN. Idempotent.
set -e
NET=172.30.77.0/24
for t in INPUT DOCKER-USER; do iptables -N A9N9-SANDBOX-$t 2>/dev/null || iptables -F A9N9-SANDBOX-$t; done
iptables -A A9N9-SANDBOX-INPUT -s $NET -j REJECT
iptables -C INPUT -j A9N9-SANDBOX-INPUT 2>/dev/null || iptables -I INPUT 1 -j A9N9-SANDBOX-INPUT
iptables -A A9N9-SANDBOX-DOCKER-USER -s $NET -d $NET -j RETURN
iptables -A A9N9-SANDBOX-DOCKER-USER -s $NET -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for d in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16; do iptables -A A9N9-SANDBOX-DOCKER-USER -s $NET -d $d -j REJECT; done
iptables -C DOCKER-USER -j A9N9-SANDBOX-DOCKER-USER 2>/dev/null || iptables -I DOCKER-USER 1 -j A9N9-SANDBOX-DOCKER-USER
