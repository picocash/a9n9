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
  { name: 'exa', path: '/v1/exa', price: process.env.PRICE_EXA ?? '0.0100', description: 'Exa neural/keyword search: a query → up to 10 results with highlights', requiresEnv: 'EXA_API_KEY' },
  { name: 'image', path: '/v1/image', price: process.env.PRICE_IMAGE ?? '0.0300', description: 'xAI grok-imagine-image: a prompt (optionally a reference image_url) → one JPEG image URL', requiresEnv: 'XAI_API_KEY' },
  { name: 'video', path: '/v1/video', price: process.env.PRICE_VIDEO ?? '0.3000', description: 'xAI grok-imagine-video: a prompt (optionally a starting image_url) → one MP4 of up to 5 seconds; long renders return a request id to poll at GET /v1/video/{id}', requiresEnv: 'XAI_API_KEY' },
  { name: 'tavily', path: '/v1/tavily', price: process.env.PRICE_TAVILY ?? '0.0100', description: 'Tavily search: a query → up to 10 results with content snippets and an optional answer', requiresEnv: 'TAVILY_API_KEY' },
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

/** Exa /search request from a client body. */
export function exaRequest(body: Record<string, unknown>): { query: string; type: string; numResults: number; contents: { highlights: boolean } } {
  const query = str(body.q ?? body.query, 1000);
  if (!query) throw new ToolInputError('query required');
  const n = typeof body.num_results === 'number' ? Math.max(1, Math.min(10, Math.floor(body.num_results))) : 5;
  const type = ['auto', 'neural', 'keyword', 'fast'].includes(String(body.type)) ? String(body.type) : 'auto';
  return { query, type, numResults: n, contents: { highlights: true } };
}

/** Tavily /search request from a client body. */
export function tavilyRequest(body: Record<string, unknown>): { query: string; max_results: number; search_depth: 'basic'; include_answer: boolean } {
  const query = str(body.q ?? body.query, 400);
  if (!query) throw new ToolInputError('query required');
  const n = typeof body.max_results === 'number' ? Math.max(1, Math.min(10, Math.floor(body.max_results))) : 5;
  return { query, max_results: n, search_depth: 'basic', include_answer: Boolean(body.include_answer) };
}

/** xAI /v1/images/generations request from a client body. One image per call so the flat price holds. */
export function imageRequest(body: Record<string, unknown>): { model: string; prompt: string; n: 1; response_format: 'url'; image_url?: string } {
  const prompt = str(body.prompt, 4000);
  if (!prompt) throw new ToolInputError('prompt required');
  const image_url = str(body.image_url, 2000);
  if (image_url && !/^https:\/\//.test(image_url)) throw new ToolInputError('image_url must be https');
  return { model: 'grok-imagine-image', prompt, n: 1, response_format: 'url', ...(image_url ? { image_url } : {}) };
}

/** xAI /v1/videos/generations request from a client body. Duration is capped at 5 s so the flat price covers the vendor cost ($0.05/s). */
export function videoRequest(body: Record<string, unknown>): { model: string; prompt: string; duration: number; image_url?: string } {
  const prompt = str(body.prompt, 4000);
  if (!prompt) throw new ToolInputError('prompt required');
  const d = typeof body.duration === 'number' ? Math.max(1, Math.min(5, Math.round(body.duration))) : 5;
  const image_url = str(body.image_url, 2000);
  if (image_url && !/^https:\/\//.test(image_url)) throw new ToolInputError('image_url must be https');
  return { model: 'grok-imagine-video', prompt, duration: d, ...(image_url ? { image_url } : {}) };
}
