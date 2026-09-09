import { loadCast } from '../../../../lib/casts.js';
export const dynamic = 'force-dynamic';
export async function GET(_req, { params }){
  const { slug } = await params;
  const cast = await loadCast(slug);
  if(!cast) return Response.json({ error: 'No client configured for ' + slug }, { status: 404 });
  return Response.json(cast);
}
