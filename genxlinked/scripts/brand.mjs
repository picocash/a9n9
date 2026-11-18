#!/usr/bin/env node
// Brand images: square logo (1024) and wordmark (1200x240) in the house palette, rendered with the theme's fonts.
import fs from 'node:fs';
import { chromium } from '../../node_modules/playwright-core/index.mjs';
const F = new URL('../theme/genxlinked/assets/fonts/gxl/', import.meta.url).pathname;
const font = (f) => `data:font/woff2;base64,${fs.readFileSync(F + f).toString('base64')}`;
const css = `@font-face{font-family:BSD;src:url('${font('BigShouldersDisplay-800-normal.woff2')}');font-weight:100 900}
@font-face{font-family:CP;src:url('${font('CourierPrime-700-normal.woff2')}');font-weight:700}
*{margin:0;box-sizing:border-box}body{background:#D9A441;color:#2B2622;position:relative;overflow:hidden}
body:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(43,38,34,.13) 2px,transparent 2.2px);background-size:16px 16px}`;
const logo = `<!doctype html><style>${css}
body{width:1024px;height:1024px;display:flex;align-items:center;justify-content:center}
.b{position:relative;width:820px;height:820px;border:22px solid #2B2622;background:#EFE3C8;box-shadow:28px 28px 0 #2F6F73;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 70px}
.a{font-family:BSD;font-weight:800;font-size:300px;line-height:.82;letter-spacing:-.01em}
.c{font-family:BSD;font-weight:800;font-size:236px;line-height:.9;color:#C1622D}
.d{font-family:CP;font-weight:700;font-size:40px;letter-spacing:.12em;margin-top:26px}</style>
<div class="b"><span class="a">GENX</span><span class="c">LINKED</span><span class="d">SAME YEAR. DIFFERENT COUNTRY.</span></div>`;
const mark = `<!doctype html><style>${css}
body{width:1200px;height:240px;display:flex;align-items:center;padding:0 40px;gap:26px;background:#D9A441}
.a{font-family:BSD;font-weight:800;font-size:170px;line-height:1}.c{color:#C1622D}</style>
<span class="a">GENX <span class="c">LINKED</span></span>`;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const [name, html, w, h] of [['logo', logo, 1024, 1024], ['wordmark', mark, 1200, 240]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: new URL(`../brand/${name}.png`, import.meta.url).pathname }); await p.close();
}
await b.close(); console.log('ok');
