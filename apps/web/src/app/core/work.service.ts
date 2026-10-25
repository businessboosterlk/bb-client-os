import { Injectable, signal, computed, inject } from '@angular/core';
import { CastService } from './cast.service';
import { SessionService } from './session.service';
import { WorkBook, Msg, MsgRef, MsgEvent, WorkTask, WorkPost, TaskStage, Side } from './work-models';
import { needs, needCount, taskFromMsg, canMove, latest, dueOf, requestState, POST_STAGES, changeAsked } from './work';
import { workSeed, WORK_SEEDED_FLAG } from './work-seed';
import { putMedia, shrinkImage, clearMedia, setRemoteMedia } from './media';
import { WorkRemote, TaskChange } from './work-remote';
import { LiveSocket, LiveKind } from './live-socket';
import { niceDate } from './data.service';
import type { BubbleCard } from '../pages/work/bubble.component';

const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const iso = () => new Date().toISOString();
export function todayStr(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/* THE WORKSPACE STORE. Two homes, one set of screens.
   THE DEMO (no server): the book lives in this browser (localStorage for the rows, IndexedDB for the photos and voice notes).
   A REAL CLIENT (Stage 2, 25 Oct 2026): the book lives on the Hub server, every write goes through it and comes back stamped
   with the signed in person, and the app is TOLD by the live channel when something changes (core/live-socket.ts); it never
   asks on a timer. Both sides sign in to the same app: the client's people and the Business Booster team. */
@Injectable({ providedIn: 'root' })
export class WorkService {
  private castSvc = inject(CastService); private session = inject(SessionService);
  readonly book = signal<WorkBook>({ msgs: [], tasks: [], posts: [] });
  readonly ready = signal(false);
  /* the server's book is open to a signed in person; the demo needs no server */
  readonly remoteOn = computed(() => this.castSvc.apiMode() && !!this.session.token());
  readonly available = computed(() => this.remoteOn() || (!this.castSvc.apiMode() && this.castSvc.cast()?.data?.mode !== 'api'));
  readonly error = signal('');
  private remote: WorkRemote | null = null;
  private live: LiveSocket | null = null;
  readonly slug = computed(() => this.castSvc.slug());
  readonly me = computed(() => { const s = this.session.me(); if (s && this.remoteOn()) return { name: s.name, role: s.role, side: s.side };
    const n = this.session.user(); return { name: n, role: this.castSvc.cast()?.users.find(u => u.name === n)?.role || 'Team', side: 'client' as Side }; });
  readonly isTeam = computed(() => this.me().side === 'bb');
  readonly msgs = computed(() => this.book().msgs);
  readonly tasks = computed(() => this.book().tasks);
  readonly posts = computed(() => this.book().posts);
  readonly needs = computed(() => this.available() ? needs(this.book(), todayStr()) : []);
  readonly needCount = computed(() => this.available() ? needCount(this.book(), todayStr()) : 0);
  readonly forYouOpen = computed(() => this.tasks().filter(t => t.for === 'client' && t.stage !== 'done').length);
  /* the screens' clock, one minute fine: components never read the time themselves */
  readonly now = signal(iso());
  private clock: ReturnType<typeof setInterval> | null = null;
  private loadedFor = '';

  private key(){ return 'hub_work_' + this.slug(); }
  /* read once per client per open; the demo is seeded on its very first open in this browser */
  init(){
    if (!this.clock) this.clock = setInterval(() => this.now.set(iso()), 60e3);
    this.now.set(iso());
    const slug = this.slug(); if (!slug || !this.available()) { this.ready.set(true); return; }
    if (this.loadedFor === slug) return;
    this.loadedFor = slug;
    if (this.remoteOn()) { this.openRemote(slug); return; }
    let raw: string | null = null; try { raw = localStorage.getItem(this.key()); } catch {}
    let seeded = false; try { seeded = localStorage.getItem(WORK_SEEDED_FLAG + '_' + slug) === '1'; } catch {}
    if (raw === null && slug === 'demo' && !seeded) {
      this.book.set(workSeed(Date.now())); this.save();
      try { localStorage.setItem(WORK_SEEDED_FLAG + '_' + slug, '1'); } catch {}
    } else {
      try { const b = JSON.parse(raw || '{}'); this.book.set({ msgs: b.msgs || [], tasks: b.tasks || [], posts: b.posts || [] }); } catch { this.book.set({ msgs: [], tasks: [], posts: [] }); }
    }
    this.ready.set(true);
  }

  /* ── the server ── */
  private openRemote(slug: string){
    const api = this.castSvc.config().api;
    this.remote = new WorkRemote(api, slug, () => this.session.token(), () => this.error.set('Sign in again to carry on.'));
    const r = this.remote;
    /* photos and voice notes the device does not hold are read through links the server signs */
    setRemoteMedia((s, id) => s === slug ? r.fileUrl(id) : Promise.resolve(''));
    this.ready.set(false);
    const cfg = this.session.live();
    /* with a live channel the book is read when the channel has joined, so no write can fall between the read and the
       join; if the channel is slow to join the book is read anyway after 2.5 seconds, and the join reads once more */
    if (cfg) {
      this.live?.stop(); let read = false;
      const once = () => { read = true; this.pull().finally(() => this.ready.set(true)); };
      this.live = new LiveSocket(cfg, (k, id) => this.told(k, id), once); this.live.start();
      setTimeout(() => { if (!read) once(); }, 2500);
    } else this.pull().finally(() => this.ready.set(true));
  }
  /* the whole book, once on open and once when the live channel comes back after a drop: a catch up, never a timer */
  private async pull(){
    if (!this.remote) return;
    try { const b = await this.remote.book(); this.book.set({ msgs: b.msgs, tasks: b.tasks, posts: b.posts }); this.error.set(''); }
    catch (e) { if ((e as Error).message !== '401') this.error.set((e as Error).message); }
  }
  /* told by the live channel: read that one row and put it in its place */
  private async told(kind: LiveKind, id: string){
    if (!this.remote) return;
    try {
      const row = await this.remote.one(kind, id);
      if (kind === 'msg') { if (row) this.upMsg(row as Msg); }
      else if (kind === 'task') { if (row) this.upTask(row as WorkTask); else this.book.update(b => ({ ...b, tasks: b.tasks.filter(t => t.id !== id) })); }
      else if (row) this.upPost(row as WorkPost);
    } catch {}
  }
  private upMsg(m: Msg){ this.book.update(b => { const has = b.msgs.some(x => x.id === m.id); const msgs = has ? b.msgs.map(x => x.id === m.id ? m : x) : [...b.msgs, m].sort((a, c) => a.at.localeCompare(c.at)); return { ...b, msgs }; }); }
  private upTask(t: WorkTask){ this.book.update(b => ({ ...b, tasks: b.tasks.some(x => x.id === t.id) ? b.tasks.map(x => x.id === t.id ? t : x) : [t, ...b.tasks] })); }
  private upPost(p: WorkPost){ this.book.update(b => ({ ...b, posts: b.posts.some(x => x.id === p.id) ? b.posts.map(x => x.id === p.id ? p : x) : [p, ...b.posts] })); }
  /* the cards a write drops into the chat arrive by the live channel; with no channel (a test server) read the book again */
  private async after(){ if (!this.live) await this.pull(); }
  /* one write to the server: a refusal is said in its own words, never swallowed */
  private async ask<T>(fn: (r: WorkRemote) => Promise<T>): Promise<T | null> {
    if (!this.remote) return null;
    try { const v = await fn(this.remote); this.error.set(''); return v; }
    catch (e) { const m = (e as Error).message; if (m !== '401') this.error.set(m); return null; }
  }
  /* a file goes to the store and stays on this device under the same id, so the sender sees it at once */
  private async upload(blob: Blob, kind: 'photo' | 'voice' | 'art', secs?: number): Promise<string | null> {
    const id = await this.ask(r => r.upload(blob, kind, secs));
    if (id) await putMedia(this.slug(), blob, id);
    return id;
  }
  /* the team has seen the client's messages: told once the team opens the chat */
  async seeAll(){
    if (!this.remote || !this.isTeam()) return;
    const ids = this.msgs().filter(m => m.side === 'client' && !m.seen).map(m => m.id).slice(0, 200);
    if (!ids.length) return;
    if (await this.ask(r => r.seen(ids)) !== null) this.book.update(b => ({ ...b, msgs: b.msgs.map(m => ids.includes(m.id) ? { ...m, seen: true } : m) }));
  }
  /* the team's own moves on a task: accept, outside the package, a new date, a stage */
  async teamTask(id: string, change: TaskChange): Promise<WorkTask | null> {
    const t = await this.ask(r => r.patchTask(id, change)); if (t) { this.upTask(t); await this.after(); } return t;
  }
  /* the team puts up a post or a new version; artwork is a file in the store */
  async teamPost(p: { id?: string; platform: 'Instagram' | 'Facebook' | 'TikTok'; kind: 'Post' | 'Carousel' | 'Reel'; slot: string; decideBy?: string; caption: string; head: string; line?: string; tone: WorkPost['versions'][number]['tone']; art?: File | null }): Promise<WorkPost | null> {
    let art: string | undefined;
    if (p.art) { const id = await this.upload(await shrinkImage(p.art, 2000, 0.88), 'art'); if (!id) return null; art = id; }
    const body = { caption: p.caption, head: p.head, ...(p.line ? { line: p.line } : {}), tone: p.tone, ...(art ? { art } : {}) };
    const post = p.id ? await this.ask(r => r.actOnPost(p.id as string, { version: body }))
      : await this.ask(r => r.addPost({ ...body, platform: p.platform, kind: p.kind, slot: p.slot, ...(p.decideBy ? { decideBy: p.decideBy } : {}) }));
    if (post) this.upPost(post); return post;
  }
  async teamStatus(id: string, status: 'planned' | 'live'): Promise<WorkPost | null> {
    const p = await this.ask(r => r.actOnPost(id, { status })); if (p) this.upPost(p); return p;
  }
  /* sign out or another client: the channel closes and the book is forgotten */
  /* signing out leaves nothing behind: the copies of this client's files on the device go too */
  close(){ const slug = this.slug(); if (this.remote && slug) clearMedia(slug); this.live?.stop(); this.live = null; this.remote = null; setRemoteMedia(null); this.loadedFor = ''; this.book.set({ msgs: [], tasks: [], posts: [] }); }

  private save(){ try { localStorage.setItem(this.key(), JSON.stringify(this.book())); } catch {} }
  private put(fn: (b: WorkBook) => WorkBook){ this.book.set(fn(this.book())); this.save(); }

  msg(id?: string){ return id ? this.msgs().find(m => m.id === id) || null : null; }
  task(id?: string){ return id ? this.tasks().find(t => t.id === id) || null : null; }
  post(id?: string){ return id ? this.posts().find(p => p.id === id) || null : null; }

  /* ── chat ── */
  private say(o: Partial<Msg>): Msg {
    const me = this.me();
    const m: Msg = { id: uid('m'), at: iso(), side: 'client', by: me.name, role: me.role, seen: false, ...o };
    this.put(b => ({ ...b, msgs: [...b.msgs, m] })); return m;
  }
  async send(text: string, files: File[] = [], reply?: string): Promise<Msg | null> {
    if (!this.available()) return null;
    const t = text.trim(); if (!t && !files.length) return null;
    if (this.remote) {
      const photos: string[] = [];
      for (const f of files.slice(0, 10)) { const id = await this.upload(await shrinkImage(f), 'photo'); if (!id) return null; photos.push(id); }
      const m = await this.ask(r => r.send({ ...(t ? { text: t } : {}), ...(photos.length ? { photos } : {}), ...(reply ? { reply } : {}) }));
      if (m) this.upMsg(m); return m;
    }
    const slug = this.slug(); const photos: string[] = [];
    for (const f of files.slice(0, 10)) photos.push(await putMedia(slug, await shrinkImage(f)));
    return this.say({ ...(t ? { text: t } : {}), ...(photos.length ? { photos } : {}), ...(reply ? { reply } : {}) });
  }
  async sendVoice(blob: Blob, secs: number, reply?: string, extra: Partial<Msg> = {}): Promise<Msg | null> {
    if (!this.available() || secs < 0.5) return null;
    if (this.remote) {
      const file = await this.upload(blob, 'voice', Math.min(180, Math.round(secs * 10) / 10)); if (!file) return null;
      const m = await this.ask(r => r.send({ voice: { file, secs: Math.min(180, Math.round(secs * 10) / 10) }, ...(reply ? { reply } : {}), ...(extra.ref ? { ref: extra.ref } : {}) }));
      if (m) this.upMsg(m); return m;
    }
    const media = await putMedia(this.slug(), blob);
    return this.say({ voice: { media, secs }, ...(reply ? { reply } : {}), ...extra });
  }
  /* a comment on a task or a post is a message in the chat, drawn as a card: one record */
  async comment(ref: MsgRef, text: string): Promise<Msg | null> {
    const t = text.trim(); if (!t || !this.available()) return null;
    if (this.remote) { const m = await this.ask(r => r.send({ text: t, ref })); if (m) this.upMsg(m); return m; }
    return this.say({ text: t, ref, event: 'comment' });
  }

  /* ── tasks ── */
  /* MESSAGE TO TASK, the second tap. A client's message becomes a request For us, waiting for the team to accept it;
     the team's message becomes a task For you. The task points at the message and a card says so in the chat. */
  async makeTask(m: Msg): Promise<WorkTask | null> {
    if (!this.available()) return null;
    if (this.remote) { const t = await this.ask(r => r.addTask({ fromMsg: m.id })); if (t) { this.upTask(t); await this.after(); } return t; }
    const existing = this.tasks().find(t => t.source === m.id); if (existing) return existing;
    const t: WorkTask = { id: uid('t'), ...taskFromMsg(m, iso(), this.me().name) };
    if (t.for === 'client') t.who = this.me().name;
    this.put(b => ({ ...b, tasks: [t, ...b.tasks] }));
    this.say({ event: 'task-made', ref: { kind: 'task', id: t.id }, reply: m.id });
    return t;
  }
  async addTask(p: { title: string; for: Side; due?: string; who?: string; files?: File[] }): Promise<WorkTask | null> {
    if (!this.available()) return null;
    const title = p.title.trim(); if (!title) return null;
    if (this.remote) {
      const ids: string[] = [];
      for (const f of (p.files || []).slice(0, 10)) { const id = await this.upload(await shrinkImage(f), 'photo'); if (!id) return null; ids.push(id); }
      const t = await this.ask(r => r.addTask({ title, for: p.for, ...(p.due ? { due: p.due } : {}), ...(p.who ? { who: p.who } : {}), ...(ids.length ? { files: ids } : {}) }));
      if (t) { this.upTask(t); await this.after(); } return t;
    }
    const slug = this.slug(); const files: string[] = [];
    for (const f of (p.files || []).slice(0, 10)) files.push(await putMedia(slug, await shrinkImage(f)));
    const now = iso(), me = this.me().name;
    const t: WorkTask = { id: uid('t'), title, for: p.for, stage: 'todo', files, by: me, createdAt: now, updatedAt: now,
      ...(p.for === 'bb' ? { asked: true } : { who: p.who || me }), ...(p.due ? { due: p.due } : {}) };
    this.put(b => ({ ...b, tasks: [t, ...b.tasks] }));
    this.say({ event: 'task-made', ref: { kind: 'task', id: t.id } });
    return t;
  }
  /* the client moves its own tasks only; the team's stages are the team's */
  async moveTask(id: string, stage: TaskStage): Promise<WorkTask | null> {
    const t = this.task(id); if (!t || t.stage === stage || !canMove(t, this.me().side) || (this.me().side === 'bb' && t.for !== 'bb')) return null;
    if (this.remote) return this.teamTask(id, { stage });
    const now = iso(); const next: WorkTask = { ...t, stage, updatedAt: now, ...(stage === 'done' ? { doneAt: now } : {}) };
    if (stage !== 'done') delete next.doneAt;
    this.put(b => ({ ...b, tasks: b.tasks.map(x => x.id === id ? next : x) }));
    if (stage === 'done') this.say({ event: 'task-done', ref: { kind: 'task', id } });
    return next;
  }
  /* what the client may edit: its own tasks For you, and a request For us the team has not accepted yet */
  /* the same rule the server holds (lib/work-api.js mayEdit) */
  canEdit(t: WorkTask){ return this.isTeam() ? t.for === 'bb' && !t.asked && !t.outside : t.for === 'client' || (t.for === 'bb' && !!t.asked && t.by === this.me().name); }
  async updateTask(id: string, patch: Partial<Pick<WorkTask, 'title' | 'due' | 'who'>>): Promise<WorkTask | null> {
    const t = this.task(id); if (!t || !this.canEdit(t)) return null;
    if (this.remote) return this.teamTask(id, { ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.due !== undefined ? { due: patch.due } : {}), ...(patch.who !== undefined ? { who: patch.who } : {}) });
    const next = { ...t, ...patch, updatedAt: iso() };
    this.put(b => ({ ...b, tasks: b.tasks.map(x => x.id === id ? next : x) })); return next;
  }
  async removeTask(id: string): Promise<boolean> {
    const t = this.task(id); if (!t || !this.canEdit(t)) return false;
    if (this.remote) { const ok = (await this.ask(r => r.removeTask(id).then(() => true))) === true; if (ok) this.book.update(b => ({ ...b, tasks: b.tasks.filter(x => x.id !== id) })); return ok; }
    this.put(b => ({ ...b, tasks: b.tasks.filter(x => x.id !== id) })); return true; }

  /* ── posts ── */
  /* SILENCE IS NOT APPROVAL. Only a press of Approve by a signed in seat makes a post approved, stamped with who and when. */
  async approve(id: string): Promise<WorkPost | null> {
    const p = this.post(id); if (!p || p.status !== 'waiting' || !this.available() || this.isTeam()) return null;
    if (this.remote) { const next = await this.ask(r => r.actOnPost(id, { answer: 'approved', v: latest(p).v })); if (next) { this.upPost(next); await this.after(); } return next; }
    const me = this.me().name, now = iso();
    const next: WorkPost = { ...p, status: 'approved', approvedBy: me, approvedAt: now, updatedAt: now };
    this.put(b => ({ ...b, posts: b.posts.map(x => x.id === id ? next : x) }));
    this.say({ event: 'approved', ref: { kind: 'post', id } });
    return next;
  }
  /* a change is a REQUEST against one version, so the version and the approval stay true; the client never edits the caption */
  async askChange(id: string, text: string, voice?: { blob: Blob; secs: number }){
    const p = this.post(id); if (!p || p.status !== 'waiting' || !this.available() || this.isTeam()) return null;
    const t = text.trim(); if (!t && !voice) return null;
    if (this.remote) {
      let file = ''; const secs = voice ? Math.min(180, Math.round(voice.secs * 10) / 10) : 0;
      if (voice) { const id = await this.upload(voice.blob, 'voice', secs); if (!id) return null; file = id; }
      const next = await this.ask(r => r.actOnPost(id, { answer: 'change', v: latest(p).v, ...(t ? { text: t } : {}), ...(voice ? { voice: { file, secs } } : {}) }));
      if (next) { this.upPost(next); await this.after(); } return next;
    }
    const v = latest(p).v, me = this.me().name, now = iso();
    let media = ''; if (voice) media = await putMedia(this.slug(), voice.blob);
    const change = { at: now, by: me, v, ...(t ? { text: t } : {}), ...(voice ? { voice: { media, secs: voice.secs } } : {}) };
    const next: WorkPost = { ...p, changes: [...p.changes, change], updatedAt: now };
    this.put(b => ({ ...b, posts: b.posts.map(x => x.id === id ? next : x) }));
    this.say({ event: 'change', ref: { kind: 'post', id }, ...(t ? { text: t } : {}), ...(voice ? { voice: { media, secs: voice.secs } } : {}) });
    return next;
  }
  changeAsked = changeAsked;

  /* ── the card a message carries, worked out from what it points at ── */
  card(m: Msg): BubbleCard | null {
    if (!m.ref) return null;
    if (m.ref.kind === 'task') {
      const t = this.task(m.ref.id); if (!t) return { pill: 'Task', tone: 'brand', title: 'This task was removed', line: '' };
      const due = dueOf(t);
      const line = t.for === 'client' ? ['For you', t.who, due ? 'by ' + niceDate(due) : ''].filter(Boolean).join(' · ')
        : requestState(t) === 'asked' ? 'For us · waiting for the team to accept'
        : requestState(t) === 'outside' ? (t.outside || 'Outside the package')
        : ['For us', t.who, due ? 'by ' + niceDate(due) : ''].filter(Boolean).join(' · ');
      const ev: Partial<Record<MsgEvent, [string, BubbleCard['tone']]>> = {
        'task-made': t.for === 'client' ? ['Task for you', 'blue'] : ['Asked of the team', 'amber'],
        'task-accepted': ['Accepted', 'blue'], 'task-outside': ['Outside the package', 'amber'],
        'task-late': ['New date', 'amber'], 'task-done': ['Done', 'green'], comment: ['About a task', 'brand'] };
      const [pill, tone] = (m.event && ev[m.event]) || ['Task', 'brand'];
      const late = m.event === 'task-late' && t.late ? `New date ${niceDate(t.late.newDue)} · ${t.late.reason}` : '';
      return { pill, tone, title: t.title, line: late || line };
    }
    const p = this.post(m.ref.id); if (!p) return { pill: 'Post', tone: 'brand', title: 'This post was removed', line: '' };
    const v = latest(p);
    const status = POST_STAGES.find(s => s.key === p.status)?.label || 'Post';
    const ev: Partial<Record<MsgEvent, [string, BubbleCard['tone']]>> = { approved: ['Approved', 'green'], change: ['Change asked', 'amber'], comment: ['About a post', 'brand'] };
    const tone: BubbleCard['tone'] = p.status === 'waiting' ? (changeAsked(p) ? 'blue' : 'amber') : p.status === 'planned' ? 'blue' : 'green';
    const [pill, t] = (m.event && ev[m.event]) || [p.status === 'waiting' && changeAsked(p) ? 'With the team' : status, tone];
    const asked = m.event === 'change' ? p.changes.find(c => c.at === m.at)?.v || v.v : v.v;
    return { pill, tone: t, title: v.head, line: `Version ${m.event === 'change' ? asked : v.v} · ${p.platform} · ${p.kind}` };
  }

  /* the harness and a fresh demo: wipe THIS client's workspace and its files, then seed the demo again */
  async reset(){
    const slug = this.slug(); if (!slug || this.remote) return;
    try { localStorage.removeItem(this.key()); localStorage.removeItem(WORK_SEEDED_FLAG + '_' + slug); } catch {}
    await clearMedia(slug); this.loadedFor = ''; this.init();
  }
}
