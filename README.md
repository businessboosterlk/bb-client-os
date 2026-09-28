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

## The gate

```bash
bash scripts/gate.sh             # every check the Hub has, cheapest first, each with its count
bash scripts/deploy-pages.sh     # stamp, gate, publish the tested files, read the live files back
```

| Check | Script | What it proves |
|---|---|---|
| Build stamp | `scripts/stamp.mjs --check` | one stamp in the app and in `version.json` |
| Icons | `scripts/build-icons.mjs --check`, `scripts/icon-centre.mjs --check` | every icon comes from Lucide or Simple Icons and sits on the centre of its frame |
| Self test | `scripts/selftest-run.mjs` | the app's own `?selftest`, walked under the folder it is published in |
| Pixel precision | `scripts/ui-precision.mjs` | every centred glyph, measured by its ink with the real font |
| Accessibility | `scripts/a11y.mjs` | names, labels, focus, dialogues, targets, contrast |
| Every screen | `scripts/ui-walk.mjs`, then `scripts/contact-sheet.mjs` | the gap between every pair of controls, and photographs to LOOK at |
| Click path | `scripts/click-path.mjs` | every action counted from the source and pressed, Back once and twice |
| Data laws | `scripts/data-run.mjs` | paging, list windows, the device copy, no connection, drafts, sign out |
| Tenant wall | `scripts/tenant-wall.mjs` | two test clients against the real API in memory mode. Report only |

What no script can prove is proven on the iPhone simulator with the app INSTALLED from the Home
Screen. Photographs go in `evidence/iphone-before` and `evidence/iphone-after`.

## Pixel precision

Every glyph meant to sit in the centre of its shape is measured by its ink, not by its CSS box.

```bash
node scripts/icon-centre.mjs --check     # every icon drawn on the centre of its 24 unit frame
node scripts/build-icons.mjs             # add an icon: name it in the LINE table, never draw it
node scripts/icon-centre.mjs             # rewrite the offsets and the air after adding an icon
node scripts/ui-precision.mjs            # serves the build itself; exits 1 on any miss
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
