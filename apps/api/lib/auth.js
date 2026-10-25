/* A session is a signed token: slug, the PERSON (id, name, role, side), expiry. Signed with HUB_SECRET on the
   server, checked on every request, never stored. Ten days, then the door again. `seat` stays the person's name so
   every older route that stamps `by: s.seat` now stamps a real name (Stage 2, named seats, bb_pending 693). */
import { createHmac, timingSafeEqual } from 'node:crypto';
/* ONE KEY TO PASTE (Thulaib, 25 Oct 2026: "why can't you go and do this yourself?"). When HUB_SECRET is not set, the session
   secret is made from the database's secret key, so the host needs only that one key. Rotating the database key therefore signs
   everyone out once, which is the safe direction. HUB_SECRET, when set, still wins. */
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const SECRET = process.env.HUB_SECRET || (SVC ? createHmac('sha256', SVC).update('the-hub-session-v1').digest('base64url') : (process.env.DATA_MODE === 'supabase' ? null : 'dev-only-secret'));
const b64 = s => Buffer.from(s).toString('base64url');
const sign = body => createHmac('sha256', SECRET).update(body).digest('base64url');

export function issue(slug, who){
  if (!SECRET) throw new Error('No session secret: set SUPABASE_SERVICE_ROLE_KEY (or HUB_SECRET)');
  const p = typeof who === 'string' ? { seat: who, name: who, role: '', side: 'client', pid: null } : { seat: who.name, name: who.name, role: who.role || '', side: who.side === 'bb' ? 'bb' : 'client', pid: who.id || null };
  const body = b64(JSON.stringify({ slug, ...p, exp: Date.now() + 10 * 86400000 }));
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
/* the person a session names, in the one shape every workspace write is stamped with */
export const who = s => ({ pid: s.pid || null, name: s.name || s.seat, role: s.role || '', side: s.side === 'bb' ? 'bb' : 'client' });
/* the live channel's topic: never the slug itself, so a name typed at the door is not the way to listen */
export const topicFor = slug => SECRET ? 'hub-' + createHmac('sha256', SECRET).update('live:' + slug).digest('hex').slice(0, 24) : '';
export const deny = (msg = 'Sign in first', status = 401) => Response.json({ error: msg }, { status });
