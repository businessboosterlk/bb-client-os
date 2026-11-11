/* WHO MAY CALL FROM A BROWSER. The allowed addresses are a LIST (HUB_ORIGINS, separated by commas)
   and every one of them is allowed. Until 29 Sep 2026 a fixed header named only the first, so a
   second address such as a client's own domain would have been refused, and the first was named
   to every caller whoever asked. Now the caller's own address is named back only when it is on the
   list, exactly as written there, and the answer says it depends on who asked. */
import { NextResponse } from 'next/server';
import { shield } from './lib/kit/shield.js';
import { RULES, LIMITS, RAW_PATH } from './lib/kit-wire.js';

const LIST = (process.env.HUB_ORIGINS || 'http://localhost:8761,https://businessboosterlk.github.io')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS', HEADERS = 'Content-Type, Authorization, X-BB-Admin';

/* THE FRONT DOOR (kit, 11 Nov 2026). Before any route: a rate limit per caller address (429) and a size cap read
   from Content-Length (413). OPTIONS is never counted. A refusal carries the same CORS headers as any other answer,
   or the browser hides the 429 behind a CORS error. Limits are in lib/kit-wire.js. */
export function middleware(req){
  const origin = req.headers.get('origin') || '';
  const allowed = LIST.includes(origin);
  const refused = req.method === 'OPTIONS' ? null : shield(req, { rules: RULES, jsonMb: LIMITS.jsonMb, uploadMb: LIMITS.rawMb, uploadMatch: RAW_PATH });
  const res = refused || (req.method === 'OPTIONS' ? new NextResponse(null, { status: 204 }) : NextResponse.next());
  res.headers.append('Vary', 'Origin');
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Methods', METHODS);
    res.headers.set('Access-Control-Allow-Headers', HEADERS);
    res.headers.set('Access-Control-Max-Age', '600');
    res.headers.set('Access-Control-Expose-Headers', 'Retry-After');
  }
  return res;
}
export const config = { matcher: '/api/:path*' };
