// welcome-sender.mjs — send agent003's welcome email (with the Gen X age card link) once to each new GenXLinked member.
// Ghost's own welcome email only fires for signups made through Ghost's members form (source 'member'); our join flow
// (/gxl-api/join with a code, /gxl-api/google) creates members through the Admin API, so Ghost never sends it. This script
// fills that gap: every few minutes it finds members created since WELCOME_SINCE, subscribed to the newsletter (so the email
// code was confirmed, or they joined with Google) and not yet labelled `welcomed`, sends the welcome through the a9n9 mail
// Worker (the transactional rail mailbridge uses), then adds the `welcomed` label so nobody gets it twice.
// Runs inside the ghost container (Admin API on 127.0.0.1:2368): see welcome-sender.sh. Text: agent003 welcome-email.md (b2f4096fa9).
import crypto from 'node:crypto';
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
const { MAIL_WORKER_URL, EMAIL_API_TOKEN, MAIL_FROM } = process.env;
const SINCE = process.env.WELCOME_SINCE || '2026-11-25 00:00:00', CAP = 20, LABEL = 'welcomed';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const n = Math.floor(Date.now() / 1000), h = b64({ alg: 'HS256', typ: 'JWT', kid: id }), b = b64({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const admin = async (method, path, body) => { const r = await fetch(`http://127.0.0.1:2368/ghost/api/admin${path}`, { method, headers: { Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return [r.status, await r.json().catch(() => ({}))]; };

const CARD = 'https://genxlinked.com/gen-x-age-card/?ref=welcome';
const subject = 'Your Gen X age card is here';
const paras = [
  'Welcome to GenXLinked: one generation, born 1965 to 1980, in eight countries.',
  'Here is the card we promised: the ages when bowel, breast and lung screening, the shingles jab, the state pension and the free bus pass start (and when cervical screening stops) in the USA, UK, Canada, Australia, Ireland, New Zealand, the Philippines and Singapore, all on one page, every number linked to its official source.',
  `Get the age card: ${CARD}`,
  'Every Friday you get one letter: the week\'s pieces, a poll, and stories from readers. Tell us yours: your birth year, country and city, to stories@genxlinked.com.',
  'The GenXLinked desk is an AI agent working with editor Arun; pieces are AI-assisted and edited by Arun.',
];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const text = paras.join('\n\n') + '\n\nYou are getting this once, because you joined GenXLinked. Manage your letter at https://genxlinked.com/#/portal/account\n';
const html = `<div style="font-family:Georgia,serif;font-size:17px;line-height:1.55;color:#222;max-width:560px">${paras.map((p) => p.startsWith('Get the age card') ? `<p><a href="${CARD}" style="display:inline-block;background:#C1622D;color:#fff;padding:10px 18px;text-decoration:none;font-family:Arial,sans-serif;font-weight:700">Get the Gen X age card</a></p>` : `<p>${esc(p).replace('stories@genxlinked.com', '<a href="mailto:stories@genxlinked.com">stories@genxlinked.com</a>')}</p>`).join('')}<p style="font-size:13px;color:#666">You are getting this once, because you joined GenXLinked. <a href="https://genxlinked.com/#/portal/account">Manage your letter</a>.</p></div>`;

if (process.env.TEST_TO) { const r = await fetch(`${MAIL_WORKER_URL}/v1/send`, { method: 'POST', headers: { authorization: `Bearer ${EMAIL_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: MAIL_FROM, to: process.env.TEST_TO, subject: `[test] ${subject}`, text, html }) }); console.log(JSON.stringify({ test: true, status: r.status })); process.exit(0); }
const filter = `created_at:>'${SINCE}'+subscribed:true`;
const [st, j] = await admin('GET', `/members/?limit=100&filter=${encodeURIComponent(filter)}&include=labels`);
if (st !== 200) { console.log(JSON.stringify({ ok: false, step: 'list', status: st, error: j.errors?.[0]?.message })); process.exit(1); }
const todo = (j.members || []).filter((m) => !(m.labels || []).some((l) => l.name === LABEL)).slice(0, CAP);
const results = [];
for (const m of todo) {
  const r = await fetch(`${MAIL_WORKER_URL}/v1/send`, { method: 'POST', headers: { authorization: `Bearer ${EMAIL_API_TOKEN}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000), body: JSON.stringify({ from: MAIL_FROM, to: m.email, subject, text, html }) }).catch((e) => ({ ok: false, status: 0, e }));
  if (!r.ok) { results.push({ id: m.id, sent: false, status: r.status }); continue; }
  const [ps] = await admin('PUT', `/members/${m.id}/`, { members: [{ labels: [...(m.labels || []).map((l) => ({ name: l.name })), { name: LABEL }] }] });
  results.push({ id: m.id, sent: true, labelled: ps === 200 });
}
console.log(JSON.stringify({ ok: true, at: new Date().toISOString(), candidates: (j.members || []).length, sent: results.filter((x) => x.sent).length, results }));
