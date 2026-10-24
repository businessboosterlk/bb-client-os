import { Injectable, signal, computed, inject } from '@angular/core';
import { CastService } from './cast.service';
import { SessionService } from './session.service';
import { WorkBook, Msg, MsgRef, MsgEvent, WorkTask, WorkPost, TaskStage, Side } from './work-models';
import { needs, needCount, taskFromMsg, canMove, latest, dueOf, requestState, POST_STAGES, changeAsked } from './work';
import { workSeed, WORK_SEEDED_FLAG } from './work-seed';
import { putMedia, shrinkImage, clearMedia } from './media';
import { niceDate } from './data.service';
import type { BubbleCard } from '../pages/work/bubble.component';

const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const iso = () => new Date().toISOString();
export function todayStr(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/* THE WORKSPACE STORE. Stage 1, the demo: the book lives in this browser (localStorage for the rows, IndexedDB for the
   photos and voice notes) and NOTHING reaches the server. In api mode, a real client, `available` is false and every
   screen says the chat is on its way and points at the WhatsApp group; no write happens. Stage 2 needs Thulaib's yes on
   the tables, a file store and a named person per seat, and a live chat that is TOLD when something arrives, never one
   that asks the database on a timer. */
@Injectable({ providedIn: 'root' })
export class WorkService {
  private castSvc = inject(CastService); private session = inject(SessionService);
  readonly book = signal<WorkBook>({ msgs: [], tasks: [], posts: [] });
  readonly ready = signal(false);
  readonly available = computed(() => !this.castSvc.apiMode() && this.castSvc.cast()?.data?.mode !== 'api');
  readonly slug = computed(() => this.castSvc.slug());
  readonly me = computed(() => { const n = this.session.user(); return { name: n, role: this.castSvc.cast()?.users.find(u => u.name === n)?.role || 'Team', side: 'client' as Side }; });
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
    const slug = this.slug(); const photos: string[] = [];
    for (const f of files.slice(0, 10)) photos.push(await putMedia(slug, await shrinkImage(f)));
    return this.say({ ...(t ? { text: t } : {}), ...(photos.length ? { photos } : {}), ...(reply ? { reply } : {}) });
  }
  async sendVoice(blob: Blob, secs: number, reply?: string, extra: Partial<Msg> = {}): Promise<Msg | null> {
    if (!this.available() || secs < 0.5) return null;
    const media = await putMedia(this.slug(), blob);
    return this.say({ voice: { media, secs }, ...(reply ? { reply } : {}), ...extra });
  }
  /* a comment on a task or a post is a message in the chat, drawn as a card: one record */
  comment(ref: MsgRef, text: string){ const t = text.trim(); if (!t || !this.available()) return null; return this.say({ text: t, ref, event: 'comment' }); }

  /* ── tasks ── */
  /* MESSAGE TO TASK, the second tap. A client's message becomes a request For us, waiting for the team to accept it;
     the team's message becomes a task For you. The task points at the message and a card says so in the chat. */
  makeTask(m: Msg): WorkTask | null {
    if (!this.available()) return null;
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
  moveTask(id: string, stage: TaskStage){
    const t = this.task(id); if (!t || t.stage === stage || !canMove(t, 'client')) return null;
    const now = iso(); const next: WorkTask = { ...t, stage, updatedAt: now, ...(stage === 'done' ? { doneAt: now } : {}) };
    if (stage !== 'done') delete next.doneAt;
    this.put(b => ({ ...b, tasks: b.tasks.map(x => x.id === id ? next : x) }));
    if (stage === 'done') this.say({ event: 'task-done', ref: { kind: 'task', id } });
    return next;
  }
  /* what the client may edit: its own tasks For you, and a request For us the team has not accepted yet */
  canEdit(t: WorkTask){ return t.for === 'client' || (t.for === 'bb' && !!t.asked && t.by === this.me().name); }
  updateTask(id: string, patch: Partial<Pick<WorkTask, 'title' | 'due' | 'who'>>){
    const t = this.task(id); if (!t || !this.canEdit(t)) return null;
    const next = { ...t, ...patch, updatedAt: iso() };
    this.put(b => ({ ...b, tasks: b.tasks.map(x => x.id === id ? next : x) })); return next;
  }
  removeTask(id: string){ const t = this.task(id); if (!t || !this.canEdit(t)) return false; this.put(b => ({ ...b, tasks: b.tasks.filter(x => x.id !== id) })); return true; }

  /* ── posts ── */
  /* SILENCE IS NOT APPROVAL. Only a press of Approve by a signed in seat makes a post approved, stamped with who and when. */
  approve(id: string){
    const p = this.post(id); if (!p || p.status !== 'waiting' || !this.available()) return null;
    const me = this.me().name, now = iso();
    const next: WorkPost = { ...p, status: 'approved', approvedBy: me, approvedAt: now, updatedAt: now };
    this.put(b => ({ ...b, posts: b.posts.map(x => x.id === id ? next : x) }));
    this.say({ event: 'approved', ref: { kind: 'post', id } });
    return next;
  }
  /* a change is a REQUEST against one version, so the version and the approval stay true; the client never edits the caption */
  async askChange(id: string, text: string, voice?: { blob: Blob; secs: number }){
    const p = this.post(id); if (!p || p.status !== 'waiting' || !this.available()) return null;
    const t = text.trim(); if (!t && !voice) return null;
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
    const slug = this.slug(); if (!slug) return;
    try { localStorage.removeItem(this.key()); localStorage.removeItem(WORK_SEEDED_FLAG + '_' + slug); } catch {}
    await clearMedia(slug); this.loadedFor = ''; this.init();
  }
}
