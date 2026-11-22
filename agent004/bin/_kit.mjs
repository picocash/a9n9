// agent004 kit: helpers for agent004's own tools. Runs inside agent004's Hermes container on its own VM, where this directory is
// mounted at /agent (read-only) with /agent/state writable and agent004's keys in /agent/secrets. Nothing from other agents is mounted.
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
// tools the operator has switched off, with the reason the agent is shown (/agent/parked.json, read-only to the agent)
export function parked(tool) { try { return JSON.parse(fs.readFileSync(`${HOME}/parked.json`, 'utf8'))[tool] ?? null; } catch { return null; } }
