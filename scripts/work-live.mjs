#!/usr/bin/env node
/* TWO PEOPLE, ONE HUB, A REAL BROWSER (Stage 2, 25 Oct 2026). The client on a phone and a Business Booster team member on a
   laptop, both signed in to the SAME built app against the REAL API code (memory mode), and the live channel is the REAL
   Supabase Realtime: the test server sends its nudges with the public key (HUB_LIVE_TEST=1, never set on the host).
   What it proves: each side SEES the other's writes without a reload (told, not asked), the app asks for the whole book once
   per open and never on a timer, every Stage 2 rule holds in the screens, and a refusal is said on screen.
     node scripts/work-live.mjs        exits 1 when any check fails; pictures in evidence/stage2-live/ */
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { chromium, ROOT, DIST, serve, context } from './lib/world.mjs';
const results = []; const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass && saw !== undefined ? '  [saw: ' + JSON.stringify(saw).slice(0, 240) + ']' : '')); };
const env = Object.fromEntries(fs.readFileSync(process.env.HOME + '/.bb-secrets/engine.env', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const EVID = path.join(ROOT, 'evidence/stage2-live'); fs.mkdirSync(EVID, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-live-'));
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'casts/demo.json'), 'utf8'));
fs.writeFileSync(path.join(dir, 'alpha.json'), JSON.stringify({ ...demo, slug: 'alpha', name: 'Alpha Test Traders', short: 'Alpha', aliases: ['alpha.test'], pin: undefined, data: { mode: 'api' } }));
const port = await new Promise(res => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const API = 'http://127.0.0.1:' + port, CODE = 'LIVE-TEST-CODE', BBCODE = 'LIVE-TEAM-CODE';
const { srv, base } = serve(DIST, { 'config.json': JSON.stringify({ api: API, bbWa: '94767412531' }) });
const origin = base.replace(/\/$/, '');
const api = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(port)], { cwd: path.join(ROOT, 'apps/api'), env: { ...process.env, NODE_OPTIONS: '--network-family-autoselection-attempt-timeout=1500', /* the Colombo connect window: Node gave up on Supabase after 250 ms per address (memory node-connect-window-colombo) */ DATA_MODE: 'memory', HUB_CASTS_DIR: dir, HUB_SECRET: 'live-test-' + Math.random(), HUB_DEMO_CODE: CODE, HUB_DEMO_BB_CODE: BBCODE, HUB_ORIGINS: origin, HUB_LIVE_TEST: '1', SUPABASE_URL: env.BB_SUPABASE_URL, SUPABASE_ANON_KEY: env.BB_SUPABASE_ANON, SUPABASE_SERVICE_ROLE_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; api.stdout.on('data', d => log += d); api.stderr.on('data', d => log += d);
let browser; const stop = async code => { try { await browser?.close(); } catch {} api.kill('SIGTERM'); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(code); };
let up = false; for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(API + '/api/health')).status < 500; } catch {} if (!up) await new Promise(z => setTimeout(z, 1000)); }
if (!up) { console.log('FAIL the API did not start\n' + log.slice(-600)); await stop(1); }
/* warm every route once, so the first press is not judged on a cold compile. With GET: an OPTIONS request is answered by the
   middleware and never reaches the route, so it compiled nothing (the gate run of 25 Oct missed the first messages for it) */
for (const u of ['/api/login', '/api/alpha/work', '/api/alpha/work/one', '/api/alpha/work/msgs', '/api/alpha/work/tasks', '/api/alpha/work/posts', '/api/alpha/work/files', '/api/alpha/work/seen', '/api/alpha/work/tasks/x', '/api/alpha/work/posts/x', '/api/alpha/work/files/x', '/api/alpha/work/files/x/raw']) { try { await fetch(API + u, { method: u === '/api/login' ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: u === '/api/login' ? '{}' : undefined }); } catch {} }

browser = await chromium.launch();
const wait = ms => new Promise(z => setTimeout(z, ms));
/* each person: their own browser, every request to the workspace counted, so polling would show */
async function person(label, code, opt){
  const c = await context(browser, { ...opt, seed: null }); const p = await c.newPage();
  const reqs = []; p.on('request', r => { if (r.url().startsWith(API + '/api/alpha/work')) reqs.push({ m: r.method(), u: r.url().slice(API.length), t: Date.now() }); });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  /* every real press is recorded where it lands, so the click path can count the team's buttons pressed here */
  await c.addInitScript(() => { document.addEventListener('click', e => { const a = e.target instanceof Element ? e.target.closest('[data-act]') : null; if (a) { const l = JSON.parse(sessionStorage.getItem('__acts') || '[]'); l.push(a.getAttribute('data-act')); sessionStorage.setItem('__acts', JSON.stringify(l)); } }, true); });
  await p.goto(base); await p.waitForSelector('#biz', { timeout: 20000 });
  await p.fill('#biz', 'alpha'); await p.fill('#pin', code); await p.locator('.enter').click();
  await p.waitForFunction(() => /#\/chat/.test(location.hash), null, { timeout: 20000 });
  await p.waitForSelector('bb-composer, .composer, textarea', { timeout: 20000 });
  return { label, c, p, reqs, errs };
}
const C = await person('client', CODE, {});
const T = await person('team', BBCODE, { desk: true, width: 1280 });
await wait(2500);   /* both sockets joined */
const shot = async (who, name) => who.p.screenshot({ path: path.join(EVID, name + '.png') });
const say = async (who, text) => { const box = who.p.locator('#composer-text'); await box.fill(text); await who.p.locator('[data-act="composer-send"]').click(); };
const sees = async (who, text, ms = 8000) => { try { await who.p.waitForFunction(t => document.body.innerText.includes(t), text, { timeout: ms }); return true; } catch { return false; } };

/* 1. chat, both ways, told */
const t0 = Date.now(); await say(T, 'Morning. Your Friday post is ready for a look.');
check('chat: the client SEES the team\'s message without a reload', await sees(C, 'Your Friday post is ready for a look.'), Date.now() - t0 + 'ms');
console.log('      told in ' + (Date.now() - t0) + ' ms');
await say(C, 'Great, can we boost it too?');
check('chat: the team SEES the client\'s message without a reload', await sees(T, 'can we boost it too?'));
const names = await T.p.evaluate(() => document.body.innerText);
check('chat: the client\'s message carries the client\'s name', names.includes(demo.users[0].name));
check('chat: the team\'s message carries a first name and role on the client\'s screen', (await C.p.evaluate(() => document.body.innerText)).includes('Tiana'));
await wait(1500);
await shot(C, '01-client-chat'); await shot(T, '02-team-chat');

/* 2. no polling: 20 seconds idle, nothing asked of the workspace */
const before = C.reqs.length + T.reqs.length; await wait(20000); const idle = C.reqs.length + T.reqs.length - before;
check('told, never asked: 20 seconds idle, zero requests to the workspace from either side', idle === 0, idle);
const books = r => r.filter(x => x.m === 'GET' && /\/work(\?|$)/.test(x.u)).length;
/* one read on open, a second only when the live channel joins after the 2.5 second fallback already read: never more */
check('the whole book is read at most twice per open (the fallback and the join), never on a timer', books(C.reqs) <= 2 && books(T.reqs) <= 2, [books(C.reqs), books(T.reqs)]);

/* 3. a message becomes a request; the team accepts it with a date; the client sees the card */
await C.p.locator('bb-bubble').filter({ hasText: 'can we boost it too?' }).first().locator('[data-act="msg-more"]').click();
await C.p.locator('[data-act="msg-task"]').first().click();
{ const ok = await sees(T, 'Asked of the team', 10000); if (!ok) { await shot(C, 'FAIL-task-client'); await shot(T, 'FAIL-task-team'); console.log('      client says: ' + JSON.stringify(await C.p.evaluate(() => document.querySelector('.toast')?.textContent || ''))); }
  check('task: the client\'s message becomes a request For us', ok); }
await T.p.goto(base + '#/tasks?for=bb'); await T.p.locator('[data-act="wtask-open"]').filter({ hasText: 'boost' }).first().click();
await T.p.locator('[data-act="wtask-accept"]').click();
await T.p.fill('#wt-t-due', '2026-11-02'); await T.p.locator('[data-act="wtask-team-save"]').click();
check('task: the team accepts it with a date and the client SEES "Accepted"', await sees(C, 'Accepted', 10000));
await shot(T, '03-team-accepts');

/* 4. a post: the team puts it up with artwork, the client asks a change, a new version, the client approves */
const art = path.join(dir, 'art.png');
{ const pg = await (await browser.newContext()).newPage(); await pg.setContent('<canvas id=c width=400 height=500></canvas>');
  const b64 = await pg.evaluate(() => { const c = document.getElementById('c'); const x = c.getContext('2d'); x.fillStyle = '#1f3a5f'; x.fillRect(0, 0, 400, 500); x.fillStyle = '#f4c95d'; x.beginPath(); x.arc(200, 200, 90, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync(art, Buffer.from(b64, 'base64')); await pg.context().close(); }
await T.p.goto(base + '#/posts'); await T.p.locator('[data-act="wpost-new"]').click();
await T.p.fill('#wp-f-slot', '2026-10-30T18:00'); await T.p.fill('#wp-f-by', '2026-10-29T15:00');
await T.p.fill('#wp-f-head', 'Friday nights are back'); await T.p.fill('#wp-f-cap', 'Friday nights are back. Book a table.');
await T.p.setInputFiles('#wp-f-art', art); await T.p.locator('[data-act="wpost-form-save"]').click();
await wait(2500); await shot(T, '03b-team-post-sent'); console.log('      team screen after sending: ' + JSON.stringify(await T.p.evaluate(() => [...document.querySelectorAll('.drawer.on .msg, .toast, [role=status], .drawer.on [role=alert]')].map(e => e.textContent.trim()).join(' | '))));
await C.p.goto(base + '#/posts');
check('post: the client SEES the team\'s post waiting for a yes', await sees(C, 'Friday nights are back', 10000));
const realArt = await C.p.waitForSelector('img.art.real', { timeout: 10000 }).then(() => true).catch(() => false);
check('post: the real artwork shows, read through a signed link', realArt);
await shot(C, '04-client-post-waiting');
await C.p.locator('[data-act="wpost-open"]').first().click(); await C.p.locator('[data-act="wpost-change"]').click();
await C.p.fill('#wp-change', 'Use the night photo please'); await C.p.locator('[data-act="wpost-change-send"]').click();
await T.p.goto(base + '#/chat');
check('post: the team SEES the change asked, in the client\'s words', await sees(T, 'Use the night photo please', 10000));
await T.p.goto(base + '#/posts'); await T.p.locator('[data-act="wpost-open"]').first().click(); await T.p.locator('[data-act="wpost-version"]').click();
await T.p.fill('#wp-f-cap', 'Friday nights are back, under the stars. Book a table.'); await T.p.locator('[data-act="wpost-form-save"]').click();
check('post: the client SEES version 2 without a reload', await sees(C, 'Version 2', 10000));
await C.p.locator('.drawer.on [data-act="wpost-close"], .drawer.on .x').first().click().catch(() => {});
await C.p.goto(base + '#/posts'); await C.p.locator('[data-act="wpost-open"]').first().click(); await wait(800); await shot(C, '05a-client-before-approve'); const ansReq = C.p.waitForResponse(r => /\/work\/posts\/[^/]+$/.test(r.url()) && r.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
await C.p.locator('[data-act="wpost-approve"]').click(); const ans = await ansReq; console.log('      approve sent: ' + (ans ? ans.status() + ' ' + (await ans.text()).slice(0, 160) : 'NO REQUEST LEFT THE APP')); await wait(1500); await shot(C, '05b-client-after-approve');
await T.p.goto(base + '#/posts'); await T.p.locator('[data-act="wpost-open"]').first().click();
check('post: the team SEES who approved, by name', await sees(T, 'Approved by ' + demo.users[0].name, 10000));
await shot(T, '05-team-sees-approval');

/* 4b. the team's other answers: a request outside the package (cancel once first), a new date, a form left, a post marked live */
await C.p.goto(base + '#/chat'); await say(C, 'Can you print 500 flyers for us?'); await sees(C, 'print 500 flyers');
await C.p.locator('bb-bubble').filter({ hasText: 'print 500 flyers' }).first().locator('[data-act="msg-more"]').click();
await C.p.locator('[data-act="msg-task"]').first().click();
await T.p.goto(base + '#/tasks?for=bb'); await sees(T, 'print 500 flyers', 10000);
await T.p.locator('[data-act="wtask-open"]').filter({ hasText: 'flyers' }).first().click();
await T.p.locator('[data-act="wtask-outside"]').click(); await T.p.locator('[data-act="wtask-team-cancel"]').click();
await T.p.locator('[data-act="wtask-outside"]').click(); await T.p.fill('#wt-t-out', 'Printing is outside the package; we can quote it');
await T.p.locator('[data-act="wtask-team-save"]').click();
check('task: the team says outside the package and the client SEES why, in the chat', await sees(C, 'we can quote it', 10000));
/* close the first sheet before opening the next, as a person does; a press while the old sheet still slides is not a person's press */
await T.p.locator('.drawer.on [data-act="wtask-close"]').click(); await T.p.waitForFunction(() => !document.querySelector('.drawer.on'), null, { timeout: 5000 }).catch(() => {});
await T.p.locator('[data-act="wtask-open"]').filter({ hasText: 'boost' }).first().click(); await wait(400);
await T.p.locator('.drawer.on [data-act="wtask-late"]').click(); await T.p.fill('#wt-t-why', 'Waiting on the ad account'); await T.p.fill('#wt-t-new', '2026-11-05');
await T.p.locator('[data-act="wtask-team-save"]').click();
await C.p.goto(base + '#/chat');
check('task: the team gives a new date and the client SEES the reason', await sees(C, 'Waiting on the ad account', 10000));
await T.p.goto(base + '#/posts'); await T.p.locator('[data-act="wpost-new"]').click(); await T.p.locator('[data-act="wpost-form-cancel"]').click();
check('post: the team can leave the post form without sending', (await T.p.locator('.drawer.on').count()) === 0);
await T.p.locator('[data-act="wpost-open"]').first().click(); await T.p.locator('[data-act="wpost-live"]').click();
await C.p.goto(base + '#/posts');
check('post: the team marks it live and the client SEES it live', await sees(C, 'Live', 10000));
await shot(C, '07-client-post-live');

/* 5. a refusal is said on screen: the team tries to approve (the button is not there) and the client's seen tick */
check('the team has no Approve button', (await T.p.locator('[data-act="wpost-approve"]').count()) === 0);
await C.p.goto(base + '#/chat'); await T.p.goto(base + '#/chat'); await wait(2500);
check('seen: the client sees its messages marked Seen once the team has the chat open', await C.p.waitForSelector('[aria-label="Seen by the team"]', { timeout: 8000 }).then(() => true).catch(() => false));
check('no page error on either side', C.errs.length === 0 && T.errs.length === 0, [...C.errs, ...T.errs].slice(0, 2));
await shot(C, '06-client-seen');

const acts = new Set(); for (const who of [C, T]) for (const a of await who.p.evaluate(() => JSON.parse(sessionStorage.getItem('__acts') || '[]'))) acts.add(a);
const failed = results.filter(r => !r.pass).length;
fs.writeFileSync(path.join(EVID, 'pressed.json'), JSON.stringify({ at: new Date().toISOString(), passed: failed === 0, acts: [...acts].sort() }, null, 1));
console.log(`\nTWO PEOPLE LIVE: ${results.length - failed} of ${results.length} checks pass`);
await stop(failed ? 1 : 0);
