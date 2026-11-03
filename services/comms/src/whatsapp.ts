/** WhatsApp Business Cloud API (Meta): webhook parsing, signature checks, outbound text. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const GRAPH = 'https://graph.facebook.com/v21.0';

/** X-Hub-Signature-256 = "sha256=" + hex HMAC of the raw body with the Meta app secret (also reused for relay → agent hops with a per-agent secret). */
export function hubSignature(secret: string, rawBody: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
}
export function verifyHub(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header) return false;
  const want = Buffer.from(hubSignature(secret, rawBody)); const got = Buffer.from(header);
  return got.length === want.length && timingSafeEqual(got, want);
}

export interface WaInbound { kind: 'message'; phoneNumberId: string; from: string; id: string; at: string; type: string; text: string; name?: string }
export interface WaStatus { kind: 'status'; phoneNumberId: string; id: string; status: string; to: string; at: string; error?: string }

interface WaChange { field?: string; value?: { metadata?: { phone_number_id?: string }; contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>; messages?: Array<{ from: string; id: string; timestamp: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: unknown }>; statuses?: Array<{ id: string; status: string; recipient_id: string; timestamp: string; errors?: Array<{ title?: string }> }> } }
export interface WaWebhook { object?: string; entry?: Array<{ id?: string; changes?: WaChange[] }> }

/** Flatten a webhook into messages and statuses, each tagged with the business number it was addressed to. */
export function parseWebhook(body: WaWebhook): Array<WaInbound | WaStatus> {
  const out: Array<WaInbound | WaStatus> = [];
  for (const e of body.entry ?? []) for (const ch of e.changes ?? []) {
    const v = ch.value; const pid = v?.metadata?.phone_number_id; if (!v || !pid) continue;
    for (const m of v.messages ?? []) {
      const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
      out.push({ kind: 'message', phoneNumberId: pid, from: `+${m.from}`, id: m.id, at: new Date(Number(m.timestamp) * 1000).toISOString(), type: m.type, text: m.text?.body ?? m.button?.text ?? `[${m.type}]`, ...(name ? { name } : {}) });
    }
    for (const s of v.statuses ?? []) out.push({ kind: 'status', phoneNumberId: pid, id: s.id, status: s.status, to: `+${s.recipient_id}`, at: new Date(Number(s.timestamp) * 1000).toISOString(), ...(s.errors?.[0]?.title ? { error: s.errors[0].title } : {}) });
  }
  return out;
}

/** Split one webhook into per-number webhooks (same shape), keyed by phone_number_id: the relay's only job. */
export function splitByNumber(body: WaWebhook): Map<string, WaWebhook> {
  const parts = new Map<string, WaWebhook>();
  for (const e of body.entry ?? []) for (const ch of e.changes ?? []) {
    const pid = ch.value?.metadata?.phone_number_id; if (!pid) continue;
    const w = parts.get(pid) ?? { object: body.object ?? 'whatsapp_business_account', entry: [] };
    w.entry!.push({ ...(e.id ? { id: e.id } : {}), changes: [ch] });
    parts.set(pid, w);
  }
  return parts;
}

export interface WaAccount { phoneNumberId: string; accessToken: string }

export async function sendWhatsAppText(acct: WaAccount, to: string, text: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`${GRAPH}/${acct.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${acct.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/^\+/, ''), type: 'text', text: { body: text, preview_url: false } }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string; code?: number } };
  if (!res.ok || !data.messages?.[0]?.id) throw new Error(`whatsapp ${res.status}${data.error?.code ? ` ${data.error.code}` : ''}: ${data.error?.message ?? 'send failed'}`);
  return data.messages[0].id;
}
