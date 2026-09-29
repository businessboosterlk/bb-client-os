#!/usr/bin/env node
/* THE TENANT WALL. Two test clients, ALPHA and BETA, against the REAL API code in apps/api, started
   here in memory mode with a folder of test casts. Every probe is one a stranger or a curious
   client could send: through an address, through a token, through a guess.
   REPORT ONLY. This script changes nothing. A probe that gets through is printed as FAIL and any
   fix to the door, the token or the tables is a stop point for Thulaib.
     node scripts/tenant-wall.mjs        exits 1 when a probe gets through */
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import net from 'node:net';
import { createHmac } from 'node:crypto';
import { ROOT } from './lib/world.mjs';
const results = []; const check = (name, pass, saw) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (saw !== undefined ? '  [saw: ' + (typeof saw === 'string' ? saw : JSON.stringify(saw)) + ']' : '')); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-wall-'));
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, 'casts/demo.json'), 'utf8'));
for (const [slug, name] of [['alpha', 'Alpha Test Traders'], ['beta', 'Beta Test Bakers']]) fs.writeFileSync(path.join(dir, slug + '.json'), JSON.stringify({ ...demo, slug, name, short: name.split(' ')[0], aliases: [slug + '.test'], pin: undefined, data: { mode: 'api' } }));
const port = await new Promise(res => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const SECRET = 'wall-test-secret-' + Math.random().toString(36).slice(2), CODE = 'WALL-TEST-CODE';
const api = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(port)], { cwd: path.join(ROOT, 'apps/api'), env: { ...process.env, DATA_MODE: 'memory', HUB_CASTS_DIR: dir, HUB_SECRET: SECRET, HUB_DEMO_CODE: CODE, BB_ADMIN_SECRET: 'wall-admin-' + SECRET, HUB_ORIGINS: 'https://businessboosterlk.github.io', NEXT_TELEMETRY_DISABLED: '1', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; api.stdout.on('data', d => log += d); api.stderr.on('data', d => log += d);
const B = 'http://127.0.0.1:' + port;
const stop = code => { api.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); process.exit(code); };
const call = async (method, url, { token, body, headers } = {}) => { const r = await fetch(B + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch {} return { status: r.status, json: j, text: t, headers: r.headers }; };
let up = false; for (let i = 0; i < 90 && !up; i++) { try { const r = await fetch(B + '/api/health'); up = r.status < 500; } catch {} if (!up) await new Promise(z => setTimeout(z, 1000)); }
if (!up) { console.log('FAIL the API did not start, so nothing was probed\n' + log.slice(-800)); stop(1); }
const health = await call('GET', '/api/health');
check('the API under test is the real code, in memory mode, holding no client rows', health.status === 200 && /memory/.test(health.text), health.text.slice(0, 120));

/* the door */
const t0 = Date.now(); const wrongCode = await call('POST', '/api/login', { body: { business: 'alpha', code: 'NOPE' } }); const slow = Date.now() - t0;
const wrongName = await call('POST', '/api/login', { body: { business: 'nobody-at-all', code: CODE } });
check('door: a wrong code and a wrong name get the same answer, so neither can be told from the other', wrongCode.status === 401 && wrongName.status === 401 && wrongCode.text === wrongName.text, [wrongCode.status, wrongName.status, wrongCode.json?.error]);
check('door: a refusal is held back for over half a second', slow >= 550, slow + 'ms');
const A = await call('POST', '/api/login', { body: { business: 'alpha.test', code: CODE } }), Bt = await call('POST', '/api/login', { body: { business: 'beta', code: CODE } });
check('door: each test client signs in and is given its own token and its own settings', A.status === 200 && Bt.status === 200 && A.json.slug === 'alpha' && Bt.json.slug === 'beta' && A.json.cast.name === 'Alpha Test Traders' && A.json.token !== Bt.json.token, [A.status, Bt.status]);
check('door: the settings sent to a seat carry no code, no PIN and no list of people', !/"pin"|"seats"|"hash"|"salt"|"leads"|"customers"\s*:\s*\[/.test(JSON.stringify(A.json)), Object.keys(A.json.cast || {}).join(','));
/* door finding 1, 28 Sep 2026: a typed name reached the database filter as typed. A name that carries filter syntax is refused before any lookup. */
const shaped = await call('POST', '/api/login', { body: { business: 'x,slug.neq.x', code: CODE } }), dotted = await call('POST', '/api/login', { body: { business: 'https://www.Alpha.Test/about', code: CODE } });
check('door: a name carrying filter syntax is refused, while a real name typed as a web address still signs in', shaped.status === 401 && shaped.text === wrongName.text && dotted.status === 200 && dotted.json.slug === 'alpha', [shaped.status, dotted.status]);
/* memory mode never builds the database filter, so the probe above passes with or without the rule. Assert the SOURCE ORDER instead: the rule must run before the one place a typed name meets a filter. */
{ const src = fs.readFileSync(path.join(ROOT, 'apps/api/lib/clients.js'), 'utf8'); const fn = src.slice(src.indexOf('export async function findClient'), src.indexOf('export async function loadCast'));
  const rule = fn.search(/if \(!\/\^\[a-z0-9\.-\]\{1,80\}\$\/\.test\(t\)\) return null;/), filter = fn.indexOf('.or(');
  check('door: in database mode the name rule runs before the typed name reaches the filter', rule > -1 && filter > -1 && rule < filter, { rule, filter }); }
const ta = A.json.token, tb = Bt.json.token;

/* A writes. B tries everything. */
const row = await call('POST', '/api/alpha/enquiries', { token: ta, body: { name: 'Alpha Secret Customer', phone: '0770000001', wants: 'Only Alpha may read this', by: 'Forged Name', id: 'chosen-id', client: 'beta' } });
check('A writes a row: the server names the seat itself and chooses the id itself', row.status === 201 && row.json.by === 'Owner' && row.json.id !== 'chosen-id', { by: row.json?.by, id: row.json?.id });
const id = row.json.id; const probes = [];
const probe = async (name, want, method, url, opt) => { const r = await call(method, url, opt); const leaked = /Alpha Secret|Only Alpha/.test(r.text); const ok = want.includes(r.status) && !leaked; probes.push({ name, status: r.status, ok }); check(name, ok, r.status + (leaked ? ' AND ALPHA\'S ROW WAS IN THE ANSWER' : '') + ' ' + r.text.slice(0, 60)); return r; };
await probe('no token: Alpha\'s list', [401], 'GET', '/api/alpha/enquiries');
await probe('no token: Alpha\'s settings', [401], 'GET', '/api/alpha/cast');
await probe('no token: a write into Alpha', [401], 'POST', '/api/alpha/enquiries', { body: { name: 'x' } });
await probe('B\'s token on Alpha\'s list', [401], 'GET', '/api/alpha/enquiries', { token: tb });
await probe('B\'s token on Alpha\'s row, by its id', [401], 'GET', '/api/alpha/enquiries/' + id, { token: tb });
await probe('B\'s token on Alpha\'s settings', [401], 'GET', '/api/alpha/cast', { token: tb });
await probe('B\'s token changing Alpha\'s row', [401], 'PATCH', '/api/alpha/enquiries/' + id, { token: tb, body: { name: 'Taken' } });
await probe('B\'s token deleting Alpha\'s row', [401], 'DELETE', '/api/alpha/enquiries/' + id, { token: tb });
await probe('B asks its OWN address for Alpha\'s id', [404], 'GET', '/api/beta/enquiries/' + id, { token: tb });
await probe('B changes Alpha\'s id through its OWN address', [404], 'PATCH', '/api/beta/enquiries/' + id, { token: tb, body: { name: 'Taken' } });
await probe('B deletes Alpha\'s id through its OWN address', [204, 404], 'DELETE', '/api/beta/enquiries/' + id, { token: tb });
const bl = await call('GET', '/api/beta/enquiries?limit=1000&offset=0', { token: tb });
check('B\'s own list holds nothing of Alpha\'s', bl.status === 200 && Array.isArray(bl.json) && !/Alpha/.test(bl.text), bl.text.slice(0, 80));
/* guesses at the address */
await probe('the slug in capitals', [401, 404], 'GET', '/api/ALPHA/enquiries', { token: ta });
await probe('a slug that climbs out of the folder', [400, 401, 404], 'GET', '/api/..%2Falpha/enquiries', { token: tb });
await probe('a table that is not one of the five', [404], 'GET', '/api/alpha/os_clients', { token: ta });
await probe('the clients table by its real name', [404], 'GET', '/api/alpha/clients', { token: ta });
await probe('the BB onboarding door with no key', [401, 403], 'GET', '/api/bb/clients');
await probe('the BB onboarding door with a client\'s token as the key', [401, 403], 'GET', '/api/bb/clients', { token: ta, headers: { 'X-BB-Admin': ta } });
await probe('the BB onboarding door, writing, with no key', [401, 403], 'POST', '/api/bb/clients', { body: { slug: 'gamma', name: 'Gamma' } });
/* forged tokens */
const [body, sig] = ta.split('.'); const p = JSON.parse(Buffer.from(body, 'base64url').toString());
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
await probe('A\'s token with the slug rewritten to beta, old signature kept', [401], 'GET', '/api/beta/enquiries', { token: b64({ ...p, slug: 'beta' }) + '.' + sig });
await probe('a token signed with a guessed secret', [401], 'GET', '/api/alpha/enquiries', { token: (x => x + '.' + createHmac('sha256', 'dev-only-secret').update(x).digest('base64url'))(b64({ slug: 'alpha', seat: 'Owner', exp: Date.now() + 1e9 })) });
await probe('a token with no signature', [401], 'GET', '/api/alpha/enquiries', { token: body + '.' });
await probe('a token with no signature and no dot', [401], 'GET', '/api/alpha/enquiries', { token: body });
await probe('a token that ran out, signed properly', [401], 'GET', '/api/alpha/enquiries', { token: (x => x + '.' + createHmac('sha256', SECRET).update(x).digest('base64url'))(b64({ slug: 'alpha', seat: 'Owner', exp: Date.now() - 1000 })) });
/* Alpha is untouched */
const still = await call('GET', '/api/alpha/enquiries/' + id, { token: ta });
const list = await call('GET', '/api/alpha/enquiries?limit=50&offset=0', { token: ta });
check('after every probe Alpha\'s row is still there and still Alpha\'s, by its id and in its list', still.status === 200 && still.json?.name === 'Alpha Secret Customer' && still.json?.by === 'Owner' && list.json?.some(x => x.id === id), { byId: still.status, inList: list.json?.length });
const own = await call('PATCH', '/api/alpha/enquiries/' + id, { token: ta, body: { wants: 'Changed by Alpha' } });
check('Alpha can change its own row, so the refusals above were the wall and not a broken address', own.status === 200 && own.json?.wants === 'Changed by Alpha', own.status);
/* paging on the real code */
for (let i = 0; i < 12; i++) await call('POST', '/api/alpha/tasks', { token: ta, body: { text: 'Task ' + i } });
const p1 = await call('GET', '/api/alpha/tasks?limit=5&offset=0', { token: ta }), p2 = await call('GET', '/api/alpha/tasks?limit=5&offset=5', { token: ta }), p3 = await call('GET', '/api/alpha/tasks?limit=5&offset=10', { token: ta }), big = await call('GET', '/api/alpha/tasks?limit=999999&offset=-4', { token: ta });
const ids = [...p1.json, ...p2.json, ...p3.json].map(x => x.id);
check('the real API pages: three pages of five hold twelve different rows and the last page is short', p1.json.length === 5 && p2.json.length === 5 && p3.json.length === 2 && new Set(ids).size === 12, [p1.json.length, p2.json.length, p3.json.length]);
check('the real API refuses a silly limit and a negative offset without an error', big.status === 200 && big.json.length === 12, [big.status, big.json?.length]);
/* who may call from a browser */
const cors = await fetch(B + '/api/login', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
check('a page on another site is not named as an allowed caller', cors.headers.get('access-control-allow-origin') !== '*' && cors.headers.get('access-control-allow-origin') !== 'https://evil.example', cors.headers.get('access-control-allow-origin'));

/* READ FROM THE CODE, because memory mode cannot reach it: the database door */
const clients = fs.readFileSync(path.join(ROOT, 'apps/api/lib/clients.js'), 'utf8');
const raw = /\.or\(`slug\.eq\.\$\{t\}/.test(clients), guarded = /findClient[\s\S]{0,400}\/\^\[a-z0-9.\-\]/.test(clients) || /norm = s =>[^\n]*replace\(\/\[\^a-z0-9/.test(clients);
console.log((raw && !guarded ? 'NOTE ' : 'PASS ') + 'database mode, read from the code: what is typed at the door is ' + (raw && !guarded ? 'put into the database filter as typed. A name carrying a comma could widen the search to any client. It still needs a valid code, so this is NOT a way in, and the fix (accept only letters, digits, dots and dashes) touches the door: a decision for Thulaib.' : 'cleaned before it reaches the database filter'));
const bad = results.filter(r => !r.pass);
console.log('\nTENANT WALL: ' + probes.length + ' probes sent, ' + probes.filter(x => x.ok).length + ' turned away. ' + (results.length - bad.length) + ' of ' + results.length + ' checks passed.'); bad.forEach(b => console.log('   FAIL ' + b.name));
stop(bad.length ? 1 : 0);
