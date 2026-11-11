/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { postSeen } from '../../../../../lib/work-api.js';
import { handle } from '../../../../../lib/kit/handle.js';
import { old } from '../../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function POST_(req, { params }){ const { slug } = await params; return postSeen(req, slug); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
const SEEN_IDS = { ids: { type: 'array', maxItems: 200, of: { type: 'string', max: 100 } } };
export const POST = handle(old(POST_), { schema: SEEN_IDS });
