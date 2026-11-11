/* validate.js: a plain object schema, checked with no library.
   validate(schema, data) returns { ok, value, errors }. value holds the cleaned data (strings trimmed,
   coerced numbers when coerce is on). errors is a list of { field, problem } with field NAMES only, never the
   value that was sent, so an error answer can be returned to the caller as it is.

   Field types: string, number, boolean, enum, email, uuid, date, array.
   Rules: required, max and min (string length, number size), integer, of (enum choices or the array item
   schema), maxItems, coerce (accept "12" as 12 and "true" as true; off by default, so no surprises).
   Unknown keys are rejected. Strings have a default max of 2000 characters. Zero dependencies. */

export const DEFAULT_STRING_MAX = 2000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * @typedef {{ type: 'string'|'number'|'boolean'|'enum'|'email'|'uuid'|'date'|'array', required?: boolean,
 *   max?: number, min?: number, integer?: boolean, of?: any, maxItems?: number, coerce?: boolean }} Field
 * @param {Record<string, Field>} schema
 * @param {any} data
 * @returns {{ ok: boolean, value: Record<string, any>, errors: { field: string, problem: string }[] }}
 */
export function validate(schema, data) {
  /** @type {{ field: string, problem: string }[]} */
  const errors = [];
  /** @type {Record<string, any>} */
  const value = {};
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, value, errors: [{ field: '(body)', problem: 'must be an object' }] };
  }
  for (const key of Object.keys(data)) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) errors.push({ field: key, problem: 'unknown field' });
  }
  for (const [key, field] of Object.entries(schema)) {
    const present = Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null;
    if (!present) { if (field.required) errors.push({ field: key, problem: 'required' }); continue; }
    const r = checkField(field, data[key], key);
    if (r.problem) errors.push({ field: r.field || key, problem: r.problem });
    else if (r.empty && field.required) errors.push({ field: key, problem: 'required' });
    else if (!r.empty) value[key] = r.value;
  }
  return { ok: errors.length === 0, value: errors.length ? {} : value, errors };
}

/** @param {Field} field @param {any} v @param {string} key @returns {{ value?: any, problem?: string, field?: string, empty?: boolean }} */
function checkField(field, v, key) {
  switch (field.type) {
    case 'string': case 'email': case 'uuid': case 'date': {
      if (typeof v !== 'string') return { problem: 'must be text' };
      const s = v.trim();
      if (s === '') return { empty: true };
      const max = field.max ?? (field.type === 'email' ? 254 : DEFAULT_STRING_MAX);
      if (s.length > max) return { problem: `longer than ${max} characters` };
      if (field.min != null && s.length < field.min) return { problem: `shorter than ${field.min} characters` };
      if (field.type === 'email' && !EMAIL.test(s)) return { problem: 'not an email address' };
      if (field.type === 'uuid' && !UUID.test(s)) return { problem: 'not a valid id' };
      if (field.type === 'date' && (!ISO_DATE.test(s) || Number.isNaN(Date.parse(s)))) return { problem: 'not a date (YYYY-MM-DD)' };
      return { value: field.type === 'email' ? s.toLowerCase() : s };
    }
    case 'number': {
      let n = v;
      if (typeof n === 'string' && field.coerce && /^-?\d+(\.\d+)?$/.test(n.trim())) n = Number(n.trim());
      if (typeof n !== 'number' || !Number.isFinite(n)) return { problem: 'must be a number' };
      if (field.integer && !Number.isInteger(n)) return { problem: 'must be a whole number' };
      if (field.min != null && n < field.min) return { problem: `below ${field.min}` };
      if (field.max != null && n > field.max) return { problem: `above ${field.max}` };
      return { value: n };
    }
    case 'boolean': {
      let b = v;
      if (field.coerce && (b === 'true' || b === 'false')) b = b === 'true';
      if (typeof b !== 'boolean') return { problem: 'must be true or false' };
      return { value: b };
    }
    case 'enum': {
      const choices = Array.isArray(field.of) ? field.of : [];
      if (!choices.includes(v)) return { problem: 'not one of the allowed choices' };
      return { value: v };
    }
    case 'array': {
      if (!Array.isArray(v)) return { problem: 'must be a list' };
      const maxItems = field.maxItems ?? 100;
      if (v.length > maxItems) return { problem: `more than ${maxItems} items` };
      const out = [];
      for (let i = 0; i < v.length; i++) {
        if (!field.of) { out.push(v[i]); continue; }
        if (v[i] === null || v[i] === undefined) return { field: `${key}[${i}]`, problem: 'required' };
        const r = checkField(field.of, v[i], `${key}[${i}]`);
        if (r.problem) return { field: r.field || `${key}[${i}]`, problem: r.problem };
        if (!r.empty) out.push(r.value);
      }
      return { value: out };
    }
    default:
      return { problem: 'schema has an unknown type' };
  }
}
