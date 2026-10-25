Write the COMPLETE contents of one new file: apps/api/lib/work-api.js. Output ONLY one ```js code block.

WHAT IT IS: the workspace's route handlers and EVERY rule about who may do what. The route files are one line each and call
these functions, so all the rules live here. The server stamps every write with the signed in person; it NEVER trusts a
side, name, role, id or client that arrives in a body.

IMPORTS, exactly:
import { randomUUID } from 'node:crypto';
import { work } from './work-store.js';                 // the STORE CONTRACT below, as an object: work.book(slug) and so on
import { mode } from './store.js';
import { session, deny, who } from './auth.js';        // session(req, slug) -> payload or null; deny() -> 401 Response; who(payload) -> { pid, name, role, side }
import { poke, pokesFor } from './live.js';           // await poke(slug, kind, id) after every write; pokesFor(slug) -> array
import { signUpload, signView } from './files.js';    // await signUpload(slug, id, path, mime) -> { url, ... }; await signView(slug, file) -> url string

HELPERS you write (not exported): json(body, status = 200) -> Response.json(body, { status }); bad(msg) 400 { error: msg };
no(msg) 403; gone() 404 { error: 'Not found' }; clash(msg) 409; body(req) -> the parsed JSON object or null (a non object is
null); open(req, slug) -> { me } from session or null; txt(v, n) -> String(v ?? '').trim() limited to n characters or '' ;
isDay(s) -> /^\d{4}-\d{2}-\d{2}$/.test(s); isTime(s) -> a string Date.parse can read; card(slug, me, event, refKind, refId,
extra = {}) -> adds a chat message { person_id: me.pid, by_name: me.name, side: me.side, role: me.role, event, ref_kind,
ref_id, ...extra } through work.addMsg, then await poke(slug, 'msg', m.id), and returns it.
Every exported handler starts: const s = session(req, slug); if (!s) return deny(); const me = who(s);
Every handler that writes wraps the store calls in try { } catch (e) { return bad(e.message); } so a refusal by the store
is a 400 with its words, never a crash.

EXPORTED HANDLERS (all async, each returns a Response):

getBook(req, slug): json({ ...(await work.book(slug)), me: { name: me.name, role: me.role, side: me.side } }).

getOne(req, slug): query kind ('msg', 'task' or 'post', else bad('kind must be msg, task or post')) and id; the matching
work.getMsg / getTask / getPost; null -> gone(); else json(row).

postMsg(req, slug): b = body (null -> bad). text = txt(b.text, 4001); over 4,000 characters -> bad('A message is 4,000 characters at most.').
photos: an array of at most 10 ids (else bad), each must be work.getFile(slug, id) with kind 'photo' (else bad('That photo is not on this Hub.')).
voice: when b.voice is given it needs b.voice.file (a file of this slug with kind 'voice', else bad) and b.voice.secs a number
from 0.5 to 180 (else bad). reply: when given it must be a message of this slug (work.getMsg, else bad('That message is not on this Hub.')).
ref: when given { kind: 'task' | 'post', id } it must exist for this slug (else bad); a message with a ref has event 'comment'.
Nothing at all (no text, no photos, no voice) -> bad('Write something first.').
m = work.addMsg(slug, { person_id: me.pid, by_name: me.name, side: me.side, role: me.role, text: text || null, photos,
voice_file, voice_secs, reply_to, ref_kind, ref_id, event }); await poke(slug, 'msg', m.id); json(m, 201).

postSeen(req, slug): only side 'bb' (else no('Only the team marks messages seen.')). ids: an array of at most 200 strings (else
bad). n = work.markSeen(slug, ids); poke each id that is a message of this slug; json({ seen: n }).

postTask(req, slug): b = body.
 A) b.fromMsg given: m = work.getMsg(slug, b.fromMsg) (null -> bad). existing = work.taskBySource(slug, m.id): when found
    json(existing, 200) and stop. Title from the message: the first line of its text; over 80 characters cut at the last
    space before 80 (no space: the first 80); no text: 'Photo from ' + m.by when one photo, 'Photos from ' + m.by when more,
    'Voice note from ' + m.by when a voice note, else 'Message from ' + m.by. for_side = m.side === 'client' ? 'bb' : 'client';
    asked = m.side === 'client'; files = m.photos || []; who = for_side === 'client' ? (m.side === 'client' ? m.by : null) : null.
 B) otherwise: title = txt(b.title, 201) (empty or over 200 -> bad('A task needs a title of up to 200 characters.')); for_side
    = b.for ('client' or 'bb', else bad); due optional isDay (else bad); files optional array of at most 10 ids each a file of
    this slug (else bad). When for_side is 'bb': asked = me.side === 'client', who = me.side === 'bb' ? me.name : null.
    When for_side is 'client': asked = false, who = txt(b.who, 60) || (me.side === 'client' ? me.name : null).
 t = work.addTask(slug, { title, for_side, who, due, stage: 'todo', files, source_msg (A only), asked, made_by: me.pid,
 by_name: me.name }); await poke(slug, 'task', t.id); await card(slug, me, 'task-made', 'task', t.id, A ? { reply_to: m.id } : {});
 json(t, 201).

patchTask(req, slug, id): t = work.getTask(slug, id) (null -> gone()). b = body. Exactly ONE of these, checked in this order:
 - b.accept: only side 'bb' and t.for === 'bb' and t.asked (else no('Only the team accepts a request.')). due isDay (else bad).
   patch { asked: false, who: txt(b.accept.who, 60) || me.name, due }. Card 'task-accepted'.
 - b.outside: only side 'bb' and t.for === 'bb' and t.asked (else no). text txt(b.outside, 300) not empty (else bad).
   patch { asked: false, outside: text }. Card 'task-outside'.
 - b.late: only side 'bb' and t.for === 'bb' and not t.asked and not t.outside and t.stage !== 'done' (else no). reason
   txt(b.late.reason, 300) not empty and isDay(b.late.newDue) (else bad). patch { late_reason, late_due }. Card 'task-late'.
 - b.stage: one of todo, doing, done (else bad('That stage does not exist.')). Who may move: if t.asked or t.outside nobody
   (no('A request moves once the team accepts it.')); side 'client' only when t.for === 'client'; side 'bb' only when
   t.for === 'bb' (else no('That task is not yours to move.')). Same stage -> json(t). patch { stage, done_at: stage === 'done'
   ? now : null }. Card 'task-done' only when the new stage is 'done'.
 - otherwise an EDIT of title, due or who (at least one present, else bad('Nothing to change.')): mayEdit(t, me) below or
   no('That task is not yours to change.'); title rules as above, due isDay or null, who txt 60.
 mayEdit(t, me): side 'client' -> t.for === 'client' or (t.for === 'bb' and t.asked and t.by === me.name); side 'bb' ->
 t.for === 'bb' and not t.asked and not t.outside.
 After the patch: next = work.updateTask(slug, id, patch); await poke(slug, 'task', id); the card if any; json(next).

deleteTask(req, slug, id): t (null -> gone()); mayEdit(t, me) or no('That task is not yours to remove.'); work.removeTask;
await poke(slug, 'task', id); new Response(null, { status: 204 }).

postPost(req, slug): only side 'bb' (else no('Only the team puts up a post.')). b: platform one of Instagram, Facebook, TikTok;
kind one of Post, Carousel, Reel; slot isTime; decideBy optional isTime; caption txt 2201 not over 2,200; head txt 121 not
over 120; line optional txt 200; tone brand, ink or cream (default brand); art optional, a file of this slug with kind 'art'.
Any fault -> bad with a short plain sentence. p = work.addPost(slug, { platform, kind, slot: new Date(slot).toISOString(),
decide_by, made_by: me.pid }, { caption, head, line, tone, art_file, made_by: me.pid }); await poke(slug, 'post', p.id); json(p, 201).

actOnPost(req, slug, id): p = work.getPost(slug, id) (null -> gone()). b = body.
 - b.answer present: only side 'client' (else no('Only the client answers a post.')). answer 'approved' or 'change' (else bad).
   p.status must be 'waiting' (else clash('This post is not waiting for an answer.')). last = the last version; a change already
   asked on last.v (p.changes has one with v === last.v) -> clash('This post is with the team.'). b.v !== last.v ->
   clash('A newer version is waiting.'). For 'change': text txt(b.text, 2000) or a voice { file (kind 'voice' of this slug),
   secs 0.5 to 180 }; neither -> bad('Say what to change.'). next = work.addAnswer(slug, { post_id: id, v: last.v, answer,
   person_id: me.pid, by_name: me.name, role: me.role, text, voice_file, voice_secs }). await poke(slug, 'post', id). Card:
   'approved' with no extra, or 'change' with { text, voice_file, voice_secs } carrying what was asked. json(next).
 - b.version present: only side 'bb' (else no). The same caption, head, line, tone, art rules as postPost.
   next = work.addVersion(slug, id, {...}); poke; json(next).
 - b.status present: only side 'bb' (else no). Only 'planned' or 'live' (else bad('The team sets planned or live; only the client approves.')).
   Optional b.slot isTime. next = work.updatePost(slug, id, { status, slot }); poke; json(next).
 - none -> bad('Nothing to do.').

postFile(req, slug): b = body. kind photo, voice or art (else bad). art only for side 'bb' (else no('Only the team adds post artwork.')).
mime allowed: photo and art image/jpeg, image/webp, image/png; voice audio/webm, audio/mp4, audio/mpeg, audio/aac, audio/ogg
(else bad('That kind of file cannot be added.')). bytes an integer above 0 and at most 2097152 for a photo, 4194304 for a
voice note, 5242880 for art (else bad('That file is too large.')). voice needs secs from 0.5 to 180 (else bad('A voice note is three minutes at most.')).
id = randomUUID(); ext = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png', 'audio/webm': 'webm', 'audio/mp4':
'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/ogg': 'ogg' }[mime]; path = `${slug}/${new Date().toISOString().slice(0, 7)}/${id}.${ext}`.
f = work.addFile(slug, { id, path, kind, mime, bytes, secs: kind === 'voice' ? secs : null, by_person: me.pid, by_name: me.name });
upload = await signUpload(slug, id, path, mime); json({ id: f.id, upload }, 201).

getFileLink(req, slug, id): f = work.getFile(slug, id) (null -> gone()); json({ url: await signView(slug, f) }).

getPokes(req, slug): memory mode only (mode === 'supabase' -> gone()); json(pokesFor(slug)).

Start the file with this comment, word for word:
/* THE WORKSPACE RULES (Stage 2, 24 Oct 2026). Every route of /api/<slug>/work calls one of these, so who may do what lives
   in one place, and mirrors core/work.ts that the screens already obey. The person, the side and the client come from the
   signed token, never from a body. Every write sends the live nudge; every task and post event drops a card into the chat. */
