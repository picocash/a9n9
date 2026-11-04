import { createSign, generateKeyPairSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleSns, sigv4, type SnsMessage } from '../src/aws-sms.js';
import { configFromEnv, createPhoneServer } from '../src/server.js';

const TOPIC = 'arn:aws:sns:us-east-1:671013084319:a9n9-sms-inbound';
const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-test.pem';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function signed(m: Omit<SnsMessage, 'Signature' | 'SignatureVersion' | 'SigningCertURL'>): SnsMessage {
  const full = { ...m, SignatureVersion: '2', SigningCertURL: CERT_URL } as SnsMessage;
  const keys = m.Type === 'Notification' ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  const text = keys.filter((k) => (full as unknown as Record<string, unknown>)[k] !== undefined).map((k) => `${k}\n${(full as unknown as Record<string, string>)[k]}\n`).join('');
  full.Signature = createSign('sha256').update(text).sign(privateKey, 'base64');
  return full;
}
const inbound = (from: string, body: string, id = 'in-1') => signed({ Type: 'Notification', MessageId: `sns-${id}`, TopicArn: TOPIC, Timestamp: new Date().toISOString(), Message: JSON.stringify({ originationNumber: from, destinationNumber: '+18885550100', messageKeyword: 'KEYWORD_1', messageBody: body, inboundMessageId: id }) });

const fetched: string[] = [];
const awsCalls: Array<{ headers: Record<string, string>; body: string }> = [];
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (url === CERT_URL) return new Response(publicPem);
  if (url.startsWith('https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription')) { fetched.push(url); return new Response('<ok/>'); }
  if (url === 'https://sms-voice.us-east-1.amazonaws.com/') { awsCalls.push({ headers: init?.headers as Record<string, string>, body: String(init?.body) }); return new Response(JSON.stringify({ MessageId: `aws-out-${awsCalls.length}` }), { status: 200 }); }
  return fetch(input, init);
}) as typeof fetch;

describe('AWS SigV4', () => {
  it('matches botocore for SendTextMessage (same credentials, body and time)', () => {
    const body = '{"DestinationPhoneNumber":"+15550001111","OriginationIdentity":"phone-abc","MessageBody":"Visybl: hi","MessageType":"TRANSACTIONAL"}';
    const h = sigv4({ region: 'us-east-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' }, 'sms-voice.us-east-1.amazonaws.com', 'PinpointSMSVoiceV2.SendTextMessage', body, new Date('2026-11-04T12:00:00Z'));
    // Reference value produced by botocore.auth.SigV4Auth for the identical request.
    expect(h.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261104/us-east-1/sms-voice/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=586d7dc6f350f4ffa0b45e5b46da730fb6ef7501461c8ded73f0bf942846cd94');
  });
});

describe('SNS verification', () => {
  it('accepts a signed inbound SMS notification on our topic', async () => {
    const r = await handleSns(JSON.stringify(inbound('+15550001111', 'hello')), TOPIC, fakeFetch);
    expect(r).toMatchObject({ kind: 'sms', sms: { originationNumber: '+15550001111', messageBody: 'hello', inboundMessageId: 'in-1' } });
  });
  it('rejects a tampered body, another topic, a foreign certificate URL and a stale message', async () => {
    const m = inbound('+15550001111', 'hello');
    expect(await handleSns(JSON.stringify({ ...m, Message: m.Message.replace('hello', 'pwned') }), TOPIC, fakeFetch)).toMatchObject({ kind: 'rejected', reason: 'bad signature' });
    expect(await handleSns(JSON.stringify(m), 'arn:aws:sns:us-east-1:1:other', fakeFetch)).toMatchObject({ kind: 'rejected' });
    expect(await handleSns(JSON.stringify({ ...m, SigningCertURL: 'https://evil.example/cert.pem' }), TOPIC, fakeFetch)).toMatchObject({ kind: 'rejected', reason: 'signing certificate is not from sns.*.amazonaws.com' });
    const old = signed({ Type: 'Notification', MessageId: 'x', TopicArn: TOPIC, Timestamp: '2026-01-01T00:00:00Z', Message: '{}' });
    expect(await handleSns(JSON.stringify(old), TOPIC, fakeFetch)).toMatchObject({ kind: 'rejected', reason: 'message is more than an hour old' });
    expect(await handleSns('not json', TOPIC, fakeFetch)).toMatchObject({ kind: 'rejected' });
  });
  it('confirms a signed subscription only through an sns.*.amazonaws.com SubscribeURL', async () => {
    const sub = (url: string) => signed({ Type: 'SubscriptionConfirmation', MessageId: 'sub', TopicArn: TOPIC, Timestamp: new Date().toISOString(), Message: 'confirm', Token: 't', SubscribeURL: url });
    expect(await handleSns(JSON.stringify(sub('https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&Token=t')), TOPIC, fakeFetch)).toEqual({ kind: 'subscribed' });
    expect(fetched).toHaveLength(1);
    expect(await handleSns(JSON.stringify(sub('https://evil.example/?Action=ConfirmSubscription')), TOPIC, fakeFetch)).toMatchObject({ kind: 'rejected' });
    expect(fetched).toHaveLength(1);
  });
});

describe('phone server with the AWS backend', () => {
  let inbox: Server; let phone: ReturnType<typeof createPhoneServer>; let port = 0;
  const events: Array<Record<string, unknown>> = [];
  beforeAll(async () => {
    inbox = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { events.push(JSON.parse(b)); res.writeHead(201); res.end('{}'); }); });
    inbox.listen(0, '127.0.0.1'); await once(inbox, 'listening');
    const cfg = configFromEnv({ PUBLIC_HOST: 'phone.a9n9.net', INBOX_URL: `http://127.0.0.1:${(inbox.address() as { port: number }).port}`, INBOX_WEBHOOK_SECRET: 'sek', API_TOKEN: 'tok', SMS_BACKEND: 'aws', AWS_SMS_ACCESS_KEY_ID: 'AKIDTEST', AWS_SMS_SECRET_ACCESS_KEY: 'secret', AWS_SMS_ORIGINATION: 'phone-abc', AWS_SMS_TOPIC_ARN: TOPIC, SMS_DAILY_CAP: '5' });
    cfg.log = () => {}; cfg.fetchImpl = fakeFetch;
    phone = createPhoneServer(cfg); phone.server.listen(0, '127.0.0.1'); await once(phone.server, 'listening');
    port = (phone.server.address() as { port: number }).port;
  });
  afterAll(() => { phone.wss.close(); phone.server.close(); inbox.close(); });
  const post = (path: string, body: string, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers, body });
  const sendSms = (to: string, body: string) => post('/v1/sms/send', JSON.stringify({ to, body }), { 'content-type': 'application/json', authorization: 'Bearer tok' });

  it('refuses to text a number that never texted us', async () => {
    expect((await sendSms('+15550002222', 'hi')).status).toBe(403);
    expect(awsCalls).toHaveLength(0);
  });
  it('an inbound text records consent and becomes sms.received; the reply goes out through SendTextMessage with the brand prefix', async () => {
    expect((await post('/aws/sms', JSON.stringify(inbound('+15550002222', 'Is pathUSD backed?', 'in-2')))).status).toBe(200);
    expect(events.find((e) => e.id === 'aws-in-2')).toMatchObject({ type: 'sms.received', from: '+15550002222', body: 'Is pathUSD backed?', provider: 'aws' });
    const res = await sendSms('+15550002222', 'Yes, as of 16:40 UTC it reconciles.');
    expect(res.status).toBe(202);
    const call = awsCalls.at(-1)!;
    expect(call.headers['x-amz-target']).toBe('PinpointSMSVoiceV2.SendTextMessage');
    expect(call.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDTEST\/\d{8}\/us-east-1\/sms-voice\/aws4_request/);
    expect(JSON.parse(call.body)).toEqual({ DestinationPhoneNumber: '+15550002222', OriginationIdentity: 'phone-abc', MessageBody: 'Visybl: Yes, as of 16:40 UTC it reconciles.', MessageType: 'TRANSACTIONAL' });
  });
  it('STOP by text blocks further sends; a forged notification is refused', async () => {
    await post('/aws/sms', JSON.stringify(inbound('+15550002222', 'STOP', 'in-3')));
    expect((await sendSms('+15550002222', 'one more')).status).toBe(403);
    const forged = { ...inbound('+15550003333', 'hi', 'in-4'), Signature: 'AAAA' };
    expect((await post('/aws/sms', JSON.stringify(forged))).status).toBe(403);
    expect(events.find((e) => e.id === 'aws-in-4')).toBeUndefined();
  });
});
