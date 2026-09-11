import { findClient, verifySeat } from '../../../lib/clients.js';
import { issue } from '../../../lib/auth.js';
import { store } from '../../../lib/store.js';
import { withLibrary } from '../../../lib/library.js';
export const dynamic = 'force-dynamic';
/* the door: business name plus code. Same answer for a wrong name and a wrong code,
   and a small delay, so nobody can tell the two apart by trying. */
export async function POST(req){
  const body = await req.json().catch(() => ({}));
  const client = await findClient(body.business);
  const seat = client ? verifySeat(client, body.code) : null;
  if (!client || !seat) { await new Promise(r => setTimeout(r, 600)); return Response.json({ error: 'That business name and code do not match.' }, { status: 401 }); }
  await store.audit(client.slug, seat.label, 'login');
  return Response.json({ token: issue(client.slug, seat.label), slug: client.slug, seat: seat.label, cast: await withLibrary(client.config) });
}
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
