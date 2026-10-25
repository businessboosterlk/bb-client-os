#!/usr/bin/env node
/* THE TEAM'S PANEL, IN A REAL BROWSER (Stage 2, 25 Oct 2026). Thulaib: BB runs every client's Hub from its own systems. The
   panel block (~/bb-systems/hub-panel/hub-panel.js) on a host page standing in for the SMM Workspace or the Command Centre, and
   the client's own Hub app beside it, both against the REAL API code (memory mode) and the REAL live channel (HUB_LIVE_TEST=1).
     node scripts/panel-live.mjs        exits 1 when any check fails; pictures in evidence/stage2-panel/ */
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { chromium, ROOT, DIST, serve, context } from './lib/world.mjs';
const results = []; const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass && saw !== undefined ? '  [saw: ' + JSON.stringify(saw).slice(0, 240) + ']' : '')); };
const env = Object.fromEntries(fs.readFileSync(process.env.HOME + '/.bb-secrets/engine.env', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const EVID = path.join(ROOT, 'evidence/stage2-panel'); fs.mkdirSync(EVID, { recursive: true });
const PANEL = path.join(process.env.HOME, 'bb-systems/hub-panel');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-panel-'));
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'casts/demo.json'), 'utf8'));
fs.writeFileSync(path.join(dir, 'alpha.json'), JSON.stringify({ ...demo, slug: 'alpha', name: 'Alpha Test Traders', short: 'Alpha', aliases: ['alpha.test'], pin: undefined, data: { mode: 'api' }, bb: { ...(demo.bb || {}), client_id: 'cc-1' } }));
const port = await new Promise(res => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const API = 'http://127.0.0.1:' + port, CODE = 'PANEL-TEST-CODE';
const app = serve(DIST, { 'config.json': JSON.stringify({ api: API, bbWa: '94767412531' }) }); const host = serve(PANEL);
const api = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(port)], { cwd: path.join(ROOT, 'apps/api'), env: { ...process.env, NODE_OPTIONS: '--network-family-autoselection-attempt-timeout=1500', /* the Colombo connect window: Node gave up on Supabase after 250 ms per address (memory node-connect-window-colombo) */ DATA_MODE: 'memory', HUB_CASTS_DIR: dir, HUB_SECRET: 'panel-test-' + Math.random(), HUB_DEMO_CODE: CODE, HUB_STAFF_TEST_TOKEN: 'PANEL-STAFF-TEST', HUB_ORIGINS: [app.base, host.base].map(b => b.replace(/\/$/, '')).join(','), HUB_LIVE_TEST: '1', SUPABASE_URL: env.BB_SUPABASE_URL, SUPABASE_ANON_KEY: env.BB_SUPABASE_ANON, SUPABASE_SERVICE_ROLE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; api.stdout.on('data', d => log += d); api.stderr.on('data', d => log += d);
let browser; const stop = async code => { try { await browser?.close(); } catch {} api.kill('SIGTERM'); app.srv.close(); host.srv.close(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(code); };
let up = false; for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(API + '/api/health')).status < 500; } catch {} if (!up) await new Promise(z => setTimeout(z, 1000)); }
if (!up) { console.log('FAIL the API did not start\n' + log.slice(-600)); await stop(1); }
/* warm every route with a real request (OPTIONS stops at the middleware and compiles nothing) */
for (const u of ['/api/login', '/api/bb/staff/token', '/api/bb/staff/hubs', '/api/alpha/work', '/api/alpha/work/one', '/api/alpha/work/msgs', '/api/alpha/work/tasks', '/api/alpha/work/posts', '/api/alpha/work/files', '/api/alpha/work/seen', '/api/alpha/work/tasks/x', '/api/alpha/work/posts/x', '/api/alpha/work/files/x', '/api/alpha/work/files/x/raw']) { try { await fetch(API + u, { method: /login|token/.test(u) ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: /login|token/.test(u) ? '{}' : undefined }); } catch {} }

/* the door for the team: the system's sign in turns into a Hub token for one client, and nothing else gets through */
const tok = await (await fetch(API + '/api/bb/staff/token', { method: 'POST', headers: { Authorization: 'Bearer PANEL-STAFF-TEST', 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: 'cc-1' }) })).json();
check('door: a team member signed in to a BB system gets a Hub token for that client, on BB\'s side', !!tok.token && tok.slug === 'alpha' && tok.me?.side === 'bb' && tok.me?.name === 'Tiana', tok.me);
check('door: no sign in is refused', (await fetch(API + '/api/bb/staff/token', { method: 'POST', body: '{"clientId":"cc-1"}' })).status === 401);
check('door: a wrong sign in is refused', (await fetch(API + '/api/bb/staff/token', { method: 'POST', headers: { Authorization: 'Bearer nope' }, body: '{"clientId":"cc-1"}' })).status === 401);
check('door: a client with no app says so', (await fetch(API + '/api/bb/staff/token', { method: 'POST', headers: { Authorization: 'Bearer PANEL-STAFF-TEST' }, body: '{"clientId":"cc-999"}' })).status === 404);
const hubs = await (await fetch(API + '/api/bb/staff/hubs', { headers: { Authorization: 'Bearer PANEL-STAFF-TEST' } })).json();
check('door: the list of clients with an app names Alpha by its client id', Array.isArray(hubs) && hubs.some(h => h.clientId === 'cc-1' && h.slug === 'alpha'), hubs);

browser = await chromium.launch();
const wait = ms => new Promise(z => setTimeout(z, ms));
const C = await context(browser, { seed: null }); const cp = await C.newPage(); const cerr = []; cp.on('pageerror', e => cerr.push(String(e)));
await cp.goto(app.base); await cp.waitForSelector('#biz', { timeout: 20000 }); await cp.fill('#biz', 'alpha'); await cp.fill('#pin', CODE); await cp.locator('.enter').click();
await cp.waitForFunction(() => /#\/chat/.test(location.hash), null, { timeout: 20000 });
const T = await context(browser, { desk: true, width: 1280, seed: null }); const tp = await T.newPage(); const terr = []; tp.on('pageerror', e => terr.push(String(e)));
const treq = []; tp.on('request', r => { if (r.url().includes('/work')) treq.push(r.url()); });
if (process.env.PANEL_DEBUG) { tp.on('response', async r => { if (r.url().includes('/api/')) console.log('  panel <- ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(API, '').slice(0, 70)); }); tp.on('console', m => { if (m.type() === 'error') console.log('  panel console: ' + m.text().slice(0, 160)); }); }
await tp.goto(host.base + 'test/host.html?api=' + encodeURIComponent(API)); await tp.locator('[data-act="host-their-app"]').click();
const opened = await tp.waitForSelector('#bbh-text', { timeout: 20000 }).then(() => true).catch(() => false);
check('panel: "Their app" opens the client\'s chat inside the BB system', opened, await tp.evaluate(() => document.body.innerText.slice(0, 300)));
await wait(2500);
const sees = async (p, text, ms = 10000) => { try { await p.waitForFunction(t => document.body.innerText.includes(t), text, { timeout: ms }); return true; } catch { return false; } };
const shot = (p, n) => p.screenshot({ path: path.join(EVID, n + '.png') });

await tp.fill('#bbh-text', 'Morning from the team. Your Friday post is ready.'); await tp.locator('[data-act="hub-send"]').click();
check('chat: the client SEES the team\'s message from the BB system, without a reload', await sees(cp, 'Your Friday post is ready.'));
await cp.locator('#composer-text').fill('Lovely, can we boost it too?'); await cp.locator('[data-act="composer-send"]').click();
check('chat: the team SEES the client\'s answer in the panel, without a reload', await sees(tp, 'can we boost it too?'));
await shot(tp, '01-panel-chat'); await shot(cp, '02-client-chat');
const before = treq.length; await wait(15000);
check('told, never asked: 15 seconds idle, the panel sends nothing', treq.length === before, treq.length - before);

/* a post with artwork from the panel; the client approves; the panel sees who */
const art = path.join(dir, 'art.png');
{ const pg = await browser.newPage(); await pg.setContent('<canvas id=c width=400 height=500></canvas>'); const b64 = await pg.evaluate(() => { const c = document.getElementById('c'); const x = c.getContext('2d'); x.fillStyle = '#1f3a5f'; x.fillRect(0, 0, 400, 500); x.fillStyle = '#f4c95d'; x.beginPath(); x.arc(200, 200, 90, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1]; }); fs.writeFileSync(art, Buffer.from(b64, 'base64')); await pg.close(); }
await tp.locator('[data-act="hub-tab-posts"]').click(); await tp.locator('[data-act="hub-post-new"]').click();
const dts = tp.locator('.bbh-root input[type="datetime-local"]'); await dts.nth(0).fill('2026-10-30T18:00'); if (await dts.count() > 1) await dts.nth(1).fill('2026-10-29T15:00');
await tp.locator('.bbh-root input[maxlength="120"]').fill('Friday nights are back'); await tp.locator('.bbh-root textarea').first().fill('Friday nights are back. Book a table.');
await tp.locator('.bbh-root input[type="file"]').first().setInputFiles(art); await tp.locator('[data-act="hub-post-save"]').click();
await cp.goto(app.base + '#/posts');
check('post: the client SEES the post put up from the BB system', await sees(cp, 'Friday nights are back'));
check('post: with the real artwork', await cp.waitForSelector('img.art.real', { timeout: 10000 }).then(() => true).catch(() => false));
await cp.locator('[data-act="wpost-open"]').first().click(); await wait(600); await cp.locator('[data-act="wpost-approve"]').click();
check('post: the panel SEES who approved, by name', await sees(tp, 'Approved by ' + demo.users[0].name));
await shot(tp, '03-panel-posts');

/* a client request; the panel accepts it with a date; the client sees it */
await cp.goto(app.base + '#/chat'); await cp.locator('bb-bubble').filter({ hasText: 'boost it too' }).first().locator('[data-act="msg-more"]').click(); await cp.locator('[data-act="msg-task"]').first().click();
await tp.locator('[data-act="hub-tab-tasks"]').click();
check('task: the client\'s request shows in the panel', await sees(tp, 'boost it too'));
await tp.locator('[data-act="hub-task-accept"]').first().click(); await tp.locator('.bbh-root input[type="date"]').first().fill('2026-11-02'); await tp.locator('[data-act="hub-task-accept-save"]').first().click();
check('task: the team accepts it from the panel and the client SEES "Accepted"', await sees(cp, 'Accepted'));
await shot(tp, '04-panel-tasks');
await tp.locator('[data-act="hub-close"]').click();
check('panel: Close takes the team back to their own system', (await tp.locator('.bbh-root').count()) === 0);
check('no page error on either side', cerr.length === 0 && terr.length === 0, [...cerr, ...terr].slice(0, 2));

const failed = results.filter(r => !r.pass).length;
console.log(`\nTHE PANEL: ${results.length - failed} of ${results.length} checks pass`);
await stop(failed ? 1 : 0);
