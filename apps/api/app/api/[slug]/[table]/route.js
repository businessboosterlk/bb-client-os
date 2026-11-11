import { store, validKind, paging } from '../../../../lib/store.js';
import { session, deny } from '../../../../lib/auth.js';
import { handle } from '../../../../lib/kit/handle.js';
import { old } from '../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function gate(req, params){
  const { slug, table } = await params;
  if (!validKind(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  const s = session(req, slug); if (!s) return { err: deny() };
  return { slug, table, seat: s.seat };
}
async function GET_(req, { params }){ const g = await gate(req, params); if (g.err) return g.err; return Response.json(await store.list(g.slug, g.table, paging(req.url))); }
async function POST_(req, { params }){
  const g = await gate(req, params); if (g.err) return g.err;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const row = await store.create(g.slug, g.table, { ...body, by: g.seat });
  await store.audit(g.slug, g.seat, 'create', g.table, row.id);
  return Response.json(row, { status: 201 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const GET = handle(old(GET_));
export const POST = handle(old(POST_));
