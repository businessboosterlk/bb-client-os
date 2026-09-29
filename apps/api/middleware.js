/* WHO MAY CALL FROM A BROWSER. The allowed addresses are a LIST (HUB_ORIGINS, separated by commas)
   and every one of them is allowed. Until 29 Sep 2026 a fixed header named only the first, so a
   second address such as a client's own domain would have been refused, and the first was named
   to every caller whoever asked. Now the caller's own address is named back only when it is on the
   list, exactly as written there, and the answer says it depends on who asked. */
import { NextResponse } from 'next/server';

const LIST = (process.env.HUB_ORIGINS || 'http://localhost:8761,https://businessboosterlk.github.io')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const METHODS = 'GET,POST,PATCH,DELETE,OPTIONS', HEADERS = 'Content-Type, Authorization, X-BB-Admin';

export function middleware(req){
  const origin = req.headers.get('origin') || '';
  const allowed = LIST.includes(origin);
  const res = req.method === 'OPTIONS' ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  res.headers.append('Vary', 'Origin');
  if (allowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Methods', METHODS);
    res.headers.set('Access-Control-Allow-Headers', HEADERS);
    res.headers.set('Access-Control-Max-Age', '600');
  }
  return res;
}
export const config = { matcher: '/api/:path*' };
