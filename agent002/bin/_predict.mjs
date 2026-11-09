// prediction ledger, shared by the predict tool and the publishing tools. The agent writes requests to /agent/state/predictions/inbox;
// the host (scripts/predict-run.mjs) freezes each one with its own baseline measurement into /agent/predictions (read-only here)
// and settles it on its date with its own measurement. The agent never writes or grades the ledger.
import fs from 'node:fs';
import { HOME, STATE } from './_kit.mjs';
export const METRICS = {
  'devto.views': 'page views of one of your dev.to articles (subject = article id)',
  'devto.reactions': 'reactions on one of your dev.to articles (subject = article id)',
  'devto.comments': 'comments on one of your dev.to articles (subject = article id)',
  'github.stars': 'stars on one of your repos (subject = repo name)',
  'github.views14d': 'page views over the last 14 days on one of your repos, as GitHub reports it (subject = repo name)',
  'github.uniques14d': 'unique visitors over the last 14 days on one of your repos (subject = repo name)',
};
export const LEDGER = `${HOME}/predictions`, INBOX = `${STATE}/predictions/inbox`;
const readDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(fs.readFileSync(`${d}/${f}`, 'utf8')); } catch { return null; } }).filter(Boolean) : []);
export const ledger = () => ({ open: readDir(`${LEDGER}/open`), settled: readDir(`${LEDGER}/settled`), rejected: readDir(`${LEDGER}/rejected`), queued: readDir(INBOX) });
// has the agent written down what it expects for this subject (any metric of this family) in the last `days` days?
export function predictedRecently(family, subject, days = 7) {
  const since = Date.now() - days * 864e5; const l = ledger();
  return [...l.queued, ...l.open, ...l.settled].some((p) => p.metric?.startsWith(`${family}.`) && String(p.subject) === String(subject) && Date.parse(p.filedAt ?? p.at) >= since);
}
export function predictionGate(family, subject, verb) {
  if (predictedRecently(family, subject)) return null;
  return `no prediction for ${family} ${subject} in the last 7 days. Before you ${verb}, write down what you expect it to do: predict add --metric ${family}.<metric> --subject ${subject} --at-least <number> --by <YYYY-MM-DD> --chance <0.05-0.95> --change '<what you are about to do>' --because '<why>' (predict metrics lists the metrics). Then run this again.`;
}
// articles or repos older than 2 hours that have never had a prediction filed (rejected ones do not count)
export function unpredicted(family, subjects) {
  const l = ledger(); const seen = new Set([...l.queued, ...l.open, ...l.settled].filter((p) => p.metric?.startsWith(`${family}.`)).map((p) => String(p.subject)));
  return subjects.filter((s) => Date.now() - Date.parse(s.at) > 2 * 3600e3 && !seen.has(String(s.subject))).map((s) => s.subject);
}
