/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { postFile } from '../../../../../lib/work-api.js';
import { handle } from '../../../../../lib/kit/handle.js';
import { old } from '../../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function POST_(req, { params }){ const { slug } = await params; return postFile(req, slug); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
const NEW_FILE = { kind: { type: 'string', max: 20 }, mime: { type: 'string', max: 100 }, bytes: { type: 'number' }, secs: { type: 'number' } };
export const POST = handle(old(POST_), { schema: NEW_FILE });
