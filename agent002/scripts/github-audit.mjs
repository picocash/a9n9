// github-audit: runs on the host every 10 minutes (crontab). agent002 can read its GitHub token, so the guards in bin/github are not
// enough on their own: this checks every repo in a9n9-agent002 and pauses agent002 (state/PAUSED + `hermes cron pause`) on a breach.
// Breaches: a repo not created through bin/github, a head commit not pushed through it, the README About section (AI authorship)
// missing, a secret in any file, or an affiliate link the rules refuse. The pause is not lifted automatically.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.AGENT002_ROOT || '/home/ubuntu/a9n9/agent002'; const ST = `${ROOT}/state`; const ORG = 'a9n9-agent002';
const { affiliateProblem } = await import(`${ROOT}/bin/_affiliate.mjs`);
const envf = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const KEYF = '/home/ubuntu/a9n9/secrets/agent002-github.env'; if (!fs.existsSync(KEYF)) process.exit(0);
const TOKEN = envf(KEYF).GITHUB_TOKEN;
const gh = async (p) => { const r = await fetch(`https://api.github.com${p}`, { headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'a9n9-github-audit' } }); return { status: r.status, ok: r.ok, j: await r.json().catch(() => ({})) }; };
const progs = JSON.parse(fs.readFileSync(`${ROOT}/affiliates.json`, 'utf8')).programs ?? {};
const log = fs.existsSync(`${ST}/github.jsonl`) ? fs.readFileSync(`${ST}/github.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const created = new Set(log.filter((x) => x.op === 'create').map((x) => x.repo));
const pushed = new Set(log.filter((x) => x.op === 'push').map((x) => x.commit));
const secretVals = fs.readdirSync(`${ROOT}/secrets`).flatMap((f) => Object.values(envf(`${ROOT}/secrets/${f}`))).filter((v) => v.length >= 12);
const SHAPES = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bgithub_pat_[A-Za-z0-9_]{40,}/, /\bnsec1[a-z0-9]{50,}/, /\bsk-[A-Za-z0-9_-]{20,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bnpm_[A-Za-z0-9]{30,}/];
const problems = [];
const repos = await gh(`/orgs/${ORG}/repos?per_page=100&type=all`);
if (!repos.ok) { console.log(JSON.stringify({ at: new Date().toISOString(), error: `GitHub ${repos.status}` })); process.exit(0); }
for (const r of repos.j) {
  const name = r.name; if (!created.has(name)) { problems.push(`${name}: repo not created through bin/github`); continue; }
  const head = await gh(`/repos/${ORG}/${name}/git/ref/heads/main`); if (!head.ok) continue; // empty repo
  const sha = head.j.object.sha; const commit = await gh(`/repos/${ORG}/${name}/git/commits/${sha}`);
  if (!pushed.has(sha) && !/^start$/.test(commit.j.message ?? '')) problems.push(`${name}: head ${sha.slice(0, 7)} was not pushed through bin/github`);
  const tree = await gh(`/repos/${ORG}/${name}/git/trees/${sha}?recursive=1`); let text = ''; let readme = null;
  for (const e of (tree.j.tree ?? []).filter((e) => e.type === 'blob' && e.size <= 512 * 1024)) {
    const b = await gh(`/repos/${ORG}/${name}/git/blobs/${e.sha}`); const t = Buffer.from(b.j.content ?? '', 'base64').toString('utf8');
    if (e.path === 'README.md') readme = t;
    for (const re of SHAPES) if (re.test(t)) problems.push(`${name}/${e.path}: secret-shaped string`);
    for (const v of secretVals) if (t.includes(v)) problems.push(`${name}/${e.path}: contains a value from agent002's secrets`);
    if (/\.(md|txt|json|js|mjs|ts|py|html|toml|ya?ml)$/i.test(e.path)) text += t + '\n';
  }
  if (readme !== null && !/an autonomous AI agent/.test(readme)) problems.push(`${name}: README About section (AI authorship) missing`);
  const a = affiliateProblem(text, progs, 0, 99); if (a?.error) problems.push(`${name}: ${a.error.split('.')[0]}`);
}
const at = new Date().toISOString(); console.log(JSON.stringify({ at, repos: repos.j.length, problems }));
if (problems.length) {
  fs.appendFileSync(`${ST}/github-audit.jsonl`, JSON.stringify({ at, problems }) + '\n');
  const pf = `${ST}/PAUSED`;
  if (!fs.existsSync(pf) || !/GitHub audit/.test(fs.readFileSync(pf, 'utf8'))) {
    fs.writeFileSync(pf, `GitHub audit found rule breaches (${problems.join('; ')}); the operator lifts this pause`);
    const jobs = JSON.parse(fs.readFileSync(`${ROOT}/hermes/cron/jobs.json`, 'utf8')); for (const j of (jobs.jobs ?? jobs)) try { execFileSync('docker', ['exec', '-u', 'hermes', '-e', 'HOME=/opt/data', 'a9n9-agent002', 'hermes', 'cron', 'pause', j.id]); } catch {}
  }
}
