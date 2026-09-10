/* A session is a signed token: slug, seat label, expiry. Signed with HUB_SECRET on the
   server, checked on every request, never stored. Ten days, then the door again. */
import { createHmac, timingSafeEqual } from 'node:crypto';
const SECRET = process.env.HUB_SECRET || (process.env.DATA_MODE === 'supabase' ? null : 'dev-only-secret');
const b64 = s => Buffer.from(s).toString('base64url');
const sign = body => createHmac('sha256', SECRET).update(body).digest('base64url');

export function issue(slug, seat){
  if (!SECRET) throw new Error('HUB_SECRET is not set');
  const body = b64(JSON.stringify({ slug, seat, exp: Date.now() + 10 * 86400000 }));
  return body + '.' + sign(body);
}
export function verify(token){
  if (!SECRET || !token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)); const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
export function session(req, slug){
  const h = req.headers.get('authorization') || '';
  const p = verify(h.replace(/^Bearer\s+/i, ''));
  return p && p.slug === slug ? p : null;
}
export function isAdmin(req){
  const k = process.env.BB_ADMIN_SECRET; const got = req.headers.get('x-bb-admin') || '';
  return !!k && got.length === k.length && timingSafeEqual(Buffer.from(got), Buffer.from(k));
}
export const deny = (msg = 'Sign in first', status = 401) => Response.json({ error: msg }, { status });
