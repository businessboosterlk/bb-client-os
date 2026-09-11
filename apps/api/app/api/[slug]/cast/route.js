/* The signed-in seat's own settings and library, fresh. The app calls this on every open,
   so new work, a new group link or a renamed stage reach the phone without a new login.
   It needs that client's session: a client's settings are never readable by anyone else. */
import { loadCast } from '../../../../lib/clients.js';
import { withLibrary } from '../../../../lib/library.js';
import { session, deny } from '../../../../lib/auth.js';
export const dynamic = 'force-dynamic';
export async function GET(req, { params }){
  const { slug } = await params;
  if (!session(req, slug)) return deny();
  const cast = await loadCast(slug);
  return cast ? Response.json(await withLibrary(cast)) : Response.json({ error: 'Not found' }, { status: 404 });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
