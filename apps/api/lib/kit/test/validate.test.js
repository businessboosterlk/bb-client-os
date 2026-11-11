import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../validate.js';

const schema = {
  name: { type: 'string', max: 120, required: true }, age: { type: 'number', min: 0, max: 150, integer: true },
  role: { type: 'enum', of: ['admin', 'staff'] }, on: { type: 'boolean' }, email: { type: 'email' },
  id: { type: 'uuid' }, when: { type: 'date' }, tags: { type: 'array', of: { type: 'string', max: 40 }, maxItems: 20 },
};

test('a good record passes, strings trimmed', () => {
  const r = validate(schema, { name: '  Nimal ', age: 30, role: 'staff', on: true, email: 'A@B.lk', id: '3f2b8c1e-4a5d-4e6f-8a7b-1c2d3e4f5a6b', when: '2026-11-11', tags: [' a '] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.name, 'Nimal');
  assert.equal(r.value.email, 'a@b.lk');
  assert.deepEqual(r.value.tags, ['a']);
});

test('an unknown key is rejected', () => {
  const r = validate(schema, { name: 'x', is_admin: true });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [{ field: 'is_admin', problem: 'unknown field' }]);
});

test('"12" is not a number unless coerce is on', () => {
  assert.equal(validate(schema, { name: 'x', age: '12' }).ok, false);
  const r = validate({ age: { type: 'number', coerce: true } }, { age: '12' });
  assert.equal(r.ok, true); assert.equal(r.value.age, 12);
});

test('required, max, integer, enum, email, uuid, date, array limits', () => {
  const bad = validate(schema, { age: 1.5, role: 'owner', email: 'nope', id: '123', when: '11/11/2026', tags: Array(21).fill('a') });
  const fields = bad.errors.map(e => e.field).sort();
  assert.deepEqual(fields, ['age', 'email', 'id', 'name', 'role', 'tags', 'when']);
  assert.equal(validate(schema, { name: 'x'.repeat(121) }).ok, false);
  assert.equal(validate(schema, { name: 'x', tags: ['y'.repeat(41)] }).errors[0].field, 'tags[0]');
});

test('default string max of 2000', () => {
  assert.equal(validate({ s: { type: 'string' } }, { s: 'a'.repeat(2001) }).ok, false);
  assert.equal(validate({ s: { type: 'string' } }, { s: 'a'.repeat(2000) }).ok, true);
});

test('errors never echo the value sent', () => {
  const r = validate(schema, { name: 'x', email: 'secret-value-123' });
  assert.ok(!JSON.stringify(r.errors).includes('secret-value-123'));
});

test('a non object body is refused', () => {
  assert.equal(validate(schema, [1, 2]).ok, false);
  assert.equal(validate(schema, 'x').ok, false);
});
