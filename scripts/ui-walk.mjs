#!/usr/bin/env node
/* EVERY SCREEN, MEASURED AND PHOTOGRAPHED. Walks the door, the launcher, every screen, every sheet,
   the rail and the bottom menu at 390, 320 and 1440, in day and in night. The gap audit runs on each
   and a photograph of each goes to evidence/gallery for a person to LOOK at.
   node scripts/ui-walk.mjs [out-folder]      exits 1 on any fault */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, serve, context, signIn, ROOT } from './lib/world.mjs';
import { AUDIT } from './lib/audit.mjs';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'evidence/gallery')); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const { srv, base } = serve(); const browser = await chromium.launch();
const faults = []; let surfaces = 0; const errors = []; const words = new Set();
async function walk(tag, width, desk, dark) {
  const c = await context(browser, { width, desk, dark }); const p = await c.newPage();
  p.on('pageerror', e => errors.push(tag + ' ' + String(e))); p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(tag + ' ' + m.text()); });
  const shoot = width !== 320; let n = 0;
  const see = async name => { await p.waitForTimeout(380); surfaces++;
    const hits = await p.evaluate(AUDIT); hits.forEach(x => faults.push(tag + ' ' + name + ': ' + x));
    /* every word a person can read on this surface, for the house style check */
    (await p.evaluate(() => [...document.body.innerText.split('\n'), ...[...document.querySelectorAll('[placeholder]')].map(e => e.getAttribute('placeholder')), ...[...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label'))].map(x => (x || '').replace(/\u00a0/g, ' ').trim()).filter(Boolean))).forEach(w => words.add(w));
    if (shoot) await p.screenshot({ path: path.join(OUT, tag + '-' + String(++n).padStart(2, '0') + '-' + name + '.png') }); };
  const tap = s => desk ? p.locator(s).first().click({ timeout: 6000 }) : p.locator(s).first().tap({ timeout: 6000 });
  /* a step that cannot be taken is a fault with a name, never a crash that hides the rest of the walk */
  const step = async (name, fn) => { try { await fn(); } catch (e) { faults.push(tag + ' ' + name + ': COULD NOT WALK: ' + String(e.message).split('\n')[0].slice(0, 140)); await p.screenshot({ path: path.join(OUT, tag + '-STUCK-' + name + '.png') }).catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); } };
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };
  const shut = async () => { for (let i = 0; i < 3; i++) { if (!(await p.locator('.drawer.on').count())) break; await p.keyboard.press('Escape'); await p.waitForTimeout(320); } };
  const sheet = (name, opener) => step(name, async () => { await opener(); await p.waitForSelector('.drawer.on', { timeout: 5000 }); await see(name); await shut(); });

  await p.goto(base); await p.waitForSelector('#biz'); await see('door');
  await p.fill('#biz', 'nobody.lk'); await p.fill('#pin', '0000'); await p.locator('.enter').click(); await p.waitForFunction(() => (document.querySelector('.err, .door [role=alert]')?.textContent || '').trim().length > 0); await see('door-refused');
  await signIn(p, base); await see('launcher');
  for (const s of ['month', 'videos', 'posts', 'docs', 'business']) { await go('#/library/' + s); await p.waitForSelector('.page h1'); await see('library-' + s); }
  for (const s of ['dashboard', 'customers', 'tasks']) { await go('#/sales/' + s); await p.waitForSelector('.page h1'); await see('sales-' + s); }
  for (const s of ['enquiries', 'pipeline']) {
    await go('#/sales/' + s + '?view=board'); await p.waitForSelector('.board .dc'); await see('sales-' + s + '-board');
    await go('#/sales/' + s + '?view=list'); await p.waitForSelector(desk ? 'table.tbl tbody tr' : '.list .li'); await see('sales-' + s + '-list');
  }
  /* every sheet, in every state a person meets: the add form, the add form refused, the record,
     the record being edited, the question before a removal and the filters on a phone */
  const row = desk ? 'table.tbl tbody tr' : '.list.phone .li';
  const kinds = [['enquiry', '#/sales/enquiries?view=list', row], ['deal', '#/sales/pipeline?view=board', '.dc'], ['customer', '#/sales/customers', row], ['task', '#/sales/tasks', '[data-act="task-open"]']];
  for (const [k, hash, opener] of kinds) {
    await go(hash); await p.waitForSelector('.page h1');
    await sheet('sheet-' + k + '-new', () => tap('[data-act="' + k + '-new"]'));
    await step('sheet-' + k + '-refused', async () => { await tap('[data-act="' + k + '-new"]'); await p.waitForSelector('.drawer.on'); await tap('.drawer.on [data-act="' + k + '-add"]'); await p.waitForSelector('.drawer.on .msg'); await see('sheet-' + k + '-refused'); await shut(); });
    await sheet('sheet-' + k, () => tap(opener));
    await step('sheet-' + k + '-edit', async () => { await tap(opener); await p.waitForSelector('.drawer.on'); await tap('.drawer.on [data-act="sheet-edit"]'); await p.waitForSelector('.drawer.on .form-grid'); await see('sheet-' + k + '-edit'); await tap('.drawer.on [data-act="' + k + '-edit-cancel"]'); await shut(); });
    await step('sheet-' + k + '-remove-asked', async () => { await tap(opener); await p.waitForSelector('.drawer.on'); await tap('.drawer.on [data-act="' + k + '-remove"]'); await p.waitForSelector('[data-act="ask-yes"]'); await see('ask-remove-' + k); await tap('[data-act="ask-no"]'); await p.waitForTimeout(300); await shut(); });
  }
  await step('ask-lost-reason', async () => { await go('#/sales/pipeline?view=board'); await tap('.dc'); await p.waitForSelector('.drawer.on'); await tap('.drawer.on [data-act="deal-lost"]'); await p.waitForSelector('[data-act="ask-pick"]'); await see('ask-lost-reason'); await tap('[data-act="ask-no"]'); await p.waitForTimeout(300); await shut(); });
  if (!desk) {
    await step('sheet-filters', async () => { await go('#/sales/enquiries?view=list'); await tap('[data-act="filter-open"]'); await p.waitForSelector('.drawer.on'); await see('sheet-filters'); await shut(); });
    await go('#/sales/dashboard');
    await step('rail', async () => { await tap('[data-act="menu"]'); await p.waitForSelector('.rail.open'); await see('rail'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); });
    await step('bottom-menu', async () => { await tap('[data-act="tab-enquiries"]'); await p.waitForSelector('.bm-sub.on'); await see('bottom-menu'); await p.keyboard.press('Escape'); });
  }
  await step('offline-line', async () => { await go('#/sales/customers'); await p.evaluate(() => { const m = document.querySelector('main.page'); const l = document.createElement('p'); l.className = 'offline'; l.id = 'probe-offline'; l.innerHTML = '<span>No connection. Showing what was saved on this device.</span>'; m.prepend(l); }); await see('offline-line'); await p.evaluate(() => document.getElementById('probe-offline')?.remove()); });
  await c.close();
}
for (const dark of [false, true]) { const t = dark ? 'night' : 'day';
  await walk('phone390-' + t, 390, false, dark); await walk('phone320-' + t, 320, false, dark); await walk('desk1440-' + t, 1440, true, dark); }
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, 'words.txt'), [...words].sort().join('\n') + '\n');
const kind = f => f.replace(/^\S+ /, '').replace(/ "[^"]*"/g, '');
const kinds = [...new Set(faults.map(kind))];
console.log('EVERY SCREEN: ' + surfaces + ' surfaces measured at three widths in day and night. ' + faults.length + ' faults of ' + kinds.length + ' kinds.');
kinds.forEach(k => console.log('   ' + k + '   [' + [...new Set(faults.filter(f => kind(f) === k).map(f => f.split(' ')[0]))].join(',') + ']'));
if (errors.length) { console.log('PAGE ERRORS: ' + errors.length); [...new Set(errors)].slice(0, 8).forEach(e => console.log('   ' + e)); }
console.log('WORDS: ' + words.size + ' different lines a person can read, written to ' + path.join(OUT, 'words.txt'));
console.log((faults.length || errors.length ? 'FAIL' : 'PASS') + '  ' + surfaces + ' surfaces, ' + faults.length + ' faults, ' + errors.length + ' page errors. Photographs in ' + OUT);
process.exit(faults.length || errors.length ? 1 : 0);
