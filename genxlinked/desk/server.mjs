#!/usr/bin/env node
// GenXLinked publishing desk: the ONLY way agent003 touches Ghost. Bearer DESK_TOKEN. Runs next to ghost on VM 105.
//   POST /desk/draft    {markdown}            validate house rules, render infographic, create/update the Ghost DRAFT
//   GET  /desk/draft/<slug>                    current markdown
//   POST /desk/image    {slug, beat, object}   comic header panel in the house style (cap 5/day), attached to the draft
//   POST /desk/publish  {slug, substack?}      publish a draft now (cap 2/day); substack:true adds #substack
//   GET  /desk/status                          recent posts, drafts, members, poll totals, today's usage
//   POST /desk/letter   {markdown}             create/update the weekly newsletter (email-only draft, tag #newsletter)
//   POST /desk/letter/schedule {slug}          schedule it to every member for the next Friday 12:00 America/New_York (once a week)
// Never: settings, members, other staff, deleting posts, unpublishing. Everything is logged to /data/desk-log.jsonl.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ROOT = '/app/genxlinked', D = `${ROOT}/drafts`, IG = `${ROOT}/infographics`, LOG = '/data/desk-log.jsonl';
const TOKEN = process.env.DESK_TOKEN || '', [GK_ID, GK_SECRET] = (process.env.GHOST_ADMIN_KEY || ':').split(':'), XAI = process.env.XAI_API_KEY || '';
const GHOST = 'http://ghost:2368/ghost/api/admin', CAP_PUB = 2, CAP_IMG = 5;
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => { const n = Math.floor(Date.now() / 1000), h = b64u({ alg: 'HS256', typ: 'JWT', kid: GK_ID }), b = b64u({ iat: n, exp: n + 300, aud: '/admin/' }); return `${h}.${b}.${crypto.createHmac('sha256', Buffer.from(GK_SECRET, 'hex')).update(`${h}.${b}`).digest('base64url')}`; };
const H = () => ({ Authorization: `Ghost ${jwt()}`, 'Accept-Version': 'v6.0', 'X-Forwarded-Proto': 'https' });
const admin = async (m, p, body) => { const r = await fetch(GHOST + p, { method: m, headers: { ...H(), 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(30000) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 200) }; } return [r.status, j]; };
const log = (o) => fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...o }) + '\n');
const today = () => new Date().toISOString().slice(0, 10);
const usage = (kind) => { try { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.kind === kind && e.ok && e.t.startsWith(today())).length; } catch { return 0; } };
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

function slugOf(md) { const m = md.match(/^---\n[\s\S]*?\nslug:\s*["']?([a-z0-9-]{3,80})["']?\s*\n[\s\S]*?\n---\n/); return m?.[1]; }
function checkDraft(md) {
  const errs = [];
  if (!/^---\n[\s\S]*?\n---\n/.test(md)) errs.push('missing YAML front matter');
  for (const k of ['title', 'slug', 'pillar', 'excerpt']) if (!new RegExp(`^${k}:\\s*\\S`, 'm').test(md)) errs.push(`front matter needs ${k}:`);
  const pillar = (md.match(/^pillar:\s*["']?([a-z-]+)/m) || [])[1];
  if (pillar && !['connection', 'sandwich', 'body', 'bucket-list', 'in-charge', 'analog-life', 'work-money'].includes(pillar)) errs.push(`unknown pillar ${pillar}`);
  const sources = (md.match(/^\s+-\s+".*https?:\/\/.*"\s*$/gm) || []).length; if (sources < 3) errs.push(`only ${sources} sources with URLs in front matter (need 3+)`);
  if (!/^::: stats/m.test(md)) errs.push('needs a ::: stats strip at the top');
  if (!/^::: (poll|quiz)/m.test(md)) errs.push('needs a ::: poll or ::: quiz');
  if (!/\*AI-assisted, edited by Arun\.\*\s*$/.test(md.trim())) errs.push('last line must be *AI-assisted, edited by Arun.*');
  const words = md.split('\n---\n').slice(1).join('').replace(/^:::[\s\S]*?^:::$/gm, '').split(/\s+/).filter(Boolean).length;
  if (words < 350 || words > 1600) errs.push(`body is ${words} words (350-1600)`);
  const ex = (md.match(/^excerpt:\s*"(.*)"\s*$/m) || [])[1] || ''; if (ex.length > 200) errs.push('excerpt over 200 characters');
  return errs;
}
async function upload(file, name) {
  const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(file)], { type: name.endsWith('.png') ? 'image/png' : 'image/jpeg' }), name); fd.append('purpose', 'image');
  const r = await fetch(`${GHOST}/images/upload/`, { method: 'POST', headers: H(), body: fd }); const j = await r.json(); return j.images?.[0]?.url;
}
async function draft(md) {
  const slug = slugOf(md); if (!slug) return [400, { error: 'front matter needs slug: (a-z0-9-)' }];
  const errs = checkDraft(md); if (errs.length) return [400, { error: 'house rules', problems: errs }];
  const [, cur] = await admin('GET', `/posts/slug/${slug}/`);
  if (cur.posts?.[0] && cur.posts[0].status !== 'draft') return [409, { error: `${slug} is already ${cur.posts[0].status}; published posts are not edited by the desk. Ask Arun on the board.` }];
  const existing = fs.readdirSync(D).find((f) => f.replace(/^\d+-/, '') === `${slug}.md`);
  const n = existing ? existing.split('-')[0] : String(Math.max(0, ...fs.readdirSync(D).map((f) => parseInt(f)).filter(Number.isFinite)) + 1).padStart(2, '0');
  const file = `${D}/${existing || `${n}-${slug}.md`}`; fs.writeFileSync(file, md);
  let payload; try { payload = JSON.parse(execFileSync('node', [`${ROOT}/scripts/ghost-payload.mjs`, file], { timeout: 60000 }).toString()); } catch (e) { return [400, { error: 'blocks did not convert', detail: String(e.stderr || e.message).slice(0, 400) }]; }
  try { execFileSync('node', [`${ROOT}/scripts/infographic.mjs`, file], { timeout: 120000, env: { ...process.env, CHROME: '/usr/bin/chromium' } }); } catch (e) { return [500, { error: 'infographic failed', detail: String(e.stderr || e.message).slice(0, 300) }]; }
  const ig = `${IG}/${slug}.png`;
  if (fs.existsSync(ig)) { const url = await upload(ig, `${slug}.png`); const m = JSON.parse(fs.existsSync(`${IG}/urls.json`) ? fs.readFileSync(`${IG}/urls.json`, 'utf8') : '{}'); m[slug] = url; fs.writeFileSync(`${IG}/urls.json`, JSON.stringify(m, null, 1)); payload = JSON.parse(execFileSync('node', [`${ROOT}/scripts/ghost-payload.mjs`, file]).toString()); }
  try { execFileSync('node', [`${ROOT}/scripts/poll-ids.mjs`], { timeout: 30000 }); } catch {}
  const p = { ...payload.posts[0], status: 'draft' };
  const [st, j] = cur.posts?.[0] ? await admin('PUT', `/posts/${cur.posts[0].id}/?source=html`, { posts: [{ ...p, updated_at: cur.posts[0].updated_at }] }) : await admin('POST', '/posts/?source=html', { posts: [p] });
  const ok = st < 300; log({ kind: 'draft', ok, slug }); return ok ? [200, { ok, slug, status: 'draft', infographic: fs.existsSync(ig), next: 'desk image, then desk publish' }] : [500, { error: 'ghost refused', detail: JSON.stringify(j).slice(0, 300) }];
}
async function image(slug, beat, object) {
  if (!XAI) return [503, { error: 'image generation not configured' }];
  if (usage('image') >= CAP_IMG) return [429, { error: `image cap reached (${CAP_IMG}/day)` }];
  const [, cur] = await admin('GET', `/posts/slug/${slug}/`); const post = cur.posts?.[0]; if (!post) return [404, { error: 'no such draft' }]; if (post.status !== 'draft') return [409, { error: 'only drafts get new images' }];
  const prompt = `Single comic book panel, late-1980s American comic style, bold ink outlines, flat colours, Ben-Day halftone dots, slight colour misregistration, printed on yellowed newsprint. ${String(beat).slice(0, 400)}. The main adults look youthful, in their mid-40s, dark hair with at most a touch of grey, smooth faces, energetic and stylish; not elderly, no white hair. Includes ${String(object).slice(0, 120)}. Limited palette: mustard yellow, rust orange, deep teal, denim blue, cream paper, dark brown ink. Stylised cartoon people, not realistic, not photographic. No text, no letters, no words in speech bubbles, no logos. 16:9.`;
  const r = await fetch('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { authorization: `Bearer ${XAI}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'grok-imagine-image', prompt, n: 1, response_format: 'url' }), signal: AbortSignal.timeout(90000) });
  const j = await r.json().catch(() => ({})); const url = j.data?.[0]?.url;
  if (!url) { log({ kind: 'image', ok: false, slug }); return [502, { error: 'image generation failed', detail: JSON.stringify(j).slice(0, 200) }]; }
  const tmp = `/tmp/${slug}-${Date.now()}.jpg`; fs.writeFileSync(tmp, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const up = await upload(tmp, `${slug}.jpg`); fs.rmSync(tmp);
  const [st] = await admin('PUT', `/posts/${post.id}/`, { posts: [{ feature_image: up, feature_image_alt: `AI comic illustration: ${String(beat).slice(0, 150)}`, feature_image_caption: 'AI illustration (Grok).', updated_at: post.updated_at }] });
  log({ kind: 'image', ok: st < 300, slug }); return [st < 300 ? 200 : 500, { ok: st < 300, slug, feature_image: up }];
}
async function publish(slug, substack) {
  if (usage('publish') >= CAP_PUB) return [429, { error: `publish cap reached (${CAP_PUB}/day)` }];
  const [, cur] = await admin('GET', `/posts/slug/${slug}/?include=tags`); const p = cur.posts?.[0];
  if (!p) return [404, { error: 'no such draft' }]; if (p.status !== 'draft') return [409, { error: `already ${p.status}` }];
  if (!p.feature_image) return [400, { error: 'add a header image first (desk image)' }];
  const tags = p.tags.map((t) => ({ id: t.id })); if (substack) tags.push({ name: '#substack' });
  const [st, j] = await admin('PUT', `/posts/${p.id}/`, { posts: [{ status: 'published', published_at: new Date().toISOString(), tags, updated_at: p.updated_at }] });
  log({ kind: 'publish', ok: st < 300, slug, substack: !!substack }); return st < 300 ? [200, { ok: true, url: j.posts[0].url }] : [500, { error: 'ghost refused', detail: JSON.stringify(j).slice(0, 300) }];
}
// Weekly newsletter: email-only post, sent by Ghost to all members at Friday noon Eastern.
function nextFridayNoonET(from = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
  for (let d = 0; d < 9; d++) for (const h of [16, 17]) {
    const c = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + d, h, 0, 0));
    const parts = Object.fromEntries(fmt.formatToParts(c).map((p) => [p.type, p.value]));
    if (parts.weekday === 'Fri' && parts.hour === '12' && c.getTime() > from.getTime() + 15 * 60000) return c;
  }
  return null;
}
async function letter(md) {
  const errs = [], fm = (k) => (md.match(new RegExp(`^${k}:\\s*["']?(.+?)["']?\\s*$`, 'm')) || [])[1];
  if (!/^---\n[\s\S]*?\n---\n/.test(md)) errs.push('missing YAML front matter');
  const title = fm('title'), slug = fm('slug'), excerpt = fm('excerpt');
  if (!title) errs.push('front matter needs title: (the email subject, under 80 characters)'); else if (title.length > 80) errs.push('title over 80 characters');
  if (!slug || !/^letter-\d{4}-\d{2}-\d{2}$/.test(slug)) errs.push('slug must be letter-YYYY-MM-DD (the Friday it goes out)');
  if (!excerpt || excerpt.length > 160) errs.push('excerpt: needed, under 160 characters (the email preview line)');
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, ''), words = body.split(/\s+/).filter(Boolean).length;
  if (words < 150 || words > 900) errs.push(`body is ${words} words; the letter is 150-900`);
  if ((body.match(/https:\/\/genxlinked\.com\/[a-z0-9-]+\/?/g) || []).length < 3) errs.push('link at least 3 genxlinked.com pieces');
  if (!/AI-assisted/i.test(body.split('\n').filter(Boolean).slice(-2).join(' '))) errs.push("end with the line '*AI-assisted, edited by Arun.*'");
  if (/:::/.test(body)) errs.push('no ::: blocks in the letter (polls and quizzes live on the site; link to them)');
  if (errs.length) return [400, { error: 'fix these and send again', problems: errs }];
  const { marked } = await import('marked');
  const html = marked.parse(body);
  const [, cur] = await admin('GET', `/posts/slug/${slug}/?formats=html`); const p = cur.posts?.[0];
  if (p && p.status !== 'draft') return [409, { error: `that letter is already ${p.status}` }];
  const post = { title, slug, custom_excerpt: excerpt, email_only: true, status: 'draft', tags: [{ name: '#newsletter' }] };
  const [st, j] = p ? await admin('PUT', `/posts/${p.id}/?source=html`, { posts: [{ ...post, html, updated_at: p.updated_at }] }) : await admin('POST', '/posts/?source=html', { posts: [{ ...post, html }] });
  log({ kind: 'letter-draft', ok: st < 300, slug }); return st < 300 ? [200, { ok: true, slug, words, sendsAt: nextFridayNoonET()?.toISOString() }] : [500, { error: 'ghost refused', detail: JSON.stringify(j).slice(0, 300) }];
}
async function scheduleLetter(slug) {
  const recent = (() => { try { return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.kind === 'letter-schedule' && e.ok && Date.now() - Date.parse(e.t) < 5 * 86400000); } catch { return []; } })();
  if (recent.length) return [429, { error: `a letter was already scheduled on ${recent[0].t.slice(0, 10)} (${recent[0].slug}); one a week` }];
  const [, cur] = await admin('GET', `/posts/slug/${slug}/?include=tags`); const p = cur.posts?.[0];
  if (!p || !p.tags.some((t) => t.name === '#newsletter')) return [404, { error: 'no such letter (make it with desk letter)' }];
  if (p.status !== 'draft') return [409, { error: `already ${p.status}` }];
  const at = nextFridayNoonET(); if (!at) return [500, { error: 'could not compute Friday noon ET' }];
  const [st, j] = await admin('PUT', `/posts/${p.id}/?newsletter=default-newsletter&email_segment=all`, { posts: [{ status: 'scheduled', published_at: at.toISOString(), updated_at: p.updated_at }] });
  log({ kind: 'letter-schedule', ok: st < 300, slug, at: at.toISOString() });
  return st < 300 ? [200, { ok: true, slug, sendsAt: at.toISOString(), to: 'all members' }] : [500, { error: 'ghost refused (bulk email may not be set up yet: tell the operator)', detail: JSON.stringify(j).slice(0, 300) }];
}
async function status() {
  const [, pub] = await admin('GET', '/posts/?limit=15&order=published_at%20desc&filter=status:published&fields=title,slug,published_at,url&include=tags');
  const [, dr] = await admin('GET', '/posts/?limit=15&filter=status:draft&fields=title,slug,updated_at,feature_image');
  const [, mem] = await admin('GET', '/members/?limit=1');
  let polls = {}; try { polls = JSON.parse(fs.readFileSync('/poll-data/polls.json', 'utf8')).polls; } catch {}
  const pollTotals = Object.fromEntries(Object.entries(polls).map(([k, v]) => [k, (v.counts || []).reduce((a, b) => a + b, 0)]));
  return [200, { published: (pub.posts || []).map((p) => ({ title: p.title, slug: p.slug, date: p.published_at?.slice(0, 10), substack: p.tags?.some((t) => t.name === '#substack') })), drafts: (dr.posts || []).map((p) => ({ title: p.title, slug: p.slug, image: !!p.feature_image })), members: mem.meta?.pagination?.total ?? null, pollVotes: pollTotals, today: { published: usage('publish'), images: usage('image'), caps: { publish: CAP_PUB, image: CAP_IMG } } }];
}
http.createServer((req, res) => {
  if ((req.headers.authorization || '') !== `Bearer ${TOKEN}` || !TOKEN) return send(res, 401, { error: 'unauthorized' });
  let body = ''; req.on('data', (c) => { body += c; if (body.length > 400000) req.destroy(); });
  req.on('end', async () => {
    try {
      const j = body ? JSON.parse(body) : {}; const u = req.url.split('?')[0]; let r;
      if (req.method === 'POST' && u === '/desk/draft') r = await draft(String(j.markdown || ''));
      else if (req.method === 'GET' && u.startsWith('/desk/draft/')) { const s = u.slice(12).replace(/[^a-z0-9-]/g, ''); const f = fs.readdirSync(D).find((x) => x.replace(/^\d+-/, '') === `${s}.md`); r = f ? [200, { slug: s, markdown: fs.readFileSync(`${D}/${f}`, 'utf8') }] : [404, { error: 'not found' }]; }
      else if (req.method === 'POST' && u === '/desk/image') r = await image(String(j.slug || ''), j.beat || '', j.object || 'one analog object');
      else if (req.method === 'POST' && u === '/desk/publish') r = await publish(String(j.slug || ''), !!j.substack);
      else if (req.method === 'GET' && u === '/desk/status') r = await status();
      else if (req.method === 'POST' && u === '/desk/letter') r = await letter(String(j.markdown || ''));
      else if (req.method === 'POST' && u === '/desk/letter/schedule') r = await scheduleLetter(String(j.slug || ''));
      else r = [404, { error: 'unknown desk command' }];
      send(res, r[0], r[1]);
    } catch (e) { send(res, 500, { error: String(e.message).slice(0, 300) }); }
  });
}).listen(2380, () => console.log('desk on 2380'));
