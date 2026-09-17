# BB Client OS

One app per client, two doors: **the Library** (what Business Booster produced for them)
and **the Sales system** (enquiries, pipeline, customers, the thing they run the business on).
Built on the BB stack standard: Node and Next.js on the server, Angular on the front.

```
casts/<slug>.json       the demo cast (local, PIN protected), the only cast the static site serves
casts/private/          server clients' casts, gitignored: onboarding input only, stored in the database
apps/web                Angular 19 app: login, launcher, Library screens, Sales screens
apps/api                Next.js API: /api/login, /api/<slug>/cast (signed in), /api/<slug>/<table> CRUD, memory or Supabase store
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

## Pixel precision

Every glyph meant to sit in the centre of its shape is measured by its ink, not by its CSS box.

```bash
node scripts/icon-centre.mjs --check     # every icon drawn on the centre of its 24 unit frame
node scripts/icon-centre.mjs             # rewrite the OFFSETS table after adding or editing an icon
node scripts/ui-precision.mjs http://localhost:8772/   # serve a build first; exits 1 on any miss
```

The runner reads the rail badges, the avatar, the board count pills, the Board and List switch,
the buttons that lead with an icon, the topbar icons and the phone tab bar, in dark and light, at
390px 3x and 1440px 2x. Shapes and icons within 0.5px, text within 0.5px plus one device pixel.
The measuring lives in `~/bb-systems/qa/optical.mjs`, one copy for every BB system.

Two rules the readings forced:

- A button that leads with an icon wraps its label in a `<span>`. CSS cannot see a bare text node,
  so without the span the icon counts as the only child and the optical pull never applies.
- The topbar hairline is an inset shadow, not a border. A border left 55px inside the 56px bar and
  every topbar icon snapped half a pixel low.

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
