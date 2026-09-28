#!/usr/bin/env node
/* CONTACT SHEETS. A check is not an eye: every photograph the walk takes is laid out six to a
   sheet so a person can LOOK at all of them. node scripts/contact-sheet.mjs <gallery> [filter] */
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from './lib/world.mjs';
const dir = path.resolve(process.argv[2] || 'evidence/gallery'), filter = process.argv[3] || '';
const out = path.join(dir, 'sheets'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && f.includes(filter)).sort();
const desk = f => f.startsWith('desk'); const per = f => desk(f) ? 2 : 6;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1980, height: 1200 }, deviceScaleFactor: 1 });
let n = 0; for (const group of [files.filter(f => !desk(f)), files.filter(desk)]) {
  for (let i = 0; i < group.length; i += per(group[0] || '')) {
    const set = group.slice(i, i + per(group[0]));
    const html = path.join(out, '_sheet.html');
    fs.writeFileSync(html, `<body style="margin:0;background:#777;font:600 15px system-ui;display:flex;gap:12px;padding:12px;align-items:flex-start">${set.map(f => `<figure style="margin:0;flex:1;min-width:0"><figcaption style="color:#fff;padding:0 0 6px;white-space:nowrap;overflow:hidden">${f.replace('.png', '')}</figcaption><img src="../${f}" style="width:100%;display:block"></figure>`).join('')}</body>`);
    await p.setViewportSize({ width: 1980, height: 1200 }); await p.goto('file://' + html);
    await p.waitForLoadState('networkidle'); const broken = await p.evaluate(() => [...document.images].filter(i => !i.naturalWidth).length); if (broken) { console.error('FAIL ' + broken + ' photographs did not load into the sheet'); process.exit(1); }
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.setViewportSize({ width: 1980, height: Math.min(h, 1500) });
    await p.screenshot({ path: path.join(out, String(++n).padStart(2, '0') + '.png') });
  }
}
fs.rmSync(path.join(out, '_sheet.html'), { force: true });
await b.close(); console.log(n + ' sheets of ' + files.length + ' photographs in ' + out);
