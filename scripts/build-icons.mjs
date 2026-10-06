#!/usr/bin/env node
/* EVERY ICON IN THE HUB COMES FROM A LICENSED SET. NOBODY DRAWS ONE BY HAND.
     line icons   Lucide (ISC), read from the lucide-static package
     brand marks  Simple Icons (CC0), the companies' own glyphs
   Until 28 Sep 2026 the Hub carried 38 icons typed as path data, and "Your business" wore a clock.
   This writes apps/web/src/app/ui/icons.generated.ts and the icon component only reads that file.
     node scripts/build-icons.mjs           write
     node scripts/build-icons.mjs --check   exit 1 when the file differs from what the packages produce */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const PKG = process.env.HOME + '/bb-websites/bswl/node_modules/';
const FILE = new URL('../apps/web/src/app/ui/icons.generated.ts', import.meta.url).pathname;
const LINE = {                       /* the Hub's name      Lucide's file */
  home: 'house', video: 'video', post: 'image', doc: 'file-text', brain: 'building-2',
  dash: 'layout-dashboard', inbox: 'inbox', pipe: 'square-kanban', users: 'users', user: 'user',
  search: 'search', plus: 'plus', x: 'x', chev: 'chevron-right', chevd: 'chevron-down', back: 'chevron-left',
  check: 'check', clock: 'clock', phone: 'phone', msg: 'message-square', meet: 'calendar', note: 'sticky-note',
  quote: 'file-text', trend: 'trending-up', money: 'circle-dollar-sign', flame: 'flame', alert: 'triangle-alert',
  lock: 'lock', board: 'columns-3', list: 'list', menu: 'menu', out: 'log-out', grid: 'layout-grid',
  ext: 'external-link', trash: 'trash-2', edit: 'pencil', sun: 'sun', moon: 'moon',
  filter: 'sliders-horizontal', offline: 'wifi-off', more: 'ellipsis', refresh: 'refresh-cw', share: 'share', play: 'play', smartphone: 'smartphone'
};
const BRAND = { wa: 'whatsapp' };
const inner = svg => svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>.*?<\/title>/, '').replace(/\s*\n\s*/g, '').replace(/\s+\/>/g, '/>').trim();
const ver = p => JSON.parse(readFileSync(PKG + p + '/package.json', 'utf8')).version;
const line = Object.fromEntries(Object.entries(LINE).map(([k, f]) => [k, inner(readFileSync(PKG + 'lucide-static/icons/' + f + '.svg', 'utf8'))]));
const brand = Object.fromEntries(Object.entries(BRAND).map(([k, f]) => [k, inner(readFileSync(PKG + 'simple-icons/icons/' + f + '.svg', 'utf8'))]));
const next = `/* WRITTEN BY scripts/build-icons.mjs. NEVER EDIT BY HAND.
   line: lucide-static ${ver('lucide-static')} (ISC) · brand: simple-icons ${ver('simple-icons')} (CC0-1.0) */
export const LINE: Record<string, string> = ${JSON.stringify(line, null, 1)};
export const BRAND: Record<string, string> = ${JSON.stringify(brand, null, 1)};
`;
if (process.argv.includes('--check')) {
  if (!existsSync(FILE) || readFileSync(FILE, 'utf8') !== next) { console.error('FAIL  icons.generated.ts does not match the icon packages. An icon was edited by hand or the packages changed. Run: node scripts/build-icons.mjs'); process.exit(1); }
  console.log(`PASS  icons match the packages: ${Object.keys(line).length} line, ${Object.keys(brand).length} brand`);
} else { writeFileSync(FILE, next); console.log(`wrote ${Object.keys(line).length} line and ${Object.keys(brand).length} brand icons`); }
