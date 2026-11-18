#!/usr/bin/env node
// Turn drafts/*.md (front matter + Markdown) into a Ghost Admin API payload on stdout.
// Usage: node ghost-payload.mjs drafts/01-x.md [more.md ...] > payload.json
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

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
  return { title: fm.title, slug, html: marked.parse(md), custom_excerpt: (fm.excerpt || '').slice(0, 300) || undefined, tags, status: 'draft' };
}
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: ghost-payload.mjs file.md ...'); process.exit(2); }
process.stdout.write(JSON.stringify({ posts: files.map(parse) }));
