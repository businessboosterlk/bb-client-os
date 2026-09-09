#!/usr/bin/env node
/* Copies casts/*.json into the Angular app's public folder so the static build on
 * GitHub Pages can load a cast without the API. One source of truth, two readers. */
import { readdir, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const src = path.resolve('casts'), dst = path.resolve('apps/web/public/casts');
await mkdir(dst, { recursive: true });
let n = 0;
for(const f of (await readdir(src)).filter(f => f.endsWith('.json'))){ await copyFile(path.join(src, f), path.join(dst, f)); n++; }
console.log(`synced ${n} cast(s) to apps/web/public/casts`);
