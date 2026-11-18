#!/usr/bin/env node
// Runs INSIDE the prod ghost container: publish drafts in the given order (first = oldest), spaced 1 minute apart ending now,
// set featured on the listed slugs, and unpublish Ghost's default "coming-soon". No newsletter email is sent (no ?newsletter=).
// Usage: node ghost-publish.mjs '<json {"order":[slugs], "featured":[slugs]}>'   Env: GHOST_ADMIN_KEY
import crypto from 'node:crypto';
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const n = Math.floor(Date.now() / 1000), h = b64({ alg: 'HS256', typ: 'JWT', kid: id }), b = b64({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const A = 'http://127.0.0.1:2368/ghost/api/admin';
const api = async (m, p, body) => { const r = await fetch(A + p, { method: m, headers: { Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }); return [r.status, await r.json()]; };
const { order, featured = [] } = JSON.parse(process.argv[2]);
const now = Date.now();
for (const [i, slug] of order.entries()) {
  const [s, j] = await api('GET', `/posts/slug/${slug}/`);
  const p = j.posts?.[0]; if (!p) { console.log(slug, 'NOT FOUND', s); continue; }
  const at = new Date(now - (order.length - 1 - i) * 60e3).toISOString();
  const [s2, j2] = await api('PUT', `/posts/${p.id}/`, { posts: [{ status: 'published', published_at: p.status === 'published' ? p.published_at : at, featured: featured.includes(slug), updated_at: p.updated_at }] });
  console.log(slug, s2, j2.posts?.[0]?.status, j2.posts?.[0]?.url || JSON.stringify(j2).slice(0, 200));
}
const [, cs] = await api('GET', '/posts/slug/coming-soon/');
if (cs.posts?.[0]?.status === 'published') { const p = cs.posts[0]; const [s] = await api('PUT', `/posts/${p.id}/`, { posts: [{ status: 'draft', updated_at: p.updated_at }] }); console.log('coming-soon unpublished', s); }
