#!/usr/bin/env node
// Turn drafts/*.md (front matter + Markdown) into a Ghost Admin API payload on stdout.
// Usage: node ghost-payload.mjs drafts/01-x.md [more.md ...] > payload.json
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';


// ---- GenX Linked blocks: ::: stats | ::: stat | ::: chart | ::: poll ... ::: (each becomes a Ghost HTML card) ----
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const card = (html) => `\n\n<!--kg-card-begin: html-->\n${html}\n<!--kg-card-end: html-->\n\n`;
const split = (l) => l.split('|').map((x) => x.trim());
function kv(lines) { const o = {}, rest = []; for (const l of lines) { const m = l.match(/^(\w+):\s*(.*)$/); if (m && !l.includes('|')) o[m[1]] = m[2]; else rest.push(l); } return [o, rest]; }
function stats(lines) {
  const items = lines.map(split).map(([n, label, src]) => `<div class="gxl-stat"><span class="gxl-stat-n">${esc(n)}</span><span class="gxl-stat-l">${esc(label || '')}</span>${src ? `<span class="gxl-stat-s">${esc(src)}</span>` : ''}</div>`);
  return card(`<div class="gxl-stats">${items.join('')}</div>`);
}
function stat(lines) { const [n, label, src] = split(lines.join(' ')); return card(`<div class="gxl-pullstat"><span class="gxl-stat-n">${esc(n)}</span><span class="gxl-stat-l">${esc(label || '')}</span>${src ? `<span class="gxl-stat-s">${esc(src)}</span>` : ''}</div>`); }
function chart(lines) {
  const [o, rows] = kv(lines);
  const data = rows.map(split).filter((r) => r.length >= 2 && r[1] !== '' && !isNaN(parseFloat(r[1].replace(/,/g, '')))).map(([label, v, note]) => ({ label, v: parseFloat(v.replace(/,/g, '')), shown: v, note }));
  if (!data.length) throw new Error('chart without rows');
  const unit = o.unit || '', max = Math.max(...data.map((d) => d.v), o.max ? parseFloat(o.max) : 0) || 1;
  const W = 640, L = 150, R = 70, rowH = 34, top = 8, H = top + data.length * rowH + 4, bw = W - L - R;
  const bars = data.map((d, i) => { const y = top + i * rowH, w = Math.max(2, (d.v / max) * bw), hi = o.highlight && d.label === o.highlight;
    return `<g class="gxl-bar${hi ? ' is-hi' : ''}"><text class="gxl-bar-label" x="${L - 10}" y="${y + 21}" text-anchor="end">${esc(d.label)}</text><rect x="${L}" y="${y + 6}" width="${w.toFixed(1)}" height="22" rx="2"/><text class="gxl-bar-value" x="${(L + w + 8).toFixed(1)}" y="${y + 22}">${esc(d.shown)}${esc(unit)}</text></g>`; }).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || 'Chart')}">${bars}</svg>`;
  const table = `<table class="gxl-sr"><caption>${esc(o.title || '')}</caption>${data.map((d) => `<tr><th>${esc(d.label)}</th><td>${esc(d.shown)}${esc(unit)}</td></tr>`).join('')}</table>`;
  return card(`<figure class="gxl-chart"><figcaption class="gxl-chart-title">${esc(o.title || '')}</figcaption>${o.subtitle ? `<p class="gxl-chart-sub">${esc(o.subtitle)}</p>` : ''}${svg}${table}${o.source ? `<p class="gxl-chart-src">Source: ${esc(o.source)}</p>` : ''}</figure>`);
}
function poll(lines) {
  const [o, rest] = kv(lines);
  const opts = rest.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
  if (!/^[a-z0-9-]{3,64}$/.test(o.id || '') || opts.length < 2 || opts.length > 6) throw new Error(`poll needs id (a-z0-9-) and 2-6 options: ${o.id}`);
  return card(`<div class="gxl-poll" data-poll="${esc(o.id)}"><p class="gxl-poll-kicker">Quick poll</p><p class="gxl-poll-q">${esc(o.question || '')}</p><div class="gxl-poll-opts">${opts.map((t, i) => `<button type="button" class="gxl-poll-opt" data-i="${i}"><span class="gxl-poll-t">${esc(t)}</span><span class="gxl-poll-bar"></span><span class="gxl-poll-pct"></span></button>`).join('')}</div><p class="gxl-poll-note">One tap. Anonymous. Results show after you vote.</p></div>`);
}

function quiz(lines) {
  const qs = [], results = []; let o = {}, cur = null;
  for (const l of lines) {
    let m;
    if ((m = l.match(/^q:\s*(.+)$/))) { cur = { q: m[1], a: [] }; qs.push(cur); }
    else if (l.startsWith('- ') && cur) { const [t, pts] = split(l.slice(2)); cur.a.push({ t, p: Number(pts) || 0 }); }
    else if ((m = l.match(/^result:\s*(\d+)\s*-\s*(\d+)\s*\|\s*([^|]+)\|\s*(.+)$/))) results.push({ lo: +m[1], hi: +m[2], name: m[3].trim(), text: m[4].trim() });
    else if ((m = l.match(/^(\w+):\s*(.*)$/))) o[m[1]] = m[2];
  }
  if (!/^[a-z0-9-]{3,64}$/.test(o.id || '') || qs.length < 3 || results.length < 2 || results.length > 6) throw new Error(`quiz needs id, 3+ q: and 2-6 result: lines (${o.id})`);
  const qh = qs.map((q, qi) => `<fieldset class="gxl-quiz-q"><legend><span class="gxl-quiz-num">${qi + 1}/${qs.length}</span> ${esc(q.q)}</legend>${q.a.map((a) => `<button type="button" class="gxl-quiz-a" data-p="${a.p}">${esc(a.t)}</button>`).join('')}</fieldset>`).join('');
  const rh = results.map((r, i) => `<div class="gxl-quiz-r" data-lo="${r.lo}" data-hi="${r.hi}" data-i="${i}" hidden><p class="gxl-quiz-kicker">You are</p><p class="gxl-quiz-name">${esc(r.name)}</p><p class="gxl-quiz-text">${esc(r.text)}</p></div>`).join('');
  const names = results.map((r) => esc(r.name)).join('|');
  return card(`<div class="gxl-quiz" data-quiz="${esc(o.id)}" data-names="${names}"><p class="gxl-poll-kicker">Quiz</p><p class="gxl-quiz-title">${esc(o.title || '')}</p>${qh}<div class="gxl-quiz-out">${rh}<div class="gxl-quiz-dist" hidden></div><button type="button" class="gxl-quiz-reset" hidden>Take it again</button></div></div>`);
}
const BLOCKS = { stats, stat, chart, poll, quiz };
function blocks(md) {
  return md.replace(/^:::[ \t]*(\w+)[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (m, kind, body) => {
    const f = BLOCKS[kind]; if (!f) throw new Error(`unknown block ::: ${kind}`);
    return f(body.split('\n').map((l) => l.trim()).filter(Boolean));
  });
}

const unq = (s) => s.trim().replace(/^["']|["']$/g, '');
function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const fm = {}; let key = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) { key = kv[1]; const v = kv[2].trim();
      fm[key] = v === '' ? [] : v.startsWith('[') ? v.slice(1, -1).split(',').map(unq).filter(Boolean) : unq(v); continue; }
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && key) { if (!Array.isArray(fm[key])) fm[key] = []; fm[key].push(unq(li[1])); }
  }
  if (!fm.title) throw new Error(`${file}: no title`);
  let body = m[2].trim();
  const ai = '*AI-assisted, edited by Arun.*';
  const hasAi = body.endsWith(ai); if (hasAi) body = body.slice(0, -ai.length).trim();
  const src = (fm.sources || []).map((s) => { const [name, url] = s.split(/\s+[—–-]\s+(?=https?:)/); return url ? `- [${name}](${url})` : `- ${s}`; });
  const md = `${body}\n\n${src.length ? `## Sources\n\n${src.join('\n')}\n\n` : ''}${ai}\n`;
  const slug = path.basename(file, '.md').replace(/^\d+-/, '');
  const tags = [...new Set([fm.pillar, ...(fm.tags || [])].filter(Boolean))].map((name) => ({ name }));
    let html = marked.parse(blocks(md));
  if (IG[slug]) {
    const fig = `<figure class="kg-card kg-image-card kg-width-wide kg-card-hascaption"><img src="${IG[slug]}" class="kg-image" alt="Infographic: ${esc(fm.title)}" loading="lazy"><figcaption>The numbers at a glance. Save it or share it.</figcaption></figure>`;
    const end = '<!--kg-card-end: html-->';
    const i = html.indexOf(end);
    html = i >= 0 && html.slice(0, i).includes('gxl-stats') ? html.slice(0, i + end.length) + '\n' + fig + html.slice(i + end.length) : fig + html;
  }
  return { title: fm.title, slug, html, custom_excerpt: (fm.excerpt || '').slice(0, 300) || undefined, tags, status: 'draft' };
}
let IG = {}; try { IG = JSON.parse(fs.readFileSync(new URL('../infographics/urls.json', import.meta.url), 'utf8')); } catch {}
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: ghost-payload.mjs file.md ...'); process.exit(2); }
process.stdout.write(JSON.stringify({ posts: files.map(parse) }));
