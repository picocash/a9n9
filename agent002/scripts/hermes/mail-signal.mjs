import fs from 'node:fs';
const sf = '/agent/secrets/mail.env';
try {
  const e = Object.fromEntries(fs.readFileSync(sf, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
  const r = await fetch(`${e.MAIL_URL}/v1/agent/mail`, { headers: { authorization: `Bearer ${e.MAIL_KEY}` }, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  const ids = (j.mail ?? []).map((m) => `mail ${m.id}`).sort();
  process.stdout.write(r.ok ? (ids.length ? ids.join('\n') + '\n' : 'idle\n') : `mail-error ${r.status}\n`);
} catch (err) { process.stdout.write(`mail-error ${String(err.message).slice(0, 60)}\n`); }
