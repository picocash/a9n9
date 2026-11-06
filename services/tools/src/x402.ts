/**
 * x402 (v2) on the tool routes: the same path answers a plain request with one 402 that carries both the x402
 * PAYMENT-REQUIRED header (USDC on Base, "exact" scheme, settled through a facilitator) and the MPP challenge; the
 * paid retry is routed by its header. Routes declare the Bazaar discovery extension so one settled call through the
 * Coinbase facilitator lists them in the CDP Bazaar and Agentic.Market. Design notes: docs/research/2026-11-05/10-x402-seller-setup.md.
 */
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { HTTPFacilitatorClient, type RoutesConfig, type RouteConfig, type FacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { bazaarResourceServerExtension, declareDiscoveryExtension } from '@x402/extensions/bazaar';
import { cdpFacilitatorClient } from './cdp-auth.js';
import { CATALOG, type Tool } from './catalog.js';

export type X402Network = 'eip155:8453' | 'eip155:84532';
export const USDC: Record<X402Network, string> = { 'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e' };

export interface X402Options {
  network: X402Network;
  payTo: string;
  facilitator: 'cdp' | 'x402org';
  /** Public HTTPS origin of this service, e.g. https://tools.a9n9.net (the 402's resource URL is the catalog key). */
  publicUrl: string;
  /** CDP Secret API key (Ed25519); falls back to CDP_API_KEY_ID / CDP_API_KEY_SECRET in the environment. */
  cdp?: { apiKeyId: string; apiKeySecret: string };
  tools?: Tool[];
}

/** Tools sold over x402: everything except video, whose long renders answer 202 and would settle before delivery. */
/** video (minutes), findall (minutes, dollars) and monitor (a standing cost) stay MPP-only: x402 settles after the handler and a Bazaar probe replays examples. */
export const x402Tools = (tools: Tool[] = CATALOG): Tool[] => tools.filter((t) => !['video', 'findall', 'monitor'].includes(t.name));

/** Tools that may be sold over x402 on this deployment: x402Tools minus any whose vendor key is missing (an advertised route that answers 503 would be listed in the Bazaar as broken). */
export const sellable = (vendorKeys: Record<string, string | undefined>, tools: Tool[] = CATALOG): Tool[] => x402Tools(tools).filter((t) => Boolean(vendorKeys[t.requiresEnv]));

/** Example input per tool. The Bazaar health probe replays it unpaid (expects a 402), so keep it cheap and valid. */
export function discovery(tool: Tool) {
  const json = (input: Record<string, unknown>, inputSchema: Record<string, unknown>, example: unknown) => ({ bodyType: 'json' as const, input, inputSchema, output: { example } });
  switch (tool.name) {
    case 'exa':
      return json({ query: 'stablecoin reserve attestation standards', num_results: 5, type: 'auto' }, { type: 'object', required: ['query'], properties: { query: { type: 'string', description: 'Search query in natural language or keywords' }, num_results: { type: 'integer', minimum: 1, maximum: 10, default: 5 }, type: { type: 'string', enum: ['auto', 'neural', 'keyword', 'fast'], default: 'auto' } } }, { results: [{ title: 'Example result', url: 'https://example.com/page', highlights: ['a matching passage'] }] });
    case 'search':
      return json({ objective: 'current reserve attestations for pathUSD', max_results: 5 }, { type: 'object', properties: { objective: { type: 'string', description: 'What to find, in a sentence' }, queries: { type: 'array', items: { type: 'string' }, maxItems: 5 }, max_results: { type: 'integer', minimum: 1, maximum: 20, default: 10 } } }, { results: [{ url: 'https://example.com/page', title: 'Example result', excerpts: ['a matching passage'] }] });
    case 'web-search':
      return json({ q: 'tempo stablecoin reserves', count: 5 }, { type: 'object', required: ['q'], properties: { q: { type: 'string', description: 'Search query' }, count: { type: 'integer', minimum: 1, maximum: 20, default: 10 }, country: { type: 'string', description: 'Two-letter country code' } } }, { web: { results: [{ title: 'Example result', url: 'https://example.com/page', description: 'snippet' }] } });
    case 'tavily':
      return json({ query: 'tempo stablecoin reserves', max_results: 5, include_answer: false }, { type: 'object', required: ['query'], properties: { query: { type: 'string', description: 'Search query' }, max_results: { type: 'integer', minimum: 1, maximum: 10, default: 5 }, include_answer: { type: 'boolean', default: false } } }, { results: [{ title: 'Example result', url: 'https://example.com/page', content: 'snippet' }] });
    case 'reserves':
      return json({ symbol: 'pathUSD' }, { type: 'object', properties: { symbol: { type: 'string', description: 'Optional stablecoin symbol on Tempo; omit for all' } } }, { source: 'https://reserves.a9n9.net', block: 1, tokens: [{ symbol: 'pathUSD', supply: '1000000', reserves: '1000000', status: 'ok' }] });
    case 'extract':
      return json({ urls: ['https://www.tempo.xyz'], objective: 'what the page says the product is' }, { type: 'object', required: ['urls'], properties: { urls: { type: 'array', items: { type: 'string' }, maxItems: 10, description: 'Public http(s) URLs' }, objective: { type: 'string', description: 'What to pull from the pages; excerpts focus on it' }, full_content: { type: 'boolean', default: false } } }, { results: [{ url: 'https://example.com/page', title: 'Example', excerpts: ['a matching passage'] }] });
    case 'decide':
      return json({ state: { company: 'Tempo', website: 'https://www.tempo.xyz' }, questions: { has_public_docs: { type: 'noul', instructions: 'Does the company publish public developer documentation?' } } }, { type: 'object', required: ['state', 'questions'], properties: { state: { type: 'object', description: 'The entity or context the questions are about' }, questions: { type: 'object', description: 'name → {type: noul|choice|score, instructions, criteria?}; max 20' } } }, { answers: { has_public_docs: { type: 'noul', noul: 0.97 } }, citations: [{ url: 'https://example.com/docs', excerpts: ['...'] }] });
    case 'task':
      return json({ input: 'Tempo (tempo.xyz)', output_schema: 'The launch year and the native stablecoin name', processor: 'lite' }, { type: 'object', required: ['input'], properties: { input: { description: 'Text or an object' }, output_schema: { type: 'string', description: 'Text description of the fields wanted' }, json_schema: { type: 'object', description: 'Alternative: a JSON schema for the output' }, processor: { type: 'string', enum: ['lite', 'base', 'core'], default: 'base' } } }, { run: { status: 'completed' }, output: { type: 'text', content: '...', basis: [{ field: 'output', citations: [{ url: 'https://example.com' }], confidence: 'high' }] } });
    case 'image':
      return json({ prompt: 'a teal dot on a white background' }, { type: 'object', required: ['prompt'], properties: { prompt: { type: 'string', description: 'Image description' }, image_url: { type: 'string', description: 'Optional https reference image' } } }, { url: 'https://example.com/image.jpg', mime_type: 'image/jpeg' });
    default:
      return json({}, { type: 'object' }, {});
  }
}

export function buildRoutes(opts: X402Options): RoutesConfig {
  const routes: Record<string, RouteConfig> = {};
  const base = opts.publicUrl.replace(/\/$/, '');
  for (const tool of x402Tools(opts.tools)) {
    routes[`POST ${tool.path}`] = {
      accepts: [{ scheme: 'exact', network: opts.network, payTo: opts.payTo, price: `$${tool.price}`, maxTimeoutSeconds: 300 }],
      resource: `${base}${tool.path}`,
      description: tool.description,
      mimeType: 'application/json',
      serviceName: 'a9n9 tools',
      tags: ['agents', 'a9n9', tool.name],
      extensions: { ...declareDiscoveryExtension(discovery(tool)) },
      unpaidResponseBody: () => ({ contentType: 'application/json', body: { error: 'payment required', rails: ['x402', 'mpp/picocash'], price_usd: tool.price, network: opts.network, docs: `${base}/v1/info` } }),
    };
  }
  return routes;
}

export function createX402(opts: X402Options) {
  const cdp = opts.cdp ?? (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET ? { apiKeyId: process.env.CDP_API_KEY_ID, apiKeySecret: process.env.CDP_API_KEY_SECRET } : undefined);
  if (opts.facilitator === 'cdp' && !cdp) throw new Error('x402 via the CDP facilitator needs a CDP Secret API key');
  const facilitator: FacilitatorClient = opts.facilitator === 'cdp' ? cdpFacilitatorClient(cdp!) : new HTTPFacilitatorClient({ url: 'https://x402.org/facilitator', timeoutMs: 30_000 });
  const server = new x402ResourceServer(facilitator).register(opts.network, new ExactEvmScheme()).registerExtension(bazaarResourceServerExtension);
  const routes = buildRoutes(opts);
  return { server, routes, paidRoutes: new Set(Object.keys(routes)), middleware: paymentMiddleware(routes, server), asset: USDC[opts.network] };
}

/** PAYMENT-RESPONSE header → settlement record (base64 JSON). */
export function decodeSettlement(header: string | null | undefined): { success: boolean; transaction?: string; network?: string; payer?: string; errorReason?: string } | null {
  if (!header) return null;
  try { return JSON.parse(Buffer.from(header, 'base64').toString('utf8')); } catch { return null; }
}
