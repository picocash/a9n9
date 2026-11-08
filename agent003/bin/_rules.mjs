// Page rules shared by bin/page (inside the container) and scripts/site-build.mjs (on the host, which re-checks everything
// before a page goes live). Returns null when the page is fine, else { error, code }.
export const MARKER = '597751';
export const SLUG = /^[a-z0-9][a-z0-9-]{2,79}$/;
const BRAND = /(aviasales\.|jetradar\.|tp\.media|tp\.st|travelpayouts\.|marker=597751|booking\.com|hotellook\.|getyourguide\.|klook\.|kiwi\.com|tiqets\.|viator\.|discovercars\.|airalo\.|ektatraveling\.|safetywing\.|omio\.|12go\.|trip\.com|agoda\.|expedia\.|hotels\.com|skyscanner\.)/i;
export function checkPage({ slug, title, description, markdown }, now = new Date()) {
  if (!SLUG.test(slug ?? '')) return { error: 'slug: 3-80 lowercase letters, digits and hyphens, e.g. nyc-to-lisbon-cheapest-months', code: 2 };
  if (!title || title.length > 90) return { error: 'title is required, at most 90 characters', code: 2 };
  if (!description || description.length < 50 || description.length > 170) return { error: 'description (for search results) must be 50-170 characters', code: 2 };
  const md = String(markdown ?? '');
  const words = md.split(/\s+/).filter(Boolean).length; if (words < 600) return { error: `${words} words: a guide must be at least 600 words of real help`, code: 2 };
  if (/<\s*(script|iframe|style|form|object|embed)\b/i.test(md)) return { error: 'no raw HTML scripts, iframes, styles or forms in a page; write Markdown', code: 2 };
  if (/\b(I|we) (visited|stayed|flew|travel(l)?ed|went|ate|walked|booked|loved|spent \d)|\bwhen (I|we) (was|were) in\b|\bmy (trip|stay|flight|visit) to\b/i.test(md)) return { error: 'first-person travel experience: you have not travelled anywhere and must not write as if you had. Describe data, sources and options instead.', code: 2 };
  if (/\b(cash ?back|rebate|refund (you|part)|we('| wi)ll (pay|give) you)\b/i.test(md)) return { error: 'no cashback, rebates or payments to readers (forbidden by our rules and by most travel programs)', code: 2 };
  const links = [...md.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)([^\n]{0,40})/g)];
  const aff = links.filter((m) => BRAND.test(m[2]));
  for (const m of aff) if (!/affiliate link/i.test(m[3]) && !/affiliate link/i.test(m[1])) return { error: `travel-brand link without its label: "[${m[1]}](${m[2].slice(0, 60)}…)" needs "(affiliate link)" right after it`, code: 2 };
  if (aff.length > 6) return { error: `${aff.length} affiliate links: at most 6 per page; the page must help without them`, code: 2 };
  if (/https?:\/\/(?![^\s)]*\))[^\s]*/.test(md.replace(/\[[^\]]*\]\([^)]*\)/g, '')) && BRAND.test(md.replace(/\[[^\]]*\]\([^)]*\)/g, ''))) return { error: 'bare travel-brand URLs: write them as [text](url) (affiliate link)', code: 2 };
  const hasPrice = /([$€£]\s?\d|\b\d+(\.\d+)?\s?(USD|EUR|GBP)\b)/.test(md);
  if (hasPrice) {
    const dates = [...md.matchAll(/checked (on )?(\d{4}-\d{2}-\d{2})/gi)].map((m) => Date.parse(m[2]));
    if (!dates.length) return { error: 'the page quotes prices but never says when they were checked: add "checked YYYY-MM-DD" next to the prices (and name the source)', code: 2 };
    if (Math.max(...dates) < now - 14 * 864e5) return { error: 'the newest "checked" date is older than 14 days: refresh the prices before publishing', code: 2 };
  }
  return null;
}
