#!/usr/bin/env node
// Runs INSIDE the ghost container: upload an image and set it as a DRAFT post's feature image.
// Usage: node ghost-image.mjs <slug> <image file in container> "<alt text>"   Env: GHOST_ADMIN_KEY
import crypto from 'node:crypto';
import fs from 'node:fs';
const [slug, file, alt = ''] = process.argv.slice(2);
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
if (!slug || !file || !id) { console.error('usage: ghost-image.mjs <slug> <file> "<alt>" (GHOST_ADMIN_KEY set)'); process.exit(2); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const now = Math.floor(Date.now() / 1000), h = b64({ alg: 'HS256', typ: 'JWT', kid: id }), b = b64({ iat: now, exp: now + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const base = 'http://127.0.0.1:2368/ghost/api/admin', H = () => ({ Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https' });
const cur = await (await fetch(`${base}/posts/slug/${slug}/`, { headers: H() })).json();
const post = cur.posts?.[0];
if (!post) { console.log(JSON.stringify({ slug, error: 'no such post' })); process.exit(1); }
if (post.status !== 'draft') { console.log(JSON.stringify({ slug, skipped: `already ${post.status}` })); process.exit(0); }
const fd = new FormData();
fd.append('file', new Blob([fs.readFileSync(file)], { type: 'image/jpeg' }), `${slug}.jpg`);
fd.append('purpose', 'image');
const up = await (await fetch(`${base}/images/upload/`, { method: 'POST', headers: H(), body: fd })).json();
const url = up.images?.[0]?.url;
if (!url) { console.log(JSON.stringify({ slug, error: 'upload failed', detail: JSON.stringify(up).slice(0, 300) })); process.exit(1); }
const res = await (await fetch(`${base}/posts/${post.id}/`, { method: 'PUT', headers: { ...H(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ posts: [{ feature_image: url, feature_image_alt: alt, feature_image_caption: 'AI illustration (Grok).', updated_at: post.updated_at }] }) })).json();
console.log(JSON.stringify(res.posts ? { slug, status: res.posts[0].status, feature_image: res.posts[0].feature_image } : { slug, error: JSON.stringify(res).slice(0, 300) }));
