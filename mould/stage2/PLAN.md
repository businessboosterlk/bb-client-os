# THE HUB STAGE 2: THE PLAN ON PAPER (section 1, 24 Oct 2026)

Brief: `~/Downloads/BB-HANDOVERS/THE-HUB-STAGE-2-PUSH-AND-AI-HANDOVER.md`. Thulaib's page:
`~/Downloads/THE-HUB-STAGE-2/THE-HUB-STAGE-2-PLAN.html`. **NOTHING here is applied.** The live database, Vercel and every
key wait for his go on this plan. Sections 2 to 5 are briefed to the crew only after that go.

## GROUND TRUTH READ 24 Oct 2026 (live database, read only)
- `os_clients`, `os_records`, `os_audit`: **0 rows each.** No real client has ever signed in, so the seat change breaks nobody.
- All three are RLS on, no policies, no grants to anon or authenticated. Reached only by the server's service key.
- `supabase_realtime` publication: **empty.** No BB app uses Realtime today (grep of the estate: no `.channel(`).
- Storage buckets: `inspo-shots`, `graphic-images`, `task-images`, **all three public.** The Hub's would be BB's first private one.
- `bb_push_subscriptions` / `bb_push_log` (staff, owned by the BB PUSH chat) and `push_subscriptions` / `push_log` (Total Uplift).
- `lib/lock.js` keeps the wrong code lock in process memory. On Vercel many copies run at once, so the lock would count per copy.
  **A lock table is needed before the door is hosted.** Prior art: `os_academy_login_attempts`.

## PRIOR ART, IN WRITING (the four questions)
**1. Has BB built this before?** In parts, never the whole. Never built: a live chat, a private file store, Realtime anywhere.
| Module | Best existing build | Taken | Not taken (why) |
|---|---|---|---|
| Door, seat tokens, tenant wall, paged reads | Hub `apps/api` (46 of 46 wall checks, gate 20 of 20) | all of it | nothing |
| Lock after wrong codes | Hub `lib/lock.js` rules + `os_academy_login_attempts` table | the rules, kept in a table | memory only (many copies on Vercel) |
| Push sender | `~/bb-systems/push/bb-push` v3 (from Total Uplift `push-send`) | one push per device, claim before send, a log row per attempt, rate ceiling, no money in an alert, permission behind a tap (gym member app) | its tables, its VAPID pair and its public subscribe door: the Hub gets its own (README: staff and clients never share a list or a key; the stack has one owner) and subscribe goes through the signed in server |
| AI on DeepInfra | Booster `ask-bb-doors` server core | counts in code, the model only words them; receipts; the normaliser for dashes and the serial comma | the chat, the ladder, the handbook |
| Spend cap | `~/bb-systems/claude-rail` `lib/budget.mjs` | reserve worst case, settle real, release on failure; a cap the env may only lower | the file ledger (the Hub runs on Vercel, so the spend count is a table) |
| Live updates | idea only (`animated-report-and-phone-remote`, broadcast, room code never the slug) | broadcast, a topic that is not the slug | postgres_changes: it needs a Supabase identity per person, which the Hub does not use |
| Shapes | Stage 1 `core/work-models.ts` | every field | nothing |
**2. Best one and how I know:** the Hub API for the door (most checks, proven on the real code); bb-push v3 for sending (9,500
log rows of real sends, fourteen landmines learnt); claude-rail for caps (13 tests including a failing fixture).
**3. What they do that mine did not:** the list in the Taken column.
**4. Deliberately not taking:** Supabase Auth per user from the tenant security mould (the Hub's signed seat tokens are tested;
moving would rewrite the door); Railway (`railway.json` stays, unused); public buckets; any reminder schedule (690 open).
**5. Stack:** Next 15 API, Angular 19 app. `check_stack.py` PASS on 24 Oct.

## THE TABLES (new, all `client text not null`, RLS on, no policies, no grants to anon or authenticated)
| Table | One row is | Key columns |
|---|---|---|
| `os_people` | a named person on a client's Hub, either side | id, client, side (client, bb), name, role, code_salt, code_hash, revoked_at, last_in_at |
| `os_door_tries` | one wrong code | caller_hash, business, at (the lock reads the last 15 minutes) |
| `os_messages` | a chat message or a card | id, client, person_id, by_name, side, role, text (max 4,000), reply_to, ref_kind, ref_id, event, seen_at, at |
| `os_work_tasks` | a task either way | id, client, title, for_side, who, due, stage (todo, doing, done), source_msg, asked, outside, late_reason, late_due, made_by, done_at |
| `os_posts` | a planned post | id, client, platform, kind, slot, decide_by, status (waiting, planned, approved, live) |
| `os_post_versions` | one version of a post | id, client, post_id, v, caption, head, line, tone, made_by, at; unique (post_id, v) |
| `os_approvals` | a yes or a change asked, never edited | id, client, post_id, v, answer (approved, change), person_id, by_name, text, voice_file, at |
| `os_files` | one photo or voice note in the store | id, client, path, kind (photo, voice), mime, bytes, secs, by_person, on_kind, on_id |
Sections 3 and 4 add `os_push_subs`, `os_push_log` (the Hub's own) and `os_ai_spend` (one row per Catch me up, reserve then settle).

**Tenant wall, extended:** (1) every route reads the slug from the signed token, never from the body, as today; (2) NEW in the
database: unique (client, id) on every table and every link is a composite foreign key (client, x_id), so a row can never point
at another client's row even if the code is wrong; (3) `os_approvals` has a trigger that refuses update and delete; (4) the gate
gains a query proving zero anon and authenticated grants on every `os_` table; (5) `scripts/tenant-wall.mjs` gains a probe per new
route (client A's token asking for client B's message, task, post, approval, file, push) plus a failing fixture.

## THE FILE STORE
Bucket `hub-media`, PRIVATE, no storage policies, so nothing is readable without a signed link. Path `<slug>/<yyyy-mm>/<uuid>.<ext>`.
Types allowed at the bucket: image/jpeg, image/webp, audio/webm, audio/mp4. Caps: a photo 2 MB (the app already shrinks to 1,200 px),
a voice note 3 minutes and 4 MB. Upload: the app asks the server, the server checks the token and writes the `os_files` row, then
hands a signed upload link that lives 2 minutes; the file goes straight to the store (Vercel refuses bodies over 4.5 MB). Viewing:
the server signs a link for 1 hour only when the file row's client equals the token's slug. Never base64 in a row.

## THE NAMED SEAT CHANGE
Today a business has two seats (Owner, Team), one code each; everyone on a seat is the same person to the system.
New: one `os_people` row per person, each with their own code (scrypt, salted, as today). The door looks the same: business name
and YOUR code. The token carries person id, name, role and side. Every message, task, approval and file is stamped with person id
and the name at that moment. Removing a person revokes their code alone. Codes are made by `newCode()` and read on a call as today.
**An approval records:** the post, the version number, the answer, the person, their name and role at the time, the time plus the
words or voice note asked for. A later caption is a new version, so a yes on version 2 can never read as a yes on version 3.
The demo (local mode, code 1111) is untouched. `os_clients.seats` stays in place, unread.

## LIVE UPDATES (told, never polled)
After every write the server sends a Supabase Realtime BROADCAST (`/realtime/v1/api/broadcast`, service key) on the client's
topic: `hub-` plus the first 24 characters of HMAC(HUB_SECRET, slug). The topic is handed to the app at sign in with the public
key. The message carries only what changed (kind and id), never words, names or files. The app then reads that one row through the
API with its token. Someone who learnt a topic would see only that something happened. When the phone wakes or the connection
returns, the app reads once (a catch up, not a timer). Check at build: Realtime allows public channels in project settings.

## VERCEL (Pro, his account)
- `the-hub-api`: root `apps/api`, Next 15, function region `hnd1` (Tokyo, beside the database in ap-northeast-1).
- `the-hub`: the client app, the Angular build in api mode. The demo `the-hub-demo` stays as it is for sales.
**Secrets Thulaib pastes into `the-hub-api` (never typed by Claude, never in a chat):**
section 2 `SUPABASE_SERVICE_ROLE_KEY`, `HUB_SECRET`, `BB_ADMIN_SECRET`; section 3 `VAPID_PRIVATE_KEY`; section 4 `DEEPINFRA_KEY`
(a NEW DeepInfra key named the-hub, so the Hub's spend is its own).
**Plain settings (not secret):** `DATA_MODE=supabase`, `SUPABASE_URL=https://yyviiwnqgphyklcoijyd.supabase.co`, `SUPABASE_ANON_KEY`
(the public key, handed to the app for the live channel), `HUB_ORIGINS` (the-hub's address), `HUB_MEDIA_BUCKET=hub-media`,
`VAPID_PUBLIC_KEY`, `VAPID_SUBJECT=mailto:businessboosterlk@gmail.com`, `HUB_AI_CAP_LKR_MONTH`, optional `HUB_LOCK_TRIES` (8) and
`HUB_LOCK_SECONDS` (900). `the-hub` needs none: the API address is in the cast.

## QUESTIONS FOR THULAIB (bb_pending 708 GO, 709 where the team answers, 710 name on team messages)
1. Where the team answers the chat for the pilot: in the Hub, each team member a named person on that client (recommended), or
   wait for a team inbox in the SMM Workspace (a second build).
2. What a client sees on a team message: first name and role (recommended) or the role only.
3. GO on this plan.
Still open from before: 689 reply promise, 690 silence rule (no reminders until then), 691 tiers (Catch me up shows only on the top
tier, so tiers decide who sees it), 702 merge of the branch.
