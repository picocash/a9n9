// Against the real database: a second accept of the same Ys, or of a paid challenge, must be refused. Cleans up after itself.
import pg from 'pg';
import { PostgresAcceptorStore } from '../src/pgstore.js';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const realm = `test-${Date.now()}`; const store = new PostgresAcceptorStore(pool, realm);
const st = (id: string) => ({ challenge: { challenge_id: id, expiry: Math.floor(Date.now() / 1000) + 60 }, receipt: { ok: true } }) as never;
const a = await store.accept(st('c1'), ['y1', 'y2']);
const b = await store.accept(st('c2'), ['y2', 'y3']);
const c = await store.accept(st('c1'), ['y9']);
const y3 = await store.hasAnyY(['y3']);
const race = await Promise.all([store.accept(st('r1'), ['z']), store.accept(st('r2'), ['z'])]);
console.log(JSON.stringify({ first: a, reusedY: b, paidChallenge: c, partialRolledBack: !y3, raceWinners: race.filter(Boolean).length }));
await pool.query('DELETE FROM a9n9.acceptor_seen WHERE realm=$1', [realm]); await pool.query('DELETE FROM a9n9.acceptor_challenges WHERE realm=$1', [realm]); await pool.end();
