#!/usr/bin/env node
// Runs INSIDE the ghost container (cron on VM 105): RSS of TEASERS for Substack's "Import posts".
// Only PUBLISHED posts carrying the internal tag #substack. Each item = comic header + first paragraphs + the infographic
// + a link back to the full interactive post on genxlinked.com (teaser strategy: Ghost stays the canonical, SEO-owning copy).
import crypto from 'node:crypto';
const [id, secret] = (process.env.GHOST_ADMIN_KEY || '').split(':');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const n = Math.floor(Date.now() / 1000), h = b64({ alg: 'HS256', typ: 'JWT', kid: id }), b = b64({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const SITE = 'https://genxlinked.com';
const r = await fetch('http://127.0.0.1:2368/ghost/api/admin/posts/?limit=20&formats=html&order=published_at%20desc&filter=status:published%2Btag:hash-substack', { headers: { Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https' } });
const { posts = [] } = await r.json();
const x = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cdata = (t) => `<![CDATA[${String(t).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
function teaser(p) {
  const html = (p.html || '').replace(/<!--kg-card-begin: html-->[\s\S]*?<!--kg-card-end: html-->/g, '');
  const ig = (html.match(/<figure class="kg-card kg-image-card[^"]*"><img src="([^"]+)"[^>]*alt="(Infographic[^"]*)"/) || []);
  const paras = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]).filter((t) => t.replace(/<[^>]+>/g, '').trim().length > 40).slice(0, 3);
  const link = `${p.url}?utm_source=substack&utm_medium=newsletter&utm_campaign=${p.slug}`;
  const interactive = /gxl-quiz/.test(p.html) ? 'take the quiz' : /gxl-poll/.test(p.html) ? 'answer the one-tap poll' : 'see the charts';
  return [
    `<p><em>Originally published at <a href="${link}">GenXLinked</a>.</em></p>`,
    p.feature_image ? `<p><img src="${p.feature_image}" alt="${x(p.feature_image_alt || p.title)}"></p>` : '',
    ...paras.map((t) => `<p>${t}</p>`),
    ig[1] ? `<p><img src="${ig[1]}" alt="${x(ig[2])}"></p>` : '',
    `<p><strong><a href="${link}">Read the full story on GenXLinked, and ${interactive} →</a></strong></p>`,
    `<p>Same year, different country: tell us yours in the comments (your birth year, country and city).</p>`,
  ].filter(Boolean).join('\n');
}
const items = posts.map((p) => `<item><title>${x(p.title)}</title><link>${x(p.url)}</link><guid isPermaLink="false">genxlinked-${p.id}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><description>${cdata(p.custom_excerpt || '')}</description><content:encoded>${cdata(teaser(p))}</content:encoded></item>`).join('\n');
process.stdout.write(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>GenXLinked (Substack teasers)</title><link>${SITE}</link><description>Teasers of GenXLinked posts queued for Substack (tag #substack).</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel></rss>
`);
