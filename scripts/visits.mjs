#!/usr/bin/env node
/* EVERY TIME THEY OPENED IT. Reads a client's visit events through BB's door and prints one line per
   VISIT (events less than 30 minutes apart are one visit), newest first: when, where it came from,
   what was looked at. Unprompted visits (not from the monthly message, not from BB) are marked, and
   the count at the foot is what December is decided on. Counts, never percentages.
     HUB_API=https://... BB_ADMIN_SECRET=... node scripts/visits.mjs <slug> */
const slug = process.argv[2]; const api = process.env.HUB_API, key = process.env.BB_ADMIN_SECRET;
if (!slug || !api || !key) { console.error('usage: HUB_API=... BB_ADMIN_SECRET=... node scripts/visits.mjs <slug>'); process.exit(1); }
const rows = [];
for (let off = 0; off < 100000; off += 500) {
  const r = await fetch(`${api.replace(/\/$/, '')}/api/bb/events?slug=${slug}&limit=500&offset=${off}`, { headers: { 'X-BB-Admin': key } });
  if (!r.ok) { console.error('FAILED', r.status, await r.text()); process.exit(1); }
  const page = await r.json(); rows.push(...page); if (page.length < 500) break;
}
rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const visits = []; const GAP = 30 * 60000;
for (const e of rows) { const v = visits[visits.length - 1]; if (v && new Date(e.createdAt) - new Date(v.last) < GAP) { v.last = e.createdAt; v.events.push(e); } else visits.push({ first: e.createdAt, last: e.createdAt, src: e.src || 'direct', events: [e] }); }
const when = iso => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
for (const v of [...visits].reverse()) {
  const mins = Math.max(1, Math.round((new Date(v.last) - new Date(v.first)) / 60000));
  const looked = v.events.filter(e => e.what === 'view').map(e => e.detail), opened = v.events.filter(e => e.what === 'tap').map(e => e.detail);
  const tag = v.src === 'bb' ? 'BB' : v.src === 'wa' ? 'from the message' : 'UNPROMPTED';
  console.log(`${when(v.first)}  ${String(mins).padStart(3)} min  ${tag.padEnd(16)} ${v.events[0].by || ''}  looked at: ${[...new Set(looked)].join(', ') || 'home'}${opened.length ? '  opened: ' + opened.join(' | ') : ''}`);
}
const client = visits.filter(v => v.src !== 'bb'), unprompted = client.filter(v => v.src !== 'wa'), older = rows.filter(e => e.what === 'tap' && e.src !== 'bb').length;
console.log(`\n${slug}: ${client.length} client visits (${unprompted.length} unprompted, ${client.length - unprompted.length} from the message), ${visits.length - client.length} by BB, ${older} files opened. Distinct days with an unprompted visit: ${new Set(unprompted.map(v => v.first.slice(0, 10))).size}.`);
