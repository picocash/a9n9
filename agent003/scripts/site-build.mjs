// site-build: host side of agent003's publishing (crontab, every 2 minutes). The agent queues pages with bin/page into
// state/publish; this script re-checks each one (same rules, judge pass for this exact text, read from judge/results which the
// agent cannot write), renders the Markdown with raw HTML stripped, wraps it in the site template (Travelpayouts script, AI and
// affiliate notice, dates), writes site/<slug>.html, and rebuilds the guide list on the home page and sitemap.xml.
// Verdicts go to state/site.jsonl (live) and state/site-rejected.jsonl (refused, with the reason).
import fs from 'node:fs';
import { marked } from 'marked';
import { checkPage } from '../bin/_rules.mjs';
import { judgeKey, PASS } from '../bin/_judge.mjs';
const ROOT = process.env.AGENT_ROOT || '/home/ubuntu/a9n9/agent003';
const Q = `${ROOT}/state/publish`, SITE = `${ROOT}/site`, ST = `${ROOT}/state`, RES = `${ROOT}/judge/results`;
const HOST = 'https://agent003.a9n9.net';
if (!fs.existsSync(Q)) process.exit(0);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const head = fs.readFileSync(`${SITE}/about.html`, 'utf8').split('<main>')[0]; // shared header: script, notice, nav
const foot = '</main>' + fs.readFileSync(`${SITE}/about.html`, 'utf8').split('</main>')[1];
marked.use({ renderer: { html: () => '', link({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens); const ext = /^https?:\/\//.test(href) && !href.startsWith(HOST);
  const aff = /marker=597751|tp\.media|tp\.st|aviasales\.|affiliate/i.test(href);
  return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ` rel="${aff ? 'sponsored nofollow ' : ''}noopener" target="_blank"` : ''}>${text}</a>`; } } });
const pagesF = `${ST}/pages.json`; const pages = fs.existsSync(pagesF) ? JSON.parse(fs.readFileSync(pagesF, 'utf8')) : {};
let changed = false;
for (const f of fs.readdirSync(Q).filter((f) => f.endsWith('.json'))) {
  const qp = `${Q}/${f}`; let q; try { q = JSON.parse(fs.readFileSync(qp, 'utf8')); } catch { fs.rmSync(qp); continue; }
  const reject = (reason) => { fs.appendFileSync(`${ST}/site-rejected.jsonl`, JSON.stringify({ at: new Date().toISOString(), slug: q.slug, title: q.title, reason }) + '\n'); fs.rmSync(qp); };
  if (`${q.slug}.json` !== f) { reject('queue file name does not match its slug'); continue; }
  const bad = checkPage(q); if (bad) { reject(bad.error); continue; }
  const sha = judgeKey(q.title, q.markdown); const rf = `${RES}/${sha}.json`;
  if (!fs.existsSync(rf)) { reject('no judge score for this exact text'); continue; }
  const jr = JSON.parse(fs.readFileSync(rf, 'utf8')); if (!(jr.pull >= PASS)) { reject(`judge score ${jr.pull} is below ${PASS}`); continue; }
  const now = new Date().toISOString().slice(0, 10); const prev = pages[q.slug];
  const body = marked.parse(q.markdown.replace(/^#\s+.*\n/, ''));
  const html = head.replace(/<title>[^<]*<\/title>/, `<title>${esc(q.title)} · agent003</title>`).replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(q.description)}">\n<link rel="canonical" href="${HOST}/${q.slug}">`)
    + `<main>\n<article>\n<h1>${esc(q.title)}</h1>\n<p class="dates">Published ${prev?.published ?? now}${prev ? ` · updated ${now}` : ''} · by agent003 (AI)</p>\n${body}\n</article>\n` + foot;
  fs.writeFileSync(`${SITE}/${q.slug}.html`, html);
  pages[q.slug] = { slug: q.slug, title: q.title, description: q.description, published: prev?.published ?? now, updated: now, pull: jr.pull };
  fs.appendFileSync(`${ST}/site.jsonl`, JSON.stringify({ at: new Date().toISOString(), op: prev ? 'update' : 'new', slug: q.slug, title: q.title, url: `${HOST}/${q.slug}`, pull: jr.pull }) + '\n');
  fs.rmSync(qp); changed = true;
}
if (changed) {
  fs.writeFileSync(pagesF, JSON.stringify(pages, null, 1));
  const list = Object.values(pages).sort((a, b) => b.published.localeCompare(a.published));
  const idx = fs.readFileSync(`${SITE}/index.html`, 'utf8');
  fs.writeFileSync(`${SITE}/index.html`, idx.replace(/<!--PAGES-->[\s\S]*<!--\/PAGES-->/, `<!--PAGES--><ul class="guides">${list.map((p) => `<li><a href="/${p.slug}">${esc(p.title)}</a><br><small>${esc(p.description)} · ${p.updated}</small></li>`).join('')}</ul><!--/PAGES-->`));
  const urls = ['', 'about', 'disclosure', 'privacy', ...list.map((p) => p.slug)];
  fs.writeFileSync(`${SITE}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${HOST}/${u}</loc>${pages[u] ? `<lastmod>${pages[u].updated}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
}
