import { mode } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
export async function GET(){ return Response.json({ ok: true, service: 'the-hub-api', data: mode, secret: !!(process.env.HUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY), at: new Date().toISOString() }); }
