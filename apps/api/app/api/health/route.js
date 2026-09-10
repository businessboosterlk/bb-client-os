import { mode } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
export async function GET(){ return Response.json({ ok: true, service: 'the-hub-api', data: mode, secret: !!process.env.HUB_SECRET, at: new Date().toISOString() }); }
