/**
 * Coinbase Developer Platform auth for the x402 facilitator, without the CDP SDK (which drags Solana packages in):
 * a short-lived EdDSA JWT per request, signed with the project's Ed25519 Secret API key. The key is read from the
 * environment of this host service; the agent sandbox never sees it.
 */
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import { HTTPFacilitatorClient } from '@x402/core/server';

export const CDP_HOST = 'api.cdp.coinbase.com';
export const CDP_X402_URL = `https://${CDP_HOST}/platform/v2/x402`;
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function cdpJwt(apiKeyId: string, apiKeySecret: string, method: string, path: string, ttlSeconds = 120): string {
  const raw = Buffer.from(apiKeySecret, 'base64');
  if (raw.length !== 64 && raw.length !== 32) throw new Error('CDP_API_KEY_SECRET must be a base64 Ed25519 key (32-byte seed or 64-byte seed+public)');
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, raw.subarray(0, 32)]), format: 'der', type: 'pkcs8' });
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'EdDSA', typ: 'JWT', kid: apiKeyId, nonce: randomBytes(16).toString('hex') };
  const payload = { sub: apiKeyId, iss: 'cdp', aud: ['cdp_service'], nbf: now, exp: now + ttlSeconds, uris: [`${method} ${CDP_HOST}${path}`] };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  return `${signingInput}.${b64u(sign(null, Buffer.from(signingInput), key))}`;
}

/** Facilitator client for Coinbase's hosted x402 facilitator (verify, settle, supported need the key; discovery is public). */
export function cdpFacilitatorClient(cdp: { apiKeyId: string; apiKeySecret: string }, timeoutMs = 30_000): HTTPFacilitatorClient {
  const bearer = (method: string, path: string) => ({ Authorization: `Bearer ${cdpJwt(cdp.apiKeyId, cdp.apiKeySecret, method, path)}` });
  return new HTTPFacilitatorClient({
    url: CDP_X402_URL,
    timeoutMs,
    createAuthHeaders: async () => ({ verify: bearer('POST', '/platform/v2/x402/verify'), settle: bearer('POST', '/platform/v2/x402/settle'), supported: bearer('GET', '/platform/v2/x402/supported') }),
  });
}
