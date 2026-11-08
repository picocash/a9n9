// judge-run: host side of agent002's quality gate (crontab, every 2 minutes). Takes drafts the agent queued in
// state/judge/inbox, checks the key matches the text, scores each with the independent judge (a9n9/scripts/judge, median of
// 3 calls) and writes judge/results/<sha>.json, which the container sees read-only at /agent/judge/results. Logs every
// verdict to state/judge.jsonl. At most 30 new drafts a day; the rest wait in the inbox until tomorrow.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { score } from '../../scripts/judge/judge.mjs';
const ROOT = process.env.AGENT002_ROOT || '/home/ubuntu/a9n9/agent002';
const IN = `${ROOT}/state/judge/inbox`, RES = `${ROOT}/judge/results`, LOG = `${ROOT}/state/judge.jsonl`;
const DAILY = 30, PASS = 50;
fs.mkdirSync(RES, { recursive: true });
if (!fs.existsSync(IN)) process.exit(0);
const lock = `${ROOT}/state/judge/.running`;
if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 15 * 60_000) process.exit(0);
fs.writeFileSync(lock, String(process.pid));
try {
  const day = new Date().toISOString().slice(0, 10);
  const done = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`"at":"${day}`)).length : 0;
  let left = DAILY - done;
  for (const f of fs.readdirSync(IN).filter((f) => /^[0-9a-f]{64}\.json$/.test(f)).sort()) {
    if (left <= 0) break;
    const sha = f.slice(0, 64); const p = `${IN}/${f}`;
    let q; try { q = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fs.rmSync(p); continue; }
    const key = crypto.createHash('sha256').update(`${q.title ?? ''}\n\n${String(q.text ?? '').trim()}`).digest('hex');
    if (key !== sha || fs.existsSync(`${RES}/${sha}.json`)) { fs.rmSync(p); continue; }
    let r;
    try { const j = await score(q.text, q.title, 3); r = { sha, at: new Date().toISOString(), kind: q.kind, title: q.title, pull: j.pull, pullRuns: j.pullRuns, pass: j.pull >= PASS, scores: j.scores, strongest: j.strongest, weakest: j.weakest, fix: j.fix, model: process.env.JUDGE_MODEL || 'grok-4.20-0309-non-reasoning' }; }
    catch (e) { console.error(new Date().toISOString(), sha.slice(0, 12), e.message); continue; } // stays queued, retried next run
    fs.writeFileSync(`${RES}/${sha}.json`, JSON.stringify(r, null, 1)); fs.rmSync(p); left--;
    fs.appendFileSync(LOG, JSON.stringify({ at: r.at, sha, kind: r.kind, title: r.title, pull: r.pull, pass: r.pass, weakest: r.weakest }) + '\n');
  }
} finally { fs.rmSync(lock, { force: true }); }
