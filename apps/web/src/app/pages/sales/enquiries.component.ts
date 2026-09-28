import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, niceDate, ago } from '../../core/data.service';
import { DraftService } from '../../core/draft.service';
import { ScreenService } from '../../core/screen.service';
import { AskService } from '../../core/ask.service';
import { Enquiry, EnquiryStatus } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';

const BLANK = { name: '', phone: '', source: '', wants: '' };
const COLS: { key: EnquiryStatus; label: string; empty: string }[] = [
  { key: 'new', label: 'Waiting', empty: 'Nothing waiting' }, { key: 'contacted', label: 'Talking', empty: 'Nobody in talks' },
  { key: 'converted', label: 'Started', empty: 'Drop here to start a deal' }, { key: 'closed', label: 'Not a fit', empty: 'Nothing set aside' }];

/* The inbox. Everyone who asked, where they came from and what they want. Rows move through
   stages, so it is a BOARD and a LIST on one remembered switch (kanban law). Dropping a card on
   Started opens the deal in the pipeline and keeps the link back. */
@Component({
  selector: 'bb-enquiries',
  standalone: true,
  imports: [FormsModule, DragDropModule, DrawerComponent, IconComponent, FilterBarComponent, MoreComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">{{ cast.word('enquiries','Enquiries') }}</h1><p>Everyone who has asked. Start one and it moves to your pipeline.</p></div>
      <div class="ph-right">
        <div class="seg" role="group" aria-label="View">
          <button type="button" data-act="enquiries-view-board" [class.on]="view() === 'board'" [attr.aria-pressed]="view() === 'board'" (click)="setView('board')"><bb-icon name="board"/><span>Board</span></button>
          <button type="button" data-act="enquiries-view-list" [class.on]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="setView('list')"><bb-icon name="list"/><span>List</span></button>
        </div>
        <button class="btn" type="button" data-act="enquiry-new" (click)="openAdd()"><bb-icon name="plus"/><span>New {{ word() }}</span></button>
      </div></div>

    <div class="kpi">
      <div class="card"><div class="k-label">Waiting</div><div class="k-val">{{ data.waiting().length }}</div><div class="k-sub">to answer</div></div>
      <div class="card"><div class="k-label">This week</div><div class="k-val">{{ week() }}</div><div class="k-sub">came in</div></div>
      <div class="card"><div class="k-label">Started</div><div class="k-val up">{{ converted() }}</div><div class="k-sub">now in the pipeline</div></div>
      <div class="card"><div class="k-label">Top source</div><div class="k-val src">{{ topSource() || 'None yet' }}</div><div class="k-sub">where they find you</div></div>
    </div>

    <bb-filter-bar class="fbar" [state]="f" [query]="q" [defs]="defs()" placeholder="Search enquiries" label="Search by name, number or what they want"
      [count]="rows().length" [noun]="word()" [nouns]="words()" store="enquiries"/>

    @if (data.loading()) {
      <div class="card skel" aria-busy="true" aria-label="Loading enquiries"><i></i><i></i><i></i><i></i></div>
    } @else if (view() === 'board') {
      <div class="board" cdkDropListGroup>
        @for (col of columns(); track col.key) {
          <section class="col" [attr.aria-label]="col.label">
            <div class="col-h"><span class="col-t"><i class="dot" [class]="'dot ' + col.key"></i>{{ col.label }}</span><span class="col-n">{{ col.rows.length }}</span></div>
            <div class="col-b" cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)">
              @for (e of col.rows.slice(0, colShown()[col.key] || 15); track e.id) {
                <button type="button" class="dc" data-act="enquiry-open" cdkDrag [cdkDragData]="e" [cdkDragStartDelay]="touch ? 220 : 0" [cdkDragDisabled]="e.status === 'converted'" (click)="open(e)">
                  <strong>{{ e.name }}</strong>
                  <span class="dc-sub">{{ e.wants || e.phone || 'No details yet' }}</span>
                  <span class="dc-meta"><span>{{ when(e.createdAt) }}</span>@if (e.source) { <span>{{ e.source }}</span> }</span>
                  <div class="dc-ph" *cdkDragPlaceholder></div>
                </button>
              } @empty { <div class="col-empty">{{ col.empty }}</div> }
              @if (col.rows.length > (colShown()[col.key] || 15)) { <button type="button" class="btn ghost sm col-more" data-act="enquiries-column-more" (click)="colMore(col.key)">Show 15 more of {{ col.rows.length }}</button> }
            </div>
          </section>
        }
      </div>
    } @else {
      <div class="card">
        @if (screen.wide()) {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Name</th><th>Wants</th><th>Source</th><th>Status</th><th>Came in</th><th><span class="sr">Actions</span></th></tr></thead>
            <tbody>
              @for (e of rows().slice(0, shown()); track e.id) {
                <tr data-act="enquiry-open" tabindex="0" (click)="open(e)" (keydown.enter)="open(e)">
                  <td><div class="who"><span class="avatar">{{ e.name.slice(0,1) }}</span><div><strong>{{ e.name }}</strong><span>{{ e.phone || 'No number' }}</span></div></div></td>
                  <td>{{ e.wants || '' }}</td>
                  <td>{{ e.source || '' }}</td>
                  <td><span class="pill" [class]="'pill ' + e.status"><i class="dot"></i>{{ label(e.status) }}</span></td>
                  <td class="t-small">{{ when(e.createdAt) }}</td>
                  <td class="acts" (click)="$event.stopPropagation()">
                    @if (e.status === 'new' || e.status === 'contacted') { <button class="btn sm" type="button" data-act="enquiry-start-row" (click)="start(e)">Start</button> }
                  </td>
                </tr>
              } @empty { <tr><td colspan="6"><div class="empty"><strong>{{ emptyTitle() }}</strong>{{ emptyBody() }}</div></td></tr> }
            </tbody>
          </table>
        </div>
        } @else {
        <div class="list phone">
          @for (e of rows().slice(0, shown()); track e.id) {
            <button type="button" class="li link" data-act="enquiry-open" (click)="open(e)">
              <span class="avatar">{{ e.name.slice(0,1) }}</span>
              <span class="tx"><strong>{{ e.name }}</strong><span>{{ line(e.wants, e.source, when(e.createdAt)) }}</span></span>
              <span class="pill" [class]="'pill ' + e.status">{{ label(e.status) }}</span>
            </button>
          } @empty { <div class="empty"><strong>{{ emptyTitle() }}</strong>{{ emptyBody() }}</div> }
        </div>
        }
        <bb-more [total]="rows().length" [shown]="min(shown(), rows().length)" (more)="shown.set(shown() + 30)"/>
      </div>
    }

    <bb-drawer [open]="adding()" [title]="'New ' + word()" [message]="msg()" (closed)="adding.set(false)">
      <ng-template #body>
      @if (restored()) { <div class="kept"><span>Picked up where you left off.</span><button type="button" class="btn quiet sm" data-act="enquiry-draft-clear" (click)="fresh()">Start again</button></div> }
      <div class="form-grid" (input)="keep()" (change)="keep()">
        <div class="field span"><label for="en-name">Who enquired</label><input id="en-name" type="text" [(ngModel)]="draft.name" placeholder="Nimal Perera" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!msg()"></div>
        <div class="field"><label for="en-phone">Their number</label><input id="en-phone" type="tel" inputmode="tel" [(ngModel)]="draft.phone" placeholder="077 123 4567" autocomplete="off" enterkeyhint="next"></div>
        <div class="field"><label for="en-src">Where from</label><select id="en-src" [(ngModel)]="draft.source"><option value="">Not sure</option>@for (s of sources(); track s) { <option [value]="s">{{ s }}</option> }</select></div>
        <div class="field span"><label for="en-wants">What they want</label><input id="en-wants" type="text" [(ngModel)]="draft.wants" placeholder="20kg cinnamon a month, delivered" autocomplete="off" enterkeyhint="go" (keydown.enter)="save()"></div>
      </div>
      </ng-template>
      <ng-template #foot>
        <button class="btn" type="button" data-act="enquiry-add" [disabled]="busy()" (click)="save()">Add {{ word() }}</button>
        <div class="pair"><button class="btn ghost" type="button" data-act="enquiry-add-start" [disabled]="busy()" (click)="save(true)">Add and start a deal</button></div>
        <button class="btn quiet" type="button" data-act="enquiry-add-cancel" (click)="adding.set(false)">Cancel</button>
      </ng-template>
    </bb-drawer>

    <bb-drawer [open]="!!sel()" [title]="sel()?.name || ''" [editable]="!!sel() && !editing()" [message]="editing() ? emsg() : ''" (edit)="beginEdit()" (closed)="closeSheet()">
      <ng-template #body>
      @if (sel(); as e) {
        @if (editing()) {
          <div class="form-grid" (input)="keepEdit()" (change)="keepEdit()">
            <div class="field span"><label for="ee-name">Name</label><input id="ee-name" type="text" [(ngModel)]="ed.name" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!emsg()"></div>
            <div class="field"><label for="ee-phone">Number</label><input id="ee-phone" type="tel" inputmode="tel" [(ngModel)]="ed.phone" autocomplete="off" enterkeyhint="next"></div>
            <div class="field"><label for="ee-src">Where from</label><select id="ee-src" [(ngModel)]="ed.source"><option value="">Not sure</option>@for (s of sources(); track s) { <option [value]="s">{{ s }}</option> }</select></div>
            <div class="field span"><label for="ee-wants">What they want</label><input id="ee-wants" type="text" [(ngModel)]="ed.wants" autocomplete="off" enterkeyhint="done"></div>
          </div>
        } @else {
          <div class="sheet-pills">
            <span class="pill" [class]="'pill ' + e.status"><i class="dot"></i>{{ label(e.status) }}</span>
            @if (e.source) { <span class="pill">{{ e.source }}</span> }
            <span class="pill">{{ when(e.createdAt) }}</span>
          </div>
          <dl class="facts">
            <div class="f"><dt>Number</dt><dd [class.none]="!e.phone">{{ e.phone || 'Not given' }}</dd></div>
            <div class="f"><dt>Where from</dt><dd [class.none]="!e.source">{{ e.source || 'Not sure' }}</dd></div>
            <div class="f span"><dt>What they want</dt><dd [class.none]="!e.wants">{{ e.wants || 'Not written down yet' }}</dd></div>
          </dl>
        }
      }
      </ng-template>
      <ng-template #foot>@if (sel(); as e) {
        @if (editing()) {
          <button class="btn" type="button" data-act="enquiry-save" [disabled]="busy()" (click)="saveEdit(e)">Save changes</button>
          <button class="btn quiet" type="button" data-act="enquiry-edit-cancel" (click)="cancelEdit(e)">Cancel</button>
        } @else {
          @if (e.dealId) { <button class="btn" type="button" data-act="enquiry-open-deal" (click)="goDeal(e)"><bb-icon name="pipe"/><span>Open the deal</span></button> }
          @else if (e.status === 'closed') { <button class="btn" type="button" data-act="enquiry-reopen" (click)="patch(e, { status: 'new' })"><span>Put back in Waiting</span></button> }
          @else { <button class="btn" type="button" data-act="enquiry-start" [disabled]="busy()" (click)="start(e)"><bb-icon name="pipe"/><span>Start a deal</span></button> }
          @if (waLink(e.phone, e.name) || (!e.dealId && e.status !== 'closed')) {
            <div class="pair">
              @if (waLink(e.phone, e.name); as w) { <a class="btn wa-ghost" data-act="enquiry-whatsapp" [href]="w" target="_blank" rel="noreferrer" (click)="touched(e)"><bb-icon name="wa"/><span>WhatsApp</span></a> }
              @if (!e.dealId && e.status !== 'closed') { <button class="btn ghost" type="button" data-act="enquiry-not-fit" (click)="patch(e, { status: 'closed' })">Not a fit</button> }
            </div>
          }
          <button class="btn quiet warn" type="button" data-act="enquiry-remove" (click)="remove(e)">Remove</button>
        }
      }</ng-template>
    </bb-drawer>`,
  styles: [`
    .k-val.src{font-size:19px;padding-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .fbar{margin-top:16px}
    .acts{white-space:nowrap;text-align:right}
    
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    tr:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}
    .dot.new{background:var(--blue)}.dot.contacted{background:var(--amber)}.dot.converted{background:var(--green)}.dot.closed{background:var(--faint)}
    `]
})
export class EnquiriesComponent implements OnInit, OnDestroy {
  cast = inject(CastService); data = inject(DataService); screen = inject(ScreenService); private drafts = inject(DraftService); private ask = inject(AskService);
  private route = inject(ActivatedRoute); private router = inject(Router);
  waLink = waLink; min = Math.min;
  touch = matchMedia('(pointer:coarse)').matches;
  view = signal<'board' | 'list'>('board');
  q = signal(''); f = signal<Record<string, string>>({});
  shown = signal(WINDOW); colShown = signal<Record<string, number>>({});
  adding = signal(false); sel = signal<Enquiry | null>(null); editing = signal(false);
  msg = signal(''); emsg = signal(''); busy = signal(false); restored = signal(false);
  draft: typeof BLANK = { ...BLANK }; ed: typeof BLANK = { ...BLANK };
  word = computed(() => this.cast.word('enquiry', 'enquiry').toLowerCase());
  words = computed(() => this.cast.word('enquiries', 'enquiries').toLowerCase());
  sources = computed(() => this.cast.cast()?.sources || []);
  defs = computed<FilterDef[]>(() => {
    const d: FilterDef[] = [];
    if (this.view() === 'list') d.push({ key: 'status', label: 'Status', all: 'Every status', options: COLS.map(c => ({ value: c.key, label: c.label })) });
    d.push({ key: 'source', label: 'Where from', all: 'Every source', options: this.sources().map(s => ({ value: s, label: s })) });
    d.push({ key: 'when', label: 'Came in', all: 'Any time', options: [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }] });
    return d;
  });
  private qs: any;
  constructor(){ effect(() => { this.q(); this.f(); this.view(); this.shown.set(WINDOW); this.colShown.set({}); }); }
  ngOnInit(){
    try { const v = localStorage.getItem('hub_enq_view'); if (v === 'list' || v === 'board') this.view.set(v); } catch {}
    this.qs = this.route.queryParams.subscribe(p => this.spend(p));
  }
  /* AN ADDRESS THAT CARRIES AN ORDER IS SPENT ONCE. "add", "open" and "view" in the address are taken
     out of it before they are acted on, so a reload or a step Back never opens the same sheet twice. */
  private async spend(p: any){
    if (!p['view'] && !p['add'] && !p['open']) return;
    await this.router.navigate([], { relativeTo: this.route, queryParams: { view: null, add: null, open: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (p['view'] === 'board' || p['view'] === 'list') this.setView(p['view']);
    if (p['add']) this.openAdd();
    if (p['open']) { const e = this.data.enquiries().find(x => x.id === p['open']); if (e) this.open(e); }
  }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  setView(v: 'board' | 'list'){ this.view.set(v); try { localStorage.setItem('hub_enq_view', v); } catch {} }
  rows = computed(() => { const f = this.f(), q = this.q().trim().toLowerCase(), list = this.view() === 'list';
    const since = f['when'] ? Date.now() - Number(f['when']) * 864e5 : 0;
    return this.data.enquiries().filter(e => (!list || !f['status'] || e.status === f['status']) && (!f['source'] || e.source === f['source'])
      && (!since || new Date(e.createdAt).getTime() >= since)
      && (!q || [e.name, e.phone, e.wants, e.source].join(' ').toLowerCase().includes(q))); });
  columns = computed(() => COLS.map(c => ({ ...c, rows: this.rows().filter(e => e.status === c.key) })));
  colMore(k: string){ this.colShown.set({ ...this.colShown(), [k]: (this.colShown()[k] || 15) + 15 }); }
  week = computed(() => this.data.enquiries().filter(e => (Date.now() - new Date(e.createdAt).getTime()) < 7 * 864e5).length);
  converted = computed(() => this.data.enquiries().filter(e => e.status === 'converted').length);
  topSource = computed(() => { const m = new Map<string, number>(); this.data.enquiries().forEach(e => e.source && m.set(e.source, (m.get(e.source) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || ''; });
  label(s: string){ return COLS.find(c => c.key === s)?.label || s; }
  line(...p: (string | undefined)[]){ return p.filter(Boolean).join(' · '); }
  when(iso: string){ const a = ago(iso); return a === 'today' || a === 'yesterday' ? a[0].toUpperCase() + a.slice(1) : niceDate(iso); }
  filtered = computed(() => !!this.q().trim() || Object.values(this.f()).some(Boolean));
  emptyTitle(){ return this.filtered() ? 'No match' : 'No ' + this.words() + ' yet'; }
  emptyBody(){ return this.filtered() ? 'Try another name or clear the filters.' : 'When someone asks about your work, add them and they land here.'; }

  /* the add form: its draft is kept on the device as it is typed */
  openAdd(){ this.restored.set(this.drafts.has('enquiry-new')); this.draft = this.drafts.load('enquiry-new', BLANK); this.msg.set(''); this.adding.set(true); }
  keep(){ this.drafts.keep('enquiry-new', this.draft); if (this.msg() && (this.draft.name || '').trim()) this.msg.set(''); }
  fresh(){ this.drafts.clear('enquiry-new'); this.draft = { ...BLANK }; this.restored.set(false); this.msg.set(''); }
  async save(andStart = false){
    const name = (this.draft.name || '').trim(); if (!name) { this.msg.set('Add their name first. It is the one thing needed.'); document.getElementById('en-name')?.focus(); return; }
    if (this.busy()) return; this.busy.set(true);
    try {
      const e = await this.data.addEnquiry({ ...this.draft, name, phone: this.draft.phone.trim(), wants: this.draft.wants.trim() });
      this.drafts.clear('enquiry-new'); this.adding.set(false);
      if (andStart) await this.convert(e); else this.data.toast(`${name} added`);
    } finally { this.busy.set(false); }
  }

  open(e: Enquiry){ this.sel.set(e); this.emsg.set(''); const key = 'enquiry-edit-' + e.id;
    if (this.drafts.has(key)) { this.ed = this.drafts.load(key, this.from(e)); this.editing.set(true); } else this.editing.set(false); }
  closeSheet(){ this.sel.set(null); this.editing.set(false); }
  private from(e: Enquiry){ return { name: e.name || '', phone: e.phone || '', source: e.source || '', wants: e.wants || '' }; }
  beginEdit(){ const e = this.sel(); if (!e) return; this.ed = this.drafts.load('enquiry-edit-' + e.id, this.from(e)); this.emsg.set(''); this.editing.set(true); }
  keepEdit(){ const e = this.sel(); if (e) this.drafts.keep('enquiry-edit-' + e.id, this.ed); if (this.emsg() && this.ed.name.trim()) this.emsg.set(''); }
  cancelEdit(e: Enquiry){ this.drafts.clear('enquiry-edit-' + e.id); this.editing.set(false); this.emsg.set(''); }
  async saveEdit(e: Enquiry){
    const name = this.ed.name.trim(); if (!name) { this.emsg.set('A name is needed. Put it back to save.'); return; }
    if (this.busy()) return; this.busy.set(true);
    try { await this.patch(e, { name, phone: this.ed.phone.trim(), source: this.ed.source, wants: this.ed.wants.trim() });
      /* an enquiry that became a deal carries its name and number there too */
      if (e.dealId) await this.data.updateDeal(e.dealId, { name, phone: this.ed.phone.trim(), wants: this.ed.wants.trim() });
      this.drafts.clear('enquiry-edit-' + e.id); this.editing.set(false); this.data.toast('Saved'); }
    finally { this.busy.set(false); }
  }
  async start(e: Enquiry){ if (this.busy()) return; this.busy.set(true); try { await this.convert(e); } finally { this.busy.set(false); } }
  /* the move itself, with no guard of its own: Add and start calls it while its own save is still
     marked busy, and a guard here made that button add the enquiry and quietly start nothing */
  private async convert(e: Enquiry){ await this.data.convertEnquiry(e); this.closeSheet(); this.data.toast(`${e.name} is in your pipeline`, '/sales/pipeline', 'See it'); }
  async patch(e: Enquiry, p: Partial<Enquiry>){ const r = await this.data.updateEnquiry(e.id, p); if (r && this.sel()?.id === e.id) this.sel.set(r); }
  async touched(e: Enquiry){ if (e.status === 'new') await this.patch(e, { status: 'contacted' }); }
  async remove(e: Enquiry){
    if (!(await this.ask.confirm({ title: `Remove ${e.name}?`, body: e.dealId ? 'The enquiry goes. The deal in your pipeline stays.' : 'This enquiry is removed for both seats.', yes: 'Remove', danger: true }))) return;
    await this.data.removeEnquiry(e.id); this.drafts.clear('enquiry-edit-' + e.id); this.closeSheet(); this.data.toast(`${e.name} removed`);
  }
  goDeal(e: Enquiry){ const id = e.dealId; this.closeSheet(); this.router.navigate(['/sales/pipeline'], { queryParams: { open: id }, replaceUrl: true }); }
  /* a drop never skips a rule: Started opens the deal, anything else only changes the status */
  async drop(ev: CdkDragDrop<EnquiryStatus>){ const e: Enquiry = ev.item.data, to = ev.container.data; if (e.status === to) return;
    if (to === 'converted') { await this.start(e); return; }
    await this.patch(e, { status: to }); this.data.toast('Moved to ' + this.label(to)); }
}
