// kpi-collect: host side of agent002's KPI receipts (crontab, hourly). Reads dev.to and GitHub with agent002's own keys and
// records what it read as typed facts. Every API response is saved under kpi/raw/<sha256>.json (the receipt); every fact names
// its receipt, and each line of kpi/facts.jsonl carries the hash of the line before it, so an edit anywhere breaks the chain.
// A missed or failed collection is written as a gap, never filled in. The container sees kpi/ read-only at /agent/kpi.
import fs from 'node:fs';
import crypto from 'node:crypto';
const ROOT = process.env.AGENT_ROOT || '/home/ubuntu/a9n9/agent002';
const SECRETS = process.env.SECRETS || '/home/ubuntu/a9n9/secrets';
const K = `${ROOT}/kpi`, FACTS = `${K}/facts.jsonl`, RAW = `${K}/raw`, ORG = 'a9n9-agent002';
fs.mkdirSync(RAW, { recursive: true });
const env = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let prev = 'genesis';
if (fs.existsSync(FACTS)) { const t = fs.readFileSync(FACTS, 'utf8').trimEnd(); if (t) prev = sha(t.slice(t.lastIndexOf('\n') + 1)); }
const lines = [];
const add = (o) => { const line = JSON.stringify({ ...o, prev }); lines.push(line); prev = sha(line); };
const at = new Date().toISOString(); const run = sha(at).slice(0, 12);
async function fetchReceipt(source, url, headers) {
  const r = await fetch(url, { headers }); const body = await r.text();
  if (!r.ok) throw new Error(`${source} ${r.status}`);
  const h = sha(body); if (!fs.existsSync(`${RAW}/${h}.json`)) fs.writeFileSync(`${RAW}/${h}.json`, body);
  return { receipt: h, json: JSON.parse(body) };
}
const fact = (receipt, metric, subject, value, kind) => add({ t: 'fact', at, run, metric, subject: String(subject), value, kind, receipt });
// dev.to: cumulative per article
try {
  const { receipt, json } = await fetchReceipt('dev.to', 'https://dev.to/api/articles/me/all?per_page=1000', { 'api-key': env(`${SECRETS}/agent002-devto.env`).DEVTO_API_KEY, accept: 'application/vnd.forem.api-v1+json' });
  add({ t: 'receipt', at, run, source: 'dev.to', url: 'GET /api/articles/me/all', receipt });
  for (const a of json.filter((x) => x.published)) {
    fact(receipt, 'devto.views', a.id, a.page_views_count, 'cumulative');
    fact(receipt, 'devto.reactions', a.id, a.public_reactions_count, 'cumulative');
    fact(receipt, 'devto.comments', a.id, a.comments_count, 'cumulative');
  }
} catch (e) { add({ t: 'gap', at, run, source: 'dev.to', reason: e.message }); }
// GitHub: per repo, stars (cumulative), 14-day traffic windows and referrers
try {
  const T = env(`${SECRETS}/agent002-github.env`).GITHUB_TOKEN;
  const H = { authorization: `Bearer ${T}`, accept: 'application/vnd.github+json', 'user-agent': 'a9n9-kpi' };
  const repos = await fetchReceipt('github', `https://api.github.com/orgs/${ORG}/repos?per_page=100`, H);
  add({ t: 'receipt', at, run, source: 'github', url: `GET /orgs/${ORG}/repos`, receipt: repos.receipt });
  for (const r of repos.json) {
    fact(repos.receipt, 'github.stars', r.name, r.stargazers_count, 'cumulative');
    fact(repos.receipt, 'github.forks', r.name, r.forks_count, 'cumulative');
    for (const [path, m] of [['traffic/views', 'views'], ['traffic/clones', 'clones']]) {
      try { const x = await fetchReceipt('github', `https://api.github.com/repos/${ORG}/${r.name}/${path}`, H);
        add({ t: 'receipt', at, run, source: 'github', url: `GET /repos/${ORG}/${r.name}/${path}`, receipt: x.receipt });
        fact(x.receipt, `github.${m}14d`, r.name, x.json.count, 'window14d'); fact(x.receipt, `github.${m === 'views' ? 'uniques' : 'cloners'}14d`, r.name, x.json.uniques, 'window14d');
        for (const d of x.json[m] ?? []) fact(x.receipt, `github.${m}.daily`, `${r.name}@${d.timestamp.slice(0, 10)}`, d.count, 'daily');
      } catch (e) { add({ t: 'gap', at, run, source: `github ${r.name} ${path}`, reason: e.message }); }
    }
    try { const x = await fetchReceipt('github', `https://api.github.com/repos/${ORG}/${r.name}/traffic/popular/referrers`, H);
      add({ t: 'receipt', at, run, source: 'github', url: `GET /repos/${ORG}/${r.name}/traffic/popular/referrers`, receipt: x.receipt });
      for (const ref of x.json) fact(x.receipt, 'github.referrer14d', `${r.name}<-${ref.referrer}`, ref.count, 'window14d');
    } catch (e) { add({ t: 'gap', at, run, source: `github ${r.name} referrers`, reason: e.message }); }
  }
} catch (e) { add({ t: 'gap', at, run, source: 'github', reason: e.message }); }
add({ t: 'run', at, run, facts: lines.length });
fs.appendFileSync(FACTS, lines.join('\n') + '\n');
