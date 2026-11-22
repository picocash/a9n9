// agent002's event monitor for its "events" job. Hermes runs it every 2 minutes and wakes agent002 only when the output CHANGES,
// so a quiet minute costs no model call. Since 2026-11-22 (Arun: event-based runs, but frequent) it reports:
//   mail <id> · board-ask <id> · board-reply <id>   something written to agent002
//   reminder <id> <what>                            a reminder agent002 set with bin/remind came due
//   monitor <monitor_id> <events>                   a Parallel monitor found something new for agent002
//   newcomers <n> · heard <n>                       a new first-time player, a new "where did you hear" answer
// Counters are high-water marks (a rolling window that drops never lowers them), and an item that goes AWAY never wakes the
// agent: when nothing is new, the previous output is repeated unchanged. Only a NEW line wakes it.
import fs from 'node:fs';
const HOME = '/agent', STATE = `${HOME}/state`;
const kv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const rd = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const lines = [];
const t = (ms = 15000) => AbortSignal.timeout(ms);

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
} catch { /* idem */ }

// 2. reminders the agent set (bin/remind)
const now = Date.now();
for (const r of rd(`${STATE}/reminders.json`, [])) if (!r.done && Date.parse(r.at) <= now) lines.push(`reminder ${r.id} ${String(r.what).replace(/\s+/g, ' ').slice(0, 80)}`);

// 3. Parallel monitors (events are free to read)
const TOOLS = process.env.TOOLS_URL ?? 'http://10.0.1.101:8860';
for (const m of rd(`${STATE}/parallel-monitors.json`, []).filter((x) => x.active !== false).slice(0, 5)) {
  try {
    const j = await (await fetch(`${TOOLS}/v1/monitor/${m.monitor_id}/events`, { signal: t(10000) })).json();
    const n = (j.events ?? []).filter((e) => e.type !== 'completion' && e.type !== 'error').length;
    if (n) lines.push(`monitor ${m.monitor_id} ${n}`);
  } catch { /* idem */ }
}

// 4. outcome counters, as high-water marks
const HW = `${STATE}/signal-highwater.json`, hw = rd(HW, {});
const mark = (k, v) => { if (typeof v === 'number' && v > (hw[k] ?? 0)) hw[k] = v; };
{                                                                   // game newcomers and survey answers (the host collects them hourly)
  try {
    const rows = fs.readFileSync(`${HOME}/kpi/facts.jsonl`, 'utf8').trim().split('\n').slice(-3000).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((r) => r?.t === 'fact');
    const at = rows.filter((r) => r.metric?.startsWith('game.')).at(-1)?.at;
    const now_ = rows.filter((r) => r.at === at);
    mark('newcomers', now_.find((r) => r.metric === 'game.newcomers' && r.subject === 'all')?.value);
    mark('heard', now_.filter((r) => r.metric === 'game.visits' && String(r.subject).startsWith('heard:')).reduce((s, r) => s + (r.value || 0), 0));
  } catch { /* idem */ }
}
try { fs.writeFileSync(HW, JSON.stringify(hw)); } catch {}
for (const [k, v] of Object.entries(hw)) lines.push(`${k} ${v}`);

// 5. wake only on something NEW: if every current line was already in the last output, repeat that output unchanged
const LAST = `${STATE}/signal-last.txt`;
const last = (() => { try { return fs.readFileSync(LAST, 'utf8'); } catch { return ''; } })();
const lastSet = new Set(last.split('\n').filter(Boolean));
const cur = [...new Set(lines)].sort();
let outText = last || 'idle\n';
if (cur.some((l) => !lastSet.has(l))) { outText = (cur.length ? cur.join('\n') : 'idle') + '\n'; try { fs.writeFileSync(LAST, outText); } catch {} }
process.stdout.write(outText);
