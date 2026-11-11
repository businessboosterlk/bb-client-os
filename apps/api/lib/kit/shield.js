/* shield.js: the front door. Runs before any route, in Next middleware or a plain node server.
   shield(request, options) returns null to let the request through, or a Response that answers it.
   It does two things: a rate limit per client address and rule (429) and a body size cap read from
   Content-Length (413, or 411 when an upload path gets a body with no length).

   IMPORTANT: the limiter keeps its counts in memory, so it is per server instance. One Next server or one
   container is covered. When a host runs several instances (serverless functions, autoscaled containers,
   Vercel), each instance counts on its own and the real limit becomes limit x instances. For those hosts pass
   a shared store through options.limiter (an object with the same hit() as createLimiter, backed by Redis,
   Upstash or a database table) and keep the rules the same.

   Megabytes here are decimal: 1 MB = 1,000,000 bytes. Zero dependencies. */

export const MB = 1_000_000;

export const DEFAULT_RULES = [
  { match: /^\/api\/login/, limit: 10, windowMs: 60_000 },
  { match: /^\/api\//, limit: 600, windowMs: 60_000 },
];

/**
 * A fixed window counter in memory, keyed by any string. Memory is bounded: expired windows are swept and,
 * past maxKeys, the oldest windows are evicted first.
 * @param {{ now?: () => number, maxKeys?: number }} [opts]  now: a clock, swap in a fake one for tests.
 */
export function createLimiter(opts = {}) {
  const now = opts.now || Date.now, maxKeys = opts.maxKeys || 10_000;
  /** @type {Map<string, { start: number, count: number, windowMs: number }>} */
  const windows = new Map();
  let lastSweep = 0;

  /** @param {number} t */
  function sweep(t) {
    for (const [k, w] of windows) if (t - w.start >= w.windowMs) windows.delete(k);
    for (const k of windows.keys()) { if (windows.size <= maxKeys) break; windows.delete(k); } /* Map keeps insertion order: oldest first */
    lastSweep = t;
  }

  return {
    /**
     * Counts one hit. Returns whether it is allowed and, when not, how many seconds until the window resets.
     * @param {string} key @param {number} limit @param {number} windowMs
     */
    hit(key, limit, windowMs) {
      const t = now();
      if (windows.size > maxKeys || t - lastSweep > 60_000) sweep(t);
      let w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.delete(key);
        w = { start: t, count: 0, windowMs };
        windows.set(key, w);
      }
      w.count++;
      const retryAfter = Math.max(1, Math.ceil((w.start + windowMs - t) / 1000));
      return { allowed: w.count <= limit, remaining: Math.max(0, limit - w.count), retryAfter };
    },
    size: () => windows.size,
  };
}

/** The client address: first hop of x-forwarded-for, else x-real-ip, else 'local'. @param {Request} request */
export function clientAddress(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) { const first = xff.split(',')[0].trim(); if (first) return first; }
  const real = request.headers.get('x-real-ip');
  return (real && real.trim()) || 'local';
}

const defaultLimiter = createLimiter();

/** @param {number} status @param {string} error @param {Record<string, string>} [extra] */
function answer(status, error, extra = {}) {
  return new Response(JSON.stringify({ error }), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

/**
 * @param {Request} request
 * @param {{ rules?: { match: RegExp, limit: number, windowMs: number }[], jsonMb?: number, uploadMb?: number,
 *           uploadMatch?: RegExp, limiter?: { hit: Function }, skip?: RegExp }} [options]
 * @returns {Response | null}
 */
export function shield(request, options = {}) {
  const {
    rules = DEFAULT_RULES, jsonMb = 1, uploadMb = 10, uploadMatch = /^\/api\/upload/,
    limiter = defaultLimiter, skip = null,
  } = options;
  const path = new URL(request.url).pathname;
  if (skip && skip.test(path)) return null;

  /* (a) rate limit: the first rule that matches decides */
  const rule = rules.find(r => r.match.test(path));
  if (rule) {
    const ruleId = rules.indexOf(rule);
    const r = limiter.hit(`${clientAddress(request)}|${ruleId}`, rule.limit, rule.windowMs);
    if (!r.allowed) return answer(429, 'Too many requests, please wait and try again', { 'retry-after': String(r.retryAfter) });
  }

  /* (b) body size from Content-Length */
  const method = request.method.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const isUpload = uploadMatch.test(path);
    const cap = (isUpload ? uploadMb : jsonMb) * MB;
    const raw = request.headers.get('content-length');
    if (raw === null) {
      /* a body with no declared length on an upload path is refused; elsewhere handle() still caps the real body */
      const hasBody = request.body !== null || request.headers.has('transfer-encoding');
      if (isUpload && hasBody) return answer(411, 'Length required');
    } else {
      const len = Number(raw);
      if (!Number.isFinite(len) || len < 0) return answer(400, 'Bad request');
      if (len > cap) return answer(413, 'Too large');
    }
  }
  return null;
}
