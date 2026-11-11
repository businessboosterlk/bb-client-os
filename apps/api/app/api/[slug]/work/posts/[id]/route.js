/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { actOnPost } from '../../../../../../lib/work-api.js';
import { handle } from '../../../../../../lib/kit/handle.js';
import { old } from '../../../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function POST_(req, { params }){ const { slug, id } = await params; return actOnPost(req, slug, id); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const POST = handle(old(POST_));
