import { mode } from '../../../lib/store.js';
export const dynamic = 'force-dynamic';
export async function GET(){
  return Response.json({ ok: true, service: 'bb-client-os-api', data: mode, at: new Date().toISOString() });
}
