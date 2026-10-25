/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { rawPut, rawGet } from '../../../../../../../lib/files.js';
export const dynamic = 'force-dynamic';
export async function PUT(req, { params }){ const { slug, id } = await params; return rawPut(req, slug, id); }
export async function GET(req, { params }){ const { slug, id } = await params; return rawGet(req, slug, id); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
