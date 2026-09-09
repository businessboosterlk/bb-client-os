import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, daysSince } from '../../core/data.service';
import { Deal, Stage } from '../../core/models';
import { DealDrawerComponent } from './deal-drawer.component';
import { DealAddComponent } from './deal-add.component';
import { IconComponent } from '../../ui/icon.component';

/* Two views of the same deals: the board (the kanban BB runs its own sales on,
   drag a card between stages, touch included) and the list (every deal in one
   sortable table with the stage changeable inline). One switch, remembered. */
@Component({
  selector: 'bb-pipeline',
  standalone: true,
  imports: [FormsModule, DragDropModule, DealDrawerComponent, DealAddComponent, IconComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Pipeline</h1><p>{{ sub() }}</p></div>
      <div class="ph-right">
        <div class="seg" role="tablist">
          <button type="button" [class.on]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/>Board</button>
          <button type="button" [class.on]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/>List</button>
        </div>
        <button class="btn" type="button" (click)="adding.set(true)"><bb-icon name="plus"/>New deal</button>
      </div></div>

    @if (view() === 'board') {
      <div class="board" cdkDropListGroup>
        @for (col of columns(); track col.key) {
          <div class="col" [class.done]="col.key === 'won' || col.key === 'lost'">
            <div class="col-h">
              <span class="col-t"><i class="dot" [class]="'dot ' + col.key"></i>{{ col.label }}@if (col.prob !== null) { <em>{{ col.prob }}%</em> }</span>
              <span class="col-n">{{ col.deals.length }}@if (col.value) { · {{ cast.moneyShort(col.value) }} }</span>
            </div>
            <div class="col-b" cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)">
              @for (d of col.deals; track d.id) {
                <div class="dc" cdkDrag [cdkDragData]="d" (click)="sel.set(d)">
                  <div class="dc-rail" [class]="'dc-rail ' + d.stage"></div>
                  <strong>{{ d.name }}</strong>
                  <span class="dc-sub">{{ d.wants || d.phone || 'No details yet' }}</span>
                  <div class="dc-meta">
                    @if (d.value) { <span class="dc-val">{{ cast.moneyShort(d.value) }}</span> }
                    @if (d.nextStep) { <span class="dc-next"><bb-icon name="clock"/>{{ d.nextStep }}</span> }
                  </div>
                  @if (quiet(d) >= 5 && open(d)) { <span class="dc-warn" [class.red]="quiet(d) >= 10">{{ quiet(d) }} days quiet</span> }
                  <div class="dc-ph" *cdkDragPlaceholder></div>
                </div>
              } @empty { <div class="col-empty">{{ col.key === 'won' ? 'Nothing won yet' : col.key === 'lost' ? 'Nothing lost' : 'Drop a deal here' }}</div> }
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="toolbar">
        <div class="chips">@for (f of listFilters; track f[0]) { <button type="button" [class.on]="lf() === f[0]" (click)="lf.set(f[0])">{{ f[1] }}</button> }</div>
        <span class="t-small" style="margin-left:auto">{{ listRows().length }} {{ listRows().length === 1 ? 'deal' : 'deals' }}</span>
      </div>
      <div class="card tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th (click)="sortBy('name')" class="s">Deal{{ arrow('name') }}</th><th (click)="sortBy('stage')" class="s">Stage{{ arrow('stage') }}</th>
            <th class="num s" (click)="sortBy('value')">Worth{{ arrow('value') }}</th><th>Next step</th><th class="s" (click)="sortBy('quiet')">Last touch{{ arrow('quiet') }}</th><th></th>
          </tr></thead>
          <tbody>
            @for (d of listRows(); track d.id) {
              <tr (click)="sel.set(d)">
                <td><div class="who"><span class="avatar">{{ d.name.slice(0,1) }}</span><div><strong>{{ d.name }}</strong><span>{{ d.wants || d.phone || '' }}</span></div></div></td>
                <td (click)="$event.stopPropagation()">
                  <select class="st" [class]="'st ' + d.stage" [ngModel]="d.stage" (ngModelChange)="move(d, $event)">
                    @for (s of stages(); track s.key) { <option [value]="s.key">{{ s.label }}</option> }
                    <option value="won">Won</option><option value="lost">Lost</option>
                  </select>
                </td>
                <td class="num">{{ cast.money(d.value) || '' }}</td>
                <td class="t-small">{{ d.nextStep || '' }}@if (d.nextAt) { <em class="due"> by {{ d.nextAt }}</em> }</td>
                <td class="t-small" [class.warn]="quiet(d) >= 5 && open(d)">{{ quiet(d) === 0 ? 'Today' : quiet(d) + ' days ago' }}</td>
                <td class="acts" (click)="$event.stopPropagation()">@if (waLink(d.phone, d.name); as w) { <a class="btn wa sm icon" [href]="w" target="_blank" rel="noreferrer"><bb-icon name="wa"/></a> }</td>
              </tr>
            } @empty { <tr><td colspan="6"><div class="empty"><strong>Nothing here</strong>Start an enquiry, or add a deal, and it lands here.</div></td></tr> }
          </tbody>
        </table>
      </div>
    }

    <bb-drawer-add [open]="adding()" (closed)="adding.set(false)" (saved)="onAdded($event)"></bb-drawer-add>
    <bb-deal-drawer [deal]="sel()" (closed)="sel.set(null)"/>`,
  styles: [`
    .board{display:flex;gap:12px;overflow-x:auto;padding:2px 0 16px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;min-height:60vh}
    .col{flex:0 0 268px;display:flex;flex-direction:column;scroll-snap-align:start}
    .col-h{display:flex;align-items:center;justify-content:space-between;padding:6px 6px 10px}
    .col-t{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600}.col-t em{font-style:normal;color:var(--muted);font-weight:500;font-size:11px}
    .dot{width:8px;height:8px;border-radius:50%;background:var(--muted)}.dot.talking{background:var(--blue)}.dot.quoted{background:var(--amber)}.dot.closing{background:var(--purple)}.dot.won{background:var(--green)}.dot.lost{background:var(--faint)}
    .col-n{font-size:11px;color:var(--muted);background:var(--surface);border:1px solid var(--line);padding:2px 8px;border-radius:999px;font-weight:600;font-variant-numeric:tabular-nums}
    .col-b{flex:1;display:flex;flex-direction:column;gap:8px;min-height:120px;padding:4px;border-radius:12px;transition:background var(--dur) var(--ease)}
    .col-b.cdk-drop-list-dragging{background:var(--brand-soft-2);outline:2px dashed var(--brand);outline-offset:-2px}
    .col.done{opacity:.85}
    .dc{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 12px 12px 16px;cursor:grab;transition:border-color var(--dur) var(--ease)}
    .dc:hover{border-color:var(--line-2)}.dc:active{cursor:grabbing}
    .dc-rail{position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--line-2)}
    .dc-rail.talking{background:var(--blue)}.dc-rail.quoted{background:var(--amber)}.dc-rail.closing{background:var(--purple)}.dc-rail.won{background:var(--green)}
    .dc strong{display:block;font-size:13.5px;font-weight:600;letter-spacing:-.01em}
    .dc-sub{display:block;font-size:12px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dc-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
    .dc-val{font-size:12px;font-weight:700;color:var(--green);font-variant-numeric:tabular-nums}
    .dc-next{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);--ico:12px}
    .dc-warn{display:inline-block;margin-top:8px;font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;background:var(--amber-soft);color:var(--amber)}.dc-warn.red{background:var(--red-soft);color:var(--red)}
    .cdk-drag-preview{box-shadow:var(--sh-lg);border-radius:12px;opacity:.95}.cdk-drag-placeholder{opacity:0}.dc-ph{min-height:64px;border:2px dashed var(--line-2);border-radius:12px}
    .cdk-drag-animating{transition:transform 200ms var(--ease)}
    .col-empty{padding:22px 10px;text-align:center;font-size:12px;color:var(--faint);border:1px dashed var(--line);border-radius:12px}
    th.s{cursor:pointer;user-select:none}
    .st{min-height:30px;padding:2px 24px 2px 9px;border-radius:999px;border:1px solid transparent;font-size:11.5px;font-weight:600;background:var(--surface-2);color:var(--ink-2);appearance:none;-webkit-appearance:none;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f7078' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 7px center;background-size:11px}
    .st.talking{background-color:var(--blue-soft);color:var(--blue)}.st.quoted{background-color:var(--amber-soft);color:var(--amber)}.st.closing{background-color:var(--purple-soft);color:var(--purple)}.st.won{background-color:var(--green-soft);color:var(--green)}.st.lost{color:var(--muted)}
    .warn{color:var(--amber);font-weight:600}.due{font-style:normal;color:var(--muted)}
    .acts{text-align:right}
    @media (max-width:760px){.col{flex-basis:84vw}.board{scroll-snap-type:x mandatory}}`]
})
export class PipelineComponent implements OnInit, OnDestroy {
  cast = inject(CastService); data = inject(DataService); private route = inject(ActivatedRoute);
  waLink = waLink;
  view = signal<'board' | 'list'>('board'); adding = signal(false); sel = signal<Deal | null>(null);
  lf = signal('open'); sortKey = signal('value'); sortDir = signal<1 | -1>(-1);
  listFilters: [string, string][] = [['open', 'Open'], ['won', 'Won'], ['lost', 'Lost'], ['all', 'All']];
  stages = computed(() => this.cast.cast()?.stages || []);
  ngOnInit(){
    try { const v = localStorage.getItem('bbos_pipe_view'); if (v === 'list' || v === 'board') this.view.set(v); } catch {}
    this.qs = this.route.queryParams.subscribe(p => {
      if (p['open']) { const d = this.data.deals().find(x => x.id === p['open']); if (d) this.sel.set(d); }
      if (p['view'] === 'board' || p['view'] === 'list') this.setView(p['view']);
      if (p['add']) this.adding.set(true);
    });
  }
  private qs: any;
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  setView(v: 'board' | 'list'){ this.view.set(v); try { localStorage.setItem('bbos_pipe_view', v); } catch {} }
  open(d: Deal){ return d.stage !== 'won' && d.stage !== 'lost'; }
  quiet(d: Deal){ return daysSince(d.lastContactAt || d.stageAt || d.createdAt); }
  sub = computed(() => { const n = this.data.openDeals().length, v = this.data.pipeValue();
    return n ? `${n} ${n === 1 ? 'deal' : 'deals'} in progress${v ? ', worth ' + this.cast.money(v) : ''}${this.data.weighted() ? ', ' + this.cast.moneyShort(this.data.weighted()) + ' weighted' : ''}.` : 'Every deal you are working, by stage. Drag a card to move it.'; });
  columns = computed(() => {
    const cols: { key: Stage; label: string; prob: number | null; deals: Deal[]; value: number }[] = [];
    const add = (key: Stage, label: string, prob: number | null) => { const deals = this.data.deals().filter(d => d.stage === key).sort((a, b) => (b.value || 0) - (a.value || 0)); cols.push({ key, label, prob, deals, value: deals.reduce((a, d) => a + (Number(d.value) || 0), 0) }); };
    this.stages().forEach(s => add(s.key, s.label, s.prob)); add('won', 'Won', 100); add('lost', 'Lost', null); return cols;
  });
  async drop(ev: CdkDragDrop<Stage>){ const d: Deal = ev.item.data; const to = ev.container.data; if (d.stage === to) return; await this.move(d, to); }
  async move(d: Deal, to: Stage){
    if (to === 'lost') { const reason = prompt(`Why was ${d.name} lost?`, 'No response') ?? ''; if (reason === '' && !confirm('Mark lost without a reason?')) return; await this.data.moveDeal(d.id, 'lost', { lostReason: reason }); this.data.toast('Marked lost'); return; }
    await this.data.moveDeal(d.id, to);
    if (to === 'won') this.data.toast(`${d.name} is now a customer`, '/sales/customers', 'See them'); else this.data.toast('Moved to ' + (this.stages().find(s => s.key === to)?.label || to));
  }
  listRows = computed(() => { const f = this.lf(); const k = this.sortKey(), dir = this.sortDir();
    return this.data.deals().filter(d => f === 'all' || (f === 'open' ? this.open(d) : d.stage === f)).sort((a, b) => {
      const va = k === 'value' ? (a.value || 0) : k === 'quiet' ? this.quiet(a) : k === 'stage' ? this.stageIdx(a.stage) : a.name.toLowerCase();
      const vb = k === 'value' ? (b.value || 0) : k === 'quiet' ? this.quiet(b) : k === 'stage' ? this.stageIdx(b.stage) : b.name.toLowerCase();
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir; }); });
  stageIdx(s: Stage){ const i = this.stages().findIndex(x => x.key === s); return i < 0 ? (s === 'won' ? 90 : 99) : i; }
  sortBy(k: string){ if (this.sortKey() === k) this.sortDir.set(this.sortDir() === 1 ? -1 : 1); else { this.sortKey.set(k); this.sortDir.set(k === 'name' ? 1 : -1); } }
  arrow(k: string){ return this.sortKey() === k ? (this.sortDir() === 1 ? ' ↑' : ' ↓') : ''; }
  onAdded(d: Deal){ this.adding.set(false); this.sel.set(d); }
}
