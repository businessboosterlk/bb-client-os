/* BB's own door for onboarding. X-BB-Admin header. Creates or updates a client with its
   config and mints two seat codes. The codes are returned ONCE, in this response, and
   only their hashes are kept. Lose a code, mint a new pair. */
import { isAdmin, deny } from '../../../../lib/auth.js';
import { mode, supa } from '../../../../lib/store.js';
import { hashCode, newCode, norm } from '../../../../lib/clients.js';
export const dynamic = 'force-dynamic';
export async function POST(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json({ error: 'Onboarding needs supabase mode' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const slug = norm(b.slug); if (!/^[a-z0-9-]{2,40}$/.test(slug) || !b.name || !b.cast) return Response.json({ error: 'slug, name and cast are required' }, { status: 400 });
  const s = await supa();
  const { data: existing } = await s.from('os_clients').select('seats,config').eq('slug', slug).maybeSingle();
  /* re-running onboarding to update a client's settings must NEVER lock their team out:
     codes are kept unless rotate is asked for, or the client is new */
  const rotate = !existing || b.rotate === true;
  let codes = [], seats = existing?.seats || [];
  if (rotate) {
    const labels = (b.seats && b.seats.length ? b.seats : ['Owner', 'Team']).slice(0, 2);
    const prefix = (b.cast.short || b.name).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'HUB';
    codes = labels.map(label => ({ label, code: newCode(prefix) }));
    seats = codes.map(c => ({ label: c.label, ...hashCode(c.code), issued_at: new Date().toISOString(), revoked: false }));
  }
  /* a WhatsApp group invite is a key: it lives only here, never in the public repo */
  const bb = { ...(b.cast.bb || {}) };
  if (b.group) {
    if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}$/.test(b.group)) return Response.json({ error: 'group must be a chat.whatsapp.com invite link' }, { status: 400 });
    bb.group = b.group;
  } else if (existing?.config?.bb?.group) bb.group = existing.config.bb.group;
  const aliases = [...new Set([slug, ...(b.aliases || []).map(norm)].filter(Boolean))];
  const { error } = await s.from('os_clients').upsert({ slug, name: b.name, aliases, config: { ...b.cast, slug, name: b.name, bb }, seats, active: true, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ slug, aliases, rotated: rotate, seats: codes, group: !!bb.group });
}
export async function GET(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  if (mode !== 'supabase') return Response.json([]);
  const { data, error } = await (await supa()).from('os_clients').select('slug,name,aliases,active,updated_at,seats');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data.map(c => ({ ...c, seats: (c.seats || []).map(s => ({ label: s.label, issued_at: s.issued_at, revoked: !!s.revoked })) })));
}
