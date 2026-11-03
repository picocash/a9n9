/** Plivo SMS: inbound webhook signature (V3) and outbound send. Ported from the official SDK (utils/v3Security). */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * V3 signature for a POST webhook whose URL has no query string:
 * base64(HMAC-SHA256(authToken, url + "?" + concat(sorted key+value) + "." + nonce)).
 * The header may carry several comma-separated signatures (token rotation).
 */
export function plivoV3Signature(authToken: string, url: string, params: Record<string, string>, nonce: string): string {
  const keys = Object.keys(params).sort();
  const base = keys.length ? `${url}?${keys.map((k) => k + params[k]).join('')}` : url;
  return createHmac('sha256', authToken).update(`${base}.${nonce}`).digest('base64');
}

export function verifyPlivoV3(authToken: string, url: string, params: Record<string, string>, nonce: string | undefined, header: string | undefined): boolean {
  if (!nonce || !header) return false;
  const want = Buffer.from(plivoV3Signature(authToken, url, params, nonce));
  return header.split(',').some((s) => { const got = Buffer.from(s.trim()); return got.length === want.length && timingSafeEqual(got, want); });
}

export interface PlivoAccount { authId: string; authToken: string; number: string }

export async function sendPlivoSms(acct: PlivoAccount, to: string, text: string, statusUrl: string | undefined, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`https://api.plivo.com/v1/Account/${acct.authId}/Message/`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${acct.authId}:${acct.authToken}`).toString('base64')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ src: acct.number.replace(/^\+/, ''), dst: to.replace(/^\+/, ''), text, ...(statusUrl ? { url: statusUrl, method: 'POST' } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { message_uuid?: string[]; error?: string };
  if (!res.ok || !data.message_uuid?.[0]) throw new Error(`plivo ${res.status}: ${data.error ?? 'send failed'}`);
  return data.message_uuid[0];
}
