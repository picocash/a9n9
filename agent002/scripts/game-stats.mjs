// game-stats: host-side reading of the game's activity log (apps/cookgame/data/events/<day>.jsonl), shared by kpi-collect, predict-run
// and bsky-audit. The log holds no IP, cookie or visitor id: a "visit" is one page session (`sid`, made by the page, gone when it closes),
// and its link tag (`?s=…`) is on its `view` event. Only sessions that came through Cloudflare (they carry a country) are counted, so LAN
// tests and the operator's own play stay out; GAME_STATS_ANY=1 counts everything (tests only). Browsers that send Do Not Track or Global
// Privacy Control are never logged. Known limit: with no visitor id, anybody can inflate these counts by reloading; they measure interest,
// not people. The log is kept 90 days, so totals are "since counting began, last 90 days".
import fs from 'node:fs';
export const GAME_DATA = process.env.GAME_DATA || '/home/ubuntu/source/a9n9/apps/cookgame/data';
// "agent" = every tag agent002 puts on a link (bsky-*, catalogue tags like gameslash, ref-<listing host>), i.e. everything except the
// operator's tags (rd-*, gads-*, selftest) and referrals from search engines and social sites. Same rule as predict and outcomes.mjs.
const OPERATOR_TAG = /^(rd-|gads-|selftest)/, PASSIVE_REF = /^ref-(.*-)?(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave|search|reddit|t-co|facebook|instagram|linkedin|x-com|twitter)/;
const isAgentTag = (t) => !OPERATOR_TAG.test(t) && !PASSIVE_REF.test(t);
// A visit with no ?s= tag but a referring site is counted as src:ref-<host> (dots become dashes, www. dropped, 31 chars at most), so a
// listing that links us untagged (e.g. ilovewebgames.com -> src:ref-ilovewebgames-com) can still be measured. Only the host is kept.
export const refTag = (ref) => { const h = String(ref).toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '').replace(/\./g, '-').replace(/[^a-z0-9-]/g, ''); return /^[a-z0-9]/.test(h) && !/(^|-)beatthechefs-com$/.test(h) ? `ref-${h}`.slice(0, 31).replace(/-+$/, '') : ''; };
const LV = (x) => (x === 2 || x === 3 ? x : 1);   // an event with no level field is a Level 1 round (the field came with Level 2)
export function gameStats(dataDir = GAME_DATA, { any = process.env.GAME_STATS_ANY === '1' } = {}) {
  const dir = `${dataDir}/events`; const sessions = new Map(); let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.jsonl$/.test(f)).sort(); } catch { throw new Error('no game activity log (events folder not readable)'); }
  for (const f of files) for (const l of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n')) { if (!l) continue; let e; try { e = JSON.parse(l); } catch { continue; }
    if (!e.sid || typeof e.e !== 'string') continue; let s = sessions.get(e.sid); if (!s) sessions.set(e.sid, s = { src: '', c: null, view: 0, fresh: 0, start: 0, plated: 0, share: 0, claim: 0, heard: '' });
    if (e.c) s.c = e.c; if (e.e === 'view') { s.view = 1; if (e.visits === 1) s.fresh = 1; if (s.vt == null) { s.vt = Date.parse(e.t) || 0; s.vk = `${e.w}x${e.h}`; } if (typeof e.src === 'string' && /^[a-z0-9-]{1,24}$/.test(e.src)) s.src = e.src; else if (!s.src && typeof e.ref === 'string' && e.ref) { const h = refTag(e.ref); if (h) s.src = h; } }
    else if (e.e === 'start') { s.start = 1; const n = LV(e.level); ((s.lv ??= {})[n] ??= { started: 0, plated: 0 }).started += 1; } else if (e.e === 'plated' && e.official !== false) { s.plated += 1; const n = LV(e.level); ((s.lv ??= {})[n] ??= { started: 0, plated: 0 }).plated += 1; } else if (e.e === 'share') { s.share += 1; const v = typeof e.via === 'string' && /^[a-z]{1,12}$/.test(e.via) ? e.via : 'other'; (s.via ??= {})[v] = (s.via[v] ?? 0) + 1; } else if (e.e === 'claim' && e.step === 'pin' && e.ok) s.claim = 1;
    else if (e.e === 'heard' && typeof e.a === 'string' && /^[a-z]{1,8}$/.test(e.a)) s.heard = e.a; }
  // heard:<answer> = sessions that answered the optional end-screen "Where did you hear about this game?" (site|search|ai|friend|other|skip)
  // newcomers = visits from a browser on its first ever visit (the page's own local counter = 1): the nearest thing to 'people' without an id
  const zero = () => ({ visits: 0, newcomers: 0, started: 0, plated: 0, shared: 0, claimed: 0 }); const by = { all: zero(), agent: zero() };
  const put = (k, s) => { const b = (by[k] ??= zero()); b.visits += s.view; b.newcomers += s.fresh; b.started += s.start; b.plated += s.plated; b.shared += Math.min(s.share, s.plated); b.claimed += s.claim; };
  // Twin views: some listing pages (gameslash, from 11-20) load the game twice in one second, once tagged and once bare, from one browser (same window size;
  // the visit counter may differ by one). Drop the bare twin so a single person is not counted twice (asked by agent002, c682ae3bbb).
  const tagged = [...sessions.values()].filter((s) => s.src && s.vt != null);
  const twin = (s) => !s.src && s.vt != null && tagged.some((o) => o.vk === s.vk && Math.abs(o.vt - s.vt) <= 2000);
  for (const s of sessions.values()) { if (!any && !s.c) continue; if (twin(s)) continue; put('all', s); if (s.src) { put(`src:${s.src}`, s); if (isAgentTag(s.src)) put('agent', s); } if (s.heard) put(`heard:${s.heard}`, s);
    // via:<button> = share presses per button (card, x, bsky, facebook, whatsapp, copy, native), players only: ?s=selftest test rounds left out (agent002 352ea097ca)
    // level:<n> = rounds started and rounds plated (scored) on that level, counted per round, email or not; ?s=selftest left out (agent002 6f2d3a3a6c)
    if (s.lv && s.src !== 'selftest') for (const [n, v] of Object.entries(s.lv)) { const b = (by[`level:${n}`] ??= zero()); b.started += v.started; b.plated += v.plated; }
    if (s.via && s.src !== 'selftest') for (const [v, n] of Object.entries(s.via)) { const b = (by[`via:${v}`] ??= zero()); b.shared += n; } }
  return { files: files.length, firstDay: files[0]?.slice(0, 10) ?? null, lastDay: files.at(-1)?.slice(0, 10) ?? null, countedOnlyPublic: !any, by };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(gameStats(), null, 1));
