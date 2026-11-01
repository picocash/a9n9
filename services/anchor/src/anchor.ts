/** Pure pieces of the anchoring job: which day is due, the memo, and the inbox record. */
import { parseAbi } from 'viem';

export const tip20Abi = parseAbi([
  'function transferWithMemo(address to, uint256 amount, bytes32 memo) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

export interface Digest { day: string; count: number; sha256: string; ids?: string[] }

/** The UTC day before `now` as YYYY-MM-DD: the day that is complete and safe to anchor. */
export function dueDay(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return d.toISOString().slice(0, 10);
}

/** True when `now` is past the daily anchoring time (UTC hour) and `day` has not been anchored. */
export function isDue(now: Date, lastAnchored: string | null, hourUtc: number): boolean {
  if (now.getUTCHours() < hourUtc) return false;
  return lastAnchored !== dueDay(now);
}

/** The digest hash as the bytes32 memo. */
export function memoFor(d: Digest): `0x${string}` {
  if (!/^[0-9a-f]{64}$/.test(d.sha256)) throw new Error(`digest sha256 is not 32 bytes: ${d.sha256}`);
  return `0x${d.sha256}`;
}

export interface AnchorRecord {
  id: string;
  type: 'ledger.anchor';
  day: string;
  count: number;
  sha256: string;
  chainId: number;
  token: string;
  from: string;
  txHash: string | null;
  dryRun: boolean;
  anchoredAt: string;
}

export function anchorRecord(d: Digest, chainId: number, token: string, from: string, txHash: string | null, dryRun: boolean, now = new Date()): AnchorRecord {
  return { id: `anchor:${d.day}${dryRun ? ':dry' : ''}`, type: 'ledger.anchor', day: d.day, count: d.count, sha256: d.sha256, chainId, token, from, txHash, dryRun, anchoredAt: now.toISOString() };
}
