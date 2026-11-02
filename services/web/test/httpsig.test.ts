import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { directoryResponse, makeKeyFetcher, parseSignatureInput, signRequest, signerFromSeed, thumbprint, verifyRequest, type Jwk } from '../src/httpsig.js';

function freshSigner() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'jwk' }) as Jwk; const priv = privateKey.export({ format: 'jwk' }) as { d: string };
  return signerFromSeed(Buffer.from(priv.d, 'base64url').toString('hex'), pub.x);
}

describe('http message signatures (web bot auth profile)', () => {
  const signer = freshSigner();
  const agent = 'https://agent001.a9n9.net';
  const fetchKey = async (a: string | undefined, kid: string) => (a === agent && kid === signer.kid ? signer.jwk : undefined);

  it('signs a request and verifies it against the agent directory', async () => {
    const now = 1_800_000_000;
    const h = signRequest({ authority: 'shop.example', path: '/cart', signatureAgent: agent, signer, tag: 'agent-browser-auth', now, ttlSeconds: 120 });
    expect(h['Signature-Input']).toContain('tag="agent-browser-auth"');
    expect(h['Signature-Agent']).toBe('"https://agent001.a9n9.net"');
    const r = await verifyRequest({ method: 'GET', authority: 'shop.example', path: '/cart', headers: { 'signature-input': h['Signature-Input'], signature: h.Signature, 'signature-agent': h['Signature-Agent'] } }, fetchKey, now + 10);
    expect(r).toMatchObject({ ok: true, signed: true, tag: 'agent-browser-auth', kid: signer.kid, agent });
  });

  it('rejects a replayed nonce, a tampered authority, an expired window and a too-long window', async () => {
    const now = 1_800_000_000;
    const h = signRequest({ authority: 'shop.example', signatureAgent: agent, signer, now, nonce: 'n1' });
    const headers = { 'signature-input': h['Signature-Input'], signature: h.Signature, 'signature-agent': h['Signature-Agent'] };
    expect((await verifyRequest({ method: 'GET', authority: 'shop.example', path: '/', headers }, fetchKey, now)).ok).toBe(true);
    expect((await verifyRequest({ method: 'GET', authority: 'shop.example', path: '/', headers }, fetchKey, now)).reason).toBe('nonce replayed');
    expect((await verifyRequest({ method: 'GET', authority: 'evil.example', path: '/', headers }, fetchKey, now)).reason).toBe('signature does not verify');
    expect((await verifyRequest({ method: 'GET', authority: 'shop.example', path: '/', headers }, fetchKey, now + 3600)).reason).toBe('expired');
    const long = signRequest({ authority: 'shop.example', signatureAgent: agent, signer, now, ttlSeconds: 900, nonce: 'n2' });
    expect((await verifyRequest({ method: 'GET', authority: 'shop.example', path: '/', headers: { 'signature-input': long['Signature-Input'], signature: long.Signature, 'signature-agent': long['Signature-Agent'] } }, fetchKey, now)).reason).toContain('8 minutes');
  });

  it('serves a signed key directory whose keys carry only public material and verifiable thumbprints', () => {
    const d = directoryResponse('agent001.a9n9.net', [signer], 1_800_000_000);
    const body = JSON.parse(d.body) as { keys: Jwk[] };
    expect(body.keys[0]).toMatchObject({ kty: 'OKP', crv: 'Ed25519', x: signer.jwk.x, kid: signer.kid });
    expect(JSON.stringify(body)).not.toContain('"d"');
    expect(thumbprint(body.keys[0]!)).toBe(signer.kid);
    expect(d.headers['content-type']).toBe('application/http-message-signatures-directory+json');
    const [input] = parseSignatureInput(d.headers['Signature-Input']!);
    expect(input!.components[0]).toEqual({ name: '@authority', params: ';req' });
    expect(input!.params.tag).toBe('http-message-signatures-directory');
  });

  it('unsigned requests are reported as unsigned, not as failures', async () => {
    expect(await verifyRequest({ method: 'GET', authority: 'x', path: '/', headers: {} }, fetchKey)).toEqual({ ok: false, signed: false });
  });

  it('the default key fetcher reads the agent directory and matches by thumbprint', async () => {
    const d = directoryResponse('agent001.a9n9.net', [signer]);
    const fetchImpl = (async () => new Response(d.body, { status: 200, headers: { 'content-type': d.headers['content-type']! } })) as unknown as typeof fetch;
    const fk = makeKeyFetcher({ fetchImpl });
    expect((await fk(agent, signer.kid, 'web-bot-auth'))?.x).toBe(signer.jwk.x);
    expect(await fk(agent, 'nope', 'web-bot-auth')).toBeUndefined();
  });
});
