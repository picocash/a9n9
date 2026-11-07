// agent002 kit: shared helpers. Runs inside agent002's own Hermes container, where this directory is mounted at /agent
// (read-only) with /agent/state writable and agent002's Nostr key at /agent/secrets/nostr.env. Nothing from agent001 is mounted.
import fs from 'node:fs';
export const HOME = process.env.AGENT_HOME || '/agent';
export const STATE = `${HOME}/state`;
export const out = (o) => console.log(JSON.stringify(o, null, 1));
export const today = () => new Date().toISOString().slice(0, 10);
export const env = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
export const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
export const append = (f, o) => fs.appendFileSync(f, JSON.stringify(o) + '\n');
export function counter(kind) {
  const f = `${STATE}/counters.json`; const read = () => { const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; if (c.day !== today()) return { day: today() }; return c; };
  return { get: () => read()[kind] ?? 0, bump: () => { const c = read(); c[kind] = (c[kind] ?? 0) + 1; fs.writeFileSync(f, JSON.stringify(c)); } };
}
export function paused() { return fs.existsSync(`${STATE}/PAUSED`) ? fs.readFileSync(`${STATE}/PAUSED`, 'utf8').trim() : null; }
export function affiliatePrograms() { try { return JSON.parse(fs.readFileSync(`${HOME}/affiliates.json`, 'utf8')).programs ?? {}; } catch { return {}; } }
const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9$%.]{3,}/g) ?? []);
export function overlap(a, b) { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)); }
