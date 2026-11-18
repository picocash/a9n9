#!/usr/bin/env node
// Runs INSIDE the prod ghost container: upload + activate the theme zip, set navigation/accent, name the pillar tags.
// Usage: node ghost-site.mjs [/tmp/genxlinked.zip]   Env: GHOST_ADMIN_KEY. Leaves title/description (Arun's) alone.
import crypto from 'node:crypto';
import fs from 'node:fs';
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const n = Math.floor(Date.now() / 1000), h = b64({ alg: 'HS256', typ: 'JWT', kid: id }), b = b64({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const A = 'http://127.0.0.1:2368/ghost/api/admin';
async function api(method, p, body, form) {
  const headers = { Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https' };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(A + p, { method, headers, body: form || (body && JSON.stringify(body)) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 200) }; }
  console.log(method, p, r.status, r.status >= 400 ? JSON.stringify(j).slice(0, 300) : '');
  return j;
}
const zip = process.argv[2];
if (zip) {
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(zip)], { type: 'application/zip' }), 'genxlinked.zip');
  await api('POST', '/themes/upload/', null, fd);
  await api('PUT', '/themes/genxlinked/activate/');
}
const PILLARS = [
  ['connection', 'Real connection', 'Friendship, letters and the people we grew up alongside, in eight countries.'],
  ['sandwich', 'Sandwich generation', 'Between our parents and our kids, from Manila to Manchester.'],
  ['body', 'Body at 50+', 'Sleep, health and intimacy in midlife, by the numbers.'],
  ['bucket-list', 'Bucket list', 'The places we promised ourselves.'],
  ['in-charge', 'Gen X in charge', 'The generation now running things.'],
  ['analog-life', 'Analog life', 'Paperbacks, landlines and the gadgets we refuse to download an app for.'],
  ['work-money', 'Work & money', 'Jobs after 50, retirement and our own bank accounts, country by country.'],
];
await api('PUT', '/settings/', { settings: [
  { key: 'accent_color', value: '#C1622D' },
  { key: 'navigation', value: JSON.stringify([...PILLARS.map(([slug, name]) => ({ label: name, url: `/tag/${slug}/` })), { label: 'About', url: '/about/' }]) },
] });
const tags = await api('GET', '/tags/?limit=all');
for (const [slug, name, description] of PILLARS) {
  const t = tags.tags?.find((x) => x.slug === slug);
  if (t) await api('PUT', `/tags/${t.id}/`, { tags: [{ name, description, updated_at: t.updated_at }] });
  else await api('POST', '/tags/', { tags: [{ name, slug, description }] });
}
