#!/usr/bin/env node
// x402-keepalive — keep every x402 route of tools.a9n9.net listed in the CDP Bazaar.
// A resource drops out of the Bazaar after 30 days without a settlement, so this buys one call on each
// route advertised at /.well-known/x402 (about $0.07 a round) and first tops the test buyer up from the
// agent wallet when it holds under $0.10 of USDC. Host cron on the 1st and 15th; log state/x402-keepalive.log.
// Env: TOOLS_URL (default https://tools.a9n9.net), X402_BUYER_PK (buyer), AGENT_WALLET_JSON (default ~/.agentcash/wallet.json).
// Flags: --dry-run (balances and the route list only, no transfer, no purchase).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const dry = process.argv.includes('--dry-run');
const TOOLS = (process.env.TOOLS_URL ?? 'https://tools.a9n9.net').replace(/\/$/, '');
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TOPUP_BELOW = 100_000n; // $0.10
const TOPUP = 250_000n; // $0.25
const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)']);
const stamp = () => new Date().toISOString();
const log = (m) => console.log(`${stamp()} ${m}`);

const pk = process.env.X402_BUYER_PK; if (!pk) { log('X402_BUYER_PK missing'); process.exit(2); }
const buyer = privateKeyToAccount(pk);
const walletPath = process.env.AGENT_WALLET_JSON ?? path.join(process.env.HOME ?? '', '.agentcash', 'wallet.json');
const agentRaw = JSON.parse(readFileSync(walletPath, 'utf8')).privateKey;
const agent = privateKeyToAccount(agentRaw.startsWith('0x') ? agentRaw : `0x${agentRaw}`);
const pub = createPublicClient({ chain: base, transport: http() });

const bal = (a) => pub.readContract({ address: USDC, abi: erc20, functionName: 'balanceOf', args: [a] });
let buyerUsdc = await bal(buyer.address);
log(`buyer ${buyer.address} usdc ${Number(buyerUsdc) / 1e6}; agent ${agent.address} usdc ${Number(await bal(agent.address)) / 1e6}`);
if (buyerUsdc < TOPUP_BELOW) {
  if (dry) log(`would top up buyer with ${Number(TOPUP) / 1e6} USDC from the agent wallet`);
  else {
    const wallet = createWalletClient({ account: agent, chain: base, transport: http() });
    const hash = await wallet.writeContract({ address: USDC, abi: erc20, functionName: 'transfer', args: [buyer.address, TOPUP] });
    const r = await pub.waitForTransactionReceipt({ hash });
    log(`top-up ${hash} ${r.status}`);
    buyerUsdc = await bal(buyer.address);
  }
}

const wk = await fetch(`${TOOLS}/.well-known/x402`).then((r) => r.json());
const info = await fetch(`${TOOLS}/v1/info`).then((r) => r.json());
const examples = {
  '/v1/reserves': { symbol: 'pathUSD' },
  '/v1/exa': { query: 'stablecoin reserve attestation standards', num_results: 3, type: 'auto' },
  '/v1/search': { objective: 'current reserve attestations for pathUSD', max_results: 3 },
  '/v1/web-search': { q: 'tempo stablecoin reserves', count: 3 },
  '/v1/tavily': { query: 'tempo stablecoin reserves', max_results: 3, include_answer: false },
  '/v1/image': { prompt: 'a teal dot on a white background' },
  '/v1/extract': { urls: ['https://www.tempo.xyz'], objective: 'what the page says the product is' },
  '/v1/decide': { state: { company: 'Tempo', website: 'https://www.tempo.xyz' }, questions: { has_public_docs: { type: 'noul', instructions: 'Does the company publish public developer documentation?' } } },
  '/v1/task': { input: 'Tempo (tempo.xyz)', output_schema: 'The launch year and the native stablecoin name', processor: 'lite' },
};
const routes = (wk.resources ?? []).map((u) => new URL(u).pathname).filter((p) => examples[p]);
log(`routes ${routes.join(' ')}; x402 stats ${JSON.stringify(info.x402?.stats ?? null)}`);
if (dry) process.exit(0);

const buy = path.join(path.dirname(fileURLToPath(import.meta.url)), 'x402-buy.mjs');
let failed = 0;
for (const p of routes) {
  const r = spawnSync(process.execPath, [buy, p, JSON.stringify(examples[p])], { env: { ...process.env, TOOLS_URL: TOOLS }, encoding: 'utf8', timeout: 120_000 });
  let line = r.stdout.trim().slice(0, 200);
  try { const d = JSON.parse(r.stdout); line = `status ${d.status} ms ${d.ms} tx ${d.settlement?.transaction ?? '-'} ok ${d.settlement?.success ?? '-'}`; } catch {}
  if (r.status !== 0) failed++;
  log(`${p}: ${line}${r.status !== 0 ? ` (exit ${r.status}) ${r.stderr.trim().slice(0, 200)}` : ''}`);
}
log(`done: ${routes.length - failed} settled, ${failed} failed`);
process.exit(failed ? 1 : 0);
