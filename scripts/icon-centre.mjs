#!/usr/bin/env node
/* ICON CENTRE. Every icon is drawn by hand in a 24 unit frame and many were not drawn in its
   middle: the car sat 1.25 units low, the flame 2.6 (17 Sep 2026). This measures each drawing's
   box in a real browser and writes the offsets that put it on the frame's centre into
   ui/icon.component.ts, so every place an icon is used is centred at once.
     node scripts/icon-centre.mjs          rewrite the offsets table
     node scripts/icon-centre.mjs --check  exit 1 if any icon, with its offset, is off by a tenth of a unit */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const FILE = new URL('../apps/web/src/app/ui/icon.component.ts', import.meta.url).pathname;
const check = process.argv.includes('--check');
let src = readFileSync(FILE, 'utf8');
const P = {}; for (const m of src.matchAll(/^\s{2}(\w+): '(<[^']+)',?$/gm)) P[m[1]] = m[2];
const current = JSON.parse((src.match(/const OFFSETS: Record<string, \[number, number\]> = (\{[^;]*\});/) || [, '{}'])[1]);
const b = await chromium.launch(); const p = await b.newPage();
const boxes = await p.evaluate(P => { const out = {}; for (const [k, v] of Object.entries(P)) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = `<g>${v}</g>`; document.body.appendChild(s); const bb = s.firstChild.getBBox(); out[k] = [12 - (bb.x + bb.width / 2), 12 - (bb.y + bb.height / 2)]; s.remove(); } return out; }, P);
await b.close();
const r = v => Math.round(v * 100) / 100;
if (check) {
  const off = Object.entries(boxes).filter(([k, [dx, dy]]) => { const [ox, oy] = current[k] || [0, 0]; return Math.abs(dx - ox) > .1 || Math.abs(dy - oy) > .1; });
  console.log(off.length ? 'FAIL icons off centre: ' + off.map(([k, [dx, dy]]) => `${k} (${r(dx)}, ${r(dy)})`).join(', ') : `PASS all ${Object.keys(boxes).length} icons centred in their frame`);
  process.exit(off.length ? 1 : 0);
}
const table = Object.fromEntries(Object.entries(boxes).filter(([, [dx, dy]]) => Math.abs(dx) >= .05 || Math.abs(dy) >= .05).map(([k, [dx, dy]]) => [k, [r(dx), r(dy)]]));
const line = `const OFFSETS: Record<string, [number, number]> = ${JSON.stringify(table)};`;
src = /const OFFSETS: Record<string, \[number, number\]> = \{[^;]*\};/.test(src) ? src.replace(/const OFFSETS: Record<string, \[number, number\]> = \{[^;]*\};/, line) : src.replace("@Component({", `/* written by scripts/icon-centre.mjs: moves each drawing onto the centre of its 24 unit frame */\n${line}\n\n@Component({`);
writeFileSync(FILE, src); console.log(`offsets written for ${Object.keys(table).length} of ${Object.keys(boxes).length} icons`);
