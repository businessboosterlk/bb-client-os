/* BB's door for PEOPLE (Stage 2, named seats, bb_pending 693). X-BB-Admin header. One named person per code, on the
   client's side or Business Booster's. A code is returned ONCE, in this response, and only its hash is kept. A lost code
   is rotated; a person who leaves is revoked, which stops their code and nobody else's.
     POST  {slug, side, name, role}        add a person, answer with their code
     PATCH {slug, id, rotate: true}        a new code for that person
     PATCH {slug, id, revoke: true}        stop that person's code
     GET   ?slug=<slug>                    the people, never a code or a hash */
import { isAdmin, deny } from '../../../../lib/auth.js';
import { mode, supa } from '../../../../lib/store.js';
import { hashCode, newCode, norm } from '../../../../lib/clients.js';
import { handle } from '../../../../lib/kit/handle.js';
import { old } from '../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
const SIDES = new Set(['client', 'bb']);
const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
async function prefixFor(s, slug, side){
  if (side === 'bb') return 'BB';
  const { data } = await s.from('os_clients').select('name,config').eq('slug', slug).maybeSingle();
  return ((data?.config?.short || data?.name || 'HUB').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()) || 'HUB';
}
async function POST_(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json({ error: 'People need supabase mode' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const slug = norm(b.slug), side = SIDES.has(b.side) ? b.side : '', name = clean(b.name, 60), role = clean(b.role, 60);
  if (!/^[a-z0-9-]{2,40}$/.test(slug) || !side || !name) return Response.json({ error: 'slug, side (client or bb) and name are required' }, { status: 400 });
  const s = await supa();
  const code = newCode(await prefixFor(s, slug, side)), h = hashCode(code);
  const { data, error } = await s.from('os_people').insert({ client: slug, side, name, role, code_salt: h.salt, code_hash: h.hash }).select('id,name,role,side').single();
  if (error) return Response.json({ error: /os_people_one_name/.test(error.message) ? 'That name is already on this Hub' : error.message }, { status: 400 });
  return Response.json({ ...data, code }, { status: 201 });
}
async function PATCH_(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json({ error: 'People need supabase mode' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const slug = norm(b.slug); if (!/^[a-z0-9-]{2,40}$/.test(slug) || !/^[0-9a-f-]{36}$/.test(String(b.id || ''))) return Response.json({ error: 'slug and id are required' }, { status: 400 });
  const s = await supa();
  const { data: p } = await s.from('os_people').select('id,side,revoked_at').eq('client', slug).eq('id', b.id).maybeSingle();
  if (!p) return Response.json({ error: 'Not found' }, { status: 404 });
  if (b.revoke === true) {
    const { error } = await s.from('os_people').update({ revoked_at: new Date().toISOString() }).eq('client', slug).eq('id', b.id);
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ id: b.id, revoked: true });
  }
  if (b.rotate === true && !p.revoked_at) {
    const code = newCode(await prefixFor(s, slug, p.side)), h = hashCode(code);
    const { error } = await s.from('os_people').update({ code_salt: h.salt, code_hash: h.hash }).eq('client', slug).eq('id', b.id);
    return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ id: b.id, code });
  }
  return Response.json({ error: 'Say rotate or revoke' }, { status: 400 });
}
async function GET_(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json([]);
  const slug = norm(new URL(req.url).searchParams.get('slug'));
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return Response.json({ error: 'slug is required' }, { status: 400 });
  const { data, error } = await (await supa()).from('os_people').select('id,name,role,side,revoked_at,last_in_at,created_at').eq('client', slug).order('created_at', { ascending: true }).limit(200);
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json(data);
}

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const POST = handle(old(POST_));
export const PATCH = handle(old(PATCH_));
export const GET = handle(old(GET_));
