// Who counts as a person. Bots, spam and solicitors are filtered here, in code, so they neither score as engagement
// (outcomes, experiments, the daily review) nor become tickets. Week 1 (2026-11-07): every Nostr reply agent001 got was a bot,
// an airdrop link, a dev-for-hire pitch or a donation appeal, and `outcomes` counted them as the best channel.
const SPAM_LINK = /\b(trycloudflare\.com|loca\.lt|ngrok(-free)?\.(io|app|dev)|serveo\.net|localtunnel\.me|pinggy\.(io|link)|bit\.ly|tinyurl\.com|t\.me\/\S+)/i;
const SOLICIT = /(donat(e|ion|ing)|any support means|support (us|our|my) (family|journey)|gofundme|fixed price|happy to take this on|refund if i can'?t|airdrop|claim (your|free)|free tokens?|giveaway|dm me (for|to)|whatsapp me|parrainage|distribution ouverte|send me (btc|sats|usdt|eth)|investment opportunity|guaranteed (profit|returns))/i;
const BOT_BIO = /(^|[^\p{L}])(bot|бот|робот)([^\p{L}]|$)|\[bot\]|automated account|auto-?reply/iu;
export const MIN = { bskyFollowers: 5, bskyPosts: 10, nostrFollows: 10 };

/** Verdict from a profile and (optionally) the message text: { kind: 'person'|'bot'|'spam', new?, why }.
 *  New accounts still count as people: in week 1 the only real repliers were two small founders with under 5 followers. */
export function judge({ net, profile, text = '' }) {
  const t = String(text);
  if (SPAM_LINK.test(t)) return { kind: 'spam', why: 'tunnel or shortener link' };
  if (SOLICIT.test(t)) return { kind: 'spam', why: 'solicitation' };
  if (!profile) return { kind: 'person', new: true, why: 'no profile found' };
  const bio = `${profile.name ?? ''} ${profile.about ?? ''}`;
  if (profile.bot === true || BOT_BIO.test(bio)) return { kind: 'bot', why: 'bot profile' };
  if (SOLICIT.test(bio) || SPAM_LINK.test(bio)) return { kind: 'spam', why: 'solicitation in profile' };
  if (net === 'bsky') {
    if ((profile.labels ?? []).some((l) => /spam|bot|impersonation/i.test(l))) return { kind: 'bot', why: 'labelled' };
    if ((profile.followers ?? 0) < MIN.bskyFollowers || (profile.posts ?? 0) < MIN.bskyPosts) return { kind: 'person', new: true, why: `new account (under ${MIN.bskyFollowers} followers or ${MIN.bskyPosts} posts)` };
  }
  if (net === 'nostr' && (profile.follows ?? 0) < MIN.nostrFollows) return { kind: 'person', new: true, why: `new account (follows under ${MIN.nostrFollows})` };
  return { kind: 'person', why: 'ok' };
}

// --- profile lookups ---
const NOSTR_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
function nostrQuery(filter, ms = 7000) {
  const seen = new Map();
  return Promise.all(NOSTR_RELAYS.map((url) => new Promise((resolve) => {
    let ws; const done = () => { try { ws?.close(); } catch {} resolve(); }; const timer = setTimeout(done, ms);
    try { ws = new WebSocket(url); } catch { clearTimeout(timer); return resolve(); }
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'p', filter]));
    ws.onmessage = (m) => { try { const d = JSON.parse(m.data); if (d[0] === 'EVENT') seen.set(d[2].id, d[2]); if (d[0] === 'EOSE') { clearTimeout(timer); done(); } } catch {} };
    ws.onerror = () => { clearTimeout(timer); done(); };
  }))).then(() => [...seen.values()]);
}
/** pubkey hex[] → Map(pubkey → {name, about, bot, follows}) (absent = no profile found) */
export async function nostrProfiles(pubkeys) {
  const out = new Map(); if (!pubkeys.length) return out;
  const evs = await nostrQuery({ kinds: [0, 3], authors: pubkeys });
  const latest = (k, pk) => evs.filter((e) => e.kind === k && e.pubkey === pk).sort((a, b) => b.created_at - a.created_at)[0];
  for (const pk of pubkeys) {
    const m = latest(0, pk); if (!m) continue; let c = {}; try { c = JSON.parse(m.content); } catch {}
    const contacts = latest(3, pk);
    out.set(pk, { name: c.name || c.display_name || '', about: c.about || '', bot: c.bot === true, follows: (contacts?.tags ?? []).filter((t) => t[0] === 'p').length });
  }
  return out;
}
/** handle or did[] → Map(input → {name, about, followers, posts, labels}) */
export async function bskyProfiles(actors) {
  const out = new Map();
  for (let k = 0; k < actors.length; k += 25) {
    const q = actors.slice(k, k + 25).map((a) => `actors=${encodeURIComponent(a)}`).join('&');
    const j = await (await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${q}`)).json().catch(() => ({}));
    for (const p of j.profiles ?? []) {
      const v = { name: p.displayName ?? p.handle, about: p.description ?? '', followers: p.followersCount ?? 0, posts: p.postsCount ?? 0, labels: (p.labels ?? []).map((l) => l.val) };
      out.set(p.did, v); out.set(p.handle, v);
    }
  }
  return out;
}

// npub1… or note1… → hex (bech32, no checksum verification needed for a lookup key)
const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
export function npubToHex(s) {
  s = String(s).toLowerCase().replace(/^nostr:/, ''); if (/^[0-9a-f]{64}$/.test(s)) return s; if (!/^(npub1|note1)/.test(s)) return null;
  const data = [...s.slice(5, -6)].map((c) => CH.indexOf(c)); if (data.some((v) => v < 0)) return null;
  let acc = 0, bits = 0; const bytes = [];
  for (const v of data) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); } }
  return bytes.length >= 32 ? Buffer.from(bytes.slice(0, 32)).toString('hex') : null;
}

/** One account on one channel (no message text): used by ticket intake. */
export async function checkPerson(person, channel, text = '') {
  const ch = String(channel).toLowerCase();
  if (/nostr/.test(ch)) { const hex = npubToHex(person); if (!hex) return { kind: 'person', why: 'not a nostr key; not checked' }; return judge({ net: 'nostr', profile: (await nostrProfiles([hex])).get(hex), text }); }
  if (/bsky|bluesky/.test(ch)) { const a = String(person).replace(/^@/, ''); return judge({ net: 'bsky', profile: (await bskyProfiles([a])).get(a), text }); }
  return judge({ net: ch, profile: { name: '', about: '' }, text });
}

/** The Nostr event by id (hex or note1), or null. */
export async function nostrEvent(id) { const hex = npubToHex(id); if (!hex) return null; return (await nostrQuery({ ids: [hex] }))[0] ?? null; }
