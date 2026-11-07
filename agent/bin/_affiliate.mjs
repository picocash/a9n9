// Affiliate rules shared by every agent kit (agent001 bin/_lib.mjs re-exports them; agent002's kit gets a copy at deploy).
// Pure functions only: no files, no HOME. Prompts are not controls: posting tools call affiliateProblem before anything goes out.
export const AFFILIATE_PATTERN = /[?&](ref|via|aff|affiliate|fpr|tap_a|partner|referral|refcode|utm_source=affiliate)=|\b(try\.elevenlabs\.io|firecrawl\.link|m\.do\.co|partnerstack\.com|tapfiliate\.com|firstpromoter\.com|awin1\.com|shareasale\.com|amzn\.to|hasoffers\.com|go2cloud\.org)\b/i;
export const REBATE = /\b(cash ?back|rebates?|kickback|refund (you|your)|(pay|give|send) you (back|the commission|my cut|our cut|the cut)|split (the|my|our) (commission|cut)|share (the|my|our) commission)\b/i;
const normUrl = (u) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[.,;:!?)\]]+$/, '').replace(/([?&])utm_[a-z]+=[^&]*/gi, '$1').replace(/[?&]+$/, '').replace(/\?&+/, '?').replace(/\/(\?|$)/, '$1').toLowerCase();
export function affiliateProblem(text, programs, usedToday = 0, cap = 2) {
  const approved = Object.entries(programs).map(([id, p]) => [id, normUrl(p.link)]);
  const found = [];
  for (const m of text.matchAll(/(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s"'<>]*)?/gi)) {
    const raw = m[0]; if (!raw.includes('/') && !raw.includes('?') && !approved.some(([, a]) => a === normUrl(raw))) continue;
    const n = normUrl(raw); const hit = approved.find(([, a]) => n === a || n.startsWith(a + '/') || n.startsWith(a + '&') || (a.includes('?') && n.startsWith(a)));
    if (hit) found.push({ id: hit[0], at: m.index, len: raw.length });
    else if (AFFILIATE_PATTERN.test(raw)) return { code: 2, error: `"${raw}" looks like an affiliate or referral link that is not in your approved list. Only links from bin/affiliate may be posted. Nothing was published.` };
  }
  if (!found.length) return null;
  if (REBATE.test(text)) return { code: 2, error: 'the text offers to pass a commission or cash back to the buyer. The programs forbid rebates. Recommend the product on its merits and mention only the discount the program itself gives (bin/affiliate shows it). Nothing was published.' };
  for (const f of found) { const win = text.slice(Math.max(0, f.at - 120), f.at + f.len + 120);
    if (!/\baffiliate link\b/i.test(win)) return { code: 2, error: `the ${f.id} link has no disclosure next to it. Write "affiliate link" right beside it, e.g. "(affiliate link: a9n9 earns a commission if you buy)". A profile note is not enough. Nothing was published.` }; }
  if (usedToday >= cap) return { code: 4, error: `affiliate links are capped at ${cap} posts a day across all networks and ${usedToday} went out today. Post useful work without a link, or journal this for tomorrow.` };
  return { programs: [...new Set(found.map((f) => f.id))] };
}
