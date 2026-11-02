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
  Description: `Visybl Inc (${SITE}) operates a9n9, a Visybl Inc service that runs autonomous software agents. This campaign is two-way conversational SMS between one a9n9 agent and people who text the agent's number first, or who ask the agent by phone or email to text them at a number they give. Messages answer the person's questions about public stablecoin reserve data on the Tempo blockchain network (published by Visybl), confirm that a question was received, and deliver reserve alerts the person explicitly requested. Every message identifies the sender as an autonomous software agent operated by a9n9, a Visybl Inc service. There is no marketing, no cold outreach, no purchased or shared contact lists, and no third-party content. Mobile information and consent are never shared with third parties or affiliates for marketing or promotional purposes. Expected volume is under 100 messages per day. Program page: ${SITE}/sms`,
  MessageFlow: `Opt-in is consumer initiated: (1) the person sends the first text to the agent's number, +1 510 443 3533; or (2) during a phone call or email exchange the person asks the agent to text them and gives their mobile number; or (3) the person enters their mobile number on the agent's page and confirms by replying START to a confirmation text. The agent's first message identifies the sender as an autonomous software agent operated by a9n9, a Visybl Inc service, states that message frequency varies and that message and data rates may apply, and explains that replying STOP opts out and HELP gets help. Consent is not a condition of any purchase. Program page with opt-in details and sample messages: ${SITE}/sms. Privacy Policy (states that no mobile information will be shared with third parties or affiliates for marketing or promotional purposes): ${SITE}/privacy. Terms and Conditions with the SMS program terms: ${SITE}/terms.`,
  OptInKeywords: 'START',
  OptInMessage: `a9n9 agent: Thanks for texting. I'm an autonomous software agent operated by a9n9, a Visybl Inc service, not a person. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`,
  OptOutKeywords: 'STOP,CANCEL,QUIT,OPTOUT,UNSUBSCRIBE,STOPALL,REVOKE,END',
  OptOutMessage: 'a9n9 agent (Visybl Inc): You have been unsubscribed and will receive no more messages from this number. Reply START to resubscribe.',
  HelpKeywords: 'HELP,INFO',
  HelpMessage: `a9n9 agent (Visybl Inc): Conversational replies and alerts you requested. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out. Help: agent001@a9n9.net or ${SITE}/sms`,
};
const samples = [
  payload.OptInMessage,
  'a9n9 agent: As of 16:40 UTC, pathUSD has 40.3 million dollars on Tempo and the issuer reports 40.3 million in reserves, so it reconciles. Details: https://reserves.a9n9.net Reply STOP to opt out.',
  'a9n9 agent: The reserve alert you set up fired: USDB supply on Tempo moved from 40.4 million to 55.1 million dollars in the last hour. See https://reserves.a9n9.net Reply STOP to opt out.',
  "a9n9 agent: I received your question and I'm checking the figures now; I'll text you back within the hour. Reply STOP to opt out.",
];

const mode = process.argv[2] ?? '--check';
for (const p of ['/sms', '/privacy', '/terms']) { const r = await fetch(SITE + p).catch(() => null); const ok = r && r.status === 200 && /Visybl Inc/.test(await r.text()); console.log(`${SITE}${p} => ${r ? r.status : 'unreachable'} ${ok ? 'ok (mentions Visybl Inc)' : 'NOT READY'}`); if (!ok && mode === '--submit') { console.log('site not ready; not submitting'); process.exit(1); } }
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
