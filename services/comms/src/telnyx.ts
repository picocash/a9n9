/** Telnyx SMS: inbound/status webhook signature (Ed25519) and outbound send (API v2). */
import { createPublicKey, verify } from 'node:crypto';

const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
const TOLERANCE_S = 300;

/** The portal's public key is base64: either the raw 32-byte key or its DER SubjectPublicKeyInfo; accept both. */
function publicKey(b64: string) {
  const raw = Buffer.from(b64.trim(), 'base64');
  const der = raw.length === 32 ? Buffer.concat([SPKI_ED25519, raw]) : raw;
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/** Telnyx signs `${telnyx-timestamp}|${raw body}`; reject anything older or newer than 5 minutes. */
export function verifyTelnyx(publicKeyB64: string, rawBody: string, signatureB64: string | undefined, timestamp: string | undefined, nowMs = Date.now()): boolean {
  if (!signatureB64 || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > TOLERANCE_S) return false;
  try { return verify(null, Buffer.from(`${timestamp}|${rawBody}`), publicKey(publicKeyB64), Buffer.from(signatureB64, 'base64')); } catch { return false; }
}

export interface TelnyxAccount { apiKey: string; publicKey: string; number: string; messagingProfileId?: string | undefined }

export interface TelnyxEvent {
  data?: { event_type?: string; id?: string; occurred_at?: string; payload?: {
    id?: string; text?: string; from?: { phone_number?: string }; to?: { phone_number?: string; status?: string }[]; errors?: { code?: string; title?: string; detail?: string }[];
  } };
}

export async function sendTelnyxSms(acct: TelnyxAccount, to: string, text: string, webhookUrl: string | undefined, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: { authorization: `Bearer ${acct.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: acct.number, to, text, ...(acct.messagingProfileId ? { messaging_profile_id: acct.messagingProfileId } : {}), ...(webhookUrl ? { webhook_url: webhookUrl } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }; errors?: { detail?: string; title?: string }[] };
  if (!res.ok || !data.data?.id) throw new Error(`telnyx ${res.status}: ${data.errors?.[0]?.detail ?? data.errors?.[0]?.title ?? 'send failed'}`);
  return data.data.id;
}
