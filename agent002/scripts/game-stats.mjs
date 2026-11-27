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
// funnel (agent002 dd3beff4c3, e717e77943): where rounds end. A round is one `start`; it ends plated (a score came back) or left. For a
// round that was left, what is known comes from the page's own lines: `first` (first action), `beat` (once a minute while cooking)
// and `away` (the tab was hidden or closed: the second on the clock, what was in the pan, the last actions). furthestStep is the
// furthest thing seen; minute is the last second the round was seen alive. beats = plated rounds that beat the house chef.
const ROUND = new Set(['start', 'first', 'beat', 'away', 'plated', 'nudge']);
// The first-step hint (game 077272e, live 2026-11-27T18:17Z): 20 s into a round with no ingredient picked, the sous-chef names the first step once
// and the page logs `nudge`. hint.sinceLive = rounds started after it went live; hint.before = the rounds before it (agent002 05fe1d1848).
const HINT_LIVE = '2026-11-27T18:17:00Z';
const MINUTES = ['under 1 min', '1-2 min', '2-3 min', '3-4 min', '4-5 min', '5-6 min (plating open)'];
function roundsOf(evs) {
  const done = []; let r = null; const close = () => { if (r) done.push(r); r = null; };
  for (const e of evs) {
    if (e.e === 'start') { close(); r = { level: LV(e.level), at: String(e.t), day: String(e.t).slice(0, 10), sec: 0, acted: false, prep: false, pan: false }; continue; }
    if (!r) continue;
    if (e.e === 'first') { r.acted = true; r.sec = Math.max(r.sec, Number(e.sec) || 0); if (e.type && e.type !== 'heat') r.prep = true; }
    else if (e.e === 'nudge') r.nudged = true;
    else if (e.e === 'beat') { r.acted ||= (Number(e.acts) || 0) > 0; r.sec = Math.max(r.sec, (Number(e.min) || 0) * 60); if (e.items > 0) r.pan = true; }
    else if (e.e === 'away') { r.sec = Math.max(r.sec, Number(e.sec) || 0); if (e.items > 0) r.pan = true; if (Array.isArray(e.log) && e.log.length) { r.acted = true; if (e.log.some((x) => x?.[1] && x[1] !== 'heat')) r.prep = true; } }
    else if (e.e === 'plated') { if (e.official === false) { r.noScore = true; close(); } else { r.plated = true; r.win = e.win === true; r.day = String(e.t).slice(0, 10); close(); } }
  }
  close(); return done;
}
const stepOf = (r) => (r.noScore ? 'plated but the server gave no score' : r.sec >= 300 ? 'last minute (plating open)' : r.pan ? 'cooking (food in the pan)' : r.prep ? 'prep (chopping or adding, nothing in the pan yet)' : r.acted ? 'burner only (set the heat, touched no ingredient)' : 'no action after pressing start');
const LV = (x) => (x === 2 || x === 3 ? x : 1);   // an event with no level field is a Level 1 round (the field came with Level 2)
export function gameStats(dataDir = GAME_DATA, { any = process.env.GAME_STATS_ANY === '1' } = {}) {
  const dir = `${dataDir}/events`; const sessions = new Map(); let files = [];
  // sharePage (agent002 9f59adcacb, logged from 2026-11-27): the server's own lines for a share page (/p/<plate>) being opened and for its
  // 'Cook this same dish' button being followed (a landing on /?dare=…&s=share). They carry no page session, so they are counted as
  // lines: opened = by browsers, openedByBots = link-preview fetchers and crawlers, cookPressed = button followed by a browser.
  const sharePage = { opened: 0, openedByBots: 0, cookPressed: 0 };
  try { files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.jsonl$/.test(f)).sort(); } catch { throw new Error('no game activity log (events folder not readable)'); }
  for (const f of files) for (const l of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n')) { if (!l) continue; let e; try { e = JSON.parse(l); } catch { continue; }
    if (!e.sid && (any || e.c)) { if (e.e === 'popen') sharePage[e.bot ? 'openedByBots' : 'opened'] += 1; else if (e.e === 'land' && e.src === 'share' && e.dare && !e.bot) sharePage.cookPressed += 1; }
    if (!e.sid || typeof e.e !== 'string') continue; let s = sessions.get(e.sid); if (!s) sessions.set(e.sid, s = { src: '', c: null, view: 0, fresh: 0, start: 0, plated: 0, share: 0, claim: 0, heard: '' });
    if (ROUND.has(e.e)) (s.ev ??= []).push(e);
    if (e.c) s.c = e.c; if (e.dev && !s.dev) s.dev = e.dev; if (e.e === 'view') { s.view = 1; if (s.tag == null) { s.tag = typeof e.src === 'string' && /^[a-z0-9-]{1,24}$/.test(e.src) ? e.src : ''; s.host = typeof e.ref === 'string' ? e.ref.toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 60) : ''; s.touch = e.touch === true; } if (e.visits === 1) s.fresh = 1; if (s.vt == null) { s.vt = Date.parse(e.t) || 0; s.vk = `${e.w}x${e.h}`; } if (typeof e.src === 'string' && /^[a-z0-9-]{1,24}$/.test(e.src)) s.src = e.src; else if (!s.src && typeof e.ref === 'string' && e.ref) { const h = refTag(e.ref); if (h) s.src = h; } }
    else if (e.e === 'start') { s.start = 1; const n = LV(e.level); ((s.lv ??= {})[n] ??= { started: 0, plated: 0 }).started += 1; } else if (e.e === 'plated' && e.official !== false) { s.plated += 1; const n = LV(e.level); ((s.lv ??= {})[n] ??= { started: 0, plated: 0 }).plated += 1; } else if (e.e === 'share') { s.share += 1; const v = typeof e.via === 'string' && /^[a-z]{1,12}$/.test(e.via) ? e.via : 'other'; (s.via ??= {})[v] = (s.via[v] ?? 0) + 1; } else if (e.e === 'claim' && e.step === 'pin' && e.ok) s.claim = 1;
    else if (e.e === 'heard' && typeof e.a === 'string' && /^[a-z]{1,8}$/.test(e.a)) s.heard = e.a; }
  // heard:<answer> = sessions that answered the optional end-screen "Where did you hear about this game?" (site|search|ai|friend|other|skip)
  // newcomers = visits from a browser on its first ever visit (the page's own local counter = 1): the nearest thing to 'people' without an id
  const zero = () => ({ visits: 0, newcomers: 0, started: 0, plated: 0, shared: 0, claimed: 0 }); const by = { all: zero(), agent: zero() };
  const put = (k, s) => { const b = (by[k] ??= zero()); b.visits += s.view; b.newcomers += s.fresh; b.started += s.start; b.plated += s.plated; b.shared += Math.min(s.share, s.plated); b.claimed += s.claim; };
  // Twin views: some listing pages (gameslash, from 11-20) load the game twice in one second, once tagged and once bare, from one browser (same window size;
  // the visit counter may differ by one). Drop the bare twin so a single person is not counted twice (asked by agent002, c682ae3bbb).
  const today = new Date().toISOString().slice(0, 10), funnel = { openingScreen: { visits: 0, started: 0, neverStarted: 0, byDevice: {}, bySource: {} }, byLevel: {} };
  // openingScreen.byDevice / bySource (agent002 08b6d63888): the same visits split by phone or computer (the server's read of the browser name;
  // touchScreen = the page's own report of a touch pointer) and by the ?s= tag ('no tag' = none). untaggedReferrers (agent002 94e43d3d05):
  // visits with no ?s= tag in the last 7 days by the site the browser said it came from, top 10. depthBySource (agent002 86bfbf4b6e):
  // per tag, sessions that plated and how far they went. Counts only.
  const os3 = () => ({ visits: 0, started: 0, neverStarted: 0 }), weekAgo = Date.now() - 7 * 864e5, refs = {}, depth = {};
  const os = (o, k, s) => { const b = (o[k] ??= os3()); b.visits += 1; b[s.start ? 'started' : 'neverStarted'] += 1; };
  const tagged = [...sessions.values()].filter((s) => s.src && s.vt != null);
  const twin = (s) => !s.src && s.vt != null && tagged.some((o) => o.vk === s.vk && Math.abs(o.vt - s.vt) <= 2000);
  for (const s of sessions.values()) { if (!any && !s.c) continue; if (twin(s)) continue; put('all', s); if (s.src) { put(`src:${s.src}`, s); if (isAgentTag(s.src)) put('agent', s); } if (s.heard) put(`heard:${s.heard}`, s);
    // via:<button> = share presses per button (card, x, bsky, facebook, whatsapp, copy, native), players only: ?s=selftest test rounds left out (agent002 352ea097ca)
    // level:<n> = rounds started and rounds plated (scored) on that level, counted per round, email or not; ?s=selftest left out (agent002 6f2d3a3a6c)
    if (s.src !== 'selftest') { if (s.view) { funnel.openingScreen.visits += 1; funnel.openingScreen[s.start ? 'started' : 'neverStarted'] += 1;
        os(funnel.openingScreen.byDevice, s.dev === 'm' ? 'phone or tablet' : s.dev === 'd' ? 'computer' : 'not known', s); if (s.touch) os(funnel.openingScreen.byDevice, 'touchScreen (any device)', s); os(funnel.openingScreen.bySource, s.tag || 'no tag', s);
        if (!s.tag && s.vt >= weekAgo) { const r = (refs[s.host || 'no referrer sent (typed, bookmark, app, or a site that hides it)'] ??= { visits: 0, started: 0, plated: 0 }); r.visits += 1; r.started += s.start; r.plated += s.plated; } }
      if (s.plated) { const d = (depth[s.tag || 'no tag'] ??= { sessionsThatPlated: 0, plates: 0, platedMoreThanOnce: 0, reachedLevel2: 0, reachedLevel3: 0 }); d.sessionsThatPlated += 1; d.plates += s.plated; if (s.plated > 1) d.platedMoreThanOnce += 1; if (s.lv?.[2]?.plated) d.reachedLevel2 += 1; if (s.lv?.[3]?.plated) d.reachedLevel3 += 1; }
      for (const r of roundsOf(s.ev ?? [])) { const L = (funnel.byLevel[r.level] ??= { started: 0, plated: 0, beats: 0, left: 0, platedToday: 0, beatsToday: 0, leftByStep: {}, leftByMinute: Object.fromEntries(MINUTES.map((m) => [m, 0])), hint: { liveSince: HINT_LIVE, before: { started: 0, plated: 0, left: 0 }, sinceLive: { started: 0, plated: 0, left: 0 }, shown: 0, shownThenPlated: 0, shownThenLeft: 0 } });
        { const H = L.hint, side = r.at >= HINT_LIVE ? H.sinceLive : H.before; side.started += 1; side[r.plated ? 'plated' : 'left'] += 1; if (r.nudged) { H.shown += 1; H[r.plated ? 'shownThenPlated' : 'shownThenLeft'] += 1; } }
        L.started += 1; if (r.plated) { L.plated += 1; if (r.win) L.beats += 1; if (r.day === today) { L.platedToday += 1; if (r.win) L.beatsToday += 1; } }
        else { L.left += 1; const st = stepOf(r); L.leftByStep[st] = (L.leftByStep[st] ?? 0) + 1; L.leftByMinute[MINUTES[Math.min(5, Math.floor(r.sec / 60))]] += 1; } } }
    if (s.lv && s.src !== 'selftest') for (const [n, v] of Object.entries(s.lv)) { const b = (by[`level:${n}`] ??= zero()); b.started += v.started; b.plated += v.plated; }
    if (s.via && s.src !== 'selftest') for (const [v, n] of Object.entries(s.via)) { const b = (by[`via:${v}`] ??= zero()); b.shared += n; } }
  // plateRecords = every scored plate the server stored, per level, with its own verdict against the house chef. It includes plates from browsers
  // that asked not to be tracked (no page events, so they are missing from `beats` above) and test rounds.
  const plateRecords = {}; try { for (const pf of fs.readdirSync(`${dataDir}/plates`)) { try { const p = JSON.parse(fs.readFileSync(`${dataDir}/plates/${pf}`, 'utf8')); if (!p.duel) continue; const R = (plateRecords[LV(p.level)] ??= { scored: 0, beats: 0, beatsFromUntrackedBrowsers: 0, bestPlayerTotal: 0 }); R.scored += 1; R.bestPlayerTotal = Math.max(R.bestPlayerTotal, Number(p.total) || 0); if (p.duel.win) { R.beats += 1; if (!p.sid) R.beatsFromUntrackedBrowsers += 1; } } catch {} } } catch {}
  funnel.untaggedReferrers = { days: 7, top: Object.fromEntries(Object.entries(refs).sort((a, b) => b[1].visits - a[1].visits).slice(0, 10)) }; funnel.depthBySource = depth;
  return { files: files.length, firstDay: files[0]?.slice(0, 10) ?? null, lastDay: files.at(-1)?.slice(0, 10) ?? null, countedOnlyPublic: !any, by, sharePage, funnel, plateRecords };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(gameStats(), null, 1));
