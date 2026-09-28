import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, today, niceDate } from '../../core/data.service';
import { DraftService } from '../../core/draft.service';
import { AskService } from '../../core/ask.service';
import { Task } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';

const BLANK = { text: '', due: '', who: '', dealId: '' };
/* The task book. What has to happen, by when, for whom. A task can hang off a deal so the
   dashboard's "needs attention" fills itself from here. Overdue first. */
@Component({
  selector: 'bb-tasks',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent, FilterBarComponent, MoreComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Tasks</h1><p>{{ sub() }}</p></div>
      <div class="ph-right"><button class="btn" type="button" data-act="task-new" (click)="openAdd()"><bb-icon name="plus"/><span>New task</span></button></div></div>
    <div class="kpi">
      <div class="card"><div class="k-label">Overdue</div><div class="k-val" [class.red]="overdue()">{{ overdue() }}</div><div class="k-sub">need doing first</div></div>
      <div class="card"><div class="k-label">Today</div><div class="k-val">{{ dueToday() }}</div><div class="k-sub">due by tonight</div></div>
      <div class="card"><div class="k-label">Open</div><div class="k-val">{{ data.openTasks().length }}</div><div class="k-sub">in the book</div></div>
      <div class="card"><div class="k-label">Done this week</div><div class="k-val up">{{ doneWeek() }}</div><div class="k-sub">ticked off</div></div>
    </div>
    <bb-filter-bar class="fbar" [state]="f" [query]="q" [defs]="defs()" placeholder="Search tasks" label="Search tasks"
      [count]="rows().length" noun="task" nouns="tasks" store="tasks"/>
    @if (data.loading()) {
      <div class="card skel" aria-busy="true" aria-label="Loading tasks"><i></i><i></i><i></i><i></i></div>
    } @else {
      <div class="card list">
        @for (t of rows().slice(0, shown()); track t.id) {
          <div class="li" [class.done]="t.done">
            <button class="tick" type="button" data-act="task-tick" [class.on]="t.done" (click)="data.toggleTask(t.id)" [attr.aria-pressed]="t.done" [attr.aria-label]="(t.done ? 'Mark not done: ' : 'Mark done: ') + t.text"><span class="box"><bb-icon name="check"/></span></button>
            <button type="button" class="tx" data-act="task-open" (click)="open(t)"><strong>{{ t.text }}</strong><span>{{ meta(t) }}</span></button>
            @if (!t.done && t.due && t.due < todayStr) { <span class="pill over">Overdue</span> }
            @else if (!t.done && t.due === todayStr) { <span class="pill quoted">Today</span> }
          </div>
        } @empty { <div class="empty"><strong>{{ filtered() ? 'No match' : 'Nothing to do' }}</strong>{{ filtered() ? 'Try another word or clear the filters.' : 'Add a task and it lands here, overdue first.' }}</div> }
        <bb-more [total]="rows().length" [shown]="min(shown(), rows().length)" (more)="shown.set(shown() + 30)"/>
      </div>
    }

    <bb-drawer [open]="adding()" title="New task" [message]="msg()" (closed)="adding.set(false)">
      <ng-template #body>
      @if (restored()) { <div class="kept"><span>Picked up where you left off.</span><button type="button" class="btn quiet sm" data-act="task-draft-clear" (click)="fresh()">Start again</button></div> }
      <div class="form-grid" (input)="keep()" (change)="keep()">
        <div class="field span"><label for="tk-text">What has to happen</label><input id="tk-text" type="text" [(ngModel)]="draft.text" placeholder="Send the price list to Nimal" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!msg()"></div>
        <div class="field"><label for="tk-due">By when</label><input id="tk-due" type="date" [class.empty]="!draft.due" [(ngModel)]="draft.due"></div>
        <div class="field"><label for="tk-who">Who</label><select id="tk-who" [(ngModel)]="draft.who"><option value="">Anyone</option>@for (u of seats(); track u) { <option [value]="u">{{ u }}</option> }</select></div>
        <div class="field span"><label for="tk-deal">About</label><select id="tk-deal" [(ngModel)]="draft.dealId"><option value="">Nothing in particular</option>@for (d of dealChoices(draft.dealId); track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select>
          @if (data.openDeals().length > 30) { <span class="hint">The 30 deals touched most recently.</span> }</div>
      </div>
      </ng-template>
      <ng-template #foot>
        <button class="btn" type="button" data-act="task-add" [disabled]="busy()" (click)="save()">Add task</button>
        <button class="btn quiet" type="button" data-act="task-add-cancel" (click)="adding.set(false)">Cancel</button>
      </ng-template>
    </bb-drawer>

    <bb-drawer [open]="!!sel()" [title]="sel()?.text || ''" [editable]="!!sel() && !editing()" [message]="editing() ? emsg() : ''" (edit)="beginEdit()" (closed)="closeSheet()">
      <ng-template #body>
      @if (sel(); as t) {
        @if (editing()) {
          <div class="form-grid" (input)="keepEdit()" (change)="keepEdit()">
            <div class="field span"><label for="te-text">What has to happen</label><input id="te-text" type="text" [(ngModel)]="ed.text" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!emsg()"></div>
            <div class="field"><label for="te-due">By when</label><input id="te-due" type="date" [class.empty]="!ed.due" [(ngModel)]="ed.due"></div>
            <div class="field"><label for="te-who">Who</label><select id="te-who" [(ngModel)]="ed.who"><option value="">Anyone</option>@for (u of seats(); track u) { <option [value]="u">{{ u }}</option> }</select></div>
            <div class="field span"><label for="te-deal">About</label><select id="te-deal" [(ngModel)]="ed.dealId"><option value="">Nothing in particular</option>@for (d of dealChoices(ed.dealId); track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></div>
          </div>
        } @else {
          <div class="sheet-pills">
            <span class="pill" [class.won]="t.done">{{ t.done ? 'Done' : 'Open' }}</span>
            @if (!t.done && t.due && t.due < todayStr) { <span class="pill over">Overdue</span> }
            @else if (!t.done && t.due === todayStr) { <span class="pill quoted">Today</span> }
          </div>
          <dl class="facts">
            <div class="f"><dt>By when</dt><dd [class.none]="!t.due">{{ t.due ? niceDate(t.due) : 'No date' }}</dd></div>
            <div class="f"><dt>Who</dt><dd [class.none]="!t.who">{{ t.who || 'Anyone' }}</dd></div>
            <div class="f span"><dt>About</dt><dd [class.none]="!dealName(t)">{{ dealName(t) || 'Nothing in particular' }}</dd></div>
            <div class="f span"><dt>Added</dt><dd>{{ niceDate(t.createdAt) }}@if (t.by) { by {{ t.by }} }</dd></div>
          </dl>
        }
      }
      </ng-template>
      <ng-template #foot>@if (sel(); as t) {
        @if (editing()) {
          <button class="btn" type="button" data-act="task-save" [disabled]="busy()" (click)="saveEdit(t)">Save changes</button>
          <button class="btn quiet" type="button" data-act="task-edit-cancel" (click)="cancelEdit(t)">Cancel</button>
        } @else {
          <button class="btn" type="button" data-act="task-done" (click)="toggle(t)"><bb-icon name="check"/><span>{{ t.done ? 'Mark not done' : 'Mark done' }}</span></button>
          <button class="btn quiet warn" type="button" data-act="task-remove" (click)="remove(t)">Remove</button>
        }
      }</ng-template>
    </bb-drawer>`,
  styles: [`.k-val.red{color:var(--red)}.fbar{margin-top:16px}
    .pill.over{background:var(--red-soft);color:var(--red);border-color:transparent}
    /* the tick is a 44px target carrying a 26px box, so a thumb cannot miss it */
    .tick{width:44px;height:44px;margin:-6px -8px -6px -10px;border:0;background:none;display:grid;place-items:center;flex-shrink:0;border-radius:12px}
    .tick .box{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--line-2);display:grid;place-items:center;color:var(--on-accent);transition:background 120ms var(--ease),border-color 120ms var(--ease)}
    .tick bb-icon{--ico:15px;opacity:0}.tick.on .box{background:var(--brand);border-color:var(--brand)}.tick.on bb-icon{opacity:1}
    .li .tx{border:0;background:none;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;min-height:40px;display:flex;flex-direction:column;justify-content:center}
    .li.done .tx strong{text-decoration:line-through;color:var(--muted)}`]
})
export class TasksComponent implements OnInit, OnDestroy {
  cast = inject(CastService); data = inject(DataService); private drafts = inject(DraftService); private ask = inject(AskService); private route = inject(ActivatedRoute); private router = inject(Router);
  niceDate = niceDate; todayStr = today(); min = Math.min;
  q = signal(''); f = signal<Record<string, string>>({}); shown = signal(WINDOW);
  adding = signal(false); sel = signal<Task | null>(null); editing = signal(false);
  msg = signal(''); emsg = signal(''); busy = signal(false); restored = signal(false);
  draft: typeof BLANK = { ...BLANK }; ed: typeof BLANK = { ...BLANK };
  seats = computed(() => (this.cast.cast()?.users || []).map(u => u.name));
  defs = computed<FilterDef[]>(() => [
    { key: 'show', label: 'Show', all: 'Open tasks', options: [{ value: 'overdue', label: 'Overdue' }, { value: 'today', label: 'Due today' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'Every task' }] },
    { key: 'who', label: 'Who', all: 'Anyone', options: this.seats().map(s => ({ value: s, label: s })) }]);
  private qs: any;
  constructor(){ effect(() => { this.q(); this.f(); this.shown.set(WINDOW); }); }
  ngOnInit(){ this.qs = this.route.queryParams.subscribe(p => this.spend(p)); }
  /* AN ADDRESS THAT CARRIES AN ORDER IS SPENT ONCE. "add", "open" and "view" in the address are taken
     out of it before they are acted on, so a reload or a step Back never opens the same sheet twice. */
  private async spend(p: any){
    if (!p['add'] && !p['open']) return;
    await this.router.navigate([], { relativeTo: this.route, queryParams: { add: null, open: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (p['add']) this.openAdd();
    if (p['open']) { const r = this.data.tasks().find(x => x.id === p['open']); if (r) this.open(r); }
  }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  rows = computed(() => { const f = this.f(), s = f['show'] || 'open', q = this.q().trim().toLowerCase(), t = this.todayStr;
    return this.data.tasks().filter(x => (s === 'all' || (s === 'open' ? !x.done : s === 'done' ? x.done : s === 'overdue' ? (!x.done && !!x.due && x.due < t) : (!x.done && x.due === t)))
      && (!f['who'] || x.who === f['who']) && (!q || [x.text, x.who].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.due || '9999').localeCompare(b.due || '9999')); });
  overdue = computed(() => this.data.tasks().filter(t => !t.done && t.due && t.due < this.todayStr).length);
  dueToday = computed(() => this.data.tasks().filter(t => !t.done && t.due === this.todayStr).length);
  doneWeek = computed(() => this.data.tasks().filter(t => t.done && (Date.now() - new Date(t.updatedAt).getTime()) < 7 * 864e5).length);
  filtered = computed(() => !!this.q().trim() || Object.values(this.f()).some(Boolean));
  sub = computed(() => { const o = this.overdue(), d = this.dueToday(); return o ? `${o} overdue. Start there.` : d ? `${d} due today.` : 'What has to happen, by when, for whom.'; });
  private names = computed(() => new Map(this.data.deals().map(d => [d.id, d.name])));
  dealName(t: Task){ return t.dealId ? this.names().get(t.dealId) || '' : ''; }
  meta(t: Task){ const d = this.dealName(t); return [t.due ? 'By ' + niceDate(t.due) : '', t.who || '', d ? 'About ' + d : ''].filter(Boolean).join(' · ') || 'No date'; }
  /* a picker draws thirty choices, never the whole book: the deals touched most recently, plus
     the one already chosen so an edit never drops its link */
  dealChoices(keep: string){ const open = [...this.data.openDeals()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 30);
    if (keep && !open.some(d => d.id === keep)) { const d = this.data.deals().find(x => x.id === keep); if (d) open.unshift(d); } return open; }

  openAdd(){ this.restored.set(this.drafts.has('task-new')); this.draft = this.drafts.load('task-new', BLANK); this.msg.set(''); this.adding.set(true); }
  keep(){ this.drafts.keep('task-new', this.draft); if (this.msg() && this.draft.text.trim()) this.msg.set(''); }
  fresh(){ this.drafts.clear('task-new'); this.draft = { ...BLANK }; this.restored.set(false); this.msg.set(''); }
  async save(){
    const text = this.draft.text.trim(); if (!text) { this.msg.set('Write what has to happen first.'); document.getElementById('tk-text')?.focus(); return; }
    if (this.busy()) return; this.busy.set(true);
    try { await this.data.addTask({ ...this.draft, text }); this.drafts.clear('task-new'); this.adding.set(false); this.data.toast('Task added'); }
    finally { this.busy.set(false); }
  }
  open(t: Task){ this.sel.set(t); this.emsg.set(''); const key = 'task-edit-' + t.id;
    if (this.drafts.has(key)) { this.ed = this.drafts.load(key, this.from(t)); this.editing.set(true); } else this.editing.set(false); }
  closeSheet(){ this.sel.set(null); this.editing.set(false); }
  private from(t: Task){ return { text: t.text || '', due: t.due || '', who: t.who || '', dealId: t.dealId || '' }; }
  beginEdit(){ const t = this.sel(); if (!t) return; this.ed = this.drafts.load('task-edit-' + t.id, this.from(t)); this.emsg.set(''); this.editing.set(true); }
  keepEdit(){ const t = this.sel(); if (t) this.drafts.keep('task-edit-' + t.id, this.ed); if (this.emsg() && this.ed.text.trim()) this.emsg.set(''); }
  cancelEdit(t: Task){ this.drafts.clear('task-edit-' + t.id); this.editing.set(false); this.emsg.set(''); }
  async saveEdit(t: Task){
    const text = this.ed.text.trim(); if (!text) { this.emsg.set('A task needs its words. Put them back to save.'); return; }
    if (this.busy()) return; this.busy.set(true);
    try { const r = await this.data.updateTask(t.id, { text, due: this.ed.due, who: this.ed.who, dealId: this.ed.dealId }); if (r) this.sel.set(r);
      this.drafts.clear('task-edit-' + t.id); this.editing.set(false); this.data.toast('Saved'); }
    finally { this.busy.set(false); }
  }
  async toggle(t: Task){ await this.data.toggleTask(t.id); this.closeSheet(); this.data.toast(t.done ? 'Back in the book' : 'Done'); }
  async remove(t: Task){
    if (!(await this.ask.confirm({ title: 'Remove this task?', body: t.text, yes: 'Remove', danger: true }))) return;
    await this.data.removeTask(t.id); this.drafts.clear('task-edit-' + t.id); this.closeSheet(); this.data.toast('Task removed');
  }
}
