#!/usr/bin/env node
/* Puts a client on the Hub, or updates one, through the API's BB door.
     node scripts/onboard.mjs casts/private/clove-beach.json --group https://chat.whatsapp.com/XXXX
     node scripts/onboard.mjs casts/private/clove-beach.json --rotate "Owner" "Front desk"
   Env: HUB_API=https://<railway address>  BB_ADMIN_SECRET=<secret>  (never in a committed file)
   A new client gets two seat codes, printed ONCE. An existing client keeps its codes unless
   --rotate is passed, so updating settings never locks a team out. --group sets the client's
   WhatsApp group invite; it is stored only on the server, never in this repo. */
import { readFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const file = args.find(a => a.endsWith('.json'));
const gi = args.indexOf('--group'); const group = gi >= 0 ? args[gi + 1] : undefined;
const rotate = args.includes('--rotate');
const labels = args.filter((a, i) => a !== file && a !== '--rotate' && a !== '--group' && i !== gi + 1);
if (!file) { console.error('usage: node scripts/onboard.mjs casts/private/<slug>.json [--group <invite link>] [--rotate] [seat label] [seat label]'); process.exit(1); }
const api = process.env.HUB_API, secret = process.env.BB_ADMIN_SECRET;
if (!api || !secret) { console.error('set HUB_API and BB_ADMIN_SECRET in the environment'); process.exit(1); }
const cast = JSON.parse(await readFile(file, 'utf8'));
const res = await fetch(`${api.replace(/\/$/, '')}/api/bb/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BB-Admin': secret },
  body: JSON.stringify({ slug: cast.slug, name: cast.name, aliases: cast.aliases || [], cast, seats: labels, rotate, group }) });
const j = await res.json();
if (!res.ok) { console.error('FAILED', res.status, j); process.exit(1); }
console.log(`\n${cast.name} is on the Hub. They type any of: ${j.aliases.join(', ')}`);
console.log(`WhatsApp button opens: ${j.group ? 'their group' : 'Business Booster directly (no group link set)'}`);
if (j.rotated) { console.log('\nSeat codes, shown once:'); for (const s of j.seats) console.log(`  ${s.label.padEnd(12)} ${s.code}`); console.log('\nRun with --rotate to issue a fresh pair (the old pair stops working).\n'); }
else console.log('Codes unchanged.\n');
