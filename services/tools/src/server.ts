/**
 *   PICOCASH_MINT_URL (https://mint.picocash.dev)  TOOLS_REALM (public origin)
 *   MPP_SECRET_KEY  TOOLS_LOCK_KEY (32-byte hex)   PARALLEL_API_KEY  BRAVE_API_KEY  EXA_API_KEY  TAVILY_API_KEY  XAI_API_KEY (images, video)
 *   TOOLS_PORT (8860)  TOOLS_HOST (127.0.0.1)   INBOX_URL  INBOX_WEBHOOK_SECRET
 *   x402 (optional): X402_PAY_TO (Base address)  X402_NETWORK (eip155:8453 | eip155:84532, default mainnet)
 *   X402_FACILITATOR (cdp | x402org, default cdp)  CDP_API_KEY_ID  CDP_API_KEY_SECRET  TOOLS_PUBLIC_URL (default TOOLS_REALM)
 */
import { serve } from '@hono/node-server';
import { hexToBytes } from '@picocash/crypto';
import pg from 'pg';
import { createToolsApp } from './app.js';
import { PostgresAcceptorStore } from './pgstore.js';

const env = process.env;
const need = (k: string) => {
  const v = env[k];
  if (!v) throw new Error(`${k} is required`);
  return v;
};
const PORT = Number(env.TOOLS_PORT ?? 8860);
const HOST = env.TOOLS_HOST ?? '127.0.0.1';
const log = (m: string) => console.log(`${new Date().toISOString()} [tools] ${m}`);

const realm = env.TOOLS_REALM ?? `http://localhost:${PORT}`;
let acceptorStore: PostgresAcceptorStore | undefined;
if (env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 6, idleTimeoutMillis: 30_000 });
  pool.on('error', (e) => log(`pg pool error: ${e.message}`));
  await PostgresAcceptorStore.init(pool);
  acceptorStore = new PostgresAcceptorStore(pool, realm);
  log('acceptor replay state in Postgres');
}

const x402 = env.X402_PAY_TO
  ? {
      network: (env.X402_NETWORK ?? 'eip155:8453') as 'eip155:8453' | 'eip155:84532',
      payTo: env.X402_PAY_TO,
      facilitator: (env.X402_FACILITATOR ?? 'cdp') as 'cdp' | 'x402org',
      publicUrl: env.TOOLS_PUBLIC_URL ?? realm,
      ...(env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET ? { cdp: { apiKeyId: env.CDP_API_KEY_ID, apiKeySecret: env.CDP_API_KEY_SECRET } } : {}),
    }
  : undefined;
if (x402 && x402.facilitator === 'cdp' && !x402.cdp) throw new Error('X402_FACILITATOR=cdp needs CDP_API_KEY_ID and CDP_API_KEY_SECRET');
if (x402) log(`x402 on ${x402.network} via ${x402.facilitator}, payTo ${x402.payTo}`);

const { lockPubkey, keyset, app } = await createToolsApp({
  ...(acceptorStore ? { acceptorStore } : {}),
  ...(x402 ? { x402 } : {}),
  mintUrl: (env.PICOCASH_MINT_URL ?? 'https://mint.picocash.dev').replace(/\/$/, ''),
  realm,
  secretKey: need('MPP_SECRET_KEY'),
  lockKey: hexToBytes(need('TOOLS_LOCK_KEY')),
  vendorKeys: { ...(env.PARALLEL_API_KEY ? { PARALLEL_API_KEY: env.PARALLEL_API_KEY } : {}), ...(env.BRAVE_API_KEY ? { BRAVE_API_KEY: env.BRAVE_API_KEY } : {}), ...(env.EXA_API_KEY ? { EXA_API_KEY: env.EXA_API_KEY } : {}), ...(env.TAVILY_API_KEY ? { TAVILY_API_KEY: env.TAVILY_API_KEY } : {}), ...(env.XAI_API_KEY ? { XAI_API_KEY: env.XAI_API_KEY } : {}), RESERVES_URL: env.RESERVES_URL ?? 'https://reserves.a9n9.net' },
  ...(env.INBOX_URL && env.INBOX_WEBHOOK_SECRET ? { inbox: { url: env.INBOX_URL, secret: env.INBOX_WEBHOOK_SECRET } } : {}),
  log,
});
serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  log(`listening on http://${HOST}:${info.port}; unit ${keyset.unit}; lock budgets to ${lockPubkey}`);
});
