# BB API kit

Security from day one for a Next.js API, with no npm packages. Six files, each one job:
`headers` (security headers), `shield` (rate limit and size cap), `handle` (safe route wrapper),
`validate` (input schema), `audit` (who changed what) and `upload` (file type by its bytes).

## Wire it in: three places

next.config.mjs

    import { securityHeaders } from './lib/kit/headers.js';
    const nextConfig = { poweredByHeader: false, async headers() { return [
      { source: '/:path*', headers: securityHeaders() },
      { source: '/api/:path*', headers: securityHeaders({ isApi: true }) }]; } };

middleware.js

    import { NextResponse } from 'next/server';
    import { shield } from './lib/kit/shield.js';
    export function middleware(request) { return shield(request) ?? NextResponse.next(); }

## A route with the kit

    import { handle, HttpError } from '@/lib/kit/handle.js';
    import { makeAuditWriter } from '@/lib/kit/audit.js';
    export const POST = handle(async ({ body, audit }) => {
      if (!allowed) throw new HttpError(403, 'Not allowed');
      Object.assign(audit, { who: userId, table: 'clients', id, before, after });
      return { saved: true };
    }, { schema: { name: { type: 'string', max: 120, required: true } },
         audit: { action: 'client.update', write: makeAuditWriter(row => db.from('audit_log').insert(row)) } });

Every method is exported as `export const GET = handle(...)`. A throw answers 500 with a ref only; the
detail goes to the server log under the same ref. Bad JSON is a 400, an unknown field is a 400.

The rate limiter counts in memory per server instance. A host that runs several instances needs a shared
store: see the note at the top of shield.js. Tests: `node --test lib/kit/test/`.
