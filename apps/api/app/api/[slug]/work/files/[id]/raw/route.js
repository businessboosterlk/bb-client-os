/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { rawPut, rawGet } from '../../../../../../../lib/files.js';
import { handle } from '../../../../../../../lib/kit/handle.js';
import { old, RAW_BYTES } from '../../../../../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function PUT_(req, { params }){ const { slug, id } = await params; return rawPut(req, slug, id); }
async function GET_(req, { params }){ const { slug, id } = await params; return rawGet(req, slug, id); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const PUT = handle(old(PUT_, { raw: true }), { raw: true, maxBytes: RAW_BYTES });
export const GET = handle(old(GET_));
