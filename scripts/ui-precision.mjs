#!/usr/bin/env node
/* UI PRECISION for the Hub: every glyph that is meant to sit in the centre of its shape is measured
   by its INK, in dark and light, on a 390px phone at 3x and a 1440px desk at 2x. Cast from the
   Workshop OS runner (17 Sep 2026), where "6 of 10" sat 6.5px high in a ring while every harness
   was green. The measuring itself lives in ~/bb-systems/qa/optical.mjs, one copy for every system.

   node scripts/ui-precision.mjs [--all]     exits 1 on any miss or any reading it could not find
   It serves the build in apps/web/dist itself and walks the real door.
   The check proves itself first on a fixture: centred must read 0, moved 3px must read 3.
   Also runs icon-centre --check, because an icon drawn off centre is off centre everywhere. */
import { report, measure } from '/Users/thulaibhassen/bb-systems/qa/optical.mjs';
import { execFileSync } from 'node:child_process';
import { chromium, serve, context, signIn } from './lib/world.mjs';
const TOL = 0.5;   /* shapes and icons; anything with text gets one device pixel more, see optical.mjs */
const { srv, base } = serve(); const b = await chromium.launch(); let bad = 0, total = 0; const out = [];

/* 0. icons drawn on the centre of their frame, and drawn by the licensed sets */
for (const s of ['icon-centre.mjs', 'build-icons.mjs']) {
  try { out.push(execFileSync('node', [new URL('./' + s, import.meta.url).pathname, '--check'], { encoding: 'utf8' }).trim()); }
  catch (e) { out.push(String(e.stdout || e.stderr || e.message).trim()); bad++; }
  total++;
}
/* 1. the check, proven both ways */
{ const p = await (await b.newContext({ deviceScaleFactor: 3 })).newPage();
  const fx = (shift) => `<div style="width:120px;height:120px;border-radius:50%;background:#16161a;display:grid;place-items:center;margin:20px"><div style="width:30px;height:30px;background:#c9dd2b;transform:translate(0,${shift}px)"></div></div>`;
  await p.setContent(`<body style="margin:0;background:#fff"><div id="a">${fx(0)}</div><div id="b">${fx(3)}</div></body>`);
  const a = await measure(p, '#a > div', { shape: 'circle', inset: 6 }), m = await measure(p, '#b > div', { shape: 'circle', inset: 6 });
  const ok = Math.abs(a.dy) < .2 && Math.abs(m.dy - 3) < .2;
  out.push(`${ok ? 'PASS' : 'FAIL'}  the check itself: centred reads ${a.dy}, moved 3px reads ${m.dy}`); if (!ok) bad++; total++;
  await p.context().close(); }

/* what is meant to be centred, screen by screen. open: a step taken before the reading. */
const tabs = [0, 1, 2, 3, 4].map(i => ({ name: `tab bar icon ${i + 1}`, sel: '.bm-btn', index: i, inset: 6, desk: false, hide: '.dot' }));
const plan = [
  /* the library home and the Videos screen (6 Oct 2026): the lead card's glyph, the row icon tiles, the lead film's play */
  ['/library/month', [
    { name: 'lead card icon in its tile', sel: '.lead-ic', inset: 2 },
    { name: 'library row icon tile: Videos', sel: '.list .li .ic', index: 0, inset: 2 },
    { name: 'library row icon tile: Your business', sel: '.list .li .ic', index: 3, inset: 2 },
    { name: 'library search icon in its field', sel: '.lib-q bb-icon', inset: 1 } ]],
  ['/library/videos', [
    { name: 'the lead film play glyph in its circle', sel: '.feat-play', shape: 'circle', inset: 2 } ]],
  ['/sales/pipeline?view=board', [
    { name: 'rail badge number: Enquiries', text: true, sel: '.rail .nb', index: 0, inset: 1, phone: false, baseline: true },
    { name: 'rail badge number: Pipeline', text: true, sel: '.rail .nb', index: 1, inset: 1, phone: false, baseline: true },
    { name: 'rail badge number: Tasks', text: true, sel: '.rail .nb', index: 2, inset: 1, phone: false, baseline: true },
    { name: 'rail avatar initial', text: true, sel: '.r-foot .avatar', shape: 'circle', inset: 1, phone: false, baseline: true },
    { name: 'rail client initial', text: true, sel: '.r-mono', inset: 1, phone: false, baseline: true },
    { name: 'board count pill: first stage', text: true, sel: '.col-n', index: 0, inset: 1, baseline: true },
    { name: 'board count pill: second stage', text: true, sel: '.col-n', index: 1, inset: 1, baseline: true },
    { name: 'Board switch, icon and word', text: true, sel: '.seg button', index: 0, inset: 3 },
    { name: 'List switch, icon and word', text: true, sel: '.seg button', index: 1, inset: 3 },
    { name: 'New deal, icon and word', text: true, sel: '[data-act="deal-new"]', inset: 3 },
    { name: 'WhatsApp in the topbar, icon and word', text: true, sel: '.topbar .btn.wa', inset: 3, phone: false },
    { name: 'WhatsApp in the topbar, icon only', sel: '.topbar .btn.wa', inset: 3, desk: false },
    { name: 'theme button icon', sel: '.topbar .x.theme', inset: 4 },
    { name: 'menu button icon', sel: '.topbar .x.hamb', inset: 4, desk: false },
    { name: 'Filters button, icon and word', text: true, sel: '[data-act="filter-open"]', inset: 3, desk: false },
    ...tabs ]],
  ['/sales/enquiries?view=list', [
    { name: 'New enquiry, icon and word', text: true, sel: '[data-act="enquiry-new"]', inset: 3, baseline: true },
    { name: 'table avatar initial', text: true, sel: 'table.tbl .avatar', shape: 'circle', inset: 1, phone: false, baseline: true },
    { name: 'list avatar initial', text: true, sel: '.list.phone .avatar', shape: 'circle', inset: 1, desk: false, baseline: true },
    { name: 'status pill in a list row', text: true, sel: '.list.phone .pill', inset: 1, desk: false, baseline: true } ]],
  ['/sales/customers', [
    { name: 'customer table avatar initial', text: true, sel: 'table.tbl .avatar', shape: 'circle', inset: 1, phone: false, baseline: true },
    { name: 'customer list avatar initial', text: true, sel: '.list.phone .avatar', shape: 'circle', inset: 1, desk: false, baseline: true } ]],
  ['/sales/tasks', [
    { name: 'tick box, done, the tick in its box', sel: '.tick.on .box', inset: 2, open: async p => { await p.waitForSelector('.page h1'); await p.evaluate(() => { localStorage.setItem('hub_f_tasks', JSON.stringify({ show: 'all' })); }); await p.reload(); await p.waitForSelector('.tick.on .box'); } } ]],
  ['/sales/pipeline?view=board', [
    { name: 'sheet close icon', sel: '.drawer.on .x', inset: 4, open: async (p, phone) => { phone ? await p.locator('.dc').first().tap() : await p.locator('.dc').first().click(); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(400); } },
    { name: 'sheet Edit, icon and word', text: true, sel: '.drawer.on .d-edit', inset: 3 },
    { name: 'Mark won, icon and word', text: true, sel: '.drawer.on [data-act="deal-won"]', inset: 3 },
    { name: 'Called, icon and word', text: true, sel: '.drawer.on [data-act="deal-log-call"]', inset: 3 } ]]
];
const missing = []; let fontMiss = 0;
for (const [label, opt] of [['phone 390 @3x', { width: 390 }], ['desk 1440 @2x', { width: 1440, desk: true }]]) {
  for (const theme of ['dark', 'light']) {
    const ctx = await context(b, { ...opt, dark: theme === 'dark', fonts: true }); const p = await ctx.newPage();
    /* the mark under the current tab is meant to sit off centre, like a notification dot */
    await p.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.bm-btn::after{visibility:hidden!important}'; document.head.appendChild(s); }));
    await signIn(p, base);
    const phone = label.startsWith('phone');
    for (const [hash, checks] of plan) {
      await p.evaluate(h => { location.hash = '#' + h; }, hash); await p.waitForSelector('.topbar'); await p.waitForFunction(() => document.fonts.check('600 14px Inter') && document.fonts.status === 'loaded', null, { timeout: 20000 }).catch(() => { fontMiss++; }); await p.waitForTimeout(700);
      const run = checks.filter(c => phone ? c.phone !== false : c.desk !== false);
      for (const c of run) if (c.open) await c.open(p, phone);
      total += run.length;
      /* the fixed tab bar, topbar and toasts are covered for every reading except their own */
      const inSheet = s => s.startsWith('.drawer');
      const r = await report(p, run.map(c => ({ ...c, cover: inSheet(c.sel) ? '.toast' : c.sel.startsWith('.bm') ? '.toast' : c.sel.startsWith('.topbar') ? '.bm, .toast' : '.bm, .toast, .topbar' })), TOL); bad += r.bad;
      r.rows.forEach(x => { if (/not found|not visible|nothing to read/.test(x)) missing.push(`${label} · ${theme} · ${hash} · ${x.trim()}`); });
      out.push(`--- ${label} · ${theme} · ${hash}`, ...r.rows.map(x => '  ' + x));
      await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    }
    await ctx.close();
  }
}
const all = process.argv.includes('--all');
console.log(out.filter(l => all || !l.startsWith('  PASS')).join('\n'));
/* a reading that was not found proved nothing: it is a failure, never a pass */
if (fontMiss) { console.log('FAIL  the real font never loaded on ' + fontMiss + ' screens: these readings measured a stand-in'); bad += fontMiss; }
if (missing.length) { console.log('NOT FOUND, so not proven:'); missing.forEach(m => console.log('   ' + m)); }
console.log(bad ? `RESULT: ${bad} of ${total} readings off centre or not found` : `RESULT: ALL ${total} READINGS CENTRED (shapes and icons within ${TOL}px, text within ${TOL}px plus one device pixel)`);
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
