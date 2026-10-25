import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WorkService } from '../../core/work.service';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { POST_STAGES, latest, slotLine, deckNext, clockWord, voiceTime } from '../../core/work';
import { VoiceRecorder } from '../../core/media';
import type { WorkPost, PostStatus } from '../../core/work-models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';
import { PostArtComponent } from '../../ui/post-art.component';
import { VoiceNoteComponent } from '../../ui/voice-note.component';
import { WorkSoonComponent } from '../../ui/work-soon.component';

@Component({
  selector: 'bb-work-posts',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent, FilterBarComponent, MoreComponent, PostArtComponent, VoiceNoteComponent, WorkSoonComponent],
  template: `
    @if (!work.available()) {
      <bb-work-soon what="posts"/>
    } @else {
      <div class="ph">
        <div>
          <h1 class="t-h1">Posts</h1>
          <p>{{ waitingLine() }}</p>
        </div>
        <div class="ph-right">
          <div class="seg" role="group" aria-label="View">
            <button type="button" data-act="wpost-view-board" [class.on]="view() === 'board'" [attr.aria-pressed]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/><span>Board</span></button>
            <button type="button" data-act="wpost-view-list" [class.on]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/><span>List</span></button>
          </div>
          @if (work.isTeam()) {
            <button class="btn" type="button" data-act="wpost-new" (click)="formOpen(null)"><bb-icon name="plus"/><span>New post</span></button>
          }
        </div>
      </div>

      <bb-filter-bar [state]="f" [query]="q" [defs]="defs()" placeholder="Search posts" label="Search posts"
        [count]="rows().length" noun="post" nouns="posts" store="work-posts"/>

      @if (view() === 'board') {
        <div class="board">
          @for (col of columns(); track col.key) {
            <section class="col" [attr.aria-label]="col.label">
              <div class="col-h">
                <span class="col-t">{{ col.label }}</span>
                <span class="col-n">{{ col.posts.length }}</span>
              </div>
              <div class="col-b">
                @for (p of col.posts.slice(0, colShown()[col.key] || 15); track p.id) {
                  <button type="button" class="pc" data-act="wpost-open" (click)="open(p)">
                    <bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()" [slug]="work.slug()"/>
                    <strong>{{ latest(p).head }}</strong>
                    <span class="pc-meta">{{ p.platform }} · {{ niceDate(p.slot) }} at {{ clockWord(p.slot) }}</span>
                    <span class="pc-pills">
                      @if (p.status === 'waiting' && !work.changeAsked(p)) { <span class="pill quoted">{{ work.isTeam() ? 'Waiting for the client' : 'Waiting for you' }}</span> }
                      @if (work.changeAsked(p)) { <span class="pill new">With the team</span> }
                      @if (latest(p).v > 1) { <span class="pill">Version {{ latest(p).v }}</span> }
                    </span>
                  </button>
                } @empty { <div class="col-empty">Nothing here</div> }
                @if (col.posts.length > (colShown()[col.key] || 15)) {
                  <button type="button" class="btn ghost sm col-more" data-act="wpost-column-more" (click)="colMore(col.key)">Show 15 more of {{ col.posts.length }}</button>
                }
              </div>
            </section>
          }
        </div>
      } @else {
        <div class="card">
          <div class="list">
            @for (p of rows().slice(0, shown()); track p.id) {
              <div class="li">
                <div class="art-wrap"><bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()" [slug]="work.slug()"/></div>
                <button type="button" class="tx" data-act="wpost-open" (click)="open(p)">
                  <strong>{{ latest(p).head }}</strong>
                  <span>{{ p.platform }} · {{ p.kind }} · {{ niceDate(p.slot) }}</span>
                </button>
                <span class="pill" [class]="statusPill(p.status)">{{ statusLabel(p.status) }}</span>
              </div>
            } @empty {
              <div class="empty"><strong>{{ filtered() ? 'No match' : 'Nothing here yet' }}</strong>{{ filtered() ? 'Try another name or clear the filters.' : 'Your posts will land here.' }}</div>
            }
          </div>
          <bb-more [total]="rows().length" [shown]="min(shown(), rows().length)" (more)="shown.set(shown() + 30)"/>
        </div>
      }

      <bb-drawer [open]="!!sel()" [title]="sel() ? latest(sel()!).head : ''" [message]="msg() || (sel() && work.changeAsked(sel()!) ? 'Your change is with the team. The new version comes back here.' : '')" (closed)="closeSheet()">
        <ng-template #body>
        @if (sel(); as p) {
          @if (deckNote()) { <p class="t-small">{{ deckNote() }}</p> }
          <div class="big"><bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()" [slug]="work.slug()"/></div>
          <div class="sheet-pills">
            <span class="pill" [class]="statusPill(p.status)">{{ statusLabel(p.status) }}</span>
            <span class="pill">Version {{ latest(p).v }}</span>
            <span class="pill">{{ p.platform }}</span>
          </div>
          <p class="slot" [class.missed]="slotLine(p, work.now()).startsWith('The ')">{{ slotLine(p, work.now()) }}</p>
          <section class="cap">
            <h4>Caption</h4>
            <p>{{ latest(p).caption }}</p>
          </section>
          @if (p.versions.length > 1 || p.changes.length) {
            <section class="hist">
              <h4>History</h4>
              @for (v of p.versions.slice().reverse(); track v.v) {
                <div class="hist-v">
                  <strong>Version {{ v.v }} · {{ niceDate(v.at) }}</strong>
                  @for (c of changesFor(p, v.v); track c.at) {
                    <div class="hist-c">
                      <span>{{ c.by }} asked: {{ c.text || 'sent a voice note' }}</span>
                      @if (c.voice) { <bb-voice-note [slug]="work.slug()" [media]="c.voice.media" [secs]="c.voice.secs"/> }
                    </div>
                  }
                </div>
              }
            </section>
          }
          @if (p.status === 'live') {
            <button type="button" class="btn ghost sm" data-act="wpost-library" (click)="router.navigate(['/library/posts'])">See it in your Library</button>
          }
          @if (p.status === 'approved' && p.approvedBy) {
            <p class="t-small">Approved by {{ p.approvedBy }} on {{ niceDate(p.approvedAt || '') }}</p>
          }
          @if (asking()) {
            <div class="field">
              <label for="wp-change">What should change?</label>
              <textarea id="wp-change" rows="3" [(ngModel)]="changeText" placeholder="Make the price bigger on the first slide"></textarea>
            </div>
            <div class="voice-row">
              @if (!rec() && !voice()) {
                @if (VoiceRecorder.supported()) {
                  <button type="button" class="btn ghost sm" data-act="wpost-voice-start" (click)="startRec()"><bb-icon name="mic"/><span>Record a voice note instead</span></button>
                }
              } @else if (rec()) {
                <span class="rec-dot"></span>
                <span>{{ voiceTime(recSecs()) }} Recording</span>
                <button type="button" class="btn soft sm" data-act="wpost-voice-stop" (click)="stopRec()">Stop</button>
              } @else if (voice()) {
                <span>Voice note {{ voiceTime(voice()!.secs) }} ready</span>
                <button type="button" class="btn quiet sm" data-act="wpost-voice-clear" (click)="clearVoice()">Remove</button>
              }
            </div>
          } @else if (!work.changeAsked(p)) {
            <div class="say-row">
              <input id="wp-say" type="text" [(ngModel)]="sayText" placeholder="Add a comment" aria-label="Say something about this post" enterkeyhint="send">
              <button type="button" class="btn soft sm" data-act="wpost-comment" (click)="comment(p)">Send</button>
            </div>
          }
        }
        </ng-template>
        <ng-template #foot>
          @if (sel(); as p) {
            @if (work.isTeam()) {
              @if (p.status === 'live') {
                <button class="btn quiet" type="button" data-act="wpost-close" (click)="closeSheet()">Close</button>
              } @else {
                <button class="btn" type="button" data-act="wpost-version" (click)="formOpen(p)">New version</button>
                <div class="pair"><button class="btn ghost" type="button" data-act="wpost-live" (click)="markLive(p)">Mark live</button><button class="btn ghost" type="button" data-act="wpost-close" (click)="closeSheet()">Close</button></div>
              }
            } @else if (p.status === 'waiting' && !work.changeAsked(p) && !asking()) {
              <button class="btn" type="button" data-act="wpost-approve" (click)="approve()"><bb-icon name="approve"/><span>Approve</span></button>
              <button class="btn ghost" type="button" data-act="wpost-change" (click)="asking.set(true)">Ask for a change</button>
            } @else if (asking()) {
              <button class="btn" type="button" data-act="wpost-change-send" (click)="sendChange()">Send the change</button>
              <button class="btn quiet" type="button" data-act="wpost-change-cancel" (click)="asking.set(false)">Cancel</button>
            } @else if (work.changeAsked(p)) {
              <button class="btn quiet" type="button" data-act="wpost-close" (click)="closeSheet()">Close</button>
            } @else {
              <button class="btn quiet" type="button" data-act="wpost-close" (click)="closeSheet()">Close</button>
            }
          }
        </ng-template>
      </bb-drawer>

      <bb-drawer [open]="form()" [title]="pf.id ? 'New version' : 'New post'" [message]="formMsg()" (closed)="form.set(false)">
        <ng-template #body>
          <div class="form-grid">
            @if (!pf.id) {
              <div class="field"><label for="wp-f-plat">Platform</label><select id="wp-f-plat" [(ngModel)]="pf.platform"><option>Instagram</option><option>Facebook</option><option>TikTok</option></select></div>
              <div class="field"><label for="wp-f-kind">Kind</label><select id="wp-f-kind" [(ngModel)]="pf.kind"><option>Post</option><option>Carousel</option><option>Reel</option></select></div>
              <div class="field"><label for="wp-f-slot">Goes out</label><input id="wp-f-slot" type="datetime-local" [(ngModel)]="pf.slot"></div>
              <div class="field"><label for="wp-f-by">A yes is needed by</label><input id="wp-f-by" type="datetime-local" [(ngModel)]="pf.decideBy"></div>
            }
            <div class="field span"><label for="wp-f-head">Headline</label><input id="wp-f-head" type="text" maxlength="120" [(ngModel)]="pf.head" autocomplete="off"></div>
            <div class="field span"><label for="wp-f-cap">Caption</label><textarea id="wp-f-cap" rows="5" maxlength="2200" [(ngModel)]="pf.caption"></textarea></div>
            <div class="field span"><label for="wp-f-art">Artwork</label><input id="wp-f-art" type="file" accept="image/jpeg,image/png,image/webp" (change)="pickArt($event)"></div>
            @if (artPreview()) { <div class="field span"><img class="art-prev" [src]="artPreview()" alt="The artwork chosen"></div> }
          </div>
        </ng-template>
        <ng-template #foot>
          <button class="btn" type="button" data-act="wpost-form-save" [disabled]="busy()" (click)="formSave()">{{ pf.id ? 'Send the new version' : 'Send for a yes' }}</button>
          <button class="btn quiet" type="button" data-act="wpost-form-cancel" (click)="form.set(false)">Cancel</button>
        </ng-template>
      </bb-drawer>
    }
  `,
  styles: [`
    /* hand fix, Claude: the part restyled the app's own classes (ph, seg, board, col, li, empty, field); those come from the
       global sheet like every other screen. What is left belongs to posts only. A board card is the artwork small on the
       left and the words beside it, so a phone column shows three posts, not one. */
    .pc{display:grid;grid-template-columns:84px minmax(0,1fr);column-gap:12px;row-gap:4px;align-items:start;padding:10px;text-align:left;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);margin-bottom:8px;cursor:pointer;font:inherit;color:inherit;transition:border-color var(--dur) var(--ease)}
    .pc bb-post-art{grid-row:1 / span 3}
    @media (hover:hover){.pc:hover{border-color:var(--brand)}}
    .pc strong{font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .pc-meta{font-size:12px;color:var(--muted)}
    .pc-pills{display:flex;gap:8px 6px;flex-wrap:wrap}
    .art-wrap{width:56px;flex:none}
    /* a row's words are a button: it must say its colour, or it takes the browser's black (2 to 1 at night) */
    .li .tx{flex:1;min-width:0;min-height:44px;display:flex;flex-direction:column;justify-content:center;border:0;background:none;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer}
    .li .tx strong{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .li .tx span{display:block;font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .big{max-width:360px;margin:0 auto 12px}
    .slot{font-size:14px;font-weight:600;color:var(--ink);margin:0 0 14px}
    .slot.missed{color:var(--red)}
    section.cap,section.hist{margin-bottom:14px}
    h4{font-size:13px;font-weight:600;color:var(--muted);margin:0 0 6px}
    .cap p{white-space:pre-wrap;margin:0;font-size:14px;line-height:1.5}
    .hist-v{margin-bottom:10px}
    .hist-v strong{display:block;font-size:13px;margin-bottom:4px}
    .hist-c{font-size:13px;color:var(--ink-2);margin-bottom:4px}
    .hist-c span{display:block;margin-bottom:4px}
    .voice-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--ink-2);margin:12px 0}
    .rec-dot{width:10px;height:10px;border-radius:50%;background:var(--red);flex:none}
    .say-row{display:flex;gap:8px;align-items:center;margin-top:12px}
    .say-row input{flex:1;min-width:0;min-height:44px;padding:0 12px;border:1px solid var(--line-2);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;font-size:15px}
    @media (pointer:coarse){.say-row input{font-size:16px}}
    .say-row input:focus{outline:none;border-color:var(--brand)}
    .say-row .btn{min-height:44px}
    .art-prev{display:block;width:100%;max-width:240px;aspect-ratio:4/5;object-fit:cover;border-radius:var(--r)}
  `]
})
export class WorkPostsComponent implements OnInit, OnDestroy {
  work = inject(WorkService); cast = inject(CastService); data = inject(DataService);
  private route = inject(ActivatedRoute); router = inject(Router);
  min = Math.min; niceDate = niceDate; clockWord = clockWord; voiceTime = voiceTime; latest = latest; slotLine = slotLine;
  VoiceRecorder = VoiceRecorder;
  view = signal<'board' | 'list'>('board');
  q = signal(''); f = signal<Record<string, string>>({});
  shown = signal(WINDOW); colShown = signal<Record<string, number>>({});
  sel = signal<WorkPost | null>(null); asking = signal(false); changeText = signal('');
  rec = signal(false); recSecs = signal(0); voice = signal<{ blob: Blob; secs: number } | null>(null);
  busy = signal(false); deckNote = signal(''); msg = signal(''); sayText = signal('');
  private recTimer: ReturnType<typeof setInterval> | null = null; private recorder: VoiceRecorder | null = null;
  private qs?: { unsubscribe(): void };
  /* THE TEAM'S SIDE (Stage 2): put up a post or a new version with its artwork, then mark it live. The client alone approves. */
  form = signal(false); formMsg = signal(''); artPreview = signal('');
  pf = { id: '', platform: 'Instagram' as 'Instagram' | 'Facebook' | 'TikTok', kind: 'Post' as 'Post' | 'Carousel' | 'Reel', slot: '', decideBy: '', head: '', caption: '', art: null as File | null };
  formOpen(p: WorkPost | null){
    const v = p ? latest(p) : null;
    this.pf = { id: p?.id || '', platform: p?.platform || 'Instagram', kind: p?.kind || 'Post', slot: '', decideBy: '', head: v?.head || '', caption: v?.caption || '', art: null };
    this.artPreview.set(''); this.formMsg.set(''); this.form.set(true);
  }
  pickArt(e: Event){ const f = (e.target as HTMLInputElement).files?.[0] || null; this.pf.art = f; if (this.artPreview()) URL.revokeObjectURL(this.artPreview()); this.artPreview.set(f ? URL.createObjectURL(f) : ''); }
  async formSave(){
    const pf = this.pf;
    if (!pf.head.trim() || !pf.caption.trim()) { this.formMsg.set('A headline and a caption, please.'); return; }
    if (!pf.id && !pf.slot) { this.formMsg.set('Say when it goes out.'); return; }
    this.busy.set(true);
    try {
      const r = await this.work.teamPost({ ...(pf.id ? { id: pf.id } : {}), platform: pf.platform, kind: pf.kind, slot: pf.slot ? new Date(pf.slot).toISOString() : '',
        ...(pf.decideBy ? { decideBy: new Date(pf.decideBy).toISOString() } : {}), caption: pf.caption.trim(), head: pf.head.trim(), tone: 'brand', art: pf.art });
      if (!r) { this.formMsg.set(this.work.error() || 'That did not send. Try again.'); return; }
      this.form.set(false); this.sel.set(null); this.data.toast(pf.id ? 'New version sent to the client' : 'Sent to the client for a yes');
    } finally { this.busy.set(false); }
  }
  async markLive(p: WorkPost){ const r = await this.work.teamStatus(p.id, 'live'); if (r) { this.sel.set(r); this.data.toast('Marked live'); } else this.data.toast(this.work.error() || 'That did not save. Try again.'); }

  defs = computed<FilterDef[]>(() => [
    { key: 'show', label: 'Status', all: 'Every status', options: POST_STAGES.map(s => ({ value: s.key, label: s.label })) },
    { key: 'platform', label: 'Platform', all: 'Every platform', options: ['Instagram', 'Facebook', 'TikTok'].map(p => ({ value: p, label: p })) }
  ]);

  constructor() {
    effect(() => { this.q(); this.f(); this.view(); this.shown.set(WINDOW); this.colShown.set({}); });
  }

  ngOnInit() {
    try { const v = localStorage.getItem('hub_work_posts_view'); if (v === 'list' || v === 'board') this.view.set(v); } catch {}
    this.qs = this.route.queryParams.subscribe(p => this.spend(p));
  }

  private async spend(p: Params) {
    if (!p['open'] && !p['show'] && !p['view']) return;
    await this.router.navigate([], { relativeTo: this.route, queryParams: { open: null, show: null, view: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (p['view'] === 'board' || p['view'] === 'list') this.setView(p['view']);
    if (p['show']) this.f.set({ ...this.f(), show: p['show'] });
    if (p['open']) { const post = this.work.post(p['open']); if (post) this.sel.set(post); }
  }

  ngOnDestroy() { this.qs?.unsubscribe(); this.cancelRec(); }

  setView(v: 'board' | 'list') { this.view.set(v); try { localStorage.setItem('hub_work_posts_view', v); } catch {} }

  biz() { return this.cast.cast()?.short || this.cast.cast()?.name || ''; }

  waitingCount = computed(() => this.work.posts().filter(p => p.status === 'waiting' && !this.work.changeAsked(p)).length);
  waitingLine = computed(() => {
    const n = this.waitingCount();
    if (this.work.isTeam()) return n === 0 ? 'Nothing waiting for the client' : n === 1 ? '1 waiting for the client' : `${n} waiting for the client`;
    return n === 0 ? 'Nothing waiting for your yes' : n === 1 ? '1 waiting for your yes' : `${n} waiting for your yes`;
  });

  filtered = computed(() => !!this.q().trim() || Object.values(this.f()).some(Boolean));

  private base = computed(() => {
    const f = this.f(), q = this.q().trim().toLowerCase();
    return this.work.posts().filter(p =>
      (!f['show'] || p.status === f['show']) &&
      (!f['platform'] || p.platform === f['platform']) &&
      (!q || [latest(p).head, latest(p).caption, p.platform].join(' ').toLowerCase().includes(q))
    );
  });

  rows = computed(() => {
    const show = this.f()['show'];
    return this.base().filter(p => !show || p.status === show).sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return 1;
      if (a.status !== 'live' && b.status === 'live') return -1;
      if (a.status === 'live' && b.status === 'live') return b.slot.localeCompare(a.slot);
      return a.slot.localeCompare(b.slot);
    });
  });

  columns = computed(() => {
    const show = this.f()['show'];
    return POST_STAGES.filter(s => !show || s.key === show).map(s => ({
      key: s.key,
      label: this.statusLabel(s.key),
      posts: this.base().filter(p => p.status === s.key).sort((a, b) => {
        if (s.key === 'live') return b.slot.localeCompare(a.slot);
        return a.slot.localeCompare(b.slot);
      })
    }));
  });

  colMore(k: string) { this.colShown.set({ ...this.colShown(), [k]: (this.colShown()[k] || 15) + 15 }); }

  /* the team reads the same board from the other side: a post waiting is waiting for the client */
  statusLabel(s: PostStatus) { return s === 'waiting' && this.work.isTeam() ? 'Waiting for the client' : POST_STAGES.find(x => x.key === s)?.label || s; }
  statusPill(s: PostStatus) { return s === 'waiting' ? 'quoted' : s === 'planned' ? 'new' : 'won'; }

  open(p: WorkPost) { this.sel.set(p); this.asking.set(false); this.changeText.set(''); this.voice.set(null); this.deckNote.set(''); this.msg.set(''); }

  changesFor(p: WorkPost, v: number) { return p.changes.filter(c => c.v === v); }

  async approve() {
    const p = this.sel(); if (!p || this.busy()) return;
    this.busy.set(true);
    try {
      const next = await this.work.approve(p.id);
      if (!next) return;
      this.data.toast('Approved. It goes out as planned.');
      this.deck();
    } finally { this.busy.set(false); }
  }

  async sendChange() {
    const p = this.sel(); if (!p || this.busy()) return;
    if (!this.changeText().trim() && !this.voice()) { this.msg.set('Write what should change or record a voice note.'); return; }
    this.busy.set(true);
    try {
      if (!(await this.work.askChange(p.id, this.changeText().trim(), this.voice() || undefined))) return;
      this.data.toast('Change sent to the team');
      this.deck();
    } finally { this.busy.set(false); }
  }

  deck() {
    const p = this.sel(); if (!p) return;
    const next = deckNext(this.work.posts(), p.id);
    if (next) {
      this.asking.set(false); this.changeText.set(''); this.voice.set(null); this.rec.set(false); this.recSecs.set(0);
      this.sel.set(next); this.deckNote.set('Next post waiting for your yes.'); this.msg.set('');
    } else { this.closeSheet(); }
  }

  closeSheet() {
    this.cancelRec();
    this.sel.set(null); this.asking.set(false); this.changeText.set(''); this.voice.set(null);
    this.deckNote.set(''); this.msg.set(''); this.sayText.set('');
  }

  async startRec() {
    try {
      const r = new VoiceRecorder(); await r.start(); this.recorder = r;
      this.rec.set(true); this.recSecs.set(0);
      this.recTimer = setInterval(() => this.recSecs.set(r.elapsed()), 250);
    } catch { this.msg.set('The microphone is off for this app. Allow it in Settings to send a voice note.'); }
  }

  async stopRec() {
    if (!this.recorder) return;
    try {
      const r = await this.recorder.stop();
      this.voice.set(r); this.rec.set(false); this.recSecs.set(0);
      if (this.recTimer) { clearInterval(this.recTimer); this.recTimer = null; }
    } catch { this.msg.set('The microphone is off for this app. Allow it in Settings to send a voice note.'); }
  }

  cancelRec() {
    if (this.recTimer) { clearInterval(this.recTimer); this.recTimer = null; }
    if (this.recorder) { try { this.recorder.cancel(); } catch {} this.recorder = null; }
    this.rec.set(false); this.recSecs.set(0);
  }

  clearVoice() { this.voice.set(null); }

  async comment(p: WorkPost) {
    if (!this.sayText().trim()) return;
    if (!(await this.work.comment({ kind: 'post', id: p.id }, this.sayText().trim()))) return;
    this.sayText.set(''); this.data.toast('Sent to the chat');
  }
}
