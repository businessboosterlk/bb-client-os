import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditRow, makeAuditWriter, changedFields, isSecretField } from '../audit.js';

const request = new Request('http://x.test/api/clients/7', { headers: { 'x-forwarded-for': '5.5.5.5', 'user-agent': 'TestAgent/1' } });

test('the row has the agreed shape', () => {
  const r = auditRow({ request, who: 'user-1', action: 'client.update', table: 'clients', id: 7, before: { name: 'A' }, after: { name: 'B' } });
  assert.deepEqual(Object.keys(r).sort(), ['action', 'at', 'changed', 'ip', 'row_id', 'table_name', 'user_agent', 'who']);
  assert.equal(r.ip, '5.5.5.5'); assert.equal(r.row_id, '7'); assert.equal(r.table_name, 'clients');
  assert.deepEqual(r.changed, ['name']);
});

test('a secret field value never appears in the row', () => {
  const before = { password: 'Hunter2Old', api_key: 'sk_old_value', pin: '4321', token: 'tok-old', client_secret: 's-old', name: 'x' };
  const after = { password: 'Hunter2New', api_key: 'sk_new_value', pin: '9876', token: 'tok-new', client_secret: 's-new', name: 'x' };
  const r = auditRow({ request, action: 'user.update', before, after });
  const text = JSON.stringify(r);
  for (const v of [...Object.values(before), ...Object.values(after)].filter(v => v !== 'x')) assert.ok(!text.includes(v), 'leaked ' + v);
  assert.deepEqual(r.changed, ['api_key', 'client_secret', 'password', 'pin', 'token']);
});

test('changedFields lists names only, added and removed included', () => {
  assert.deepEqual(changedFields({ a: 1, b: [1] }, { b: [1], c: 2 }), ['a', 'c']);
});

test('isSecretField spots the usual names', () => {
  for (const n of ['password', 'passwd', 'access_token', 'client_secret', 'api_key', 'pin', 'otp']) assert.ok(isSecretField(n), n);
  for (const n of ['name', 'monkey', 'keyboard_layout', 'spinner']) assert.ok(!isSecretField(n), n);
});

test('makeAuditWriter turns a Supabase style error into a throw', async () => {
  const ok = makeAuditWriter(async () => ({ error: null }));
  await ok({});
  const bad = makeAuditWriter(async () => ({ error: { message: 'permission denied' } }));
  await assert.rejects(bad({}), /audit write failed/);
  assert.throws(() => makeAuditWriter(null));
});
