#!/usr/bin/env node
/* Puts a client on the Hub: sends a cast file to the API's BB door, gets two seat codes
   back ONCE. Usage:
     HUB_API=https://<railway-url> BB_ADMIN_SECRET=<secret> node scripts/onboard.mjs casts/clove-beach.json "Owner" "Team"
   The codes print here and nowhere else. Hand them over by voice or a private message. */
import { readFile } from 'node:fs/promises';
const [file, ...labels] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/onboard.mjs casts/<slug>.json [seat label] [seat label]'); process.exit(1); }
const api = process.env.HUB_API, secret = process.env.BB_ADMIN_SECRET;
if (!api || !secret) { console.error('set HUB_API and BB_ADMIN_SECRET in the environment (never in a file that is committed)'); process.exit(1); }
const cast = JSON.parse(await readFile(file, 'utf8'));
const res = await fetch(`${api.replace(/\/$/, '')}/api/bb/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BB-Admin': secret },
  body: JSON.stringify({ slug: cast.slug, name: cast.name, aliases: cast.aliases || [], cast, seats: labels.length ? labels : ['Owner', 'Team'] }) });
const j = await res.json();
if (!res.ok) { console.error('FAILED', res.status, j); process.exit(1); }
console.log(`\n${cast.name} is on the Hub.\nThey type any of: ${j.aliases.join(', ')}\n`);
for (const s of j.seats) console.log(`  ${s.label.padEnd(8)} ${s.code}`);
console.log('\nThese codes are shown once. Run this again to issue a fresh pair (the old pair stops working).\n');
