/* handle.js: one wrapper around every route method.
     export const POST = handle(async ({ body }) => ({ saved: true }), { schema, audit })
   It reads the body with a hard cap (413), parses JSON safely (bad JSON is a 400), validates the body and the
   search params (400 with field names only), runs the route, turns a returned plain object into JSON and
   catches every throw. A caller never sees a stack, a message, a file path or SQL: only
   { error: 'Something went wrong', ref } with status 500, while the full error goes to console.error under the
   same ref so the team can find it in the logs. Zero dependencies. */

import { validate } from './validate.js';
import { auditRow } from './audit.js';
import { MB } from './shield.js';

/** Throw this to answer 400, 401, 403, 404, 409 or 422 on purpose with a message the caller may read. */
export class HttpError extends Error {
  /** @param {number} status @param {string} publicMessage @param {Record<string, any>} [extra] */
  constructor(status, publicMessage, extra) {
    super(publicMessage);
    this.name = 'HttpError';
    this.status = status;
    this.publicMessage = publicMessage;
    this.extra = extra;
  }
}

/** A JSON answer with no caching. @param {any} data @param {number} [status] @param {Record<string, string>} [headers] */
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** A short random id that ties an answer to its log line. */
export function makeRef() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '').slice(0, 10);
  return Math.random().toString(36).slice(2, 12);
}

class TooLarge extends Error {}

/** Reads the whole body as bytes and stops the moment it passes maxBytes. @param {Request} request @param {number} maxBytes */
async function readCapped(request, maxBytes) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const parts = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel(); } catch { /* already closed */ } throw new TooLarge(); }
    parts.push(value);
  }
  const out = new Uint8Array(total); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

/**
 * @param {(ctx: { request: Request, context: any, body: any, query: Record<string, any>,
 *   audit: { who?: string, table?: string, id?: string | number, before?: object, after?: object } }) => any} fn
 * @param {{ schema?: Record<string, any>, query?: Record<string, any>, maxBytes?: number, raw?: boolean,
 *   audit?: { action: string, write: (row: object) => any, required?: boolean } }} [options]
 *   raw: true hands the route the body as bytes (for uploads) instead of parsed JSON.
 * @returns {(request: Request, context?: any) => Promise<Response>}
 */
export function handle(fn, options = {}) {
  const { schema, query: querySchema, maxBytes = 1 * MB, raw = false, audit } = options;

  return async function handler(request, context) {
    const ref = makeRef();
    try {
      const method = request.method.toUpperCase();

      /* body: capped on the real length, whatever Content-Length claimed */
      let body;
      if (method !== 'GET' && method !== 'HEAD') {
        let bytes;
        try { bytes = await readCapped(request, maxBytes); }
        catch (e) { if (e instanceof TooLarge) return json({ error: 'Too large' }, 413); throw e; }
        if (raw) body = bytes;
        else if (bytes.byteLength === 0) body = schema ? {} : null;
        else {
          try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
          catch { return json({ error: 'Invalid JSON' }, 400); }
        }
        if (schema && !raw) {
          const v = validate(schema, body);
          if (!v.ok) return json({ error: 'Invalid input', fields: v.errors }, 400);
          body = v.value;
        }
      }

      /* search params */
      const params = Object.fromEntries(new URL(request.url).searchParams);
      let query = params;
      if (querySchema) {
        const v = validate(querySchema, params);
        if (!v.ok) return json({ error: 'Invalid query', fields: v.errors }, 400);
        query = v.value;
      }

      /* the route itself; it may fill auditInfo with who, table, id, before and after */
      const auditInfo = {};
      const result = await fn({ request, context, body, query, audit: auditInfo });

      /* the audit row, only for a change that succeeded */
      if (audit && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const ok = !(result instanceof Response) || result.status < 400;
        if (ok) {
          try {
            await audit.write(auditRow({ request, action: audit.action, ...auditInfo }));
          } catch (e) {
            console.error(`[kit] audit write failed ref=${ref} action=${audit.action}`, e);
            if (audit.required) return json({ error: 'Something went wrong', ref }, 500);
          }
        }
      }

      if (result instanceof Response) return result;
      if (result === undefined || result === null) return new Response(null, { status: 204 });
      return json(result);
    } catch (e) {
      if (e instanceof HttpError && e.status >= 400 && e.status < 500) {
        return json({ error: e.publicMessage, ...(e.extra || {}) }, e.status);
      }
      console.error(`[kit] error ref=${ref} ${request.method} ${safePath(request.url)}`, e);
      return json({ error: 'Something went wrong', ref }, 500);
    }
  };
}

/** @param {string} url */
function safePath(url) { try { return new URL(url).pathname; } catch { return '(bad url)'; } }
