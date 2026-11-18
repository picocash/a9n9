#!/usr/bin/env node
// SMTP -> a9n9 mail Worker bridge for Ghost's transactional mail (signup/sign-in codes, magic links).
// Listens only on the Docker network next to the ghost container; no auth needed there. Each message is parsed and
// POSTed to the Worker's /v1/send (Cloudflare Email Sending), the same rail beatthechefs.com uses for its codes.
// Env: MAIL_WORKER_URL, EMAIL_API_TOKEN, MAIL_FROM (forced sender, e.g. "GenXLinked <genxlinked@a9n9.net>"), DAILY_CAP (default 300)
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
const URL = (process.env.MAIL_WORKER_URL || '').replace(/\/+$/, ''), TOKEN = process.env.EMAIL_API_TOKEN, FROM = process.env.MAIL_FROM || 'genxlinked@a9n9.net';
const CAP = Number(process.env.DAILY_CAP || 300);
let day = '', sent = 0;
const addr = (a) => (a?.value || []).map((v) => v.address).filter(Boolean);
const server = new SMTPServer({
  authOptional: true, disabledCommands: ['STARTTLS'], size: 2_000_000, logger: false,
  onData(stream, session, cb) {
    simpleParser(stream).then(async (m) => {
      const d = new Date().toISOString().slice(0, 10); if (d !== day) { day = d; sent = 0; }
      const to = [...addr(m.to), ...addr(m.cc), ...addr(m.bcc)].concat(session.envelope.rcptTo.map((r) => r.address));
      const rcpts = [...new Set(to)];
      for (const t of rcpts) {
        if (sent >= CAP) throw new Error('daily cap reached');
        const r = await fetch(`${URL}/v1/send`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({ from: FROM, to: t, subject: m.subject || '(no subject)', ...(m.text ? { text: m.text } : {}), ...(m.html ? { html: m.html } : {}) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(`worker ${r.status} ${j.error || ''}`);
        sent++; console.log(new Date().toISOString(), 'sent', t.replace(/^(.).*(@.*)$/, '$1***$2'), JSON.stringify(m.subject || ''), j.id || '');
      }
      cb();
    }).catch((e) => { console.error(new Date().toISOString(), 'FAILED', e.message); cb(Object.assign(new Error(e.message), { responseCode: 451 })); });
  },
});
server.listen(2525, '0.0.0.0', () => console.log('mailbridge on :2525 ->', URL ? 'worker' : 'NO WORKER URL'));
