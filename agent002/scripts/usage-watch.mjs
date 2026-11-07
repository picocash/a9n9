// usage-watch: runs on the host every 10 minutes (crontab). Reads agent002's Hermes state.db and records LLM usage for every run:
// each time a session's usage grows, one line goes to state/llm-usage.jsonl with the increase per model (tokens, estimated USD).
// Writes state/llm-usage-today.json, and pauses agent002 (state/PAUSED + `hermes cron pause`) once today's spend passes the cap;
// lifts its own pause the next day. Hermes leaves ended_at empty for cron/one-shot sessions, so we track deltas, not endings.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.AGENT002_ROOT || '/home/ubuntu/a9n9/agent002'; const DB = `${ROOT}/hermes/state.db`; const ST = `${ROOT}/state`;
const CAP = Number(process.env.AGENT002_DAILY_USD || 5); const CONTAINER = 'a9n9-agent002';
const jobIds = () => { try { const d = JSON.parse(fs.readFileSync(`${ROOT}/hermes/cron/jobs.json`, 'utf8')); return (d.jobs ?? d).map((j) => j.id); } catch { return []; } };
const cron = (verb) => { for (const j of jobIds()) try { execFileSync('docker', ['exec', '-u', 'hermes', '-e', 'HOME=/opt/data', CONTAINER, 'hermes', 'cron', verb, j]); } catch (e) { fs.appendFileSync(`${ST}/usage-watch.log`, `${new Date().toISOString()} cron ${verb} ${j} failed: ${e.message}\n`); } };
if (!fs.existsSync(DB)) process.exit(0);
const py = `
import sqlite3, json
c = sqlite3.connect('file:${DB}?mode=ro', uri=True)
out = {}
for r in c.execute("select u.session_id, s.source, u.model, coalesce(nullif(u.task,''),'main'), u.api_call_count, u.input_tokens, u.output_tokens, u.cache_read_tokens, u.cache_write_tokens, u.reasoning_tokens, coalesce(nullif(u.actual_cost_usd,0), u.estimated_cost_usd, 0) from session_model_usage u left join sessions s on s.id=u.session_id"):
    k = r[0] + '|' + r[2] + '|' + r[3]
    out[k] = dict(session=r[0], source=r[1], model=r[2], task=r[3], calls=r[4] or 0, inp=r[5] or 0, out=r[6] or 0, cacheRead=r[7] or 0, cacheWrite=r[8] or 0, reasoning=r[9] or 0, usd=r[10] or 0)
print(json.dumps(out))`;
const now = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8' }));
const lastF = `${ST}/llm-usage-last.json`; const last = fs.existsSync(lastF) ? JSON.parse(fs.readFileSync(lastF, 'utf8')) : {};
const at = new Date().toISOString(); const bySession = {};
for (const [k, v] of Object.entries(now)) { const p = last[k] ?? {}; const d = { calls: v.calls - (p.calls ?? 0), in: v.inp - (p.inp ?? 0), out: v.out - (p.out ?? 0), cacheRead: v.cacheRead - (p.cacheRead ?? 0), cacheWrite: v.cacheWrite - (p.cacheWrite ?? 0), reasoning: v.reasoning - (p.reasoning ?? 0), usd: +(v.usd - (p.usd ?? 0)).toFixed(6) };
  if (!d.calls && !d.usd) continue; (bySession[v.session] ??= { at, session: v.session, source: v.source, usd: 0, models: [] });
  bySession[v.session].models.push({ model: v.model, task: v.task, ...d }); bySession[v.session].usd = +(bySession[v.session].usd + d.usd).toFixed(6); }
for (const row of Object.values(bySession)) fs.appendFileSync(`${ST}/llm-usage.jsonl`, JSON.stringify(row) + '\n');
fs.writeFileSync(lastF, JSON.stringify(now));
const lines = fs.existsSync(`${ST}/llm-usage.jsonl`) ? fs.readFileSync(`${ST}/llm-usage.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const day = at.slice(0, 10); const todays = lines.filter((l) => l.at.startsWith(day)); const usd = todays.reduce((a, l) => a + l.usd, 0);
const byModel = {}; for (const l of todays) for (const m of l.models) { const b = (byModel[m.model] ??= { calls: 0, in: 0, out: 0, cacheRead: 0, usd: 0 }); b.calls += m.calls; b.in += m.in; b.out += m.out; b.cacheRead += m.cacheRead; b.usd = +(b.usd + m.usd).toFixed(6); }
const summary = { day, sessions: new Set(todays.map((l) => l.session)).size, usd: +usd.toFixed(4), capUsd: CAP, byModel, totalUsd: +lines.reduce((a, l) => a + l.usd, 0).toFixed(4), since: lines[0]?.at ?? null, updated: at };
fs.writeFileSync(`${ST}/llm-usage-today.json`, JSON.stringify(summary, null, 1));
const pausedF = `${ST}/PAUSED`; const pausedTxt = fs.existsSync(pausedF) ? fs.readFileSync(pausedF, 'utf8') : '';
if (usd > CAP && !pausedTxt) { fs.writeFileSync(pausedF, `daily model spend $${usd.toFixed(2)} passed the $${CAP} cap on ${day}; resumes tomorrow`); cron('pause'); }
else if (/daily model spend/.test(pausedTxt) && !pausedTxt.includes(day)) { fs.rmSync(pausedF); cron('resume'); }
console.log(JSON.stringify(summary));
