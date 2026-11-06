import { describe, expect, it } from 'vitest';
import { CATALOG, braveQuery, exaRequest, imageRequest, parallelRequest, reservesRequest, tavilyRequest } from '../src/catalog.js';
import { buildRoutes, decodeSettlement, discovery, x402Tools } from '../src/x402.js';

const opts = { network: 'eip155:8453' as const, payTo: '0xbC907d1E4DaaEe23eb56dA405F9E24843d30f832', facilitator: 'cdp' as const, publicUrl: 'https://tools.a9n9.net/' };

describe('x402 routes', () => {
  it('sells every tool except video, at the catalog price, on a public https resource URL, with a Bazaar declaration', () => {
    const routes = buildRoutes(opts) as Record<string, { accepts: Array<{ price: string; network: string; payTo: string }>; resource: string; description: string; extensions: Record<string, unknown> }>;
    expect(Object.keys(routes).sort()).toEqual(x402Tools().map((t) => `POST ${t.path}`).sort());
    expect(Object.keys(routes)).not.toContain('POST /v1/video');
    for (const tool of x402Tools()) {
      const r = routes[`POST ${tool.path}`]!;
      expect(r.accepts[0]!.price).toBe(`$${tool.price}`);
      expect(r.accepts[0]!.network).toBe('eip155:8453');
      expect(r.accepts[0]!.payTo).toBe(opts.payTo);
      expect(r.resource).toBe(`https://tools.a9n9.net${tool.path}`);
      expect(r.description.length).toBeLessThan(500);
      expect(r.extensions.bazaar).toBeTruthy();
    }
  });
  it('discovery examples are valid inputs for the tool they advertise (the Bazaar probe replays them)', () => {
    const check: Record<string, (b: Record<string, unknown>) => unknown> = { exa: exaRequest, search: parallelRequest, 'web-search': braveQuery, tavily: tavilyRequest, reserves: reservesRequest, image: imageRequest };
    for (const tool of x402Tools(CATALOG)) {
      const d = discovery(tool);
      expect(d.bodyType).toBe('json');
      expect(() => check[tool.name]!(d.input)).not.toThrow();
    }
  });
  it('decodes a PAYMENT-RESPONSE header and tolerates garbage', () => {
    const s = { success: true, transaction: '0xabc', network: 'eip155:8453', payer: '0xdef' };
    expect(decodeSettlement(Buffer.from(JSON.stringify(s)).toString('base64'))).toEqual(s);
    expect(decodeSettlement('not base64 json')).toBeNull();
    expect(decodeSettlement(null)).toBeNull();
  });
});

import { generateKeyPairSync } from 'node:crypto';
import { cdpJwt } from '../src/cdp-auth.js';
describe('cdp auth', () => {
  it('signs an EdDSA JWT with the uris claim for the facilitator path', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const seed = (privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer).subarray(-32);
    const pub = (publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(-32);
    const token = cdpJwt('11111111-2222-3333-4444-555555555555', Buffer.concat([seed, pub]).toString('base64'), 'POST', '/platform/v2/x402/settle');
    const [h, p] = token.split('.').slice(0, 2).map((x) => JSON.parse(Buffer.from(x, 'base64url').toString()));
    expect(h.alg).toBe('EdDSA');
    expect(h.kid).toBe('11111111-2222-3333-4444-555555555555');
    expect(p.uris).toEqual(['POST api.cdp.coinbase.com/platform/v2/x402/settle']);
    expect(p.exp - p.nbf).toBe(120);
  });
});
