import { store, validTable } from '../../../../lib/store.js';
import { loadCast } from '../../../../lib/casts.js';
export const dynamic = 'force-dynamic';

async function gate(params){
  const { slug, table } = await params;
  if(!validTable(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  if(!(await loadCast(slug))) return { err: Response.json({ error: 'No client configured for ' + slug }, { status: 404 }) };
  return { slug, table };
}
export async function GET(_req, { params }){
  const g = await gate(params); if(g.err) return g.err;
  return Response.json(await store.list(g.slug, g.table));
}
export async function POST(req, { params }){
  const g = await gate(params); if(g.err) return g.err;
  const body = await req.json().catch(() => null);
  if(!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  return Response.json(await store.create(g.slug, g.table, body), { status: 201 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
