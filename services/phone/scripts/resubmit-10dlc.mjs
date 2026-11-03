#!/usr/bin/env node
// Resubmit the A2P 10DLC campaign with the brand's own website (www.visybl.com) hosting the
// program, privacy and terms pages. Run only after https://www.visybl.com/sms answers 200.
//   node resubmit-10dlc.mjs --check      verify the pages and print the payload, submit nothing
//   node resubmit-10dlc.mjs --delete-failed  remove the FAILED campaign(s) first (required before a new one)
//   node resubmit-10dlc.mjs --submit     create the new campaign
import fs from 'node:fs';
const kv = Object.fromEntries(fs.readFileSync('/home/ubuntu/a9n9/secrets/twilio.env', 'utf8').split('\n').filter(l => /^[A-Z_0-9]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const auth = 'Basic ' + Buffer.from(`${kv.TWILIO_API_KEY_SID}:${kv.TWILIO_API_KEY_SECRET}`).toString('base64');
const MG = kv.TWILIO_MESSAGING_SERVICE_SID, BRAND = 'BN07c1a4d6352898a4e94d4d9e0fd483f4';
const SITE = 'https://www.visybl.com';
const api = async (method, url, form) => { const r = await fetch(url, { method, headers: { authorization: auth, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form) : undefined }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; } return { status: r.status, body: j }; };

const payload = {
  BrandRegistrationSid: BRAND,
  UsAppToPersonUsecase: 'LOW_VOLUME',
  HasEmbeddedLinks: 'true',
  HasEmbeddedPhone: 'true',
  Description: `Visybl Reserve Alerts: Visybl Inc (${SITE}) answers text-message questions about the public stablecoin reserve figures Visybl publishes itself (https://reserves.a9n9.net), and, when the person asks, texts them when a figure they named changes. Visybl is the sender and the subject of every message; no message is sent on behalf of, or promotes, any other company. Replies are written by Visybl's own automated software agent (Visybl's product a9n9) and every message starts with "Visybl:". No marketing, no promotions, no cold outreach, no purchased, rented or shared numbers, no third-party content. Mobile numbers and consent are never shared with third parties or affiliates. Under 100 messages per day. Program terms: ${SITE}/sms`,
  MessageFlow: `There is exactly one opt-in method: the consumer sends a text message to Visybl's number, +1 (510) 443-3533. Any inbound message counts (a question, or the keyword START). Visybl never sends a message to a number that has not texted it first, and never adds numbers from websites, forms, calls, email or lists. The number is published, with the program terms, on ${SITE}/sms, which shows the full opt-in disclosure. Proof of consent is the stored inbound message (number, timestamp, content). Visybl's first reply, sent immediately: "Visybl: Thanks for texting Visybl Reserve Alerts. Replies come from Visybl's automated agent, not a person. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out." Consent is not a condition of purchase. Privacy Policy: ${SITE}/privacy. SMS Terms and Conditions: ${SITE}/sms.`,
  PrivacyPolicyUrl: `${SITE}/privacy`,
  TermsAndConditionsUrl: `${SITE}/sms`,
  SubscriberOptIn: 'true',
  AgeGated: 'false',
  DirectLending: 'false',
  OptInKeywords: 'START',
  OptInMessage: "Visybl: Thanks for texting Visybl Reserve Alerts. Replies come from Visybl's automated agent, not a person. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.",
  OptOutKeywords: 'STOP,CANCEL,QUIT,OPTOUT,UNSUBSCRIBE,STOPALL,REVOKE,END',
  OptOutMessage: 'Visybl: You are unsubscribed from Visybl Reserve Alerts and will receive no more messages. Reply START to resubscribe.',
  HelpKeywords: 'HELP,INFO',
  HelpMessage: `Visybl Reserve Alerts: answers to your questions and alerts you asked for. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out. Help: agent001@a9n9.net or ${SITE}/sms`,
};
const samples = [
  payload.OptInMessage,
  'Visybl: As of 16:40 UTC, pathUSD has 40.3 million dollars on Tempo and the issuer reports 40.3 million in reserves, so it reconciles. Details: https://reserves.a9n9.net Reply STOP to opt out.',
  'Visybl: The alert you asked for: USDB supply on Tempo moved from 40.4 million to 55.1 million dollars in the last hour. See https://reserves.a9n9.net Reply STOP to opt out.',
  "Visybl: Got your question. Checking the figures now, and I'll text you back within the hour. Reply STOP to opt out.",
];

const mode = process.argv[2] ?? '--check';
for (const p of ['/sms', '/privacy']) { const r = await fetch(SITE + p).catch(() => null); const ok = r && r.status === 200 && /Visybl Inc/.test(await r.text()); console.log(`${SITE}${p} => ${r ? r.status : 'unreachable'} ${ok ? 'ok (mentions Visybl Inc)' : 'NOT READY'}`); if (!ok && mode === '--submit') { console.log('site not ready; not submitting'); process.exit(1); } }
if (mode === '--check') { console.log(JSON.stringify({ ...payload, MessageSamples: samples }, null, 1)); process.exit(0); }
if (mode === '--delete-failed') {
  const list = await api('GET', `https://messaging.twilio.com/v1/Services/${MG}/Compliance/Usa2p`);
  for (const c of list.body.compliance ?? []) if (c.campaign_status === 'FAILED') { const d = await api('DELETE', `https://messaging.twilio.com/v1/Services/${MG}/Compliance/Usa2p/${c.sid}`); console.log('deleted', c.sid, d.status); }
  process.exit(0);
}
if (mode === '--submit') {
  const form = new URLSearchParams(payload); for (const s of samples) form.append('MessageSamples', s);
  const r = await fetch(`https://messaging.twilio.com/v1/Services/${MG}/Compliance/Usa2p`, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  const j = await r.json(); console.log(r.status, JSON.stringify({ sid: j.sid, status: j.campaign_status, errors: j.errors, message: j.message }, null, 1));
}
