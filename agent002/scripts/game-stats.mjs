// game-stats: host-side reading of the game's activity log (apps/cookgame/data/events/<day>.jsonl), shared by kpi-collect, predict-run
// and bsky-audit. The log holds no IP, cookie or visitor id: a "visit" is one page session (`sid`, made by the page, gone when it closes),
// and its link tag (`?s=…`) is on its `view` event. Only sessions that came through Cloudflare (they carry a country) are counted, so LAN
// tests and the operator's own play stay out; GAME_STATS_ANY=1 counts everything (tests only). Browsers that send Do Not Track or Global
// Privacy Control are never logged. Known limit: with no visitor id, anybody can inflate these counts by reloading; they measure interest,
// not people. The log is kept 90 days, so totals are "since counting began, last 90 days".
import fs from 'node:fs';
export const GAME_DATA = process.env.GAME_DATA || '/home/ubuntu/source/a9n9/apps/cookgame/data';
const AGENT_TAG = /^(bsky|pin)(-|$)/;
export function gameStats(dataDir = GAME_DATA, { any = process.env.GAME_STATS_ANY === '1' } = {}) {
  const dir = `${dataDir}/events`; const sessions = new Map(); let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.jsonl$/.test(f)).sort(); } catch { throw new Error('no game activity log (events folder not readable)'); }
  for (const f of files) for (const l of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n')) { if (!l) continue; let e; try { e = JSON.parse(l); } catch { continue; }
    if (!e.sid || typeof e.e !== 'string') continue; let s = sessions.get(e.sid); if (!s) sessions.set(e.sid, s = { src: '', c: null, view: 0, start: 0, plated: 0, share: 0, claim: 0 });
    if (e.c) s.c = e.c; if (e.e === 'view') { s.view = 1; if (typeof e.src === 'string' && /^[a-z0-9-]{1,24}$/.test(e.src)) s.src = e.src; }
    else if (e.e === 'start') s.start = 1; else if (e.e === 'plated' && e.official !== false) s.plated += 1; else if (e.e === 'share') s.share += 1; else if (e.e === 'claim' && e.step === 'pin' && e.ok) s.claim = 1; }
  const zero = () => ({ visits: 0, started: 0, plated: 0, shared: 0, claimed: 0 }); const by = { all: zero(), agent: zero() };
  const put = (k, s) => { const b = (by[k] ??= zero()); b.visits += s.view; b.started += s.start; b.plated += s.plated; b.shared += Math.min(s.share, s.plated); b.claimed += s.claim; };
  for (const s of sessions.values()) { if (!any && !s.c) continue; put('all', s); if (s.src) { put(`src:${s.src}`, s); if (AGENT_TAG.test(s.src)) put('agent', s); } }
  return { files: files.length, firstDay: files[0]?.slice(0, 10) ?? null, lastDay: files.at(-1)?.slice(0, 10) ?? null, countedOnlyPublic: !any, by };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(gameStats(), null, 1));
