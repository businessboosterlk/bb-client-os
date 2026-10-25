#!/usr/bin/env node
/* THE LIVE HUB, CHECKED FOR REAL (25 Oct 2026). Against the hosted server on Railway, the real database, the real private file
   store and the real live channel, with the permanent test client "BB Hub Test" (zz-hub-test): Amara on the client side,
   Tiana on BB's side. Codes come from ~/.bb-secrets/hub-test.env (mode 600), never from the chat. Rows it writes stay (an
   approval can never be deleted, by design), all under the test client.
     node scripts/hosted-check.mjs        exits 1 when any check fails */
import fs from 'node:fs';
const U = process.env.HUB_URL || 'https://the-hub-production-dc56.up.railway.app', SLUG = 'zz-hub-test';
const env = Object.fromEntries(fs.readFileSync(process.env.HOME + '/.bb-secrets/hub-test.env', 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const results = []; const check = (n, p, saw) => { results.push(!!p); console.log((p ? 'PASS ' : 'FAIL ') + n + (!p && saw !== undefined ? '  [saw: ' + JSON.stringify(saw).slice(0, 200) + ']' : '')); };
const call = async (m, path, { token, body, raw } = {}) => { const r = await fetch(U + path, { method: m, headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: raw || (body ? JSON.stringify(body) : undefined) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, json: j, text: t }; };
const wait = ms => new Promise(z => setTimeout(z, ms));

const C = await call('POST', '/api/login', { body: { business: SLUG, code: env.HUB_TEST_CLIENT_CODE } });
const T = await call('POST', '/api/login', { body: { business: SLUG, code: env.HUB_TEST_TEAM_CODE } });
check('door: the client person signs in, named, on the client side', C.status === 200 && C.json.me?.name === 'Amara' && C.json.me?.side === 'client', C.json);
check('door: the team person signs in, named, on BB\'s side', T.status === 200 && T.json.me?.name === 'Tiana' && T.json.me?.side === 'bb', T.json);
check('door: a wrong code is refused', (await call('POST', '/api/login', { body: { business: SLUG, code: 'TST-AAAA-BBBB' } })).status === 401);
const ct = C.json.token, tt = T.json.token, live = C.json.live;
check('wall: the test client\'s pass opens nothing of another client', (await call('GET', '/api/demo/work', { token: ct })).status === 401);
check('wall: no pass, no book', (await call('GET', `/api/${SLUG}/work`)).status === 401);

/* two ears on the real live channel */
const ear = () => { const heard = []; const ws = new WebSocket(live.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(live.key) + '&vsn=1.0.0');
  ws.onopen = () => ws.send(JSON.stringify({ topic: 'realtime:' + live.topic, event: 'phx_join', payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, private: false } }, ref: '1', join_ref: '1' }));
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.event === 'broadcast') heard.push(m.payload.payload); }; return { ws, heard }; };
const ec = ear(), et = ear(); await wait(3000);
const heardBy = async (e, id, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (e.heard.some(h => h.id === id)) return Date.now() - t0; await wait(100); } return -1; };

const m1 = await call('POST', `/api/${SLUG}/work/msgs`, { token: tt, body: { text: 'Live check from the team, ' + new Date().toISOString() } });
const h1 = await heardBy(ec, m1.json?.id);
check('live: the client\'s phone is TOLD of the team\'s message (' + h1 + ' ms)', m1.status === 201 && h1 >= 0, m1.text);
const m2 = await call('POST', `/api/${SLUG}/work/msgs`, { token: ct, body: { text: 'Live check from the client' } });
const h2 = await heardBy(et, m2.json?.id);
check('live: the team is TOLD of the client\'s message (' + h2 + ' ms)', m2.status === 201 && h2 >= 0, m2.text);
check('live: a nudge carries the kind and the id only', [...ec.heard, ...et.heard].every(h => Object.keys(h).every(k => k === 'kind' || k === 'id')), ec.heard[0]);
const one = await call('GET', `/api/${SLUG}/work/one?kind=msg&id=${m1.json?.id}`, { token: ct });
check('live: the row is read back through the server', one.status === 200 && one.json?.by === 'Tiana', one.json);

/* the private file store, for real */
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const f = await call('POST', `/api/${SLUG}/work/files`, { token: tt, body: { kind: 'art', mime: 'image/png', bytes: png.length } });
const put = f.json?.upload?.url ? await fetch(f.json.upload.url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png }) : { status: 0, text: async () => '' };
check('store: the artwork goes into the private store through a signed link', f.status === 201 && put.status >= 200 && put.status < 300, [f.status, put.status, (await put.text()).slice(0, 120)]);
const v = await call('GET', `/api/${SLUG}/work/files/${f.json?.id}`, { token: ct });
const got = v.json?.url ? await fetch(v.json.url) : { status: 0, arrayBuffer: async () => new ArrayBuffer(0) };
check('store: the client reads it back through a link signed for an hour', v.status === 200 && got.status === 200 && Buffer.from(await got.arrayBuffer()).equals(png), [v.status, got.status]);
const bare = await fetch(live.url + '/storage/v1/object/public/hub-media/' + (f.json?.upload?.path || 'x'));
check('store: the same file is NOT readable without a signed link', bare.status >= 400, bare.status);

/* a post: the team puts it up, the client approves, the record says who */
const p = await call('POST', `/api/${SLUG}/work/posts`, { token: tt, body: { platform: 'Instagram', kind: 'Post', slot: new Date(Date.now() + 5 * 864e5).toISOString(), caption: 'Live check post', head: 'Live check', art: f.json?.id } });
check('post: the team puts up a post with its artwork', p.status === 201 && p.json.versions?.[0]?.art === f.json?.id, p.text);
const ap = await call('POST', `/api/${SLUG}/work/posts/${p.json?.id}`, { token: ct, body: { answer: 'approved', v: 1 } });
check('post: the client approves; the record names Amara', ap.status === 200 && ap.json.status === 'approved' && ap.json.approvedBy === 'Amara', ap.text);
check('post: the team cannot approve', (await call('POST', `/api/${SLUG}/work/posts/${p.json?.id}`, { token: tt, body: { answer: 'approved', v: 1 } })).status === 403);

/* a request: the client asks, the team accepts with a date */
const r = await call('POST', `/api/${SLUG}/work/tasks`, { token: ct, body: { fromMsg: m2.json?.id } });
const a = await call('PATCH', `/api/${SLUG}/work/tasks/${r.json?.id}`, { token: tt, body: { accept: { due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) } } });
check('task: the client\'s message becomes a request; the team accepts it with a date', r.status === 201 && r.json.asked === true && a.status === 200 && a.json.who === 'Tiana', [r.text.slice(0, 80), a.text.slice(0, 80)]);
const seen = await call('POST', `/api/${SLUG}/work/seen`, { token: tt, body: { ids: [m2.json?.id] } });
check('seen: the team marks the client\'s message seen', seen.status === 200 && seen.json.seen === 1, seen.text);

ec.ws.close(); et.ws.close();
const failed = results.filter(x => !x).length;
console.log(`\nTHE LIVE HUB: ${results.length - failed} of ${results.length} checks pass`);
process.exit(failed ? 1 : 0);
