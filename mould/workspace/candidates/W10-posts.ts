import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
                    <bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()"/>
                    <strong>{{ latest(p).head }}</strong>
                    <span class="pc-meta">{{ p.platform }} · {{ niceDate(p.slot) }} at {{ clockWord(p.slot) }}</span>
                    <span class="pc-pills">
                      @if (p.status === 'waiting' && !work.changeAsked(p)) { <span class="pill quoted">Waiting for you</span> }
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
                <div class="art-wrap"><bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()"/></div>
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

      <bb-drawer [open]="!!sel()" [title]="sel() ? latest(sel()!).head : ''" [message]="msg()" (closed)="closeSheet()">
        @if (sel(); as p) {
          @if (deckNote()) { <p class="t-small">{{ deckNote() }}</p> }
          <div class="big"><bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()"/></div>
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
              <input id="wp-say" [(ngModel)]="sayText" placeholder="Say something about this post">
              <button type="button" class="btn soft sm" data-act="wpost-comment" (click)="comment(p)">Send</button>
            </div>
          }
        }
        <ng-template #foot>
          @if (sel(); as p) {
            @if (p.status === 'waiting' && !work.changeAsked(p) && !asking()) {
              <button class="btn" type="button" data-act="wpost-approve" (click)="approve()"><bb-icon name="approve"/><span>Approve</span></button>
              <button class="btn soft" type="button" data-act="wpost-change" (click)="asking.set(true)">Ask for a change</button>
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
    }
  `,
  styles: [`
    .ph{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .ph h1{margin:0 0 2px}
    .ph p{margin:0;color:var(--muted);font-size:13px}
    .ph-right{display:flex;gap:8px;align-items:center;flex-shrink:0}
    .seg{display:inline-flex;background:var(--surface-2);border-radius:999px;padding:3px;gap:2px}
    .seg button{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:none;color:var(--muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background var(--dur) var(--ease),color var(--dur) var(--ease)}
    .seg button.on{background:var(--surface);color:var(--ink)}
    @media (hover:hover){.seg button:hover{color:var(--ink)}}
    .board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start}
    @media (max-width:1100px){.board{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media (max-width:640px){.board{grid-template-columns:1fr}}
    .col{background:var(--surface-2);border-radius:var(--r);padding:10px;min-width:0}
    .col-h{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 10px}
    .col-t{font-size:13px;font-weight:700;color:var(--ink)}
    .col-n{font-size:12px;font-weight:600;color:var(--muted)}
    .col-b{display:flex;flex-direction:column;gap:0}
    .pc{display:grid;gap:8px;padding:10px;text-align:left;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);margin-bottom:8px;cursor:pointer;font:inherit;color:inherit;transition:border-color var(--dur) var(--ease)}
    @media (hover:hover){.pc:hover{border-color:var(--brand)}}
    .pc strong{font-size:13.5px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .pc-meta{font-size:12px;color:var(--muted)}
    .pc-pills{display:flex;gap:6px;flex-wrap:wrap}
    .col-empty{padding:20px 8px;text-align:center;color:var(--muted);font-size:13px}
    .col-more{width:100%;justify-content:center}
    .list{display:flex;flex-direction:column}
    .li{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--line)}
    .li:last-child{border-bottom:0}
    .art-wrap{width:56px;flex:none}
    .tx{flex:1;min-width:0;text-align:left;background:none;border:0;padding:0;cursor:pointer;font:inherit;color:inherit}
    .tx strong{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tx span{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .empty{padding:40px 20px;text-align:center;color:var(--muted)}
    .empty strong{display:block;font-size:15px;color:var(--ink);margin-bottom:4px}
    .big{max-width:360px;margin:0 auto 12px}
    .sheet-pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .slot{font-size:14px;font-weight:600;color:var(--ink);margin:0 0 14px}
    .slot.missed{color:var(--red)}
    section.cap,section.hist{margin-bottom:14px}
    h4{font-size:13px;font-weight:600;color:var(--muted);margin:0 0 6px}
    .cap p{white-space:pre-wrap;margin:0;font-size:14px;line-height:1.5}
    .hist-v{margin-bottom:10px}
    .hist-v strong{display:block;font-size:13px;margin-bottom:4px}
    .hist-c{font-size:13px;color:var(--ink-2);margin-bottom:4px}
    .hist-c span{display:block;margin-bottom:4px}
    .field{margin-bottom:12px}
    .field label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px}
    textarea{width:100%;min-height:80px;padding:10px 12px;border:1px solid var(--line-2);border-radius:var(--r-s);background:var(--surface);color:var(--ink);font:inherit;font-size:14px;resize:vertical}
    @media (pointer:coarse){textarea{font-size:16px}}
    textarea:focus{outline:none;border-color:var(--brand)}
    .voice-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--ink-2);margin-bottom:12px}
    .rec-dot{width:10px;height:10px;border-radius:50%;background:var(--red);flex:none}
    .say-row{display:flex;gap:8px;align-items:center;margin-top:12px}
    .say-row input{flex:1;min-width:0;min-height:40px;padding:0 12px;border:1px solid var(--line-2);border-radius:var(--r-s);background:var(--surface);color:var(--ink);font:inherit;font-size:14px}
    .say-row input:focus{outline:none;border-color:var(--brand)}
    .t-small{font-size:12px;color:var(--muted);margin:0 0 10px}
  `]
})
export class WorkPostsComponent implements OnInit, OnDestroy {
  work = inject(WorkService); cast = inject(CastService); data = inject(DataService);
  private route = inject(ActivatedRoute); router = inject(Router);
  min = Math.min; niceDate = niceDate; clockWord = clockWord; voiceTime = voiceTime;
  VoiceRecorder = VoiceRecorder;
  view = signal<'board' | 'list'>('board');
  q = signal(''); f = signal<Record<string, string>>({});
  shown = signal(WINDOW); colShown = signal<Record<string, number>>({});
  sel = signal<WorkPost | null>(null); asking = signal(false); changeText = signal('');
  rec = signal(false); recSecs = signal(0); voice = signal<{ blob: Blob; secs: number } | null>(null);
  busy = signal(false); deckNote = signal(''); msg = signal(''); sayText = signal('');
  private recTimer: any = null; private recorder: any = null;
  private qs: any;

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

  private async spend(p: any) {
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
      label: s.label,
      posts: this.base().filter(p => p.status === s.key).sort((a, b) => {
        if (s.key === 'live') return b.slot.localeCompare(a.slot);
        return a.slot.localeCompare(b.slot);
      })
    }));
  });

  colMore(k: string) { this.colShown.set({ ...this.colShown(), [k]: (this.colShown()[k] || 15) + 15 }); }

  statusLabel(s: PostStatus) { return POST_STAGES.find(x => x.key === s)?.label || s; }
  statusPill(s: PostStatus) { return s === 'waiting' ? 'quoted' : s === 'planned' ? 'new' : 'won'; }

  open(p: WorkPost) { this.sel.set(p); this.asking.set(false); this.changeText.set(''); this.voice.set(null); this.deckNote.set(''); this.msg.set(''); }

  changesFor(p: WorkPost, v: number) { return p.changes.filter(c => c.v === v); }

  async approve() {
    const p = this.sel(); if (!p || this.busy()) return;
    this.busy.set(true);
    try {
      const next = this.work.approve(p.id);
      if (next) this.data.toast('Approved. It goes out as planned.');
      this.deck();
    } finally { this.busy.set(false); }
  }

  async sendChange() {
    const p = this.sel(); if (!p || this.busy()) return;
    if (!this.changeText().trim() && !this.voice()) { this.msg.set('Write what should change, or record a voice note.'); return; }
    this.busy.set(true);
    try {
      await this.work.askChange(p.id, this.changeText().trim(), this.voice() || undefined);
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
      this.recorder = await VoiceRecorder.start();
      this.rec.set(true); this.recSecs.set(0);
      this.recTimer = setInterval(() => this.recSecs.set(this.recorder.elapsed()), 250);
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

  comment(p: WorkPost) {
    if (!this.sayText().trim()) return;
    this.work.comment({ kind: 'post', id: p.id }, this.sayText().trim());
    this.sayText.set(''); this.data.toast('Sent to the chat');
  }
}
