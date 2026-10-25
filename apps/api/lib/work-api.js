/* THE WORKSPACE RULES (Stage 2, 24 Oct 2026). Every route of /api/<slug>/work calls one of these, so who may do what lives
   in one place, and mirrors core/work.ts that the screens already obey. The person, the side and the client come from the
   signed token, never from a body. Every write sends the live nudge; every task and post event drops a card into the chat. */

import { randomUUID } from 'node:crypto';
import { work } from './work-store.js';
import { mode } from './store.js';
import { session, deny, who } from './auth.js';
import { poke, pokesFor } from './live.js';
import { signUpload, signView } from './files.js';

function json(body, status = 200) {
  return Response.json(body, { status });
}

function bad(msg) {
  return json({ error: msg }, 400);
}

function no(msg) {
  return json({ error: msg }, 403);
}

function gone() {
  return json({ error: 'Not found' }, 404);
}

function clash(msg) {
  return json({ error: msg }, 409);
}

async function body(req) {
  try {
    const b = await req.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  } catch {
    return null;
  }
}

function open(req, slug) {
  const s = session(req, slug);
  if (!s) return null;
  return { me: who(s) };
}

function txt(v, n) {
  const s = String(v ?? '').trim();
  return s.length > n ? '' : s;
}

function isDay(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isTime(s) {
  return typeof s === 'string' && !Number.isNaN(Date.parse(s));
}

async function card(slug, me, event, refKind, refId, extra = {}) {
  const m = await work.addMsg(slug, {
    person_id: me.pid,
    by_name: me.name,
    side: me.side,
    role: me.role,
    event,
    ref_kind: refKind,
    ref_id: refId,
    ...extra
  });
  await poke(slug, 'msg', m.id);
  return m;
}

export async function getBook(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  return json({ ...(await work.book(slug)), me: { name: me.name, role: me.role, side: me.side } });
}

export async function getOne(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const id = url.searchParams.get('id');
  if (kind !== 'msg' && kind !== 'task' && kind !== 'post') return bad('kind must be msg, task or post');
  const row = kind === 'msg' ? await work.getMsg(slug, id) : kind === 'task' ? await work.getTask(slug, id) : await work.getPost(slug, id);
  if (!row) return gone();
  return json(row);
}

export async function postMsg(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  try {
    const b = await body(req);
    if (!b) return bad('A message needs a body.');
    const text = txt(b.text, 4001);
    if (text.length > 4000) return bad('A message is 4,000 characters at most.');
    let photos = [];
    if (b.photos !== undefined) {
      if (!Array.isArray(b.photos) || b.photos.length > 10) return bad('A message can hold at most 10 photos.');
      for (const id of b.photos) {
        const f = await work.getFile(slug, id);
        if (!f || f.kind !== 'photo') return bad('That photo is not on this Hub.');
        photos.push(id);
      }
    }
    let voice_file = null;
    let voice_secs = null;
    if (b.voice) {
      const f = await work.getFile(slug, b.voice.file);
      if (!f || f.kind !== 'voice') return bad('That voice note is not on this Hub.');
      voice_file = f.id;
      voice_secs = b.voice.secs;
      if (typeof voice_secs !== 'number' || voice_secs < 0.5 || voice_secs > 180) return bad('A voice note is three minutes at most.');
    }
    let reply_to = null;
    if (b.reply) {
      const m = await work.getMsg(slug, b.reply);
      if (!m) return bad('That message is not on this Hub.');
      reply_to = m.id;
    }
    let ref_kind = null;
    let ref_id = null;
    let event = null;
    if (b.ref) {
      if (b.ref.kind !== 'task' && b.ref.kind !== 'post') return bad('A reference must be a task or a post.');
      const row = b.ref.kind === 'task' ? await work.getTask(slug, b.ref.id) : await work.getPost(slug, b.ref.id);
      if (!row) return bad('That reference is not on this Hub.');
      ref_kind = b.ref.kind;
      ref_id = b.ref.id;
      event = 'comment';
    }
    if (!text && photos.length === 0 && !voice_file) return bad('Write something first.');
    const m = await work.addMsg(slug, {
      person_id: me.pid,
      by_name: me.name,
      side: me.side,
      role: me.role,
      text: text || null,
      photos,
      voice_file,
      voice_secs,
      reply_to,
      ref_kind,
      ref_id,
      event
    });
    await poke(slug, 'msg', m.id);
    return json(m, 201);
  } catch (e) {
    return bad(e.message);
  }
}

export async function postSeen(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  if (me.side !== 'bb') return no('Only the team marks messages seen.');
  try {
    const b = await body(req);
    if (!b || !Array.isArray(b.ids) || b.ids.length > 200) return bad('Seen needs a list of at most 200 messages.');
    const n = await work.markSeen(slug, b.ids);
    for (const id of b.ids) {
      const m = await work.getMsg(slug, id);
      if (m) await poke(slug, 'msg', id);
    }
    return json({ seen: n });
  } catch (e) {
    return bad(e.message);
  }
}

export async function postTask(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  try {
    const b = await body(req);
    if (!b) return bad('A task needs a body.');
    let title;
    let for_side;
    let who_name = null;
    let due = null;
    let files = [];
    let source_msg = null;
    let asked = false;
    let A = false;
    if (b.fromMsg) {
      A = true;
      const m = await work.getMsg(slug, b.fromMsg);
      if (!m) return bad('That message is not on this Hub.');
      const existing = await work.taskBySource(slug, m.id);
      if (existing) return json(existing, 200);
      const firstLine = (m.text || '').split('\n')[0];
      if (firstLine) {
        if (firstLine.length > 80) {
          const cut = firstLine.lastIndexOf(' ', 80);
          title = cut > 0 ? firstLine.slice(0, cut) : firstLine.slice(0, 80);
        } else {
          title = firstLine;
        }
      } else if (m.photos && m.photos.length === 1) {
        title = 'Photo from ' + m.by;
      } else if (m.photos && m.photos.length > 1) {
        title = 'Photos from ' + m.by;
      } else if (m.voice_file) {
        title = 'Voice note from ' + m.by;
      } else {
        title = 'Message from ' + m.by;
      }
      for_side = m.side === 'client' ? 'bb' : 'client';
      asked = m.side === 'client';
      files = m.photos || [];
      who_name = for_side === 'client' ? (m.side === 'client' ? m.by : null) : null;
      source_msg = m.id;
    } else {
      title = txt(b.title, 201);
      if (!title || title.length > 200) return bad('A task needs a title of up to 200 characters.');
      for_side = b.for;
      if (for_side !== 'client' && for_side !== 'bb') return bad('A task is for the client or the team.');
      if (b.due !== undefined && b.due !== null && !isDay(b.due)) return bad('The due date must be YYYY-MM-DD.');
      due = b.due || null;
      if (b.files !== undefined) {
        if (!Array.isArray(b.files) || b.files.length > 10) return bad('A task can hold at most 10 files.');
        for (const id of b.files) {
          const f = await work.getFile(slug, id);
          if (!f) return bad('That file is not on this Hub.');
          files.push(id);
        }
      }
      if (for_side === 'bb') {
        asked = me.side === 'client';
        who_name = me.side === 'bb' ? me.name : null;
      } else {
        asked = false;
        who_name = txt(b.who, 60) || (me.side === 'client' ? me.name : null);
      }
    }
    const t = await work.addTask(slug, {
      title,
      for_side,
      who: who_name,
      due,
      stage: 'todo',
      files,
      source_msg,
      asked,
      made_by: me.pid,
      by_name: me.name
    });
    await poke(slug, 'task', t.id);
    await card(slug, me, 'task-made', 'task', t.id, A ? { reply_to: source_msg } : {});
    return json(t, 201);
  } catch (e) {
    return bad(e.message);
  }
}

export async function patchTask(req, slug, id) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  try {
    const t = await work.getTask(slug, id);
    if (!t) return gone();
    const b = await body(req);
    if (!b) return bad('A task needs a body.');
    let patch = null;
    let cardEvent = null;
    let cardExtra = {};
    if (b.accept) {
      if (me.side !== 'bb' || t.for !== 'bb' || !t.asked) return no('Only the team accepts a request.');
      if (!isDay(b.accept.due)) return bad('The due date must be YYYY-MM-DD.');
      patch = { asked: false, who: txt(b.accept.who, 60) || me.name, due: b.accept.due };
      cardEvent = 'task-accepted';
    } else if (b.outside) {
      if (me.side !== 'bb' || t.for !== 'bb' || !t.asked) return no('Only the team sends a request outside.');
      const text = txt(b.outside, 300);
      if (!text) return bad('Say what happens outside.');
      patch = { asked: false, outside: text };
      cardEvent = 'task-outside';
    } else if (b.late) {
      if (me.side !== 'bb' || t.for !== 'bb' || t.asked || t.outside || t.stage === 'done') return no('Only the team marks a task late.');
      const reason = txt(b.late.reason, 300);
      if (!reason || !isDay(b.late.newDue)) return bad('A late task needs a reason and a new due date.');
      patch = { late_reason: reason, late_due: b.late.newDue };
      cardEvent = 'task-late';
    } else if (b.stage) {
      if (b.stage !== 'todo' && b.stage !== 'doing' && b.stage !== 'done') return bad('That stage does not exist.');
      if (t.asked || t.outside) return no('A request moves once the team accepts it.');
      if (me.side === 'client' && t.for !== 'client') return no('That task is not yours to move.');
      if (me.side === 'bb' && t.for !== 'bb') return no('That task is not yours to move.');
      if (t.stage === b.stage) return json(t);
      patch = { stage: b.stage, done_at: b.stage === 'done' ? new Date().toISOString() : null };
      if (b.stage === 'done') cardEvent = 'task-done';
    } else {
      const hasTitle = b.title !== undefined;
      const hasDue = b.due !== undefined;
      const hasWho = b.who !== undefined;
      if (!hasTitle && !hasDue && !hasWho) return bad('Nothing to change.');
      const mayEdit = (t, me) => {
        if (me.side === 'client') return t.for === 'client' || (t.for === 'bb' && t.asked && t.by === me.name);
        if (me.side === 'bb') return t.for === 'bb' && !t.asked && !t.outside;
        return false;
      };
      if (!mayEdit(t, me)) return no('That task is not yours to change.');
      patch = {};
      if (hasTitle) {
        const title = txt(b.title, 201);
        if (!title || title.length > 200) return bad('A task needs a title of up to 200 characters.');
        patch.title = title;
      }
      if (hasDue) {
        if (b.due !== null && !isDay(b.due)) return bad('The due date must be YYYY-MM-DD.');
        patch.due = b.due;
      }
      if (hasWho) patch.who = txt(b.who, 60);
    }
    const next = await work.updateTask(slug, id, patch);
    await poke(slug, 'task', id);
    if (cardEvent) await card(slug, me, cardEvent, 'task', id, cardExtra);
    return json(next);
  } catch (e) {
    return bad(e.message);
  }
}

export async function deleteTask(req, slug, id) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  try {
    const t = await work.getTask(slug, id);
    if (!t) return gone();
    const mayEdit = (t, me) => {
      if (me.side === 'client') return t.for === 'client' || (t.for === 'bb' && t.asked && t.by === me.name);
      if (me.side === 'bb') return t.for === 'bb' && !t.asked && !t.outside;
      return false;
    };
    if (!mayEdit(t, me)) return no('That task is not yours to remove.');
    await work.removeTask(slug, id);
    await poke(slug, 'task', id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return bad(e.message);
  }
}

export async function postPost(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  if (me.side !== 'bb') return no('Only the team puts up a post.');
  try {
    const b = await body(req);
    if (!b) return bad('A post needs a body.');
    if (!['Instagram', 'Facebook', 'TikTok'].includes(b.platform)) return bad('Pick Instagram, Facebook or TikTok.');
    if (!['Post', 'Carousel', 'Reel'].includes(b.kind)) return bad('Pick Post, Carousel or Reel.');
    if (!isTime(b.slot)) return bad('The slot must be a readable time.');
    let decide_by = null;
    if (b.decideBy !== undefined && b.decideBy !== null) {
      if (!isTime(b.decideBy)) return bad('The decide-by must be a readable time.');
      decide_by = new Date(b.decideBy).toISOString();
    }
    const caption = txt(b.caption, 2201);
    if (caption.length > 2200) return bad('A caption is 2,200 characters at most.');
    const head = txt(b.head, 121);
    if (head.length > 120) return bad('A headline is 120 characters at most.');
    const line = txt(b.line, 200);
    const tone = b.tone || 'brand';
    if (!['brand', 'ink', 'cream'].includes(tone)) return bad('Pick brand, ink or cream.');
    let art_file = null;
    if (b.art) {
      const f = await work.getFile(slug, b.art);
      if (!f || f.kind !== 'art') return bad('That artwork is not on this Hub.');
      art_file = f.id;
    }
    const p = await work.addPost(slug, {
      platform: b.platform,
      kind: b.kind,
      slot: new Date(b.slot).toISOString(),
      decide_by,
      made_by: me.pid
    }, {
      caption,
      head,
      line,
      tone,
      art_file,
      made_by: me.pid
    });
    await poke(slug, 'post', p.id);
    return json(p, 201);
  } catch (e) {
    return bad(e.message);
  }
}

export async function actOnPost(req, slug, id) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  try {
    const p = await work.getPost(slug, id);
    if (!p) return gone();
    const b = await body(req);
    if (!b) return bad('An action needs a body.');
    if (b.answer !== undefined) {
      if (me.side !== 'client') return no('Only the client answers a post.');
      if (b.answer !== 'approved' && b.answer !== 'change') return bad('Answer approved or change.');
      if (p.status !== 'waiting') return clash('This post is not waiting for an answer.');
      const last = p.versions[p.versions.length - 1];
      if (p.changes.some(c => c.v === last.v)) return clash('This post is with the team.');
      if (b.v !== last.v) return clash('A newer version is waiting.');
      let text = null;
      let voice_file = null;
      let voice_secs = null;
      if (b.answer === 'change') {
        text = txt(b.text, 2000);
        if (b.voice) {
          const f = await work.getFile(slug, b.voice.file);
          if (!f || f.kind !== 'voice') return bad('That voice note is not on this Hub.');
          voice_file = f.id;
          voice_secs = b.voice.secs;
          if (typeof voice_secs !== 'number' || voice_secs < 0.5 || voice_secs > 180) return bad('A voice note is three minutes at most.');
        }
        if (!text && !voice_file) return bad('Say what to change.');
      }
      const next = await work.addAnswer(slug, {
        post_id: id,
        v: last.v,
        answer: b.answer,
        person_id: me.pid,
        by_name: me.name,
        role: me.role,
        text,
        voice_file,
        voice_secs
      });
      await poke(slug, 'post', id);
      await card(slug, me, b.answer === 'approved' ? 'approved' : 'change', 'post', id,
        b.answer === 'change' ? { text, voice_file, voice_secs } : {});
      return json(next);
    }
    if (b.version !== undefined) {
      if (me.side !== 'bb') return no('Only the team adds a version.');
      const caption = txt(b.version.caption, 2201);
      if (caption.length > 2200) return bad('A caption is 2,200 characters at most.');
      const head = txt(b.version.head, 121);
      if (head.length > 120) return bad('A headline is 120 characters at most.');
      const line = txt(b.version.line, 200);
      const tone = b.version.tone || 'brand';
      if (!['brand', 'ink', 'cream'].includes(tone)) return bad('Pick brand, ink or cream.');
      /* a new caption with no new picture keeps the artwork the client already saw (the two person run, 25 Oct 2026) */
      const prev = p.versions[p.versions.length - 1];
      let art_file = prev && prev.art ? prev.art : null;
      if (b.version.art) {
        const f = await work.getFile(slug, b.version.art);
        if (!f || f.kind !== 'art') return bad('That artwork is not on this Hub.');
        art_file = f.id;
      }
      const next = await work.addVersion(slug, id, {
        caption,
        head,
        line,
        tone,
        art_file,
        made_by: me.pid
      });
      await poke(slug, 'post', id);
      return json(next);
    }
    if (b.status !== undefined) {
      if (me.side !== 'bb') return no('Only the team sets a post status.');
      if (b.status !== 'planned' && b.status !== 'live') return bad('The team sets planned or live; only the client approves.');
      let slot = null;
      if (b.slot !== undefined && b.slot !== null) {
        if (!isTime(b.slot)) return bad('The slot must be a readable time.');
        slot = new Date(b.slot).toISOString();
      }
      const next = await work.updatePost(slug, id, { status: b.status, slot });
      await poke(slug, 'post', id);
      return json(next);
    }
    return bad('Nothing to do.');
  } catch (e) {
    return bad(e.message);
  }
}

export async function postFile(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  try {
    const b = await body(req);
    if (!b) return bad('A file needs a body.');
    if (!['photo', 'voice', 'art'].includes(b.kind)) return bad('A file is a photo, a voice note or artwork.');
    if (b.kind === 'art' && me.side !== 'bb') return no('Only the team adds post artwork.');
    const allowed = {
      photo: ['image/jpeg', 'image/webp', 'image/png'],
      art: ['image/jpeg', 'image/webp', 'image/png'],
      voice: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/ogg']
    };
    if (!allowed[b.kind].includes(b.mime)) return bad('That kind of file cannot be added.');
    const limits = { photo: 2097152, voice: 4194304, art: 5242880 };
    if (!Number.isInteger(b.bytes) || b.bytes <= 0 || b.bytes > limits[b.kind]) return bad('That file is too large.');
    let secs = null;
    if (b.kind === 'voice') {
      secs = b.secs;
      if (typeof secs !== 'number' || secs < 0.5 || secs > 180) return bad('A voice note is three minutes at most.');
    }
    const id = randomUUID();
    const ext = {
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/png': 'png',
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg'
    }[b.mime];
    const path = `${slug}/${new Date().toISOString().slice(0, 7)}/${id}.${ext}`;
    const f = await work.addFile(slug, {
      id,
      path,
      kind: b.kind,
      mime: b.mime,
      bytes: b.bytes,
      secs: b.kind === 'voice' ? secs : null,
      by_person: me.pid,
      by_name: me.name
    });
    const upload = await signUpload(slug, id, path, b.mime);
    return json({ id: f.id, upload }, 201);
  } catch (e) {
    return bad(e.message);
  }
}

export async function getFileLink(req, slug, id) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  const f = await work.getFile(slug, id);
  if (!f) return gone();
  return json({ url: await signView(slug, f) });
}

export async function getPokes(req, slug) {
  const s = session(req, slug);
  if (!s) return deny();
  const me = who(s);
  if (mode === 'supabase') return gone();
  return json(pokesFor(slug));
}
