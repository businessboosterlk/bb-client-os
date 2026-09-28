#!/usr/bin/env node
/* Runs the Hub's own ?selftest on the door and inside the shell, on a phone and on a desk, and
   prints every line. node scripts/selftest-run.mjs      exits 1 on any failed line */
import { chromium, serve, context, signIn } from './lib/world.mjs';
/* walked at the address it is published under: a folder, not the root of a server */
const { srv, base: root } = serve(); const base = root + 'bb-client-os/'; const b = await chromium.launch(); let bad = 0, total = 0;
for (const [tag, opt] of [['phone', {}], ['desk', { desk: true, width: 1440 }]]) {
  const c = await context(b, { ...opt, seed: null }); const p = await c.newPage(); const lines = [];
  p.on('console', m => { const t = m.text(); if (/^(PASS|FAIL|BBOS SELFTEST)/.test(t)) lines.push(t); });
  const run = async (name, url) => { lines.length = 0; await p.goto('about:blank'); await p.goto(url); await p.waitForFunction(() => window.__bbos, null, { timeout: 60000 }); const r = await p.evaluate(() => window.__bbos); total += r.total; bad += r.total - r.pass; console.log(`--- ${tag} · ${name}: ${r.pass}/${r.total}`); lines.filter(l => /^FAIL/.test(l)).forEach(l => console.log('  ' + l)); };
  await run('door', base + '?selftest');
  await signIn(p, base);
  await run('launcher', base + '?selftest#/start');
  await run('dashboard', base + '?selftest#/sales/dashboard');
  await run('pipeline', base + '?selftest#/sales/pipeline');
  await c.close();
}
await b.close(); srv.close();
console.log(bad ? `RESULT: ${bad} of ${total} self test lines failed` : `RESULT: ALL ${total} SELF TEST LINES PASS`); process.exit(bad ? 1 : 0);
