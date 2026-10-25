/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { postPost } from '../../../../../lib/work-api.js';
export const dynamic = 'force-dynamic';
export async function POST(req, { params }){ const { slug } = await params; return postPost(req, slug); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
