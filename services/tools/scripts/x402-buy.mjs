#!/usr/bin/env node
// x402-buy [tool path] [json body] — pay one call to the tools service over x402 with the test buyer key.
// Env: X402_BUYER_PK (from ~/a9n9/secrets/x402-buyer.env on the host), TOOLS_URL (default https://tools.a9n9.net).
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const pk = process.env.X402_BUYER_PK; if (!pk) { console.error('X402_BUYER_PK missing'); process.exit(2); }
const base = (process.env.TOOLS_URL ?? 'https://tools.a9n9.net').replace(/\/$/, '');
const path = process.argv[2] ?? '/v1/reserves'; const body = process.argv[3] ?? '{"symbol":"pathUSD"}';
const account = privateKeyToAccount(pk);
const client = new x402Client().register('eip155:*', new ExactEvmScheme(account));
const payFetch = wrapFetchWithPayment(fetch, client);
const t0 = Date.now();
const res = await payFetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
const text = await res.text();
const pr = res.headers.get('PAYMENT-RESPONSE');
console.log(JSON.stringify({ status: res.status, ms: Date.now() - t0, payer: account.address, settlement: pr ? decodePaymentResponseHeader(pr) : null, body: text.slice(0, 300) }, null, 1));
process.exit(res.status === 200 && pr ? 0 : 1);
