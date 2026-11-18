#!/usr/bin/env node
// Runs INSIDE the ghost container on VM 105: reads {posts:[...]} on stdin and creates them as DRAFTS.
// Never publishes. An existing slug that is still a draft is updated; a published or scheduled one is left alone.
// Env: GHOST_ADMIN_KEY=id:secret (from ~/genxlinked/secrets/ghost-admin.env). Use scripts/push-drafts.sh.
import crypto from 'node:crypto';
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
if (!id || !secret) { console.error('GHOST_ADMIN_KEY missing'); process.exit(2); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT', kid: id }), body = b64({ iat: now, exp: now + 300, aud: '/admin/' });
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
const base = 'http://127.0.0.1:2368/ghost/api/admin';
async function api(method, p, body) {
  const r = await fetch(base + p, { method, headers: { Authorization: `Ghost ${jwt()}`, 'Content-Type': 'application/json', 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https' }, body: body && JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 300) }; }
  return { status: r.status, j };
}
let input = ''; for await (const c of process.stdin) input += c;
const { posts } = JSON.parse(input);
for (const p of posts) {
  const post = { ...p, status: 'draft' };
  const cur = await api('GET', `/posts/slug/${encodeURIComponent(p.slug)}/?formats=html`);
  let res;
  if (cur.status === 200) {
    const e = cur.j.posts[0];
    if (e.status !== 'draft' && !(process.env.ALLOW_PUBLISHED === '1' && e.status === 'published')) { console.log(JSON.stringify({ slug: p.slug, skipped: `already ${e.status}` })); continue; }
    // ALLOW_PUBLISHED=1: refresh the body of a live post; keep its status, date, featured flag and image
    const upd = e.status === 'published' ? (({ status, ...rest }) => rest)(post) : post;
    res = await api('PUT', `/posts/${e.id}/?source=html`, { posts: [{ ...upd, updated_at: e.updated_at }] });
  } else res = await api('POST', '/posts/?source=html', { posts: [post] });
  const out = res.j.posts?.[0];
  console.log(JSON.stringify(out ? { slug: out.slug, status: out.status, id: out.id, action: cur.status === 200 ? 'updated' : 'created' } : { slug: p.slug, error: res.status, detail: JSON.stringify(res.j).slice(0, 300) }));
}
