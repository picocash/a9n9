#!/usr/bin/env node
// Outcome snapshot for the hourly coordinator review: one key number per agent and its 72 h change.
// Appends to ~/a9n9/state/outcomes-snapshots.jsonl; flags an agent whose number has not moved in 72 h.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const LOG = `${process.env.HOME}/a9n9/state/outcomes-snapshots.jsonl`;
const sh = (c) => execSync(c, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'] });
const now = Date.now(), H72 = 72 * 3600e3;
const snap = { at: new Date(now).toISOString() };
try { snap.agent003_members = JSON.parse(sh(`ssh genxlinked 'docker exec a9n9-agent003 /agent/bin/desk status'`)).members; } catch { snap.agent003_members = null; }
try {
  // agent002: visits from all sources and from its own links (agent + bsky/playlin/gameslash tags), now vs 72 h ago, from its hash-chained KPI facts
  const py = `import json,sys,time
rows=[json.loads(l) for l in open('/home/ubuntu/a9n9/agent002/kpi/facts.jsonl') if '"game.visits"' in l]
def at(cut):
  best={}
  for r in rows:
    if r['at']<=cut: best[r['subject']]=r['value']
  own=sum(v for s,v in best.items() if s=='agent' or s.startswith(('src:bsky','src:playlin','src:gameslash','src:ilovewebgames')))
  return best.get('all',0),own
now=time.strftime('%Y-%m-%dT%H:%M:%S',time.gmtime()); old=time.strftime('%Y-%m-%dT%H:%M:%S',time.gmtime(time.time()-259200))
print(json.dumps({'now':at(now+'Z'),'then':at(old+'Z')}))`;
  const r = JSON.parse(execSync('ssh beatthechefs python3 -', { input: py, encoding: 'utf8', timeout: 60000 }));
  snap.agent002_visits_all = r.now[0]; snap.agent002_visits_own = r.now[1];
  snap.agent002_visits_all_72h = r.now[0] - r.then[0]; snap.agent002_visits_own_72h = r.now[1] - r.then[1];
} catch (e) { snap.agent002_error = String(e.message).slice(0, 120); }
fs.appendFileSync(LOG, JSON.stringify(snap) + '\n');
const old = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((s) => now - Date.parse(s.at) >= H72).pop();
if (old && snap.agent003_members != null && old.agent003_members != null) snap.agent003_members_72h = snap.agent003_members - old.agent003_members;
const flags = [];
if (snap.agent003_members_72h === 0) flags.push('agent003: members flat 72h');
if (snap.agent002_visits_own_72h === 0) flags.push('agent002: 0 visits from its own links in 72h');
console.log(JSON.stringify({ ...snap, flags }, null, 1));
