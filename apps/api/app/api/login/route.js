import { findClient, verifySeat, norm } from '../../../lib/clients.js';
import { issue } from '../../../lib/auth.js';
import { store } from '../../../lib/store.js';
import { withLibrary } from '../../../lib/library.js';
import { caller, lockedFor, wrong, right, words } from '../../../lib/lock.js';
export const dynamic = 'force-dynamic';
/* the door: business name plus code. Same answer for a wrong name and a wrong code,
   and a small delay, so nobody can tell the two apart by trying. After repeated wrong
   codes the door locks for that caller and that business (lib/lock.js). */
export async function POST(req){
  const body = await req.json().catch(() => ({}));
  const who = caller(req);
  const client = await findClient(body.business);
  /* the lock is on the BUSINESS, however its name was typed: the slug when there is one */
  const name = client ? client.slug : ('?' + norm(body.business).slice(0, 80));
  const left = lockedFor(name, who);
  if (left > 0) return Response.json({ error: words(left) }, { status: 429, headers: { 'Retry-After': String(left) } });
  const seat = client ? verifySeat(client, body.code) : null;
  if (!client || !seat) {
    wrong(name, who);
    await new Promise(r => setTimeout(r, 600));
    return Response.json({ error: 'That business name and code do not match.' }, { status: 401 });
  }
  right(name, who);
  await store.audit(client.slug, seat.label, 'login');
  return Response.json({ token: issue(client.slug, seat.label), slug: client.slug, seat: seat.label, cast: await withLibrary(client.config) });
}
