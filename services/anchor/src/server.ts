/**
 * a9n9 anchor — a long-running loop that, once per UTC day after ANCHOR_HOUR_UTC,
 * fetches yesterday's digest from the inbox and writes its SHA-256 to Tempo as
 * the memo of a zero-value transferWithMemo from the anchoring wallet to
 * itself. Fees on Tempo are paid in the stablecoin itself, so the wallet needs
 * a few dollars of the fee token. Until it has any, ANCHOR_DRY_RUN=1 records
 * what would have been sent (type ledger.anchor, dryRun true, no txHash).
 *
 *   ANCHOR_PRIVATE_KEY   0x-prefixed secp256k1 key — required unless dry run
 *   ANCHOR_TOKEN         TIP-20 address (default pathUSD 0x20c0…0000)
 *   TEMPO_RPC (https://rpc.tempo.xyz)   TEMPO_CHAIN_ID (4217)
 *   ANCHOR_HOUR_UTC (1)  ANCHOR_DRY_RUN (0|1)  ANCHOR_DATA (./data)  ANCHOR_ONCE (run once and exit)
 *   INBOX_URL, INBOX_API_TOKEN, INBOX_WEBHOOK_SECRET
 */
import { createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anchorRecord, dueDay, isDue, memoFor, tip20Abi, type Digest } from './anchor.js';

const env = process.env;
const RPC = env.TEMPO_RPC ?? 'https://rpc.tempo.xyz';
const CHAIN_ID = Number(env.TEMPO_CHAIN_ID ?? 4217);
const TOKEN = (env.ANCHOR_TOKEN ?? '0x20c0000000000000000000000000000000000000') as `0x${string}`;
const HOUR = Number(env.ANCHOR_HOUR_UTC ?? 1);
const DRY = env.ANCHOR_DRY_RUN === '1';
const DATA = env.ANCHOR_DATA ?? './data';
const INBOX_URL = (env.INBOX_URL ?? '').replace(/\/$/, '');
const INBOX_TOKEN = env.INBOX_API_TOKEN ?? '';
const INBOX_SECRET = env.INBOX_WEBHOOK_SECRET ?? '';
const KEY = env.ANCHOR_PRIVATE_KEY as `0x${string}` | undefined;
if (!INBOX_URL || !INBOX_TOKEN || !INBOX_SECRET || (!KEY && !DRY)) {
  console.error('INBOX_URL, INBOX_API_TOKEN, INBOX_WEBHOOK_SECRET and ANCHOR_PRIVATE_KEY (or ANCHOR_DRY_RUN=1) are required');
  process.exit(2);
}
const log = (m: string) => console.log(`${new Date().toISOString()} [anchor] ${m}`);

const chain = defineChain({ id: CHAIN_ID, name: `tempo-${CHAIN_ID}`, nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const publicClient = createPublicClient({ chain, transport: http() });
const account = KEY ? privateKeyToAccount(KEY) : null;
const wallet = account ? createWalletClient({ account, chain, transport: http() }) : null;

const stateFile = join(DATA, 'anchor-state.json');
async function lastAnchored(): Promise<string | null> {
  try {
    return (JSON.parse(await readFile(stateFile, 'utf8')) as { day: string }).day;
  } catch {
    return null;
  }
}

async function digest(day: string): Promise<Digest> {
  const res = await fetch(`${INBOX_URL}/v1/digest?day=${day}`, { headers: { authorization: `Bearer ${INBOX_TOKEN}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`inbox digest ${res.status}`);
  return (await res.json()) as Digest;
}

async function record(payload: { id: string; type: string } & Record<string, unknown>): Promise<number> {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', INBOX_SECRET).update(body).digest('hex');
  const res = await fetch(`${INBOX_URL}/hooks/ledger`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-a9n9-signature': `sha256=${sig}`, 'x-a9n9-event': payload.type, 'x-a9n9-id': payload.id }, body, signal: AbortSignal.timeout(8000) });
  return res.status;
}

export async function anchorOnce(now = new Date()): Promise<void> {
  const day = dueDay(now);
  const d = await digest(day);
  const memo = memoFor(d);
  const from = account?.address ?? '0x0000000000000000000000000000000000000000';
  let txHash: string | null = null;
  if (!DRY && wallet && account) {
    const balance = await publicClient.readContract({ address: TOKEN, abi: tip20Abi, functionName: 'balanceOf', args: [account.address] });
    if (balance === 0n) throw new Error(`anchoring wallet ${account.address} holds no ${TOKEN}; fund it to pay fees`);
    txHash = await wallet.writeContract({ address: TOKEN, abi: tip20Abi, functionName: 'transferWithMemo', args: [account.address, 0n, memo] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 90_000 });
    if (receipt.status !== 'success') throw new Error(`anchor tx reverted: ${txHash}`);
  }
  const rec = anchorRecord(d, CHAIN_ID, TOKEN, from, txHash, DRY, now);
  const status = await record({ ...rec, channel: 'ledger' });
  await mkdir(DATA, { recursive: true });
  if (!DRY) await writeFile(stateFile, JSON.stringify({ day, txHash }));
  log(`${DRY ? 'DRY RUN ' : ''}anchored ${day} (${d.count} events) sha256 ${d.sha256}${txHash ? ' tx ' + txHash : ''} → inbox ${status}`);
}

if (env.ANCHOR_ONCE === '1') {
  await anchorOnce();
  process.exit(0);
}
log(`running; chain ${CHAIN_ID} token ${TOKEN} wallet ${account?.address ?? '(none, dry run)'} hour ${HOUR} UTC${DRY ? ' DRY RUN' : ''}`);
for (;;) {
  try {
    const now = new Date();
    if (isDue(now, DRY ? null : await lastAnchored(), HOUR)) {
      await anchorOnce(now);
      if (DRY) await new Promise((r) => setTimeout(r, 23 * 3600_000)); // one dry record a day is plenty
    }
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
  }
  await new Promise((r) => setTimeout(r, 10 * 60_000));
}
