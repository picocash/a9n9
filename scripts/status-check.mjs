#!/usr/bin/env node
// Compares the homepage status tags (site/status.json) with reality. Prints mismatches; exit 1 if any. Run on every operator pass. Read-only.
import fs from 'node:fs';
const kv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const S = '/home/ubuntu/a9n9/secrets'; const st = JSON.parse(fs.readFileSync('/home/ubuntu/source/a9n9/site/status.json', 'utf8'));
const out = [];
// SMS
const t = kv(`${S}/twilio.env`); const c = (await (await fetch(`https://messaging.twilio.com/v1/Services/${t.TWILIO_MESSAGING_SERVICE_SID}/Compliance/Usa2p`, { headers: { authorization: 'Basic ' + Buffer.from(`${t.TWILIO_API_KEY_SID}:${t.TWILIO_API_KEY_SECRET}`).toString('base64') } })).json()).compliance?.[0]?.campaign_status ?? 'NONE';
out.push({ tag: 'sms', reality: c, tagSaysLive: st.sms === null, live: c === 'VERIFIED' });
// eCash: the tools service's unit names the chain; 42431 is testnet
const unit = (await (await fetch('http://127.0.0.1:8860/v1/info')).json()).unit; out.push({ tag: 'ecash', reality: unit, tagSaysLive: st.ecash === null, live: unit.startsWith('tip20:4217:') });
// Anchoring: the newest ledger.anchor event, real only when not a dry run
const i = kv(`${S}/inbox.env`); const h = { authorization: `Bearer ${i.INBOX_API_TOKEN}` };
const ev = (await (await fetch('http://127.0.0.1:8810/v1/events?limit=1&type=ledger.anchor', { headers: h })).json()).events[0];
const p = ev ? (await (await fetch(`http://127.0.0.1:8810/v1/events/${ev.channel}/${encodeURIComponent(ev.id)}`, { headers: h })).json()).payload : null;
const ageH = ev ? (Date.now() - Date.parse(ev.receivedAt)) / 3600e3 : null;
out.push({ tag: 'anchoring', reality: p ? `day ${p.day}, dryRun ${!!p.dryRun}, ${ageH.toFixed(0)} h ago` : 'no anchor event', tagSaysLive: st.anchoring === null, live: !!p && !p.dryRun && ageH < 48, jobLate: ageH === null || ageH > 30 });
const bad = out.filter((o) => o.live !== o.tagSaysLive);
console.log(JSON.stringify({ ok: !bad.length && !out.some((o) => o.jobLate), mismatches: bad.map((o) => o.tag), checks: out }, null, 1));
process.exit(bad.length ? 1 : 0);
