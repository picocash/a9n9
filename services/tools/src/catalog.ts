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
  { name: 'reserves', path: '/v1/reserves', price: process.env.PRICE_RESERVES ?? '0.0200', description: 'a9n9 reserves evidence: every stablecoin on Tempo with on-chain supply, issuer-reported reserves, reconciliation checks and timestamps; optional {symbol} to select one', requiresEnv: 'RESERVES_URL' },
  { name: 'extract', path: '/v1/extract', price: process.env.PRICE_EXTRACT ?? '0.0100', description: 'Parallel.ai extract: up to 10 public URLs (+ optional objective) → markdown excerpts focused on the objective, or full page content', requiresEnv: 'PARALLEL_API_KEY' },
  { name: 'decide', path: '/v1/decide', price: process.env.PRICE_DECIDE ?? '0.0100', description: 'Parallel.ai decisions: a state (the entity) and up to 20 named questions (noul = probability a statement is true, choice, score) → typed answers with probabilities and web citations', requiresEnv: 'PARALLEL_API_KEY' },
  { name: 'task', path: '/v1/task', price: process.env.PRICE_TASK ?? '0.0500', description: 'Parallel.ai task run: an input and an output schema (text description or JSON schema) → researched structured output with per-field citations, reasoning and confidence; processor lite, base or core; waits up to 2 minutes', requiresEnv: 'PARALLEL_API_KEY' },
  { name: 'findall', path: '/v1/findall', price: process.env.PRICE_FINDALL ?? '1.2000', description: 'Parallel.ai FindAll: an objective, an entity type and match conditions → a dataset of matching entities with evidence per condition; generator preview (5-10 candidates) or base (up to 25 matches); waits up to 4 minutes', requiresEnv: 'PARALLEL_API_KEY' },
  { name: 'monitor', path: '/v1/monitor', price: process.env.PRICE_MONITOR ?? '0.2000', description: 'Parallel.ai monitor: a standing web watch (event stream) on a query, checked daily or weekly for a month; events are read free at GET /v1/monitor/{id}/events', requiresEnv: 'PARALLEL_API_KEY' },
  { name: 'tavily', path: '/v1/tavily', price: process.env.PRICE_TAVILY ?? '0.0100', description: 'Tavily search: a query → up to 10 results with content snippets and an optional answer', requiresEnv: 'TAVILY_API_KEY' },
];

export class ToolInputError extends Error {}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Parallel.ai /v1/search request from a client body. search_queries is required by the API: without queries the objective itself is the query. */
export function parallelRequest(body: Record<string, unknown>): { objective?: string; search_queries: string[]; mode: string; advanced_settings: { max_results: number; source_policy?: { include_domains?: string[]; after_date?: string } } } {
  const objective = str(body.objective, 2000);
  const queries = Array.isArray(body.queries) ? body.queries.map((q) => str(q, 300)).filter(Boolean).slice(0, 5) : [];
  if (!objective && !queries.length) throw new ToolInputError('objective or queries[] required');
  const n = typeof body.max_results === 'number' ? Math.max(1, Math.min(20, Math.floor(body.max_results))) : 10;
  const mode = ['turbo', 'fast', 'basic', 'advanced'].includes(String(body.mode)) ? String(body.mode) : 'advanced';
  const policy = sourcePolicy(body);
  return { ...(objective ? { objective } : {}), search_queries: queries.length ? queries : [objective.slice(0, 200)], mode, advanced_settings: { max_results: n, ...(policy ? { source_policy: policy } : {}) } };
}
const domainList = (v: unknown): string[] => (Array.isArray(v) ? v.map((d) => str(d, 100)).filter((d) => /^[a-z0-9.*/-]+$/i.test(d)).slice(0, 50) : []);
function sourcePolicy(body: Record<string, unknown>): { include_domains?: string[]; after_date?: string } | null {
  const include_domains = domainList(body.include_domains);
  const after_date = str(body.after_date, 10);
  if (after_date && !/^\d{4}-\d{2}-\d{2}$/.test(after_date)) throw new ToolInputError('after_date must be YYYY-MM-DD');
  if (!include_domains.length && !after_date) return null;
  return { ...(include_domains.length ? { include_domains } : {}), ...(after_date ? { after_date } : {}) };
}

/** Parallel.ai /v1/extract request: up to 10 https URLs, an optional objective, excerpts by default or full content. */
export function parallelExtractRequest(body: Record<string, unknown>): { urls: string[]; objective?: string; advanced_settings: { full_content: boolean } } {
  const urls = (Array.isArray(body.urls) ? body.urls : [body.url]).map((u) => str(u, 2000)).filter((u) => /^https?:\/\/\S+$/.test(u)).slice(0, 10);
  if (!urls.length) throw new ToolInputError('urls[] (http(s), up to 10) required');
  const objective = str(body.objective, 2000);
  return { urls, ...(objective ? { objective } : {}), advanced_settings: { full_content: Boolean(body.full_content) } };
}

/** Parallel.ai /v1/decisions request: a state object and 1-20 named questions of type noul (default), choice or score. */
export function parallelDecideRequest(body: Record<string, unknown>): { state: Record<string, unknown>; questions: Record<string, { type: string; instructions: string; criteria?: unknown }>; mode: 'fast' } {
  const state = body.state && typeof body.state === 'object' && !Array.isArray(body.state) ? (body.state as Record<string, unknown>) : null;
  if (!state || !Object.keys(state).length) throw new ToolInputError('state{} required: the entity or context the questions are about');
  const qs = body.questions && typeof body.questions === 'object' && !Array.isArray(body.questions) ? (body.questions as Record<string, unknown>) : null;
  const names = qs ? Object.keys(qs).filter((k) => /^[a-z0-9_]{1,40}$/i.test(k)).slice(0, 20) : [];
  if (!names.length) throw new ToolInputError('questions{} required: name → {type: noul|choice|score, instructions, criteria?} (max 20)');
  const questions: Record<string, { type: string; instructions: string; criteria?: unknown }> = {};
  for (const name of names) {
    const q = qs![name];
    const o = q && typeof q === 'object' ? (q as Record<string, unknown>) : { instructions: q };
    const type = ['noul', 'choice', 'score'].includes(String(o.type)) ? String(o.type) : 'noul';
    const instructions = str(o.instructions, 2000);
    if (!instructions) throw new ToolInputError(`question ${name} needs instructions`);
    if (type === 'choice' && (!o.criteria || typeof o.criteria !== 'object' || Array.isArray(o.criteria) || Object.keys(o.criteria as object).length < 2)) throw new ToolInputError(`choice question ${name} needs criteria{option: description} with at least 2 options`);
    if (type === 'score' && (!Array.isArray(o.criteria) || o.criteria.length < 2 || o.criteria.length > 10)) throw new ToolInputError(`score question ${name} needs criteria[] of 2-10 level descriptions`);
    questions[name] = { type, instructions, ...(o.criteria !== undefined ? { criteria: o.criteria } : {}) };
  }
  if (JSON.stringify({ state, questions }).length > 60_000) throw new ToolInputError('request too large');
  return { state, questions, mode: 'fast' };
}

export const TASK_PROCESSORS = ['lite', 'base', 'core'] as const;
/** Parallel.ai /v1/tasks/runs request: input (text or object), output schema (text description or JSON schema), processor lite|base|core (default base). */
export function parallelTaskRequest(body: Record<string, unknown>): { input: string | Record<string, unknown>; processor: string; task_spec: { output_schema: { type: 'text'; description: string } | { type: 'json'; json_schema: Record<string, unknown> } }; source_policy?: { include_domains?: string[]; after_date?: string } } {
  const input = typeof body.input === 'string' ? str(body.input, 8000) : body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? (body.input as Record<string, unknown>) : '';
  if (!input || (typeof input === 'object' && !Object.keys(input).length)) throw new ToolInputError('input required (text or object)');
  const processor = TASK_PROCESSORS.includes(String(body.processor) as (typeof TASK_PROCESSORS)[number]) ? String(body.processor) : 'base';
  let output_schema: { type: 'text'; description: string } | { type: 'json'; json_schema: Record<string, unknown> };
  if (body.json_schema && typeof body.json_schema === 'object' && !Array.isArray(body.json_schema)) output_schema = { type: 'json', json_schema: body.json_schema as Record<string, unknown> };
  else {
    const description = str(body.output_schema ?? body.schema, 4000);
    if (!description) throw new ToolInputError('output_schema (a text description of the fields wanted) or json_schema{} required');
    output_schema = { type: 'text', description };
  }
  if (JSON.stringify({ input, output_schema }).length > 40_000) throw new ToolInputError('request too large');
  const policy = sourcePolicy(body);
  return { input, processor, task_spec: { output_schema }, ...(policy ? { source_policy: policy } : {}) };
}

export const FINDALL_GENERATORS = ['preview', 'base'] as const;
/** Parallel.ai FindAll run request: objective, entity_type, 1-8 match conditions, generator preview (5-10 candidates) or base (match_limit ≤ 25). */
export function parallelFindAllRequest(body: Record<string, unknown>): { objective: string; entity_type: string; match_conditions: Array<{ name: string; description: string }>; generator: string; match_limit: number } {
  const objective = str(body.objective, 4000);
  if (!objective) throw new ToolInputError('objective required');
  const entity_type = str(body.entity_type ?? body.type, 100) || 'companies';
  const mc = Array.isArray(body.match_conditions) ? body.match_conditions : [];
  const match_conditions = mc.map((m) => { const o = m && typeof m === 'object' ? (m as Record<string, unknown>) : {}; return { name: str(o.name, 60), description: str(o.description, 1000) }; }).filter((m) => m.name && m.description).slice(0, 8);
  if (!match_conditions.length) throw new ToolInputError('match_conditions[{name, description}] required (1-8)');
  const generator = FINDALL_GENERATORS.includes(String(body.generator) as (typeof FINDALL_GENERATORS)[number]) ? String(body.generator) : 'preview';
  const lim = typeof body.match_limit === 'number' ? Math.floor(body.match_limit) : generator === 'preview' ? 10 : 25;
  const match_limit = generator === 'preview' ? Math.max(5, Math.min(10, lim)) : Math.max(1, Math.min(25, lim));
  return { objective, entity_type, match_conditions, generator, match_limit };
}

/** Parallel.ai monitor request: an event-stream watch on a query, daily or weekly, lite processor. */
export function parallelMonitorRequest(body: Record<string, unknown>): { type: 'event_stream'; frequency: string; processor: 'lite'; settings: { query: string; advanced_settings?: { source_policy: { include_domains?: string[]; after_date?: string } } }; metadata: Record<string, string> } {
  const query = str(body.query, 2000);
  if (!query) throw new ToolInputError('query required: what to watch for, in intent-heavy natural language');
  const frequency = ['1d', '1w'].includes(String(body.frequency)) ? String(body.frequency) : '1d';
  const policy = sourcePolicy(body);
  const label = str(body.label, 60).replace(/[^\w .-]/g, '');
  return { type: 'event_stream', frequency, processor: 'lite', settings: { query, ...(policy ? { advanced_settings: { source_policy: policy } } : {}) }, metadata: { via: 'tools.a9n9.net', ...(label ? { label } : {}) } };
}

/** Vendor cost estimate in dollars, for the daily Parallel budget guard (upper bounds from docs.parallel.ai/getting-started/pricing). */
export function parallelCost(tool: string, body: Record<string, unknown>): number {
  switch (tool) {
    case 'search': { const r = parallelRequest(body); return (r.mode === 'turbo' || r.mode === 'fast' ? 0.001 : 0.005) + 0.001 * Math.max(0, r.advanced_settings.max_results - 10); }
    case 'extract': return 0.001 * parallelExtractRequest(body).urls.length;
    case 'decide': return 0.001;
    case 'task': { const p = parallelTaskRequest(body).processor; return p === 'lite' ? 0.005 : p === 'core' ? 0.025 : 0.01; }
    case 'findall': { const r = parallelFindAllRequest(body); return r.generator === 'preview' ? 0.1 : 0.25 + 0.03 * r.match_limit; }
    case 'monitor': return parallelMonitorRequest(body).frequency === '1d' ? 0.1 : 0.015;
    default: return 0;
  }
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

/** Reserves evidence request: an optional symbol filter. */
export function reservesRequest(body: Record<string, unknown>): { symbol?: string } {
  const symbol = str(body.symbol, 20);
  if (symbol && !/^[A-Za-z0-9.]+$/.test(symbol)) throw new ToolInputError('symbol must be alphanumeric');
  return symbol ? { symbol } : {};
}
