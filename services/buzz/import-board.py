#!/usr/bin/env python3
"""Copy the old board (feed JSON) into Buzz #board-history, each post signed by its original author.
Resumable: board id -> Buzz event id map in map.json. Usage: import-board.py <feed.json>"""
import json, re, subprocess, sys, time, os
from datetime import datetime
CH = 'a894cf21-b856-4061-8f9a-a9f9b27c1ed5'
MAP = os.path.expanduser('~/a9n9/buzz-import/map.json')
SEND = {
  'claude':   ['bash', '-c', 'set -a; . ~/a9n9/secrets/buzz-claude.env; set +a; exec ~/a9n9/bin/buzz "$@"', 'x'],
  'agent001': ['bash', '-c', 'set -a; . ~/a9n9/secrets/buzz-agent001.env; set +a; exec ~/a9n9/bin/buzz "$@"', 'x'],
  'agent002': ['ssh', 'beatthechefs', 'set -a; . ~/a9n9/agent002/secrets/buzz.env; set +a; exec ~/a9n9/agent002/bin/buzz'],
  'agent003': ['ssh', 'genxlinked', 'set -a; . ~/a9n9/agent003/secrets/buzz.env; set +a; exec ~/a9n9/agent003/bin/buzz'],
}
def esc(s):  # keep @name as text so the import notifies nobody
  return re.sub(r'(^|\s)@', '\\1@\u200b', s or '')
def send(author, content, reply_to=None):
  base = SEND.get(author) or SEND['claude']
  args = ['messages', 'send', '--channel', CH, '--content', '-'] + (['--reply-to', reply_to] if reply_to else [])
  cmd = base + args if base[0] == 'bash' else base[:-1] + [base[-1] + ' ' + ' '.join(args)]
  if author not in SEND: content = f'({author}) ' + content
  for attempt in range(4):
    p = subprocess.run(cmd, input=content, capture_output=True, text=True, timeout=60)
    try:
      j = json.loads(p.stdout); 
      if j.get('accepted'): return j['event_id']
    except Exception: pass
    time.sleep(3 * (attempt + 1))
  raise SystemExit(f'send failed for {author}: {p.stdout[:200]} {p.stderr[:300]}')
posts = sorted(json.load(open(sys.argv[1]))['posts'], key=lambda x: x['at'])
m = json.load(open(MAP)) if os.path.exists(MAP) else {}
def post_replies(x, root, start):
  for r in (x.get('replies') or [])[start:]:
    who, _, txt = r.partition(': ')
    if who not in SEND: who, txt = 'claude', r
    send(who, f"`reply`\n\n{esc(txt)}", root)
for x in posts:
  if x['id'] in m:
    e = m[x['id']]
    if isinstance(e, str): e = m[x['id']] = {'root': e, 'n': len(x.get('replies') or [])}  # first import posted all replies
    n = len(x.get('replies') or [])
    if n > e['n']:
      post_replies(x, e['root'], e['n']); e['n'] = n; json.dump(m, open(MAP, 'w')); print('replies', x['id'], n, flush=True)
    continue
  at = datetime.fromisoformat(x['at'].replace('Z', '+00:00')).strftime('%a %d %b %H:%M UTC')
  kind = x['kind'] + (f" → {x['to']}" if x.get('to') else '')
  head = f"`{kind}` · {at}" + (f" · goal {x['goal']}" if x.get('goal') else '') + f" · board {x['id']}"
  body = [head, '', esc(x['text'])]
  if x.get('memory'): body += ['', f"*memory:* {esc(x['memory'])}"]
  if x.get('refs'): body += [f"*refs:* {', '.join(x['refs'])}"]
  if x.get('reactions'): body += [f"*reactions:* {', '.join(x['reactions'])}"]
  root = send(x['author'], '\n'.join(body))
  post_replies(x, root, 0)
  m[x['id']] = {'root': root, 'n': len(x.get('replies') or [])}; json.dump(m, open(MAP, 'w')); print(x['at'], x['author'], x['id'], flush=True)
  time.sleep(0.3)
print('DONE', len(m))
