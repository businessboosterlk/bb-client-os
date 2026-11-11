/* headers.js: the security headers every BB answer carries.
   securityHeaders() returns the [{ key, value }] list Next.js wants from headers() in next.config.
   applyHeaders() sets the same list on a Response (middleware, route handlers, plain node servers).
   Zero dependencies. */

/* A strict default for an API: it serves JSON, never a page, so nothing may load and nothing may frame it. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/* A sensible default for an app that serves pages: own scripts only, no unsafe-eval, no wildcard script source.
   Inline styles are allowed because most component libraries set style attributes; inline scripts are not. */
export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const PERMISSIONS = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()';

/**
 * @param {{ csp?: string, frameAncestors?: string[] | 'self' | null, isApi?: boolean, permissions?: string }} [opts]
 *   csp: a full policy to use instead of the default (frame-ancestors is still added if missing).
 *   frameAncestors: who may frame the page. Not given means nobody (X-Frame-Options DENY).
 *     'self' means the same site (SAMEORIGIN). A list of origins means those parents only: X-Frame-Options is
 *     then left out, because it cannot name an outside origin, and frame-ancestors carries the rule.
 *   isApi: true picks the strict API policy.
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders(opts = {}) {
  const { csp, frameAncestors = null, isApi = false, permissions = PERMISSIONS } = opts;
  let ancestors = "'none'";
  /** @type {string | null} */
  let xfo = 'DENY';
  if (frameAncestors === 'self') { ancestors = "'self'"; xfo = 'SAMEORIGIN'; }
  else if (Array.isArray(frameAncestors) && frameAncestors.length) { ancestors = ["'self'", ...frameAncestors].join(' '); xfo = null; }

  let policy = csp || (isApi ? API_CSP : APP_CSP);
  policy = /(^|;)\s*frame-ancestors\b/i.test(policy)
    ? policy.replace(/frame-ancestors[^;]*/i, 'frame-ancestors ' + ancestors)
    : policy + '; frame-ancestors ' + ancestors;

  const list = [
    { key: 'Content-Security-Policy', value: policy },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Permissions-Policy', value: permissions },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
  if (xfo) list.push({ key: 'X-Frame-Options', value: xfo });
  return list;
}

/**
 * Sets every header in the list on a Response (or a Headers object) and returns it.
 * @template {Response | Headers} T
 * @param {T} target
 * @param {{ key: string, value: string }[]} [list]
 * @returns {T}
 */
export function applyHeaders(target, list = securityHeaders()) {
  const h = target instanceof Headers ? target : target.headers;
  for (const { key, value } of list) h.set(key, value);
  h.delete('X-Powered-By');
  return target;
}
