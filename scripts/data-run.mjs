#!/usr/bin/env node
/* THE DATA RUN. The Hub against a server that behaves like the real database:
     it hands over 1,000 rows at most per request and says nothing about the rest;
     it can be slow (every answer held four seconds), absent (no connection) or done with you (401).
   Proves laws 8 to 11: every list read is paged, lists draw a window, the screen opens from the
   last safe copy on the device and nothing a person typed is ever lost.
   The API is MOCKED here, so this proves the app, not the server (the server is proven by
   scripts/tenant-wall.mjs against the real code in memory mode).
     node scripts/data-run.mjs [rows-per-kind]      exits 1 on any failure */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium, serve, PHONE_UA, ROOT } from './lib/world.mjs';
const N = Number(process.argv[2] || 5000), CAP = 1000;
const results = []; const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (saw !== undefined ? '  [saw: ' + (typeof saw === 'string' ? saw : JSON.stringify(saw)) + ']' : '')); };
const cast = JSON.parse(fs.readFileSync(path.join(ROOT, 'casts/demo.json'), 'utf8')); delete cast.pin; cast.data = { mode: 'api' };
const ago = h => new Date(Date.now() - h * 36e5).toISOString();
const stages = ['talking', 'quoted', 'closing', 'won', 'lost'], st = ['new', 'contacted', 'converted', 'closed'];
const db = {
  enquiries: Array.from({ length: N }, (_, i) => ({ id: 'e' + i, name: 'Enquiry ' + i, phone: '077' + String(1000000 + i), wants: 'Row ' + i, source: 'Website', status: st[i % 4], createdAt: ago(i), updatedAt: ago(i) })),
  deals: Array.from({ length: N }, (_, i) => ({ id: 'd' + i, name: 'Deal ' + i, stage: stages[i % 5], value: 1000 + i, wants: 'Row ' + i, stageAt: ago(i), lastContactAt: ago(i), createdAt: ago(i), updatedAt: ago(i) })),
  customers: Array.from({ length: N }, (_, i) => ({ id: 'c' + i, name: 'Customer ' + i, value: 5000 + i, bought: 'Row ' + i, since: ago(i).slice(0, 10), createdAt: ago(i), updatedAt: ago(i) })),
  tasks: Array.from({ length: N }, (_, i) => ({ id: 't' + i, text: 'Task ' + i, done: i % 3 === 0, due: ago(i - 48).slice(0, 10), dealId: 'd' + i, createdAt: ago(i), updatedAt: ago(i) })),
  activities: Array.from({ length: N }, (_, i) => ({ id: 'a' + i, dealId: 'd' + (i % 50), type: 'note', summary: 'Note ' + i, createdAt: ago(i), updatedAt: ago(i) }))
};
let hold = 0, down = false, gone = false; const reads = [], writes = [], seen = [];
const api = http.createServer(async (q, r) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
  if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
  if (down) { q.socket.destroy(); return; }
  const u = new URL(q.url, 'http://x'); const parts = u.pathname.split('/').filter(Boolean); let body = ''; for await (const c of q) body += c;
  const send = async (code, obj) => { if (hold) await new Promise(z => setTimeout(z, hold)); r.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); r.end(JSON.stringify(obj)); };
  if (u.pathname === '/api/login') { const j = JSON.parse(body || '{}'); if (j.business === 'other.lk' && j.code === 'HARNESS2') return send(200, { token: 'tok-other', slug: 'other', seat: 'Owner', cast: { ...cast, slug: 'other', name: 'Other Test Client' } });
    return j.business && j.code === 'HARNESS1' ? send(200, { token: 'tok-harness', slug: 'demo', seat: 'Amara', cast }) : send(401, { error: 'That business name and code do not match.' }); }
  if (parts[1] === 'other') { if (q.headers.authorization !== 'Bearer tok-other') return send(401, { error: 'Sign in again' }); if (parts[2] === 'cast') return send(200, { ...cast, slug: 'other', name: 'Other Test Client' }); if (q.method === 'GET') { reads.push({ kind: parts[2], limit: u.searchParams.get('limit'), offset: u.searchParams.get('offset'), rows: 0 }); return send(200, []); } return send(404, {}); }
  if (gone || q.headers.authorization !== 'Bearer tok-harness' || parts[1] !== 'demo') return send(401, { error: 'Sign in again' });
  if (parts[2] === 'cast') return send(200, cast);
  if (parts[2] === 'seen') { seen.push(JSON.parse(body || '{}')); return send(201, { ok: true }); }
  const kind = parts[2], rows = db[kind]; if (!rows) return send(404, { error: 'Unknown table' });
  if (q.method === 'GET') { const lim = u.searchParams.get('limit'), off = Number(u.searchParams.get('offset') || 0); const n = Math.min(Number(lim || CAP), CAP); const out = rows.slice(off, off + n); reads.push({ kind, limit: lim, offset: u.searchParams.get('offset'), rows: out.length }); return send(200, out); }
  writes.push({ method: q.method, kind, id: parts[3] || '' });
  if (q.method === 'POST') { const row = { ...JSON.parse(body), id: 'srv' + writes.length, by: 'Amara' }; rows.unshift(row); return send(201, row); }
  if (q.method === 'PATCH') { const i = rows.findIndex(x => x.id === parts[3]); if (i < 0) return send(404, {}); rows[i] = { ...rows[i], ...JSON.parse(body), updatedAt: new Date().toISOString() }; return send(200, rows[i]); }
  if (q.method === 'DELETE') { const i = rows.findIndex(x => x.id === parts[3]); if (i >= 0) rows.splice(i, 1); r.writeHead(204, cors); return r.end(); }
}).listen(0);
const API = 'http://127.0.0.1:' + api.address().port;
const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/web/dist/web/browser/version.json'), 'utf8')).build; let liveStamp = REAL; const asked = [];
const { srv, base } = serve(undefined, { 'config.json': JSON.stringify({ api: API, bbWa: '94767412531' }), 'version.json': () => { asked.push(Date.now()); return JSON.stringify({ build: liveStamp }); } }); const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: PHONE_UA });
await ctx.route('**/fonts.g*/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errors = []; const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e)));
const URL0 = base;
const held = () => p.evaluate(() => window.__hub.held());
const els = () => p.evaluate(() => document.querySelectorAll('*').length);
const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(500); };
const kinds = Object.keys(db);
/* a COLD open: the app is closed and opened again, never a move inside the page that is already open */
const cold = async h => { await p.goto('about:blank'); await p.goto(base + h); };

/* 1. THE DOOR, then the first open with nothing on the device and a slow server: the SHAPE of the content */
hold = 1500;
await p.goto(URL0); await p.waitForSelector('#biz'); await p.fill('#biz', 'cinnamon.lk'); await p.fill('#pin', 'WRONG'); await p.locator('.enter').tap();
await p.waitForSelector('.door .err'); check('door, on the server: a wrong code is refused in words', /do not match/.test(await p.locator('.door .err').textContent()));
await p.fill('#pin', 'HARNESS1'); const t0 = Date.now(); await p.locator('.enter').tap(); await p.waitForFunction(() => /#\/start/.test(location.hash), null, { timeout: 20000 });
const toLauncher = Date.now() - t0;
await go('#/sales/customers'); const skel = await p.locator('.skel').count(), loadingNow = await p.evaluate(() => window.__hub.loading());
check('first open, nothing on the device, slow server: the door opens without waiting for the rows and the list draws the SHAPE of its content', skel === 1 && loadingNow && toLauncher < 3500, { skeleton: skel, loading: loadingNow, doorToLauncherMs: toLauncher });
hold = 0; await p.waitForFunction(n => window.__hub.held().customers === n, N, { timeout: 120000 });

/* 2. CAPACITY */
const h = await held();
check('capacity: all ' + N.toLocaleString('en-GB') + ' rows of every kind are held, none lost at row 1,001', kinds.every(k => h[k] === N), h);
const unpaged = reads.filter(x => x.limit === null || x.offset === null), over = reads.filter(x => Number(x.limit) > CAP);
check('every list read names a limit and an offset, and none asks for more than the database gives', reads.length > 0 && unpaged.length === 0 && over.length === 0, { reads: reads.length, unpaged: unpaged.length, over: over.length, perKind: reads.filter(x => x.kind === 'deals').length });
const drawn = {};
for (const [name, hash, sel] of [['dashboard', '#/sales/dashboard', '.kpi'], ['enquiries board', '#/sales/enquiries?view=board', '.board .dc'], ['enquiries list', '#/sales/enquiries?view=list', '.list.phone .li'], ['pipeline board', '#/sales/pipeline?view=board', '.board .dc'], ['pipeline list', '#/sales/pipeline?view=list', '.list.phone .li'], ['customers', '#/sales/customers', '.list.phone .li'], ['tasks', '#/sales/tasks', '.list .li']]) {
  const t = Date.now(); await go(hash); await p.waitForSelector(sel, { timeout: 20000 }); drawn[name] = { elements: await els(), rows: await p.locator(sel).count(), ms: Date.now() - t }; }
check('lists draw a window: every screen draws under 1,000 elements with ' + N.toLocaleString('en-GB') + ' rows behind it', Object.values(drawn).every(d => d.elements < 1000), drawn);
check('a list shows thirty rows and says how many there are', drawn.customers.rows === 30 && /Showing 30 of 5,000/.test(await (async () => { await go('#/sales/customers'); return p.locator('.more').textContent(); })()), drawn.customers.rows);
await p.locator('.fb-q input:visible').fill('Customer 4321'); await p.waitForTimeout(400);
check('search reaches every row that is held, not only the thirty drawn', await p.locator('.list.phone .li').count() === 1 && /Customer 4321/.test(await p.locator('.list.phone .li').first().textContent()), await p.locator('.list.phone .li').count());
await p.locator('.fb-q input:visible').fill('');
await go('#/sales/tasks'); await p.locator('[data-act="task-new"]').tap(); await p.waitForSelector('.drawer.on'); const opts = await p.locator('#tk-deal option').count(); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
check('a picker draws thirty choices, never the whole book', opts <= 32, opts + ' options');

/* 3. ONE SAVE READS ONE RECORD */
await go('#/sales/enquiries?view=list'); reads.length = 0; writes.length = 0;
await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on'); await p.fill('#en-name', 'One Save Co'); await p.locator('.drawer.on [data-act="enquiry-add"]').tap(); await p.waitForTimeout(900);
check('one save reads one record: adding an enquiry sends one write and reads no list again', writes.length === 1 && reads.length === 0 && (await held()).enquiries === N + 1, { writes, listReads: reads.length });
await p.waitForTimeout(700);   /* the device copy follows the screen, written behind the paint */

/* 4. THE SECOND OPEN: from the device, with every server answer held for four seconds */
hold = 4000; reads.length = 0;
await p.goto('about:blank'); const t1 = Date.now(); await p.goto(base + '#/sales/customers'); await p.waitForSelector('.list.phone .li', { timeout: 20000 }); const paint = Date.now() - t1;
const from = await p.evaluate(() => window.__hub.from()), h2 = await held(), skel2 = await p.locator('.skel').count();
check('instant open: the first screen paints from the copy on the device while every server answer is held four seconds', paint < 2000 && from === 'device' && h2.customers === N && skel2 === 0, { paintedInMs: paint, from, held: h2.customers, serverAnswered: reads.length });
check('instant open: what was saved a moment before is in that copy', h2.enquiries === N + 1, h2.enquiries);
hold = 0; await p.waitForFunction(() => window.__hub.from() === 'server', null, { timeout: 120000 });
check('then the server is asked for news behind the screen, and the screen follows it', (await p.evaluate(() => window.__hub.from())) === 'server' && reads.length > 0, reads.length + ' reads');
/* 3b. WHO OPENED WHAT: a signed-in seat on the server tells it the app was opened and which library screen was viewed */
await go('#/library/month'); await p.waitForSelector('.page h1'); await go('#/library/videos'); await p.waitForTimeout(600);
check('a visit is recorded on the server: an open with its source (a cold restart is a new open, visits.mjs joins them), each library screen viewed, and never a row a person made', seen.filter(e => e.what === 'open').length >= 1 && seen.filter(e => e.what === 'open').every(e => ['wa', 'app', 'bb', 'direct'].includes(e.src)) && seen.some(e => e.what === 'view' && e.detail === 'month') && seen.some(e => e.what === 'view' && e.detail === 'videos') && seen.every(e => ['open', 'view', 'tap'].includes(e.what) && typeof e.src === 'string'), { events: seen.length, open: seen.filter(e => e.what === 'open').map(e => e.src), views: seen.filter(e => e.what === 'view').map(e => e.detail) });

/* 5. NO CONNECTION */
down = true; await cold('#/sales/customers'); await p.waitForSelector('.list.phone .li', { timeout: 20000 }); await p.waitForFunction(() => window.__hub.offline(), null, { timeout: 20000 });
const line = await p.locator('.offline').textContent();
check('no connection: the rows still show, and one plain line says so', (await held()).customers === N && /No connection/.test(line) && await p.locator('.skel').count() === 0, line.trim());
await p.locator('[data-act="customer-new"]').tap(); await p.waitForSelector('.drawer.on'); await p.fill('#cu-name', 'Written Offline'); await p.locator('.drawer.on [data-act="customer-add"]').tap(); await p.waitForTimeout(900);
const pend = await p.evaluate(() => window.__hub.pending()), waiting = await p.locator('.topbar .off').textContent().catch(() => '');
check('no connection: a save is kept on the device and the top bar says it is waiting', pend === 1 && /1 waiting to sync/.test(waiting) && (await held()).customers === N + 1, { pending: pend, line: waiting });
down = false; writes.length = 0; await p.evaluate(() => dispatchEvent(new Event('online'))); await p.waitForFunction(() => window.__hub.pending() === 0 && !window.__hub.offline(), null, { timeout: 120000 }); await p.waitForTimeout(300);
check('the connection returns: the waiting save reaches the server ONCE and the line goes', writes.filter(w => w.method === 'POST' && w.kind === 'customers').length === 1 && writes.length === 1 && await p.locator('.topbar .off').count() === 0 && !(await p.evaluate(() => window.__hub.offline())), writes);

process.on('uncaughtException', async e => { try { await p.screenshot({ path: path.join(ROOT, 'evidence/data-run-stuck.png') }); console.log('STUCK', await p.evaluate(() => ({ hash: location.hash, held: window.__hub.held(), loading: window.__hub.loading(), sheets: document.querySelectorAll('.drawer.on').length, rows: document.querySelectorAll('[data-act="enquiry-open"]').length, body: document.body.className, view: localStorage.getItem('hub_enq_view'), f: localStorage.getItem('hub_f_enquiries') }))); } catch (x) {} console.error(e); process.exit(1); });
/* 6. NOTHING TYPED IS LOST: a closed sheet, a reload, the app updating itself, a session that ended */
await go('#/sales/enquiries?view=list'); await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on');
await p.fill('#en-name', 'Half Typed Ltd'); await p.fill('#en-wants', 'Nine crates by Friday'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on');
check('a draft survives a closed sheet', (await p.inputValue('#en-name')) === 'Half Typed Ltd' && (await p.inputValue('#en-wants')) === 'Nine crates by Friday');
await p.reload(); await p.waitForSelector('.page h1'); await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on');
check('a draft survives a reload', (await p.inputValue('#en-name')) === 'Half Typed Ltd');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
/* an edit to a record is a draft too */
await p.locator('[data-act="enquiry-open"]:visible').first().tap(); await p.waitForSelector('.drawer.on'); await p.locator('.drawer.on [data-act="sheet-edit"]').tap(); await p.fill('#ee-wants', 'Edited and not saved'); await p.reload(); await p.waitForSelector('.page h1');
await p.locator('[data-act="enquiry-open"]:visible').first().tap(); await p.waitForSelector('.drawer.on');
check('an edit that was not saved survives a reload, and the sheet opens on it', (await p.inputValue('#ee-wants').catch(() => '')) === 'Edited and not saved');
await p.locator('.drawer.on [data-act="enquiry-edit-cancel"]').tap(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
/* the app updates itself: the version file names another build */
/* through the REAL path: the service worker is running and the version file is answered by the server */
const sw = await p.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration()));
let loads = 0; p.on('load', () => loads++); asked.length = 0; liveStamp = '2099-01-01 00:00';
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await p.waitForTimeout(3500);
check('an installed app keeps its first copy: a new build stamp in the small version file reloads the app ONCE, never in a loop', loads === 1 && asked.length >= 2, { reloads: loads, versionFileAsked: asked.length, serviceWorkerRunning: sw });
const pageAsked = []; p.on('request', q => { if (q.resourceType() === 'fetch' && /index\.html|\/$/.test(new URL(q.url()).pathname)) pageAsked.push(q.url()); });
await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1200);
check('coming back to the front asks for the small version file again, and the page never downloads itself to read a stamp', asked.length >= 3 && pageAsked.length === 0 && loads === 1, { versionFileAsked: asked.length, pageDownloads: pageAsked.length, reloads: loads });
liveStamp = REAL;
await p.waitForSelector('.page h1'); await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on');
check('a draft survives the app updating itself', (await p.inputValue('#en-name')) === 'Half Typed Ltd');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
const stamp = await p.evaluate(async () => (await (await fetch('version.json?x=' + Date.now(), { cache: 'no-store' })).json()).build); await p.locator('[data-act="menu"]').tap(); await p.waitForSelector('.rail.open');
const shownStamp = (await p.locator('.r-build').textContent()).replace('Build ', '').trim(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
check('the build stamp is one stamp: in the app, in the version file, and written where a person can read it out', stamp === shownStamp && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(stamp), { versionFile: stamp, onScreen: shownStamp });
/* the session ends */
gone = true; await cold('#/sales/tasks'); await p.waitForFunction(() => /#\/login/.test(location.hash), null, { timeout: 20000 });
const why = await p.locator('.door .err').textContent().catch(() => '');
check('a session the server no longer accepts goes to the door with a word why', /session ended/i.test(why), why);
gone = false; await p.fill('#biz', 'cinnamon.lk'); await p.fill('#pin', 'HARNESS1'); await p.locator('.enter').tap(); await p.waitForFunction(() => /#\/start/.test(location.hash));
await go('#/sales/enquiries?view=list'); await p.waitForSelector('.list.phone .li'); await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on');
check('a draft survives the sign in card', (await p.inputValue('#en-name')) === 'Half Typed Ltd' && (await p.inputValue('#en-wants')) === 'Nine crates by Friday');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);

/* 6b. ANOTHER CLIENT ON THE SAME DEVICE after the first one's session ended without a sign out */
await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on'); await p.fill('#en-name', 'Left Behind Ltd'); await p.keyboard.press('Escape'); await p.waitForTimeout(700);
gone = true; await cold('#/sales/tasks'); await p.waitForFunction(() => /#\/login/.test(location.hash), null, { timeout: 20000 }); gone = false;
const idb = () => p.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open('hub_copy', 1); r.onupgradeneeded = () => r.result.createObjectStore('rows'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const keys = await new Promise(res => { const q = db.transaction('rows').objectStore('rows').getAllKeys(); q.onsuccess = () => res(q.result); }); db.close(); return keys.map(String); });
const leftCopy = await idb();
await p.fill('#biz', 'other.lk'); await p.fill('#pin', 'HARNESS2'); await p.locator('.enter').tap(); await p.waitForFunction(() => /#\/start/.test(location.hash));
const nowCopy = await idb(), leftDrafts = await p.evaluate(() => Object.keys(localStorage).filter(k => /^hub_(draft|outbox)_demo/.test(k)));
await go('#/sales/customers'); await p.waitForTimeout(600); const otherSees = await held();
check('another client signs in on the same device: everything the first one left is removed before they see a screen', leftCopy.filter(k => k.startsWith('demo:')).length === 5 && nowCopy.filter(k => k.startsWith('demo:')).length === 0 && leftDrafts.length === 0 && otherSees.customers === 0 && otherSees.enquiries === 0, { before: leftCopy.length, after: nowCopy.filter(k => k.startsWith('demo:')).length, draftsLeft: leftDrafts.length, otherSees });
await p.locator('[data-act="menu"]').tap(); await p.waitForSelector('.rail.open'); await p.locator('[data-act="rail-sign-out"]').tap(); await p.waitForFunction(() => /#\/login/.test(location.hash));
await p.fill('#biz', 'cinnamon.lk'); await p.fill('#pin', 'HARNESS1'); await p.locator('.enter').tap(); await p.waitForFunction(() => /#\/start/.test(location.hash));
await go('#/sales/enquiries?view=list'); await p.waitForFunction(n => window.__hub.held().customers >= n, N, { timeout: 120000 }); await p.locator('[data-act="enquiry-new"]').tap(); await p.waitForSelector('.drawer.on'); await p.fill('#en-name', 'A draft to clear'); await p.keyboard.press('Escape'); await p.waitForTimeout(700);

/* 7. SIGNING OUT LEAVES NOTHING BEHIND */
const before = await p.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open('hub_copy', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const keys = await new Promise(res => { const q = db.transaction('rows').objectStore('rows').getAllKeys(); q.onsuccess = () => res(q.result); }); db.close(); return { copy: keys, drafts: Object.keys(localStorage).filter(k => k.startsWith('hub_draft_')), session: !!localStorage.getItem('hub_session') }; });
await p.locator('[data-act="menu"]').tap(); await p.waitForSelector('.rail.open'); await p.locator('[data-act="rail-sign-out"]').tap(); await p.waitForFunction(() => /#\/login/.test(location.hash));
const after = await p.evaluate(async () => { const db = await new Promise((res, rej) => { const r = indexedDB.open('hub_copy', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); const keys = await new Promise(res => { const q = db.transaction('rows').objectStore('rows').getAllKeys(); q.onsuccess = () => res(q.result); }); db.close(); return { copy: keys, drafts: Object.keys(localStorage).filter(k => k.startsWith('hub_draft_')), outbox: Object.keys(localStorage).filter(k => k.startsWith('hub_outbox_')), session: !!localStorage.getItem('hub_session'), everything: JSON.stringify(localStorage) }; });
check('the check could see the device copy before sign out: five kinds were held', before.copy.length === 5 && before.drafts.length >= 1 && before.session, { copy: before.copy.length, drafts: before.drafts.length });
check('signing out removes the device copy, the drafts, the unsent writes and the seat', after.copy.length === 0 && after.drafts.length === 0 && after.outbox.length === 0 && !after.session, { copy: after.copy.length, drafts: after.drafts.length, outbox: after.outbox.length, session: after.session });
check('nothing left on the device names a customer, a deal or a token', !/Customer \d|Deal \d|tok-harness|Half Typed|A draft to clear/.test(after.everything), after.everything.slice(0, 160));

check('no page errors in the whole run', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' ; ') || 'none');
await browser.close(); srv.close(); api.close();
const bad = results.filter(r => !r.pass);
console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' passed.'); bad.forEach(b => console.log('   FAIL ' + b.name));
process.exit(bad.length ? 1 : 0);
