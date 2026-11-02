// One-off: copy every event file under INBOX_DATA/events into a9n9.events (idempotent). Run on the host: DATABASE_URL=... INBOX_DATA=~/a9n9/data/inbox node backfill-pg.mjs
import fs from 'node:fs'; import path from 'node:path'; import pg from 'pg';
const DATA = process.env.INBOX_DATA ?? '/home/ubuntu/a9n9/data/inbox'; const AGENT = process.env.INBOX_AGENT ?? 'agent001';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
let n = 0, inserted = 0;
for (const channel of fs.readdirSync(path.join(DATA, 'events'))) {
  const dir = path.join(DATA, 'events', channel); if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) { if (!f.endsWith('.json')) continue; const ev = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); n++;
    const r = await pool.query('INSERT INTO a9n9.events (id, agent, channel, type, received_at, payload) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [ev.id, AGENT, ev.channel, ev.type, ev.receivedAt, JSON.stringify(ev.payload)]); inserted += r.rowCount; }
}
const c = await pool.query('SELECT count(*)::int AS n FROM a9n9.events WHERE agent=$1', [AGENT]);
console.log(JSON.stringify({ files: n, inserted, inPostgres: c.rows[0].n })); await pool.end();
