import { staffHubs, staffToken } from '../../../../../lib/staff.js';
import { handle } from '../../../../../lib/kit/handle.js';
import { old } from '../../../../../lib/kit-wire.js';

export const dynamic = 'force-dynamic';

async function GET_(req, { params }) {
  const { action } = await params;
  if (action === 'hubs') return staffHubs(req);
  return new Response(null, { status: 404 });
}

async function POST_(req, { params }) {
  const { action } = await params;
  if (action === 'token') return staffToken(req);
  return new Response(null, { status: 404 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const GET = handle(old(GET_));
export const POST = handle(old(POST_));
