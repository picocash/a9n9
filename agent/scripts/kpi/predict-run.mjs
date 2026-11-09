// predict-run (agent001): files queued predictions with the latest host KPI reading as baseline and settles each with the first
// KPI reading after its date (crontab, every 5 minutes). Ledger: ~/a9n9/agent001/predictions/{open,settled,rejected}, summary.json;
// read-only to the agent. Log: state/predictions.jsonl.
import fs from 'node:fs';
const ROOT = process.env.AGENT_ROOT || '/home/ubuntu/a9n9/agent001';
const IN = `${ROOT}/state/predictions/inbox`, L = `${ROOT}/predictions`, LOG = `${ROOT}/state/predictions.jsonl`, F = `${ROOT}/kpi/facts.jsonl`;
for (const d of ['open', 'settled', 'rejected']) fs.mkdirSync(`${L}/${d}`, { recursive: true });
const read = (d) => fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => ({ f: `${d}/${f}`, p: JSON.parse(fs.readFileSync(`${d}/${f}`, 'utf8')) }));
const log = (o) => fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n');
const facts = fs.existsSync(F) ? fs.readFileSync(F, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.t === 'fact') : [];
const latest = (m) => facts.filter((f) => f.metric === m).at(-1);
const firstAfter = (m, t) => facts.find((f) => f.metric === m && Date.parse(f.at) > t);
const inbox = fs.existsSync(IN) ? fs.readdirSync(IN).filter((f) => /^\d+-[0-9a-f]{6}\.json$/.test(f)) : [];
for (const f of inbox.sort()) {
  const path = `${IN}/${f}`; let p; try { p = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { fs.rmSync(path); continue; }
  const id = f.slice(0, -5); const b = latest(p.metric);
  if (!b) { if (Date.now() - Number(id.split('-')[0]) > 3 * 3600e3) { fs.writeFileSync(`${L}/rejected/${id}.json`, JSON.stringify({ ...p, id, reason: `no KPI reading for ${p.metric}` }, null, 1)); fs.rmSync(path); } continue; }
  const rec = { id, goal: p.goal, filedAt: p.filedAt, frozenAt: new Date().toISOString(), metric: p.metric, subject: 'agent001', baseline: b.value, baselineAt: b.at, baselineReceipt: b.receipt, atLeast: Number(p.atLeast), by: p.by, chance: Number(p.chance), change: String(p.change).slice(0, 400), because: String(p.because).slice(0, 600) };
  if (rec.atLeast <= rec.baseline) { fs.writeFileSync(`${L}/rejected/${id}.json`, JSON.stringify({ ...rec, reason: `already at ${rec.baseline}, which meets --at-least ${rec.atLeast}: predict a level the change has to earn` }, null, 1)); log({ ev: 'rejected', id, metric: rec.metric, baseline: rec.baseline }); }
  else { fs.writeFileSync(`${L}/open/${id}.json`, JSON.stringify(rec, null, 1)); log({ ev: 'filed', id, goal: rec.goal, metric: rec.metric, baseline: rec.baseline, atLeast: rec.atLeast, chance: rec.chance, by: rec.by }); }
  fs.rmSync(path);
}
for (const { f, p } of read(`${L}/open`)) {
  const end = Date.parse(`${p.by}T23:59:59Z`); if (Date.now() <= end) continue;
  const r = firstAfter(p.metric, end); if (!r) continue; // waits for the next hourly reading
  const hit = r.value >= p.atLeast; const rec = { ...p, actual: r.value, actualAt: r.at, actualReceipt: r.receipt, hit, settledAt: new Date().toISOString(), brier: +((p.chance - (hit ? 1 : 0)) ** 2).toFixed(4) };
  fs.writeFileSync(`${L}/settled/${p.id}.json`, JSON.stringify(rec, null, 1)); fs.rmSync(f);
  log({ ev: 'settled', id: p.id, goal: p.goal, metric: p.metric, baseline: p.baseline, atLeast: p.atLeast, actual: r.value, chance: p.chance, hit });
}
const s = read(`${L}/settled`).map((x) => x.p);
fs.writeFileSync(`${L}/summary.json`, JSON.stringify({ at: new Date().toISOString(), open: read(`${L}/open`).length, settled: s.length, hits: s.filter((x) => x.hit).length,
  hitRate: s.length ? +(s.filter((x) => x.hit).length / s.length).toFixed(3) : null, meanChance: s.length ? +(s.reduce((n, x) => n + x.chance, 0) / s.length).toFixed(3) : null,
  brier: s.length ? +(s.reduce((n, x) => n + x.brier, 0) / s.length).toFixed(4) : null, note: 'well calibrated = hitRate close to meanChance; Brier 0.25 is what always saying 0.5 scores' }, null, 1));
