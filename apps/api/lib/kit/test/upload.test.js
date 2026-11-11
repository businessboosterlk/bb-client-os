import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUpload, sniffType, safeName } from '../upload.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const PDF = new TextEncoder().encode('%PDF-1.7\n...');
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test('types come from the bytes', () => {
  assert.equal(sniffType(PNG), 'image/png'); assert.equal(sniffType(JPG), 'image/jpeg');
  assert.equal(sniffType(PDF), 'application/pdf'); assert.equal(sniffType(WEBP), 'image/webp');
  assert.equal(sniffType(new TextEncoder().encode('<script>')), null);
});

test('a good file passes', () => {
  assert.deepEqual(checkUpload({ bytes: PNG, name: 'logo.png', declaredType: 'image/png' }), { ok: true, type: 'image/png', reason: null, name: 'logo.png' });
  assert.equal(checkUpload({ bytes: JPG, name: 'a.JPEG' }).ok, true);
});

test('a PNG named .pdf is refused', () => {
  const r = checkUpload({ bytes: PNG, name: 'invoice.pdf', declaredType: 'application/pdf' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'file name does not match its contents');
});

test('a script named .png is refused', () => {
  assert.equal(checkUpload({ bytes: new TextEncoder().encode('<?php system($_GET[1]);'), name: 'x.png', declaredType: 'image/png' }).reason, 'file type not recognised');
});

test('a declared type that disagrees is refused', () => {
  assert.equal(checkUpload({ bytes: PNG, name: 'a.png', declaredType: 'image/jpeg' }).ok, false);
});

test('size and allow list', () => {
  const big = new Uint8Array(3_000_001); big.set(PNG);
  assert.equal(checkUpload({ bytes: big, name: 'a.png' }, { maxMb: 3 }).reason, 'larger than 3 MB');
  assert.equal(checkUpload({ bytes: PDF, name: 'a.pdf' }, { allow: ['image/png'] }).reason, 'file type not allowed');
  assert.equal(checkUpload({ bytes: new Uint8Array(0), name: 'a.png' }).reason, 'empty file');
});

test('names are reduced to a safe base name', () => {
  assert.equal(safeName('../../etc/passwd'), 'passwd');
  assert.equal(safeName('C:\\Users\\me\\My Photo (1).png'), 'My_Photo_1_.png');
  assert.equal(safeName('.htaccess'), 'htaccess');
  assert.equal(safeName('a\u0000b.png'), 'ab.png');
  assert.equal(safeName(''), 'file');
  assert.ok(safeName('x'.repeat(300) + '.png').length <= 120);
});
