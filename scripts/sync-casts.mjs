#!/usr/bin/env node
/* Copies casts/*.json into the Angular app's public folder and writes casts/index.json,
   the alias book the static door uses to turn "cinnamon.lk" into the demo cast. Seat
   codes never enter this index: static mode checks the cast PIN and says so on screen. */
import { readdir, readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const src = path.resolve('casts'), dst = path.resolve('apps/web/public/casts');
await mkdir(dst, { recursive: true });
const index = [];
for (const f of (await readdir(src)).filter(f => f.endsWith('.json'))) {
  await copyFile(path.join(src, f), path.join(dst, f));
  const c = JSON.parse(await readFile(path.join(src, f), 'utf8'));
  /* only a local-mode cast with a PIN may open from the static door; server clients open on the Hub server */
  if (c.data?.mode === 'local' && c.pin) index.push({ slug: c.slug, aliases: [c.slug, ...(c.aliases || [])] });
}
await writeFile(path.join(dst, 'index.json'), JSON.stringify(index));
console.log(`synced ${index.length} cast(s) and the alias index to apps/web/public/casts`);
