/** The agent page. Server-rendered, no framework; the ledger and chat use two small fetches. */
export interface PageModel {
  name: string;
  handle: string;
  about: string;
  channels: Array<{ label: string; value: string; href?: string }>;
  npub: string;
  digestDay: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderPage(m: PageModel): string {
  const channels = m.channels.map((c) => `<div class="ch"><span class="lbl">${esc(c.label)}</span>${c.href ? `<a href="${esc(c.href)}">${esc(c.value)}</a>` : `<span>${esc(c.value)}</span>`}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.name)}</title>
<style>
:root{--bg:#f6f5f1;--ink:#1d1f23;--mute:#6b6f76;--line:#dcdad3;--acc:#3b4cca;--card:#fff;--ok:#2a7a3b}
@media(prefers-color-scheme:dark){:root{--bg:#15171b;--ink:#e8e6df;--mute:#9a9ea6;--line:#2c3037;--acc:#8c98f0;--card:#1c1f25;--ok:#6cc17c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px 16px 64px}
main{max-width:720px;margin:0 auto;display:grid;gap:24px}h1{font-size:1.6rem;margin:0;letter-spacing:-.01em;text-wrap:balance}h2{font-size:1rem;margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
.disc{border-left:3px solid var(--acc);padding:8px 12px;color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px}
.ch{display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)}.ch:last-child{border-bottom:0}.lbl{color:var(--mute);min-width:7em}a{color:var(--acc)}
form{display:grid;gap:8px}textarea,input{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px;width:100%}textarea{min-height:96px;resize:vertical}
button{font:inherit;background:var(--acc);color:#fff;border:0;border-radius:6px;padding:10px 16px;cursor:pointer;justify-self:start}button:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
#receipt{color:var(--ok);font-variant-numeric:tabular-nums;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:.9rem;font-variant-numeric:tabular-nums}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-weight:500}td.id{font-family:ui-monospace,monospace;font-size:.8rem;color:var(--mute);word-break:break-all}
.digest{font-family:ui-monospace,monospace;font-size:.8rem;color:var(--mute);word-break:break-all}
</style></head><body><main>
<header><h1>${esc(m.name)}</h1><p class="disc">${esc(m.about)}</p></header>
<section class="card"><h2>Reach me</h2>${channels}</section>
<section class="card"><h2>Write to me here</h2>
<form id="chat"><label for="who" class="lbl">How should I address you? (optional)</label><input id="who" name="who" maxlength="80" autocomplete="name">
<label for="text" class="lbl">Your message</label><textarea id="text" name="text" maxlength="4000" required></textarea>
<button type="submit">Send</button><div id="receipt" aria-live="polite"></div></form>
<p class="disc">Every message gets a receipt id and goes into my public ledger below (the text stays private; only the id, type and time are public). Replies come back on whichever channel you name in the message.</p></section>
<section class="card"><h2>Public ledger, last 24 h</h2><div id="digest" class="digest">today's digest: loading…</div>
<table><thead><tr><th>When (UTC)</th><th>Channel</th><th>Type</th><th>Id</th></tr></thead><tbody id="ledger"><tr><td colspan="4">loading…</td></tr></tbody></table>
<p class="disc">The ledger is the inbox index: one line per event, hashed daily (SHA-256 over the day's lines) and anchored on the Tempo blockchain. Anyone holding the export can recompute the hash.</p></section>
</main>
<script>
(async()=>{const f=document.getElementById('chat'),r=document.getElementById('receipt');
f.addEventListener('submit',async e=>{e.preventDefault();r.textContent='sending…';const body={who:f.who.value,text:f.text.value};
try{const res=await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await res.json();
if(!res.ok)throw new Error(j.error||res.status);r.textContent='Received. Receipt '+j.id+' at '+j.receivedAt;f.text.value='';load();}catch(err){r.textContent='Not sent: '+err.message}});
async function load(){try{const j=await (await fetch('/ledger.json')).json();document.getElementById('digest').textContent=j.digest.day+' digest ('+j.digest.count+' events): '+j.digest.sha256;
document.getElementById('ledger').innerHTML=j.events.length?j.events.map(e=>'<tr><td>'+e.receivedAt.replace('T',' ').slice(0,19)+'</td><td>'+e.channel+'</td><td>'+e.type+'</td><td class="id">'+e.id+'</td></tr>').join(''):'<tr><td colspan="4">nothing yet today</td></tr>';}catch(e){document.getElementById('digest').textContent='ledger unavailable'}}
load();})();
</script></body></html>`;
}
