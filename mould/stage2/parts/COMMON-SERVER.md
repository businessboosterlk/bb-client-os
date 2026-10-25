THE SERVER: The Hub API, Next 15 route handlers in plain JavaScript ES modules (import and export, no TypeScript, no
require). Node 22. The only package you may import is '@supabase/supabase-js' (already installed) and 'node:crypto'.
Files live in apps/api/lib/. Every function is async unless the brief says otherwise.

THE WORKSPACE between a client and Business Booster: chat messages, tasks both ways, posts with versions and approvals,
photo and voice note files. TWO SIDES: 'client' (the client's own people) and 'bb' (the Business Booster team).
Every row belongs to one client, named by its slug (for example 'demo'). NOTHING may ever read or write a row of another
slug: every query names the slug, every id that comes in is checked to belong to that slug before it is used.

THE PERSON who does something arrives as `who` = { pid, name, role, side } (pid is a uuid string or null in memory mode).

THE TABLES (database mode). Column names exactly:
os_files(id uuid, client, path, kind 'photo'|'voice'|'art', mime, bytes int, secs numeric, by_person uuid, by_name, created_at)
os_messages(id, client, person_id, by_name, side, role, text, photos uuid[], voice_file uuid, voice_secs numeric, reply_to uuid,
  ref_kind 'task'|'post', ref_id uuid, event, seen_at, at)
os_work_tasks(id, client, title, for_side 'client'|'bb', who, due date 'YYYY-MM-DD', stage 'todo'|'doing'|'done', files uuid[],
  source_msg uuid, asked boolean, outside, late_reason, late_due date, made_by uuid, by_name, done_at, created_at, updated_at)
os_posts(id, client, platform 'Instagram'|'Facebook'|'TikTok', kind 'Post'|'Carousel'|'Reel', slot timestamptz, decide_by,
  status 'waiting'|'planned'|'approved'|'live', made_by, created_at, updated_at)
os_post_versions(id, client, post_id, v int, caption, head, line, tone 'brand'|'ink'|'cream', art_file uuid, made_by, at)
os_approvals(id, client, post_id, v, answer 'approved'|'change', person_id, by_name, role, text, voice_file, voice_secs, at)
  (an approval row is NEVER updated or deleted; the database refuses it)

THE SHAPES THE APP READS (rows are turned into these before they leave a store; leave a key OUT when its value is
null, undefined or an empty array, except `photos`/`files`/`versions`/`changes` rules below):
Msg      { id, at, side, by (= by_name), role, text?, photos? (only when not empty), voice? { media (= voice_file), secs (number) },
           reply? (= reply_to), ref? { kind (= ref_kind), id (= ref_id) }, event?, seen? (ONLY on side 'client' messages:
           true when seen_at is set, else false) }
WorkTask { id, title, for (= for_side), who?, due?, stage, files (always an array), source? (= source_msg), asked? (only when
           true), outside?, late? { reason (= late_reason), newDue (= late_due) }, by (= by_name), createdAt, updatedAt, doneAt? }
WorkPost { id, platform, kind, slot, decideBy? (= decide_by), status, versions: [{ v, caption, head, line?, tone, at, art? (= art_file) }]
           oldest first, changes: [{ at, by, v, text?, voice? { media, secs } }] = the approvals whose answer is 'change', oldest
           first, approvedBy? approvedAt? = by_name and at of the NEWEST approval whose answer is 'approved', createdAt, updatedAt }
Times leave as ISO strings (new Date(x).toISOString()). Dates (due, late_due) leave as 'YYYY-MM-DD'. Numbers as numbers.

THE STORE CONTRACT (lib/work-memory.js and lib/work-db.js export EXACTLY these, same names, same answers):
  book(slug)                         -> { msgs: Msg[] (the newest 300, returned OLDEST first), tasks: WorkTask[] (newest updated
                                        first, at most 500), posts: WorkPost[] (newest slot first, at most 200) }
  getMsg(slug, id)  getTask(slug, id)  getPost(slug, id)   -> the shape or null
  getFile(slug, id)                  -> { id, path, kind, mime, bytes, secs } or null
  addMsg(slug, row)                  row: { person_id, by_name, side, role, text, photos, voice_file, voice_secs, reply_to,
                                        ref_kind, ref_id, event } (missing keys mean null; photos default []) -> Msg
  markSeen(slug, ids)                sets seen_at = now on those ids that are side 'client' and not yet seen -> count changed
  taskBySource(slug, msgId)          -> WorkTask or null
  addTask(slug, row)                 row: { title, for_side, who, due, stage, files, source_msg, asked, made_by, by_name } -> WorkTask
  updateTask(slug, id, patch)        patch uses COLUMN names (title, who, due, stage, asked, outside, late_reason, late_due, done_at);
                                        sets updated_at = now -> WorkTask or null when not found
  removeTask(slug, id)               -> true when a row went, false when none
  addPost(slug, post, version)       post: { platform, kind, slot, decide_by, made_by }, version: { caption, head, line, tone,
                                        art_file, made_by } -> WorkPost with status 'waiting' and version v 1
  addVersion(slug, postId, version)  v = the highest v + 1, sets the post's status to 'waiting' and updated_at -> WorkPost or null
  updatePost(slug, id, patch)        patch: { status?, slot?, decide_by? } -> WorkPost or null
  addAnswer(slug, row)               row: { post_id, v, answer, person_id, by_name, role, text, voice_file, voice_secs }; inserts the
                                        approval; when answer is 'approved' also sets the post's status 'approved'; sets updated_at
                                        -> WorkPost
  addFile(slug, row)                 row: { id, path, kind, mime, bytes, secs, by_person, by_name } -> { id, path, kind, mime, bytes, secs }

THE DATABASE HANDS OVER 1,000 ROWS AT MOST AND SAYS NOTHING: every list read names .limit(n) or .range(a, b), on the same line
as .from(...) or within the next three lines.

HOUSE RULES: British English in every comment and every string a person reads. Never an em dash or an en dash. No comma
before and, or, but or nor in a string a person reads. Error words are plain and short ("That task is not yours to move.").
Comments explain WHY in one or two lines, never what the next line obviously does.
