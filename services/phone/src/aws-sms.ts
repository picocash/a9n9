/**
 * AWS End User Messaging SMS (pinpoint-sms-voice-v2) for the phone service, without the AWS SDK:
 *   - sendTextMessage: SigV4-signed JSON 1.0 call to SendTextMessage, from one toll-free number.
 *   - verifySnsMessage / handleSns: inbound texts arrive as SNS notifications on one topic; the signature
 *     is checked against the SNS signing certificate before anything is trusted, and a subscription
 *     confirmation is followed only for an amazonaws.com SubscribeURL on the expected topic.
 */
import { createHash, createHmac, createPublicKey, verify } from 'node:crypto';

export interface AwsSmsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Phone number id, ARN, or E.164 number of the registered toll-free number. */
  originationIdentity: string;
  /** The only SNS topic whose messages are accepted. */
  topicArn: string;
  fetchImpl: typeof fetch;
}

const sha256hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const hmac = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s, 'utf8').digest();

/** SigV4 headers for a POST of `body` to `host` (exported for tests). */
export function sigv4(cfg: Pick<AwsSmsConfig, 'region' | 'accessKeyId' | 'secretAccessKey'>, host: string, target: string, body: string, now = new Date()) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const date = amzDate.slice(0, 8);
  const service = 'sms-voice';
  const headers: Record<string, string> = { 'content-type': 'application/x-amz-json-1.0', host, 'x-amz-date': amzDate, 'x-amz-target': target };
  const names = Object.keys(headers).sort();
  const canonical = ['POST', '/', '', ...names.map((n) => `${n}:${headers[n]}`), '', names.join(';'), sha256hex(body)].join('\n');
  const scope = `${date}/${cfg.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, date), cfg.region), service), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign, 'utf8').digest('hex');
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` };
}

export async function sendTextMessage(cfg: AwsSmsConfig, to: string, body: string): Promise<{ sid: string; status: string }> {
  const host = `sms-voice.${cfg.region}.amazonaws.com`;
  const payload = JSON.stringify({ DestinationPhoneNumber: to, OriginationIdentity: cfg.originationIdentity, MessageBody: body, MessageType: 'TRANSACTIONAL' });
  const headers = sigv4(cfg, host, 'PinpointSMSVoiceV2.SendTextMessage', payload);
  const sendHeaders: Record<string, string> = { ...headers }; delete sendHeaders.host; // fetch sets Host itself
  const res = await cfg.fetchImpl(`https://${host}/`, { method: 'POST', headers: sendHeaders, body: payload, signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => ({}))) as { MessageId?: string; message?: string; Message?: string; __type?: string };
  if (!res.ok || !data.MessageId) throw new Error(`aws ${res.status}${data.__type ? ` ${data.__type.split('#').pop()}` : ''}: ${data.message ?? data.Message ?? 'send failed'}`);
  return { sid: data.MessageId, status: 'sent' };
}

export interface SnsMessage {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation' | string;
  MessageId: string; TopicArn: string; Message: string; Timestamp: string;
  Signature: string; SignatureVersion: string; SigningCertURL: string;
  Subject?: string; SubscribeURL?: string; Token?: string;
}

const SNS_CERT_URL = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/[^?#]+\.pem$/;
const SNS_SUBSCRIBE_URL = /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//;
const certCache = new Map<string, string>();

function stringToSign(m: SnsMessage): string {
  const keys = m.Type === 'Notification' ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  return keys.filter((k) => (m as unknown as Record<string, unknown>)[k] !== undefined).map((k) => `${k}\n${(m as unknown as Record<string, string>)[k]}\n`).join('');
}

/** Why the SNS message must be rejected, or null when it is authentic and for our topic. */
export async function verifySnsMessage(m: SnsMessage, topicArn: string, fetchImpl: typeof fetch): Promise<string | null> {
  if (!m || typeof m !== 'object' || !m.Signature || !m.SigningCertURL) return 'not an SNS message';
  if (m.TopicArn !== topicArn) return `unexpected topic ${m.TopicArn}`;
  if (!SNS_CERT_URL.test(m.SigningCertURL)) return 'signing certificate is not from sns.*.amazonaws.com';
  if (Math.abs(Date.now() - Date.parse(m.Timestamp)) > 3600_000) return 'message is more than an hour old';
  let pem = certCache.get(m.SigningCertURL);
  if (!pem) { const r = await fetchImpl(m.SigningCertURL, { signal: AbortSignal.timeout(10_000) }); if (!r.ok) return `certificate fetch ${r.status}`; pem = await r.text(); certCache.set(m.SigningCertURL, pem); }
  const algo = m.SignatureVersion === '2' ? 'sha256' : m.SignatureVersion === '1' ? 'sha1' : null;
  if (!algo) return `unsupported SignatureVersion ${m.SignatureVersion}`;
  const ok = verify(algo, Buffer.from(stringToSign(m), 'utf8'), createPublicKey(pem), Buffer.from(m.Signature, 'base64'));
  return ok ? null : 'bad signature';
}

/** The inbound text inside an SNS notification from End User Messaging two-way SMS. */
export interface AwsInboundSms { originationNumber: string; destinationNumber: string; messageBody: string; inboundMessageId: string; messageKeyword?: string }

export type SnsOutcome =
  | { kind: 'rejected'; reason: string }
  | { kind: 'subscribed' }
  | { kind: 'ignored'; reason: string }
  | { kind: 'sms'; sms: AwsInboundSms };

export async function handleSns(raw: string, topicArn: string, fetchImpl: typeof fetch): Promise<SnsOutcome> {
  let m: SnsMessage; try { m = JSON.parse(raw) as SnsMessage; } catch { return { kind: 'rejected', reason: 'body is not JSON' }; }
  const why = await verifySnsMessage(m, topicArn, fetchImpl);
  if (why) return { kind: 'rejected', reason: why };
  if (m.Type === 'SubscriptionConfirmation') {
    if (!m.SubscribeURL || !SNS_SUBSCRIBE_URL.test(m.SubscribeURL)) return { kind: 'rejected', reason: 'SubscribeURL is not sns.*.amazonaws.com' };
    const r = await fetchImpl(m.SubscribeURL, { signal: AbortSignal.timeout(10_000) });
    return r.ok ? { kind: 'subscribed' } : { kind: 'rejected', reason: `subscribe confirmation ${r.status}` };
  }
  if (m.Type !== 'Notification') return { kind: 'ignored', reason: m.Type };
  let s: Partial<AwsInboundSms>; try { s = JSON.parse(m.Message) as Partial<AwsInboundSms>; } catch { return { kind: 'ignored', reason: 'notification is not an inbound SMS' }; }
  if (!s.originationNumber || typeof s.messageBody !== 'string') return { kind: 'ignored', reason: 'notification is not an inbound SMS' };
  return { kind: 'sms', sms: { originationNumber: s.originationNumber, destinationNumber: s.destinationNumber ?? '', messageBody: s.messageBody, inboundMessageId: s.inboundMessageId ?? m.MessageId, ...(s.messageKeyword ? { messageKeyword: s.messageKeyword } : {}) } };
}
