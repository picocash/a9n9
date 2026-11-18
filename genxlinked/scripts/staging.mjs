#!/usr/bin/env node
// Preview the theme + drafts on the STAGING Ghost (VM 105, 127.0.0.1:2369, reached via `ssh -fN -L 2369:127.0.0.1:2369 genxlinked`).
// Staging only: posts are PUBLISHED there so the homepage has content. Never point this at genxlinked.com.
// Usage: STAGING_PASS=... node staging.mjs <theme.zip> drafts/*.md
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const BASE = 'http://127.0.0.1:2369', A = `${BASE}/ghost/api/admin`, ORIGIN = BASE;
if (!/127\.0\.0\.1:2369/.test(BASE)) throw new Error('staging only');
const pass = process.env.STAGING_PASS, email = 'staging@example.com';
const [zip, ...files] = process.argv.slice(2);
let cookie = '';
async function api(method, p, body, form) {
  const headers = { Origin: ORIGIN, 'Accept-Version': 'v6.0', ...(cookie ? { Cookie: cookie } : {}) };
  if (body && !form) headers['Content-Type'] = 'application/json';
  const r = await fetch(A + p, { method, headers, body: form || (body && JSON.stringify(body)) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 200) }; }
  if (r.status >= 400) console.error(method, p, r.status, JSON.stringify(j).slice(0, 300));
  return j;
}
const st = await api('GET', '/authentication/setup/');
if (!st.setup?.[0]?.status) await api('POST', '/authentication/setup/', { setup: [{ name: 'Arun', email, password: pass, blogTitle: 'GenX Linked' }] });
await api('POST', '/session/', { username: email, password: pass });

const PILLARS = [
  ['connection', 'Real connection', 'Friendship, letters and the people we grew up alongside, in eight countries.'],
  ['sandwich', 'Sandwich generation', 'Between our parents and our kids, from Manila to Manchester.'],
  ['body', 'Body at 50+', 'Sleep, health and intimacy in midlife, by the numbers.'],
  ['bucket-list', 'Bucket list', 'The places we promised ourselves.'],
  ['in-charge', 'Gen X in charge', 'The generation now running things.'],
];
const s = await api('GET', '/settings/');
await api('PUT', '/settings/', { settings: [
  { key: 'title', value: 'GenX Linked' },
  { key: 'description', value: 'Same year, different country. Gen X from Manila to Manchester.' },
  { key: 'accent_color', value: '#C1622D' },
  { key: 'navigation', value: JSON.stringify([...PILLARS.map(([slug, name]) => ({ label: name, url: `/tag/${slug}/` })), { label: 'About', url: '/about/' }]) },
] });

if (zip) {
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(zip)], { type: 'application/zip' }), 'genxlinked.zip');
  const up = await api('POST', '/themes/upload/', null, fd);
  console.log('theme', up.themes?.[0]?.name, up.themes?.[0]?.gscan_errors?.length ?? '');
  await api('PUT', '/themes/genxlinked/activate/');
}

const FEATURED = ['1984-dublin-singapore', 'better-friendships'];
const CALLOUT = ['who-do-you-side-with', 'first-concert', 'gen-x-bucket-list'];
if (files.length) {
  const payload = JSON.parse(execFileSync('node', [new URL('./ghost-payload.mjs', import.meta.url).pathname, ...files]).toString());
  for (const p of payload.posts) {
    const post = { ...p, status: 'published', featured: FEATURED.includes(p.slug), tags: [...p.tags, ...(CALLOUT.includes(p.slug) ? [{ name: '#callout' }] : [])] };
    const cur = await api('GET', `/posts/slug/${p.slug}/`);
    const e = cur.posts?.[0];
    const r = e ? await api('PUT', `/posts/${e.id}/?source=html`, { posts: [{ ...post, updated_at: e.updated_at }] }) : await api('POST', '/posts/?source=html', { posts: [post] });
    console.log('post', p.slug, r.posts?.[0]?.status);
  }
}
const tags = await api('GET', '/tags/?limit=all');
for (const [slug, name, description] of PILLARS) {
  const t = tags.tags?.find((x) => x.slug === slug);
  if (t) await api('PUT', `/tags/${t.id}/`, { tags: [{ name, description }] });
}
console.log('done');
