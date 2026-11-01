#!/usr/bin/env node
// Operator-initiated outbound test call with answering-machine detection.
//   set -a; . ~/a9n9/secrets/twilio.env; set +a; node scripts/call.mjs +14343686621
const [, , to] = process.argv;
if (!/^\+[1-9]\d{6,14}$/.test(to ?? '')) { console.error('usage: call.mjs +E164'); process.exit(2); }
const { TWILIO_ACCOUNT_SID: acc, TWILIO_API_KEY_SID: k, TWILIO_API_KEY_SECRET: sec, TWILIO_PHONE_NUMBER: from, PUBLIC_HOST: host = 'phone.a9n9.net' } = process.env;
const auth = 'Basic ' + Buffer.from(`${k}:${sec}`).toString('base64');
const form = new URLSearchParams({ To: to, From: from, Url: `https://${host}/twilio/voice`, Method: 'POST', Timeout: '30', TimeLimit: '240', MachineDetection: 'DetectMessageEnd', MachineDetectionTimeout: '30' });
const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acc}/Calls.json`, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/x-www-form-urlencoded' }, body: form });
const call = await res.json();
if (call.code) { console.error(`ERROR ${call.code}: ${call.message}`); process.exit(1); }
console.log(`call ${call.sid} ${call.status} ${call.from} → ${call.to}`);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const c = await (await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acc}/Calls/${call.sid}.json`, { headers: { authorization: auth } })).json();
  if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(c.status)) { console.log(`${c.status} after ${c.duration}s answered_by=${c.answered_by ?? '-'}`); process.exit(0); }
}
console.log('still in progress after 5 minutes');
