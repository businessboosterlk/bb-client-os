import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CastService } from '../../core/cast.service';
import { DataService, daysSince, since } from '../../core/data.service';
import { AskService } from '../../core/ask.service';
import { ScreenService } from '../../core/screen.service';
import { Deal, Stage } from '../../core/models';
import { DealDrawerComponent, LOST_REASONS } from './deal-drawer.component';
import { DealAddComponent } from './deal-add.component';
import { IconComponent } from '../../ui/icon.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';

/* Two views of the same deals: the board (drag a card between stages, touch included) and the
   list (every deal in one sortable table with the stage changeable in place). One switch,
   remembered on the device. Both draw a window of thirty, so a long book stays light. */
@Component({
  selector: 'bb-pipeline',
  standalone: true,
  imports: [FormsModule, DragDropModule, DealDrawerComponent, DealAddComponent, IconComponent, FilterBarComponent, MoreComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Pipeline</h1><p>{{ sub() }}</p></div>
      <div class="ph-right">
        <div class="seg" role="group" aria-label="View">
          <button type="button" data-act="pipeline-view-board" [class.on]="view() === 'board'" [attr.aria-pressed]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/><span>Board</span></button>
          <button type="button" data-act="pipeline-view-list" [class.on]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/><span>List</span></button>
        </div>
        <button class="btn" type="button" data-act="deal-new" (click)="adding.set(true)"><bb-icon name="plus"/><span>New deal</span></button>
      </div></div>

    <bb-filter-bar [state]="f" [query]="q" [defs]="defs()" placeholder="Search deals" label="Search by name, number or what they want"
      [count]="rows().length" noun="deal" nouns="deals" store="pipeline"/>

    @if (data.loading()) {
      <div class="card skel" aria-busy="true" aria-label="Loading deals"><i></i><i></i><i></i><i></i></div>
    } @else if (view() === 'board') {
      <div class="board" cdkDropListGroup>
        @for (col of columns(); track col.key) {
          <section class="col" [class.done]="col.key === 'won' || col.key === 'lost'" [attr.aria-label]="col.label">
            <div class="col-h">
              <span class="col-t"><i class="dot" [class]="'dot ' + col.key"></i>{{ col.label }}@if (col.prob !== null) { <em>{{ col.prob }}%</em> }</span>
              <span class="col-n">{{ col.deals.length }}@if (col.value) { · {{ cast.moneyShort(col.value) }} }</span>
            </div>
            <div class="col-b" cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)">
              @for (d of col.deals.slice(0, colShown()[col.key] || 15); track d.id) {
                <button type="button" class="dc" data-act="deal-open" cdkDrag [cdkDragData]="d" [cdkDragStartDelay]="touch ? 220 : 0" (click)="sel.set(d)">
                  <span class="dc-rail" [class]="'dc-rail ' + d.stage"></span>
                  <strong>{{ d.name }}</strong>
                  <span class="dc-sub">{{ d.wants || d.phone || 'No details yet' }}</span>
                  @if (d.value || d.nextStep) {
                    <span class="dc-meta">
                      @if (d.value) { <span class="dc-val">{{ cast.moneyShort(d.value) }}</span> }
                      @if (d.nextStep) { <span class="dc-next"><bb-icon name="clock"/><span>{{ d.nextStep }}</span></span> }
                    </span>
                  }
                  @if (quiet(d) >= 5 && open(d)) { <span class="dc-warn" [class.red]="quiet(d) >= 10">{{ quiet(d) }} days quiet</span> }
                  <div class="dc-ph" *cdkDragPlaceholder></div>
                </button>
              } @empty { <div class="col-empty">{{ col.key === 'won' ? 'Nothing won yet' : col.key === 'lost' ? 'Nothing lost' : 'Drop a deal here' }}</div> }
              @if (col.deals.length > (colShown()[col.key] || 15)) { <button type="button" class="btn ghost sm col-more" data-act="pipeline-column-more" (click)="colMore(col.key)">Show 15 more of {{ col.deals.length }}</button> }
            </div>
          </section>
        }
      </div>
    } @else {
      <div class="card">
        @if (screen.wide()) {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr>
              <th [attr.aria-sort]="aria('name')"><button type="button" class="th" data-act="pipeline-sort-name" (click)="sortBy('name')">Deal{{ arrow('name') }}</button></th>
              <th [attr.aria-sort]="aria('stage')"><button type="button" class="th" data-act="pipeline-sort-stage" (click)="sortBy('stage')">Stage{{ arrow('stage') }}</button></th>
              <th class="num" [attr.aria-sort]="aria('value')"><button type="button" class="th" data-act="pipeline-sort-value" (click)="sortBy('value')">Worth{{ arrow('value') }}</button></th>
              <th>Next step</th>
              <th [attr.aria-sort]="aria('quiet')"><button type="button" class="th" data-act="pipeline-sort-quiet" (click)="sortBy('quiet')">Last touch{{ arrow('quiet') }}</button></th>
            </tr></thead>
            <tbody>
              @for (d of rows().slice(0, shown()); track d.id) {
                <tr data-act="deal-open" tabindex="0" (click)="sel.set(d)" (keydown.enter)="sel.set(d)">
                  <td><div class="who"><span class="avatar">{{ d.name.slice(0,1) }}</span><div><strong>{{ d.name }}</strong><span>{{ d.wants || d.phone || '' }}</span></div></div></td>
                  <td (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                    <select class="st" [class]="'st ' + d.stage" data-act="deal-stage-row" [attr.aria-label]="'Stage of ' + d.name" [ngModel]="d.stage" (change)="pick(d, $event)">
                      @for (s of stages(); track s.key) { <option [value]="s.key">{{ s.label }}</option> }
                      <option value="won">Won</option><option value="lost">Lost</option>
                    </select>
                  </td>
                  <td class="num">{{ cast.money(d.value) || '' }}</td>
                  <td class="t-small">{{ d.nextStep || '' }}@if (d.nextAt) { <em class="due"> by {{ d.nextAt }}</em> }</td>
                  <td class="t-small" [class.warn]="quiet(d) >= 5 && open(d)">{{ since(quiet(d)) }}</td>
                </tr>
              } @empty { <tr><td colspan="5"><div class="empty"><strong>{{ filtered() ? 'No match' : 'Nothing here yet' }}</strong>{{ filtered() ? 'Try another name or clear the filters.' : 'Start an enquiry or add a deal and it lands here.' }}</div></td></tr> }
            </tbody>
          </table>
        </div>
        } @else {
        <div class="list phone">
          @for (d of rows().slice(0, shown()); track d.id) {
            <button type="button" class="li link" data-act="deal-open" (click)="sel.set(d)">
              <span class="avatar">{{ d.name.slice(0,1) }}</span>
              <span class="tx"><strong>{{ d.name }}</strong><span>{{ line(cast.moneyShort(d.value), d.nextStep, since(quiet(d))) }}</span></span>
              <span class="pill" [class]="'pill ' + d.stage">{{ stageLabel(d.stage) }}</span>
            </button>
          } @empty { <div class="empty"><strong>{{ filtered() ? 'No match' : 'Nothing here yet' }}</strong>{{ filtered() ? 'Try another name or clear the filters.' : 'Start an enquiry or add a deal and it lands here.' }}</div> }
        </div>
        }
        <bb-more [total]="rows().length" [shown]="min(shown(), rows().length)" (more)="shown.set(shown() + 30)"/>
      </div>
    }

    <bb-drawer-add [open]="adding()" (closed)="adding.set(false)" (saved)="onAdded($event)"/>
    <bb-deal-drawer [deal]="sel()" (closed)="sel.set(null)" (changed)="sel.set($event)"/>`,
  styles: [`
    .th{display:inline-flex;align-items:center;min-height:32px;padding:0;border:0;background:none;font:inherit;color:inherit;cursor:pointer}
    @media (hover:hover){.th:hover{color:var(--ink)}}
    th.num .th{justify-content:flex-end}
    .st{min-height:32px;padding:2px 30px 2px 11px;border-radius:999px;border:1px solid transparent;font-size:11.5px;font-weight:600;background-color:var(--surface-2);color:var(--ink-2);background-position:right 12px center;background-size:11px 11px}
    .st.talking{background-color:var(--blue-soft);color:var(--blue)}.st.quoted{background-color:var(--amber-soft);color:var(--amber)}.st.closing{background-color:var(--purple-soft);color:var(--purple)}.st.won{background-color:var(--green-soft);color:var(--green)}.st.lost{color:var(--muted)}
    .warn{color:var(--amber);font-weight:600}.due{font-style:normal;color:var(--muted)}
    
    tr:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}
    `]
})
export class PipelineComponent implements OnInit, OnDestroy {
  cast = inject(CastService); data = inject(DataService); screen = inject(ScreenService); private ask = inject(AskService); private route = inject(ActivatedRoute); private router = inject(Router);
  min = Math.min; since = since; touch = matchMedia('(pointer:coarse)').matches;
  view = signal<'board' | 'list'>('board'); adding = signal(false); sel = signal<Deal | null>(null);
  q = signal(''); f = signal<Record<string, string>>({});
  shown = signal(WINDOW); colShown = signal<Record<string, number>>({});
  sortKey = signal('value'); sortDir = signal<1 | -1>(-1);
  stages = computed(() => this.cast.cast()?.stages || []);
  defs = computed<FilterDef[]>(() => {
    const d: FilterDef[] = [];
    if (this.view() === 'list') d.push({ key: 'stage', label: 'Stage', all: 'Open deals', options: [{ value: 'all', label: 'Every deal' }, ...this.stages().map(s => ({ value: s.key, label: s.label })), { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }] });
    d.push({ key: 'quiet', label: 'Last touch', all: 'Any time', options: [{ value: '5', label: 'Quiet 5 days or more' }, { value: '10', label: 'Quiet 10 days or more' }] });
    return d;
  });
  private qs: any;
  constructor(){ effect(() => { this.q(); this.f(); this.view(); this.shown.set(WINDOW); this.colShown.set({}); }); }
  ngOnInit(){
    try { const v = localStorage.getItem('bbos_pipe_view'); if (v === 'list' || v === 'board') this.view.set(v); } catch {}
    this.qs = this.route.queryParams.subscribe(p => this.spend(p));
  }
  /* AN ADDRESS THAT CARRIES AN ORDER IS SPENT ONCE. "add", "open" and "view" in the address are taken
     out of it before they are acted on, so a reload or a step Back never opens the same sheet twice. */
  private async spend(p: any){
    if (!p['view'] && !p['add'] && !p['open']) return;
    await this.router.navigate([], { relativeTo: this.route, queryParams: { view: null, add: null, open: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (p['view'] === 'board' || p['view'] === 'list') this.setView(p['view']);
    if (p['open']) { const d = this.data.deals().find(x => x.id === p['open']); if (d) this.sel.set(d); }
    if (p['add']) this.adding.set(true);
  }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  setView(v: 'board' | 'list'){ this.view.set(v); try { localStorage.setItem('bbos_pipe_view', v); } catch {} }
  open(d: Deal){ return d.stage !== 'won' && d.stage !== 'lost'; }
  quiet(d: Deal){ return daysSince(d.lastContactAt || d.stageAt || d.createdAt); }
  line(...p: (string | undefined)[]){ return p.filter(Boolean).join(' · '); }
  stageLabel(k: Stage){ return this.stages().find(s => s.key === k)?.label || (k === 'won' ? 'Won' : k === 'lost' ? 'Lost' : k); }
  filtered = computed(() => !!this.q().trim() || Object.values(this.f()).some(Boolean));
  sub = computed(() => { const n = this.data.openDeals().length, v = this.data.pipeValue();
    return n ? `${n} ${n === 1 ? 'deal' : 'deals'} in progress${v ? ' worth ' + this.cast.money(v) : ''}${this.data.weighted() ? ' and ' + this.cast.moneyShort(this.data.weighted()) + ' weighted' : ''}.` : 'Every deal you are working, by stage. Drag a card to move it.'; });
  /* what both views draw: the search and the filters applied once */
  private base = computed(() => { const f = this.f(), q = this.q().trim().toLowerCase(), qd = Number(f['quiet'] || 0);
    return this.data.deals().filter(d => (!qd || (this.open(d) && this.quiet(d) >= qd)) && (!q || [d.name, d.phone, d.wants, d.nextStep].join(' ').toLowerCase().includes(q))); });
  rows = computed(() => { const st = this.f()['stage'] || ''; const k = this.sortKey(), dir = this.sortDir(); const list = this.view() === 'list';
    return this.base().filter(d => !list || (st === 'all' ? true : st ? d.stage === st : this.open(d))).sort((a, b) => {
      const va = k === 'value' ? (a.value || 0) : k === 'quiet' ? this.quiet(a) : k === 'stage' ? this.stageIdx(a.stage) : a.name.toLowerCase();
      const vb = k === 'value' ? (b.value || 0) : k === 'quiet' ? this.quiet(b) : k === 'stage' ? this.stageIdx(b.stage) : b.name.toLowerCase();
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir; }); });
  columns = computed(() => {
    const cols: { key: Stage; label: string; prob: number | null; deals: Deal[]; value: number }[] = []; const all = this.base();
    const add = (key: Stage, label: string, prob: number | null) => { const deals = all.filter(d => d.stage === key).sort((a, b) => (b.value || 0) - (a.value || 0)); cols.push({ key, label, prob, deals, value: deals.reduce((a, d) => a + (Number(d.value) || 0), 0) }); };
    this.stages().forEach(s => add(s.key, s.label, s.prob)); add('won', 'Won', 100); add('lost', 'Lost', null); return cols;
  });
  colMore(k: string){ this.colShown.set({ ...this.colShown(), [k]: (this.colShown()[k] || 15) + 15 }); }
  async drop(ev: CdkDragDrop<Stage>){ const d: Deal = ev.item.data; const to = ev.container.data; if (d.stage === to) return; await this.move(d, to); }
  /* a move never skips a rule: Lost asks why, Won makes the customer */
  async move(d: Deal, to: Stage): Promise<boolean> {
    if (d.stage === to) return true;
    if (to === 'lost') { const reason = await this.ask.choose({ title: `Why was ${d.name} lost?`, body: 'The reason shows on the deal and in your numbers.', options: LOST_REASONS, no: 'Keep it open' }); if (!reason) return false; await this.data.moveDeal(d.id, 'lost', { lostReason: reason }); this.data.toast('Marked lost: ' + reason); return true; }
    await this.data.moveDeal(d.id, to);
    if (to === 'won') this.data.toast(`${d.name} is now a customer`, '/sales/customers', 'See them'); else this.data.toast('Moved to ' + this.stageLabel(to));
    return true;
  }
  /* the stage box in a list row: a move that is called off puts the box back where it was */
  async pick(d: Deal, ev: Event){ const el = ev.target as HTMLSelectElement; if (!(await this.move(d, el.value as Stage))) el.value = d.stage; }
  stageIdx(s: Stage){ const i = this.stages().findIndex(x => x.key === s); return i < 0 ? (s === 'won' ? 90 : 99) : i; }
  sortBy(k: string){ if (this.sortKey() === k) this.sortDir.set(this.sortDir() === 1 ? -1 : 1); else { this.sortKey.set(k); this.sortDir.set(k === 'name' ? 1 : -1); } }
  arrow(k: string){ return this.sortKey() === k ? (this.sortDir() === 1 ? ' ↑' : ' ↓') : ''; }
  aria(k: string){ return this.sortKey() === k ? (this.sortDir() === 1 ? 'ascending' : 'descending') : null; }
  onAdded(d: Deal){ this.adding.set(false); this.sel.set(d); }
}
