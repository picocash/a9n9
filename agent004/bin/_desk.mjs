// agent004 desk library: the candidate pipeline's append-only journal and lead (Scout) records. Used by bin/pipeline and by the
// events monitor (scripts-hermes/signal.mjs). Nothing here calls a model. State: /agent/state/desk/journal.jsonl (never rewritten).
import fs from 'node:fs';
export const HOME = process.env.AGENT_HOME || '/agent';
export const DESK = `${HOME}/state/desk`, JOURNAL = `${DESK}/journal.jsonl`;
export const who = () => process.env.HERMES_PROFILE || 'default';
export const riskConfig = () => JSON.parse(fs.readFileSync(`${HOME}/desk/risk.json`, 'utf8'));
export const readJournal = () => { try { return fs.readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
export function journal(cid, stage, kind, data = {}, extra = {}) {
  fs.mkdirSync(DESK, { recursive: true });
  const e = { at: new Date().toISOString(), cid, stage, kind, by: who(), ...extra, data };
  fs.appendFileSync(JOURNAL, JSON.stringify(e) + '\n'); return e;
}
// Fold the journal into one view per candidate. Later snapshots never erase earlier ones: `history` keeps the count per stage.
export function candidates(entries = readJournal()) {
  const m = new Map();
  for (const e of entries) {
    if (!e.cid) continue; let c = m.get(e.cid); if (!c) m.set(e.cid, c = { cid: e.cid, status: 'LEAD', history: {} });
    c.history[e.stage] = (c.history[e.stage] ?? 0) + 1; c.updated = e.at;
    if (e.stage === 'lead' && e.kind === 'created') { Object.assign(c, { symbol: e.data.symbol, lead: e.data, created: e.at, key: e.data.key, status: e.data.source ? 'LEAD' : 'VERIFY' }); }
    else if (e.stage === 'lead' && e.kind === 'duplicate') c.duplicates = (c.duplicates ?? 0) + 1;
    else if (e.stage === 'lead' && e.kind === 'source-added') { c.lead.source = e.data.source; if (c.status === 'VERIFY') c.status = 'LEAD'; }
    else if (e.stage === 'open') { c.tasks = e.data.tasks; c.status = 'OPEN'; }
    else if (e.stage === 'pack') c.pack = { at: e.at, ...e.data };
    else if (['evidence', 'narrative', 'analyst'].includes(e.stage) && e.kind === 'recorded') c[e.stage] = { at: e.at, by: e.by, ...e.data };
    else if (e.stage === 'risk') { c.risk = { at: e.at, ruleVersion: e.ruleVersion, ...e.data }; c.status = e.data.result === 'PASS' ? 'RISK-PASS' : 'RISK-FAIL'; }
    else if (e.stage === 'close') { c.status = 'CLOSED'; c.closed = { at: e.at, ...e.data }; }
  }
  return m;
}
// Scout: one compact lead per (symbol, rule key). A repeat of the same key collapses into the existing candidate.
// A lead with no usable source is created at VERIFY and cannot be opened until a source is added.
// quiet: the events monitor re-derives the same lead every 2 minutes; that is not a new alert, so it is not journaled again.
export function lead({ symbol, event, source, rule, key, observedAt, quiet = false }) {
  symbol = String(symbol).toUpperCase(); const k = key || `${symbol}|${rule}|${new Date().toISOString().slice(0, 10)}`;
  const all = candidates(); const dup = [...all.values()].find((c) => c.key === k);
  if (dup) { if (!quiet) journal(dup.cid, 'lead', 'duplicate', { event, source: source ?? null }); return { cid: dup.cid, duplicate: true, status: dup.status }; }
  const d = new Date(), tag = `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  let n = 1; while (all.has(`c${tag}-${symbol}-${n}`)) n++;
  const cid = `c${tag}-${symbol}-${n}`;
  journal(cid, 'lead', 'created', { symbol, event, source: source || null, rule, key: k, observedAt: observedAt || d.toISOString() });
  return { cid, duplicate: false, status: source ? 'LEAD' : 'VERIFY' };
}
