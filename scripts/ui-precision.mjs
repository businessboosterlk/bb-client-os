#!/usr/bin/env node
/* UI PRECISION for the Hub: every glyph that is meant to sit in the centre of its shape is measured
   by its INK, in dark and light, on a 390px phone at 3x and a 1440px desk at 2x. Cast from the
   Workshop OS runner (17 Sep 2026), where "6 of 10" sat 6.5px high in a ring while every harness
   was green. The measuring itself lives in ~/bb-systems/qa/optical.mjs, one copy for every system.

   node scripts/ui-precision.mjs [base-url]     exits 1 on any miss
   Serve a build first, for example apps/web/dist/web/browser on http://localhost:8772/.
   The check proves itself first on a fixture: centred must read 0, moved 3px must read 3.
   Also runs icon-centre --check, because an icon drawn off centre is off centre everywhere. */
import { chromium } from '/Users/thulaibhassen/bb-systems/batch/node_modules/playwright/index.mjs';
import { report, measure } from '/Users/thulaibhassen/bb-systems/qa/optical.mjs';
import { execFileSync } from 'node:child_process';
const BASE = process.argv[2] || 'http://localhost:8772/';
const TOL = 0.5;   /* shapes and icons; anything with text gets one device pixel more, see optical.mjs */
const b = await chromium.launch(); let bad = 0, total = 0; const out = [];

/* 0. icons drawn on the centre of their frame */
try { out.push(execFileSync('node', [new URL('./icon-centre.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' }).trim()); }
catch (e) { out.push(String(e.stdout || e.message).trim()); bad++; }
total++;

/* 1. the check, proven both ways */
{ const p = await (await b.newContext({ deviceScaleFactor: 3 })).newPage();
  const fx = (shift) => `<div style="width:120px;height:120px;border-radius:50%;background:#16161a;display:grid;place-items:center;margin:20px"><div style="width:30px;height:30px;background:#c9dd2b;transform:translate(0,${shift}px)"></div></div>`;
  await p.setContent(`<body style="margin:0;background:#fff"><div id="a">${fx(0)}</div><div id="b">${fx(3)}</div></body>`);
  const a = await measure(p, '#a > div', { shape: 'circle', inset: 6 }), m = await measure(p, '#b > div', { shape: 'circle', inset: 6 });
  const ok = Math.abs(a.dy) < .2 && Math.abs(m.dy - 3) < .2;
  out.push(`${ok ? 'PASS' : 'FAIL'}  the check itself: centred reads ${a.dy}, moved 3px reads ${m.dy}`); if (!ok) bad++; total++;
  await p.context().close(); }

/* a fresh demo book is empty, and an empty book shows no rail badge and only zeros on the board.
   Seed a throwaway book so every badge has a number to read: one new enquiry, a quiet deal, a due task */
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
const SEED = JSON.stringify({
  enquiries: [{ id: 'e1', name: 'Harness Co', phone: '0771234567', wants: 'Two boxes', status: 'new', createdAt: ago(1), updatedAt: ago(1) }],
  deals: [{ id: 'd1', name: 'Quiet Ltd', stage: 'talking', value: 120000, stageAt: ago(9), lastContactAt: ago(9), createdAt: ago(12), updatedAt: ago(9) },
          { id: 'd2', name: 'Busy Ltd', stage: 'quoted', value: 45000, stageAt: ago(1), lastContactAt: ago(1), createdAt: ago(3), updatedAt: ago(1) }],
  customers: [], activities: [],
  tasks: [{ id: 't1', text: 'Call back', due: ago(1).slice(0, 10), done: false, createdAt: ago(2), updatedAt: ago(2) }] });
/* the static demo door: business name and the cast PIN */
const signIn = async p => {
  await p.goto(BASE + '?c=demo#/login'); await p.waitForTimeout(1200);
  await p.fill('#biz', 'demo'); await p.fill('#pin', '1111'); await p.click('button[type=submit]'); await p.waitForTimeout(1500);
};
/* what is meant to be centred, screen by screen */
const plan = [
  ['/sales/pipeline?view=board', [
    { name: 'rail badge number: Enquiries', text: true, sel: '.rail .nb', index: 0, inset: 1, phone: false, baseline: true },
    { name: 'rail badge number: Pipeline', text: true, sel: '.rail .nb', index: 1, inset: 1, phone: false, baseline: true },
    { name: 'rail badge number: Tasks', text: true, sel: '.rail .nb', index: 2, inset: 1, phone: false, baseline: true },
    { name: 'rail avatar initial', text: true, sel: '.r-foot .avatar', shape: 'circle', inset: 1, phone: false, baseline: true },
    { name: 'board count pill: first stage', text: true, sel: '.col-n', index: 0, inset: 1, baseline: true },
    { name: 'board count pill: second stage', text: true, sel: '.col-n', index: 1, inset: 1, baseline: true },
    { name: 'Board switch, icon and word', text: true, sel: '.seg button', index: 0, inset: 3 },
    { name: 'List switch, icon and word', text: true, sel: '.seg button', index: 1, inset: 3 },
    { name: 'New deal, icon and word', text: true, sel: '.ph-right > .btn', inset: 3 },
    { name: 'WhatsApp in the topbar, icon and word', text: true, sel: '.topbar .btn.wa', inset: 3, phone: false },
    { name: 'WhatsApp in the topbar, icon only', sel: '.topbar .btn.wa', inset: 3, desk: false },
    { name: 'theme button icon', sel: '.topbar .x.theme', inset: 4 },
    { name: 'menu button icon', sel: '.topbar .x.hamb', inset: 4, desk: false },
    ...[0, 1, 2, 3, 4].map(i => ({ name: `tab bar icon ${i + 1}`, sel: '.bm-btn', index: i, inset: 6, desk: false, hide: '.dot' })) ]],
  ['/sales/enquiries', [
    { name: 'New enquiry, icon and word', text: true, sel: '.ph-right > .btn', inset: 3, baseline: true } ]]
];
for (const [label, vp] of [['phone 390 @3x', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }], ['desk 1440 @2x', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }]]) {
  for (const theme of ['dark', 'light']) {
    const ctx = await b.newContext({ ...vp, colorScheme: theme }); const p = await ctx.newPage();
    await p.addInitScript(([t, seed]) => { try { localStorage.setItem('hub_theme', t); localStorage.setItem('bbos_demo', seed); } catch {} }, [theme, SEED]);
    await signIn(p);
    for (const [hash, checks] of plan) {
      await p.goto(BASE + '?c=demo#' + hash); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
      const phone = label.startsWith('phone');
      const run = checks.filter(c => phone ? c.phone !== false : c.desk !== false);
      total += run.length;
      /* the fixed tab bar, topbar and toasts are covered for every reading except their own */
      const r = await report(p, run.map(c => ({ ...c, cover: c.sel.startsWith('.bm') ? '.toast' : c.sel.startsWith('.topbar') ? '.bm, .toast' : '.bm, .toast, .topbar' })), TOL); bad += r.bad;
      out.push(`--- ${label} · ${theme} · ${hash}`, ...r.rows.map(x => '  ' + x));
    }
    await ctx.close();
  }
}
const all = process.argv.includes('--all');
console.log(out.filter(l => all || !l.startsWith('  PASS')).join('\n'));
console.log(bad ? `RESULT: ${bad} of ${total} readings off centre` : `RESULT: ALL ${total} READINGS CENTRED (shapes and icons within ${TOL}px, text within ${TOL}px plus one device pixel)`);
await b.close(); process.exit(bad ? 1 : 0);
