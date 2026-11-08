// calibrate.mjs: does the judge predict real reader response? Scores every article in data/sample.json,
// then reports rank correlation with reactions, AUC between tiers (per criterion too), and pairwise accuracy
// (hit vs zero, mid vs zero, each pair judged in both orders). Writes data/calibration.json.
import fs from 'node:fs';
import { score, compare, CRITERIA, usage } from './judge.mjs';
const S = JSON.parse(fs.readFileSync('data/sample.json', 'utf8'));
const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { console.error(e.message); out[k] = null; } } })); return out; };
const scored = await pool(S, 6, (a) => score(a.body, a.title));
S.forEach((a, i) => { a.judge = scored[i]; delete a.body; });
const ok = S.filter((a) => a.judge);
const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = []; for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const spearman = (x, y) => { const a = rank(x), b = rank(y), n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return +(c / Math.sqrt(va * vb)).toFixed(3); };
const auc = (pos, neg) => { let w = 0; for (const p of pos) for (const q of neg) w += p > q ? 1 : p === q ? 0.5 : 0; return +(w / (pos.length * neg.length)).toFixed(3); };
const val = (a, k) => (k === 'pull' ? a.judge.pull : a.judge.scores?.[k] ?? 0);
const tier = (t) => ok.filter((a) => a.tier === t);
const report = { model: process.env.JUDGE_MODEL || 'grok-4.20-0309-non-reasoning', n: ok.length, tiers: { hit: tier('hit').length, mid: tier('mid').length, zero: tier('zero').length }, byKey: {} };
for (const k of ['pull', ...CRITERIA]) report.byKey[k] = { spearman_vs_reactions: spearman(ok.map((a) => val(a, k)), ok.map((a) => a.reactions)), auc_hit_vs_zero: auc(tier('hit').map((a) => val(a, k)), tier('zero').map((a) => val(a, k))), auc_mid_vs_zero: auc(tier('mid').map((a) => val(a, k)), tier('zero').map((a) => val(a, k))), auc_hit_vs_mid: auc(tier('hit').map((a) => val(a, k)), tier('mid').map((a) => val(a, k))) };
report.meanPull = Object.fromEntries(['hit', 'mid', 'zero'].map((t) => [t, +(tier(t).reduce((s, a) => s + a.judge.pull, 0) / tier(t).length).toFixed(1)]));
// pairwise, bodies re-read from the original sample file
const B = Object.fromEntries(JSON.parse(fs.readFileSync('data/sample.json', 'utf8')).map((a) => [a.id, a]));
const pairs = []; const z = JSON.parse(fs.readFileSync('data/sample.json', 'utf8')).filter((a) => a.tier === 'zero');
const H = Object.values(B).filter((a) => a.tier === 'hit'), M = Object.values(B).filter((a) => a.tier === 'mid');
H.forEach((h, i) => pairs.push(['hit', h, z[i % z.length]])); M.forEach((m, i) => pairs.push(['mid', m, z[(i + 7) % z.length]]));
const res = await pool(pairs, 6, ([kind, better, worse]) => compare(better, worse).then((r) => ({ kind, ...r })));
for (const kind of ['hit', 'mid']) { const r = res.filter((x) => x && x.kind === kind); const votes = r.reduce((s, x) => s + x.aVotes, 0); report[`pairwise_${kind}_vs_zero`] = { pairs: r.length, voteAccuracy: +(votes / (2 * r.length)).toFixed(3), bothOrdersAgreeRight: r.filter((x) => x.aVotes === 2).length, bothOrdersAgreeWrong: r.filter((x) => x.aVotes === 0).length, split: r.filter((x) => x.aVotes === 1).length }; }
report.tokens = usage;
fs.writeFileSync('data/calibration.json', JSON.stringify({ report, articles: S }, null, 1));
console.log(JSON.stringify(report, null, 1));
