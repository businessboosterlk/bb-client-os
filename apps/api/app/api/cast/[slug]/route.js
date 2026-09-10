import { loadCast } from '../../../../lib/clients.js';
export const dynamic = 'force-dynamic';
export async function GET(_req, { params }){
  const { slug } = await params;
  const cast = await loadCast(slug);
  return cast ? Response.json(cast) : Response.json({ error: 'No client configured for ' + slug }, { status: 404 });
}
