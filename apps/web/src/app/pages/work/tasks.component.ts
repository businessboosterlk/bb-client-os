import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { WorkService, todayStr } from '../../core/work.service';
import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { AskService } from '../../core/ask.service';
import { STAGES, canMove, isLate, isOverdue, needsReason, requestState, dueOf, summary } from '../../core/work';
import type { WorkTask, TaskStage, Side } from '../../core/work-models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';
import { PhotoGridComponent } from '../../ui/photo-grid.component';
import { WorkSoonComponent } from '../../ui/work-soon.component';

/* The tasks between a client and their marketing agency, Business Booster, both ways: "For you" (the client's
   to do) and "For us" (what the client asked of the agency). One switch for For you / For us, one switch for
   Board / List, both remembered on the device. Three stages only: To do, Doing, Done. The client moves only
   its own For you tasks; the agency's stages belong to the agency. A request For us is a request, not a
   promise, until the team accepts it with a person and a date, or says it is outside the package. Overdue is
   honest: the original date in red, and from the team a reason and a new date. */
@Component({
  selector: 'bb-work-tasks',
  standalone: true,
  imports: [FormsModule, DragDropModule, DrawerComponent, IconComponent, FilterBarComponent, MoreComponent, PhotoGridComponent, WorkSoonComponent],
  template: `
    @if (!work.available()) {
      <bb-work-soon what="tasks"/>
    } @else {
      <div class="ph"><div><h1 class="t-h1">Tasks</h1><p>{{ forYou() }} for you · {{ forUs() }} for us</p></div>
        <div class="ph-right">
          <div class="seg" role="group" aria-label="Whose tasks">
            <button type="button" data-act="wtask-side-client" [class.on]="side() === 'client'" [attr.aria-pressed]="side() === 'client'" (click)="setSide('client')"><span>For you</span></button>
            <button type="button" data-act="wtask-side-bb" [class.on]="side() === 'bb'" [attr.aria-pressed]="side() === 'bb'" (click)="setSide('bb')"><span>For us</span></button>
          </div>
          <div class="seg" role="group" aria-label="View">
            <button type="button" data-act="wtask-view-board" [class.on]="view() === 'board'" [attr.aria-pressed]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/><span>Board</span></button>
            <button type="button" data-act="wtask-view-list" [class.on]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/><span>List</span></button>
          </div>
          <button class="btn" type="button" data-act="wtask-new" (click)="adding.set(true)"><bb-icon name="plus"/><span>New task</span></button>
        </div></div>

      <bb-filter-bar [state]="f" [query]="q" [defs]="defs" placeholder="Search tasks" label="Search tasks"
        [count]="rows().length" noun="task" nouns="tasks" store="work-tasks"/>

      @if (side() === 'bb') {
        <p class="t-small">Asked means waiting for the team to accept it with a person and a date. The team moves its own tasks.</p>
      }

      @if (view() === 'board') {
        <div class="board" cdkDropListGroup>
          @for (col of columns(); track col.key) {
            <section class="col" [attr.aria-label]="col.label">
              <div class="col-h">
                <span class="col-t">{{ col.label }}</span>
                <span class="col-n">{{ col.tasks.length }}</span>
              </div>
              <div class="col-b" cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)">
                @for (t of col.tasks.slice(0, colShown()[col.key] || 15); track t.id) {
                  <button type="button" class="dc" data-act="wtask-open" cdkDrag [cdkDragData]="t" [cdkDragDisabled]="!canMove(t, 'client')" [cdkDragStartDelay]="touch ? 220 : 0" (click)="open(t)">
                    <strong>{{ t.title }}</strong>
                    <span class="dc-sub">{{ meta(t) }}</span>
                    <span class="dc-meta">
                      @if (requestState(t) === 'asked') { <span class="pill quoted">Asked</span> }
                      @if (requestState(t) === 'outside') { <span class="pill quoted">Outside the package</span> }
                      @if (isLate(t, todayStr())) { <span class="pill over">Late</span> }
                      @if (t.files.length) { <span class="clip"><bb-icon name="clip"/><span>{{ t.files.length }}</span></span> }
                      @if (t.source) { <bb-icon name="chat" aria-label="From the chat"/> }
                    </span>
                  </button>
                } @empty { <div class="col-empty">Nothing here</div> }
                @if (col.tasks.length > (colShown()[col.key] || 15)) { <button type="button" class="btn ghost sm col-more" data-act="wtask-column-more" (click)="colMore(col.key)">Show 15 more of {{ col.tasks.length }}</button> }
              </div>
            </section>
          }
        </div>
      } @else {
        <div class="card list">
          @for (t of rows().slice(0, shown()); track t.id) {
            <div class="li">
              @if (t.for === 'client') {
                <button class="tick" type="button" data-act="wtask-tick" [class.on]="t.stage === 'done'" (click)="tick(t)" [attr.aria-pressed]="t.stage === 'done'" [attr.aria-label]="(t.stage === 'done' ? 'Mark not done: ' : 'Mark done: ') + t.title"><span class="box"><bb-icon name="check"/></span></button>
              }
              <button type="button" class="tx" data-act="wtask-open" (click)="open(t)"><strong>{{ t.title }}</strong><span>{{ meta(t) }}</span></button>
              @if (isLate(t, todayStr())) { <span class="pill over">Late</span> }
              @else if (requestState(t) === 'asked') { <span class="pill quoted">Asked</span> }
              @else if (requestState(t) === 'outside') { <span class="pill quoted">Outside</span> }
              @else { <span class="pill" [class.won]="t.stage === 'done'" [class.new]="t.stage === 'doing'">{{ stageLabel(t.stage) }}</span> }
            </div>
          } @empty { <div class="empty"><strong>{{ filtered() ? 'No match' : 'Nothing here' }}</strong>{{ filtered() ? 'Try another word or clear the filters.' : 'Add a task and it lands here.' }}</div> }
          <bb-more [total]="rows().length" [shown]="min(shown(), rows().length)" (more)="shown.set(shown() + 30)"/>
        </div>
      }

      <bb-drawer [open]="!!sel()" [title]="sel()?.title || ''" [editable]="!!sel() && work.canEdit(sel()!) && !editing()" [message]="editing() ? emsg() : ''" (edit)="beginEdit()" (closed)="closeSheet()">
        <ng-template #body>
        @if (sel(); as t) {
          @if (editing()) {
            <div class="form-grid">
              <div class="field span"><label for="wt-e-title">What needs doing</label><input id="wt-e-title" type="text" [(ngModel)]="ed.title" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!emsg()"></div>
              <div class="field"><label for="wt-e-due">By when</label><input id="wt-e-due" type="date" [class.empty]="!ed.due" [(ngModel)]="ed.due"></div>
              @if (t.for === 'client') {
                <div class="field"><label for="wt-e-who">Who</label><select id="wt-e-who" [(ngModel)]="ed.who"><option value="">Anyone</option>@for (u of seats(); track u) { <option [value]="u">{{ u }}</option> }</select></div>
              }
            </div>
          } @else {
            <div class="sheet-pills">
              <span class="pill" [class.won]="t.stage === 'done'" [class.new]="t.stage === 'doing'">{{ stageLabel(t.stage) }}</span>
              @if (requestState(t) === 'asked') { <span class="pill quoted">Asked</span> }
              @if (requestState(t) === 'outside') { <span class="pill quoted">Outside the package</span> }
              @if (isLate(t, todayStr())) { <span class="pill over">Late</span> }
            </div>
            @if (requestState(t) === 'asked') {
              <div class="card note">Asked. Waiting for the team to accept it with a person and a date.</div>
            }
            @if (requestState(t) === 'outside' && t.outside) {
              <div class="card note">Outside the package. {{ t.outside }}</div>
            }
            @if (t.late) {
              <div class="card note">Late. {{ t.late.reason }} New date {{ niceDate(t.late.newDue) }}.</div>
            }
            @if (needsReason(t, todayStr())) {
              <div class="card note">Late. The team owes you a reason and a new date.</div>
            }
            <dl class="facts">
              <div class="f"><dt>Who has it</dt><dd [class.none]="!t.who">{{ t.who || 'Nobody yet' }}</dd></div>
              <div class="f"><dt>Due</dt><dd [class.none]="!dueOf(t)">@if (t.late) { {{ niceDate(t.late.newDue) }} <span class="was">· was {{ niceDate(t.due || t.late.newDue) }}</span> } @else { {{ dueOf(t) ? niceDate(dueOf(t)!) : 'No date' }} }</dd></div>
              <div class="f"><dt>Stage</dt><dd>{{ stageLabel(t.stage) }}</dd></div>
              <div class="f span"><dt>Files</dt><dd>@if (t.files.length) { <span class="f"><bb-photo-grid [slug]="work.slug()" [ids]="t.files"/></span> } @else { None }</dd></div>
              <div class="f span"><dt>From</dt><dd>@if (t.source) { {{ summary(work.msg(t.source)!) }} <button type="button" class="btn ghost sm" data-act="wtask-source" (click)="openSource(t)">Open in the chat</button> } @else { Added here }</dd></div>
              <div class="f span"><dt>Made by</dt><dd>{{ t.by }} · {{ niceDate(t.createdAt) }}</dd></div>
            </dl>
            <div class="say"><input id="wt-say" type="text" placeholder="Add a comment" aria-label="Say something about this task" [(ngModel)]="say" enterkeyhint="send"><button type="button" class="btn soft" data-act="wtask-comment" (click)="comment(t)">Send</button></div>
          }
        }
        </ng-template>
        <ng-template #foot>@if (sel(); as t) {
          @if (editing()) {
            <button class="btn" type="button" data-act="wtask-save" (click)="saveEdit(t)">Save changes</button>
            <button class="btn quiet" type="button" data-act="wtask-edit-cancel" (click)="cancelEdit()">Cancel</button>
          } @else if (t.for === 'client') {
            @if (t.stage === 'todo') {
              <button class="btn" type="button" data-act="wtask-start" (click)="moveTo(t, 'doing', 'Started')">Start</button>
              <button class="btn ghost" type="button" data-act="wtask-done" (click)="moveTo(t, 'done', 'Done')">Mark done</button>
            } @else if (t.stage === 'doing') {
              <button class="btn" type="button" data-act="wtask-done" (click)="moveTo(t, 'done', 'Done')">Mark done</button>
              <button class="btn ghost" type="button" data-act="wtask-undo" (click)="moveTo(t, 'todo', 'Back to To do')">Back to To do</button>
            } @else {
              <button class="btn" type="button" data-act="wtask-undo" (click)="moveTo(t, 'todo', 'Back to To do')">Back to To do</button>
            }
            @if (work.canEdit(t)) {
              <button class="btn quiet warn" type="button" data-act="wtask-remove" (click)="remove(t)">Remove</button>
            }
          } @else {
            @if (requestState(t) === 'asked' && work.canEdit(t)) {
              <button class="btn quiet warn" type="button" data-act="wtask-remove" (click)="withdraw(t)">Withdraw the request</button>
            }
            <button class="btn quiet" type="button" data-act="wtask-close" (click)="closeSheet()">Close</button>
          }
        }</ng-template>
      </bb-drawer>

      <bb-drawer [open]="adding()" title="New task" [message]="msg()" (closed)="adding.set(false)">
        <ng-template #body>
          <div class="form-grid">
            <div class="field span"><label for="wt-title">What needs doing</label><input id="wt-title" type="text" [(ngModel)]="draft.title" placeholder="Send the price list" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!msg()"></div>
            <div class="field span"><label>For</label>
              <div class="seg" role="group" aria-label="For">
                <button type="button" data-act="wtask-add-side-client" [class.on]="draft.for === 'client'" [attr.aria-pressed]="draft.for === 'client'" (click)="draft.for = 'client'"><span>For you</span></button>
                <button type="button" data-act="wtask-add-side-bb" [class.on]="draft.for === 'bb'" [attr.aria-pressed]="draft.for === 'bb'" (click)="draft.for = 'bb'"><span>For us</span></button>
              </div>
            </div>
            <div class="field"><label for="wt-due">By when</label><input id="wt-due" type="date" [class.empty]="!draft.due" [(ngModel)]="draft.due"></div>
            @if (draft.for === 'client') {
              <div class="field"><label for="wt-who">Who</label><select id="wt-who" [(ngModel)]="draft.who"><option value="">Anyone</option>@for (u of seats(); track u) { <option [value]="u">{{ u }}</option> }</select></div>
            }
          </div>
          @if (draft.for === 'bb') {
            <p class="t-small">The team will accept it with a person and a date, or tell you if it is outside your package.</p>
          }
          <label class="btn ghost sm" data-act="wtask-add-photo"><bb-icon name="camera"/><span>{{ draft.files.length ? draft.files.length + (draft.files.length === 1 ? ' photo added' : ' photos added') : 'Add photos' }}</span><input type="file" accept="image/*" multiple class="sr-only" aria-label="Add photos" (change)="onFiles($event)"></label>
        </ng-template>
        <ng-template #foot>
          <button class="btn" type="button" data-act="wtask-add" (click)="save()">Add task</button>
          <button class="btn quiet" type="button" data-act="wtask-add-cancel" (click)="adding.set(false)">Cancel</button>
        </ng-template>
      </bb-drawer>
    }`,
  styles: [`
    .t-small{margin:0 0 12px;color:var(--muted)}
    .note{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:12px;margin:12px 0;font-size:13.5px;color:var(--ink-2)}
    .was{color:var(--red)}
    .clip{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:12px}
    .clip bb-icon{--ico:14px}
    .dc-meta bb-icon{--ico:14px;color:var(--muted)}
    .say{display:flex;gap:8px;margin-top:14px}
    .say input{min-height:44px;flex:1;border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;background:var(--surface);font-size:15px;color:var(--ink)}
    @media (pointer:coarse){.say input{font-size:16px}}
    .say input:focus{outline:none;border-color:var(--brand)}
    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .tick{width:44px;height:44px;margin:-6px -8px -6px -10px;border:0;background:none;display:grid;place-items:center;flex-shrink:0;border-radius:12px}
    .tick .box{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line-2);display:grid;place-items:center;color:var(--on-accent);transition:background 120ms var(--ease),border-color 120ms var(--ease)}
    .tick bb-icon{--ico:15px;opacity:0}.tick.on .box{background:var(--brand);border-color:var(--brand)}.tick.on bb-icon{opacity:1}
    .li .tx{border:0;background:none;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;min-height:40px;display:flex;flex-direction:column;justify-content:center}
    .pill.new{background:var(--blue-soft);color:var(--blue);border-color:transparent}
    .pill.over{background:var(--red-soft);color:var(--red);border-color:transparent}
    .pill.quoted{background:var(--amber-soft);color:var(--amber);border-color:transparent}
    .pill.won{background:var(--green-soft);color:var(--green);border-color:transparent}
    @media (hover:hover){.tick:hover .box{border-color:var(--brand)}}
    @media (prefers-reduced-motion:reduce){.tick .box{transition:none}}`]
})
export class WorkTasksComponent implements OnInit, OnDestroy {
  work = inject(WorkService); cast = inject(CastService); data = inject(DataService); private ask = inject(AskService); private route = inject(ActivatedRoute); private router = inject(Router);
  niceDate = niceDate; todayStr = todayStr; min = Math.min; canMove = canMove; isLate = isLate; requestState = requestState; dueOf = dueOf; summary = summary; needsReason = needsReason;
  touch = matchMedia('(pointer:coarse)').matches;
  side = signal<Side>('client'); view = signal<'board' | 'list'>('board');
  q = signal(''); f = signal<Record<string, string>>({}); shown = signal(WINDOW); colShown = signal<Record<string, number>>({});
  adding = signal(false); sel = signal<WorkTask | null>(null); editing = signal(false);
  msg = signal(''); emsg = signal(''); say = signal('');
  draft = { title: '', for: 'client' as Side, due: '', who: '', files: [] as File[] };
  ed = { title: '', due: '', who: '' };
  defs: FilterDef[] = [{ key: 'show', label: 'Show', all: 'Open tasks', options: [{ value: 'late', label: 'Late' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'Every task' }] }];
  private qs?: { unsubscribe(): void };
  constructor(){
    effect(() => { this.q(); this.f(); this.view(); this.shown.set(WINDOW); this.colShown.set({}); });
  }
  ngOnInit(){
    try { const v = localStorage.getItem('hub_work_tasks_for'); if (v === 'client' || v === 'bb') this.side.set(v); } catch {}
    try { const v = localStorage.getItem('hub_work_tasks_view'); if (v === 'board' || v === 'list') this.view.set(v); } catch {}
    this.qs = this.route.queryParams.subscribe(p => this.spend(p));
  }
  /* AN ADDRESS THAT CARRIES AN ORDER IS SPENT ONCE. "for", "view", "open" and "add" in the address are
     taken out of it before they are acted on, so a reload or a step Back never opens the same sheet twice. */
  private async spend(p: Params){
    if (!p['for'] && !p['view'] && !p['open'] && !p['add']) return;
    await this.router.navigate([], { relativeTo: this.route, queryParams: { for: null, view: null, open: null, add: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (p['for'] === 'client' || p['for'] === 'bb') this.setSide(p['for']);
    if (p['view'] === 'board' || p['view'] === 'list') this.setView(p['view']);
    if (p['open']) { const t = this.work.tasks().find(x => x.id === p['open']); if (t) this.open(t); }
    if (p['add']) this.adding.set(true);
  }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  setSide(s: Side){ this.side.set(s); try { localStorage.setItem('hub_work_tasks_for', s); } catch {} }
  setView(v: 'board' | 'list'){ this.view.set(v); try { localStorage.setItem('hub_work_tasks_view', v); } catch {} }
  seats = computed(() => (this.cast.cast()?.users || []).map(u => u.name));
  forYou = computed(() => this.work.tasks().filter(t => t.for === 'client' && t.stage !== 'done').length);
  forUs = computed(() => this.work.tasks().filter(t => t.for === 'bb' && t.stage !== 'done').length);
  filtered = computed(() => !!this.q().trim() || Object.values(this.f()).some(Boolean));
  rows = computed(() => { const f = this.f(), s = f['show'] || 'open', q = this.q().trim().toLowerCase(), t = this.todayStr();
    return this.work.tasks().filter(x => x.for === this.side() && (s === 'all' || (s === 'open' ? x.stage !== 'done' : s === 'done' ? x.stage === 'done' : isLate(x, t)))
      && (!q || [x.title, x.who || ''].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (a.stage === 'done' ? 1 : 0) - (b.stage === 'done' ? 1 : 0) || (dueOf(a) || '9999').localeCompare(dueOf(b) || '9999')); });
  columns = computed(() => STAGES.map(s => ({ key: s.key, label: s.label, tasks: this.work.tasks().filter(t => t.for === this.side() && t.stage === s.key && (!this.q().trim() || [t.title, t.who || ''].join(' ').toLowerCase().includes(this.q().trim().toLowerCase()))) })));
  colMore(k: string){ this.colShown.set({ ...this.colShown(), [k]: (this.colShown()[k] || 15) + 15 }); }
  stageLabel(k: TaskStage){ return STAGES.find(s => s.key === k)?.label || k; }
  meta(t: WorkTask){ const parts: string[] = [];
    if (t.for === 'bb' && !t.who) parts.push('Nobody yet'); else if (t.who) parts.push(t.who);
    if (t.late) parts.push('New date ' + niceDate(t.late.newDue)); else if (t.due) parts.push('By ' + niceDate(t.due));
    if (t.stage === 'done') parts.push('Done ' + niceDate(t.doneAt || t.updatedAt));
    return parts.join(' · ') || 'No date';
  }
  async drop(ev: CdkDragDrop<TaskStage>){ const t: WorkTask = ev.item.data; const to = ev.container.data; if (t.stage === to) return;
    if (!canMove(t, 'client')) { this.data.toast('The team moves its own tasks. Ask in the chat if something should change.'); return; }
    const r = this.work.moveTask(t.id, to); if (r) this.data.toast('Moved to ' + this.stageLabel(to)); }
  open(t: WorkTask){ if (t.for !== this.side()) this.setSide(t.for); this.sel.set(t); this.editing.set(false); this.emsg.set(''); this.say.set(''); }
  closeSheet(){ this.sel.set(null); this.editing.set(false); }
  beginEdit(){ const t = this.sel(); if (!t) return; this.ed = { title: t.title, due: t.due || '', who: t.who || '' }; this.emsg.set(''); this.editing.set(true); }
  cancelEdit(){ this.editing.set(false); this.emsg.set(''); }
  saveEdit(t: WorkTask){
    const title = this.ed.title.trim(); if (!title) { this.emsg.set('A task needs its words. Put them back to save.'); return; }
    const r = this.work.updateTask(t.id, { title, due: this.ed.due || undefined, who: this.ed.who || undefined }); if (r) this.sel.set(r);
    this.editing.set(false); this.data.toast('Saved');
  }
  async moveTo(t: WorkTask, to: TaskStage, toast: string){ const r = this.work.moveTask(t.id, to); if (r) { this.sel.set(r); this.data.toast(toast); this.closeSheet(); } }
  async tick(t: WorkTask){ const to = t.stage === 'done' ? 'todo' : 'done'; const r = this.work.moveTask(t.id, to); if (r) this.data.toast(to === 'done' ? 'Done' : 'Back to To do'); }
  async remove(t: WorkTask){
    if (!(await this.ask.confirm({ title: 'Remove this task?', body: t.title, yes: 'Remove', danger: true }))) return;
    this.work.removeTask(t.id); this.closeSheet(); this.data.toast('Task removed');
  }
  async withdraw(t: WorkTask){
    if (!(await this.ask.confirm({ title: 'Withdraw this request?', body: t.title, yes: 'Withdraw', danger: true }))) return;
    this.work.removeTask(t.id); this.closeSheet(); this.data.toast('Request withdrawn');
  }
  comment(t: WorkTask){ const text = this.say().trim(); if (!text) return; this.work.comment({ kind: 'task', id: t.id }, text); this.say.set(''); this.data.toast('Sent to the chat'); }
  openSource(t: WorkTask){ if (!t.source) return; this.router.navigate(['/chat'], { queryParams: { msg: t.source } }); }
  /* hand fix, Claude: the part kept the file NAMES, so no photo ever reached the task */
  onFiles(ev: Event){ const el = ev.target as HTMLInputElement; if (el.files) this.draft.files = [...this.draft.files, ...Array.from(el.files)].slice(0, 10); el.value = ''; }
  async save(){
    const title = this.draft.title.trim(); if (!title) { this.msg.set('Write what needs doing first.'); document.getElementById('wt-title')?.focus(); return; }
    const r = await this.work.addTask({ title, for: this.draft.for, due: this.draft.due || undefined, who: this.draft.who || undefined, files: this.draft.files });
    if (r) { this.data.toast(this.draft.for === 'client' ? 'Task added' : 'Asked of the team'); this.adding.set(false); this.setSide(r.for); this.draft = { title: '', for: 'client', due: '', who: '', files: [] }; }
  }
}
