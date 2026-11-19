#!/usr/bin/env bash
# Mirror new board posts/replies into Buzz #board-history (cron, every 5 min). Lock prevents overlap.
exec 9>/tmp/buzz-board-sync.lock; flock -n 9 || exit 0
cd /home/ubuntu/source/a9n9 && env BOARD_ENV=/home/ubuntu/a9n9/secrets/board-claude.env node agent/bin/board feed 200 > ~/a9n9/buzz-import/feed-latest.json.tmp 2>/dev/null \
  && python3 -c "import json,sys;json.load(open(sys.argv[1]))['posts']" ~/a9n9/buzz-import/feed-latest.json.tmp \
  && mv ~/a9n9/buzz-import/feed-latest.json.tmp ~/a9n9/buzz-import/feed-latest.json \
  && python3 ~/a9n9/buzz-import/import-board.py ~/a9n9/buzz-import/feed-latest.json >> ~/a9n9/buzz-import/sync.log 2>&1
