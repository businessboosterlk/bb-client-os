/* upload.js: is this file what it says it is, and small enough?
   checkUpload() decides the type from the first bytes (magic numbers), never from the name or the declared
   type alone. A name whose extension disagrees with the bytes is refused, and so is a declared type that
   disagrees. The name is reduced to a safe base name for storage. Zero dependencies. */

import { MB } from './shield.js';

/* type: [ extensions, test on the first bytes ] */
/** @type {Record<string, [string[], (b: Uint8Array) => boolean]>} */
const SIGNATURES = {
  'image/png': [['png'], b => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/jpeg': [['jpg', 'jpeg'], b => starts(b, [0xff, 0xd8, 0xff])],
  'image/webp': [['webp'], b => starts(b, [0x52, 0x49, 0x46, 0x46]) && ascii(b, 8, 4) === 'WEBP'],
  'image/gif': [['gif'], b => ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a'],
  'application/pdf': [['pdf'], b => ascii(b, 0, 5) === '%PDF-'],
};

/** @param {Uint8Array} b @param {number[]} sig */
function starts(b, sig) { if (b.length < sig.length) return false; for (let i = 0; i < sig.length; i++) if (b[i] !== sig[i]) return false; return true; }
/** @param {Uint8Array} b @param {number} at @param {number} n */
function ascii(b, at, n) { let s = ''; for (let i = at; i < at + n && i < b.length; i++) s += String.fromCharCode(b[i]); return s; }

/** The type the bytes prove, or null. @param {Uint8Array | ArrayBuffer} bytes @returns {string | null} */
export function sniffType(bytes) {
  const b = toBytes(bytes);
  for (const [type, [, test]] of Object.entries(SIGNATURES)) if (test(b)) return type;
  return null;
}

/** A safe base name: no folders, no control characters, no leading dots, at most 120 characters. @param {string} name */
export function safeName(name) {
  let n = String(name || '').split(/[\\/]/).pop() || '';
  n = [...n.normalize('NFKC')].filter(c => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127).join('').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').replace(/_{2,}/g, '_');
  n = n.replace(/^\.+/, '').replace(/\.{2,}/g, '.');
  if (n.length > 120) { const dot = n.lastIndexOf('.'); const ext = dot > 0 ? n.slice(dot) : ''; n = n.slice(0, 120 - ext.length) + ext; }
  return n || 'file';
}

/** @param {any} x @returns {Uint8Array} */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  return new Uint8Array(0);
}

/**
 * @param {{ bytes: Uint8Array | ArrayBuffer, name?: string, declaredType?: string }} file
 * @param {{ maxMb?: number, allow?: string[] }} [opts]
 * @returns {{ ok: boolean, type: string | null, reason: string | null, name: string }}
 */
export function checkUpload({ bytes, name = '', declaredType = '' }, opts = {}) {
  const { maxMb = 10, allow = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] } = opts;
  const b = toBytes(bytes), clean = safeName(name);
  const no = (/** @type {string} */ reason) => ({ ok: false, type: null, reason, name: clean });
  if (b.length === 0) return no('empty file');
  if (b.length > maxMb * MB) return no(`larger than ${maxMb} MB`);
  const type = sniffType(b);
  if (!type) return no('file type not recognised');
  if (!allow.includes(type)) return no('file type not allowed');
  const dot = clean.lastIndexOf('.');
  const ext = dot > 0 ? clean.slice(dot + 1).toLowerCase() : '';
  if (!ext) return no('file name has no extension');
  if (!SIGNATURES[type][0].includes(ext)) return no('file name does not match its contents');
  const declared = String(declaredType || '').split(';')[0].trim().toLowerCase();
  if (declared && declared !== 'application/octet-stream' && declared !== type) return no('declared type does not match its contents');
  return { ok: true, type, reason: null, name: clean };
}
