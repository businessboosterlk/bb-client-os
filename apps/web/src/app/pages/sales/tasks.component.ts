import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, today, niceDate } from '../../core/data.service';
import { SessionService } from '../../core/session.service';
import { Task } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';

/* The task book. What has to happen, by when, for whom. A task can hang off a deal or a
   customer so the dashboard's "needs attention" fills itself from here. Overdue first. */
@Component({
  selector: 'bb-tasks',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Tasks</h1><p>{{ sub() }}</p></div>
      <div class="ph-right"><button class="btn" type="button" (click)="openAdd()"><bb-icon name="plus"/>New task</button></div></div>
    <div class="kpi">
      <div class="card"><div class="k-label">Overdue</div><div class="k-val" [class.red]="overdue().length">{{ overdue().length }}</div><div class="k-sub">need doing first</div></div>
      <div class="card"><div class="k-label">Today</div><div class="k-val">{{ dueToday().length }}</div><div class="k-sub">due by tonight</div></div>
      <div class="card"><div class="k-label">Open</div><div class="k-val">{{ data.openTasks().length }}</div><div class="k-sub">in the book</div></div>
      <div class="card"><div class="k-label">Done this week</div><div class="k-val up">{{ doneWeek().length }}</div><div class="k-sub">ticked off</div></div>
    </div>
    <div class="toolbar" style="margin-top:18px"><div class="chips">@for (f of filters; track f[0]) { <button type="button" [class.on]="fl() === f[0]" (click)="fl.set(f[0])">{{ f[1] }}</button> }</div></div>
    <div class="card list">
      @for (t of rows(); track t.id) {
        <div class="li" [class.done]="t.done">
          <button class="tick" type="button" [class.on]="t.done" (click)="data.toggleTask(t.id)" [attr.aria-label]="t.done ? 'Mark not done' : 'Mark done'"><bb-icon name="check"/></button>
          <span class="tx" (click)="sel.set(t)"><strong>{{ t.text }}</strong><span>{{ meta(t) }}</span></span>
          @if (!t.done && t.due && t.due < todayStr) { <span class="pill lost" style="background:var(--red-soft);color:var(--red)">Overdue</span> }
          @else if (!t.done && t.due === todayStr) { <span class="pill quoted">Today</span> }
        </div>
      } @empty { <div class="empty"><strong>{{ fl() === 'open' ? 'Nothing to do' : 'Nothing here' }}</strong>{{ fl() === 'open' ? 'Add a task. Win a deal and the follow-ups write themselves.' : '' }}</div> }
    </div>

    <bb-drawer [open]="adding()" title="New task" (closed)="adding.set(false)">
      <div class="form-grid">
        <div class="field span"><label for="tk-text">What has to happen</label><input id="tk-text" type="text" [(ngModel)]="draft.text" placeholder="Send the price list to Nimal" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="bad()"></div>
        <div class="field"><label>By when</label><input type="date" [(ngModel)]="draft.due" [min]="todayStr"></div>
        <div class="field"><label>Who</label><select [(ngModel)]="draft.who"><option value="">Anyone</option>@for (u of seats(); track u) { <option [value]="u">{{ u }}</option> }</select></div>
        <div class="field span"><label>About</label><select [(ngModel)]="draft.dealId"><option value="">Nothing in particular</option>@for (d of data.openDeals(); track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></div>
      </div>
      <div foot><button class="btn" type="button" (click)="save()">Add task</button></div>
    </bb-drawer>

    <bb-drawer [open]="!!sel()" [title]="sel()?.text || ''" (closed)="sel.set(null)">
      @if (sel(); as t) {
        <div class="form-grid">
          <div class="field span"><label>What has to happen</label><input type="text" [ngModel]="t.text" (change)="patch(t, { text: val($event) })"></div>
          <div class="field"><label>By when</label><input type="date" [ngModel]="t.due || ''" (change)="patch(t, { due: val($event) })"></div>
          <div class="field"><label>Who</label><select [ngModel]="t.who || ''" (change)="patch(t, { who: val($event) })"><option value="">Anyone</option>@for (u of seats(); track u) { <option [value]="u">{{ u }}</option> }</select></div>
          <div class="field span"><label>About</label><select [ngModel]="t.dealId || ''" (change)="patch(t, { dealId: val($event) })"><option value="">Nothing in particular</option>@for (d of data.deals(); track d.id) { <option [value]="d.id">{{ d.name }}</option> }</select></div>
        </div>
        <p class="t-small" style="margin-top:14px">Added {{ niceDate(t.createdAt) }}@if (t.by) { by {{ t.by }} }.</p>
      }
      <div foot>@if (sel(); as t) {
        <button class="btn" type="button" (click)="data.toggleTask(t.id); sel.set(null)"><bb-icon name="check"/>{{ t.done ? 'Not done' : 'Done' }}</button>
        <button class="btn danger sm" type="button" style="margin-left:auto" (click)="remove(t)"><bb-icon name="trash"/></button>
      }</div>
    </bb-drawer>`,
  styles: [`.k-val.red{color:var(--red)}
    .tick{width:28px;height:28px;border-radius:9px;border:1.5px solid var(--line-2);background:none;display:grid;place-items:center;color:var(--on-accent);flex-shrink:0;transition:background 120ms var(--ease),border-color 120ms var(--ease)}
    .tick bb-icon{--ico:15px;opacity:0}.tick.on{background:var(--brand);border-color:var(--brand)}.tick.on bb-icon{opacity:1}
    .li.done .tx strong{text-decoration:line-through;color:var(--muted)}.tx{cursor:pointer}`]
})
export class TasksComponent implements OnInit, OnDestroy {
  cast = inject(CastService); data = inject(DataService); session = inject(SessionService); private route = inject(ActivatedRoute);
  niceDate = niceDate; todayStr = today();
  fl = signal('open'); adding = signal(false); sel = signal<Task | null>(null); bad = signal(false);
  draft: Partial<Task> = {};
  filters: [string, string][] = [['open', 'Open'], ['done', 'Done'], ['all', 'All']];
  private qs: any;
  ngOnInit(){ this.qs = this.route.queryParams.subscribe(p => { if (p['add']) this.openAdd(); }); }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  seats = computed(() => (this.cast.cast()?.users || []).map(u => u.name));
  rows = computed(() => { const f = this.fl(); const t = this.todayStr;
    return this.data.tasks().filter(x => f === 'all' || (f === 'open' ? !x.done : x.done)).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.due || '9999').localeCompare(b.due || '9999')); });
  overdue = computed(() => this.data.tasks().filter(t => !t.done && t.due && t.due < this.todayStr));
  dueToday = computed(() => this.data.tasks().filter(t => !t.done && t.due === this.todayStr));
  doneWeek = computed(() => this.data.tasks().filter(t => t.done && (Date.now() - new Date(t.updatedAt).getTime()) < 7 * 86400000));
  sub = computed(() => { const o = this.overdue().length, d = this.dueToday().length; return o ? `${o} overdue. Start there.` : d ? `${d} due today.` : 'What has to happen, by when, for whom.'; });
  meta(t: Task){ const d = this.data.deals().find(x => x.id === t.dealId); return [t.due ? 'By ' + niceDate(t.due) : '', t.who || '', d ? 'About ' + d.name : ''].filter(Boolean).join(' · ') || 'No date'; }
  val(e: Event){ return (e.target as HTMLInputElement).value.trim(); }
  openAdd(){ this.draft = { text: '', due: '', who: '', dealId: '' }; this.bad.set(false); this.adding.set(true); setTimeout(() => document.getElementById('tk-text')?.focus(), 250); }
  async save(){ const text = (this.draft.text || '').trim(); if (!text) { this.bad.set(true); return; } await this.data.addTask({ ...this.draft, text }); this.adding.set(false); this.data.toast('Task added'); }
  async patch(t: Task, p: Partial<Task>){ const r = await this.data.updateTask(t.id, p); if (r && this.sel()?.id === t.id) this.sel.set(r); }
  async remove(t: Task){ if (!confirm('Remove this task?')) return; await this.data.removeTask(t.id); this.sel.set(null); }
}
