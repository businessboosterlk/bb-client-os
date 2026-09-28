#!/usr/bin/env node
/* READ THE LIVE FILES BACK. After a publish, every file in the tested build is fetched from the live
   address and its hash is compared with the file on disk. A publish that "succeeded" is a claim.
   A hash that matches is evidence.
     node scripts/verify-live.mjs [live-base-url]      exits 1 on any difference */
import fs from 'node:fs'; import path from 'node:path'; import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))), DIST = path.join(ROOT, 'apps/web/dist/web/browser');
const LIVE = (process.argv[2] || 'https://businessboosterlk.github.io/bb-client-os/').replace(/\/?$/, '/');
const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16);
const files = (d => { const out = []; const walk = x => fs.readdirSync(x, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(x, e.name)) : out.push(path.relative(d, path.join(x, e.name)))); walk(d); return out.sort(); })(DIST);
const want = JSON.parse(fs.readFileSync(path.join(DIST, 'version.json'), 'utf8')).build;
/* GitHub Pages takes a minute or two to serve a push: wait for the new stamp before comparing */
let live = ''; for (let i = 0; i < 40; i++) { try { live = (await (await fetch(LIVE + 'version.json?t=' + Date.now(), { cache: 'no-store' })).json()).build; } catch {} if (live === want) break; await new Promise(z => setTimeout(z, 6000)); }
if (live !== want) { console.log(`FAIL  the live site still serves build ${live || 'nothing'}, the tested build is ${want}`); process.exit(1); }
let bad = 0; const rows = [];
for (const f of files) {
  const local = sha(fs.readFileSync(path.join(DIST, f)));
  const r = await fetch(LIVE + f.split(path.sep).map(encodeURIComponent).join('/') + '?t=' + Date.now(), { cache: 'no-store' });
  const remote = r.ok ? sha(Buffer.from(await r.arrayBuffer())) : 'HTTP ' + r.status;
  const ok = local === remote; if (!ok) bad++; rows.push(`${ok ? 'same ' : 'DIFF '} ${local}  ${remote.padEnd(16)}  ${f}`);
}
console.log(rows.join('\n'));
console.log(bad ? `FAIL  ${bad} of ${files.length} live files differ from the tested build` : `PASS  all ${files.length} live files match the tested build ${want}, byte for byte, at ${LIVE}`);
process.exit(bad ? 1 : 0);
