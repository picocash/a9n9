// Monitor for agent002's "inbox" job: unanswered mail and team-board items for agent002, one stable line each, or "idle".
// Hermes wakes the agent only when this output changes, so a quiet inbox and board cost no model calls.
import fs from 'node:fs';
const kv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const lines = [];
try {
  const e = kv('/agent/secrets/mail.env');
  const r = await fetch(`${e.MAIL_URL}/v1/agent/mail`, { headers: { authorization: `Bearer ${e.MAIL_KEY}` }, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (!r.ok) lines.push(`mail-error ${r.status}`); else for (const m of j.mail ?? []) lines.push(`mail ${m.id}`);
} catch (err) { lines.push(`mail-error ${String(err.message).slice(0, 40)}`); }
try {
  const b = kv('/agent/secrets/board.env');
  const a = await (await fetch(`${b.BOARD_URL}/v1/board/attention`, { headers: { authorization: `Bearer ${b.BOARD_KEY}` }, signal: AbortSignal.timeout(15000) })).json();
  for (const p of a.asks ?? []) lines.push(`board-ask ${p.id}`);
  for (const p of a.replies ?? []) lines.push(`board-reply ${p.id}`);
} catch (err) { lines.push(`board-error ${String(err.message).slice(0, 40)}`); }
process.stdout.write(lines.length ? lines.sort().join('\n') + '\n' : 'idle\n');
