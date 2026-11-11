import { mode } from '../../../lib/store.js';
import { handle } from '../../../lib/kit/handle.js';
import { old } from '../../../lib/kit-wire.js';
export const dynamic = 'force-dynamic';
async function GET_(){ return Response.json({ ok: true, service: 'the-hub-api', data: mode, secret: !!(process.env.HUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY), at: new Date().toISOString() }); }

/* every method through the kit: size cap, safe JSON, 500 with a ref (lib/kit-wire.js) */
export const GET = handle(old(GET_));
