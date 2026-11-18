#!/usr/bin/env node
// Runs INSIDE the ghost container: upload image files to Ghost and print {name: url} JSON. Env: GHOST_ADMIN_KEY.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const n = Math.floor(Date.now() / 1000), h = b64({ alg: 'HS256', typ: 'JWT', kid: id }), b = b64({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const out = {};
for (const f of process.argv.slice(2)) {
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f)); fd.append('purpose', 'image');
  const r = await fetch('http://127.0.0.1:2368/ghost/api/admin/images/upload/', { method: 'POST', headers: { Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https' }, body: fd });
  const j = await r.json(); out[path.basename(f, path.extname(f))] = j.images?.[0]?.url || `ERROR ${r.status}`;
}
console.log(JSON.stringify(out));
