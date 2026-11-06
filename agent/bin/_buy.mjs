// Buy one paid tool call from tools.a9n9.net with picocash eCash (testnet today): mint the exact price, meet the 402, return the result.
// Used by image/video; the service logs the purchase as a tools.call event, this side logs money.spend into the ledger.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { ledger } from './_lib.mjs';
const PAYER = Object.fromEntries(fs.readFileSync('/home/ubuntu/a9n9/secrets/agent-payer.env', 'utf8').split('\n').filter(l => /^PICOCASH_E2E_PAYER_KEY=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const TOOLS = process.env.TOOLS_URL ?? 'http://127.0.0.1:8860';

/** @param {string} path e.g. /v1/image  @param {object} body  @param {string} priceDollars e.g. '0.0300' */
export async function buy(path, body, priceDollars, { timeoutMs = 240_000 } = {}) {
  const amount = Math.round(Number(priceDollars) * 1_000_000); // base units, 6 decimals
  const out = execFileSync('node', ['/home/ubuntu/source/a9n9/services/tools/scripts/pay-e2e.mjs'], {
    encoding: 'utf8', timeout: timeoutMs,
    env: { ...process.env, PICOCASH_E2E_PAYER_KEY: PAYER.PICOCASH_E2E_PAYER_KEY, TOOLS_URL: TOOLS, TARGET_URL: `${TOOLS}${path}`, AMOUNT: String(amount), BODY: JSON.stringify(body), RESULT_JSON: '1' },
    maxBuffer: 16 * 1024 * 1024,
  });
  const m = out.match(/^result-json: (.*)$/m) ?? out.match(/^result: (.*)$/m); const status = out.match(/response (\d+)/)?.[1];
  let result = null; try { result = JSON.parse(m?.[1] ?? 'null'); } catch { result = m?.[1] ?? null; }
  await ledger({ id: `money:spend:${Date.now()}`, type: 'money.spend', channel: 'money', what: `tools${path}`, amount_usd: Number(priceDollars), rail: 'picocash (testnet eCash)', status: Number(status), at: new Date().toISOString() });
  return { status: Number(status), result, log: out.split('\n').filter(Boolean).slice(-4) };
}
