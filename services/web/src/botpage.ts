/** Public documentation for the agent as a bot operator: what it is, how it identifies itself, how to block it. Required by Cloudflare's verified-bots review. */
export function renderBotPage(o: { host: string; name: string; userAgent: string; email: string; x: string }): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const dir = `https://${o.host}/.well-known/http-message-signatures-directory`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.name)} · bot documentation</title>
<style>:root{--bg:#f6f5f1;--ink:#1d1f23;--mute:#6b6f76;--line:#dcdad3;--acc:#3b4cca}@media(prefers-color-scheme:dark){:root{--bg:#15171b;--ink:#e8e6df;--mute:#9a9ea6;--line:#2c3037;--acc:#8c98f0}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 ui-sans-serif,system-ui,sans-serif;padding:24px 16px 64px}main{max-width:720px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 6px}h2{font-size:1rem;margin:28px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
code,pre{font-family:ui-monospace,monospace;font-size:.9rem}pre{background:rgba(127,127,127,.08);padding:12px;border-radius:6px;overflow-x:auto}a{color:var(--acc)}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--mute);font-weight:500;width:11em}.disc{border-left:3px solid var(--acc);padding:8px 12px;color:var(--mute)}</style></head><body><main>
<h1>${esc(o.name)}: bot documentation</h1>
<p class="disc">This page describes the automated client operated by Visybl Inc for its a9n9 agent 001, so that site owners can recognise it, verify it, rate-limit it or block it. The agent is software and says so on every channel.</p>
<h2>Identity</h2>
<table>
<tr><th>Operator</th><td>Visybl Inc (Frederick, Maryland, USA), a9n9 platform. Operator type: direct (one operator, one agent; no end-user traffic is relayed).</td></tr>
<tr><th>User agent</th><td><code>${esc(o.userAgent)}</code></td></tr>
<tr><th>Verification</th><td>Web Bot Auth (HTTP Message Signatures, RFC 9421, Ed25519). Every request carries <code>Signature-Input</code>, <code>Signature</code> and <code>Signature-Agent: "https://${esc(o.host)}"</code>. Public keys: <a href="${dir}">${esc(dir)}</a>. The same signatures follow Visa's Trusted Agent Protocol profile (tags <code>agent-browser-auth</code> and <code>agent-payer-auth</code>) where a merchant supports it.</td></tr>
<tr><th>Source addresses</th><td>Residential/business connection in the United States; addresses change. Verify by signature, not by IP.</td></tr>
<tr><th>Contact</th><td><a href="mailto:${esc(o.email)}">${esc(o.email)}</a> (read by the agent and its human operator) · <a href="https://x.com/${esc(o.x)}">@${esc(o.x)}</a></td></tr>
</table>
<h2>Purpose and behaviour</h2>
<ul>
<li><strong>Category: Agent.</strong> It fetches public pages and APIs to answer questions it has been asked, to verify published figures (for example stablecoin issuer disclosures against on-chain data), and to deliver that evidence. It does not train models, index the web, or collect data for resale.</li>
<li><strong>Volume:</strong> low. Typically a few hundred requests a day across all sites, never more than one request per second to any single host, with retries backed off.</li>
<li><strong>robots.txt:</strong> honoured, including <code>crawl-delay</code> and disallow rules for <code>${esc(o.userAgent.split('/')[0]!)}</code> and <code>*</code>.</li>
<li><strong>No evasion:</strong> no rotating proxies, no spoofed user agents, no CAPTCHA solving. If a site blocks the agent, it stops.</li>
<li><strong>Receipts:</strong> every action the agent takes is written to a public ledger at <a href="https://${esc(o.host)}">${esc(o.host)}</a>, hashed daily; writing the hash to the Tempo blockchain is coming.</li>
</ul>
<h2>How to block or limit it</h2>
<pre>User-agent: ${esc(o.userAgent.split('/')[0]!)}
Disallow: /</pre>
<p>Or match the user agent, or reject requests whose <code>Signature-Agent</code> is <code>"https://${esc(o.host)}"</code>. Email <a href="mailto:${esc(o.email)}">${esc(o.email)}</a> and the agent will add your site to its own deny list within a day.</p>
<h2>Verify a request yourself</h2>
<p>Fetch the key directory above, pick the key whose <code>kid</code> equals the <code>keyid</code> in <code>Signature-Input</code>, rebuild the signature base over the covered components (at least <code>@authority</code> and <code>signature-agent</code>), and verify the Ed25519 signature. Reject if <code>expires</code> has passed or <code>created</code> to <code>expires</code> spans more than 8 minutes. A reference verifier accepts test requests at <code>https://${esc(o.host)}/verify</code>.</p>
</main></body></html>`;
}
