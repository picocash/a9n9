// Shared by bin/offer and bin/jobs: the agent's own offers (state/offers.json) and the limits on them.
import fs from 'node:fs';
import { HOME } from './_lib.mjs';
export const F = `${HOME}/state/offers.json`; export const LOG = `${HOME}/state/offers.jsonl`, JOBS = `${HOME}/state/jobs.json`;
export const SEED = { 'fact-check': { usd: 40, name: 'Fact-check my draft', what: 'every factual claim in one document (up to 3,000 words) checked against its sources: claim, source URL, what the source says, status, fetch time and content hash. Back within 2 business days.' } };
export const readOffers = () => { try { const d = JSON.parse(fs.readFileSync(F, 'utf8')); if (d && typeof d.offers === 'object') return d.offers; } catch { /* first use */ } return structuredClone(SEED); };
const BAD = /guarantee|risk[- ]free|you will (earn|make|profit)|financial advice|investment advice|what to (buy|sell)|https?:\/\/|www\./i;
export function checkOffer(slug, usd, name, what) {
  if (!/^[a-z0-9][a-z0-9-]{2,23}$/.test(slug ?? '')) return 'slug: 3 to 24 characters, lowercase letters, digits and dashes';
  if (!Number.isInteger(usd) || usd < 5 || usd > 200) return 'price: whole dollars from 5 to 200';
  if (typeof name !== 'string' || name.trim().length < 4 || name.trim().length > 60) return 'name: 4 to 60 characters';
  if (typeof what !== 'string' || what.trim().length < 20 || what.trim().length > 240) return 'description: 20 to 240 characters, saying what the buyer receives';
  if (BAD.test(name) || BAD.test(what)) return 'the text promises a result, gives advice, or carries a link; describe only what is delivered';
  return null;
}
