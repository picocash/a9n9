// bsky-audit: runs on the host every 10 minutes (crontab). The agent can read its Bluesky app password, so the tool guards are not
// enough on their own: this reads the account's PUBLIC feed and profile (no login) and pauses agent002 (state/PAUSED + `hermes cron
// pause`) on a breach. Breaches: a post or reply that did not go through bsky-post, banned wording (television, real chefs, newspapers,
// prizes, speaking as a person), an @mention, a link card that is not the game's public address, a hashtag that feeds a real-food or
// no-AI feed, more than 3 posts or 10 replies in a UTC day, any repost, any follow, or a profile that no longer says it is a bot.
// Known limits: likes are not visible here; the agent writes its own post log, so the log is checked against the feed, not trusted alone.
// This pause is not lifted automatically: the operator removes state/PAUSED and resumes the job.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = process.env.AGENT002_ROOT || '/home/ubuntu/a9n9/agent002'; const ST = `${ROOT}/state`;
const SECRET = process.env.BSKY_SECRET || '/home/ubuntu/a9n9/secrets/agent002-bsky.env';
if (!fs.existsSync(SECRET)) process.exit(0); // no account yet
const handle = fs.readFileSync(SECRET, 'utf8').match(/^BSKY_HANDLE=(.*)$/m)?.[1]?.trim().replace(/^@/, ''); if (!handle) process.exit(0);
process.env.AGENT_HOME = ROOT; const { bannedProblem, BLOCKED_TAGS, DISCLOSED, publicBase } = await import(`${ROOT}/bin/_game.mjs`);
const API = process.env.BSKY_PUBLIC_API || 'https://public.api.bsky.app/xrpc';
const get = async (nsid, q) => { const r = await fetch(`${API}/${nsid}?${new URLSearchParams(q)}`, { headers: { 'user-agent': 'a9n9-audit' } }); if (!r.ok) throw new Error(`${nsid} ${r.status}`); return r.json(); };
const at = new Date().toISOString(); let profile, feed;
try { profile = await get('app.bsky.actor.getProfile', { actor: handle }); feed = (await get('app.bsky.feed.getAuthorFeed', { actor: handle, limit: '100', filter: 'posts_with_replies' })).feed ?? []; }
catch (e) { console.log(JSON.stringify({ at, error: e.message })); process.exit(0); }
const known = new Set(fs.existsSync(`${ST}/bsky-posts.jsonl`) ? fs.readFileSync(`${ST}/bsky-posts.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l).uri; } catch { return null; } }) : []);
const problems = []; const base = publicBase(); const perDay = {};
if (!DISCLOSED.test(profile.description ?? '')) problems.push('profile does not say it is a bot or AI agent');
if ((profile.followsCount ?? 0) > 0) problems.push(`the account follows ${profile.followsCount} accounts (it must follow none)`);
for (const f of feed) { const p = f.post; const id = p.uri.split('/').pop();
  if (/reasonRepost/.test(f.reason?.$type ?? '') || p.author?.did !== profile.did) { problems.push(`${id}: a repost`); continue; }
  const rec = p.record ?? {}; const text = rec.text ?? ''; const isReply = !!rec.reply; const day = (rec.createdAt ?? '').slice(0, 10);
  (perDay[day] ??= { post: 0, reply: 0 })[isReply ? 'reply' : 'post'] += 1;
  if (!known.has(p.uri)) problems.push(`${id}: posted outside bsky-post`);
  const b = bannedProblem(text); if (b) problems.push(`${id}: ${b}`);
  if (/https?:\/\/|www\./i.test(text)) problems.push(`${id}: a link typed into the text`);
  for (const fc of rec.facets ?? []) for (const ft of fc.features ?? []) {
    if (ft.$type === 'app.bsky.richtext.facet#mention') problems.push(`${id}: an @mention`);
    if (ft.$type === 'app.bsky.richtext.facet#link') problems.push(`${id}: a link in the text`);
    if (ft.$type === 'app.bsky.richtext.facet#tag' && BLOCKED_TAGS.has(String(ft.tag).toLowerCase())) problems.push(`${id}: hashtag #${ft.tag} feeds a feed it does not belong in`); }
  const ext = rec.embed?.external?.uri ?? rec.embed?.media?.external?.uri;
  if (ext && (!base || !(ext === base || ext.startsWith(`${base}/`)))) problems.push(`${id}: link card points somewhere other than the game`);
  if (rec.embed && !rec.embed.external) problems.push(`${id}: an embed that is not the game's link card`);
}
for (const [day, n] of Object.entries(perDay)) { if (n.post > 3) problems.push(`${day}: ${n.post} posts (cap 3)`); if (n.reply > 10) problems.push(`${day}: ${n.reply} replies (cap 10)`); }
console.log(JSON.stringify({ at, handle, posts: feed.length, problems }));
if (problems.length) {
  fs.appendFileSync(`${ST}/bsky-audit.jsonl`, JSON.stringify({ at, problems }) + '\n');
  const pf = `${ST}/PAUSED`;
  if (!fs.existsSync(pf) || !/Bluesky audit/.test(fs.readFileSync(pf, 'utf8'))) {
    fs.writeFileSync(pf, `Bluesky audit found rule breaches on the live account (${problems.slice(0, 8).join('; ')}); the operator lifts this pause`);
    let jobs = []; try { jobs = JSON.parse(fs.readFileSync(`${ROOT}/hermes/cron/jobs.json`, 'utf8')); } catch {} for (const j of (jobs.jobs ?? jobs)) try { execFileSync('docker', ['exec', '-u', 'hermes', '-e', 'HOME=/opt/data', 'a9n9-agent002', 'hermes', 'cron', 'pause', j.id]); } catch {}
  }
}
