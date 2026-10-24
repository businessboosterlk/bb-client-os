#!/usr/bin/env node
/* CLICK PATH. Every action the Hub can take is COUNTED from the source, every one is PRESSED by a
   real tap or click in a real browser, and the ones never pressed are NAMED. After every sheet:
   Back once closes it and leaves the screen where it was, Back twice leaves the screen.
   The question after each press is the one in bb-click-path: is the screen in the state the label
   promised? Running the last step by its address proves the last step, so every flow here starts
   at the door and walks.
     node scripts/click-path.mjs        exits 1 on any action not pressed or any promise not kept */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { chromium, serve, context, signIn, ROOT, SEED } from './lib/world.mjs';

/* ── 1. COUNT, from the source ── */
const SRC = path.join(ROOT, 'apps/web/src/app');
const files = (d => { const out = []; const walk = x => fs.readdirSync(x, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(x, e.name)) : /\.ts$/.test(e.name) && !/generated|selftest/.test(e.name) && out.push(path.join(x, e.name))); walk(d); return out; })(SRC);
const src = Object.fromEntries(files.map(f => [path.relative(SRC, f), fs.readFileSync(f, 'utf8')]));
const ALL = new Set();
Object.values(src).forEach(s => [...s.matchAll(/data-act="([a-z0-9-]+)"/g)].forEach(m => ALL.add(m[1])));
const shell = src['shell/shell.component.ts'];
/* the rail: every item is this.I(group, path, ...), named rail-<group>-<path>, or rail-<path> for the work with Business
   Booster; the Sales and Library panels on the phone carry the same items as menu-<group>-<path> */
[...shell.matchAll(/this\.I\('([a-z]*)', '([a-z-]+)'/g)].forEach(m => { ALL.add('rail-' + (m[1] ? m[1] + '-' : '') + m[2]); if (m[1]) ALL.add('menu-' + m[1] + '-' + m[2]); });
['work', 'library', 'sales'].forEach(g => ALL.add('rail-group-' + g));
[...shell.matchAll(/\{ key: '([a-z]+)', path:/g)].forEach(m => ALL.add('tab-' + m[1]));
[...shell.matchAll(/\{ id: '([a-z-]+)', label:/g)].forEach(m => ALL.add('menu-' + m[1]));
['posts', 'tasks'].forEach(k => ALL.add('chat-need-' + k));
Object.entries(src).filter(([f]) => f.startsWith('pages/sales') || f.startsWith('pages/work')).forEach(([, s]) => [...s.matchAll(/\{ key: '([a-z]+)', label: '[^']+', all:/g)].forEach(m => { ALL.add('filter-' + m[1]); ALL.add('filter-sheet-' + m[1]); }));
/* and nothing a finger can press goes unnamed: every tag that acts carries a name */
const unnamed = [];
Object.entries(src).forEach(([f, s]) => [...s.matchAll(/<(button|a|tr|select)\b[^>]*?(?:\(click\)=|\(change\)=|routerLink|\[href\]|href=)[^>]*>/g)].forEach(m => { if (!/data-act/.test(m[0])) unnamed.push(f + ': ' + m[0].slice(0, 90)); }));

/* ── 2. PRESS ── */
const results = []; const pressed = new Set(); const errors = [];
const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (saw !== undefined ? '  [saw: ' + (typeof saw === 'string' ? saw : JSON.stringify(saw)) + ']' : '')); };
const ago = d => new Date(Date.now() - d * 864e5).toISOString();
const BIG = JSON.parse(JSON.stringify(SEED));
for (let i = 0; i < 100; i++) { BIG.enquiries.push({ id: 'ex' + i, name: 'Extra enquiry ' + i, status: 'new', source: 'Website', createdAt: ago(3 + i % 20), updatedAt: ago(3 + i % 20) });
  BIG.deals.push({ id: 'dx' + i, name: 'Extra deal ' + i, stage: 'talking', value: 1000 + i, stageAt: ago(1), lastContactAt: ago(1), createdAt: ago(2 + i % 20), updatedAt: ago(1) }); }
const { srv, base } = serve(); const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
/* a small real picture for the photo flows */
const PNG = path.join(os.tmpdir(), 'hub-click-path-photo.png'); fs.writeFileSync(PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPYUmGDFTEMpAQA3rNDgdnHpAYAAAAASUVORK5CYII=', 'base64'));
async function world(desk) {
  const c = await context(browser, { width: desk ? 1440 : 390, desk, seed: BIG });
  await c.exposeBinding('__pressed', (s, a) => { pressed.add(a); }); await c.grantPermissions(['microphone']);
  await c.addInitScript(() => { const rec = e => { const el = e.target && e.target.closest && e.target.closest('[data-act]'); if (el && window.__pressed) window.__pressed(el.dataset.act); }; document.addEventListener('click', rec, true); document.addEventListener('change', rec, true); });
  /* nothing in this run leaves the machine: a link to WhatsApp or to Drive is answered here */
  await c.route(u => !/^http:\/\/127\.0\.0\.1/.test(u.href), r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outside</title>' }));
  const p = await c.newPage(); const outside = [];
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text()); });
  c.on('page', async np => { if (np === p) return; outside.push(np.url()); await np.waitForLoadState().catch(() => {}); outside[outside.length - 1] = np.url(); await np.close().catch(() => {}); });
  const settle = (ms = 380) => p.waitForTimeout(ms);
  const state = () => p.evaluate(() => ({ hash: location.hash.split('?')[0], q: location.hash.split('?')[1] || '', sheets: document.querySelectorAll('.drawer.on').length, locked: document.body.classList.contains('sheet-open'), rail: !!document.querySelector('.rail.open'), menu: !!document.querySelector('.bm-sub.on'), toast: (document.querySelector('.toast')?.textContent || '').trim() }));
  const loc = (act, scope) => p.locator((scope ? scope + ' ' : '') + '[data-act="' + act + '"]:visible');
  const press = async (act, { scope = '', nth = 0, wait = 380 } = {}) => {
    const el = loc(act, scope).nth(nth); await el.waitFor({ state: 'visible', timeout: 6000 });
    await el.evaluate(n => n.scrollIntoView({ block: 'center', inline: 'center' })); await p.waitForTimeout(60);
    desk ? await el.click({ timeout: 6000 }) : await el.tap({ timeout: 6000 }); await settle(wait); };
  const pick = async (act, value, scope = '') => { const el = loc(act, scope).first(); await el.waitFor({ state: 'visible', timeout: 6000 }); await el.selectOption(value); await settle(); };
  const back = async () => { await p.evaluate(() => history.back()); await settle(450); };
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await settle(420); };
  const type = async (sel, text) => { const f = p.locator(sel + ':visible').first(); await f.fill(text); await settle(120); };
  /* a step that cannot be taken is a fault with a name, never a crash that hides the rest */
  const flow = async (name, fn) => { try { await fn(); } catch (e) { check('flow "' + name + '" could be walked to its end', false, String(e.message).split('\n').slice(0, 3).join(' | ').slice(0, 300) + ' @ ' + String(e.stack).split('\n').filter(l => /click-path\.mjs/.test(l)).map(l => l.match(/:(\d+):\d+\)?$/)?.[1]).filter(Boolean).slice(0, 3).join('<')); await p.keyboard.press('Escape').catch(() => {}); await p.keyboard.press('Escape').catch(() => {}); await settle(); } };
  /* THE SHEET RULE: open from a screen reached by a real tap; Back once closes the sheet and the
     screen stays; Back twice leaves the screen for the one before it */
  const sheetBack = async (name, from, screen, open) => flow(name, async () => {
    await go(from); await go(screen); const before = await state(); await open(); const o = await state();
    check(name + ': the sheet opens and the page behind is held', o.sheets === 1 && o.locked, o);
    await back(); const a = await state();
    check(name + ': Back once closes the sheet and the screen stays', a.sheets === 0 && !a.locked && a.hash === before.hash, a);
    await back(); const b = await state();
    check(name + ': Back twice leaves the screen for the one before', b.hash === from.split('?')[0] && b.sheets === 0, b);
  });
  return { c, p, press, pick, back, go, type, state, flow, sheetBack, settle, outside, loc };
}

/* ═══ PHONE ═══ */
{ const w = await world(false); const { p, press, pick, back, go, type, state, flow, sheetBack, settle, outside, loc } = w;
  await flow('the door', async () => {
    await p.goto(base); await p.waitForSelector('#biz');
    await type('#biz', 'nobody.lk'); await type('#pin', '0000'); await press('enter');
    const msg = await p.locator('.door .err').textContent().catch(() => '');
    const order = await p.evaluate(() => { const e = document.querySelector('.door .err'), b = document.querySelector('.door .enter'); return !!e && !!b && e.getBoundingClientRect().bottom <= b.getBoundingClientRect().top; });
    check('door: a wrong code is refused in words, and the words sit above the button they explain', /do not match/.test(msg || '') && order && /#\/login/.test(p.url()), msg);
    await press('lost-code'); await settle(500);
    check('door: Lost your code reaches Business Booster on WhatsApp', outside.some(u => /wa\.me\/94767412531/.test(u)), outside.slice(-1)[0]);
    await type('#biz', 'cinnamon.lk'); await type('#pin', '1111'); await press('enter', { wait: 900 });
    check('door: the demo business and code open the chat', (await state()).hash === '#/chat', (await state()).hash);
  });
  /* ═══ THE WORKSPACE WITH BUSINESS BOOSTER (24 Oct 2026): chat, tasks both ways, posts with approvals ═══ */
  const book = () => p.evaluate(() => JSON.parse(localStorage.getItem('hub_work_demo') || '{}'));
  const pickFiles = async (act, n, scope = '') => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), press(act, { scope })]); await fc.setFiles(Array.from({ length: n }, () => PNG)); await settle(600); };
  await flow('the chat', async () => {
    let s = await state(); check('chat: the door opens on the chat', s.hash === '#/chat', s);
    check('chat: the strip says what needs the client\'s hand, posts and tasks', (await p.locator('section.need button').count()) === 2);
    await press('chat-need-posts'); s = await state(); check('chat: posts in the strip open the posts waiting for a yes', s.hash === '#/posts' && /Waiting for you/.test(await p.locator('.page').innerText()), s); await back();
    await press('chat-need-tasks'); s = await state(); check('chat: tasks in the strip open the tasks For you', s.hash === '#/tasks' && (await loc('wtask-side-client').getAttribute('aria-pressed')) === 'true', s); await back();
    const n0 = outside.length; await press('chat-whatsapp'); await settle(500); check('chat: the WhatsApp backup reaches Business Booster', outside.length === n0 + 1 && /wa\.me\/94767412531|chat\.whatsapp\.com/.test(outside.slice(-1)[0] || ''), outside.slice(-1)[0]);
    const m7 = '[data-msg="wm7"]', t0 = (await book()).tasks.length;
    await press('msg-more', { scope: m7 }); check('chat: the first tap shows Reply and Make a task', (await loc('msg-task', m7).count()) === 1);
    await press('msg-task', { scope: m7, wait: 700 }); s = await state(); const t1 = (await book()).tasks;
    check('chat: the second tap makes a request For us from a client message, linked back to it, and says so', t1.length === t0 + 1 && t1[0].for === 'bb' && t1[0].asked === true && t1[0].source === 'wm7' && /Made a task/.test(s.toast), [t1.length, t1[0]?.for, s.toast]);
    await press('msg-more', { scope: m7 }); check('chat: a message already made a task offers Reply only', (await loc('msg-task', m7).count()) === 0);
    await press('msg-reply', { scope: m7 }); check('chat: Reply puts the message above the composer', /Dilan/.test(await p.locator('bb-composer .rp').textContent().catch(() => '') || ''));
    await press('composer-reply-cancel'); check('chat: the reply can be called off', (await p.locator('bb-composer .rp').count()) === 0);
    await press('msg-more', { scope: m7 }); await press('msg-reply', { scope: m7 }); await type('#composer-text', 'Walk the chat'); await press('composer-send', { wait: 600 });
    let msgs = (await book()).msgs, last = msgs[msgs.length - 1];
    check('chat: Send adds the message as a reply, with one tick until the team sees it', last.text === 'Walk the chat' && last.reply === 'wm7' && last.seen === false && (await p.locator('[data-msg="' + last.id + '"] [aria-label="Sent"]').count()) === 1, last);
    await press('msg-quote', { scope: '[data-msg="' + last.id + '"]', wait: 500 }); check('chat: the quote takes you to the message it answers', (await p.locator('bb-bubble.lit[data-msg="wm7"]').count()) === 1);
    await pickFiles('composer-photo', 3); check('chat: picked photos wait above the box', (await p.locator('bb-composer .pk img').count()) === 3);
    await press('composer-photo-remove'); check('chat: a picked photo can be taken out before sending', (await p.locator('bb-composer .pk img').count()) === 2);
    await press('composer-send', { wait: 900 }); msgs = (await book()).msgs; last = msgs[msgs.length - 1];
    check('chat: photos are sent as files on the device, never as text inside the row', last.photos?.length === 2 && last.photos.every(x => /^md/.test(x)) && !JSON.stringify(last).includes('data:'), last);
    await press('photo-open', { scope: '[data-msg="' + last.id + '"]' }); s = await state(); check('chat: a photo opens in a sheet', s.sheets === 1, s);
    await press('photo-next', { scope: '.drawer.on' }); await press('photo-prev', { scope: '.drawer.on' }); check('chat: the photo sheet steps through the photos', /Photo 1 of 2/.test(await p.locator('.drawer.on h3').textContent()));
    await back(); s = await state(); check('chat: Back closes the photo and stays in the chat', s.sheets === 0 && s.hash === '#/chat', s);
    await press('composer-mic', { wait: 900 }); const said = await p.locator('bb-composer').innerText(); check('chat: the microphone records and says so', /Recording/.test(said), said.slice(0, 120));
    await press('composer-record-cancel'); check('chat: a recording can be thrown away', (await loc('composer-mic').count()) === 1);
    await press('composer-mic', { wait: 1400 }); await press('composer-record-send', { wait: 1000 }); msgs = (await book()).msgs; last = msgs[msgs.length - 1];
    check('chat: a voice note is sent as a file with its length', !!last.voice?.media && last.voice.secs >= 0.5, last.voice);
    const vn = '[data-msg="' + last.id + '"]'; await press('voice-play', { scope: vn, wait: 500 }); await press('voice-speed', { scope: vn });
    check('chat: a voice note plays and changes speed', /1\.5x/.test(await loc('voice-speed', vn).innerText()), await loc('voice-speed', vn).innerText());
    await press('voice-play', { scope: vn });
    await press('msg-open-ref', { scope: '[data-msg="wm18"]', wait: 600 }); s = await state(); check('chat: a task card opens that task', s.hash === '#/tasks' && s.sheets === 1 && /Retouch/.test(await p.locator('.drawer.on h3').textContent()), s);
    await back(); await back(); s = await state(); check('chat: Back from a card leaves the task and returns to the chat', s.hash === '#/chat' && s.sheets === 0, s);
  });
  await sheetBack('new task with us', '#/chat', '#/tasks', async () => { await press('wtask-new'); });
  await sheetBack('a task with us', '#/chat', '#/tasks?view=list', async () => { await press('wtask-open'); });
  await flow('tasks both ways', async () => {
    /* twenty more tasks For you, so the board's column window has something to show */
    await p.evaluate(() => { const b = JSON.parse(localStorage.getItem('hub_work_demo')); const at = new Date().toISOString(); for (let i = 0; i < 20; i++) b.tasks.push({ id: 'xt' + i, title: 'Extra task ' + i, for: 'client', stage: 'todo', files: [], by: 'Amara', createdAt: at, updatedAt: at }); localStorage.setItem('hub_work_demo', JSON.stringify(b)); });
    await p.reload(); await p.waitForSelector('bb-bubble'); await go('#/tasks'); await press('wtask-side-client'); await press('wtask-view-board');
    check('tasks: For you tasks can be dragged on the board, For us tasks cannot', (await p.locator('.board .dc.cdk-drag-disabled').count()) === 0);
    await press('wtask-column-more'); await press('wtask-side-bb'); check('tasks: the team\'s tasks are held in place', (await p.locator('.board .dc').count()) > 0 && (await p.locator('.board .dc').count()) === (await p.locator('.board .dc.cdk-drag-disabled').count()));
    await press('wtask-side-client'); await press('wtask-new'); await type('#wt-title', 'Gone'); await press('wtask-add-cancel', { scope: '.drawer.on' }); check('new task: Cancel adds nothing', !(await book()).tasks.some(t => t.title === 'Gone'));
    await press('wtask-new'); await type('#wt-title', ''); await press('wtask-add', { scope: '.drawer.on' }); check('new task: with no words the reason sits in the action bar', /needs doing/.test(await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => '') || ''));
    await type('#wt-title', 'Walk the tasks'); await press('wtask-add-side-bb', { scope: '.drawer.on' }); check('new task: For us explains that the team accepts it', /accept it with a person/.test(await p.locator('.drawer.on').innerText()));
    await press('wtask-add-side-client', { scope: '.drawer.on' }); await pickFiles('wtask-add-photo', 1, '.drawer.on');
    await press('wtask-add', { scope: '.drawer.on', wait: 800 }); let s = await state(); const made = (await book()).tasks.find(t => t.title === 'Walk the tasks');
    check('new task: Add closes the sheet, says so and keeps the photo as a file', s.sheets === 0 && /Task added/.test(s.toast) && made?.files?.length === 1 && /^md/.test(made.files[0]), [s, made?.files]);
    await press('wtask-view-list'); await type('[aria-label="Search tasks"]', 'Walk the tasks'); await settle(300);
    await press('wtask-tick', { wait: 500 }); check('tasks: the tick marks a task For you done', (await book()).tasks.find(t => t.title === 'Walk the tasks')?.stage === 'done');
    await press('filter-open'); await pick('filter-sheet-show', 'all', '.drawer.on'); await p.keyboard.press('Escape'); await settle();
    await press('wtask-open'); await press('wtask-undo', { scope: '.drawer.on', wait: 500 }); let s2 = await state(); check('a task: Back to To do closes the sheet and says so', s2.sheets === 0 && /To do/.test(s2.toast), s2);
    await press('wtask-open'); await press('wtask-start', { scope: '.drawer.on', wait: 500 }); check('a task: Start moves it to Doing', (await book()).tasks.find(t => t.title === 'Walk the tasks')?.stage === 'doing');
    await press('wtask-open'); await press('sheet-edit', { scope: '.drawer.on' }); await type('#wt-e-title', ''); await press('wtask-save', { scope: '.drawer.on' });
    check('a task: Save refuses a task with no words', /needs its words/.test(await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => '') || ''));
    await press('wtask-edit-cancel', { scope: '.drawer.on' }); await press('sheet-edit', { scope: '.drawer.on' }); await type('#wt-e-title', 'Walk the tasks twice'); await press('wtask-save', { scope: '.drawer.on', wait: 500 });
    check('a task: Save changes writes the words', !!(await book()).tasks.find(t => t.title === 'Walk the tasks twice'));
    await type('#wt-say', 'Is this the right photo?'); await press('wtask-comment', { scope: '.drawer.on', wait: 500 }); const mm = (await book()).msgs; s2 = await state();
    check('a task: a comment goes into the chat as a card about the task', mm[mm.length - 1].event === 'comment' && mm[mm.length - 1].ref?.kind === 'task' && /Sent to the chat/.test(s2.toast), mm[mm.length - 1]);
    await press('wtask-done', { scope: '.drawer.on', wait: 500 }); check('a task: Mark done finishes it and a card says so in the chat', (await book()).msgs.slice(-1)[0].event === 'task-done');
    await press('wtask-open'); { const bar = await p.locator('.drawer.on').innerText().catch(() => ''); check('a done task of yours still offers Remove', (await loc('wtask-remove', '.drawer.on').count()) === 1, bar.replace(/\s+/g, ' ').slice(0, 200)); }
    await press('wtask-remove', { scope: '.drawer.on' }); await press('ask-yes', { wait: 600 }); check('a task: Remove, confirmed, takes it away', !(await book()).tasks.some(t => t.title === 'Walk the tasks twice'));
    await press('filter-open'); await press('filter-clear-all', { scope: '.drawer.on' }); await p.keyboard.press('Escape'); await settle(); await type('[aria-label="Search tasks"]', ''); await settle(300);
    await press('wtask-side-bb'); await type('[aria-label="Search tasks"]', 'Retouch'); await settle(300); await press('wtask-open');
    const late = await p.locator('.drawer.on').innerText(); check('a late task For us shows the reason, the new date and the original date it missed', /Late\. The photographer/.test(late) && /was \d+ \w+/.test(late) && !/(\d+ \w+) · was \1/.test(late), late.slice(0, 200));
    await press('wtask-close', { scope: '.drawer.on' }); await type('[aria-label="Search tasks"]', 'emailed the logo'); await settle(300); await press('wtask-open');
    check('a request made in the chat says it waits for the team to accept it', /Asked\. Waiting for the team/.test(await p.locator('.drawer.on').innerText()));
    await press('wtask-source', { scope: '.drawer.on', wait: 700 }); s = await state(); check('a task made from a message opens that message in the chat', s.hash === '#/chat' && (await p.locator('bb-bubble.lit[data-msg="wm7"]').count()) === 1, s);
    await go('#/tasks'); await press('wtask-side-bb'); await press('wtask-view-list'); await type('[aria-label="Search tasks"]', 'emailed the logo'); await settle(300); await press('wtask-open'); await press('wtask-remove', { scope: '.drawer.on' }); await press('ask-yes', { wait: 600 });
    check('a request not yet accepted can be withdrawn by the person who asked', !(await book()).tasks.some(t => t.source === 'wm7'));
    await type('[aria-label="Search tasks"]', ''); await settle(300);
  });
  await sheetBack('a post', '#/chat', '#/posts?view=list', async () => { await press('wpost-open'); });
  await flow('posts and approvals', async () => {
    await p.evaluate(() => { const b = JSON.parse(localStorage.getItem('hub_work_demo')); const at = new Date(Date.now() - 864e5 * 9).toISOString(); for (let i = 0; i < 18; i++) b.posts.push({ id: 'xp' + i, platform: 'Instagram', kind: 'Post', slot: at, status: 'live', approvedBy: 'Amara', versions: [{ v: 1, caption: 'Extra', head: 'Extra post ' + i, tone: 'ink', at }], changes: [], createdAt: at, updatedAt: at }); localStorage.setItem('hub_work_demo', JSON.stringify(b)); });
    await p.reload(); await p.waitForSelector('bb-bubble'); await go('#/posts'); await press('wpost-view-list'); await press('wpost-view-board'); await press('wpost-column-more');
    await press('wpost-open'); let txt = await p.locator('.drawer.on').innerText(); check('a post waiting shows its version, its caption and the deadline that keeps its slot', /Approve by/.test(txt) && /Caption/.test(txt) && /Version 2/.test(txt), txt.slice(0, 160));
    await press('wpost-change', { scope: '.drawer.on' }); await press('wpost-change-send', { scope: '.drawer.on' }); check('ask for a change: nothing written is refused in words', /Write what should change/.test(await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => '') || ''));
    await press('wpost-voice-start', { scope: '.drawer.on', wait: 1300 }); await press('wpost-voice-stop', { scope: '.drawer.on', wait: 600 }); check('ask for a change: a voice note can be recorded', /ready/.test(await p.locator('.drawer.on').innerText()));
    await press('wpost-voice-clear', { scope: '.drawer.on' }); await press('wpost-change-cancel', { scope: '.drawer.on' }); await press('wpost-change', { scope: '.drawer.on' });
    await type('#wp-change', 'Can the price be bigger?'); await press('wpost-change-send', { scope: '.drawer.on', wait: 900 }); let s = await state(); const first = (await book()).posts.find(x => x.changes.some(c => c.text === 'Can the price be bigger?'));
    check('ask for a change: it goes to the team against that version and the next post waiting opens', !!first && first.status === 'waiting' && /Change sent/.test(s.toast) && s.sheets === 1 && /Next post waiting/.test(await p.locator('.drawer.on').innerText()), [s, first?.changes?.length]);
    await press('wpost-approve', { scope: '.drawer.on', wait: 900 }); s = await state(); const ap = (await book()).posts.filter(x => x.status === 'approved' && x.approvedBy === 'Amara');
    check('approve: only a press approves, stamped with who, and with nothing left waiting the sheet closes', ap.length >= 2 && /Approved/.test(s.toast) && s.sheets === 0, [ap.length, s]);
    const mm = (await book()).msgs.slice(-2).map(m => m.event); check('approve and change both go into the chat as cards', mm.includes('approved') && mm.includes('change'), mm);
    await press('wpost-view-list'); await type('[aria-label="Search posts"]', first.versions.slice(-1)[0].head.slice(0, 12)); await settle(300); await press('wpost-open');
    check('a post with a change asked says it is with the team and offers no Approve', /with the team/.test(await p.locator('.drawer.on').innerText()) && (await loc('wpost-approve').count()) === 0);
    await press('wpost-close', { scope: '.drawer.on' }); await type('[aria-label="Search posts"]', 'Pettah shop'); await settle(300); await press('wpost-open');
    await type('#wp-say', 'Can it say eight in the morning?'); await press('wpost-comment', { scope: '.drawer.on', wait: 500 }); check('a post: a comment goes into the chat as a card', (await book()).msgs.slice(-1)[0].ref?.kind === 'post' && /Sent to the chat/.test((await state()).toast));
    await press('wpost-close', { scope: '.drawer.on' }); await type('[aria-label="Search posts"]', 'morning grind'); await settle(300); await press('wpost-open'); await press('wpost-library', { scope: '.drawer.on', wait: 600 });
    s = await state(); check('a live post points at the Library', s.hash === '#/library/posts' && s.sheets === 0, s);
    await go('#/posts'); await type('[aria-label="Search posts"]', ''); await press('filter-open'); await pick('filter-sheet-platform', 'Facebook', '.drawer.on'); await pick('filter-sheet-show', 'live', '.drawer.on'); await press('filter-clear-all', { scope: '.drawer.on' }); await p.keyboard.press('Escape'); await settle();
    const left = await p.evaluate(() => document.querySelectorAll('section.need button').length); await go('#/chat'); check('the chat strip follows: no post waits for a yes now', (await p.locator('[data-act="chat-need-posts"]').count()) === 0, left);
  });
  await flow('a real client sees an honest panel', async () => {
    /* a cast in api mode is a real client: Stage 1 keeps the workspace on the demo, so the three screens say so */
    /* the app pointed at a server (here one that answers nothing): exactly what a real client's Hub is today */
    const w0 = (await book()).msgs.length; await p.goto(base + '?api=http://127.0.0.1:9#/chat'); await p.waitForSelector('.soon', { timeout: 20000 });
    for (const h of ['#/chat', '#/tasks', '#/posts']) { await go(h); check('a real client: ' + h + ' says it arrives soon and points at WhatsApp, no empty chat', (await p.locator('.soon').count()) === 1 && (await p.locator('bb-bubble, [data-act="wtask-new"], [data-act="wpost-open"]').count()) === 0); }
    const n = outside.length; await press('soon-whatsapp'); await settle(500); check('a real client: the panel reaches Business Booster on WhatsApp', outside.length === n + 1 && /wa\.me\/94767412531|chat\.whatsapp\.com/.test(outside.slice(-1)[0] || ''), outside.slice(-1)[0]);
    check('a real client: nothing is written to the workspace on this device', (await book()).msgs.length === w0);
    await p.goto(base + '#/chat'); await p.reload(); await p.waitForSelector('#biz, bb-bubble', { timeout: 20000 }); if (await p.locator('#biz').count()) await signIn(p, base); await p.waitForSelector('bb-bubble', { timeout: 20000 });
  });
  await flow('the library', async () => {
    for (const k of ['videos', 'posts', 'docs', 'business']) { await go('#/library/month'); await press('month-' + k); const a = await state(); await back(); const b = await state();
      check('library: the ' + k + ' row opens its screen and Back returns', a.hash === '#/library/' + k && b.hash === '#/library/month', [a.hash, b.hash]); }
    await go('#/library/month'); await press('tab-library'); let s = await state();
    check('tab bar: Library, tapped inside the library, opens its panel and stays put', s.hash === '#/library/month' && s.menu, s);
    await press('menu-library-videos'); s = await state();
    check('the Library panel: Videos goes there and the panel folds away', s.hash === '#/library/videos' && !s.menu, s);
    await press('videos-month', { nth: 0 }); check('videos: a month chip marks itself as pressed', (await loc('videos-month').nth(0).getAttribute('aria-pressed')) === 'true');
    const n0 = outside.length; await press('library-open'); await settle(500); check('library: a row opens its file outside the app', outside.length === n0 + 1, outside.slice(-1)[0]);
    await go('#/library/videos'); const nf = outside.length; await press('video-feature'); await settle(500); check('videos: the lead film card opens its file outside the app', outside.length === nf + 1, outside.slice(-1)[0]);
    await go('#/library/month'); const nl = outside.length; await press('lead-open'); await settle(500); check('this month: the lead card opens the newest report outside the app', outside.length === nl + 1 && /demo-report/.test(outside.slice(-1)[0] || ''), outside.slice(-1)[0]);
    await type('[data-act="library-search"]', 'roast'); await p.locator('[data-act="library-search"]:visible').press('Enter'); await settle(300);
    let hits = await p.locator('[data-search-results] .li').count(); check('search: typing filters the whole library and the sections step aside', hits >= 1 && !(await p.locator('[data-act="month-videos"]').count()), hits);
    await type('[data-act="library-search"]', 'provenance'); await settle(300); await press('search-fact'); s = await state();
    check('search: a business fact result lands on Your business with the fact named in the address', s.hash === '#/library/business' && /f=/.test(s.q), s);
    await back(); s = await state(); check('search: Back from a fact result returns to the library home', s.hash === '#/library/month', s);
    await type('[data-act="library-search"]', ''); await settle(200);
    if (await loc('hint-dismiss').count() || !(await p.evaluate(() => matchMedia('(hover:hover)').matches))) { if (await loc('hint-dismiss').count()) { await press('hint-dismiss'); check('install hint: dismissed once, gone for good', !(await loc('hint-dismiss').count()) && (await p.evaluate(() => localStorage.getItem('hub_hint_demo'))) === '1'); } else check('install hint: shows on a phone that has not installed the app', false, 'no hint on screen'); }
    for (const k of ['posts', 'docs', 'business', 'month']) { await press('tab-library'); await press('menu-library-' + k); s = await state(); check('the Library panel: ' + k + ' goes there', s.hash === '#/library/' + k && !s.menu, s); }
    await go('#/library/posts'); await press('posts-month', { nth: 1 }); s = await state(); check('posts: a month chip stays on Posts', s.hash === '#/library/posts', s);
    await go('#/library/business'); const n1 = outside.length; await press('business-update-top'); await settle(500);
    check('your business: Update a detail reaches Business Booster, never the client\'s own line', outside.length === n1 + 1 && /wa\.me\/94767412531|chat\.whatsapp\.com/.test(outside.slice(-1)[0] || ''), outside.slice(-1)[0]);
  });
  await flow('the shell', async () => {
    await go('#/sales/dashboard'); await press('menu'); let s = await state(); check('menu: the rail opens and the page behind is held', s.rail && s.locked, s);
    const exp = () => loc('rail-group-library').getAttribute('aria-expanded'); const e0 = await exp(); await press('rail-group-library'); const e1 = await exp();
    check('rail: the Library group unfolds and says so', e0 === 'false' && e1 === 'true', [e0, e1]);
    await press('rail-group-sales'); await press('rail-group-sales'); await press('rail-group-work'); await press('rail-group-work');
    await press('rail-theme'); await press('rail-theme');
    const walk = async (name, hash) => { if (!(await state()).rail) await press('menu'); const grp = name.split('-')[0];
      if (['library', 'sales'].includes(grp) && (await loc('rail-group-' + grp).getAttribute('aria-expanded')) === 'false') await press('rail-group-' + grp);
      await press('rail-' + name); const st = await state(); check('rail: ' + name + ' goes there, closes the rail and lets the page go', st.hash === hash && !st.rail && !st.locked, st); };
    for (const k of ['chat', 'posts', 'tasks']) await walk(k, '#/' + k);
    for (const k of ['month', 'videos', 'posts', 'docs', 'business']) await walk('library-' + k, '#/library/' + k);
    for (const k of ['dashboard', 'enquiries', 'pipeline', 'customers', 'follow-ups']) await walk('sales-' + k, '#/sales/' + k);
    const cur = await loc('tab-sales').getAttribute('aria-current'); check('tab bar: Sales stays marked current on every sales screen', cur === 'page', cur);
    await press('menu'); await press('rail-home'); s = await state(); check('rail: the client name goes home to the chat', s.hash === '#/chat' && !s.locked, s);
    await go('#/sales/dashboard'); await press('theme'); const ap = await loc('theme').getAttribute('aria-pressed'); await press('theme'); check('top bar: the theme button says which theme is on', ap === 'true' || ap === 'false', ap);
    const n = outside.length; await press('whatsapp-bb'); await settle(500); check('top bar: WhatsApp reaches Business Booster', outside.length === n + 1 && /wa\.me\/94767412531/.test(outside.slice(-1)[0]), outside.slice(-1)[0]);
    /* the five places and every quick action in their panels */
    for (const [k, to] of [['chat', '#/chat'], ['posts', '#/posts'], ['tasks', '#/tasks']]) { await press('tab-' + k); await p.keyboard.press('Escape'); await settle(200); const st = await state(); check('tab bar: ' + k + ' goes there', st.hash === to, st); }
    for (const [m, to] of [['posts-waiting', '#/posts'], ['posts-board', '#/posts'], ['posts-list', '#/posts'], ['tasks-for-you', '#/tasks'], ['tasks-for-us', '#/tasks']]) { const t = m.split('-')[0]; await press('tab-' + t); await press('menu-' + m, { wait: 500 }); const st = await state(); check('quick action: ' + m + ' lands on ' + to + ' with the order spent', st.hash === to && !/view=|for=|show=/.test(st.q) && !st.menu, st); }
    await press('tab-tasks'); await press('menu-tasks-new', { wait: 200 }); { const t0 = Date.now(); await p.waitForSelector('.drawer.on', { timeout: 2000 }).catch(() => {}); const st = await state(); check('quick action: New task opens the form', st.sheets === 1, { ...st, ms: Date.now() - t0 }); } await p.keyboard.press('Escape'); await settle();
    await press('tab-chat'); const nw = outside.length; await press('menu-chat-whatsapp'); await settle(500); check('the Chat panel: the WhatsApp backup reaches Business Booster', outside.length === nw + 1, outside.slice(-1)[0]);
    for (const k of ['dashboard', 'enquiries', 'pipeline', 'customers', 'follow-ups']) { await press('tab-sales'); await press('menu-sales-' + k); const st = await state(); check('the Sales panel: ' + k + ' goes there', st.hash === '#/sales/' + k && !st.menu, st); }
    await press('tab-sales'); await press('menu-sales-new-enquiry', { wait: 600 }); check('the Sales panel: New enquiry opens the form', (await state()).sheets === 1); await p.keyboard.press('Escape'); await settle();
    await press('menu'); await press('rail-sign-out', { wait: 700 }); s = await state(); const kept = await p.evaluate(() => !!localStorage.getItem('hub_session'));
    check('rail: Sign out lands on the door with the page let go and the seat gone from the device', s.hash === '#/login' && !s.locked && !kept, [s, kept]);
    await signIn(p, base);
  });
  await flow('the dashboard', async () => {
    for (const [k, to] of [['kpi-waiting', '#/sales/enquiries'], ['kpi-progress', '#/sales/pipeline'], ['kpi-won', '#/sales/pipeline'], ['kpi-customers', '#/sales/customers']]) {
      await go('#/sales/dashboard'); await press(k); const a = await state(); await back(); const b = await state();
      check('dashboard: ' + k + ' opens ' + to + ' with no order left in the address, and Back returns', a.hash === to && a.q === '' && b.hash === '#/sales/dashboard', [a, b.hash]); }
  });
  await flow('dashboard New enquiry', async () => {
    await go('#/sales/customers'); await go('#/sales/dashboard'); await press('dashboard-new-enquiry-top', { wait: 600 }); let s = await state();
    check('dashboard New enquiry: the form opens on Enquiries, the page held, no order left in the address', s.hash === '#/sales/enquiries' && s.sheets === 1 && s.locked && s.q === '', s);
    await back(); s = await state(); check('dashboard New enquiry: Back once closes the form and Enquiries stays', s.hash === '#/sales/enquiries' && s.sheets === 0 && !s.locked, s);
    await back(); s = await state(); check('dashboard New enquiry: Back twice returns to the dashboard with nothing open', s.hash === '#/sales/dashboard' && s.sheets === 0, s);
  });
  await flow('dashboard lists', async () => {
    await go('#/sales/dashboard'); await press('cold-open', { wait: 600 }); let s = await state(); check('going cold: a row opens that deal in the pipeline', s.hash === '#/sales/pipeline' && s.sheets === 1, s);
    await back(); s = await state(); const again = s.sheets; await p.reload(); await p.waitForSelector('.page h1'); await settle(600); s = await state();
    check('going cold: after Back the sheet is shut, and a reload does not open it again', again === 0 && s.sheets === 0, s);
    await go('#/sales/dashboard'); await press('queue-open', { wait: 600 }); s = await state(); check('needs attention: a row opens the record it names', s.sheets === 1, s); await p.keyboard.press('Escape'); await settle();
    await go('#/sales/dashboard'); await press('tab-sales'); await press('menu-sales-new-enquiry', { wait: 600 }); s = await state(); check('quick action: New enquiry opens the form on Enquiries', s.hash === '#/sales/enquiries' && s.sheets === 1, s); await p.keyboard.press('Escape'); await settle();
    await go('#/sales/dashboard'); await press('tab-library'); s = await state(); check('the bar: Library crosses from sales to the library', s.hash === '#/library/month', s); await p.keyboard.press('Escape'); await settle();
    await go('#/sales/dashboard'); await press('menu'); await press('rail-sign-out', { wait: 700 }); s = await state(); check('the rail: Sign out lands on the door', s.hash === '#/login', s); await signIn(p, base);
  });

  /* ── enquiries ── */
  await sheetBack('new enquiry', '#/sales/dashboard', '#/sales/enquiries', async () => { await press('enquiry-new'); });
  await sheetBack('an enquiry', '#/sales/dashboard', '#/sales/enquiries', async () => { await press('enquiries-view-board'); await press('enquiry-open'); });
  await flow('enquiries', async () => {
    await go('#/sales/enquiries'); await press('enquiries-view-list'); check('enquiries: List is one tap and marks itself pressed', (await loc('enquiries-view-list').getAttribute('aria-pressed')) === 'true' && await p.locator('.list.phone .li').count() > 0);
    const rows0 = await p.locator('.list.phone .li').count(); await press('show-more'); const rows1 = await p.locator('.list.phone .li').count(); await press('show-more'); const rows2 = await p.locator('.list.phone .li').count();
    check('enquiries list: thirty rows, then thirty more each time the button is pressed', rows0 === 30 && rows1 === 60 && rows2 === 90, [rows0, rows1, rows2]);
    await press('enquiries-view-board'); const c0 = await p.locator('.col').first().locator('.dc').count(); await press('enquiries-column-more'); const c1 = await p.locator('.col').first().locator('.dc').count();
    check('enquiries board: a column draws fifteen cards, then the next fifteen', c0 === 15 && c1 === 30, [c0, c1]);
    await press('enquiry-new'); await press('enquiry-add', { scope: '.drawer.on' });
    let m = await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => ''); let s = await state();
    check('new enquiry: with no name the form stays, and the reason is written inside the action bar', /name/.test(m || '') && s.sheets === 1, m);
    await type('#en-name', 'Click Path Co'); await type('#en-wants', 'Forty hampers'); await press('enquiry-add-cancel', { scope: '.drawer.on' });
    await press('enquiry-new'); const keptName = await p.locator('#en-name').inputValue(); const note = await p.locator('.drawer.on .kept').count();
    check('new enquiry: what was typed is still there after Cancel, and the sheet says so', keptName === 'Click Path Co' && note === 1, [keptName, note]);
    await press('enquiry-draft-clear', { scope: '.drawer.on' }); check('new enquiry: Start again empties the form', (await p.locator('#en-name').inputValue()) === '' && await p.locator('.drawer.on .kept').count() === 0);
    await type('#en-name', 'Click Path Co'); await type('#en-phone', '0771112222'); await press('enquiry-add', { scope: '.drawer.on' }); s = await state();
    check('new enquiry: Add closes the sheet, lets the page go and says it was added', s.sheets === 0 && !s.locked && /Click Path Co added/.test(s.toast), s);
    await press('enquiry-new'); await type('#en-name', 'Straight To Deal'); await press('enquiry-add-start', { scope: '.drawer.on', wait: 500 }); s = await state();
    check('new enquiry: Add and start a deal puts it in the pipeline', /in your pipeline/.test(s.toast) && s.sheets === 0, s);
    await press('toast-open'); s = await state(); check('toast: See it goes to the pipeline', s.hash === '#/sales/pipeline', s);
    await go('#/sales/enquiries'); await press('enquiries-view-list'); await p.locator('.fb-q input:visible').fill('Click Path'); await settle(); await press('enquiry-open');
    await press('sheet-edit', { scope: '.drawer.on' }); await type('#ee-wants', 'Fifty hampers'); await press('enquiry-edit-cancel', { scope: '.drawer.on' });
    check('an enquiry: Cancel in edit drops the change and shows the record again', await p.locator('.drawer.on dl.facts').count() === 1 && !/Fifty/.test(await p.locator('.drawer.on').textContent()));
    await press('sheet-edit', { scope: '.drawer.on' }); await type('#ee-wants', 'Sixty hampers'); await press('enquiry-save', { scope: '.drawer.on' });
    check('an enquiry: Save changes writes the change and shows the record', /Sixty hampers/.test(await p.locator('.drawer.on dl.facts').textContent()));
    const n = outside.length; await press('enquiry-whatsapp', { scope: '.drawer.on' }); await settle(500);
    check('an enquiry: WhatsApp opens their number and the enquiry moves to Talking', outside.length === n + 1 && /wa\.me\/94771112222/.test(outside.slice(-1)[0]) && /Talking/.test(await p.locator('.drawer.on .sheet-pills').textContent()), outside.slice(-1)[0]);
    await press('enquiry-not-fit', { scope: '.drawer.on' }); check('an enquiry: Not a fit sets it aside, and the main button becomes the way back', /Not a fit/.test(await p.locator('.drawer.on .sheet-pills').textContent()) && await loc('enquiry-reopen', '.drawer.on').count() === 1 && await loc('enquiry-start', '.drawer.on').count() === 0);
    await press('enquiry-reopen', { scope: '.drawer.on' }); check('an enquiry: Put back in Waiting puts it back', /Waiting/.test(await p.locator('.drawer.on .sheet-pills').textContent()));
    await press('enquiry-start', { scope: '.drawer.on', wait: 500 }); s = await state(); check('an enquiry: Start a deal closes the sheet and says where it went', s.sheets === 0 && !s.locked && /in your pipeline/.test(s.toast), s);
    await press('enquiry-open'); check('a started enquiry offers ONE main button, Open the deal', await p.locator('.drawer.on .d-foot .bar > .btn:not(.quiet):not(.ghost)').count() === 1 && await loc('enquiry-open-deal', '.drawer.on').count() === 1);
    await press('enquiry-open-deal', { scope: '.drawer.on', wait: 700 }); s = await state(); check('Open the deal lands on the pipeline with that deal open and the page held once', s.hash === '#/sales/pipeline' && s.sheets === 1 && s.locked, s);
    await p.waitForTimeout(800); s = await state(); check('the deal sheet is still open a moment later: it did not close itself', s.sheets === 1, s);
    await back(); s = await state(); check('Back closes the deal and the page scrolls again', s.sheets === 0 && !s.locked, s);
    await go('#/sales/enquiries'); await press('enquiry-open'); await press('enquiry-remove', { scope: '.drawer.on' }); s = await state(); check('Remove asks first, in the app\'s own sheet', s.sheets === 2, s);
    await press('ask-no'); s = await state(); check('the question answered No leaves the record open and untouched', s.sheets === 1, s);
    await press('enquiry-remove', { scope: '.drawer.on' }); await press('ask-yes', { wait: 600 }); s = await state(); check('the question answered Yes removes it, closes both sheets and lets the page go', s.sheets === 0 && !s.locked && /removed/.test(s.toast), s);
    await press('enquiry-open'); await press('sheet-close', { scope: '.drawer.on' }); s = await state(); check('the X closes a sheet', s.sheets === 0 && !s.locked, s);
    await p.locator('.fb-q input:visible').fill(''); await press('filter-open'); await pick('filter-sheet-status', 'closed', '.drawer.on'); await pick('filter-sheet-source', 'Website', '.drawer.on'); await pick('filter-sheet-when', '30', '.drawer.on');
    const label = await loc('filter-show', '.drawer.on').textContent(); await press('filter-show', { scope: '.drawer.on' }); const shownRows = await p.locator('.list.phone .li').count();
    check('filters: the main button says how many will show, and that many show', new RegExp('Show ' + shownRows + ' ').test(label || ''), [label, shownRows]);
    await press('filter-open'); await press('filter-clear-all', { scope: '.drawer.on' }); await p.keyboard.press('Escape'); await settle();
    await press('tab-sales'); await press('menu-sales-enquiries'); await press('enquiries-view-board'); check('enquiries: Board shows the board', await p.locator('.board').count() === 1);
    await press('enquiries-view-list'); check('enquiries: List shows the list', await p.locator('.list.phone').count() === 1);
    await press('enquiry-new', { wait: 600 }); s = await state(); check('enquiries: New enquiry opens the form', s.sheets === 1, s); await p.keyboard.press('Escape'); await settle();
  });

  /* ── pipeline ── */
  await sheetBack('new deal', '#/sales/dashboard', '#/sales/pipeline', async () => { await press('deal-new'); });
  await sheetBack('a deal', '#/sales/dashboard', '#/sales/pipeline', async () => { await press('pipeline-view-board'); await press('deal-open'); });
  await flow('pipeline', async () => {
    await go('#/sales/pipeline'); await press('pipeline-view-list'); check('pipeline: List is one tap', await p.locator('.list.phone .li').count() === 30);
    await press('pipeline-view-board'); const c0 = await p.locator('.col').first().locator('.dc').count(); await press('pipeline-column-more'); const c1 = await p.locator('.col').first().locator('.dc').count();
    check('pipeline board: a column draws fifteen cards, then the next fifteen', c0 === 15 && c1 === 30, [c0, c1]);
    await press('deal-new'); await press('deal-add', { scope: '.drawer.on' }); check('new deal: with no name the reason is written inside the action bar', /who/.test(await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => '') || ''));
    await type('#dl-name', 'Path Deal Ltd'); await press('deal-add-cancel', { scope: '.drawer.on' }); await press('deal-new'); check('new deal: the draft is kept after Cancel', (await p.locator('#dl-name').inputValue()) === 'Path Deal Ltd');
    await press('deal-draft-clear', { scope: '.drawer.on' }); await type('#dl-name', 'Path Deal Ltd'); await type('#dl-phone', '0719990000'); await type('#dl-value', '90000'); await press('deal-add', { scope: '.drawer.on', wait: 600 });
    let s = await state(); await p.waitForTimeout(800); const s2 = await state();
    check('new deal: Add opens the deal it made, and that sheet stays open', s.sheets === 1 && s2.sheets === 1 && /Path Deal Ltd/.test(await p.locator('.drawer.on .d-head h3').textContent()), [s.sheets, s2.sheets]);
    await press('deal-stage', { scope: '.drawer.on', nth: 1 }); check('a deal: a tap on the ladder moves the stage and marks it', (await loc('deal-stage', '.drawer.on').nth(1).getAttribute('aria-pressed')) === 'true');
    const t0 = await p.locator('.drawer.on .tr-row').count(); await press('deal-log-call', { scope: '.drawer.on' }); await press('deal-log-meet', { scope: '.drawer.on' }); await p.locator('.drawer.on .note-add input').fill('Asked for samples'); await press('deal-note-add', { scope: '.drawer.on' }); const t1 = await p.locator('.drawer.on .tr-row').count();
    check('a deal: Called, Met and a note each land on the trail', t1 === t0 + 3 && /Asked for samples/.test(await p.locator('.drawer.on .trail').textContent()), [t0, t1]);
    const n = outside.length; await press('deal-whatsapp', { scope: '.drawer.on' }); await settle(500); check('a deal: WhatsApp opens their number', outside.length === n + 1 && /wa\.me\/94719990000/.test(outside.slice(-1)[0]), outside.slice(-1)[0]);
    await press('sheet-edit', { scope: '.drawer.on' }); await type('#de-next', 'Send samples'); await press('deal-edit-cancel', { scope: '.drawer.on' }); await press('sheet-edit', { scope: '.drawer.on' }); await type('#de-next', 'Post the samples'); await press('deal-save', { scope: '.drawer.on' });
    check('a deal: Save changes writes the next step', /Post the samples/.test(await p.locator('.drawer.on dl.facts').textContent()));
    await press('deal-lost', { scope: '.drawer.on' }); s = await state(); check('Mark lost asks why, in a sheet above the deal', s.sheets === 2, s); await press('ask-no'); check('Keep it open leaves the deal open', (await state()).sheets === 1 && await loc('deal-won', '.drawer.on').count() === 1);
    await press('deal-lost', { scope: '.drawer.on' }); await press('ask-pick', { nth: 0 }); check('a reason marks it lost, and the main button becomes Reopen', /Lost/.test(await p.locator('.drawer.on .sheet-pills').textContent()) && await loc('deal-reopen', '.drawer.on').count() === 1 && await loc('deal-won', '.drawer.on').count() === 0);
    await press('deal-reopen', { scope: '.drawer.on' }); check('Reopen puts it back in the first stage', await loc('deal-won', '.drawer.on').count() === 1);
    await press('deal-won', { scope: '.drawer.on', wait: 600 }); s = await state(); check('Mark won makes the customer and says so', /now a customer/.test(s.toast), s.toast);
    await press('deal-remove', { scope: '.drawer.on' }); await press('ask-yes', { wait: 600 }); s = await state(); check('Remove, confirmed, closes the deal and lets the page go', s.sheets === 0 && !s.locked, s);
    await press('tab-sales'); await press('menu-sales-pipeline'); for (const k of ['board', 'list']) await press('pipeline-view-' + k);
    await press('deal-new', { wait: 600 }); check('pipeline: New deal opens the form', (await state()).sheets === 1); await p.keyboard.press('Escape'); await settle();
  });

  /* ── customers ── */
  await sheetBack('new customer', '#/sales/dashboard', '#/sales/customers', async () => { await press('customer-new'); });
  await sheetBack('a customer', '#/sales/dashboard', '#/sales/customers', async () => { await press('customer-open'); });
  await flow('customers', async () => {
    await go('#/sales/customers'); await press('customer-new'); await press('customer-add', { scope: '.drawer.on' }); check('new customer: with no name the reason is written inside the action bar', /name/.test(await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => '') || ''));
    await type('#cu-name', 'Path Customer'); await press('customer-add-cancel', { scope: '.drawer.on' }); await press('customer-new'); check('new customer: the draft is kept after Cancel', (await p.locator('#cu-name').inputValue()) === 'Path Customer');
    await press('customer-draft-clear', { scope: '.drawer.on' }); await type('#cu-name', 'Path Customer'); await type('#cu-phone', '0112223334'); await type('#cu-value', '45000'); await press('customer-add', { scope: '.drawer.on' });
    let s = await state(); check('new customer: Add closes the sheet and says it was added', s.sheets === 0 && /Path Customer added/.test(s.toast), s);
    await p.locator('.fb-q input:visible').fill('Path Customer'); await settle(); await press('customer-open'); await press('sheet-edit', { scope: '.drawer.on' }); await type('#ce-notes', 'Pays on delivery'); await press('customer-edit-cancel', { scope: '.drawer.on' });
    await press('sheet-edit', { scope: '.drawer.on' }); await type('#ce-notes', 'Pays on the day'); await press('customer-save', { scope: '.drawer.on' }); check('a customer: Save changes writes the note', /Pays on the day/.test(await p.locator('.drawer.on dl.facts').textContent()));
    await press('customer-spoke', { scope: '.drawer.on' }); check('a customer: Spoke today says so', /spoken to today/.test((await state()).toast));
    const n = outside.length; await press('customer-whatsapp', { scope: '.drawer.on' }); await settle(500); check('a customer: WhatsApp opens their number', outside.length === n + 1 && /wa\.me\/94112223334/.test(outside.slice(-1)[0]), outside.slice(-1)[0]);
    await press('customer-remove', { scope: '.drawer.on' }); await press('ask-yes', { wait: 600 }); s = await state(); check('a customer: Remove, confirmed, closes the sheet and lets the page go', s.sheets === 0 && !s.locked, s);
    await p.locator('.fb-q input:visible').fill(''); await press('filter-open'); await pick('filter-sheet-touch', 'quiet', '.drawer.on'); await pick('filter-sheet-sort', 'value', '.drawer.on'); await press('filter-show', { scope: '.drawer.on' });
    check('customers: the quiet filter shows only the quiet ones', await p.locator('.list.phone .li').count() === 1, await p.locator('.list.phone .li').count()); await press('filter-open'); await press('filter-clear-all', { scope: '.drawer.on' }); await p.keyboard.press('Escape'); await settle();
    await press('tab-sales'); await press('menu-sales-customers'); await press('customer-new', { wait: 600 }); check('customers: New customer opens the form', (await state()).sheets === 1); await p.keyboard.press('Escape'); await settle();
  });

  /* ── tasks ── */
  await sheetBack('new task', '#/sales/dashboard', '#/sales/follow-ups', async () => { await press('followup-new'); });
  await sheetBack('a task', '#/sales/dashboard', '#/sales/follow-ups', async () => { await press('followup-open'); });
  await flow('tasks', async () => {
    await go('#/sales/follow-ups'); await press('followup-new'); await press('followup-add', { scope: '.drawer.on' }); check('new task: with no words the reason is written inside the action bar', /happen/.test(await p.locator('.drawer.on .d-foot .msg').textContent().catch(() => '') || ''));
    await type('#fu-text', 'Walk the click path'); await press('followup-add-cancel', { scope: '.drawer.on' }); await press('followup-new'); check('new task: the draft is kept after Cancel', (await p.locator('#fu-text').inputValue()) === 'Walk the click path');
    await press('followup-draft-clear', { scope: '.drawer.on' }); await type('#fu-text', 'Walk the click path'); await press('followup-add', { scope: '.drawer.on' }); let s = await state(); check('new task: Add closes the sheet and says it was added', s.sheets === 0 && /Follow up added/.test(s.toast), s);
    const open0 = await p.locator('.list .li').count(); await press('followup-tick'); const open1 = await p.locator('.list .li').count(); check('tasks: the tick marks a task done and it leaves the open list', open1 === open0 - 1, [open0, open1]);
    await press('followup-open'); await press('sheet-edit', { scope: '.drawer.on' }); await type('#fe-text', 'Walk it again'); await press('followup-edit-cancel', { scope: '.drawer.on' }); await press('sheet-edit', { scope: '.drawer.on' }); await type('#fe-text', 'Walk it twice'); await press('followup-save', { scope: '.drawer.on' });
    check('a task: Save changes writes the words', /Walk it twice/.test(await p.locator('.drawer.on .d-head h3').textContent()));
    await press('followup-done', { scope: '.drawer.on' }); s = await state(); check('a task: Mark done closes the sheet and says Done', s.sheets === 0 && /Done/.test(s.toast), s);
    await press('followup-open'); await press('followup-remove', { scope: '.drawer.on' }); await press('ask-yes', { wait: 600 }); s = await state(); check('a task: Remove, confirmed, closes the sheet and lets the page go', s.sheets === 0 && !s.locked, s);
    await press('filter-open'); await pick('filter-sheet-show', 'done', '.drawer.on'); await pick('filter-sheet-who', 'Amara', '.drawer.on'); await press('filter-clear-all', { scope: '.drawer.on' }); await p.keyboard.press('Escape'); await settle();
    for (const k of ['dashboard', 'enquiries', 'pipeline', 'customers', 'follow-ups']) { await press('tab-sales'); await press('menu-sales-' + k); await settle(200); }
    const top = await p.evaluate(() => scrollY); check('a screen opened from another opens at its own top', top === 0, top);
  });
  /* pipeline filters on a phone */
  await flow('pipeline filters', async () => { await go('#/sales/pipeline'); await press('pipeline-view-list'); await press('filter-open'); await pick('filter-sheet-stage', 'won', '.drawer.on'); await pick('filter-sheet-quiet', '5', '.drawer.on'); await press('filter-clear-all', { scope: '.drawer.on' }); await p.keyboard.press('Escape'); await settle(); });
  await w.c.close();
}

/* ═══ DESK: what only a desk shows ═══ */
{ const w = await world(true); const { p, press, pick, go, state, flow, settle, loc } = w;
  await signIn(p, base);
  await flow('desk', async () => {
    await go('#/sales/enquiries'); await press('enquiries-view-list'); await pick('filter-status', 'new'); await pick('filter-source', 'Website'); await pick('filter-when', '30');
    const n = await p.locator('table.tbl tbody tr').count(); check('desk filters: the list follows the dropdowns at once', n === 30, n);
    await press('filter-clear'); check('desk filters: Clear empties every filter and the search', (await loc('filter-status').inputValue()) === '' && await loc('filter-clear').count() === 0);
    await press('enquiry-start-row', { wait: 500 }); check('desk: Start in a row puts it in the pipeline without opening the row', (await state()).sheets === 0 && /in your pipeline/.test((await state()).toast), await state());
    await press('enquiry-open'); check('desk: a row opens its record', (await state()).sheets === 1); await p.keyboard.press('Escape'); await settle();
    await go('#/sales/pipeline'); await press('pipeline-view-list'); await pick('filter-stage', 'all'); await pick('filter-quiet', '5'); await press('filter-clear');
    const first = () => p.locator('table.tbl tbody tr').first().locator('strong').textContent();
    await press('pipeline-sort-name'); const a = await first(); await press('pipeline-sort-name'); const b = await first();
    check('desk: a column head sorts, and again reverses, and says which way', a !== b && /ascending|descending/.test(await p.locator('th[aria-sort]').first().getAttribute('aria-sort') || ''), [a, b]);
    await press('pipeline-sort-stage'); await press('pipeline-sort-value'); await press('pipeline-sort-quiet');
    const sel = loc('deal-stage-row').first(); const was = await sel.inputValue(); await pick('deal-stage-row', 'lost'); let s = await state(); check('desk: Lost from a row asks why first', s.sheets === 1, s);
    await press('ask-no'); check('desk: the question called off puts the stage box back where it was', (await loc('deal-stage-row').first().inputValue()) === was, [was, await loc('deal-stage-row').first().inputValue()]);
    await press('deal-open'); check('desk: a row opens its deal', (await state()).sheets === 1); await p.keyboard.press('Escape'); await settle();
    await go('#/sales/customers'); await pick('filter-touch', 'quiet'); await pick('filter-sort', 'name'); await press('filter-clear'); await press('customer-open'); await p.keyboard.press('Escape'); await settle();
    await go('#/sales/follow-ups'); await pick('filter-show', 'all'); await pick('filter-who', 'Amara'); await press('filter-clear');
    await go('#/posts'); await press('wpost-view-list'); await pick('filter-platform', 'Facebook'); const fb = await p.locator('[data-act="wpost-open"]').count(); await press('filter-clear');
    check('desk filters: Posts follow the platform', fb >= 1 && fb < (await p.locator('[data-act="wpost-open"]').count()), fb);
  });
  await w.c.close();
}
await browser.close(); srv.close();

/* ── 3. NAME what was never pressed ── */
const never = [...ALL].filter(a => !pressed.has(a)).sort();
const stray = [...pressed].filter(a => !ALL.has(a)).sort();
console.log('\nCLICK PATH: ' + ALL.size + ' actions counted in the source, ' + (ALL.size - never.length) + ' pressed by a real tap or click. Not pressed: ' + (never.join(', ') || 'none'));
check('click path: every action counted in the source was pressed in this run', never.length === 0, (ALL.size - never.length) + ' of ' + ALL.size + (never.length ? ', missing ' + never.join(', ') : ''));
check('click path: nothing was pressed that the count did not know about', stray.length === 0, stray.join(', ') || 'none');
check('click path: every tag that acts carries a name, so nothing a finger can press goes uncounted', unnamed.length === 0, unnamed.slice(0, 4).join(' ; ') || 'none');
check('no page errors in the whole run', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' ; ') || 'none');
const bad = results.filter(r => !r.pass);
console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' passed.'); bad.forEach(b => console.log('   FAIL ' + b.name));
process.exit(bad.length ? 1 : 0);
