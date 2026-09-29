import { chromium } from '/Users/thulaibhassen/bb-systems/bb-client-os/scripts/lib/world.mjs';
import { AUDIT } from '/Users/thulaibhassen/bb-systems/bb-client-os/scripts/lib/audit.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 700 } });
const card = 'background:#fff;border:1px solid #ddd;border-radius:12px;padding:16px;width:120px;margin:20px';
const page = inner => `<body style="margin:0;background:#eee;font:14px system-ui"><div class="main">${inner}</div></body>`;
const cases = [
  ['a figure that runs past its tile', `<div style="${card}"><div style="font-size:26px;white-space:nowrap">LKR 378,000</div></div>`, /TEXT PAST THE EDGE/],
  ['a line cut with no mark', `<div style="${card};overflow:hidden"><strong style="display:block;white-space:nowrap">Enquiry from Kavinda Rathnayake, WhatsApp</strong></div>`, /TEXT CUT WITH NO MARK/],
  ['a line cut WITH its mark is allowed', `<div style="${card};overflow:hidden"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Enquiry from Kavinda Rathnayake, WhatsApp</strong></div>`, null],
  ['a figure that fits is allowed', `<div style="${card}"><div style="font-size:18px;white-space:nowrap">378,000</div></div>`, null]];
let bad = 0;
for (const [name, html, want] of cases) { await p.setContent(page(html)); const hits = (await p.evaluate(AUDIT)).filter(h => /TEXT (PAST|CUT)/.test(h)); const ok = want ? hits.some(h => want.test(h)) : hits.length === 0; if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + name + '  [saw: ' + (hits.join(' ; ') || 'nothing') + ']'); }
await b.close(); process.exit(bad ? 1 : 0);
