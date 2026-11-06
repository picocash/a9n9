// End-to-end: mint a little testnet eCash from the hosted mint, then buy one
// search from the tools service with it. Needs PICOCASH_E2E_PAYER_KEY (a
// faucet-funded Tempo Moderato wallet) in the environment.
//   TOOLS_URL=http://127.0.0.1:8860 node services/tools/scripts/pay-e2e.mjs
// Any picocash merchant works: TARGET_URL=<url> BODY='<json>' overrides the search call.
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Wallet } from '@picocash/sdk';
import { Fetch } from 'mppx/client';
import { picocash } from '@picocash/mppx-method/mppx';

const TOOLS = (process.env.TOOLS_URL ?? 'http://127.0.0.1:8860').replace(/\/$/, '');
const MINT = (process.env.PICOCASH_MINT_URL ?? 'https://mint.picocash.dev').replace(/\/$/, '');
const AMOUNT = Number(process.env.AMOUNT ?? 20000); // base units = $0.02
const key = process.env.PICOCASH_E2E_PAYER_KEY;
if (!key) throw new Error('PICOCASH_E2E_PAYER_KEY required');

const wallet = new Wallet({ mintUrl: MINT });
const info = await wallet.info();
const quote = await wallet.requestMintQuote(AMOUNT);
console.log(`quote ${quote.quote_id.slice(0, 12)}… deposit ${AMOUNT} to ${quote.deposit.to}`);
const chain = defineChain({ id: quote.deposit.chain_id, name: 'tempo', nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 }, rpcUrls: { default: { http: [process.env.PICOCASH_TEMPO_RPC ?? 'https://rpc.moderato.tempo.xyz'] } } });
const account = privateKeyToAccount(key);
const wc = createWalletClient({ account, chain, transport: http() });
const pc = createPublicClient({ chain, transport: http() });
const tx = await wc.writeContract({ address: quote.deposit.token, abi: parseAbi(['function transferWithMemo(address to, uint256 amount, bytes32 memo)']), functionName: 'transferWithMemo', args: [quote.deposit.to, BigInt(AMOUNT), quote.deposit.memo] });
await pc.waitForTransactionReceipt({ hash: tx });
console.log(`deposit tx ${tx}`);
let state = quote.state;
const t0 = Date.now();
while (state !== 'PAID') {
  if (Date.now() - t0 > 120_000) throw new Error('quote never became PAID');
  await new Promise((r) => setTimeout(r, 1500));
  state = (await wallet.getMintQuote(quote.quote_id)).state;
}
let held = await wallet.mintProofs(quote.quote_id, AMOUNT);
const sum = (ps) => ps.reduce((a, p) => a + p.amount, 0);
console.log(`minted ${held.length} proofs = ${sum(held)} base units of ${info.unit}`);

let presented = [];
const pay = Fetch.from({
  fetch: globalThis.fetch,
  methods: [picocash({ wallet, getProofs: () => presented, onChange: (change) => { const shown = new Set(presented); held = [...held.filter((p) => !shown.has(p)), ...change]; } })],
  onChallenge: async (challenge, { createCredential }) => { presented = held; console.log(`402 → paying ${challenge.request.amount} base units`); return createCredential(); },
});
const before = sum(held);
const target = process.env.TARGET_URL ?? `${TOOLS}/v1/search`;
const reqBody = process.env.BODY ?? JSON.stringify({ objective: 'What are the published reserves backing pathUSD on Tempo?', queries: ['pathUSD reserves Tempo'], max_results: 3 });
const res = await pay(target, { method: 'POST', headers: { 'content-type': 'application/json' }, body: reqBody });
const body = await res.json();
console.log(`response ${res.status}; price header ${res.headers.get('X-Picocash-Price')}; receipt ${res.headers.get('Payment-Receipt') ? 'present' : 'absent'}`);
console.log(`paid ${before - sum(held)} base units; ${sum(held)} left as change`);
const first = body.results?.[0];
const said = body.choices?.[0]?.message?.content;
console.log('result:', first ? `${first.title} — ${first.url}` : said ? said.slice(0, 200) : JSON.stringify(body).slice(0, 300));
// Callers that need the whole response (agent/bin/_buy.mjs) ask for it on one line.
if (process.env.RESULT_JSON) console.log('result-json:', JSON.stringify(body));
