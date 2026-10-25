/* THE WORKSPACE STORE, MEMORY MODE (Stage 2, 24 Oct 2026). The demo and every test run on this. It refuses what the real
   tables refuse, so a test that passes here would pass on the database. Rows are kept in column form and leave in the
   shapes the app reads (mould/stage2/parts/COMMON-SERVER.md). Nothing survives a restart, on purpose. */
import { randomUUID } from 'node:crypto';

const mem = (globalThis.__hubWork ||= new Map());

function room(slug) {
  if (!mem.has(slug)) {
    mem.set(slug, { msgs: [], tasks: [], posts: [], versions: [], approvals: [], files: [] });
  }
  return mem.get(slug);
}

function toMsg(row) {
  const msg = { id: row.id, at: new Date(row.at).toISOString(), side: row.side, by: row.by_name, role: row.role };
  if (row.text) msg.text = row.text;
  if (row.photos && row.photos.length) msg.photos = [...row.photos];
  if (row.voice_file) msg.voice = { media: row.voice_file, secs: Number(row.voice_secs) };
  if (row.reply_to) msg.reply = row.reply_to;
  if (row.ref_kind) msg.ref = { kind: row.ref_kind, id: row.ref_id };
  if (row.event) msg.event = row.event;
  if (row.side === 'client') msg.seen = Boolean(row.seen_at);
  return msg;
}

function toTask(row) {
  const task = { id: row.id, title: row.title, for: row.for_side, stage: row.stage, files: [...(row.files || [])], by: row.by_name, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
  if (row.who) task.who = row.who;
  if (row.due) task.due = row.due;
  if (row.source_msg) task.source = row.source_msg;
  if (row.asked) task.asked = true;
  if (row.outside) task.outside = row.outside;
  if (row.late_reason) task.late = { reason: row.late_reason, newDue: row.late_due };
  if (row.done_at) task.doneAt = new Date(row.done_at).toISOString();
  return task;
}

function toPost(room, postRow) {
  const versions = room.versions
    .filter(v => v.post_id === postRow.id)
    .sort((a, b) => a.v - b.v)
    .map(v => {
      const version = { v: v.v, caption: v.caption, head: v.head, tone: v.tone, at: new Date(v.at).toISOString() };
      if (v.line) version.line = v.line;
      if (v.art_file) version.art = v.art_file;
      return version;
    });
  const changes = room.approvals
    .filter(a => a.post_id === postRow.id && a.answer === 'change')
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .map(a => {
      const change = { at: new Date(a.at).toISOString(), by: a.by_name, v: a.v };
      if (a.text) change.text = a.text;
      if (a.voice_file) change.voice = { media: a.voice_file, secs: Number(a.voice_secs) };
      return change;
    });
  const approved = room.approvals
    .filter(a => a.post_id === postRow.id && a.answer === 'approved')
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .pop();
  const post = { id: postRow.id, platform: postRow.platform, kind: postRow.kind, slot: new Date(postRow.slot).toISOString(), status: postRow.status, versions, changes, createdAt: new Date(postRow.created_at).toISOString(), updatedAt: new Date(postRow.updated_at).toISOString() };
  if (postRow.decide_by) post.decideBy = postRow.decide_by;
  if (approved) {
    post.approvedBy = approved.by_name;
    post.approvedAt = new Date(approved.at).toISOString();
  }
  return post;
}

function fileOfSlug(slug, id) {
  return room(slug).files.find(f => f.id === id) || null;
}

function msgOfSlug(slug, id) {
  return room(slug).msgs.find(m => m.id === id) || null;
}

function taskOfSlug(slug, id) {
  return room(slug).tasks.find(t => t.id === id) || null;
}

function postOfSlug(slug, id) {
  return room(slug).posts.find(p => p.id === id) || null;
}

function versionOfPost(slug, postId, v) {
  return room(slug).versions.find(ver => ver.post_id === postId && ver.v === v) || null;
}

export async function book(slug) {
  const r = room(slug);
  const msgs = r.msgs
    .slice()
    .sort((a, b) => new Date(a.at) - new Date(b.at) || (a.id < b.id ? -1 : 1))
    .slice(-300)
    .map(toMsg);
  const tasks = r.tasks
    .slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 500)
    .map(toTask);
  const posts = r.posts
    .slice()
    .sort((a, b) => new Date(b.slot) - new Date(a.slot))
    .slice(0, 200)
    .map(p => toPost(r, p));
  return { msgs, tasks, posts };
}

export async function getMsg(slug, id) {
  const row = msgOfSlug(slug, id);
  return row ? toMsg(row) : null;
}

export async function getTask(slug, id) {
  const row = taskOfSlug(slug, id);
  return row ? toTask(row) : null;
}

export async function getPost(slug, id) {
  const row = postOfSlug(slug, id);
  return row ? toPost(room(slug), row) : null;
}

export async function getFile(slug, id) {
  const row = fileOfSlug(slug, id);
  return row ? { id: row.id, path: row.path, kind: row.kind, mime: row.mime, bytes: row.bytes, secs: row.secs } : null;
}

export async function addMsg(slug, row) {
  const r = room(slug);
  const text = row.text || null;
  const photos = row.photos || [];
  const voice_file = row.voice_file || null;
  const reply_to = row.reply_to || null;
  const ref_kind = row.ref_kind || null;
  const ref_id = row.ref_id || null;
  const event = row.event || null;
  if (text && text.length > 4000) throw new Error('That message is too long.');
  if (photos.length > 10) throw new Error('A message can hold at most 10 photos.');
  for (const pid of photos) {
    if (!fileOfSlug(slug, pid)) throw new Error('That photo is not a file of this workspace.');
  }
  if (voice_file && !fileOfSlug(slug, voice_file)) throw new Error('That voice note is not a file of this workspace.');
  if (reply_to && !msgOfSlug(slug, reply_to)) throw new Error('That reply target is not a message of this workspace.');
  if (ref_kind === 'task' && !taskOfSlug(slug, ref_id)) throw new Error('That task is not in this workspace.');
  if (ref_kind === 'post' && !postOfSlug(slug, ref_id)) throw new Error('That post is not in this workspace.');
  if (!text && !photos.length && !voice_file && !event) throw new Error('A message needs text, a photo, a voice note or an event.');
  const msg = {
    id: randomUUID(),
    client: slug,
    person_id: row.person_id || null,
    by_name: row.by_name,
    side: row.side,
    role: row.role,
    text,
    photos,
    voice_file,
    voice_secs: row.voice_secs != null ? Number(row.voice_secs) : null,
    reply_to,
    ref_kind,
    ref_id,
    event,
    seen_at: null,
    at: new Date().toISOString()
  };
  r.msgs.push(msg);
  return toMsg(msg);
}

export async function markSeen(slug, ids) {
  const r = room(slug);
  let count = 0;
  for (const id of ids) {
    const msg = r.msgs.find(m => m.id === id && m.side === 'client' && !m.seen_at);
    if (msg) {
      msg.seen_at = new Date().toISOString();
      count++;
    }
  }
  return count;
}

export async function taskBySource(slug, msgId) {
  const row = room(slug).tasks.find(t => t.source_msg === msgId);
  return row ? toTask(row) : null;
}

export async function addTask(slug, row) {
  const r = room(slug);
  if (!row.title || row.title.length > 200) throw new Error('The task title must be between 1 and 200 characters.');
  if (row.for_side !== 'client' && row.for_side !== 'bb') throw new Error('The task must be for client or bb.');
  if (!['todo', 'doing', 'done'].includes(row.stage)) throw new Error('The task stage must be todo, doing or done.');
  for (const fid of (row.files || [])) {
    if (!fileOfSlug(slug, fid)) throw new Error('That file is not in this workspace.');
  }
  if (row.source_msg && !msgOfSlug(slug, row.source_msg)) throw new Error('That source message is not in this workspace.');
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    client: slug,
    title: row.title,
    for_side: row.for_side,
    who: row.who || null,
    due: row.due || null,
    stage: row.stage,
    files: row.files || [],
    source_msg: row.source_msg || null,
    asked: Boolean(row.asked),
    outside: null,
    late_reason: null,
    late_due: null,
    made_by: row.made_by || null,
    by_name: row.by_name,
    done_at: null,
    created_at: now,
    updated_at: now
  };
  r.tasks.push(task);
  return toTask(task);
}

export async function updateTask(slug, id, patch) {
  const task = taskOfSlug(slug, id);
  if (!task) return null;
  if (patch.stage && !['todo', 'doing', 'done'].includes(patch.stage)) throw new Error('The task stage must be todo, doing or done.');
  if (patch.late_reason && !patch.late_due) throw new Error('A late reason needs a new due date.');
  if (patch.late_due && !patch.late_reason) throw new Error('A new due date needs a late reason.');
  Object.assign(task, patch);
  task.updated_at = new Date().toISOString();
  return toTask(task);
}

export async function removeTask(slug, id) {
  const r = room(slug);
  const index = r.tasks.findIndex(t => t.id === id);
  if (index === -1) return false;
  r.tasks.splice(index, 1);
  return true;
}

export async function addPost(slug, post, version) {
  const r = room(slug);
  if (version.caption.length > 2200) throw new Error('That caption is too long.');
  if (!['brand', 'ink', 'cream'].includes(version.tone)) throw new Error('The tone must be brand, ink or cream.');
  if (version.art_file && !fileOfSlug(slug, version.art_file)) throw new Error('That art file is not in this workspace.');
  const now = new Date().toISOString();
  const postRow = {
    id: randomUUID(),
    client: slug,
    platform: post.platform,
    kind: post.kind,
    slot: post.slot,
    decide_by: post.decide_by || null,
    status: 'waiting',
    made_by: post.made_by || null,
    created_at: now,
    updated_at: now
  };
  r.posts.push(postRow);
  r.versions.push({
    id: randomUUID(),
    client: slug,
    post_id: postRow.id,
    v: 1,
    caption: version.caption,
    head: version.head,
    line: version.line || null,
    tone: version.tone,
    art_file: version.art_file,
    made_by: version.made_by || null,
    at: now
  });
  return toPost(r, postRow);
}

export async function addVersion(slug, postId, version) {
  const r = room(slug);
  const post = postOfSlug(slug, postId);
  if (!post) return null;
  if (version.caption.length > 2200) throw new Error('That caption is too long.');
  if (!['brand', 'ink', 'cream'].includes(version.tone)) throw new Error('The tone must be brand, ink or cream.');
  if (version.art_file && !fileOfSlug(slug, version.art_file)) throw new Error('That art file is not in this workspace.');
  const highest = r.versions.filter(v => v.post_id === postId).reduce((max, v) => Math.max(max, v.v), 0);
  const now = new Date().toISOString();
  r.versions.push({
    id: randomUUID(),
    client: slug,
    post_id: postId,
    v: highest + 1,
    caption: version.caption,
    head: version.head,
    line: version.line || null,
    tone: version.tone,
    art_file: version.art_file,
    made_by: version.made_by || null,
    at: now
  });
  post.status = 'waiting';
  post.updated_at = now;
  return toPost(r, post);
}

export async function updatePost(slug, id, patch) {
  const r = room(slug);
  const post = postOfSlug(slug, id);
  if (!post) return null;
  if (patch.status) post.status = patch.status;
  if (patch.slot) post.slot = patch.slot;
  if (patch.decide_by) post.decide_by = patch.decide_by;
  post.updated_at = new Date().toISOString();
  return toPost(r, post);
}

export async function addAnswer(slug, row) {
  const r = room(slug);
  const post = postOfSlug(slug, row.post_id);
  if (!post) throw new Error('That post is not in this workspace.');
  if (row.answer !== 'approved' && row.answer !== 'change') throw new Error('The answer must be approved or change.');
  if (row.answer === 'change' && !row.text && !row.voice_file) throw new Error('A change needs text or a voice note.');
  if (!versionOfPost(slug, row.post_id, row.v)) throw new Error('That version is not in this post.');
  if (row.voice_file && !fileOfSlug(slug, row.voice_file)) throw new Error('That voice note is not in this workspace.');
  const now = new Date().toISOString();
  r.approvals.push({
    id: randomUUID(),
    client: slug,
    post_id: row.post_id,
    v: row.v,
    answer: row.answer,
    person_id: row.person_id || null,
    by_name: row.by_name,
    role: row.role,
    text: row.text || null,
    voice_file: row.voice_file || null,
    voice_secs: row.voice_secs != null ? Number(row.voice_secs) : null,
    at: now
  });
  if (row.answer === 'approved') post.status = 'approved';
  post.updated_at = now;
  return toPost(r, post);
}

export async function addFile(slug, row) {
  const r = room(slug);
  if (!['photo', 'voice', 'art'].includes(row.kind)) throw new Error('The file kind must be photo, voice or art.');
  const limit = row.kind === 'photo' ? 2097152 : row.kind === 'voice' ? 4194304 : 5242880;
  if (row.bytes > limit) throw new Error('That file is too large.');
  const file = {
    id: row.id || randomUUID(),
    client: slug,
    path: row.path,
    kind: row.kind,
    mime: row.mime,
    bytes: row.bytes,
    secs: row.secs != null ? Number(row.secs) : null,
    by_person: row.by_person || null,
    by_name: row.by_name,
    created_at: new Date().toISOString()
  };
  r.files.push(file);
  return { id: file.id, path: file.path, kind: file.kind, mime: file.mime, bytes: file.bytes, secs: file.secs };
}
