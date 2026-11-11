/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { postPost } from '../../../../../lib/work-api.js';
import { handle } from '../../../../../lib/kit/handle.js';
import { old } from '../../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function POST_(req, { params }){ const { slug } = await params; return postPost(req, slug); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
const NEW_POST = { platform: { type: 'string', max: 40 }, kind: { type: 'string', max: 40 }, slot: { type: 'string', max: 60 }, decideBy: { type: 'string', max: 60 }, caption: { type: 'string', max: 3000 }, head: { type: 'string' }, line: { type: 'string' }, tone: { type: 'string', max: 20 }, art: { type: 'string', max: 100 } };
export const POST = handle(old(POST_), { schema: NEW_POST });
