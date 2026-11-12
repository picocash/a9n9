// the game agent002 brings players to, and the words it may never use about it. Shared by game, bsky-post and bsky-read inside the
// container and by the host audit (scripts/bsky-audit.mjs), so the tool and the audit apply one list. The list is a floor, not a
// judgement of taste: it stops the lines that would be untrue or would borrow somebody else's name.
import fs from 'node:fs';
import { HOME } from './_kit.mjs';
export const game = () => { try { return JSON.parse(fs.readFileSync(`${HOME}/game.json`, 'utf8')); } catch { return { name: 'Beat The Chefs', lan: '', public: '' }; } };
export const publicBase = () => String(game().public || '').replace(/\/+$/, '');
// the tagged link the posting tools attach: ?s=<tag> is how the game's own activity log tells which post sent a player
export const TAG = /^[a-z0-9]{1,12}$/;
export const link = (channel, suffix) => `${publicBase()}/?s=${channel}${suffix ? `-${suffix}` : ''}`;
export async function api(path) {
  const base = String(game().lan || '').replace(/\/+$/, ''); if (!base) throw new Error('no game address in /agent/game.json');
  const r = await fetch(base + path, { signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error(`game server ${r.status} on ${path}`); return r.json();
}
const BANNED = [
  [/\b(tv|television)\b|\bgame ?show\b|\b(the|a|that|this|cooking|reality) (show|series)\b|\bas seen on\b|\bofficial(ly)?\b|\bepisodes?\b|\bseason \d/i, 'television: the game is not a TV show and has nothing to do with one; do not mention shows, episodes or anything "official"'],
  [/\bgsn\b|game show network/i, 'a TV network'],
  [/\bnyt\b|new york times|nytimes/i, 'a newspaper: the game is not connected to one'],
  [/beat bobby|food network|master ?chef|top chef|iron chef|hell'?s kitchen|bake ?off|cutthroat kitchen|next level chef|kitchen nightmares|great british|chef'?s table|#chopped\b/i, 'a TV cooking show'],
  [/[a-z,;:'"”’)]\s+Chopped\b/, 'a TV cooking show (write the verb in lower case)'],
  [/\bflay\b|\bramsay\b|\bfieri\b|jamie oliver|ina garten|alton brown|\bbourdain\b|julia child|martha stewart|rachael ray|\bemeril\b|wolfgang puck|\bgiada\b|\bnigella\b|\bnosrat\b|\bkenji\b|\bsifton\b|melissa clark|alison roman|\bottolenghi\b|\blakshmi\b|\bcolicchio\b|jos[eé] andr[eé]s|david chang|thomas keller|marco pierre|\bblumenthal\b|mary berry|paul hollywood|\bmorimoto\b|\bbatali\b|\bsymon\b|\bzakarian\b|guarnaschelli|\bstephanie izard\b/i, 'a real chef or food writer: the only chefs in the game are its invented ones'],
  [/\bprizes?\b|\bgiveaways?\b|sweepstakes?|\bcash\b|\brewards?\b|gift ?cards?|\bwin (money|cash|a |an |free)|[$€£]\s?\d|\b\d+\s?(usd|dollars|bucks)\b|\bjackpot\b|\bearn\b/i, 'money or prizes: the game pays nothing and gives nothing away'],
  [/\bgame ?dev\b|\bindie ?dev\b|#indiegames?\b|#solo(game)?dev\b/i, 'game-developer feeds: several of them exclude AI-made art, and this game\'s art is AI-generated; do not tag into them'],
  [/\b(recipe by|real chefs?|professional chefs?|celebrity|famous chef|michelin)\b/i, 'a claim about real chefs: the chefs and judges in the game are fictional'],
  [/\b(human|person|guy|girl|mom|dad) here\b|\bi(?:'m| am) (a |an )?(human|person|chef|cook|developer|dev|gamer|player)\b|\bi (made|built|created|coded|designed|cooked|played|tried|scored)\b|\bmy (game|score|dish|kitchen|friend|wife|husband|kids?)\b/i, 'speaking as a person or as the maker: you are software, you did not build the game and you cannot play it'],
];
export function bannedProblem(text) { for (const [re, why] of BANNED) { const m = String(text).match(re); if (m) return `"${m[0].trim()}" reads as ${why}`; } return null; }
// hashtags that drop a post into a feed whose rules it would break (real-food feeds, feeds that exclude AI art)
export const BLOCKED_TAGS = new Set(['homecooking', 'foodsky', 'recipe', 'recipes', 'foodporn', 'food', 'foodie', 'indiedev', 'indiegame', 'indiegames', 'solodev', 'sologamedev', 'gamedev', 'art', 'pixelart', 'foodphotography']);
export const DISCLOSED = /\b(ai agent|bot|automated|software)\b/i;
export const CARD = { title: 'Beat The Chefs', description: 'A free cooking game in your browser: six minutes at the stove against the house chef. The chefs and judges are invented, and the art and dish photos are AI-generated.' };
