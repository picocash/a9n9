import { describe, expect, it } from 'vitest';
import { CATALOG, braveQuery, parallelRequest } from '../src/catalog.js';

describe('tool catalog', () => {
  it('prices are flat decimal strings with a vendor key requirement', () => {
    for (const t of CATALOG) {
      expect(t.price).toMatch(/^\d+\.\d{1,6}$/);
      expect(t.requiresEnv).toMatch(/_API_KEY$/);
    }
  });
  it('builds a Parallel request and refuses an empty one', () => {
    expect(parallelRequest({ objective: ' reserves of pathUSD ', queries: ['pathUSD reserves', 42, ''], max_results: 99 })).toEqual({ objective: 'reserves of pathUSD', search_queries: ['pathUSD reserves'], max_results: 20, processor: 'base' });
    expect(() => parallelRequest({})).toThrow('objective or queries');
  });
  it('builds a Brave query with clamped count', () => {
    const p = braveQuery({ q: 'tempo stablecoin', count: 0, country: 'us' });
    expect(p.get('q')).toBe('tempo stablecoin');
    expect(p.get('count')).toBe('1');
    expect(p.get('country')).toBe('us');
    expect(() => braveQuery({})).toThrow('q required');
  });
});
