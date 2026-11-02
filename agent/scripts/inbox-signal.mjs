#!/usr/bin/env node
// Monitor source for the respond job: prints a STABLE summary of work waiting for a human reply.
// Changed output wakes the agent; unchanged output keeps it asleep. Cheap: local inbox + Bluesky notifications (free) + X mentions read-only.
import fs from 'node:fs';
const HOME = '/home/ubuntu/a9n9/agent001';
const env = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter(l => /^[A-Z_0-9]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const lines = [];
try {
  const e = env('/home/ubuntu/a9n9/secrets/inbox.env'); const h = { authorization: `Bearer ${e.INBOX_API_TOKEN}` };
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const list = await (await fetch(`http://127.0.0.1:8810/v1/events?limit=100&since=${encodeURIComponent(since)}`, { headers: h })).json();
  const AUTOMATED = /noreply|no-reply|notifications?@|invoice|receipt|verification|statements|mailer|postmaster|daemon|alerts?@|security@|support@|welcome|do-not-reply|@e\.link\.com|@stripe\.com|@tempo\.xyz|@twilio\.com|@x\.com|@bsky\.app|@github\.com|vaultwarden|bitwarden|your code|verification code|is your .* code/i;
  const AFFILIATE = /visybl\.com|a9n9\.net|flext\.energy|starbuilder|a9n9agent|4343686621|434-368-6621/i;
  const tickets = fs.existsSync(`${HOME}/state/tickets.json`) ? JSON.parse(fs.readFileSync(`${HOME}/state/tickets.json`, 'utf8')).tickets : [];
  const handled = new Set(tickets.flatMap((t) => [t.ref, ...(t.notes ?? []).map((n) => n.ref).filter(Boolean)]));
  const dis = fs.existsSync(`${HOME}/state/dismissed.json`) ? JSON.parse(fs.readFileSync(`${HOME}/state/dismissed.json`, 'utf8')) : {}; for (const k of Object.keys(dis)) handled.add(k);
  for (const ev of list.events) {
    if (!/^(email\.received|sms\.received|voice\.call|nostr\.(mention|dm)|web\.chat|telegram\.message|x\.mention|bsky\.mention)$/.test(ev.type)) continue;
    const full = await (await fetch(`http://127.0.0.1:8810/v1/events/${ev.channel}/${encodeURIComponent(ev.id)}`, { headers: h })).json(); const p = full.payload ?? {};
    const from = String(p.from?.address ?? p.from ?? p.fromNpub ?? p.who ?? p.author ?? '');
    if (AFFILIATE.test(from) || AUTOMATED.test(`${from} ${p.subject ?? ''} ${String(p.text ?? '').slice(0, 160)}`)) continue;
    if (!handled.has(ev.id)) lines.push(`${ev.type} ${ev.id}`);
  }
} catch (e) { lines.push(`inbox-error ${e.message.slice(0, 60)}`); }
try { const { xrpc } = await import(`${HOME}/bin/_bsky.mjs`); const r = await xrpc('GET', 'app.bsky.notification.getUnreadCount'); if (r.body?.count) lines.push(`bsky-unread ${r.body.count}`); } catch {}
try {
  const { x, ME_ID } = await import(`${HOME}/bin/_x.mjs`); const st = fs.existsSync(`${HOME}/state/mentions-since.json`) ? JSON.parse(fs.readFileSync(`${HOME}/state/mentions-since.json`, 'utf8')) : {};
  const r = await x('GET', `/users/${ME_ID}/mentions`, { query: { max_results: 5, since_id: st.sinceId }, price: 0, label: 'mentions-signal' });
  for (const t of r.body?.data ?? []) lines.push(`x.mention ${t.id}`);
} catch {}
process.stdout.write(lines.sort().join('\n') + (lines.length ? '\n' : 'idle\n'));
