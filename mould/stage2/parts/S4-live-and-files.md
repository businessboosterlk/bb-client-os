Write the COMPLETE contents of TWO small files in ONE ```js code block, the first under the line `// FILE: apps/api/lib/live.js`
and the second under the line `// FILE: apps/api/lib/files.js`. Output ONLY that one code block.

=== apps/api/lib/live.js ===
WHAT IT IS: the live nudge. After every write the server tells the client's phones that something changed. The nudge carries
ONLY { kind, id } (kind is 'msg', 'task' or 'post'), never words, names or files. The app then reads that one row itself.
IMPORTS: `import { mode } from './store.js';` and `import { topicFor } from './auth.js';`
EXPORTS:
- async poke(slug, kind, id): never throws.
  Memory mode (mode !== 'supabase'): push { kind, id, at: new Date().toISOString() } onto the list for that slug in
  `(globalThis.__hubPokes ||= new Map())`, keeping the newest 200.
  Database mode: POST to `${process.env.SUPABASE_URL}/realtime/v1/api/broadcast` with headers apikey and Authorization
  'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY and 'Content-Type': 'application/json', body
  JSON.stringify({ messages: [{ topic: topicFor(slug), event: 'change', payload: { kind, id }, private: false }] }),
  signal AbortSignal.timeout(3000). It is awaited (a serverless function may stop the moment it answers). On any failure
  console.warn one line: 'live nudge not sent: ' + the error message.
- pokesFor(slug): memory mode only, a COPY of that slug's list (newest last); [] when none or in database mode.
Start with this comment, word for word:
/* THE LIVE NUDGE (Stage 2). The app is TOLD something changed, it never asks the database on a timer. Supabase Realtime
   broadcast on the client's topic (never the slug), carrying the kind and the id only: someone who learnt a topic would
   see only that something happened, and the app reads the row itself through the signed in server. */

=== apps/api/lib/files.js ===
WHAT IT IS: links to the private file store. Database mode signs links on the private bucket. Memory mode keeps the bytes in
the process and hands out links to two routes of this server, signed the same way, so the app can be tested end to end.
IMPORTS: `import { createHmac, timingSafeEqual } from 'node:crypto';` and `import { mode, supa } from './store.js';`
CONSTANTS: const BUCKET = process.env.HUB_MEDIA_BUCKET || 'hub-media'; const SECRET = process.env.HUB_SECRET || 'dev-only-secret';
EXPORTS:
- async signUpload(slug, id, path, mime): database mode: `const { data, error } = await (await supa()).storage.from(BUCKET).createSignedUploadUrl(path);`
  throw error; return { url: data.signedUrl, path: data.path, token: data.token }. Memory mode: return
  { url: rawLink(slug, id, 600), path } where rawLink is described below.
- async signView(slug, file): database mode: `createSignedUrl(file.path, 3600)` on the bucket, throw error, return
  data.signedUrl. Memory mode: return rawLink(slug, file.id, 3600).
- rawLink(slug, id, seconds) (not async): exp = Math.floor(Date.now() / 1000) + seconds; sig = createHmac('sha256', SECRET)
  .update(slug + '|' + id + '|' + exp).digest('base64url'); return `/api/${slug}/work/files/${id}/raw?exp=${exp}&sig=${sig}`.
- async rawPut(req, slug, id): a Next route handler body for memory mode. Database mode answers 404 { error: 'Not found' }.
  Check the signature from the query (exp, sig) with timingSafeEqual on equal length buffers and exp not past, else 403
  { error: 'This link has run out' }. Read the bytes with Buffer.from(await req.arrayBuffer()); over 5242880 bytes answers
  413 { error: 'That file is too large' }. Keep { type: req.headers.get('content-type') || 'application/octet-stream', bytes }
  in `(globalThis.__hubFiles ||= new Map())` under the key slug + '/' + id. Answer 200 { ok: true }.
- async rawGet(req, slug, id): database mode 404. Same signature check (403). Not found 404. Otherwise
  `new Response(entry.bytes, { headers: { 'Content-Type': entry.type, 'Cache-Control': 'private, max-age=3600' } })`.
Start with this comment, word for word:
/* THE PRIVATE FILE STORE (Stage 2). Photos, voice notes and post artwork are files, never text inside a row. Database mode:
   the bucket is private with no storage policies, so nothing opens without a link this server signs after checking the
   file belongs to the signed in client. Memory mode keeps the bytes in this process behind the same kind of signed link. */
