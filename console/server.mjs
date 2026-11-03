#!/usr/bin/env node
// a9n9 console — internal (LAN-only) page: each agent's status, its last 24 hours, and money spent and earned.
// Reads each agent's own state, ledger (inbox API) and tools; holds no secrets in the page and writes nothing.
//   CONSOLE_HOST (10.0.1.101)  CONSOLE_PORT (8899)  CONSOLE_AGENTS (./agents.json)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const AGENTS = JSON.parse(fs.readFileSync(process.env.CONSOLE_AGENTS ?? path.join(DIR, 'agents.json'), 'utf8'));
const HERMES_JOBS = '/home/ubuntu/.hermes/cron/jobs.json';
const DAY = 86_400_000;

const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const readLines = (f) => { try { return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
const envFile = (f) => { try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; })); } catch { return {}; } };
const runJson = (home, tool) => new Promise((resolve) => execFile('node', [path.join(home, 'bin', tool)], { cwd: home, timeout: 45_000, maxBuffer: 4 << 20 }, (err, stdout) => { try { resolve(JSON.parse(stdout)); } catch { resolve({ ok: false, error: err ? err.message.split('\n')[0] : 'no output' }); } }));

const PUBLIC = /^(x\.(post|reply)|bsky\.(post|reply)|nostr\.(post|reply)|email\.sent|sms\.sent|whatsapp\.sent|telegram\.sent)$/;
const INBOUND = /^(email\.received|nostr\.(mention|dm)|bsky\.mention|x\.mention|sms\.received|whatsapp\.received|telegram\.message)$/;

async function agentStatus(a) {
  const now = Date.now(); const since = new Date(now - DAY).toISOString();
  const tok = envFile(a.inboxTokenFile).INBOX_API_TOKEN; const h = { authorization: `Bearer ${tok}` };
  const get = async (u) => (await fetch(u, { headers: h, signal: AbortSignal.timeout(8000) })).json();

  // ledger, last 24h
  let events = [], ledgerError = null;
  try { events = (await get(`${a.inbox}/v1/events?limit=500&since=${since}`)).events ?? []; } catch (e) { ledgerError = e.message; }
  const byType = {}; for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;
  const wanted = events.filter((e) => PUBLIC.test(e.type) || INBOUND.test(e.type) || e.type.startsWith('money.') || e.type === 'agent.opportunity').slice(0, 80);
  const detailed = await Promise.all(wanted.map(async (e) => {
    try { const p = (await get(`${a.inbox}/v1/events/${e.channel}/${encodeURIComponent(e.id)}`)).payload ?? {}; return { at: e.receivedAt, type: e.type, text: String(p.text ?? p.body ?? p.subject ?? p.what ?? p.note ?? '').slice(0, 400), url: p.url ?? null, who: p.from ?? p.to ?? p.author ?? p.handle ?? null, amountUsd: p.amount_usd ?? null }; }
    catch { return { at: e.receivedAt, type: e.type, text: '', url: null }; }
  }));

  // runs (Hermes), scoreboard, money
  const jobsRaw = readJson(HERMES_JOBS, []); const jobs = (Array.isArray(jobsRaw) ? jobsRaw : jobsRaw.jobs ?? Object.values(jobsRaw)).filter((j) => String(j.name ?? '').startsWith(a.hermesJobPrefix))
    .map((j) => ({ name: j.name.slice(a.hermesJobPrefix.length), every: j.schedule?.display, enabled: j.enabled, lastRun: j.last_run_at, lastStatus: j.last_status, nextRun: j.next_run_at }));
  const [runway, mvr] = await Promise.all([runJson(a.home, 'runway'), runJson(a.home, 'mvr')]);
  const usage = readLines(path.join(a.home, 'state', 'x-api-usage.jsonl')).filter((u) => Date.parse(u.at) > now - DAY);
  const xApi24 = usage.reduce((s, u) => s + Number(u.price ?? 0), 0);
  const tools24 = detailed.filter((d) => d.type === 'money.spend').reduce((s, d) => s + Number(d.amountUsd ?? 0), 0);
  const income24 = detailed.filter((d) => d.type === 'money.income').reduce((s, d) => s + Number(d.amountUsd ?? 0), 0);
  const fixed24 = Number(runway.fixedPerDayUsd ?? 0);

  // liveness: off-box probe verdicts (from mvr) + own heartbeat
  let heartbeat = null; try { heartbeat = (await fetch(`${a.public}/heartbeat`, { signal: AbortSignal.timeout(6000) })).status; } catch {}
  const probe = mvr?.tenure?.probe?.targets ?? null;
  const journal = readLines(path.join(a.home, 'state', 'journal.jsonl')).filter((j) => Date.parse(j.at) > now - DAY).reverse();
  const corrections = readJson(path.join(a.home, 'state', 'corrections.json'), []);
  const tickets = (readJson(path.join(a.home, 'state', 'tickets.json'), { tickets: [] }).tickets ?? []).filter((t) => t.status !== 'closed');
  const lastAction = detailed.find((d) => PUBLIC.test(d.type))?.at ?? null;

  const problems = [];
  if (ledgerError) problems.push(`ledger unreachable: ${ledgerError}`);
  if (heartbeat !== 200) problems.push(`public heartbeat ${heartbeat ?? 'unreachable'}`);
  for (const t of probe ?? []) if (!t.ok) problems.push(`probe: ${t.target} down since ${t.since}`);
  for (const j of jobs) if (j.enabled && j.lastStatus && j.lastStatus !== 'ok') problems.push(`run "${j.name}" last status ${j.lastStatus}`);
  if (!lastAction) problems.push('no public action in 24 hours');
  if (corrections.length) problems.push(`${corrections.length} correction(s) waiting to be published`);

  return {
    id: a.id, name: a.name, public: a.public, generatedAt: new Date(now).toISOString(),
    state: problems.some((p) => /unreachable|down|status/.test(p)) ? 'down' : problems.length ? 'attention' : 'ok', problems,
    jobs, heartbeat, probe, counters: readJson(path.join(a.home, 'state', 'counters.json'), {}),
    last24h: { byType, total: events.length, actions: detailed.filter((d) => PUBLIC.test(d.type)), inbound: detailed.filter((d) => INBOUND.test(d.type)), opportunities: detailed.filter((d) => d.type === 'agent.opportunity'), journal },
    money: { spent24hUsd: +(fixed24 + xApi24 + tools24).toFixed(2), spent24h: { fixedShareUsd: +fixed24.toFixed(2), xApiUsd: +xApi24.toFixed(3), toolBuysUsd: +tools24.toFixed(3) }, earned24hUsd: +income24.toFixed(2),
      toDate: { spentUsd: runway.spentToDateUsd ?? null, incomeUsd: runway.incomeUsd ?? null, budgetLeftUsd: runway.budgetLeftUsd ?? null, runwayDays: runway.runwayDays ?? null, startUsd: 100, earned: runway.earned ?? null }, runwayError: runway.ok === false ? runway.error : null },
    scoreboard: mvr.ok === false ? { error: mvr.error } : { followersX: mvr.reach?.followersX, followersBluesky: mvr.reach?.followersBluesky, engaged: mvr.engagement?.distinctAccountsEngaged, engagedTarget: mvr.engagement?.target, helped: mvr.helpedReceipts?.yes, helpedWeeklyTarget: mvr.helpedReceipts?.weeklyTarget, paid: mvr.paidWork?.count, paidTarget: mvr.paidWork?.target, emailsIn: mvr.correspondence?.humanEmailsReceived, threadsReplied: mvr.correspondence?.threadsWithReply, ledgerEntries: mvr.ledgerEntries },
    corrections, tickets,
  };
}

let cache = { at: 0, body: null };
async function status() {
  if (cache.body && Date.now() - cache.at < 60_000) return cache.body;
  const agents = await Promise.all(AGENTS.map((a) => agentStatus(a).catch((e) => ({ id: a.id, name: a.name, state: 'down', problems: [`console could not read this agent: ${e.message}`] }))));
  cache = { at: Date.now(), body: JSON.stringify({ generatedAt: new Date().toISOString(), agents }) };
  return cache.body;
}

const page = fs.readFileSync(path.join(DIR, 'index.html'));
http.createServer(async (req, res) => {
  if (req.url === '/api/status') { try { const b = await status(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(b); } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: e.message })); } }
  if (req.url === '/' || req.url === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page); }
  if (req.url === '/livez') { res.writeHead(200); return res.end('ok'); }
  res.writeHead(404); res.end();
}).listen(Number(process.env.CONSOLE_PORT ?? 8899), process.env.CONSOLE_HOST ?? '10.0.1.101', () => console.log(`[console] http://${process.env.CONSOLE_HOST ?? '10.0.1.101'}:${process.env.CONSOLE_PORT ?? 8899} — ${AGENTS.length} agent(s)`));
