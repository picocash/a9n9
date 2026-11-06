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
import { CATALOG, ToolInputError, braveQuery, exaRequest, imageRequest, parallelRequest, reservesRequest, tavilyRequest, videoRequest, type Tool } from './catalog.js';
import { createX402, decodeSettlement, type X402Options } from './x402.js';

export interface ToolsOptions {
  mintUrl: string;
  realm: string;
  secretKey: string;
  lockKey: Uint8Array;
  vendorKeys: { PARALLEL_API_KEY?: string; BRAVE_API_KEY?: string; EXA_API_KEY?: string; TAVILY_API_KEY?: string; XAI_API_KEY?: string; RESERVES_URL?: string };
  inbox?: { url: string; secret: string };
  acceptorStore?: AcceptorStore;
  /** Sell the same routes over x402 (USDC on Base) as well as MPP/picocash. */
  x402?: X402Options;
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
  type Vars = { paidVia?: 'x402'; tool?: string };
  const app = new Hono<{ Variables: Vars }>();
  const x402 = opts.x402 ? createX402(opts.x402) : undefined;
  const x402Stats = { settled: 0, failed: 0 };

  if (x402) {
    // Ledger, outermost: a PAYMENT-RESPONSE on the way out is a settlement (or a settlement failure) to record.
    app.use('*', async (c, next) => {
      await next();
      const s = decodeSettlement(c.res.headers.get('payment-response'));
      if (!s) return;
      const tool = CATALOG.find((t) => t.path === c.req.path);
      const at = new Date().toISOString();
      if (s.success) {
        x402Stats.settled++;
        void report({ id: `x402:income:${s.transaction ?? crypto.randomUUID()}`, type: 'money.income', channel: 'tools', rail: 'x402', network: s.network, payer: s.payer, transaction: s.transaction, tool: tool?.name, amount_usd: tool ? Number(tool.price) : null, currency: 'USDC', payTo: opts.x402!.payTo, at });
      } else {
        x402Stats.failed++;
        log(`x402 settlement failed on ${c.req.path}: ${s.errorReason ?? 'unknown'}${s.transaction ? ` tx ${s.transaction}` : ''}`);
        void report({ id: `x402:settle-failed:${crypto.randomUUID()}`, type: 'agent.note', channel: 'tools', kind: 'x402.settlement-failed', tool: tool?.name, reason: s.errorReason ?? null, transaction: s.transaction ?? null, payer: s.payer ?? null, at });
      }
    });
    // Protocol switch on paid routes: x402 retry → verify, handler, settle; MPP retry → the existing gate; unpaid → one merged 402.
    app.use('*', async (c, next) => {
      if (!x402.paidRoutes.has(`${c.req.method} ${c.req.path}`)) return next();
      const h = c.req.raw.headers;
      if (h.has('payment-signature') || h.has('x-payment')) return x402.middleware(c, async () => { c.set('paidVia', 'x402'); await next(); });
      if (h.get('authorization')?.startsWith('Payment ')) return next();
      const xres = (await x402.middleware(c, async () => {})) ?? c.res;
      if (!xres || xres.status !== 402) return xres ?? c.res;
      const tool = CATALOG.find((t) => t.path === c.req.path);
      const chargeMw = mppx.charge;
      const out = new Response(xres.body, { status: 402, headers: new Headers(xres.headers) });
      if (tool && chargeMw) {
        const mres = (await chargeMw({ amount: tool.price })(c, async () => {})) ?? c.res;
        const www = mres?.headers.get('www-authenticate');
        if (www) out.headers.set('WWW-Authenticate', www);
      }
      return out;
    });
  }

  app.get('/livez', (c) => c.json({ ok: true }));
  app.get('/v1/info', (c) =>
    c.json({
      service: 'a9n9 tools (procurement)',
      realm: opts.realm,
      mint: opts.mintUrl,
      unit: keyset.unit,
      pubkey: lockPubkey,
      tools: CATALOG.map((t) => ({ name: t.name, path: t.path, price: t.price, description: t.description, available: available(t), rails: x402 && x402.paidRoutes.has(`POST ${t.path}`) ? ['mpp/picocash', 'x402'] : ['mpp/picocash'] })),
      rails: x402 ? ['mpp/picocash', 'x402'] : ['mpp/picocash'],
      ...(x402 ? { x402: { network: opts.x402!.network, payTo: opts.x402!.payTo, asset: x402.asset, facilitator: opts.x402!.facilitator, stats: x402Stats } } : {}),
      stats,
    }),
  );

  if (x402) app.get('/.well-known/x402', (c) => c.json({ version: 2, resources: [...x402.paidRoutes].map((k) => `${opts.x402!.publicUrl.replace(/\/$/, '')}${k.split(' ')[1]}`) }));

  // Underpay guard shared by every tool: a presented credential must carry a challenge for THIS tool's price.
  async function gate(c: Context<{ Variables: Vars }>, tool: Tool, run: () => Promise<Response>): Promise<Response> {
    if (c.get('paidVia') === 'x402') {
      // Verified by the x402 middleware; it settles after this handler returns, and only on a 2xx.
      const started = Date.now();
      stats.calls++;
      let res: Response;
      try {
        res = await run();
      } catch (err) {
        stats.failed++;
        res = Response.json({ error: 'vendor call failed', detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
      }
      c.res = new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json', 'X-Price': tool.price } });
      void report({ id: `tools:${crypto.randomUUID()}`, type: 'tools.call', channel: 'tools', tool: tool.name, price: tool.price, unit: `usdc:${opts.x402!.network}`, rail: 'x402', vendorStatus: res.status, ms: Date.now() - started, at: new Date().toISOString() });
      return c.res;
    }
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
      void report({ id: `tools:${crypto.randomUUID()}`, type: 'tools.call', channel: 'tools', tool: tool.name, price: tool.price, unit: keyset.unit, rail: 'mpp', vendorStatus: res.status, ms: Date.now() - started, at: new Date().toISOString() });
    });
    return gated ?? c.res;
  }

  app.get('/v1/video/:id', async (c) => {
    const id = c.req.param('id');
    if (!/^[0-9a-f-]{36}$/.test(id) || !opts.vendorKeys.XAI_API_KEY) return c.json({ error: 'unknown request' }, 404);
    const poll = await fetchImpl(`https://api.x.ai/v1/videos/${id}`, { headers: { authorization: `Bearer ${opts.vendorKeys.XAI_API_KEY}` }, signal: AbortSignal.timeout(20_000) });
    const pj = (await poll.json().catch(() => ({}))) as { status?: string; video?: { url?: string; duration?: number }; progress?: number; error?: string };
    if (pj.status === 'done' && pj.video?.url) return c.json({ url: pj.video.url, duration: pj.video.duration, mime_type: 'video/mp4', request_id: id });
    if (pj.error) return c.json({ error: pj.error, request_id: id }, 502);
    return c.json({ status: pj.status ?? 'pending', progress: pj.progress ?? null, request_id: id }, 202);
  });

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
        else if (tool.name === 'image') imageRequest(body);
        else if (tool.name === 'video') videoRequest(body);
        else if (tool.name === 'reserves') reservesRequest(body);
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
        if (tool.name === 'reserves') {
          const res = await fetchImpl(`${opts.vendorKeys.RESERVES_URL!.replace(/\/$/, '')}/v1/tokens`, { signal: AbortSignal.timeout(20_000) });
          const j = (await res.json().catch(() => ({}))) as { tokens?: Array<Record<string, unknown>>; block?: number; blockTimestamp?: number; refreshedAt?: string };
          const { symbol } = reservesRequest(body);
          const tokens = (j.tokens ?? []).filter((t) => !symbol || String(t.symbol).toLowerCase() === symbol.toLowerCase());
          return Response.json({ source: 'https://reserves.a9n9.net', block: j.block, blockTimestamp: j.blockTimestamp, refreshedAt: j.refreshedAt, servedAt: new Date().toISOString(), tokens }, { status: res.ok ? 200 : 502 });
        }
        if (tool.name === 'image') {
          const res = await fetchImpl('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.vendorKeys.XAI_API_KEY!}` }, body: JSON.stringify(imageRequest(body)), signal: AbortSignal.timeout(90_000) });
          const j = (await res.json().catch(() => ({}))) as { data?: Array<{ url?: string; mime_type?: string }>; error?: string };
          const img = j.data?.[0];
          return Response.json(res.ok && img?.url ? { url: img.url, mime_type: img.mime_type ?? 'image/jpeg', model: 'grok-imagine-image' } : { error: j.error ?? 'image generation failed' }, { status: res.ok && img?.url ? 200 : 502 });
        }
        if (tool.name === 'video') {
          const start = await fetchImpl('https://api.x.ai/v1/videos/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.vendorKeys.XAI_API_KEY!}` }, body: JSON.stringify(videoRequest(body)), signal: AbortSignal.timeout(30_000) });
          const sj = (await start.json().catch(() => ({}))) as { request_id?: string; error?: string };
          if (!start.ok || !sj.request_id) return Response.json({ error: sj.error ?? 'video generation failed to start' }, { status: 502 });
          const deadline = Date.now() + 110_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 4000));
            const poll = await fetchImpl(`https://api.x.ai/v1/videos/${sj.request_id}`, { headers: { authorization: `Bearer ${opts.vendorKeys.XAI_API_KEY!}` }, signal: AbortSignal.timeout(20_000) });
            const pj = (await poll.json().catch(() => ({}))) as { status?: string; video?: { url?: string; duration?: number }; progress?: number; error?: string };
            if (pj.status === 'done' && pj.video?.url) return Response.json({ url: pj.video.url, duration: pj.video.duration, mime_type: 'video/mp4', model: 'grok-imagine-video', request_id: sj.request_id });
            if (pj.status === 'failed' || pj.error) return Response.json({ error: pj.error ?? 'video generation failed', request_id: sj.request_id }, { status: 502 });
          }
          return Response.json({ status: 'pending', request_id: sj.request_id, status_url: `/v1/video/${sj.request_id}`, note: 'still rendering; poll the status url (free) until it returns a url' }, { status: 202 });
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
  return { app, acceptor, lockPubkey, keyset, stats, x402Stats };
}
