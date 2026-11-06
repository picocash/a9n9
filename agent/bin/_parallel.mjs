// Parallel.ai through tools.a9n9.net (docs/tools-parallel.md): argument parsing and the daily budget, pure so the guard test covers them.
// The vendor key never leaves the tools container; the agent pays per call with picocash (testnet today) like image and video.
export const PATHS = { search: '/v1/search', extract: '/v1/extract', decide: '/v1/decide', task: '/v1/task', findall: '/v1/findall', monitor: '/v1/monitor' };
export const FALLBACK_PRICE = { search: '0.0100', extract: '0.0100', decide: '0.0100', task: '0.0500', findall: '1.2000', monitor: '0.2000' };
export const DEFAULT_DAILY_USD = 1.5;
export const MAX_MONITORS = 5;
const USAGE = `parallel search '<objective>' [--queries 'q1|q2'] [--mode advanced|basic|fast|turbo] [--max N] [--domains a.com,.gov] [--after YYYY-MM-DD]
parallel extract <url> [<url>...] [--objective '<what to pull>'] [--full]
parallel decide --state '<json: the entity>' --ask name='<statement that is true or false>' [--ask ...] [--choice name='<question>' --options 'a=when a|b=when b'] [--score name='<question>' --levels 'none|some|all']
parallel task '<input>' --schema '<fields wanted, in words>' [--json '<json schema>'] [--processor lite|base|core] [--domains ...] [--after ...]
parallel findall '<objective>' [--type companies] --match 'name=what makes it a match' [--match ...] [--generator preview|base] [--limit N]
parallel monitor '<what to watch for>' [--weekly] [--label '<short name>'] [--domains ...]
parallel monitors                       (what you are watching, from state/parallel-monitors.json)
parallel events <monitor_id> [--group <event_group_id>]   (free)`;
export const usage = () => USAGE;
/** argv → { cmd, body, path } or { error }. No network, no files. */
export function parseArgs(argv) {
  const a = [...argv]; const cmd = a.shift();
  const flags = {}; const multi = { ask: [], choice: [], score: [], match: [] };
  const rest = [];
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (/^--[a-z]+$/.test(t)) { const k = t.slice(2); if (['full', 'weekly'].includes(k)) { flags[k] = true; continue; } const v = a[++i]; if (v === undefined) return { error: `${t} needs a value` }; if (multi[k]) multi[k].push(v); else flags[k] = v; }
    else rest.push(t);
  }
  const text = rest.join(' ').trim();
  const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
  const policy = () => ({ ...(flags.domains ? { include_domains: list(flags.domains) } : {}), ...(flags.after ? { after_date: flags.after } : {}) });
  const kv = (s) => { const i = s.indexOf('='); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : [null, null]; };
  switch (cmd) {
    case 'search': {
      if (!text) return { error: 'search needs an objective' };
      const queries = flags.queries ? String(flags.queries).split('|').map((s) => s.trim()).filter(Boolean).slice(0, 5) : [];
      const max = flags.max ? Math.max(1, Math.min(20, Number(flags.max) || 10)) : 10;
      return { cmd, path: PATHS.search, body: { objective: text, ...(queries.length ? { queries } : {}), max_results: max, ...(flags.mode ? { mode: flags.mode } : {}), ...policy() } };
    }
    case 'extract': {
      const urls = rest.filter((u) => /^https?:\/\/\S+$/.test(u)).slice(0, 10);
      if (!urls.length) return { error: 'extract needs one or more http(s) URLs' };
      return { cmd, path: PATHS.extract, body: { urls, ...(flags.objective ? { objective: flags.objective } : {}), ...(flags.full ? { full_content: true } : {}) } };
    }
    case 'decide': {
      let state; try { state = JSON.parse(flags.state ?? ''); } catch { return { error: "decide needs --state '<json>' (the entity or context, e.g. {\"company\":\"Tempo\",\"website\":\"https://tempo.xyz\"})" }; }
      const questions = {};
      for (const s of multi.ask) { const [n, q] = kv(s); if (!n || !q) return { error: `--ask wants name='statement', got ${s}` }; questions[n] = { type: 'noul', instructions: q }; }
      for (const s of multi.choice) { const [n, q] = kv(s); if (!n || !q) return { error: `--choice wants name='question', got ${s}` }; const criteria = Object.fromEntries((flags.options ?? '').split('|').map(kv).filter(([k]) => k)); if (Object.keys(criteria).length < 2) return { error: "--choice needs --options 'a=when a|b=when b' (2+)" }; questions[n] = { type: 'choice', instructions: q, criteria }; }
      for (const s of multi.score) { const [n, q] = kv(s); if (!n || !q) return { error: `--score wants name='question', got ${s}` }; const criteria = (flags.levels ?? '').split('|').map((x) => x.trim()).filter(Boolean); if (criteria.length < 2) return { error: "--score needs --levels 'level0|level1|...' (2-10)" }; questions[n] = { type: 'score', instructions: q, criteria }; }
      if (!Object.keys(questions).length) return { error: 'decide needs at least one --ask, --choice or --score' };
      if (Object.keys(questions).length > 20) return { error: 'at most 20 questions per call' };
      return { cmd, path: PATHS.decide, body: { state, questions } };
    }
    case 'task': {
      if (!text) return { error: 'task needs an input (what to research)' };
      let json_schema; if (flags.json) { try { json_schema = JSON.parse(flags.json); } catch { return { error: '--json must be a JSON schema object' }; } }
      if (!json_schema && !flags.schema) return { error: "task needs --schema '<fields wanted, in words>' or --json '<schema>'" };
      const processor = ['lite', 'base', 'core'].includes(flags.processor) ? flags.processor : 'base';
      return { cmd, path: PATHS.task, body: { input: text, ...(json_schema ? { json_schema } : { output_schema: flags.schema }), processor, ...policy() } };
    }
    case 'findall': {
      if (!text) return { error: 'findall needs an objective (what kind of entities, and the conditions)' };
      const match_conditions = multi.match.map(kv).filter(([n, d]) => n && d).map(([name, description]) => ({ name, description })).slice(0, 8);
      if (!match_conditions.length) return { error: "findall needs --match 'name=what makes it a match' (1-8)" };
      const generator = ['preview', 'base'].includes(flags.generator) ? flags.generator : 'preview';
      const match_limit = flags.limit ? Number(flags.limit) : generator === 'preview' ? 10 : 25;
      return { cmd, path: PATHS.findall, body: { objective: text, entity_type: flags.type ?? 'companies', match_conditions, generator, match_limit } };
    }
    case 'monitor': {
      if (!text) return { error: 'monitor needs a query (what to watch for)' };
      return { cmd, path: PATHS.monitor, body: { query: text, frequency: flags.weekly ? '1w' : '1d', ...(flags.label ? { label: flags.label } : {}), ...policy() } };
    }
    case 'monitors': return { cmd };
    case 'events': { const id = rest[0]; if (!/^monitor_[a-z0-9]{8,64}$/.test(id ?? '')) return { error: 'events needs a monitor id (monitor_…)' }; return { cmd, id, ...(flags.group ? { group: flags.group } : {}) }; }
    default: return { error: `usage:\n${USAGE}` };
  }
}
/** Dollars spent today from the usage log, and whether `price` still fits under `cap`. */
export function budget(entries, price, cap = DEFAULT_DAILY_USD, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const spent = entries.filter((e) => e && String(e.at).slice(0, 10) === day).reduce((s, e) => s + Number(e.usd ?? 0), 0);
  const ok = spent + Number(price) <= cap + 1e-9;
  return { spent: +spent.toFixed(4), cap, ok, left: +(cap - spent).toFixed(4) };
}
