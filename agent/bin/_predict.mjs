// prediction ledger (agent001). The agent writes requests to state/predictions/inbox; the host (scripts/kpi/predict-run.mjs)
// files each with the latest KPI reading as its baseline into ~/a9n9/agent001/predictions (read-only to the agent) and settles it
// with the first KPI reading after its date. The agent never writes or grades the ledger.
import fs from 'node:fs';
import { HOME } from './_lib.mjs';
export const METRICS = {
  'email.peopleAnswered': 'people who emailed you first and got a reply from you (ledger)',
  'email.correspondents': 'distinct non-bulk senders who emailed agent001@ (ledger, heuristic)',
  'helped.yes': '"Did this help?" yes answers (ledger)',
  'bsky.followers': 'Bluesky followers (public API)',
  'bsky.likes.last100': 'likes on your last 100 Bluesky posts (public API)',
  'bsky.replies.last100': 'replies on your last 100 Bluesky posts (public API)',
  'stripe.payments': 'paid, unrefunded Stripe charges from people other than the operator',
  'stripe.paidUsd': 'USD from those charges',
};
export const LEDGER = `${HOME}/predictions`, INBOX = `${HOME}/state/predictions/inbox`;
const readDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(fs.readFileSync(`${d}/${f}`, 'utf8')); } catch { return null; } }).filter(Boolean) : []);
export const ledgerFiles = () => ({ open: readDir(`${LEDGER}/open`), settled: readDir(`${LEDGER}/settled`), rejected: readDir(`${LEDGER}/rejected`), queued: readDir(INBOX) });
export function predictionGate(verb, hours = 24) {
  const l = ledgerFiles(); const since = Date.now() - hours * 3600e3;
  if ([...l.queued, ...l.open, ...l.settled].some((p) => Date.parse(p.filedAt) >= since)) return null;
  return `no prediction filed in the last ${hours} h. Before you ${verb}, write down what you expect it to move: predict add --goal <rung id> --metric <metric> --at-least <number> --by <YYYY-MM-DD> --chance <0.05-0.95> --change '<what you will do>' --because '<why>' (predict metrics, goals). Then run this again.`;
}
