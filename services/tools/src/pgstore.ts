/**
 * Postgres-backed AcceptorStore for the picocash MPP charge gate: challenge state and spent-secret
 * (Y) replay protection in a9n9.acceptor_challenges / a9n9.acceptor_seen, so the tools service can
 * restart or run more than one instance without losing replay state. accept() is one transaction:
 * the Y rows are inserted first (unique per realm) and the acceptance is rolled back if any Y was
 * already seen or the challenge already carries a receipt.
 */
import pg from 'pg';
import type { AcceptorStore } from '@picocash/mppx-method';

type ChallengeState = Parameters<AcceptorStore['putChallenge']>[0];

export class PostgresAcceptorStore implements AcceptorStore {
  constructor(private readonly pool: pg.Pool, private readonly realm: string, private readonly yTtlSeconds = 86_400) {}

  static async init(pool: pg.Pool): Promise<void> {
    await pool.query(`CREATE TABLE IF NOT EXISTS a9n9.acceptor_challenges (
      realm text NOT NULL, id text NOT NULL, state jsonb NOT NULL, expiry bigint NOT NULL, receipt boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (realm, id))`);
    await pool.query('CREATE INDEX IF NOT EXISTS acceptor_challenges_exp ON a9n9.acceptor_challenges (expiry)');
  }

  async getChallenge(id: string): Promise<ChallengeState | undefined> {
    const r = await this.pool.query<{ state: ChallengeState }>('SELECT state FROM a9n9.acceptor_challenges WHERE realm=$1 AND id=$2', [this.realm, id]);
    return r.rows[0]?.state;
  }

  async putChallenge(state: ChallengeState): Promise<void> {
    await this.pool.query(
      'INSERT INTO a9n9.acceptor_challenges (realm, id, state, expiry, receipt) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (realm, id) DO UPDATE SET state=EXCLUDED.state, expiry=EXCLUDED.expiry, receipt=EXCLUDED.receipt, updated_at=now()',
      [this.realm, state.challenge.challenge_id, JSON.stringify(state), state.challenge.expiry, Boolean(state.receipt)],
    );
    // opportunistic sweep of expired, unpaid challenges and expired Ys
    if (Math.random() < 0.05) {
      const now = Math.floor(Date.now() / 1000);
      await this.pool.query('DELETE FROM a9n9.acceptor_challenges WHERE realm=$1 AND receipt=false AND expiry < $2', [this.realm, now]).catch(() => {});
      await this.pool.query('DELETE FROM a9n9.acceptor_seen WHERE expires_at < now()').catch(() => {});
    }
  }

  async hasAnyY(ys: string[]): Promise<boolean> {
    if (!ys.length) return false;
    const r = await this.pool.query('SELECT 1 FROM a9n9.acceptor_seen WHERE realm=$1 AND key = ANY($2) AND (expires_at IS NULL OR expires_at > now()) LIMIT 1', [this.realm, ys]);
    return (r.rowCount ?? 0) > 0;
  }

  async accept(state: ChallengeState, ys: string[]): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const cur = await client.query<{ receipt: boolean }>('SELECT receipt FROM a9n9.acceptor_challenges WHERE realm=$1 AND id=$2 FOR UPDATE', [this.realm, state.challenge.challenge_id]);
      if (cur.rows[0]?.receipt) { await client.query('ROLLBACK'); return false; }
      const ins = await client.query('INSERT INTO a9n9.acceptor_seen (realm, key, expires_at) SELECT $1, k, now() + ($3 || \' seconds\')::interval FROM unnest($2::text[]) AS k ON CONFLICT (realm, key) DO NOTHING', [this.realm, ys, String(this.yTtlSeconds)]);
      if ((ins.rowCount ?? 0) !== ys.length) { await client.query('ROLLBACK'); return false; }
      await client.query(
        'INSERT INTO a9n9.acceptor_challenges (realm, id, state, expiry, receipt) VALUES ($1,$2,$3,$4,true) ON CONFLICT (realm, id) DO UPDATE SET state=EXCLUDED.state, expiry=EXCLUDED.expiry, receipt=true, updated_at=now()',
        [this.realm, state.challenge.challenge_id, JSON.stringify(state), state.challenge.expiry],
      );
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
}
