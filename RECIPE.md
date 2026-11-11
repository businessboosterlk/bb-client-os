Reconstructed from the folder on 10 Nov 2026, not written at build time
# RECIPE: BB Client OS (the Hub), source repo
Kind: system
Live: https://the-hub-production-dc56.up.railway.app (deploy-railway.sh); demo https://businessboosterlk.github.io/bb-client-os/ (deploy-pages.sh)
Last verified: 2026-11-10, housekeeping chat (reconstructed, not rebuilt).

Checked by `python3 ~/bb-systems/qa/recipe-check.py <this folder>`. A fresh chat rebuilds from this file
alone. Anything that lives only in a chat is lost: write it here or it did not happen.

## 1. What it is
BB Client OS, shown to clients as the Hub: one app per client with two doors, the Library (what BB produced for them) and the Sales system. Node and Next.js API, Angular 19 front, cast per client from casts/<slug>.json (package.json and README.md). It is the source for three sibling folders: the-hub-api (Vercel server), the-hub-live (Railway bundle) and the-hub-demo (Vercel demo build). What Thulaib approved and when is not recorded in the folder.

## 2. Where the source lives
- This folder is its own git repo (origin git@github.com:businessboosterlk/bb-client-os.git), branch workspace-2026-10-24. apps/api is the Next API, apps/web the Angular app, casts/demo.json the demo cast (casts/private is gitignored), mould/stage2 and mould/workspace the moulds and plans, scripts the gate and deploy tools, apps/api/sql the schema (not applied by code).
- Keys and secrets: held in Railway, Vercel and .env files, never in git.
- Generated, not source: sibling folders ~/bb-systems/the-hub-live and ~/bb-systems/the-hub-demo.

## 3. Rebuild from nothing
```bash
# from a clean machine with ~/.local/node/bin on the PATH
cd ~/bb-systems/bb-client-os
npm install
node scripts/sync-casts.mjs
npm run build
```

## 4. Gates
```bash
cd ~/bb-systems/bb-client-os
bash scripts/gate.sh
```
Every line must show PASS and the gate must exit 0. `--quick` skips the four long browser runs and is not enough to ship. The line counts per check are printed by the gate; fixed totals are not known from the folder.

## 5. Deliver or deploy
```bash
cd ~/bb-systems/bb-client-os
# the sales demo: stamp, gate, publish to gh-pages, read the live files back
bash scripts/deploy-pages.sh
# the live Hub on Railway (service the-hub, built into ~/bb-systems/the-hub-live)
bash scripts/deploy-railway.sh
# the Vercel pair, per its own header (server first, then the app)
bash scripts/deploy-live.sh api
```
The server is never put online without its secrets; deploy-live.sh reads the names of the production variables and stops when one is missing.

## 6. Finishing touches
- The chat holds still under a scrolling thumb: the swipe to reply locks its direction after 10px and the composer moves only for a real keyboard | why: commit 4f4c8c8, the chat moved under a thumb (21 sideways moves before, 0 after) | held by: scripts/gate.sh#scroll-steady
- The two tenants stay walled: two test clients against the real API in memory mode | why: tenant wall is a standing BB rule and the gate runs it | held by: scripts/gate.sh#tenant-wall

## 7. Cast a copy
Copy casts/demo.json to casts/<slug>.json and change the brand hex, name, WhatsApp number, users, stages and words (README.md). `node scripts/check-casts.mjs` must print ALL GREEN. The link is ?c=<slug>. Never edit the master per client; server clients' casts go in casts/private (gitignored).

## 8. Not on disk
- Secrets in Railway, Vercel and .env are not in git. Re-set them by hand; values are not known here.
- The iPhone simulator check with the app installed from the Home Screen is a person's step; photographs go in evidence/.
- The database schema in apps/api/sql is not applied by code: a schema change needs Thulaib's yes.
- Which commit is live: not known.

## 9. Branches waiting on people (added 11 Nov 2026, BB SYSTEMS HUB HANDOVER 1)
- `pkgfix-2026-11-11` (569418c, cut from workspace-2026-10-24) is ON GITHUB for Kishini to test and merge: Next 15.5.29, Angular 19.2 to 21.2, known faults 52 to 0. Needs Node 22.22.3 or newer; `ng update` migrations not run. Not merged, not deployed.
- `hub-api-kit-2026-11-11` is LOCAL ONLY and empty (cut from pkgfix): the API safety kit goes here, comes back to Thulaib first, never pushed.
- A push to GitHub deploys nothing: Railway and the Vercel projects have no GitHub link, checked 11 Nov. The live Hub changes only through `scripts/deploy-railway.sh`.
- `hub-api-kit-2026-11-11` (cut from pkgfix at 569418c) is LOCAL ONLY: the BB API safety kit in apps/api. Every route method is `export const X = handle(old(X_), opts)` (apps/api/lib/kit-wire.js bridges the kit to the Hub's `(req, context)` functions), shield in apps/api/middleware.js (limits per caller: login 30 a minute, API 1,200 a minute, JSON 1 MB, raw file PUT 6 MB; env HUB_LIMIT_LOGIN, HUB_LIMIT_API, HUB_RAW_MB), securityHeaders in apps/api/next.config.mjs (strict policy on /api, app policy on pages with the inline script and Angular's onload allowed by hash read from the built index.html). Each choice and what was rejected is in DECISIONS.md. Not pushed, not merged, not deployed.

## 10. The API safety kit (branch hub-api-kit-2026-11-11)
```bash
cd ~/bb-systems/bb-client-os-kit
# re-install the kit files (never overwrites; prints what it would add)
node ~/bb-systems/qa/foundation/install.mjs . --api apps/api
# the gates for this branch
bash scripts/gate.sh
node ~/bb-systems/qa/floor.mjs .            # api-kit must PASS: 31 of 31 methods wrapped
bash ~/bb-systems/qa/foundation-gate.sh .
```
- The page policy is proven only through Next (`next build` + `next start` with the Angular build in apps/api/public, as Railway serves it): the gate's runners serve the app from a plain node server and never see the Next headers. Run that proof again after any change to apps/web/src/index.html or the Angular build options.
- A new route: `export const POST = handle(old(POST_), { schema })`; give it a schema only when the body is flat and every field is known from the server and from apps/web (DECISIONS.md section 3).
