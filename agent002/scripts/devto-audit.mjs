// devto-audit: runs on the host every 10 minutes (crontab). The agent can read its dev.to key, so the tool guards are not enough on
// their own: this checks every live article on agent002's account and pauses agent002 (state/PAUSED + `hermes cron pause`) on a breach.
// Breaches: an article not published through devto-post, #abotwrotethis missing, the disclosure footer missing, more than one affiliate
// link, or a link the rules refuse. This pause is not lifted automatically: the operator removes state/PAUSED and resumes the job.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.AGENT002_ROOT || '/home/ubuntu/a9n9/agent002'; const ST = `${ROOT}/state`;
const { affiliateProblem } = await import(`${ROOT}/bin/_affiliate.mjs`);
const key = fs.readFileSync('/home/ubuntu/a9n9/secrets/agent002-devto.env', 'utf8').match(/^DEVTO_API_KEY=(.*)$/m)?.[1]?.trim();
if (!key) process.exit(0);
const progs = JSON.parse(fs.readFileSync(`${ROOT}/affiliates.json`, 'utf8')).programs ?? {};
const known = new Set(fs.existsSync(`${ST}/devto.jsonl`) ? fs.readFileSync(`${ST}/devto.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []);
const res = await fetch('https://dev.to/api/articles/me/all?per_page=100', { headers: { 'api-key': key, accept: 'application/vnd.forem.api-v1+json' } });
if (!res.ok) { console.log(JSON.stringify({ at: new Date().toISOString(), error: `dev.to ${res.status}` })); process.exit(0); }
const problems = [];
for (const a of await res.json()) {
  if (!a.published) continue; const body = a.body_markdown ?? ''; const tags = Array.isArray(a.tag_list) ? a.tag_list : String(a.tag_list).split(/,\s*/);
  if (!known.has(a.id)) problems.push(`${a.id}: published outside devto-post`);
  if (!tags.includes('abotwrotethis')) problems.push(`${a.id}: #abotwrotethis tag removed`);
  if (!/written by agent002, an autonomous AI agent/.test(body)) problems.push(`${a.id}: AI disclosure footer missing`);
  const links = Object.values(progs).map((x) => x.link.replace(/^https?:\/\//, '').split('?')[0]).reduce((n, l) => n + (body.split(l).length - 1), 0);
  if (links > 1) problems.push(`${a.id}: ${links} affiliate links`);
  const r = affiliateProblem(body, progs, 0, 99); if (r?.error) problems.push(`${a.id}: ${r.error.split('.')[0]}`);
}
const at = new Date().toISOString(); console.log(JSON.stringify({ at, problems }));
if (problems.length) {
  fs.appendFileSync(`${ST}/devto-audit.jsonl`, JSON.stringify({ at, problems }) + '\n');
  const pf = `${ST}/PAUSED`;
  if (!fs.existsSync(pf) || !/dev\.to audit/.test(fs.readFileSync(pf, 'utf8'))) {
    fs.writeFileSync(pf, `dev.to audit found rule breaches on live articles (${problems.join('; ')}); the operator lifts this pause`);
    const jobs = JSON.parse(fs.readFileSync(`${ROOT}/hermes/cron/jobs.json`, 'utf8')); for (const j of (jobs.jobs ?? jobs)) try { execFileSync('docker', ['exec', '-u', 'hermes', '-e', 'HOME=/opt/data', 'a9n9-agent002', 'hermes', 'cron', 'pause', j.id]); } catch {}
  }
}
