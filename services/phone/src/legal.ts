/**
 * Public legal pages for the a9n9 phone/SMS program, written to the wording
 * carriers and Twilio's A2P 10DLC reviewers look for. Served at /privacy,
 * /terms and /sms so the campaign can link to them.
 */
const OPERATOR = 'Visybl Inc';
const PROGRAM = 'a9n9 agent';
const NUMBER = '+1 (510) 443-3533';
const EMAIL = 'agent@a9n9.net';
const UPDATED = 'November 1, 2026';

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · a9n9</title><style>body{max-width:720px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui,sans-serif;color:#1a1a1a}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:1.6em}small{color:#555}</style></head><body><h1>${title}</h1><small>${OPERATOR}, operating a9n9 · Last updated ${UPDATED}</small>${body}<hr><p><small><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms and Conditions</a> · <a href="/sms">SMS Program</a> · Contact: ${EMAIL}</small></p></body></html>`;

export const PRIVACY = page('Privacy Policy', `
<p>This Privacy Policy describes how ${OPERATOR} ("we", "us"), which operates the a9n9 service and its autonomous software agents (the "${PROGRAM}"), collects, uses and protects information from people who contact the agent by phone call, text message (SMS/MMS), email or the web.</p>
<h2>Information we collect</h2>
<p>When you contact the agent we receive the information you provide and the information needed to respond: your phone number or email address, the content of your messages, call transcripts, and the time of each contact. If you ask for alerts, we keep the thresholds you set. We do not buy, rent or import contact lists.</p>
<h2>How we use it</h2>
<p>We use this information to answer your questions, deliver the alerts you asked for, keep a record of what the agent said and did (the agent's public log records that an interaction happened and, where you agree, that it helped you; it does not publish your phone number, email address or message content), and to operate and secure the service.</p>
<h2>Mobile information and text messaging</h2>
<p><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong> Information sharing with subcontractors in support services, such as customer service, is permitted. All other use case categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
<p>Text messaging originator opt-in data and consent are never sold, rented or shared. Your consent to receive text messages is not a condition of purchasing anything.</p>
<h2>Service providers</h2>
<p>We use service providers to deliver the service: a telecommunications provider to carry calls and text messages, an email provider, cloud hosting, and AI model providers that process message content to generate the agent's replies. These providers process information only on our instructions and for the purpose of providing the service.</p>
<h2>Your choices</h2>
<p>Text <strong>STOP</strong> to ${NUMBER} at any time to stop receiving text messages; you will receive one confirmation message and nothing further. Text <strong>HELP</strong> for help. Email ${EMAIL} to ask what information we hold about you, to correct it, or to have it deleted.</p>
<h2>Retention and security</h2>
<p>Messages and transcripts are kept for as long as needed to provide the service and to maintain the agent's record of its interactions, and are protected by access controls and encryption in transit. You may request deletion at any time.</p>
<h2>Children</h2>
<p>The service is not directed to children under 13 and we do not knowingly collect information from them.</p>
<h2>Changes and contact</h2>
<p>We will post any changes to this policy on this page. Questions: ${EMAIL}, or write to ${OPERATOR}.</p>`);

export const TERMS = page('Terms and Conditions', `
<p>These terms govern your use of the a9n9 service and its autonomous software agents (the "${PROGRAM}"), operated by ${OPERATOR}. By calling, texting, emailing or otherwise interacting with the agent you agree to these terms and to our <a href="/privacy">Privacy Policy</a>.</p>
<h2>What the agent is</h2>
<p>The agent is an autonomous software program, not a person. It identifies itself as such on every channel. Its answers are generated from public data sources (for example public blockchain data and issuer-published figures) and from the information you give it. It may be wrong. Nothing it says is financial, legal or investment advice, and you should verify any figure before acting on it.</p>
<h2>SMS / text messaging program terms</h2>
<ul>
<li><strong>Program:</strong> ${PROGRAM} conversational messaging from ${NUMBER}. The agent replies to questions you text it, confirms requests, and sends alerts you explicitly set up.</li>
<li><strong>Opt-in:</strong> You opt in by texting the number first, by asking the agent during a call or email exchange to text you at a number you provide, or by entering your number on our website and confirming by replying START.</li>
<li><strong>Message frequency varies</strong> depending on your questions and the alerts you request.</li>
<li><strong>Message and data rates may apply.</strong></li>
<li><strong>Opt-out:</strong> Text <strong>STOP</strong> at any time to cancel. You will receive a single confirmation message and no further messages. Text START to opt back in.</li>
<li><strong>Help:</strong> Text <strong>HELP</strong> for help, or email ${EMAIL}.</li>
<li><strong>Carriers</strong> are not liable for delayed or undelivered messages.</li>
<li>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes; see the Privacy Policy.</li>
</ul>
<h2>Acceptable use</h2>
<p>Do not use the agent to send unlawful, abusive or deceptive content, to attempt to extract credentials or payments from it, or to interfere with its operation. We may stop responding to a number or address that abuses the service.</p>
<h2>Paid services</h2>
<p>Some services the agent offers may be paid. Prices are stated before you commit, and payments are settled through the payment method shown at the time. Disputes can be raised by email at ${EMAIL} within 14 days of delivery.</p>
<h2>Liability</h2>
<p>The service is provided as is. To the fullest extent permitted by law, ${OPERATOR} is not liable for any loss arising from reliance on the agent's output or from interruption of the service.</p>
<h2>Contact</h2>
<p>${OPERATOR} · ${EMAIL} · ${NUMBER}</p>`);

export const SMS_PROGRAM = page('SMS Program Information', `
<p><strong>${PROGRAM}</strong> is a text-messaging program operated by ${OPERATOR} from ${NUMBER}. Messages come from an autonomous software agent, not a person.</p>
<ul>
<li>By texting ${NUMBER} you agree to receive conversational replies and any alerts you request. Message frequency varies. Message and data rates may apply.</li>
<li>Reply <strong>STOP</strong> to opt out at any time. Reply <strong>HELP</strong> for help or email ${EMAIL}.</li>
<li>Your mobile information is never shared with third parties or affiliates for marketing or promotional purposes.</li>
</ul>
<p>See the <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms and Conditions</a>.</p>`);

export const LEGAL_PAGES: Record<string, string> = { '/privacy': PRIVACY, '/terms': TERMS, '/sms': SMS_PROGRAM };
