/* WHO OPENED WHAT. A signed-in seat tells the Hub that the app was opened (and from where), that a
   library screen was viewed or that a file was tapped. One row each, kept as the kind `events` in
   the client's own records, append only: a seat can add one and never read, change or remove them.
   BB reads them through /api/bb/events and scripts/visits.mjs. This is how the library answers the
   December question, do clients come back without being asked. */
import { store } from '../../../../lib/store.js';
import { session, deny } from '../../../../lib/auth.js';
export const dynamic = 'force-dynamic';
const WHAT = new Set(['open', 'view', 'tap']), SRC = new Set(['wa', 'app', 'bb', 'direct']);
const text = (v, n) => String(v ?? '').slice(0, n);
export async function POST(req, { params }){
  const { slug } = await params;
  const s = session(req, slug); if (!s) return deny();
  const b = await req.json().catch(() => null);
  if (!b || !WHAT.has(b.what)) return Response.json({ error: 'what must be open, view or tap' }, { status: 400 });
  const href = text(b.href, 400); if (href && !/^https:\/\//.test(href)) return Response.json({ error: 'href must be https' }, { status: 400 });
  const row = await store.create(slug, 'events', { what: b.what, detail: text(b.detail, 160), href, src: SRC.has(b.src) ? b.src : 'direct', by: s.seat });
  return Response.json({ ok: true, id: row.id }, { status: 201 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
