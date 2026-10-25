#!/usr/bin/env node
/* THE WORKSPACE CONTRACT (Stage 2, 24 Oct 2026). Written BEFORE the crew built the server parts, so the parts are judged
   against it, never the other way round. The REAL API code in apps/api, started here in memory mode with two test clients,
   ALPHA and BETA. Alpha has a person on each side (the client's Owner and a Business Booster team member); Beta has its
   Owner. Every rule the screens already show (core/work.ts) is asked of the server, both the yes and the no, and every write
   must send the live nudge (kind and id only, never words).
     node scripts/work-contract.mjs        exits 1 when any check fails */
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { ROOT } from './lib/world.mjs';
const results = []; const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (!pass && saw !== undefined ? '  [saw: ' + (typeof saw === 'string' ? saw : JSON.stringify(saw)).slice(0, 220) + ']' : '')); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-work-'));
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'casts/demo.json'), 'utf8'));
for (const [slug, name] of [['alpha', 'Alpha Test Traders'], ['beta', 'Beta Test Bakers']]) fs.writeFileSync(path.join(dir, slug + '.json'), JSON.stringify({ ...demo, slug, name, short: name.split(' ')[0], aliases: [slug + '.test'], pin: undefined, data: { mode: 'api' } }));
const port = await new Promise(res => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const CODE = 'WORK-TEST-CODE', BBCODE = 'WORK-TEAM-CODE';
const api = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(port)], { cwd: path.join(ROOT, 'apps/api'), env: { ...process.env, DATA_MODE: 'memory', HUB_CASTS_DIR: dir, HUB_SECRET: 'work-test-' + Math.random(), HUB_DEMO_CODE: CODE, HUB_DEMO_BB_CODE: BBCODE, NEXT_TELEMETRY_DISABLED: '1', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-test-key' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; api.stdout.on('data', d => log += d); api.stderr.on('data', d => log += d);
const B = 'http://127.0.0.1:' + port;
const stop = code => { api.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); process.exit(code); };
const call = async (method, url, { token, body } = {}) => { const r = await fetch(B + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, json: j, text: t }; };
let up = false; for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(B + '/api/health')).status < 500; } catch {} if (!up) await new Promise(z => setTimeout(z, 1000)); }
if (!up) { console.log('FAIL the API did not start\n' + log.slice(-800)); stop(1); }

/* the door: a named person on each side */
const C = await call('POST', '/api/login', { body: { business: 'alpha', code: CODE } });
const T = await call('POST', '/api/login', { body: { business: 'alpha', code: BBCODE } });
const O = await call('POST', '/api/login', { body: { business: 'beta', code: CODE } });
check('door: the client signs in as a named person on the client side', C.status === 200 && C.json.me?.side === 'client' && C.json.me?.name === demo.users[0].name, C.json?.me);
check('door: the team member signs in as a named person on the Business Booster side', T.status === 200 && T.json.me?.side === 'bb' && !!T.json.me?.name && !!T.json.me?.role, T.json?.me);
check('door: the live channel is handed over with a topic that is not the slug', !!C.json.live?.topic && !/alpha/.test(C.json.live.topic) && C.json.live.key === 'public-test-key' && O.json.live.topic !== C.json.live.topic, C.json?.live);
const ct = C.json.token, tt = T.json.token, ot = O.json.token;
const W = '/api/alpha/work';
const pokes = async () => (await call('GET', W + '/pokes', { token: ct })).json || [];
const poked = async (kind, id) => (await pokes()).some(p => p.kind === kind && p.id === id && Object.keys(p).every(k => ['kind', 'id', 'at'].includes(k)));

/* the book */
const empty = await call('GET', W, { token: ct });
check('book: a new client reads an empty book and who they are', empty.status === 200 && Array.isArray(empty.json.msgs) && Array.isArray(empty.json.tasks) && Array.isArray(empty.json.posts) && empty.json.me?.side === 'client', empty.text);
check('book: no token is refused', (await call('GET', W)).status === 401);

/* chat */
const m1 = await call('POST', W + '/msgs', { token: ct, body: { text: '  Can we boost the Friday post?  ', side: 'bb', by: 'Forged', role: 'Forged' } });
check('chat: the client sends a message, stamped by the server with the person and side (never what the body claims)', m1.status === 201 && m1.json.text === 'Can we boost the Friday post?' && m1.json.side === 'client' && m1.json.by === demo.users[0].name && m1.json.seen === false, m1.json);
check('chat: the write sends the live nudge, kind and id only', await poked('msg', m1.json?.id), await pokes());
check('chat: an empty message is refused', (await call('POST', W + '/msgs', { token: ct, body: { text: '   ' } })).status === 400);
check('chat: a message over 4,000 characters is refused', (await call('POST', W + '/msgs', { token: ct, body: { text: 'x'.repeat(4001) } })).status === 400);
const m2 = await call('POST', W + '/msgs', { token: tt, body: { text: 'Yes, we will set it up today.', reply: m1.json.id } });
check('chat: the team answers as a person on its side, as a reply', m2.status === 201 && m2.json.side === 'bb' && m2.json.reply === m1.json.id && m2.json.seen === undefined, m2.json);
check('chat: a reply to a message of another client is refused', (await call('POST', '/api/beta/work/msgs', { token: ot, body: { text: 'x', reply: m1.json.id } })).status === 400);
check('seen: the client cannot mark messages seen', (await call('POST', W + '/seen', { token: ct, body: { ids: [m1.json.id] } })).status === 403);
const seen = await call('POST', W + '/seen', { token: tt, body: { ids: [m1.json.id, m2.json.id] } });
check('seen: the team marks the client message seen, and only that one counts', seen.status === 200 && seen.json.seen === 1, seen.json);
const one = await call('GET', W + '/one?kind=msg&id=' + m1.json.id, { token: ct });
check('one: a single message is read back after a nudge, now seen', one.status === 200 && one.json.seen === true, one.json);
check('one: another client asking for it by id gets nothing', (await call('GET', '/api/beta/work/one?kind=msg&id=' + m1.json.id, { token: ot })).status === 404);

/* files */
const f1 = await call('POST', W + '/files', { token: ct, body: { kind: 'photo', mime: 'image/jpeg', bytes: 120000 } });
check('files: a photo is booked and an upload link handed back', f1.status === 201 && !!f1.json.id && !!f1.json.upload?.url, f1.json);
check('files: a photo over 2 MB is refused', (await call('POST', W + '/files', { token: ct, body: { kind: 'photo', mime: 'image/jpeg', bytes: 3000000 } })).status === 400);
check('files: a program file is refused', (await call('POST', W + '/files', { token: ct, body: { kind: 'photo', mime: 'application/x-msdownload', bytes: 10 } })).status === 400);
check('files: a voice note over three minutes is refused', (await call('POST', W + '/files', { token: ct, body: { kind: 'voice', mime: 'audio/webm', bytes: 900000, secs: 200 } })).status === 400);
check('files: the client cannot book post artwork', (await call('POST', W + '/files', { token: ct, body: { kind: 'art', mime: 'image/png', bytes: 900000 } })).status === 403);
const up1 = await fetch(f1.json.upload.url.startsWith('http') ? f1.json.upload.url : B + f1.json.upload.url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array([255, 216, 255, 224, 1, 2, 3]) });
check('files: the upload link takes the file', up1.status >= 200 && up1.status < 300, up1.status);
const view = await call('GET', W + '/files/' + f1.json.id, { token: ct });
check('files: a viewing link is signed for the owner', view.status === 200 && !!view.json.url, view.json);
check('files: another client cannot get a viewing link', (await call('GET', '/api/beta/work/files/' + f1.json.id, { token: ot })).status === 404);
const mp = await call('POST', W + '/msgs', { token: ct, body: { photos: [f1.json.id] } });
check('chat: a message with its own photo is sent', mp.status === 201 && mp.json.photos?.[0] === f1.json.id, mp.json);
check('chat: another client cannot send Alpha\'s photo', (await call('POST', '/api/beta/work/msgs', { token: ot, body: { photos: [f1.json.id] } })).status === 400);

/* tasks */
const r1 = await call('POST', W + '/tasks', { token: ct, body: { fromMsg: m1.json.id } });
check('tasks: a client message becomes a request For us, asked, titled from the message', r1.status === 201 && r1.json.for === 'bb' && r1.json.asked === true && r1.json.title === 'Can we boost the Friday post?' && r1.json.source === m1.json.id, r1.json);
const again = await call('POST', W + '/tasks', { token: ct, body: { fromMsg: m1.json.id } });
check('tasks: the same message never makes a second task', again.json?.id === r1.json.id, again.json);
const book1 = await call('GET', W, { token: ct });
check('tasks: a card saying so drops into the chat, pointing at the task', book1.json.msgs.some(m => m.event === 'task-made' && m.ref?.kind === 'task' && m.ref.id === r1.json.id), book1.json.msgs.map(m => m.event));
check('tasks: the write nudges the task', await poked('task', r1.json.id));
check('tasks: the client cannot move a request the team has not accepted', (await call('PATCH', W + '/tasks/' + r1.json.id, { token: ct, body: { stage: 'doing' } })).status === 403);
check('tasks: the client cannot accept its own request', (await call('PATCH', W + '/tasks/' + r1.json.id, { token: ct, body: { accept: { due: '2026-11-02' } } })).status === 403);
const acc = await call('PATCH', W + '/tasks/' + r1.json.id, { token: tt, body: { accept: { due: '2026-11-02' } } });
check('tasks: the team accepts with a date, the owner defaults to the person accepting', acc.status === 200 && acc.json.asked === undefined && acc.json.due === '2026-11-02' && acc.json.who === T.json.me.name, acc.json);
check('tasks: the client still cannot move a task For us', (await call('PATCH', W + '/tasks/' + r1.json.id, { token: ct, body: { stage: 'done' } })).status === 403);
const late = await call('PATCH', W + '/tasks/' + r1.json.id, { token: tt, body: { late: { reason: 'Waiting on the ad account', newDue: '2026-11-05' } } });
check('tasks: the team gives a reason and a new date', late.status === 200 && late.json.late?.reason === 'Waiting on the ad account' && late.json.late?.newDue === '2026-11-05', late.json);
const doneT = await call('PATCH', W + '/tasks/' + r1.json.id, { token: tt, body: { stage: 'done' } });
check('tasks: the team moves its task to done, stamped', doneT.status === 200 && doneT.json.stage === 'done' && !!doneT.json.doneAt, doneT.json);
const book2 = await call('GET', W, { token: ct });
for (const ev of ['task-accepted', 'task-late', 'task-done']) check('tasks: a "' + ev + '" card drops into the chat', book2.json.msgs.some(m => m.event === ev && m.ref?.id === r1.json.id));
const mine = await call('POST', W + '/tasks', { token: ct, body: { title: 'Send the new menu photos', for: 'client', due: '2026-10-30', files: [f1.json.id] } });
check('tasks: the client makes a task For you, theirs to hold', mine.status === 201 && mine.json.for === 'client' && mine.json.who === demo.users[0].name && mine.json.files[0] === f1.json.id && mine.json.asked === undefined, mine.json);
const mv = await call('PATCH', W + '/tasks/' + mine.json.id, { token: ct, body: { stage: 'doing' } });
check('tasks: the client moves its own task', mv.status === 200 && mv.json.stage === 'doing', mv.json);
check('tasks: the team cannot accept a task For you', (await call('PATCH', W + '/tasks/' + mine.json.id, { token: tt, body: { accept: { due: '2026-11-01' } } })).status === 403);
check('tasks: a bad stage is refused', (await call('PATCH', W + '/tasks/' + mine.json.id, { token: ct, body: { stage: 'finished' } })).status === 400);
check('tasks: another client cannot touch it', [403, 404].includes((await call('PATCH', '/api/beta/work/tasks/' + mine.json.id, { token: ot, body: { stage: 'done' } })).status));
const ed = await call('PATCH', W + '/tasks/' + mine.json.id, { token: ct, body: { title: 'Send the new menu photos today' } });
check('tasks: the client edits its own task', ed.status === 200 && ed.json.title === 'Send the new menu photos today', ed.json);
const ask2 = await call('POST', W + '/tasks', { token: ct, body: { title: 'Print 500 flyers', for: 'bb' } });
check('tasks: a request typed For us arrives asked', ask2.status === 201 && ask2.json.asked === true, ask2.json);
const out = await call('PATCH', W + '/tasks/' + ask2.json.id, { token: tt, body: { outside: 'Printing is outside the package; we can quote it' } });
check('tasks: the team says a request is outside the package, and it is no longer asked', out.status === 200 && out.json.outside === 'Printing is outside the package; we can quote it' && out.json.asked === undefined, out.json);
const del = await call('DELETE', W + '/tasks/' + mine.json.id, { token: ct });
check('tasks: the client removes its own task', [200, 204].includes(del.status));
const mine2 = await call('POST', W + '/tasks', { token: ct, body: { title: 'Choose the cover photo', for: 'client' } });
check('tasks: the team cannot remove a task that is the client\'s to hold', (await call('DELETE', W + '/tasks/' + mine2.json.id, { token: tt })).status === 403);
check('tasks: the client cannot remove a request the team already answered', (await call('DELETE', W + '/tasks/' + ask2.json.id, { token: ct })).status === 403);

/* posts */
check('posts: the client cannot put up a post', (await call('POST', W + '/posts', { token: ct, body: { platform: 'Instagram', kind: 'Post', slot: '2026-10-30T12:30:00.000Z', caption: 'x', head: 'x' } })).status === 403);
const art = await call('POST', W + '/files', { token: tt, body: { kind: 'art', mime: 'image/png', bytes: 800000 } });
const p1 = await call('POST', W + '/posts', { token: tt, body: { platform: 'Instagram', kind: 'Post', slot: '2026-10-30T12:30:00.000Z', decideBy: '2026-10-29T09:30:00.000Z', caption: 'Friday nights are back.', head: 'Friday nights', tone: 'brand', art: art.json.id } });
check('posts: the team puts up a post, version 1, waiting for a yes', p1.status === 201 && p1.json.status === 'waiting' && p1.json.versions.length === 1 && p1.json.versions[0].v === 1 && p1.json.versions[0].art === art.json.id, p1.json);
check('posts: the write nudges the post', await poked('post', p1.json?.id));
check('posts: a bad platform is refused', (await call('POST', W + '/posts', { token: tt, body: { platform: 'MySpace', kind: 'Post', slot: '2026-10-30T12:30:00.000Z', caption: 'x', head: 'x' } })).status === 400);
const P = W + '/posts/' + p1.json.id;
check('posts: the team cannot approve its own post', (await call('POST', P, { token: tt, body: { answer: 'approved', v: 1 } })).status === 403);
check('posts: a change with no words or voice is refused', (await call('POST', P, { token: ct, body: { answer: 'change', v: 1 } })).status === 400);
const ch = await call('POST', P, { token: ct, body: { answer: 'change', v: 1, text: 'Use the night photo please' } });
check('posts: the client asks for a change on version 1, recorded with their name', ch.status === 200 && ch.json.changes.length === 1 && ch.json.changes[0].v === 1 && ch.json.changes[0].by === demo.users[0].name && ch.json.status === 'waiting', ch.json);
check('posts: once a change is asked the post is with the team and cannot be answered again', (await call('POST', P, { token: ct, body: { answer: 'approved', v: 1 } })).status === 409);
const v2 = await call('POST', P, { token: tt, body: { version: { caption: 'Friday nights are back, under the stars.', head: 'Friday nights', tone: 'ink' } } });
check('posts: the team answers with version 2, waiting again', v2.status === 200 && v2.json.versions.length === 2 && v2.json.versions[1].v === 2 && v2.json.status === 'waiting', v2.json);
check('posts: version 2 with no new picture keeps the artwork of version 1', v2.json?.versions?.[1]?.art === art.json.id, v2.json?.versions);
check('posts: a yes on version 1 is refused once version 2 is waiting', (await call('POST', P, { token: ct, body: { answer: 'approved', v: 1 } })).status === 409);
check('posts: another client cannot answer it', [403, 404].includes((await call('POST', '/api/beta/work/posts/' + p1.json.id, { token: ot, body: { answer: 'approved', v: 2 } })).status));
const ap = await call('POST', P, { token: ct, body: { answer: 'approved', v: 2 } });
check('posts: the client approves version 2; the post says who and when', ap.status === 200 && ap.json.status === 'approved' && ap.json.approvedBy === demo.users[0].name && !!ap.json.approvedAt, ap.json);
check('posts: an approved post cannot be approved twice', (await call('POST', P, { token: ct, body: { answer: 'approved', v: 2 } })).status === 409);
check('posts: the team cannot set a post approved itself', (await call('POST', P, { token: tt, body: { status: 'approved' } })).status === 400);
const live = await call('POST', P, { token: tt, body: { status: 'live' } });
check('posts: the team marks it live', live.status === 200 && live.json.status === 'live', live.json);
const book3 = await call('GET', W, { token: ct });
check('posts: "approved" and "change" cards drop into the chat', ['approved', 'change'].every(ev => book3.json.msgs.some(m => m.event === ev && m.ref?.id === p1.json.id)));
check('posts: the change card carries the words asked', book3.json.msgs.some(m => m.event === 'change' && m.text === 'Use the night photo please'));
const cm = await call('POST', W + '/msgs', { token: ct, body: { text: 'Looks great', ref: { kind: 'post', id: p1.json.id } } });
check('chat: a comment on a post is a card in the chat', cm.status === 201 && cm.json.event === 'comment' && cm.json.ref?.id === p1.json.id, cm.json);
check('chat: a comment on another client\'s post is refused', (await call('POST', '/api/beta/work/msgs', { token: ot, body: { text: 'x', ref: { kind: 'post', id: p1.json.id } } })).status === 400);

/* the wall, read side */
const ob = await call('GET', '/api/beta/work', { token: ot });
check('wall: Beta\'s book holds nothing of Alpha\'s', ob.status === 200 && ob.json.msgs.length === 0 && ob.json.tasks.length === 0 && ob.json.posts.length === 0 && !/Friday|boost|menu/.test(ob.text), ob.text.slice(0, 160));
check('wall: Beta\'s token on Alpha\'s book is refused', (await call('GET', W, { token: ot })).status === 401);
check('wall: a nudge never carries words', (await pokes()).every(p => Object.keys(p).every(k => ['kind', 'id', 'at'].includes(k))), (await pokes()).slice(0, 2));

/* the database store cannot run on this Mac (no service key here, on purpose), so two faults the crew shipped are held by
   reading its source: the client must be awaited BEFORE .from() is called, and a refused request keeps its words */
{ const db = fs.readFileSync(path.join(ROOT, 'apps/api/lib/work-db.js'), 'utf8');
  const bare = (db.match(/(?<!\()await supa\(\)\s*\n?\s*\./g) || []).length + (db.match(/(?<!await |\(await )supa\(\)\s*\./g) || []).length;
  check('database store: every call waits for the client before it asks a table', bare === 0, bare + ' calls');
  check('database store: a refused request keeps the team\'s words', /task\.outside = row\.outside/.test(db) && !/outside = true/.test(db)); }

const failed = results.filter(r => !r.pass).length;
console.log(`\nWORKSPACE CONTRACT: ${results.length - failed} of ${results.length} checks pass`);
stop(failed ? 1 : 0);
