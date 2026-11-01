import { describe, expect, it } from 'vitest';
import { anchorRecord, dueDay, isDue, memoFor } from '../src/anchor.js';

describe('anchor', () => {
  it('anchors the previous UTC day', () => {
    expect(dueDay(new Date('2026-11-02T00:30:00Z'))).toBe('2026-11-01');
    expect(dueDay(new Date('2026-03-01T12:00:00Z'))).toBe('2026-02-28');
  });
  it('is due once per day after the anchoring hour', () => {
    const t = new Date('2026-11-02T01:05:00Z');
    expect(isDue(t, null, 1)).toBe(true);
    expect(isDue(t, '2026-11-01', 1)).toBe(false);
    expect(isDue(new Date('2026-11-02T00:55:00Z'), null, 1)).toBe(false);
  });
  it('uses the digest hash as the bytes32 memo and refuses anything else', () => {
    const sha = 'ab'.repeat(32);
    expect(memoFor({ day: 'd', count: 1, sha256: sha })).toBe(`0x${sha}`);
    expect(() => memoFor({ day: 'd', count: 1, sha256: 'xyz' })).toThrow();
  });
  it('records a dry run under a distinct id', () => {
    const r = anchorRecord({ day: '2026-11-01', count: 3, sha256: 'ab'.repeat(32) }, 4217, '0x20c0', '0xabc', null, true, new Date('2026-11-02T01:00:00Z'));
    expect(r).toMatchObject({ id: 'anchor:2026-11-01:dry', type: 'ledger.anchor', dryRun: true, txHash: null, chainId: 4217 });
    expect(anchorRecord({ day: '2026-11-01', count: 3, sha256: 'ab'.repeat(32) }, 4217, '0x20c0', '0xabc', '0xtx', false).id).toBe('anchor:2026-11-01');
  });
});
