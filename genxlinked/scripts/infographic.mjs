#!/usr/bin/env node
// One shareable infographic per article (1080x1350 PNG) built only from the article's own ::: stats / stat / chart blocks.
// Usage: node infographic.mjs drafts/04-better-friendships.md [...]   -> infographics/<slug>.png
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../../node_modules/playwright-core/index.mjs';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FONTS = `${ROOT}/theme/genxlinked/assets/fonts/gxl`;
const font = (f) => `data:font/woff2;base64,${fs.readFileSync(`${FONTS}/${f}`).toString('base64')}`;
const PILLARS = { connection: 'Real connection', sandwich: 'Sandwich generation', body: 'Body at 50+', 'bucket-list': 'Bucket list', 'in-charge': 'Gen X in charge', 'analog-life': 'Analog life', 'work-money': 'Work & money' };
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const split = (l) => l.split('|').map((x) => x.trim());
const unq = (s) => s.trim().replace(/^["']|["']$/g, '');

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = {}; for (const line of m[1].split('\n')) { const kv = line.match(/^(\w+):\s*(.+)$/); if (kv) fm[kv[1]] = unq(kv[2]); }
  const blocks = [...m[2].matchAll(/^:::[ \t]*(\w+)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm)].map((b) => ({ kind: b[1], lines: b[2].split('\n').map((l) => l.trim()).filter(Boolean) }));
  const stats = blocks.filter((b) => b.kind === 'stats').flatMap((b) => b.lines.map(split));
  const pull = blocks.find((b) => b.kind === 'stat'); const stat = pull ? split(pull.lines.join(' ')) : null;
  const cb = blocks.find((b) => b.kind === 'chart'); let chart = null;
  if (cb) { const o = {}, rows = []; for (const l of cb.lines) { const kv = l.match(/^(\w+):\s*(.*)$/); if (kv && !l.includes('|')) o[kv[1]] = kv[2]; else { const r = split(l); if (r.length >= 2 && !isNaN(parseFloat(r[1].replace(/,/g, '')))) rows.push({ label: r[0], v: parseFloat(r[1].replace(/,/g, '')), shown: r[1] }); } } chart = { ...o, rows }; }
  return { slug: path.basename(file, '.md').replace(/^\d+-/, ''), title: fm.title, pillar: PILLARS[fm.pillar] || fm.pillar || '', stats, stat, chart };
}

function html(a, withPull = true) {
  const tlen = a.title.length, tsize = tlen < 45 ? 92 : tlen < 70 ? 76 : tlen < 95 ? 64 : 54;
  const chart = a.chart && a.chart.rows.length ? a.chart : null;
  const stats = a.stats.slice(0, chart ? 3 : 6), big = !chart;
  const rows = chart ? chart.rows.slice(0, 8) : [];
  const max = Math.max(...rows.map((r) => r.v), 1), unit = chart?.unit || '';
  const rowH = rows.length > 6 ? 40 : rows.length > 4 ? 48 : 56;
  const bars = rows.map((r) => `<div class="row${chart.highlight && r.label === chart.highlight ? ' hi' : ''}"><span class="lab">${esc(r.label)}</span><span class="track"><span class="bar" style="width:${Math.max(1.5, (r.v / max) * 100).toFixed(1)}%"></span></span><span class="val">${esc(r.shown)}${esc(unit)}</span></div>`).join('');
  const showPull = withPull && !!a.stat;
  const src = [chart?.source, ...stats.map((s) => s[2])].filter(Boolean);
  const srcLine = [...new Set(src)].join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:BSD;src:url('${font('BigShouldersDisplay-800-normal.woff2')}');font-weight:100 900}
@font-face{font-family:SS4;src:url('${font('SourceSerif4-400-normal.woff2')}');font-weight:200 900}
@font-face{font-family:CP;src:url('${font('CourierPrime-700-normal.woff2')}');font-weight:700}
@font-face{font-family:CP;src:url('${font('CourierPrime-400-normal.woff2')}');font-weight:400}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1350px;background:#EFE3C8;color:#2B2622;font-family:SS4,Georgia,serif;position:relative;overflow:hidden}
body:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(43,38,34,.09) 1.6px,transparent 1.7px);background-size:11px 11px;pointer-events:none}
.frame{position:absolute;inset:28px;border:4px solid #2B2622;display:flex;flex-direction:column;background:transparent}
.top{display:flex;justify-content:space-between;align-items:center;background:#D9A441;border-bottom:4px solid #2B2622;padding:14px 26px}
.logo{font-family:BSD;font-weight:800;font-size:44px;letter-spacing:.01em;text-transform:uppercase}
.pill{font-family:CP;font-weight:700;font-size:21px;text-transform:uppercase;letter-spacing:.08em;background:#2B2622;color:#EFE3C8;padding:7px 14px}
.body{padding:30px 40px 24px;display:flex;flex-direction:column;justify-content:space-between;gap:22px;flex:1;min-height:0}
h1{font-family:BSD;font-weight:800;font-size:${tsize}px;line-height:.98;text-wrap:balance}
.stats{display:grid;grid-template-columns:repeat(${big ? Math.min(3, Math.max(stats.length, 1)) : Math.max(stats.length, 1)},1fr);border-top:4px solid #2B2622;border-bottom:4px solid #2B2622}
.big .st{padding:26px 18px 24px;border-bottom:2px solid #2B2622}
${big ? ".body{justify-content:center;gap:56px}" : ""}
.big .n{font-size:${stats.length > 3 ? 92 : 120}px}
.big .l{font-size:25px}
.st{padding:16px 16px 14px;border-right:2px solid #2B2622;display:flex;flex-direction:column;gap:8px}
.st:last-child{border-right:none}
.n{font-family:BSD;font-weight:800;font-size:${stats.length > 2 ? 76 : 96}px;line-height:.85;color:#C1622D}
.l{font-size:22px;line-height:1.25}
.panel{background:#F6EEDC;border:4px solid #2B2622;box-shadow:10px 10px 0 #2F6F73;padding:22px 26px}
.ct{font-family:BSD;font-weight:800;font-size:36px;line-height:1.05}
.cs{font-size:19px;color:#5E5248;margin-top:6px}
.bars{margin-top:16px;display:grid;gap:${rowH > 44 ? 10 : 6}px}
.row{display:grid;grid-template-columns:${rows.some((r) => r.label.length > 16) ? 260 : 220}px 1fr 130px;align-items:center;gap:14px;height:${rowH - 10}px}
.lab{font-family:CP;font-weight:700;font-size:${rows.some((r) => r.label.length > 16) ? 17 : 20}px;text-align:right;line-height:1.05}
.track{height:100%;background:repeating-linear-gradient(90deg,transparent 0 9px,rgba(43,38,34,.06) 9px 10px)}
.bar{display:block;height:100%;background:#5B7A99;border:3px solid #2B2622}
.row.hi .bar{background:#C1622D}
.val{font-family:BSD;font-weight:800;font-size:34px}
.pull{display:flex;align-items:center;gap:24px;border-top:3px solid #2B2622;border-bottom:3px solid #2B2622;padding:14px 0}
.pull .n{color:#2F6F73;font-size:120px;white-space:nowrap}
.pull .l{font-family:BSD;font-weight:700;font-size:38px;line-height:1.05}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:16px 40px 22px;border-top:3px solid #2B2622}
.src{font-family:CP;font-size:16px;line-height:1.35;color:#5E5248;max-width:720px}
.url{font-family:BSD;font-weight:800;font-size:34px;white-space:nowrap}
</style></head><body><div class="frame">
<div class="top"><span class="logo">GenX Linked</span>${a.pillar ? `<span class="pill">${esc(a.pillar)}</span>` : ''}</div>
<div class="body">
<h1>${esc(a.title)}</h1>
${stats.length ? `<div class="stats${big ? ' big' : ''}">${stats.map((s) => `<div class="st"><span class="n">${esc(s[0])}</span><span class="l">${esc(s[1])}</span></div>`).join('')}</div>` : ''}
${chart ? `<div class="panel"><p class="ct">${esc(chart.title)}</p>${chart.subtitle ? `<p class="cs">${esc(chart.subtitle)}</p>` : ''}<div class="bars">${bars}</div></div>` : ''}
${showPull ? `<div class="pull"><span class="n">${esc(a.stat[0])}</span><span class="l">${esc(a.stat[1])}</span></div>` : ''}
</div>
<div class="foot"><p class="src">${srcLine ? `Sources: ${esc(srcLine)}` : ''}<br>AI-assisted, edited by Arun</p><span class="url">genxlinked.com</span></div>
</div></body></html>`;
}

const files = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const f of files) {
  const a = parse(f);
  if (!a.stats.length && !a.chart) { console.log(JSON.stringify({ slug: a.slug, skipped: 'no data blocks' })); continue; }
  const overflows = () => p.evaluate(() => { const f = document.querySelector('.body'); return f.scrollHeight > f.clientHeight + 2; });
  await p.setContent(html(a, true), { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
  let over = await overflows();
  if (over) { await p.setContent(html(a, false), { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready); over = await overflows(); }
  const out = `${ROOT}/infographics/${a.slug}.png`;
  await p.screenshot({ path: out });
  console.log(JSON.stringify({ slug: a.slug, file: out, overflow: over }));
}
await b.close();
