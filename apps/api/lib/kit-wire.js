/* THE KIT, WIRED TO THE HUB (11 Nov 2026). Every route method is exported as handle(...) from lib/kit/handle.js,
   so every answer has a size cap on the real body, safe JSON and a 500 with a ref instead of a stack.
   handle() reads the body itself and hands the route { request, context, body }. The Hub's routes and the lib
   functions they forward to (work-api.js, files.js, staff.js) were written as (req, context) and read req.json()
   or req.arrayBuffer() themselves. old(fn) bridges the two: it builds a fresh Request with the same address,
   method and headers and the body handle() already read (re-serialised JSON, or the bytes untouched when raw),
   so every existing rule and every existing error sentence stays as it was.
     export const POST = handle(old((req, { params }) => postMsg(req, ...)), { schema })
   The limits the shield applies live here too, so middleware.js reads one place. */
import { MB } from './kit/shield.js';

/** @param {(req: Request, context: any) => any} fn @param {{ raw?: boolean }} [opts] */
export function old(fn, opts = {}) {
  const raw = !!opts.raw;
  return async ({ request, context, body }) => {
    const method = request.method.toUpperCase();
    const headers = new Headers(request.headers);
    headers.delete('content-length');            /* the new body sets its own length */
    /** @type {RequestInit} */
    const init = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && body !== null && body !== undefined) {
      /* bytes (handle's raw: true) go through untouched; anything else was parsed JSON and is written back as JSON */
      init.body = raw || body instanceof Uint8Array ? body : JSON.stringify(body);
    }
    return fn(new Request(request.url, init), context);
  };
}

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

/* All per caller address, one minute windows. Railway runs ONE instance, so the in-memory count is real there.
   The guess lock for codes is lib/lock.js (8 wrong codes per business and caller, 15 minutes); this is a second
   layer against floods. Tunable without a code change: HUB_LIMIT_LOGIN, HUB_LIMIT_API, HUB_RAW_MB. */
export const LIMITS = {
  login: num(process.env.HUB_LIMIT_LOGIN, 30),
  api: num(process.env.HUB_LIMIT_API, 1200),
  jsonMb: 1,
  rawMb: num(process.env.HUB_RAW_MB, 6),       /* decimal; files.js keeps its own cap of 5,242,880 bytes */
};
export const RAW_BYTES = LIMITS.rawMb * MB;
export const RAW_PATH = /^\/api\/[^/]+\/work\/files\/[^/]+\/raw\/?$/;
export const RULES = [
  { match: /^\/api\/login\/?$/, limit: LIMITS.login, windowMs: 60_000 },
  { match: /^\/api\//, limit: LIMITS.api, windowMs: 60_000 },
];
