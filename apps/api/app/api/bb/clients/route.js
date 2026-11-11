/* BB's own door for onboarding. X-BB-Admin header. Creates or updates a client with its config.
   SINCE STAGE 2 (24 Oct 2026) IT MINTS NO CODES: the door reads people from os_people, one named person per code, added
   through /api/bb/people. The old two seat codes would never have opened the door, so none are minted. */
import { isAdmin, deny } from '../../../../lib/auth.js';
import { mode, supa } from '../../../../lib/store.js';
import { hashCode, newCode, norm } from '../../../../lib/clients.js';
import { handle } from '../../../../lib/kit/handle.js';
import { old } from '../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function POST_(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json({ error: 'Onboarding needs supabase mode' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const slug = norm(b.slug); if (!/^[a-z0-9-]{2,40}$/.test(slug) || !b.name || !b.cast) return Response.json({ error: 'slug, name and cast are required' }, { status: 400 });
  const s = await supa();
  const { data: existing } = await s.from('os_clients').select('seats,config').eq('slug', slug).maybeSingle();
  /* re-running onboarding to update a client's settings must NEVER lock their team out:
     codes are kept unless rotate is asked for, or the client is new */
  const seats = existing?.seats || [];
  /* a WhatsApp group invite is a key: it lives only here, never in the public repo */
  const bb = { ...(b.cast.bb || {}) };
  if (b.group) {
    if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}$/.test(b.group)) return Response.json({ error: 'group must be a chat.whatsapp.com invite link' }, { status: 400 });
    bb.group = b.group;
  } else if (existing?.config?.bb?.group) bb.group = existing.config.bb.group;
  const aliases = [...new Set([slug, ...(b.aliases || []).map(norm)].filter(Boolean))];
  const { error } = await s.from('os_clients').upsert({ slug, name: b.name, aliases, config: { ...b.cast, slug, name: b.name, bb }, seats, active: true, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ slug, aliases, people: 'add them with POST /api/bb/people', group: !!bb.group });
}
async function GET_(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json([]);
  const db = await supa(), data = [];
  for (let off = 0; off < 100000; off += 1000) {
    const { data: page, error } = await db.from('os_clients').select('slug,name,aliases,active,updated_at,seats').order('slug', { ascending: true }).range(off, off + 999);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    data.push(...page);
    if (page.length < 1000) break;
  }
  return Response.json(data.map(c => ({ ...c, seats: (c.seats || []).map(s => ({ label: s.label, issued_at: s.issued_at, revoked: !!s.revoked })) })));
}

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const POST = handle(old(POST_));
export const GET = handle(old(GET_));
