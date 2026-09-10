import { store, validKind } from '../../../../../lib/store.js';
import { session, deny } from '../../../../../lib/auth.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table, id } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, id, seat: s.seat };
}
export async function GET(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; const row = await store.get(g.slug, g.table, g.id); return row ? Response.json(row) : Response.json({ error: 'Not found' }, { status: 404 }); }
export async function PATCH(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const row = await store.update(g.slug, g.table, g.id, { ...body, by: g.seat });
  if (row) await store.audit(g.slug, g.seat, 'update', g.table, g.id);
  return row ? Response.json(row) : Response.json({ error: 'Not found' }, { status: 404 });
}
export async function DELETE(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; await store.remove(g.slug, g.table, g.id); await store.audit(g.slug, g.seat, 'delete', g.table, g.id); return new Response(null, { status: 204 }); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
