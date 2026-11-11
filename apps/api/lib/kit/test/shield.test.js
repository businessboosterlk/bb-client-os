import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shield, createLimiter, clientAddress, DEFAULT_RULES } from '../shield.js';

const req = (path, init = {}) => new Request('http://x.test' + path, init);

test('429 after the limit, with Retry-After, and a fresh window lets through again (fake clock)', async () => {
  let t = 1_000_000;
  const limiter = createLimiter({ now: () => t });
  const rules = [{ match: /^\/api\/login/, limit: 3, windowMs: 60_000 }];
  for (let i = 0; i < 3; i++) assert.equal(shield(req('/api/login'), { rules, limiter }), null);
  const r = shield(req('/api/login'), { rules, limiter });
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('retry-after'), '60');
  assert.deepEqual(await r.json(), { error: 'Too many requests, please wait and try again' });
  t += 30_000;
  assert.equal(shield(req('/api/login'), { rules, limiter }).headers.get('retry-after'), '30');
  t += 30_001;
  assert.equal(shield(req('/api/login'), { rules, limiter }), null);
});

test('limits are per address and per rule', () => {
  const limiter = createLimiter({ now: () => 0 });
  const rules = [{ match: /^\/api\//, limit: 1, windowMs: 1000 }];
  assert.equal(shield(req('/api/a', { headers: { 'x-forwarded-for': '1.1.1.1, 10.0.0.1' } }), { rules, limiter }), null);
  assert.equal(shield(req('/api/a', { headers: { 'x-forwarded-for': '1.1.1.1' } }), { rules, limiter }).status, 429);
  assert.equal(shield(req('/api/a', { headers: { 'x-forwarded-for': '2.2.2.2' } }), { rules, limiter }), null);
});

test('default rules: login 10, api 600', () => {
  assert.equal(DEFAULT_RULES[0].limit, 10);
  assert.equal(DEFAULT_RULES[1].limit, 600);
});

test('client address order: forwarded first hop, real ip, local', () => {
  assert.equal(clientAddress(req('/', { headers: { 'x-forwarded-for': ' 9.9.9.9 , 8.8.8.8' } })), '9.9.9.9');
  assert.equal(clientAddress(req('/', { headers: { 'x-real-ip': '7.7.7.7' } })), '7.7.7.7');
  assert.equal(clientAddress(req('/')), 'local');
});

test('memory is bounded: old windows are evicted', () => {
  let t = 0;
  const l = createLimiter({ now: () => t, maxKeys: 50 });
  for (let i = 0; i < 500; i++) { l.hit('k' + i, 5, 1000); t++; }
  assert.ok(l.size() <= 51, 'size ' + l.size());
});

test('413 on a JSON body over 1 MB by Content-Length', () => {
  const r = shield(req('/api/x', { method: 'POST', headers: { 'content-length': String(1_000_001) } }), { rules: [] });
  assert.equal(r.status, 413);
  assert.equal(shield(req('/api/x', { method: 'POST', headers: { 'content-length': '999999' } }), { rules: [] }), null);
});

test('upload paths get their own cap', () => {
  const o = { rules: [], uploadMb: 2 };
  assert.equal(shield(req('/api/upload', { method: 'POST', headers: { 'content-length': String(1_500_000) } }), o), null);
  assert.equal(shield(req('/api/upload', { method: 'POST', headers: { 'content-length': String(2 * 1024 * 1024) } }), o).status, 413);
});

test('411 on an upload POST with a body and no Content-Length', () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(10)); c.close(); } });
  const r = shield(new Request('http://x.test/api/upload', { method: 'POST', body: stream, duplex: 'half' }), { rules: [] });
  assert.equal(r.status, 411);
});

test('a GET passes with no body checks', () => {
  assert.equal(shield(req('/api/upload'), { rules: [] }), null);
});
