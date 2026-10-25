Write the COMPLETE contents of one new file: apps/api/lib/work-db.js. Output ONLY one ```js code block.

WHAT IT IS: the workspace store in DATABASE mode, on Supabase through the service key, over the tables in COMMON below.

IMPORTS: only `import { supa } from './store.js';` (an async function returning a ready supabase-js client).

RULES:
- EVERY query names the slug: .eq('client', slug). A read by id is .eq('client', slug).eq('id', id).maybeSingle().
- Every list read names .limit(n) or .range(a, b) within three lines of .from(...).
- Every call checks `error` and throws it (if (error) throw error;).
- Rows leave in the app's shapes through three functions you write: toMsg(row), toTask(row), toPost(postRow, versions,
  approvals). Follow the SHAPES section exactly: leave keys out when null, undefined or empty; `seen` exists only on side
  'client' messages; `asked` only when true; `files` always an array; versions oldest first (by v); `changes` = approvals
  with answer 'change' oldest first, each { at, by, v, text?, voice? }; approvedBy and approvedAt from the NEWEST approval
  with answer 'approved'. Numeric columns (secs, voice_secs) leave as numbers (Number(x)). Times as ISO strings
  (new Date(x).toISOString()). Dates due and late_due as the 'YYYY-MM-DD' string the database gives.
- Inserts use .insert(row).select().single(). Updates use .update(patch).eq('client', slug).eq('id', id).select().maybeSingle().
- updateTask and every post change set updated_at: new Date().toISOString().

THE FUNCTIONS (exports, exactly, all async): book, getMsg, getTask, getPost, getFile, addMsg, markSeen, taskBySource, addTask,
updateTask, removeTask, addPost, addVersion, updatePost, addAnswer, addFile. What each returns is in the STORE CONTRACT below.
- book(slug): three reads at once (Promise.all): os_messages order at desc then id desc limit 300 (then reverse so the
  oldest comes first); os_work_tasks order updated_at desc then id desc limit 500; os_posts order slot desc then id desc
  limit 200. Then, when there are posts, ONE read of os_post_versions and ONE of os_approvals for those post ids
  (.eq('client', slug).in('post_id', ids) ordered, .limit(2000)) and build each post.
- getPost(slug, id): the post, its versions (order v ascending, limit 200) and approvals (order at ascending, limit 500).
- markSeen(slug, ids): update seen_at = now where client = slug, id in ids, side = 'client', seen_at is null; .select('id')
  and return how many rows came back. Refuse more than 200 ids (throw).
- taskBySource(slug, msgId): .eq('source_msg', msgId).limit(1), the first or null.
- removeTask: .delete().eq('client', slug).eq('id', id).select('id'); true when a row came back.
- addPost(slug, post, version): insert the post, then insert version v 1 for it with client = slug, return getPost.
- addVersion(slug, postId, version): read the highest v (order v desc limit 1); null when the post is not this slug's; insert
  v + 1; update the post status 'waiting' and updated_at; return getPost.
- updatePost(slug, id, patch): only the keys status, slot, decide_by that are present; return getPost or null.
- addAnswer(slug, row): insert into os_approvals with client = slug; when row.answer is 'approved' update the post status
  'approved'; always update the post's updated_at; return getPost.
- addFile(slug, row): insert with client = slug and the id given; return { id, path, kind, mime, bytes, secs }.
- getFile: select id,path,kind,mime,bytes,secs.

Start the file with this comment, word for word:
/* THE WORKSPACE STORE, DATABASE MODE (Stage 2, 24 Oct 2026). Reached only with the server's service key: the tables have RLS
   on, no policies and no rights for the public key. Every query names the client, and the database itself refuses a link
   to another client's row (composite keys and os_work_guard), so a slip here is caught twice. */
