// predict-run: host side of agent002's prediction ledger (crontab, every 2 minutes). Files each request the agent queued in
// state/predictions/inbox with a baseline the host measures itself, and settles each open prediction after its date with a
// final host measurement. Writes predictions/{open,settled,rejected}/<id>.json and predictions/summary.json, which the
// container sees read-only at /agent/predictions, and logs every event to state/predictions.jsonl. The agent never grades itself.
import fs from 'node:fs';
import { gameStats } from './game-stats.mjs';
const ROOT = process.env.AGENT_ROOT || '/home/ubuntu/a9n9/agent002';
const SECRETS = process.env.SECRETS || '/home/ubuntu/a9n9/secrets';
const VOID = `${ROOT}/state/predictions/void`, IN = `${ROOT}/state/predictions/inbox`, L = `${ROOT}/predictions`, LOG = `${ROOT}/state/predictions.jsonl`;
const ORG = 'a9n9-agent002';
for (const d of ['open', 'settled', 'rejected', 'voided', 'void-refused']) fs.mkdirSync(`${L}/${d}`, { recursive: true });
const env = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const read = (d) => fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => ({ f: `${d}/${f}`, p: JSON.parse(fs.readFileSync(`${d}/${f}`, 'utf8')) }));
const log = (o) => fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n');
const lock = `${L}/.running`;
if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < 10 * 60_000) process.exit(0);
const inbox = fs.existsSync(IN) ? fs.readdirSync(IN).filter((f) => /^\d+-[0-9a-f]{6}\.json$/.test(f)) : [];
const due = read(`${L}/open`).filter(({ p }) => Date.now() > Date.parse(`${p.by}T23:59:59Z`));
// void requests (agent002 4ad580558f): the agent may take back a prediction whose change it never made. Voided only while that cannot be a
// way out of a miss: filed in the last 72 hours, date 3 or more days away, and the host's reading still at the baseline.
const voids = fs.existsSync(VOID) ? fs.readdirSync(VOID).filter((f) => /^\d+-[0-9a-f]{6}\.json$/.test(f)) : [];
if (!inbox.length && !due.length && !voids.length) process.exit(0);
fs.writeFileSync(lock, String(process.pid));
let devto = null, game = null; const gh = {};
async function measure(metric, subject) {
  if (metric.startsWith('game.')) { game ??= gameStats(); return game.by[subject]?.[metric.slice(5)] ?? 0; }
  if (metric.startsWith('devto.')) {
    if (!devto) { const r = await fetch('https://dev.to/api/articles/me/all?per_page=1000', { headers: { 'api-key': env(`${SECRETS}/agent002-devto.env`).DEVTO_API_KEY, accept: 'application/vnd.forem.api-v1+json' } });
      if (!r.ok) throw new Error(`dev.to ${r.status}`); devto = await r.json(); }
    const a = devto.find((x) => String(x.id) === String(subject)); if (!a) throw new Error(`article ${subject} not found`);
    return { 'devto.views': a.page_views_count, 'devto.reactions': a.public_reactions_count, 'devto.comments': a.comments_count }[metric];
  }
  const T = env(`${SECRETS}/agent002-github.env`).GITHUB_TOKEN;
  const get = async (p) => { const r = await fetch(`https://api.github.com${p}`, { headers: { authorization: `Bearer ${T}`, accept: 'application/vnd.github+json', 'user-agent': 'a9n9-predict' } }); if (!r.ok) throw new Error(`GitHub ${r.status} ${p}`); return r.json(); };
  if (metric === 'github.stars') return (await get(`/repos/${ORG}/${subject}`)).stargazers_count;
  gh[subject] ??= await get(`/repos/${ORG}/${subject}/traffic/views`);
  return metric === 'github.views14d' ? gh[subject].count : gh[subject].uniques;
}
try {
  for (const f of inbox.sort()) {
    const path = `${IN}/${f}`; let p; try { p = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { fs.rmSync(path); continue; }
    const id = f.slice(0, -5);
    try {
      const baseline = await measure(p.metric, p.subject);
      if (baseline == null) throw new Error('no reading');
      const rec = { id, goal: p.goal ?? null, filedAt: p.filedAt, frozenAt: new Date().toISOString(), metric: p.metric, subject: String(p.subject), baseline, atLeast: Number(p.atLeast), by: p.by, chance: Number(p.chance), change: String(p.change).slice(0, 400), because: String(p.because).slice(0, 600) };
      if (rec.atLeast <= baseline) { fs.writeFileSync(`${L}/rejected/${id}.json`, JSON.stringify({ ...rec, reason: `already at ${baseline}, which meets --at-least ${rec.atLeast}: predict a level the change has to earn` }, null, 1)); log({ ev: 'rejected', id, metric: rec.metric, subject: rec.subject, baseline }); }
      else { fs.writeFileSync(`${L}/open/${id}.json`, JSON.stringify(rec, null, 1)); log({ ev: 'filed', id, metric: rec.metric, subject: rec.subject, baseline, atLeast: rec.atLeast, chance: rec.chance, by: rec.by }); }
      fs.rmSync(path);
    } catch (e) {
      if (/not found|404/.test(e.message)) { fs.writeFileSync(`${L}/rejected/${id}.json`, JSON.stringify({ ...p, id, reason: e.message }, null, 1)); fs.rmSync(path); log({ ev: 'rejected', id, reason: e.message }); }
      else console.error(new Date().toISOString(), id, e.message); // stays queued, retried next run
    }
  }
  for (const vf of voids) {
    const id = vf.slice(0, -5), req = `${VOID}/${vf}`, of = `${L}/open/${id}.json`;
    try {
      let q = {}; try { q = JSON.parse(fs.readFileSync(req, 'utf8')); } catch {}
      const refuse = (reason) => { fs.writeFileSync(`${L}/void-refused/${id}.json`, JSON.stringify({ id, at: new Date().toISOString(), reason }, null, 1)); log({ ev: 'void-refused', id, reason }); fs.rmSync(req); };
      if (!fs.existsSync(of)) { refuse('not an open prediction'); continue; }
      const p = JSON.parse(fs.readFileSync(of, 'utf8'));
      if (Date.now() - Date.parse(p.filedAt) > 72 * 3600e3) { refuse('filed more than 72 hours ago: it stays open and settles on its date'); continue; }
      if (Date.parse(`${p.by}T23:59:59Z`) - Date.now() < 3 * 864e5) { refuse('its date is less than 3 days away: it settles on its date'); continue; }
      const actual = await measure(p.metric, p.subject);
      if (actual !== p.baseline) { refuse(`the reading moved from ${p.baseline} to ${actual}, so the change was made: it settles on its date`); continue; }
      fs.writeFileSync(`${L}/voided/${id}.json`, JSON.stringify({ ...p, voidedAt: new Date().toISOString(), voidWhy: String(q.why ?? '').slice(0, 300), readingAtVoid: actual }, null, 1)); fs.rmSync(of); fs.rmSync(req); fs.rmSync(`${L}/void-refused/${id}.json`, { force: true });
      log({ ev: 'voided', id, metric: p.metric, subject: p.subject, why: String(q.why ?? '').slice(0, 300) });
    } catch (e) { console.error(new Date().toISOString(), 'void', id, e.message); }
  }
  for (const { f, p } of due) {
    try {
      const actual = await measure(p.metric, p.subject); const hit = actual >= p.atLeast;
      const rec = { ...p, actual, hit, settledAt: new Date().toISOString(), brier: +((p.chance - (hit ? 1 : 0)) ** 2).toFixed(4) };
      fs.writeFileSync(`${L}/settled/${p.id}.json`, JSON.stringify(rec, null, 1)); fs.rmSync(f);
      log({ ev: 'settled', id: p.id, metric: p.metric, subject: p.subject, baseline: p.baseline, atLeast: p.atLeast, actual, chance: p.chance, hit });
    } catch (e) { console.error(new Date().toISOString(), p.id, e.message); }
  }
  const s = read(`${L}/settled`).map((x) => x.p), o = read(`${L}/open`).length;
  fs.writeFileSync(`${L}/summary.json`, JSON.stringify({ at: new Date().toISOString(), open: o, voided: read(`${L}/voided`).length, settled: s.length, hits: s.filter((x) => x.hit).length,
    hitRate: s.length ? +(s.filter((x) => x.hit).length / s.length).toFixed(3) : null, meanChance: s.length ? +(s.reduce((n, x) => n + x.chance, 0) / s.length).toFixed(3) : null,
    brier: s.length ? +(s.reduce((n, x) => n + x.brier, 0) / s.length).toFixed(4) : null, note: 'well calibrated = hitRate close to meanChance; Brier 0.25 is what always saying 0.5 scores' }, null, 1));
} finally { fs.rmSync(lock, { force: true }); }
