#!/usr/bin/env node
// Host cron, every 10 minutes: enforces agent001's one law. When ./bin/life shows a balance of zero or less, every agent001 job is
// paused, state/DEAD is written and one note goes on the team board. The watcher never revives: income that brings the balance
// back above zero, or Arun, clears state/DEAD and resumes the jobs by hand. Also records the balance once an hour for history.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const HOME = '/home/ubuntu/a9n9/agent001', HERMES = '/home/ubuntu/.local/bin/hermes', DEAD = `${HOME}/state/DEAD`;
// the agent sets its own pace from inside its sandbox by leaving a request; the host applies it (60 to 1440 minutes)
try { const rq = `${HOME}/state/pace-request.json`; if (fs.existsSync(rq)) { const m = Math.round(Number(JSON.parse(fs.readFileSync(rq, 'utf8')).minutes)); fs.renameSync(rq, `${HOME}/state/pace-applied.json`); if (m >= 60 && m <= 1440 && !fs.existsSync(DEAD)) { execFileSync(HERMES, ['cron', 'edit', '8855c1d08404', '--schedule', `every ${m}m`], { stdio: 'pipe', timeout: 60000 }); fs.appendFileSync(`${HOME}/state/pace.jsonl`, JSON.stringify({ at: new Date().toISOString(), minutes: m }) + '\n'); } } } catch {}
// the terms the agent reads are a copy; keep it equal to the master
try { fs.copyFileSync('/home/ubuntu/a9n9/state/agent001-life.json', `${HOME}/life-terms.json`); } catch {}
// the SOUL the agent thinks with is the copy Hermes puts in its system prompt; keep it equal to the kit's (it sat unchanged from 11-02 to 11-27 while the kit's was rewritten)
try { const k = fs.readFileSync(`${HOME}/SOUL.md`, 'utf8'); if (k.length > 500 && k !== fs.readFileSync('/home/ubuntu/.hermes/SOUL.md', 'utf8')) fs.writeFileSync('/home/ubuntu/.hermes/SOUL.md', k); } catch (e) { console.error(new Date().toISOString(), 'soul sync', e.message); }
// the agent's own offers (bin/offer) go on its public page: checked here again, then published where the web service reads them
try {
  const src = `${HOME}/state/offers.json`, dst = `${HOME}/public/well-known/offers.json`;
  if (fs.existsSync(src)) {
    const bad = /guarantee|risk[- ]free|you will (earn|make|profit)|financial advice|investment advice|what to (buy|sell)|https?:\/\/|www\./i;
    const offers = Object.entries(JSON.parse(fs.readFileSync(src, 'utf8')).offers ?? {}).filter(([s, o]) => /^[a-z0-9][a-z0-9-]{2,23}$/.test(s) && Number.isInteger(o.usd) && o.usd >= 5 && o.usd <= 200 && typeof o.name === 'string' && o.name.length >= 4 && o.name.length <= 60 && typeof o.what === 'string' && o.what.length >= 20 && o.what.length <= 240 && !bad.test(o.name) && !bad.test(o.what)).slice(0, 6).map(([slug, o]) => ({ slug, usd: o.usd, name: o.name, what: o.what }));
    const body = JSON.stringify({ agent: 'agent001', offers }, null, 1); let was = ''; try { was = fs.readFileSync(dst, 'utf8'); } catch {}
    if (JSON.stringify(JSON.parse(was || '{}').offers ?? null) !== JSON.stringify(offers)) fs.writeFileSync(dst, JSON.stringify({ agent: 'agent001', updated: new Date().toISOString(), offers }, null, 1));
  }
} catch (e) { console.error(new Date().toISOString(), 'offers publish', e.message); }
const life = JSON.parse(execFileSync('/usr/bin/node', [`${HOME}/bin/life`], { encoding: 'utf8', timeout: 120000 }));
if (new Date().getUTCMinutes() < 10) fs.appendFileSync(`${HOME}/state/life.jsonl`, JSON.stringify({ at: new Date().toISOString(), balanceUsd: life.balanceUsd, burnPerDayUsd: life.burnPerDayUsd, daysLeft: life.daysLeftAtThisBurn }) + '\n');
if (!life.income.ledgerReadable) process.exit(0);   // never stop the agent on a reading we cannot trust
if (life.balanceUsd > 0 || fs.existsSync(DEAD)) process.exit(0);
fs.writeFileSync(DEAD, `${new Date().toISOString()} balance ${life.balanceUsd}\n`);
const jobs = JSON.parse(fs.readFileSync('/home/ubuntu/.hermes/cron/jobs.json', 'utf8'));
for (const j of (jobs.jobs ?? jobs)) if (/^agent001 /.test(j.name)) try { execFileSync(HERMES, ['cron', 'pause', j.id], { stdio: 'pipe', timeout: 60000 }); } catch {}
try {
  execFileSync('/usr/bin/node', ['/home/ubuntu/source/a9n9/agent/bin/board', 'post', `agent001 has run out of balance ($${life.balanceUsd} of $${life.startUsd}, born ${life.bornAt}). The host has stopped all its jobs. It earned $${life.income.addedToBalanceUsd} in its life.`, '--memory', 'agent001 stopped by the life watcher at zero balance'],
    { env: { ...process.env, BOARD_ENV: '/home/ubuntu/a9n9/secrets/board-claude.env' }, stdio: 'pipe', timeout: 60000 });
} catch {}
