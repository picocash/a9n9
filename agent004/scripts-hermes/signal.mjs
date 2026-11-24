// agent004's event monitor for its "events" job. Hermes runs it every 2 minutes and wakes agent004 only when the output
// CHANGES, so a quiet check costs no model call. It reports:
//   mail <id>                                mail to agent004@a9n9.net not yet handled
//   board-ask <id> · board-reply <id>        something written to agent004 on the team board
//   reminder <id> <what>                     a reminder agent004 set with bin/remind came due (prediction checks, follow-ups)
//   monitor <monitor_id> <events>            a Parallel monitor found something new about a holding
//   move <SYM> <day> <±pct bucket>           a holding moved 3%+ today (buckets of 3%, so +4% then +7% wakes it again)
//   filing <SYM> <form> <date>               a holding filed with the SEC (8-K, 10-Q, 10-K, 4 …), newest per holding
//   price-alert <SYM> below|above <lvl> <day> a level Arun set with bin/alerts was crossed (once a day per alert while past it)
//   lead <cid> <SYM> <rule>                  SCOUT: a move, a material filing or a price alert became a pipeline candidate (bin/pipeline);
//                                            the same event collapses into one candidate, so the line is stable while the event lasts
// Market checks run at most every 10 minutes and only on US weekdays 13:00–22:00 UTC (price moves) or every 2 hours (filings),
// using FMP quotes and SEC EDGAR, with their own small cache. Counters and items that go AWAY never wake the agent: when
// nothing is new, the previous output is repeated unchanged. Only a NEW line wakes it.
import fs from 'node:fs';
const HOME = '/agent', STATE = `${HOME}/state`;
const kv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const rd = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const t = (ms = 15000) => AbortSignal.timeout(ms);
const lines = [];

// 1. mail and board
try {
  const e = kv(`${HOME}/secrets/mail.env`);
  const r = await fetch(`${e.MAIL_URL}/v1/agent/mail`, { headers: { authorization: `Bearer ${e.MAIL_KEY}` }, signal: t() });
  const j = await r.json();
  if (r.ok) for (const m of j.mail ?? []) lines.push(`mail ${m.id}`);
} catch { /* a failed check is not an event */ }
try {
  const b = kv(`${HOME}/secrets/board.env`);
  const a = await (await fetch(`${b.BOARD_URL}/v1/board/attention`, { headers: { authorization: `Bearer ${b.BOARD_KEY}` }, signal: t() })).json();
  for (const p of a.asks ?? []) lines.push(`board-ask ${p.id}`);
  for (const p of a.replies ?? []) lines.push(`board-reply ${p.id}`);
} catch { /* a failed check is not an event */ }

// 2. reminders
const now = Date.now();
for (const r of rd(`${STATE}/reminders.json`, [])) if (!r.done && Date.parse(r.at) <= now) lines.push(`reminder ${r.id} ${String(r.what).replace(/\s+/g, ' ').slice(0, 80)}`);

// 3. Parallel monitors
const TOOLS = process.env.TOOLS_URL ?? 'http://10.0.1.101:8860';
for (const m of rd(`${STATE}/parallel-monitors.json`, []).filter((x) => x.active !== false).slice(0, 5)) {
  try {
    const j = await (await fetch(`${TOOLS}/v1/monitor/${m.monitor_id}/events`, { signal: t(10000) })).json();
    const n = (j.events ?? []).filter((e) => e.type !== 'completion' && e.type !== 'error').length;
    if (n) lines.push(`monitor ${m.monitor_id} ${n}`);
  } catch { /* idem */ }
}

// 4. holdings: price moves and SEC filings (own cache, so this does not spend the market tool's daily cap)
const syms = [...new Set(((rd(`${STATE}/portfolio.json`, null) ?? rd(`${HOME}/portfolio.json`, {})).positions ?? []).map((p) => String(p.symbol).toUpperCase()))].slice(0, 40);
const MK = `${STATE}/signal-market.json`, mk = rd(MK, { quotesAt: 0, filingsAt: 0, moves: {}, filings: {} }); mk.levels ??= {};
const lvls = rd(`${STATE}/price-alerts.json`, []).filter((a) => a && a.symbol && a.level > 0 && ['below', 'above'].includes(a.dir));
const qsyms = [...new Set([...syms, ...lvls.map((a) => String(a.symbol).toUpperCase())])].slice(0, 50);
const d = new Date(), day = d.toISOString().slice(0, 10), h = d.getUTCHours(), weekday = d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
if (qsyms.length && weekday && h >= 13 && h < 22 && now - mk.quotesAt > 10 * 60e3) {
  try {
    const key = kv(`${HOME}/secrets/fmp.env`).FMP_API_KEY;
    for (const s of qsyms) {
      const j = await (await fetch(`https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(s)}&apikey=${key}`, { signal: t(10000) })).json().catch(() => null);
      const px = Array.isArray(j) ? j[0]?.price : null;
      if (typeof px === 'number') for (const a of lvls) if (String(a.symbol).toUpperCase() === s && (a.dir === 'below' ? px < a.level : px > a.level)) mk.levels[`${s} ${a.dir} ${a.level} ${day}`] = px;
      if (!syms.includes(s)) continue;
      const pct = Array.isArray(j) ? j[0]?.changePercentage : null;
      if (typeof pct === 'number' && Math.abs(pct) >= 3) { const bucket = Math.sign(pct) * Math.floor(Math.abs(pct) / 3) * 3; const k = `${s} ${day}`; if (Math.abs(bucket) > Math.abs(mk.moves[k] ?? 0)) mk.moves[k] = bucket; }
    }
    mk.quotesAt = now;
  } catch { /* idem */ }
}
if (syms.length && now - mk.filingsAt > 2 * 3600e3) {
  try {
    const UA = { 'user-agent': 'a9n9.net agent004 research (agent004@a9n9.net)' };
    const tick = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: UA, signal: t(20000) })).json();
    for (const s of syms) {
      const row = Object.values(tick).find((x) => x.ticker.toUpperCase() === s); if (!row) continue;
      const j = await (await fetch(`https://data.sec.gov/submissions/CIK${String(row.cik_str).padStart(10, '0')}.json`, { headers: UA, signal: t(20000) })).json();
      const f = j.filings?.recent; if (f?.form?.length) mk.filings[s] = `${f.form[0]} ${f.filingDate[0]}`;
    }
    mk.filingsAt = now;
  } catch { /* idem */ }
}
for (const k of Object.keys(mk.moves)) if (!k.endsWith(day)) delete mk.moves[k];
for (const k of Object.keys(mk.levels)) if (!k.endsWith(day)) delete mk.levels[k];
try { fs.writeFileSync(MK, JSON.stringify(mk)); } catch {}
for (const [k, b] of Object.entries(mk.moves)) lines.push(`move ${k} ${b > 0 ? '+' : ''}${b}%`);
for (const [s, f] of Object.entries(mk.filings)) lines.push(`filing ${s} ${f}`);
for (const k of Object.keys(mk.levels)) lines.push(`price-alert ${k}`);

// 4b. Scout: turn market events into compact pipeline leads (code only; duplicates collapse inside lead()).
// Filings count only when material (not routine Form 4s) and filed in the last 3 days, so loading a portfolio does not open a flood.
try {
  const { lead } = await import('../bin/_desk.mjs');
  const MATERIAL = /^(8-K|10-Q|10-K|S-1|424B\d|SC 13D|SC 13G|6-K|20-F)/i, at = new Date().toISOString();
  for (const l of [...lines]) {
    const w = l.split(' '); let r = null;
    if (w[0] === 'move') r = lead({ symbol: w[1], event: `moved ${w[3]} on ${w[2]} (3% buckets)`, source: 'FMP quote via events monitor', rule: 'holding moved 3%+ in a day', key: `${w[1]}|move|${w[2]}`, observedAt: at, quiet: true });
    else if (w[0] === 'price-alert') r = lead({ symbol: w[1], event: `price went ${w[2]} ${w[3]} on ${w[4]}`, source: 'FMP quote via events monitor', rule: `Arun's price alert ${w[2]} ${w[3]}`, key: `${w[1]}|alert|${w[2]}|${w[3]}|${w[4]}`, observedAt: at, quiet: true });
    else if (w[0] === 'filing') { const form = w.slice(2, -1).join(' '), filed = w.at(-1); if (MATERIAL.test(form) && now - Date.parse(filed) < 3 * 864e5) r = lead({ symbol: w[1], event: `filed ${form} on ${filed}`, source: 'SEC EDGAR submissions feed', rule: `material filing (${form})`, key: `${w[1]}|filing|${form}|${filed}`, observedAt: `${filed}T00:00:00Z`, quiet: true }); }
    if (r) lines.push(`lead ${r.cid} ${w[1]} ${w[0]}`);
  }
} catch { /* the scout never breaks the monitor */ }

// 5. wake only on something NEW
const LAST = `${STATE}/signal-last.txt`;
const last = (() => { try { return fs.readFileSync(LAST, 'utf8'); } catch { return ''; } })();
const lastSet = new Set(last.split('\n').filter(Boolean));
const cur = [...new Set(lines)].sort();
let outText = last || 'idle\n';
if (cur.some((l) => !lastSet.has(l))) { outText = (cur.length ? cur.join('\n') : 'idle') + '\n'; try { fs.writeFileSync(LAST, outText); } catch {} }
process.stdout.write(outText);
