/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { getFileLink } from '../../../../../../lib/work-api.js';
export const dynamic = 'force-dynamic';
export async function GET(req, { params }){ const { slug, id } = await params; return getFileLink(req, slug, id); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
