#!/usr/bin/env node
/* ICON CENTRE. Measures each drawing's box in a real browser and writes the offsets that put it on
   the centre of its 24 unit frame into ui/icon-offsets.generated.ts, so every place an icon is used
   is centred at once. The drawings themselves come from scripts/build-icons.mjs.
     node scripts/icon-centre.mjs          rewrite the offsets table
     node scripts/icon-centre.mjs --check  exit 1 if any icon, with its offset, is off by a tenth of a unit */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const SRC = new URL('../apps/web/src/app/ui/icons.generated.ts', import.meta.url).pathname;
const FILE = new URL('../apps/web/src/app/ui/icon-offsets.generated.ts', import.meta.url).pathname;
const check = process.argv.includes('--check');
const gen = readFileSync(SRC, 'utf8');
const pick = n => JSON.parse((gen.match(new RegExp('export const ' + n + ': Record<string, string> = (\\{[\\s\\S]*?\\n\\});')) || [, '{}'])[1]);
const P = { ...pick('LINE'), ...pick('BRAND') };
if (Object.keys(P).length < 20) { console.error('FAIL icon centre found only ' + Object.keys(P).length + ' icons: it is reading the wrong file'); process.exit(1); }
const current = existsSync(FILE) ? JSON.parse((readFileSync(FILE, 'utf8').match(/OFFSETS: Record<string, \[number, number\]> = (\{[^;]*\});/) || [, '{}'])[1]) : {};
const b = await chromium.launch(); const p = await b.newPage();
/* a stroke has width: the ink box is the geometry box grown by half the stroke on every side, which
   moves nothing, so the geometry box is the right thing to centre */
const boxes = await p.evaluate(P => { const out = {}; for (const [k, v] of Object.entries(P)) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = `<g>${v}</g>`; document.body.appendChild(s); const bb = s.firstChild.getBBox(); out[k] = [12 - (bb.x + bb.width / 2), 12 - (bb.y + bb.height / 2), bb.width]; s.remove(); } return out; }, P);
/* THE AIR each drawing carries at its side, in units of the 24 frame, once it sits on the centre.
   A line is drawn 1.8 wide, so its ink reaches 0.9 past its geometry; a brand mark is filled to its
   edge. An icon that leads a word gives exactly this air back, so the pair sits on the centre of its
   button whichever icon it is. One number for every icon was right for the plus and wrong for the rest. */
const BRANDS = Object.keys(pick('BRAND'));
const air = Object.fromEntries(Object.entries(boxes).map(([k, [, , w]]) => [k, Math.max(0, Math.round(((24 - w) / 2 - (BRANDS.includes(k) ? 0 : .9)) * 100) / 100)]));
await b.close();
const r = v => Math.round(v * 100) / 100;
if (check) {
  const airNow = existsSync(FILE) ? JSON.parse((readFileSync(FILE, 'utf8').match(/AIR: Record<string, number> = (\{[^;]*\});/) || [, '{}'])[1]) : {};
  const off = Object.entries(boxes).filter(([k, [dx, dy]]) => { const [ox, oy] = current[k] || [0, 0]; return Math.abs(dx - ox) > .1 || Math.abs(dy - oy) > .1 || Math.abs((airNow[k] ?? -9) - air[k]) > .05; });
  console.log(off.length ? 'FAIL icons off centre: ' + off.map(([k, [dx, dy]]) => `${k} (${r(dx)}, ${r(dy)})`).join(', ') : `PASS all ${Object.keys(boxes).length} icons centred in their frame`);
  process.exit(off.length ? 1 : 0);
}
const table = Object.fromEntries(Object.entries(boxes).filter(([, [dx, dy]]) => Math.abs(dx) >= .05 || Math.abs(dy) >= .05).map(([k, [dx, dy]]) => [k, [r(dx), r(dy)]]));
writeFileSync(FILE, `/* WRITTEN BY scripts/icon-centre.mjs. NEVER EDIT BY HAND.\n   OFFSETS moves each drawing onto the centre of its 24 unit frame. AIR is the empty space left at its side. */\nexport const OFFSETS: Record<string, [number, number]> = ${JSON.stringify(table)};\nexport const AIR: Record<string, number> = ${JSON.stringify(air)};\n`);
console.log(`offsets written for ${Object.keys(table).length} of ${Object.keys(boxes).length} icons`);
