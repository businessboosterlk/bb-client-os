import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders, applyHeaders, API_CSP } from '../headers.js';

const get = (list, k) => (list.find(h => h.key.toLowerCase() === k.toLowerCase()) || {}).value;

test('default list carries every header the gate wants', () => {
  const l = securityHeaders();
  assert.equal(get(l, 'X-Content-Type-Options'), 'nosniff');
  assert.equal(get(l, 'Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(get(l, 'Strict-Transport-Security'), 'max-age=63072000; includeSubDomains');
  assert.equal(get(l, 'X-Frame-Options'), 'DENY');
  assert.equal(get(l, 'Cross-Origin-Opener-Policy'), 'same-origin');
  assert.match(get(l, 'Permissions-Policy'), /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  const csp = get(l, 'Content-Security-Policy');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(csp, /script-src[^;]*(\*|https:|http:|data:)/);
});

test('API policy is the strict one', () => {
  assert.match(get(securityHeaders({ isApi: true }), 'Content-Security-Policy'), /^default-src 'none'; frame-ancestors 'none'/);
  assert.match(API_CSP, /default-src 'none'/);
});

test('named parents drop X-Frame-Options in favour of frame-ancestors', () => {
  const l = securityHeaders({ frameAncestors: ['https://client.lk'] });
  assert.equal(get(l, 'X-Frame-Options'), undefined);
  assert.match(get(l, 'Content-Security-Policy'), /frame-ancestors 'self' https:\/\/client\.lk/);
  assert.equal(get(securityHeaders({ frameAncestors: 'self' }), 'X-Frame-Options'), 'SAMEORIGIN');
});

test('a caller policy gets frame-ancestors added', () => {
  assert.match(get(securityHeaders({ csp: "default-src 'self'" }), 'Content-Security-Policy'), /default-src 'self'; frame-ancestors 'none'/);
});

test('applyHeaders sets them on a Response and removes X-Powered-By', () => {
  const r = applyHeaders(new Response('x', { headers: { 'x-powered-by': 'Next.js' } }));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
});
