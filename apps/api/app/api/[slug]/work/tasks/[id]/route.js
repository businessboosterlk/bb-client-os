/* The workspace (Stage 2). Every rule lives in lib/work-api.js; this file only routes. */
import { patchTask, deleteTask } from '../../../../../../lib/work-api.js';
export const dynamic = 'force-dynamic';
export async function PATCH(req, { params }){ const { slug, id } = await params; return patchTask(req, slug, id); }
export async function DELETE(req, { params }){ const { slug, id } = await params; return deleteTask(req, slug, id); }
export async function OPTIONS(){ return new Response(null, { status: 204 }); }
