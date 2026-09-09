# BB Client OS

One app per client, two doors: **the Library** (what Business Booster produced for them)
and **the Sales system** (enquiries, pipeline, customers, the thing they run the business on).
Built on the BB stack standard: Node and Next.js on the server, Angular on the front.

```
casts/<slug>.json       the ONLY thing that differs between clients (brand, words, stages, library metadata)
apps/web                Angular 19 app: login, launcher, Library screens, Sales screens
apps/api                Next.js API: /api/cast/<slug>, /api/<slug>/<table> CRUD, memory or Supabase store
scripts/check-casts.mjs refuses a cast that carries a lead, a customer, a phone list or a key
scripts/sync-casts.mjs  copies casts into the static build
```

## Run it

```bash
npm install
npm run casts
npm run dev:web      # Angular on http://localhost:8761/?c=demo   (PIN 1111 in the demo cast)
npm run dev:api      # Next API on http://localhost:8760/api/health
npm run check        # stack standard + cast guard
```

Add `?selftest` to any page to run the harness in the browser (prints one line per check).

## Data modes

A cast's `data.mode` decides where rows live:

- `local`  this browser only. The demo and the free tier. Nothing reaches a server.
- `api`    the Next API in `apps/api`, with `DATA_MODE=memory` (per process) or
           `DATA_MODE=supabase` (service role key server side, tables in `apps/api/sql/schema.sql`,
           which is NOT applied by code: a schema change needs Thulaib's yes).

## Casting a client

1. Copy `casts/demo.json` to `casts/<slug>.json`, change the brand hex, name, WhatsApp number,
   users, stages and words. Load the library metadata from the client's BB rows.
2. `node scripts/check-casts.mjs` must print ALL GREEN.
3. `npm run build` and deploy `apps/web/dist/web/browser`. The link is `?c=<slug>`.

The master is never edited per client.
