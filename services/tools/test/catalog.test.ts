import { describe, expect, it } from 'vitest';
import { CATALOG, imageRequest, videoRequest, braveQuery, exaRequest, parallelCost, parallelDecideRequest, parallelExtractRequest, parallelFindAllRequest, parallelMonitorRequest, parallelRequest, parallelTaskRequest, tavilyRequest } from '../src/catalog.js';

describe('tool catalog', () => {
  it('prices are flat decimal strings with a vendor key requirement', () => {
    for (const t of CATALOG) {
      expect(t.price).toMatch(/^\d+\.\d{1,6}$/);
      expect(t.requiresEnv).toMatch(/_(API_KEY|URL)$/);
    }
  });
  it('builds a Parallel request and refuses an empty one', () => {
    expect(parallelRequest({ objective: ' reserves of pathUSD ', queries: ['pathUSD reserves', 42, ''], max_results: 99 })).toEqual({ objective: 'reserves of pathUSD', search_queries: ['pathUSD reserves'], mode: 'advanced', advanced_settings: { max_results: 20 } });
    expect(parallelRequest({ objective: 'x402 facilitators', mode: 'fast', include_domains: ['.gov', 'bad domain'], after_date: '2026-01-01' })).toEqual({ objective: 'x402 facilitators', search_queries: ['x402 facilitators'], mode: 'fast', advanced_settings: { max_results: 10, source_policy: { include_domains: ['.gov'], after_date: '2026-01-01' } } });
    expect(() => parallelRequest({})).toThrow('objective or queries');
    expect(() => parallelRequest({ objective: 'x', after_date: 'yesterday' })).toThrow('after_date');
  });
  it('builds Exa and Tavily requests with clamped counts and validated types', () => {
    expect(exaRequest({ q: 'tempo', num_results: 50, type: 'bogus' })).toEqual({ query: 'tempo', type: 'auto', numResults: 10, contents: { highlights: true } });
    expect(tavilyRequest({ query: 'tempo', include_answer: true })).toEqual({ query: 'tempo', max_results: 5, search_depth: 'basic', include_answer: true });
    expect(() => exaRequest({})).toThrow('query required');
  });
  it('builds a Brave query with clamped count', () => {
    const p = braveQuery({ q: 'tempo stablecoin', count: 0, country: 'us' });
    expect(p.get('q')).toBe('tempo stablecoin');
    expect(p.get('count')).toBe('1');
    expect(p.get('country')).toBe('us');
    expect(() => braveQuery({})).toThrow('q required');
  });

  it('builds image and video requests: one image per call, video capped at 5 s, https-only reference images', () => {
    expect(imageRequest({ prompt: ' a teal dot ' })).toEqual({ model: 'grok-imagine-image', prompt: 'a teal dot', n: 1, response_format: 'url' });
    expect(() => imageRequest({})).toThrow('prompt required');
    expect(() => imageRequest({ prompt: 'x', image_url: 'http://insecure' })).toThrow('https');
    expect(videoRequest({ prompt: 'p', duration: 12 }).duration).toBe(5);
    expect(videoRequest({ prompt: 'p' }).duration).toBe(5);
    expect(videoRequest({ prompt: 'p', duration: 2.4, image_url: 'https://x/y.jpg' })).toEqual({ model: 'grok-imagine-video', prompt: 'p', duration: 2, image_url: 'https://x/y.jpg' });
  });
  it('builds the other Parallel requests with caps and refuses malformed ones', () => {
    expect(parallelExtractRequest({ url: 'https://a.example/p', objective: ' q ' })).toEqual({ urls: ['https://a.example/p'], objective: 'q', advanced_settings: { full_content: false } });
    expect(parallelExtractRequest({ urls: ['ftp://x', 'https://b.example', 'https://c.example'], full_content: true }).urls).toEqual(['https://b.example', 'https://c.example']);
    expect(() => parallelExtractRequest({ urls: ['not a url'] })).toThrow('urls[]');
    const d = parallelDecideRequest({ state: { company: 'Tempo' }, questions: { docs: 'Does Tempo publish docs?', tier: { type: 'choice', instructions: 'Which?', criteria: { a: 'A', b: 'B' } }, lvl: { type: 'score', instructions: 'Rate', criteria: ['none', 'some', 'all'] }, 'bad name!': 'x' } });
    expect(Object.keys(d.questions)).toEqual(['docs', 'tier', 'lvl']);
    expect(d.questions.docs).toEqual({ type: 'noul', instructions: 'Does Tempo publish docs?' });
    expect(d.mode).toBe('fast');
    expect(() => parallelDecideRequest({ state: {}, questions: { q: 'x' } })).toThrow('state{}');
    expect(() => parallelDecideRequest({ state: { a: 1 }, questions: { q: { type: 'choice', instructions: 'x', criteria: { only: 'one' } } } })).toThrow('at least 2');
    expect(() => parallelDecideRequest({ state: { a: 1 }, questions: { q: { type: 'score', instructions: 'x', criteria: ['one'] } } })).toThrow('2-10');
    expect(parallelTaskRequest({ input: 'Tempo', output_schema: 'launch year', processor: 'ultra' })).toEqual({ input: 'Tempo', processor: 'base', task_spec: { output_schema: { type: 'text', description: 'launch year' } } });
    expect(parallelTaskRequest({ input: { company: 'Tempo' }, json_schema: { type: 'object' }, processor: 'lite' }).task_spec.output_schema).toEqual({ type: 'json', json_schema: { type: 'object' } });
    expect(() => parallelTaskRequest({ input: 'x' })).toThrow('output_schema');
    expect(() => parallelTaskRequest({ output_schema: 'x' })).toThrow('input required');
    const f = parallelFindAllRequest({ objective: 'stablecoin issuers chartered in the US', match_conditions: [{ name: 'chartered', description: 'holds a US charter' }, { name: '', description: 'x' }], generator: 'pro', match_limit: 500 });
    expect(f).toEqual({ objective: 'stablecoin issuers chartered in the US', entity_type: 'companies', match_conditions: [{ name: 'chartered', description: 'holds a US charter' }], generator: 'preview', match_limit: 10 });
    expect(parallelFindAllRequest({ objective: 'x', match_conditions: [{ name: 'a', description: 'b' }], generator: 'base', match_limit: 500 }).match_limit).toBe(25);
    expect(() => parallelFindAllRequest({ objective: 'x' })).toThrow('match_conditions');
    expect(parallelMonitorRequest({ query: 'new stablecoin reserve attestations', frequency: '1h', label: 'reserves <script>' })).toEqual({ type: 'event_stream', frequency: '1d', processor: 'lite', settings: { query: 'new stablecoin reserve attestations' }, metadata: { via: 'tools.a9n9.net', label: 'reserves script' } });
    expect(() => parallelMonitorRequest({})).toThrow('query required');
  });
  it('estimates the vendor cost of a Parallel call from the pricing page', () => {
    expect(parallelCost('search', { objective: 'x' })).toBeCloseTo(0.005);
    expect(parallelCost('search', { objective: 'x', mode: 'fast', max_results: 20 })).toBeCloseTo(0.011);
    expect(parallelCost('extract', { urls: ['https://a.example', 'https://b.example'] })).toBeCloseTo(0.002);
    expect(parallelCost('task', { input: 'x', output_schema: 'y', processor: 'core' })).toBeCloseTo(0.025);
    expect(parallelCost('findall', { objective: 'x', match_conditions: [{ name: 'a', description: 'b' }], generator: 'base', match_limit: 25 })).toBeCloseTo(1.0);
    expect(parallelCost('monitor', { query: 'x' })).toBeCloseTo(0.1);
    for (const t of CATALOG.filter((t) => t.requiresEnv === 'PARALLEL_API_KEY')) expect(Number(t.price)).toBeGreaterThan(0);
  });
});
