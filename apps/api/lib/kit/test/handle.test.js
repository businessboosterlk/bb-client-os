import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handle, HttpError } from '../handle.js';

const post = (body, headers = { 'content-type': 'application/json' }) => new Request('http://x.test/api/thing', { method: 'POST', headers, body });
const schema = { name: { type: 'string', required: true } };

test('a returned object becomes JSON', async () => {
  const h = handle(async ({ body }) => ({ hello: body.name }), { schema });
  const r = await h(post('{"name":"Kamal"}'));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { hello: 'Kamal' });
});

test('bad JSON is a 400', async () => {
  const r = await handle(async () => ({}), { schema })(post('{"name":'));
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: 'Invalid JSON' });
});

test('an unknown key is a 400 naming the field only', async () => {
  const r = await handle(async () => ({}), { schema })(post('{"name":"a","role":"admin-value"}'));
  assert.equal(r.status, 400);
  const text = await r.text();
  assert.match(text, /"role"/);
  assert.doesNotMatch(text, /admin-value/);
});

test('the real body is capped: 413 even with no Content-Length', async () => {
  const big = new ReadableStream({ start(c) { for (let i = 0; i < 5; i++) c.enqueue(new Uint8Array(1000)); c.close(); } });
  const r = await handle(async () => ({}), { maxBytes: 2000 })(new Request('http://x.test/api/x', { method: 'POST', body: big, duplex: 'half' }));
  assert.equal(r.status, 413);
});

test('a thrown error leaks no path, SQL or message; the log carries the same ref', async () => {
  const logged = [];
  const spy = mock.method(console, 'error', (...a) => logged.push(a.map(String).join(' ')));
  try {
    const h = handle(async () => { throw new Error('relation "clients" does not exist at /Users/bb/app/lib/db.js:12:5 SELECT * FROM clients WHERE pin = 1234'); });
    const r = await h(new Request('http://x.test/api/boom'));
    assert.equal(r.status, 500);
    const text = await r.text(), body = JSON.parse(text);
    assert.equal(body.error, 'Something went wrong');
    assert.match(body.ref, /^[a-z0-9]{6,12}$/);
    for (const bad of ['/Users/', 'db.js', 'SELECT', 'relation', 'clients', '1234', 'at ']) assert.ok(!text.includes(bad), 'leaked ' + bad);
    assert.deepEqual(Object.keys(body).sort(), ['error', 'ref']);
    assert.ok(logged.some(l => l.includes(body.ref) && l.includes('SELECT')), 'the full error is logged with the ref');
  } finally { spy.mock.restore(); }
});

test('HttpError answers on purpose', async () => {
  for (const s of [401, 403, 404, 409]) {
    const r = await handle(async () => { throw new HttpError(s, 'Nope'); })(new Request('http://x.test/a'));
    assert.equal(r.status, s);
    assert.deepEqual(await r.json(), { error: 'Nope' });
  }
});

test('query params are validated', async () => {
  const h = handle(async ({ query }) => query, { query: { page: { type: 'number', coerce: true, integer: true, min: 1 } } });
  assert.deepEqual(await (await h(new Request('http://x.test/a?page=2'))).json(), { page: 2 });
  assert.equal((await h(new Request('http://x.test/a?page=0'))).status, 400);
  assert.equal((await h(new Request('http://x.test/a?evil=1'))).status, 400);
});

test('audit: written after a successful change, never on GET, failure logged and not fatal', async () => {
  const rows = [];
  const audit = { action: 'client.update', write: async row => rows.push(row) };
  const h = handle(async ({ audit: a }) => { Object.assign(a, { who: 'u1', table: 'clients', id: 7, before: { name: 'a', password: 'old' }, after: { name: 'b', password: 'new' } }); return { ok: true }; }, { audit });
  assert.equal((await h(post('{}'))).status, 200);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action, 'client.update');
  assert.deepEqual(rows[0].changed, ['name', 'password']);
  assert.ok(!JSON.stringify(rows[0]).includes('old') && !JSON.stringify(rows[0]).includes('new'));
  await handle(async () => ({}), { audit })(new Request('http://x.test/a'));
  assert.equal(rows.length, 1, 'GET is not audited');

  const spy = mock.method(console, 'error', () => {});
  try {
    const failing = { action: 'x', write: async () => { throw new Error('db down'); } };
    assert.equal((await handle(async () => ({ ok: 1 }), { audit: failing })(post('{}'))).status, 200);
    assert.equal((await handle(async () => ({ ok: 1 }), { audit: { ...failing, required: true } })(post('{}'))).status, 500);
  } finally { spy.mock.restore(); }
});
