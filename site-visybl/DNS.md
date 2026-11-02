# visybl.com DNS as captured on 2026-11-02 (before moving the zone to Cloudflare)

Authoritative: Google Cloud DNS (ns-cloud-e1..e4.googledomains.com). Recreate every record below in the Cloudflare zone before switching nameservers, or mail stops.

| Name | Type | Value | Note |
|---|---|---|---|
| visybl.com | MX 1 | aspmx.l.google.com | Google Workspace mail |
| visybl.com | MX 5 | alt1.aspmx.l.google.com | |
| visybl.com | MX 5 | alt2.aspmx.l.google.com | |
| visybl.com | MX 10 | alt3.aspmx.l.google.com | |
| visybl.com | MX 10 | alt4.aspmx.l.google.com | |
| visybl.com | TXT | `v=spf1 include:_spf.google.com ~all` | SPF |
| visybl.com | TXT | `google-site-verification=P-n49io8NxbJ80tFmY4sxrgWNglNZdwqpXN9Wh3LtTw` | Search Console / Workspace |
| mail, calendar, docs, drive, sites | CNAME | ghs.googlehosted.com | Workspace shortcuts, DNS only (grey cloud) |
| www | CNAME | ext-sq.squarespace.com | OLD: Squarespace site that 301s to plebai.com. Replace with the tunnel CNAME |
| visybl.com | AAAA | 2001:4860:4802:3x::15 | OLD: Google Domains forwarding. Do not recreate |

Not present today (worth adding in Cloudflare): `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:arun@visybl.com`; a DKIM record from Google Workspace admin if Gmail signing is enabled.

New records once the zone is on Cloudflare (added by the Mac session's tunnel tooling): `visybl.com` and `www` → CNAME to the home-30 tunnel, proxied, ingress `http://10.0.1.101:8890` (nginx container `a9n9-visybl-site`).
