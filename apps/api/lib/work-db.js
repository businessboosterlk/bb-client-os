/* THE WORKSPACE STORE, DATABASE MODE (Stage 2, 24 Oct 2026). Reached only with the server's service key: the tables have RLS
   on, no policies and no rights for the public key. Every query names the client, and the database itself refuses a link
   to another client's row (composite keys and os_work_guard), so a slip here is caught twice. */

import { supa } from './store.js';

function toMsg(row) {
  const msg = {
    id: row.id,
    at: new Date(row.at).toISOString(),
    side: row.side,
    by: row.by_name,
    role: row.role
  };
  if (row.text !== null && row.text !== undefined) msg.text = row.text;
  if (row.photos && row.photos.length > 0) msg.photos = row.photos;
  if (row.voice_file) msg.voice = { media: row.voice_file, secs: Number(row.voice_secs) };
  if (row.reply_to) msg.reply = row.reply_to;
  if (row.ref_kind && row.ref_id) msg.ref = { kind: row.ref_kind, id: row.ref_id };
  if (row.event) msg.event = row.event;
  if (row.side === 'client') msg.seen = row.seen_at !== null && row.seen_at !== undefined;
  return msg;
}

function toTask(row) {
  const task = {
    id: row.id,
    title: row.title,
    for: row.for_side,
    stage: row.stage,
    files: row.files || [],
    by: row.by_name,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
  if (row.who) task.who = row.who;
  if (row.due) task.due = row.due;
  if (row.source_msg) task.source = row.source_msg;
  if (row.asked) task.asked = true;
  if (row.outside) task.outside = row.outside;
  if (row.late_reason) task.late = { reason: row.late_reason, newDue: row.late_due };
  if (row.done_at) task.doneAt = new Date(row.done_at).toISOString();
  return task;
}

function toPost(postRow, versions, approvals) {
  const post = {
    id: postRow.id,
    platform: postRow.platform,
    kind: postRow.kind,
    slot: new Date(postRow.slot).toISOString(),
    status: postRow.status,
    versions: versions.map(v => {
      const version = {
        v: v.v,
        caption: v.caption,
        head: v.head,
        tone: v.tone,
        at: new Date(v.at).toISOString()
      };
      if (v.line) version.line = v.line;
      if (v.art_file) version.art = v.art_file;
      return version;
    }),
    changes: approvals
      .filter(a => a.answer === 'change')
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .map(a => {
        const change = {
          at: new Date(a.at).toISOString(),
          by: a.by_name,
          v: a.v
        };
        if (a.text) change.text = a.text;
        if (a.voice_file) change.voice = { media: a.voice_file, secs: Number(a.voice_secs) };
        return change;
      }),
    createdAt: new Date(postRow.created_at).toISOString(),
    updatedAt: new Date(postRow.updated_at).toISOString()
  };
  if (postRow.decide_by) post.decideBy = new Date(postRow.decide_by).toISOString();
  const approved = approvals
    .filter(a => a.answer === 'approved')
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .pop();
  if (approved) {
    post.approvedBy = approved.by_name;
    post.approvedAt = new Date(approved.at).toISOString();
  }
  return post;
}

export async function book(slug) {
  const [msgsRes, tasksRes, postsRes] = await Promise.all([
    (await supa())
      .from('os_messages')
      .select('*')
      .eq('client', slug)
      .order('at', { ascending: false })
      .order('id', { ascending: false })
      .limit(300),
    (await supa())
      .from('os_work_tasks')
      .select('*')
      .eq('client', slug)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(500),
    (await supa())
      .from('os_posts')
      .select('*')
      .eq('client', slug)
      .order('slot', { ascending: false })
      .order('id', { ascending: false })
      .limit(200)
  ]);
  if (msgsRes.error) throw msgsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (postsRes.error) throw postsRes.error;

  const msgs = msgsRes.data.reverse().map(toMsg);
  const tasks = tasksRes.data.map(toTask);

  let posts = [];
  if (postsRes.data.length > 0) {
    const ids = postsRes.data.map(p => p.id);
    const [versionsRes, approvalsRes] = await Promise.all([
      (await supa())
        .from('os_post_versions')
        .select('*')
        .eq('client', slug)
        .in('post_id', ids)
        .order('v', { ascending: true })
        .limit(2000),
      (await supa())
        .from('os_approvals')
        .select('*')
        .eq('client', slug)
        .in('post_id', ids)
        .order('at', { ascending: true })
        .limit(2000)
    ]);
    if (versionsRes.error) throw versionsRes.error;
    if (approvalsRes.error) throw approvalsRes.error;

    posts = postsRes.data.map(postRow => {
      const versions = versionsRes.data.filter(v => v.post_id === postRow.id);
      const approvals = approvalsRes.data.filter(a => a.post_id === postRow.id);
      return toPost(postRow, versions, approvals);
    });
  }

  return { msgs, tasks, posts };
}

export async function getMsg(slug, id) {
  const { data, error } = await (await supa())
    .from('os_messages')
    .select('*')
    .eq('client', slug)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toMsg(data) : null;
}

export async function getTask(slug, id) {
  const { data, error } = await (await supa())
    .from('os_work_tasks')
    .select('*')
    .eq('client', slug)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toTask(data) : null;
}

export async function getPost(slug, id) {
  const { data: postRow, error: postError } = await (await supa())
    .from('os_posts')
    .select('*')
    .eq('client', slug)
    .eq('id', id)
    .maybeSingle();
  if (postError) throw postError;
  if (!postRow) return null;

  const [versionsRes, approvalsRes] = await Promise.all([
    (await supa())
      .from('os_post_versions')
      .select('*')
      .eq('client', slug)
      .eq('post_id', id)
      .order('v', { ascending: true })
      .limit(200),
    (await supa())
      .from('os_approvals')
      .select('*')
      .eq('client', slug)
      .eq('post_id', id)
      .order('at', { ascending: true })
      .limit(500)
  ]);
  if (versionsRes.error) throw versionsRes.error;
  if (approvalsRes.error) throw approvalsRes.error;

  return toPost(postRow, versionsRes.data, approvalsRes.data);
}

export async function getFile(slug, id) {
  const { data, error } = await (await supa())
    .from('os_files')
    .select('id,path,kind,mime,bytes,secs')
    .eq('client', slug)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    path: data.path,
    kind: data.kind,
    mime: data.mime,
    bytes: data.bytes,
    secs: data.secs !== null ? Number(data.secs) : null
  };
}

export async function addMsg(slug, row) {
  const insertRow = {
    client: slug,
    person_id: row.person_id,
    by_name: row.by_name,
    side: row.side,
    role: row.role,
    text: row.text ?? null,
    photos: row.photos || [],
    voice_file: row.voice_file ?? null,
    voice_secs: row.voice_secs ?? null,
    reply_to: row.reply_to ?? null,
    ref_kind: row.ref_kind ?? null,
    ref_id: row.ref_id ?? null,
    event: row.event ?? null
  };
  const { data, error } = await (await supa())
    .from('os_messages')
    .insert(insertRow)
    .select()
    .single();
  if (error) throw error;
  return toMsg(data);
}

export async function markSeen(slug, ids) {
  if (ids.length > 200) throw new Error('Too many messages to mark seen.');
  const { data, error } = await (await supa())
    .from('os_messages')
    .update({ seen_at: new Date().toISOString() })
    .eq('client', slug)
    .in('id', ids)
    .eq('side', 'client')
    .is('seen_at', null)
    .select('id');
  if (error) throw error;
  return data.length;
}

export async function taskBySource(slug, msgId) {
  const { data, error } = await (await supa())
    .from('os_work_tasks')
    .select('*')
    .eq('client', slug)
    .eq('source_msg', msgId)
    .limit(1);
  if (error) throw error;
  return data.length > 0 ? toTask(data[0]) : null;
}

export async function addTask(slug, row) {
  const insertRow = {
    client: slug,
    title: row.title,
    for_side: row.for_side,
    who: row.who ?? null,
    due: row.due ?? null,
    stage: row.stage,
    files: row.files || [],
    source_msg: row.source_msg ?? null,
    asked: row.asked ?? false,
    outside: row.outside ?? null,
    late_reason: row.late_reason ?? null,
    late_due: row.late_due ?? null,
    made_by: row.made_by ?? null,
    by_name: row.by_name,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await (await supa())
    .from('os_work_tasks')
    .insert(insertRow)
    .select()
    .single();
  if (error) throw error;
  return toTask(data);
}

export async function updateTask(slug, id, patch) {
  const updateRow = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await (await supa())
    .from('os_work_tasks')
    .update(updateRow)
    .eq('client', slug)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? toTask(data) : null;
}

export async function removeTask(slug, id) {
  const { data, error } = await (await supa())
    .from('os_work_tasks')
    .delete()
    .eq('client', slug)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return data.length > 0;
}

export async function addPost(slug, post, version) {
  const { data: postRow, error: postError } = await (await supa())
    .from('os_posts')
    .insert({
      client: slug,
      platform: post.platform,
      kind: post.kind,
      slot: post.slot,
      decide_by: post.decide_by ?? null,
      status: 'waiting',
      made_by: post.made_by ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  if (postError) throw postError;

  const { error: versionError } = await (await supa())
    .from('os_post_versions')
    .insert({
      client: slug,
      post_id: postRow.id,
      v: 1,
      caption: version.caption,
      head: version.head,
      line: version.line ?? null,
      tone: version.tone,
      art_file: version.art_file ?? null,
      made_by: version.made_by ?? null,
      at: new Date().toISOString()
    });
  if (versionError) throw versionError;

  return getPost(slug, postRow.id);
}

export async function addVersion(slug, postId, version) {
  const { data: latest, error: latestError } = await (await supa())
    .from('os_post_versions')
    .select('v')
    .eq('client', slug)
    .eq('post_id', postId)
    .order('v', { ascending: false })
    .limit(1);
  if (latestError) throw latestError;
  if (latest.length === 0) return null;

  const nextV = latest[0].v + 1;
  const { error: versionError } = await (await supa())
    .from('os_post_versions')
    .insert({
      client: slug,
      post_id: postId,
      v: nextV,
      caption: version.caption,
      head: version.head,
      line: version.line ?? null,
      tone: version.tone,
      art_file: version.art_file ?? null,
      made_by: version.made_by ?? null,
      at: new Date().toISOString()
    });
  if (versionError) throw versionError;

  const { error: postError } = await (await supa())
    .from('os_posts')
    .update({ status: 'waiting', updated_at: new Date().toISOString() })
    .eq('client', slug)
    .eq('id', postId);
  if (postError) throw postError;

  return getPost(slug, postId);
}

export async function updatePost(slug, id, patch) {
  const updateRow = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) updateRow.status = patch.status;
  if (patch.slot !== undefined) updateRow.slot = patch.slot;
  if (patch.decide_by !== undefined) updateRow.decide_by = patch.decide_by;

  const { data, error } = await (await supa())
    .from('os_posts')
    .update(updateRow)
    .eq('client', slug)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getPost(slug, id);
}

export async function addAnswer(slug, row) {
  const { error: insertError } = await (await supa())
    .from('os_approvals')
    .insert({
      client: slug,
      post_id: row.post_id,
      v: row.v,
      answer: row.answer,
      person_id: row.person_id ?? null,
      by_name: row.by_name,
      role: row.role ?? '',
      text: row.text ?? null,
      voice_file: row.voice_file ?? null,
      voice_secs: row.voice_secs ?? null,
      at: new Date().toISOString()
    });
  if (insertError) throw insertError;

  const postPatch = { updated_at: new Date().toISOString() };
  if (row.answer === 'approved') postPatch.status = 'approved';

  const { error: postError } = await (await supa())
    .from('os_posts')
    .update(postPatch)
    .eq('client', slug)
    .eq('id', row.post_id);
  if (postError) throw postError;

  return getPost(slug, row.post_id);
}

export async function addFile(slug, row) {
  const { data, error } = await (await supa())
    .from('os_files')
    .insert({
      id: row.id,
      client: slug,
      path: row.path,
      kind: row.kind,
      mime: row.mime,
      bytes: row.bytes,
      secs: row.secs ?? null,
      by_person: row.by_person ?? null,
      by_name: row.by_name,
      created_at: new Date().toISOString()
    })
    .select('id,path,kind,mime,bytes,secs')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    path: data.path,
    kind: data.kind,
    mime: data.mime,
    bytes: data.bytes,
    secs: data.secs !== null ? Number(data.secs) : null
  };
}
