// judge.mjs: independent content-quality judge for agent posts. Runs on the host only; agents cannot read or edit it.
// Uses a different model family from the agents (xAI Grok) so the writer is not grading itself.
//   node judge.mjs score <file.md> [--title "..."]      -> JSON rubric + pull score (0-100)
//   node judge.mjs compare <ours.md> <theirs.md>         -> which a reader would pick, run in both orders
// Calibrated by calibrate.mjs against real dev.to reaction counts; see README.md for the result.
import fs from 'node:fs';
const MODEL = process.env.JUDGE_MODEL || 'grok-4.20-0309-non-reasoning';
const MAX = 14000;
function key() {
  if (process.env.XAI_API_KEY) return process.env.XAI_API_KEY;
  const f = fs.readFileSync('/home/ubuntu/a9n9/secrets/grok.env', 'utf8'); return f.match(/^XAI_API_KEY=(.*)$/m)[1].trim();
}
export const usage = { in: 0, out: 0 };
async function ask(system, user) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 3000 * (i + 1))); continue; }
    const d = await r.json(); if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 300));
    usage.in += d.usage?.prompt_tokens ?? 0; usage.out += d.usage?.completion_tokens ?? 0;
    return JSON.parse(d.choices[0].message.content);
  }
  throw new Error('judge: upstream kept failing');
}
const clip = (t) => (t.length > MAX ? t.slice(0, MAX) + '\n[...truncated]' : t);
export const CRITERIA = ['hook', 'novelty', 'specificity', 'stakes', 'voice', 'usefulness', 'shareability'];
const SCORE_SYS = `You are an editor at a developer publication deciding which submissions will pull readers in.
You judge the TEXT only: ignore who wrote it, how famous they are, and any reaction counts. Every post carries a required AI-authorship disclosure and labelled affiliate links: never penalise their presence or suggest removing them (you may still criticise a piece that reads like an advert). Be harsh: most posts online are forgettable, and a 5 means "fine but nobody would share it".
Score 1-10 on each criterion:
- hook: do the title and first two lines make a busy developer stop scrolling?
- novelty: does it say something (a fact, number, finding, angle) the reader would not get from the top 10 search results on this topic?
- specificity: concrete numbers, real examples, code that runs, named tools, measured results, rather than generic advice?
- stakes: is there a story, a problem with consequences, a surprise, a tension?
- voice: a distinct point of view or opinion, rather than neutral listicle filler or obvious AI-sounding prose?
- usefulness: would a reader do something differently after reading?
- shareability: would someone send it to a colleague or post it?
Then give "pull": 0-100, your estimate of how strongly this piece pulls readers compared with typical posts on dev.to (50 = typical, which mostly get no reactions).
Return JSON: {"scores":{criterion:int...},"pull":int,"strongest":"...","weakest":"...","fix":"the one change that would most raise its pull"}`;
// One call is noisy (the same post scored 38 and 62 in testing), so score() takes the median of `runs` calls.
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
export async function score(text, title = '', runs = 1) {
  const js = []; for (let i = 0; i < runs; i++) js.push(await ask(SCORE_SYS, `TITLE: ${title}\n\nBODY:\n${clip(text)}`));
  if (runs === 1) return js[0];
  const pulls = js.map((j) => j.pull); const best = js.find((j) => j.pull === median(pulls));
  return { ...best, pull: median(pulls), pullRuns: pulls, scores: Object.fromEntries(CRITERIA.map((k) => [k, median(js.map((j) => j.scores?.[k] ?? 0))])) };
}
const CMP_SYS = `You are an editor at a developer publication. Two posts on similar topics follow. Judge the TEXT only, not authors.
Which one would more developers stop for, read to the end, react to and share? Return JSON {"winner":"A"|"B","margin":1-5,"why":"one sentence"}`;
export async function compare(a, b) {
  const one = await ask(CMP_SYS, `POST A\nTITLE: ${a.title}\n${clip(a.body)}\n\n=====\n\nPOST B\nTITLE: ${b.title}\n${clip(b.body)}`);
  const two = await ask(CMP_SYS, `POST A\nTITLE: ${b.title}\n${clip(b.body)}\n\n=====\n\nPOST B\nTITLE: ${a.title}\n${clip(a.body)}`);
  const firstWins = (one.winner === 'A') + (two.winner === 'B'); // votes for `a`
  return { aVotes: firstWins, consistent: firstWins !== 1, why: [one.why, two.why] };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, f1, f2] = process.argv.slice(2);
  const read = (f) => { const t = fs.readFileSync(f, 'utf8'); const m = t.match(/^#\s+(.+)$/m) || t.match(/^title:\s*(.+)$/m); return { title: m?.[1] ?? f, body: t }; };
  if (cmd === 'score') { const a = read(f1); console.log(JSON.stringify(await score(a.body, a.title, 3), null, 1)); }
  else if (cmd === 'compare') console.log(JSON.stringify(await compare(read(f1), read(f2)), null, 1));
  else console.log('usage: judge.mjs score <file.md> | compare <ours.md> <theirs.md>');
  console.error('tokens', usage);
}
