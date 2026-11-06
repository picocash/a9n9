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
import { CATALOG, ToolInputError, braveQuery, exaRequest, imageRequest, parallelCost, parallelDecideRequest, parallelExtractRequest, parallelFindAllRequest, parallelMonitorRequest, parallelRequest, parallelTaskRequest, reservesRequest, tavilyRequest, videoRequest, type Tool } from './catalog.js';
import { createX402, decodeSettlement, type X402Options, sellable } from './x402.js';

export interface ToolsOptions {
  mintUrl: string;
  realm: string;
  secretKey: string;
  lockKey: Uint8Array;
  vendorKeys: { PARALLEL_API_KEY?: string; BRAVE_API_KEY?: string; EXA_API_KEY?: string; TAVILY_API_KEY?: string; XAI_API_KEY?: string; RESERVES_URL?: string };
  /** Vendor spend ceiling per UTC day on Parallel.ai across every buyer (prepaid credits; the Service API balance needs an OAuth token we do not hold). Default $5. */
  parallelDailyUsd?: number;
  /** Active Parallel monitors allowed at once (each costs about $0.10 a month on lite). Default 20. */
  parallelMaxMonitors?: number;
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
  const x402 = opts.x402 ? createX402({ ...opts.x402, tools: sellable(opts.vendorKeys as Record<string, string | undefined>, opts.x402.tools) }) : undefined;
  const x402Stats = { settled: 0, failed: 0 };
  // Parallel.ai: one key, prepaid credits, several tools. A per-day vendor budget (in-process; resets with the deploy) keeps a buyer
  // loop or a runaway agent from draining the credits; the spend itself is on every tools.call event in the ledger.
  const PARALLEL_DAILY = opts.parallelDailyUsd ?? Number(process.env.PARALLEL_DAILY_USD ?? 5);
  const PARALLEL_MONITORS = opts.parallelMaxMonitors ?? Number(process.env.PARALLEL_MAX_MONITORS ?? 20);
  const parallelSpend = { day: '', usd: 0 };
  const parallelBudget = (cost: number): string | null => {
    const day = new Date().toISOString().slice(0, 10);
    if (parallelSpend.day !== day) { parallelSpend.day = day; parallelSpend.usd = 0; }
    if (parallelSpend.usd + cost > PARALLEL_DAILY) return `daily Parallel.ai budget reached ($${parallelSpend.usd.toFixed(3)} of $${PARALLEL_DAILY} used today); try tomorrow`;
    return null;
  };
  const parallel = (path: string, init: RequestInit & { timeoutMs?: number } = {}) => fetchImpl(`https://api.parallel.ai${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-api-key': opts.vendorKeys.PARALLEL_API_KEY!, ...((init.headers as Record<string, string>) ?? {}) }, signal: AbortSignal.timeout(init.timeoutMs ?? 45_000) });
  const PARALLEL_TOOLS = new Set(['search', 'extract', 'decide', 'task', 'findall', 'monitor']);

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

  // Reading a monitor's events is free (the creation paid for the checks); the id is unguessable.
  app.get('/v1/monitor/:id/events', async (c) => {
    const id = c.req.param('id');
    if (!/^monitor_[a-z0-9]{8,64}$/.test(id) || !opts.vendorKeys.PARALLEL_API_KEY) return c.json({ error: 'unknown monitor' }, 404);
    const q = new URLSearchParams(); const g = c.req.query('event_group_id'); if (g && /^[\w-]{1,80}$/.test(g)) q.set('event_group_id', g);
    const res = await parallel(`/v1/monitors/${id}/events${q.size ? `?${q}` : ''}`, { timeoutMs: 20_000 });
    return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
  });
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
        else if (tool.name === 'extract') parallelExtractRequest(body);
        else if (tool.name === 'decide') parallelDecideRequest(body);
        else if (tool.name === 'task') parallelTaskRequest(body);
        else if (tool.name === 'findall') parallelFindAllRequest(body);
        else if (tool.name === 'monitor') parallelMonitorRequest(body);
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
      // Budget before charging: a refused call costs the buyer nothing.
      let vendorCost = 0;
      if (PARALLEL_TOOLS.has(tool.name)) {
        vendorCost = parallelCost(tool.name, body);
        const over = parallelBudget(vendorCost);
        if (over) return c.json({ error: over }, 429);
        if (tool.name === 'monitor') {
          const active = await parallel('/v1/monitors?status=active&limit=1000', { timeoutMs: 20_000 }).then((r) => r.json()).then((j) => ((j as { monitors?: unknown[] }).monitors ?? []).length).catch(() => 0);
          if (active >= PARALLEL_MONITORS) return c.json({ error: `monitor limit reached (${active} active of ${PARALLEL_MONITORS}); cancel one in the dashboard first` }, 429);
        }
      }
      const passthrough = async (res: Response) => new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
      const run = async (): Promise<Response> => {
        if (PARALLEL_TOOLS.has(tool.name)) parallelSpend.usd += vendorCost;
        if (tool.name === 'search') return passthrough(await parallel('/v1/search', { method: 'POST', body: JSON.stringify(parallelRequest(body)) }));
        if (tool.name === 'extract') return passthrough(await parallel('/v1/extract', { method: 'POST', body: JSON.stringify(parallelExtractRequest(body)), timeoutMs: 60_000 }));
        if (tool.name === 'decide') return passthrough(await parallel('/v1/decisions', { method: 'POST', body: JSON.stringify(parallelDecideRequest(body)), timeoutMs: 90_000 }));
        if (tool.name === 'task') {
          const start = await parallel('/v1/tasks/runs', { method: 'POST', body: JSON.stringify(parallelTaskRequest(body)) });
          const sj = (await start.json().catch(() => ({}))) as { run_id?: string; error?: unknown };
          if (!start.ok || !sj.run_id) return Response.json({ error: 'task failed to start', detail: sj.error ?? null }, { status: 502 });
          const res = await parallel(`/v1/tasks/runs/${sj.run_id}/result?timeout=120`, { timeoutMs: 130_000 });
          if (res.status === 408) return Response.json({ status: 'pending', run_id: sj.run_id, note: 'still running after 2 minutes; the vendor keeps the run but this service does not poll it. Use processor lite or base, or a narrower input.' }, { status: 202 });
          return passthrough(res);
        }
        if (tool.name === 'findall') {
          const start = await parallel('/v1beta/findall/runs', { method: 'POST', body: JSON.stringify(parallelFindAllRequest(body)) });
          const sj = (await start.json().catch(() => ({}))) as { findall_id?: string; error?: unknown };
          if (!start.ok || !sj.findall_id) return Response.json({ error: 'findall failed to start', detail: sj.error ?? null }, { status: 502 });
          const deadline = Date.now() + 240_000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 6000));
            const st = (await parallel(`/v1beta/findall/runs/${sj.findall_id}`, { timeoutMs: 20_000 }).then((r) => r.json()).catch(() => ({}))) as { status?: { is_active?: boolean; status?: string } };
            if (st.status && st.status.is_active === false) break;
          }
          const res = await parallel(`/v1beta/findall/runs/${sj.findall_id}/result`, { timeoutMs: 30_000 });
          const rj = (await res.json().catch(() => ({}))) as { run?: { status?: { is_active?: boolean } }; candidates?: unknown[] };
          return Response.json({ ...rj, note: rj.run?.status?.is_active ? 'still running after 4 minutes: this is a snapshot; candidates may still be generated' : undefined }, { status: res.ok ? 200 : res.status });
        }
        if (tool.name === 'monitor') {
          const res = await parallel('/v1/monitors', { method: 'POST', body: JSON.stringify(parallelMonitorRequest(body)) });
          const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return Response.json(res.ok ? { ...j, events_url: `/v1/monitor/${String(j.monitor_id)}/events`, note: 'runs once now, then on its frequency; read events free at events_url (add ?event_group_id= from a webhook or read the latest)' } : j, { status: res.ok ? 200 : res.status });
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
      };
      // Protocol switch, in the route's own context (mppx scopes a challenge to the route that issued it):
      // x402 retry → verify, handler, settle; MPP retry → the gate below; unpaid → one merged 402 with both rails.
      // The x402 challenge names the public resource URL; a buyer reaching the service by its LAN address (the agent's own
      // picocash client, pay-e2e) gets the MPP-only 402, or its client refuses a resource that is not the URL it called.
      const publicHost = x402 ? new URL(opts.x402!.publicUrl).host : '';
      if (x402 && x402.paidRoutes.has(`POST ${tool.path}`) && (c.req.header('host') ?? '') === publicHost) {
        const h = c.req.raw.headers;
        if (h.has('payment-signature') || h.has('x-payment')) {
          const r = await x402.middleware(c, async () => { c.set('paidVia', 'x402'); c.res = await gate(c, tool, run); });
          return r ?? c.res;
        }
        if (!h.get('authorization')?.startsWith('Payment ')) {
          const xres = (await x402.middleware(c, async () => {})) ?? c.res;
          if (xres && xres.status === 402) {
            const out = new Response(xres.body, { status: 402, headers: new Headers(xres.headers) });
            const chargeMw = mppx.charge;
            const mres = chargeMw ? ((await chargeMw({ amount: tool.price })(c, async () => {})) ?? c.res) : undefined;
            const www = mres?.headers.get('www-authenticate');
            if (www) out.headers.set('WWW-Authenticate', www);
            return out;
          }
        }
      }
      return gate(c, tool, run);
    });
  }
  return { app, acceptor, lockPubkey, keyset, stats, x402Stats };
}
