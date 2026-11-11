# DECISIONS: BB Client OS (the Hub)

Each choice, what was rejected and why. Newest first. Started 11 Nov 2026 with the API safety kit on branch
`hub-api-kit-2026-11-11` (local only, not pushed, not merged, not deployed).

## 11 Nov 2026: the BB API safety kit goes into apps/api

The design was decided in BB SYSTEMS HUB HANDOVER 1 and built as written.

### 1. The kit files are copied in, never edited
- Chosen: `node ~/bb-systems/qa/foundation/install.mjs <repo> --api apps/api` wrote the six kit files and their tests under `apps/api/lib/kit/`. They are committed as the installer wrote them.
- Rejected: editing the kit to suit the Hub. A Hub-only change would drift from every other BB API and from the kit's own tests.
- Not committed on this branch: the installer also wrote `.github/workflows/foundation.yml`, `HANDOVER.md`, `apps/api/eslint.config.mjs`, `apps/api/jsconfig.json` and `apps/api/tsconfig.check.json`. The repo is public and has no workflows today; adding CI, lint and type checks is a separate decision for the developers, so they are left untracked.

### 2. One bridge file, `apps/api/lib/kit-wire.js`, with `old(fn)`
- Chosen: `handle()` reads the body itself, so a route that calls `req.json()` afterwards would fail. `old(fn)` builds a fresh Request with the same address, method and headers and the body `handle()` already read (JSON re-serialised, bytes untouched when `raw`), then calls the existing `(req, context)` function. Each route file changes one line per method: `export const POST = handle(old(POST_), { schema })`.
- Rejected: rewriting 31 methods and the lib functions they forward to (`work-api.js`, `files.js`, `staff.js`) to take `{ body }`. That would touch every rule and every error sentence the gate tests read, for no gain in safety.
- Cost: the body is parsed twice (once by `handle`, once by the route). Bodies are capped at 1 MB, so this is small.

### 3. Schemas only where the body is flat and every field is known from both sides
Each field was read from the server code and from what `apps/web/src/app/core` sends. No field is `required` in a schema, so a missing field still gets the route's own words; the schema refuses unknown fields and wrong types.
- Schema: `POST /api/login` (business, code), `POST /api/<slug>/seen` (what, detail, href, src), `POST /api/<slug>/work/seen` (ids), `POST /api/<slug>/work/files` (kind, mime, bytes, secs), `POST /api/<slug>/work/tasks` (fromMsg, title, for, due, who, files), `POST /api/<slug>/work/posts` (platform, kind, slot, decideBy, caption, head, line, tone, art).
- No schema, size cap and safe JSON only: the five sales tables `[slug]/[table]` POST and `[id]` PATCH (free-form rows), `bb/clients` POST (the cast is nested), `work/msgs` POST (voice and ref are nested), `work/tasks/[id]` PATCH and `work/posts/[id]` POST (accept, late, voice and version are nested), `bb/people` POST and PATCH (called by BB scripts, not by apps/web, so the second side is not in this repo), `bb/staff/token`, the raw file PUT (bytes).
- Rejected: schemas on every route. `validate.js` has no nested object type and refuses unknown keys, so a schema on a free-form or nested body would refuse real saves.
- Limits held loose on purpose: caption max 3,000 in the schema so the route's own "2,200 characters at most" still answers; no string max below what the route itself slices.

### 4. The front door: shield in `middleware.js`
- Chosen: `shield()` runs first for every non-OPTIONS call under /api. OPTIONS still answers 204 and is never counted. A refusal (429, 413, 411) gets the same CORS headers as any answer, or the browser hides the 429 behind a CORS error. `Retry-After` is exposed to the browser.
- Limits, per caller address, one minute windows, tunable without a code change:

| Rule | Default | Env |
|---|---|---|
| /api/login | 30 a minute | HUB_LIMIT_LOGIN |
| every other /api path | 1,200 a minute | HUB_LIMIT_API |
| JSON body | 1 MB (decimal) | fixed, kit default |
| raw file PUT `/api/<slug>/work/files/<id>/raw` | 6 MB (decimal) | HUB_RAW_MB |

- Why generous: a whole office behind one address signing in on a Monday; 20 calls a second from one address. The code guess lock is still `lib/lock.js` (8 wrong codes per business and caller, 15 minutes); the shield is a second layer against floods.
- Known limit: the count is in memory, per server instance. Railway runs one instance, so it is real there; Vercel or more than one instance would multiply it. The caller address is the first hop of `x-forwarded-for`, which a caller can set; behind Railway's proxy a flood that rotates that header is counted per invented address. The lock in `lib/lock.js` reads the same header. Fixing that needs the proxy's trusted hop count and is not part of this change.

### 5. Security headers in `next.config.mjs`
- Chosen: two policies from `securityHeaders()`. Every answer gets the app policy; `/api/:path*` comes after it and gets the strict API policy (Next uses the last matching rule for a header). The rewrite of `/` to `/index.html` and the two old header rules (noindex, no-cache) are kept.
- The app policy lets the Angular build run and nothing more: own scripts, styles and fonts; inline styles (the shell `<style>` and component styles); `connect-src` the Supabase live channel (`wss://*.supabase.co`) and `https://*.supabase.co`; `img-src` and `media-src` add `data:`, `blob:` and the Supabase storage host for signed file links and voice notes.
- The build has one inline script (the theme, set before first paint) and Angular's `onload="this.media='all'"` that switches the stylesheet on. Both are allowed by sha256 hash, read from the built `index.html` when the config loads (`public/` on Railway, else the local build), with `'unsafe-hashes'` limited to that one handler hash.
- Rejected: `'unsafe-eval'` (never), `'unsafe-inline'` for scripts (would allow any injected script), turning off Angular's critical CSS inlining (a change to apps/web outside this job), a fixed hash typed into the config (breaks on the next rebuild of index.html).
- Permissions-Policy on the page allows the microphone for this site only, because voice notes record with it (`apps/web/src/app/core/media.ts`). Camera, location, payment and USB stay off.
- `poweredByHeader: false` so no answer names the framework.

### 6. Behaviour that changes for a caller
- 429 "Too many requests, please wait and try again" past a limit, with Retry-After.
- 413 "Too large" past a size.
- Bad JSON answers 400 "Invalid JSON" before the route's own words.
- An unknown field or a wrong type on a schema route answers 400 "Invalid input" with field names only.
- An unexpected throw answers 500 `{ error: 'Something went wrong', ref }`; the full error is logged under the same ref.
- Not caught by the kit: `bb/clients` and `bb/people` still return Supabase `error.message` in purpose-built answers (status 400 or 500). `handle()` only hides throws. Flagged for the developers.
