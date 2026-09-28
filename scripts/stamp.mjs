#!/usr/bin/env node
/* THE BUILD STAMP. An installed app keeps its first copy, so every build carries a stamp in the app
   (core/build.ts) and the same stamp in a small file beside it (public/version.json). The app reads
   the small file when it opens and when it comes back to the front and reloads itself once when the
   two differ. Both files are written together, here, and published together.
     node scripts/stamp.mjs            write a new stamp (Colombo time)
     node scripts/stamp.mjs --check    exit 1 when the two files disagree */
import { readFileSync, writeFileSync } from 'node:fs';
const TS = new URL('../apps/web/src/app/core/build.ts', import.meta.url).pathname;
const JS = new URL('../apps/web/public/version.json', import.meta.url).pathname;
if (process.argv.includes('--check')) {
  const a = (readFileSync(TS, 'utf8').match(/BUILD = '([^']+)'/) || [])[1], b = JSON.parse(readFileSync(JS, 'utf8')).build;
  if (!a || a !== b) { console.error(`FAIL  build stamps disagree: app ${a}, version file ${b}`); process.exit(1); }
  console.log('PASS  one build stamp in the app and in the version file: ' + a); process.exit(0);
}
const d = new Date(Date.now() + 5.5 * 3600e3).toISOString();   /* Colombo is UTC+5:30 */
const stamp = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : d.slice(0, 10) + ' ' + d.slice(11, 16);
writeFileSync(TS, `/* WRITTEN BY scripts/stamp.mjs. NEVER EDIT BY HAND. */\nexport const BUILD = '${stamp}';\n`);
writeFileSync(JS, JSON.stringify({ build: stamp }) + '\n');
console.log('stamped ' + stamp);
