import { store, validTable } from '../../../../../lib/store.js';
export const dynamic = 'force-dynamic';

async function gate(params){
  const { slug, table, id } = await params;
  if(!validTable(table)) return { err: Response.json({ error: 'Unknown table' }, { status: 404 }) };
  return { slug, table, id };
}
export async function GET(_req, { params }){
  const g = await gate(params); if(g.err) return g.err;
  const row = await store.get(g.slug, g.table, g.id);
  return row ? Response.json(row) : Response.json({ error: 'Not found' }, { status: 404 });
}
export async function PATCH(req, { params }){
  const g = await gate(params); if(g.err) return g.err;
  const body = await req.json().catch(() => null);
  if(!body || typeof body !== 'object') return Response.json({ error: 'Body must be an object' }, { status: 400 });
  const row = await store.update(g.slug, g.table, g.id, body);
  return row ? Response.json(row) : Response.json({ error: 'Not found' }, { status: 404 });
}
export async function DELETE(_req, { params }){
  const g = await gate(params); if(g.err) return g.err;
  await store.remove(g.slug, g.table, g.id);
  return new Response(null, { status: 204 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
