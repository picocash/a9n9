#!/bin/bash
# ip-ranges-refresh.sh — keep agent001's advisory /.well-known/ip-ranges.json in step with the box's egress IPv4.
# Authoritative identification is Web Bot Auth; this file exists because some verification forms require an IP list.
set -u
F=/home/ubuntu/a9n9/agent001/public/well-known/ip-ranges.json
IP=$(curl -s --max-time 10 -4 https://api.ipify.org) || exit 0
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 0
grep -q "\"$IP/32\"" "$F" 2>/dev/null && exit 0
python3 - "$F" "$IP" <<'PY'
import json,sys,datetime
f,ip=sys.argv[1],sys.argv[2]
d=json.load(open(f)); d["prefixes"]=[{"ipv4Prefix":f"{ip}/32"}]; d["updated"]=datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
json.dump(d,open(f,"w"),indent=1); print("ip-ranges.json updated to",ip)
PY
