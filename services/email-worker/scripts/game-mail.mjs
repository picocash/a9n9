#!/usr/bin/env node
// Operator tool for mail to the game's addresses (privacy@beatthechefs.com …).
// Inbound arrives via Email Routing → a9n9-email Worker → home-box inbox (a copy still goes to the operator).
//   game-mail list [hours=72]        mail received for @beatthechefs.com, newest first, with who handled it
//   game-mail flags                  messages where agent002 asked the operator to act (data requests etc.)
//   game-mail show <id>              full text of one message
//   game-mail reply <id> <textfile>  reply from the address it was sent to, threaded
// Secrets are read from ~/a9n9/secrets and never printed.
import fs from 'node:fs';
const S = '/home/ubuntu/a9n9/secrets';
const envOf = (f) => Object.fromEntries(fs.readFileSync(`${S}/${f}`, 'utf8').split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }));
const inboxTok = Object.entries(envOf('inbox.env')).find(([k]) => /TOKEN|BEARER|KEY/i.test(k))?.[1];
const H = { authorization: `Bearer ${inboxTok}` };
const GAME = /@beatthechefs\.com/i;
const rcptOf = (p) => [p.envelope?.to, ...(p.to ?? []).map((a) => a.address ?? a)].filter(Boolean).map(String);
async function events(hours) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const j = await (await fetch(`http://127.0.0.1:8810/v1/events?limit=500&type=email.received&since=${encodeURIComponent(since)}`, { headers: H })).json();
  return j.events ?? [];
}
async function full(id) {
  const j = await (await fetch(`http://127.0.0.1:8810/v1/events/email/${encodeURIComponent(id)}`, { headers: H })).json();
  return j.payload ?? {};
}
const [cmd = 'list', a1, a2] = process.argv.slice(2);
async function rows() {
  const e = envOf('email.env'); const url = fs.readFileSync(`${S}/email-worker.url`, 'utf8').trim();
  const j = await (await fetch(`${url}/v1/mail?limit=200`, { headers: { authorization: `Bearer ${e.EMAIL_API_TOKEN}` } })).json();
  return (j.mail ?? []).filter((m) => GAME.test(m.envelope_to));
}
if (cmd === 'flags') {
  const f = (await rows()).filter((m) => m.operator_flag);
  for (const m of f) console.log(`${m.received_at}  ${m.id}\n  from <${m.from_addr}>  subject ${m.subject}\n  OPERATOR: ${m.operator_flag}\n  handled ${m.handled_at ?? 'no'} by ${m.handled_by ?? '-'}: ${m.handled_note ?? ''}\n`);
  console.log(`${f.length} flagged`);
} else if (cmd === 'list') {
  let n = 0;
  const handled = new Map((await rows()).map((m) => [m.id, m]));
  for (const ev of await events(Number(a1 ?? 72))) {
    const p = await full(ev.id); const to = rcptOf(p).find((r) => GAME.test(r)); if (!to) continue; n++; const h = handled.get(p.id ?? ev.id);
    console.log(`${ev.receivedAt}  ${ev.id}\n  to ${to}  from ${p.from?.name ? p.from.name + ' ' : ''}<${p.from?.address ?? p.envelope?.from}>\n  subject ${p.subject ?? ''}\n  handled: ${h?.handled_at ? `${h.handled_by} ${h.handled_note}` : 'NOT YET'}${h?.operator_flag ? `\n  OPERATOR: ${h.operator_flag}` : ''}\n  ${String(p.text ?? '').replace(/\s+/g, ' ').slice(0, 300)}\n`);
  }
  console.log(`${n} message(s) for the game in the last ${a1 ?? 72} h`);
} else if (cmd === 'show') {
  const p = await full(a1);
  console.log(`to ${rcptOf(p).join(', ')}\nfrom ${p.from?.name ?? ''} <${p.from?.address ?? p.envelope?.from}>\nsubject ${p.subject}\nmessage-id ${p.messageId}\n\n${p.text ?? '(no text part)'}`);
} else if (cmd === 'reply') {
  if (!a1 || !a2) throw new Error('usage: game-mail reply <id> <textfile>');
  const p = await full(a1);
  const from = rcptOf(p).find((r) => GAME.test(r)); if (!from) throw new Error('that message was not sent to a beatthechefs.com address');
  const to = p.from?.address ?? p.envelope?.from; if (!to) throw new Error('no sender address on that message');
  const subject = /^re:/i.test(p.subject ?? '') ? p.subject : `Re: ${p.subject ?? ''}`.trim();
  const e = envOf('email.env'); const url = fs.readFileSync(`${S}/email-worker.url`, 'utf8').trim();
  const body = { from: from.toLowerCase(), to, subject, text: fs.readFileSync(a2, 'utf8'), ...(p.messageId ? { inReplyTo: p.messageId, references: [p.references, p.messageId].filter(Boolean).join(' ') } : {}) };
  const r = await fetch(`${url}/v1/send`, { method: 'POST', headers: { authorization: `Bearer ${e.EMAIL_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  console.log('send', r.status, (await r.text()).slice(0, 200));
} else throw new Error('commands: list | show <id> | reply <id> <textfile>');
