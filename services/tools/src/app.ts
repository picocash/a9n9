/**
 * The procurement merchant. Every tool route is gated by a picocash MPP
 * charge (settle-first): a request without a credential gets a 402 with a
 * challenge for the tool's flat price; a request with a credential for THAT
 * price is settled against the mint and forwarded to the vendor with the key
 * only this service holds. Each paid call is reported to the inbox as a
 * tools.call event — the agent's spend and the platform's revenue in one line.
 */
import { createHmac } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { Mppx } from 'mppx/hono';
import { Credential } from 'mppx';
import { Wallet } from '@picocash/sdk';
import { PicocashAcceptor, type AcceptorStore } from '@picocash/mppx-method';
import { charge, toBaseUnits } from '@picocash/mppx-method/mppx';
import { p2pkPublicKey } from '@picocash/crypto';
import { CATALOG, ToolInputError, braveQuery, exaRequest, parallelRequest, tavilyRequest, type Tool } from './catalog.js';

export interface ToolsOptions {
  mintUrl: string;
  realm: string;
  secretKey: string;
  lockKey: Uint8Array;
  vendorKeys: { PARALLEL_API_KEY?: string; BRAVE_API_KEY?: string; EXA_API_KEY?: string; TAVILY_API_KEY?: string };
  inbox?: { url: string; secret: string };
  acceptorStore?: AcceptorStore;
  fetchImpl?: typeof fetch;
  decimals?: number;
  log?: (m: string) => void;
}

export async function createToolsApp(opts: ToolsOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const decimals = opts.decimals ?? 6;
  const log = opts.log ?? (() => {});
  const serviceWallet = new Wallet({ mintUrl: opts.mintUrl, ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}) });
  const keyset = await serviceWallet.getKeyset();
  const [, chainId, currency] = keyset.unit.split(':');
  const realmHost = new URL(opts.realm).host;
  const acceptor = new PicocashAcceptor({ realm: realmHost, mints: [{ url: opts.mintUrl, keyset }], lockKey: opts.lockKey, ...(opts.acceptorStore ? { store: opts.acceptorStore } : {}) });
  const lockPubkey = p2pkPublicKey(opts.lockKey);
  const stats = { settled: 0, calls: 0, failed: 0 };
  const mppx = Mppx.create({
    methods: [charge({ acceptor, wallet: serviceWallet, currency: currency!, chainId: Number(chainId), mints: [{ url: opts.mintUrl, keysetIds: [keyset.id] }], pubkey: lockPubkey, decimals, onAccepted: () => { stats.settled++; } })],
    secretKey: opts.secretKey,
    realm: realmHost,
  });

  async function report(payload: { id: string; type: string } & Record<string, unknown>): Promise<void> {
    if (!opts.inbox) return;
    const body = JSON.stringify(payload);
    const sig = createHmac('sha256', opts.inbox.secret).update(body).digest('hex');
    await fetchImpl(`${opts.inbox.url.replace(/\/$/, '')}/hooks/tools`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) }).catch((e) => log(`inbox report failed: ${e.message}`));
  }

  const available = (t: Tool) => Boolean((opts.vendorKeys as Record<string, string | undefined>)[t.requiresEnv]);
  const app = new Hono();

  app.get('/livez', (c) => c.json({ ok: true }));
  app.get('/v1/info', (c) =>
    c.json({
      service: 'a9n9 tools (procurement)',
      realm: opts.realm,
      mint: opts.mintUrl,
      unit: keyset.unit,
      pubkey: lockPubkey,
      tools: CATALOG.map((t) => ({ name: t.name, path: t.path, price: t.price, description: t.description, available: available(t) })),
      stats,
    }),
  );

  // Underpay guard shared by every tool: a presented credential must carry a challenge for THIS tool's price.
  async function gate(c: Context, tool: Tool, run: () => Promise<Response>): Promise<Response> {
    const priceBase = toBaseUnits(tool.price, decimals);
    const auth = c.req.header('authorization');
    if (auth?.startsWith('Payment ')) {
      let amount: string | undefined;
      try {
        amount = (Credential.fromRequest(c.req.raw)?.challenge?.request as { amount?: string } | undefined)?.amount;
      } catch {
        amount = undefined;
      }
      if (amount !== priceBase) {
        const headers = new Headers(c.req.raw.headers);
        headers.delete('authorization');
        const fresh = await app.fetch(new Request(c.req.raw.url, { method: 'POST', headers, body: await c.req.raw.clone().text() }));
        const out = new Response(fresh.body, { status: fresh.status, headers: new Headers(fresh.headers) });
        out.headers.set('X-Picocash-Reason', `credential was for ${amount ?? 'unknown'} base units; ${tool.name} costs ${priceBase}`);
        return out;
      }
    }
    const started = Date.now();
    const chargeMw = mppx.charge;
    if (!chargeMw) throw new Error('mppx charge middleware unavailable');
    const gated = await chargeMw({ amount: tool.price })(c, async () => {
      stats.calls++;
      let res: Response;
      try {
        res = await run();
      } catch (err) {
        stats.failed++;
        res = Response.json({ error: 'vendor call failed', detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
      }
      const headers = new Headers({ 'content-type': res.headers.get('content-type') ?? 'application/json', 'X-Picocash-Price': tool.price });
      c.res = new Response(res.body, { status: res.status, headers });
      void report({ id: `tools:${crypto.randomUUID()}`, type: 'tools.call', channel: 'tools', tool: tool.name, price: tool.price, unit: keyset.unit, vendorStatus: res.status, ms: Date.now() - started, at: new Date().toISOString() });
    });
    return gated ?? c.res;
  }

  for (const tool of CATALOG) {
    app.post(tool.path, async (c) => {
      if (!available(tool)) return c.json({ error: `${tool.name} is not available on this deployment yet` }, 503);
      let body: Record<string, unknown>;
      try {
        body = (await c.req.raw.clone().json()) as Record<string, unknown>;
      } catch {
        return c.json({ error: 'body must be JSON' }, 400);
      }
      // Validate before charging so a bad request never costs anything.
      try {
        if (tool.name === 'search') parallelRequest(body);
        else if (tool.name === 'exa') exaRequest(body);
        else if (tool.name === 'tavily') tavilyRequest(body);
        else braveQuery(body);
      } catch (err) {
        if (err instanceof ToolInputError) return c.json({ error: err.message }, 400);
        throw err;
      }
      return gate(c, tool, async () => {
        if (tool.name === 'search') {
          const res = await fetchImpl('https://api.parallel.ai/v1beta/search', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': opts.vendorKeys.PARALLEL_API_KEY! }, body: JSON.stringify(parallelRequest(body)), signal: AbortSignal.timeout(45_000) });
          return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
        }
        if (tool.name === 'exa') {
          const res = await fetchImpl('https://api.exa.ai/search', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': opts.vendorKeys.EXA_API_KEY! }, body: JSON.stringify(exaRequest(body)), signal: AbortSignal.timeout(30_000) });
          return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
        }
        if (tool.name === 'tavily') {
          const res = await fetchImpl('https://api.tavily.com/search', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.vendorKeys.TAVILY_API_KEY!}` }, body: JSON.stringify(tavilyRequest(body)), signal: AbortSignal.timeout(30_000) });
          return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
        }
        const res = await fetchImpl(`https://api.search.brave.com/res/v1/web/search?${braveQuery(body)}`, { headers: { accept: 'application/json', 'x-subscription-token': opts.vendorKeys.BRAVE_API_KEY! }, signal: AbortSignal.timeout(20_000) });
        return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
      });
    });
  }
  return { app, acceptor, lockPubkey, keyset, stats };
}
