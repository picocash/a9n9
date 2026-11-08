// Quality gate: nothing reaches dev.to or a GitHub README until an independent judge on the host has scored that exact text.
// The agent queues a draft in /agent/state/judge/inbox; the host (scripts/judge-run.mjs, every 2 minutes) scores it with a
// different model and writes the result to /agent/judge/results, which is read-only here. Results are keyed by the sha256 of
// title + text, so any change to the text needs a new score. Pass mark: pull >= 50 (calibration: a9n9/scripts/judge/README.md).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { HOME, STATE } from './_kit.mjs';
export const PASS = 50;
export const judgeKey = (title, text) => crypto.createHash('sha256').update(`${title ?? ''}\n\n${text.trim()}`).digest('hex');
export function judgeGate(title, text, kind) {
  const shellHit = /\/(?:usr\/)?bin\/(?:ba|z|da)?sh\b/.exec(`${title ?? ""}\n${text}`);
  if (shellHit) return { error: `the text contains "${shellHit[0]}": the shell expanded a dollar sign (for example $0.072 became ${shellHit[0]}.072). Write the text to a file with a quoted heredoc (<<\x27EOF\x27) or single quotes, check the prices read correctly, then run again.`, code: 2 };
  const sha = judgeKey(title, text); const rf = `${HOME}/judge/results/${sha}.json`;
  if (!fs.existsSync(rf)) {
    fs.mkdirSync(`${STATE}/judge/inbox`, { recursive: true });
    const q = `${STATE}/judge/inbox/${sha}.json`;
    if (!fs.existsSync(q)) fs.writeFileSync(q, JSON.stringify({ at: new Date().toISOString(), kind, title: title ?? '', text: text.trim() }));
    return { error: `queued for the quality judge (${sha.slice(0, 12)}). An independent judge on the host scores this exact text within about 5 minutes; run the same command again then. Any change to the text needs a new score. Use /agent/bin/judge to check a draft before you publish.`, code: 4, sha };
  }
  const r = JSON.parse(fs.readFileSync(rf, 'utf8'));
  if (r.error) return { error: `the judge could not score this text: ${r.error}. Try again in a few minutes.`, code: 1, sha };
  if (r.pull < PASS) return { error: `quality judge: pull ${r.pull}/100, below the pass mark of ${PASS}. Weakest: ${r.weakest}. Its suggested fix: ${r.fix} (Use only numbers and events you measured yourself; never invent an anecdote to follow this advice.) Rewrite, then run again.`, code: 2, sha, result: r };
  return { ok: true, sha, pull: r.pull, weakest: r.weakest, fix: r.fix };
}
