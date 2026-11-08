// collect.mjs: builds the calibration set for the content judge from dev.to's public API.
// Pulls articles in agent002's tags published 21-180 days ago (reactions have settled), keeps id, author, tag,
// reactions, comments and reading time. Output: data/articles.json. No auth; ~2 requests a second.
import fs from 'node:fs';
const TAGS = (process.argv[2] || 'ai,python,api,tutorial,productivity,webdev,llm,machinelearning').split(',');
const PAGES = (process.argv[3] || '20,28,36,44,60').split(',').map(Number);
const now = Date.now(), DAY = 864e5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'a9n9-judge-calibration/0.1' } });
    if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }
  throw new Error('rate limited: ' + url);
}
const seen = new Map();
for (const tag of TAGS) {
  for (const p of PAGES) {
    const list = await get(`https://dev.to/api/articles?tag=${tag}&per_page=1000&page=${p}`);
    if (!list.length) break;
    for (const a of list) {
      const age = (now - Date.parse(a.published_at)) / DAY;
      if (age < 21 || age > 180 || seen.has(a.id)) continue;
      seen.set(a.id, { id: a.id, tag, title: a.title, url: a.url, author: a.user?.username, org: a.organization?.username ?? null,
        reactions: a.public_reactions_count, comments: a.comments_count, minutes: a.reading_time_minutes, published: a.published_at.slice(0, 10) });
    }
    const oldest = list.at(-1)?.published_at; process.stderr.write(`${tag} p${p} kept=${seen.size} oldest=${oldest?.slice(0, 10)}\n`);
    await sleep(500);
  }
}
fs.writeFileSync('data/articles.json', JSON.stringify([...seen.values()], null, 1));
console.log('articles', seen.size);
