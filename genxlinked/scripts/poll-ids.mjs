#!/usr/bin/env node
// Write poll/allowed.json: every ::: poll and ::: quiz id in drafts/*.md (the vote counter refuses any other id).
import fs from 'node:fs';
const dir = new URL('../drafts/', import.meta.url), ids = new Set();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) for (const m of fs.readFileSync(new URL(f, dir), 'utf8').matchAll(/^:::[ \t]*(?:poll|quiz)[ \t]*\n[\s\S]*?^id:\s*([a-z0-9-]{3,64})\s*$/gm)) ids.add(m[1]);
fs.writeFileSync(new URL('../poll/allowed.json', import.meta.url), JSON.stringify([...ids].sort(), null, 1));
console.log(ids.size, 'ids');
