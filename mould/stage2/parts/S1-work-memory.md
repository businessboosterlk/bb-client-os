Write the COMPLETE contents of one new file: apps/api/lib/work-memory.js. Output ONLY one ```js code block.

WHAT IT IS: the workspace store in MEMORY mode (the demo and every test). It must behave exactly like the database store,
including REFUSING what the database refuses, because a memory store that accepts what the real table refuses hides faults
from every test (a lesson this project already paid for once).

IMPORTS: only `import { randomUUID } from 'node:crypto';`

THE MEMORY: one object for the whole process, so every route sees the same rows:
  const mem = (globalThis.__hubWork ||= new Map());
  function room(slug) returns mem.get(slug), creating { msgs: [], tasks: [], posts: [], versions: [], approvals: [], files: [] } on first use.
Rows are kept in COLUMN form (the table column names in COMMON below) and turned into the app's shapes on the way out by
three functions you write: toMsg(row), toTask(row), toPost(room, postRow). Follow the SHAPES section exactly: leave keys out
when null, undefined or empty; `seen` exists only on side 'client' messages; `asked` only when true; `files` always an array;
`versions` oldest first; `changes` = approvals with answer 'change', oldest first, each { at, by, v, text?, voice? };
approvedBy and approvedAt from the NEWEST approval with answer 'approved'. secs and voice secs as numbers.
Every new row gets id randomUUID() and its time fields new Date().toISOString(). Returned objects are COPIES, never the
stored row itself (a caller changing a returned object must never change the store).

REFUSE (throw new Error with a short plain sentence) exactly what the database refuses:
- addMsg: text over 4,000 characters; more than 10 photos; a photo id that is not a file of THIS slug; a voice_file that is
  not a file of this slug; a reply_to that is not a message of this slug; ref_kind 'task' whose ref_id is not a task of this
  slug, or 'post' whose ref_id is not a post of this slug; a message with no text, no photos, no voice_file and no event.
- addTask: title empty or over 200 characters; for_side not 'client' or 'bb'; stage not todo, doing or done; a file id not
  of this slug; source_msg not a message of this slug.
- updateTask: a stage not todo, doing or done; late_reason set without late_due or the other way round.
- addVersion and addPost: caption over 2,200 characters; tone not brand, ink or cream; art_file not a file of this slug.
- addAnswer: answer not approved or change; a change with no text and no voice_file; a v that is not a version of that post;
  a post_id not of this slug.
- addFile: kind not photo, voice or art; bytes over 2097152 for a photo, 4194304 for a voice note, 5242880 for art.

ORDERS (the same as the database store):
- book(slug): msgs = the newest 300 by `at` then id, returned OLDEST first; tasks newest updated_at first, at most 500;
  posts newest slot first, at most 200.
- addVersion: v = highest v of that post + 1; the post's status becomes 'waiting'; updated_at now.
- addAnswer: answer 'approved' sets the post's status 'approved'; both set updated_at now.
- markSeen(slug, ids): only side 'client' messages with no seen_at; returns how many changed.
- removeTask: true when a task went, else false. getFile returns { id, path, kind, mime, bytes, secs }.

EXPORTS, exactly (all async): book, getMsg, getTask, getPost, getFile, addMsg, markSeen, taskBySource, addTask, updateTask,
removeTask, addPost, addVersion, updatePost, addAnswer, addFile.

Start the file with this comment, word for word:
/* THE WORKSPACE STORE, MEMORY MODE (Stage 2, 24 Oct 2026). The demo and every test run on this. It refuses what the real
   tables refuse, so a test that passes here would pass on the database. Rows are kept in column form and leave in the
   shapes the app reads (mould/stage2/parts/COMMON-SERVER.md). Nothing survives a restart, on purpose. */
