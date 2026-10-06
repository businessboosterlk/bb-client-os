/* BB reads a client's visit events. X-BB-Admin header, one client at a time, paged like every
   other list read. The seat's token can never reach this: a client never sees its own telemetry. */
import { isAdmin, deny } from '../../../../lib/auth.js';
import { store, paging } from '../../../../lib/store.js';
export const dynamic = 'force-dynamic';
export async function GET(req){
  if (!isAdmin(req)) return deny('BB admin only', 403);
  const slug = new URL(req.url).searchParams.get('slug') || '';
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return Response.json({ error: 'slug is required' }, { status: 400 });
  return Response.json(await store.list(slug, 'events', paging(req.url)));
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
