#!/usr/bin/env node
// Paid things must produce. For every row in paid-resources.json, find the last real use and flag the row when it has
// been idle longer than its limit. Written after agent001 silently stopped posting on its paid X account on 2026-11-12
// and nobody (agent, daily review, coordinator) noticed for two weeks. A parked row is still listed: parked and billing
// is a decision for Arun, not a reason to stop showing it.
//   node scripts/paid-idle.mjs          JSON: rows with idleHours, and flags[]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const { resources } = JSON.parse(fs.readFileSync(new URL('./paid-resources.json', import.meta.url), 'utf8'));
const now = Date.now(); const rows = []; const flags = [];
for (const r of resources) {
  const row = { agent: r.agent, name: r.name, maxIdleHours: r.maxIdleHours };
  try {
    const t = Date.parse(execSync(r.lastUse, { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    if (!Number.isFinite(t)) throw new Error('no time');
    row.lastUse = new Date(t).toISOString(); row.idleHours = Math.round((now - t) / 36e5);
    if (row.idleHours > r.maxIdleHours) flags.push(`${r.agent}: paid "${r.name}" unused for ${row.idleHours}h (limit ${r.maxIdleHours}h)${r.parked ? `; ${r.parked}` : ''}`);
  } catch { row.error = 'could not read last use'; flags.push(`${r.agent}: paid "${r.name}" has no readable last use`); }
  rows.push(row);
}
console.log(JSON.stringify({ rows, flags }, null, 1));
