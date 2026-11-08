// sample.mjs: picks the calibration set from data/articles.json and fetches each body.
// Three tiers, matched on reading time (4-15 min, no organisation accounts): hit (>=30 reactions), mid (3-10), zero (0).
// Output: data/sample.json (with body_markdown). Seeded so reruns pick the same articles.
import fs from 'node:fs';
const N = Number(process.argv[2] || 30);
const all = JSON.parse(fs.readFileSync('data/articles.json', 'utf8')).filter((a) => a.minutes >= 4 && a.minutes <= 15 && !a.org);
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr, n) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } const out = [], authors = new Set(); for (const x of a) { if (authors.has(x.author)) continue; authors.add(x.author); out.push(x); if (out.length === n) break; } return out; };
const tiers = { hit: all.filter((a) => a.reactions >= 30), mid: all.filter((a) => a.reactions >= 3 && a.reactions <= 10), zero: all.filter((a) => a.reactions === 0) };
for (const [k, v] of Object.entries(tiers)) console.log(k, 'pool', v.length);
const sample = [];
for (const [tier, pool] of Object.entries(tiers)) for (const a of pick(pool, N)) {
  const r = await fetch(`https://dev.to/api/articles/${a.id}`, { headers: { 'User-Agent': 'a9n9-judge-calibration/0.1' } });
  if (r.status === 429) { await new Promise((s) => setTimeout(s, 6000)); const r2 = await fetch(`https://dev.to/api/articles/${a.id}`, { headers: { "User-Agent": "a9n9-judge-calibration/0.1" } }); if (r2.ok) { const d = await r2.json(); sample.push({ ...a, tier, body: d.body_markdown, tags: d.tags }); } continue; }
  if (!r.ok) { console.log('skip', a.id, r.status); continue; }
  const d = await r.json(); sample.push({ ...a, tier, body: d.body_markdown, tags: d.tags });
  await new Promise((s) => setTimeout(s, 1200));
}
fs.writeFileSync('data/sample.json', JSON.stringify(sample, null, 1));
console.log('sample', sample.length);
