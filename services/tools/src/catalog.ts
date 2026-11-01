/**
 * The tool catalog: what is for sale, at what flat price, and how a request
 * body is turned into the vendor call. Prices are decimal dollar strings and
 * depend on NOTHING in the body, so the 402 challenge and the paid retry agree.
 */
export interface Tool {
  name: string;
  path: string;
  /** Dollars per call. */
  price: string;
  description: string;
  /** Which secret must be present for the tool to be available. */
  requiresEnv: string;
}

export const CATALOG: Tool[] = [
  { name: 'search', path: '/v1/search', price: process.env.PRICE_SEARCH ?? '0.0100', description: 'Parallel.ai web search: an objective and/or up to 5 queries → ranked results with excerpts', requiresEnv: 'PARALLEL_API_KEY' },
  { name: 'web-search', path: '/v1/web-search', price: process.env.PRICE_WEB_SEARCH ?? '0.0080', description: 'Brave Search API: a query → up to 20 web results', requiresEnv: 'BRAVE_API_KEY' },
];

export class ToolInputError extends Error {}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Parallel.ai /v1beta/search request from a client body. */
export function parallelRequest(body: Record<string, unknown>): { objective?: string; search_queries?: string[]; max_results: number; processor: string } {
  const objective = str(body.objective, 2000);
  const queries = Array.isArray(body.queries) ? body.queries.map((q) => str(q, 300)).filter(Boolean).slice(0, 5) : [];
  if (!objective && !queries.length) throw new ToolInputError('objective or queries[] required');
  const n = typeof body.max_results === 'number' ? Math.max(1, Math.min(20, Math.floor(body.max_results))) : 10;
  return { ...(objective ? { objective } : {}), ...(queries.length ? { search_queries: queries } : {}), max_results: n, processor: 'base' };
}

/** Brave /res/v1/web/search query string from a client body. */
export function braveQuery(body: Record<string, unknown>): URLSearchParams {
  const q = str(body.q ?? body.query, 400);
  if (!q) throw new ToolInputError('q required');
  const count = typeof body.count === 'number' ? Math.max(1, Math.min(20, Math.floor(body.count))) : 10;
  const p = new URLSearchParams({ q, count: String(count) });
  const country = str(body.country, 2);
  if (country) p.set('country', country);
  return p;
}
