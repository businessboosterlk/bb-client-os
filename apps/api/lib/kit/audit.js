/* audit.js: who changed what, when and from where.
   auditRow() builds one row; makeAuditWriter() wraps the caller's own insert (for example a Supabase insert)
   so the kit holds no database code. The row records changed field NAMES only, never values, so a password,
   token or key can never land in the audit table. Zero dependencies. */

import { clientAddress } from './shield.js';

/* Field names that are secret by their name. Their values are never recorded anywhere. */
export const SECRET_NAME = /pass(word)?|token|secret|(^|_|-)key($|_|-)|apikey|api_key|pin($|_|-)|^pin|otp|salt|hash|credential|session/i;

/**
 * @param {{ request?: Request, who?: string | null, action: string, table?: string | null, id?: string | number | null,
 *           before?: Record<string, any> | null, after?: Record<string, any> | null }} input
 * @returns {{ at: string, who: string | null, action: string, table_name: string | null, row_id: string | null,
 *            ip: string | null, user_agent: string | null, changed: string[] }}
 */
export function auditRow({ request, who = null, action, table = null, id = null, before = null, after = null }) {
  return {
    at: new Date().toISOString(),
    who: who == null ? null : String(who),
    action,
    table_name: table,
    row_id: id == null ? null : String(id),
    ip: request ? clientAddress(request) : null,
    user_agent: request ? (request.headers.get('user-agent') || '').slice(0, 300) || null : null,
    changed: changedFields(before, after),
  };
}

/**
 * Names of fields whose value differs between before and after. Values are never returned.
 * @param {Record<string, any> | null | undefined} before @param {Record<string, any> | null | undefined} after
 * @returns {string[]}
 */
export function changedFields(before, after) {
  const b = before || {}, a = after || {};
  const names = new Set([...Object.keys(b), ...Object.keys(a)]);
  const out = [];
  for (const n of names) if (!same(b[n], a[n])) out.push(n);
  return out.sort();
}

/** @param {any} x @param {any} y */
function same(x, y) {
  if (x === y) return true;
  try { return JSON.stringify(x) === JSON.stringify(y); } catch { return false; }
}

/** True when a field name looks secret (password, token, secret, key, pin and the like). */
export const isSecretField = (/** @type {string} */ name) => SECRET_NAME.test(String(name));

/**
 * Wraps the caller's insert so handle() can call write(row).
 * Example: makeAuditWriter(row => supabase.from('audit_log').insert(row))
 * A Supabase style answer with an error field is turned into a throw, so a failed write is never silent.
 * @param {(row: object) => Promise<any> | any} insertFn
 */
export function makeAuditWriter(insertFn) {
  if (typeof insertFn !== 'function') throw new TypeError('makeAuditWriter needs an insert function');
  return async function write(/** @type {object} */ row) {
    const res = await insertFn(row);
    if (res && typeof res === 'object' && res.error) throw new Error('audit write failed: ' + (res.error.message || 'unknown'));
    return res;
  };
}
