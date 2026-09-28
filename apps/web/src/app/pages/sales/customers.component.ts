import { Component, inject, computed, signal, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, niceDate, daysSince, today, since } from '../../core/data.service';
import { DraftService } from '../../core/draft.service';
import { ScreenService } from '../../core/screen.service';
import { AskService } from '../../core/ask.service';
import { Customer } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { FilterBarComponent, FilterDef } from '../../ui/filter-bar.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';

const BLANK = { name: '', phone: '', value: '', bought: '', notes: '' };
/* Everyone who has bought. A won deal lands here on its own with what they bought and what it
   was worth; the owner can add one directly too. Lifetime value and the last contact, so the
   quiet ones are visible. */
@Component({
  selector: 'bb-customers',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent, FilterBarComponent, MoreComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">{{ cast.word('customers','Customers') }}</h1><p>People who have bought from you. A won deal lands here on its own.</p></div>
      <div class="ph-right"><button class="btn" type="button" data-act="customer-new" (click)="openAdd()"><bb-icon name="plus"/><span>New {{ word() }}</span></button></div></div>
    <div class="kpi">
      <div class="card"><div class="k-label">{{ cast.word('customers','Customers') }}</div><div class="k-val">{{ data.customers().length.toLocaleString('en-GB') }}</div><div class="k-sub">on the books</div></div>
      <div class="card"><div class="k-label">Lifetime value</div><div class="k-val up">{{ cast.moneyShort(ltv()) || '0' }}</div><div class="k-sub">all time</div></div>
      <div class="card"><div class="k-label">Average sale</div><div class="k-val">{{ data.customers().length ? cast.moneyShort(ltv() / data.customers().length) : '0' }}</div><div class="k-sub">per {{ word() }}</div></div>
      <div class="card"><div class="k-label">Quiet</div><div class="k-val" [class.warn]="quietOnes()">{{ quietOnes() }}</div><div class="k-sub">not heard from in 30 days</div></div>
    </div>
    <bb-filter-bar class="fbar" [state]="f" [query]="q" [defs]="defs" placeholder="Search customers" label="Search by name, number or what they bought"
      [count]="rows().length" [noun]="word()" [nouns]="words()" store="customers"/>
    @if (data.loading()) {
      <div class="card skel" aria-busy="true" aria-label="Loading customers"><i></i><i></i><i></i><i></i></div>
    } @else {
      <div class="card">
        @if (screen.wide()) {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Name</th><th>Bought</th><th>Since</th><th class="num">Value</th><th>Last touch</th></tr></thead>
            <tbody>
              @for (c of rows().slice(0, shown()); track c.id) {
                <tr data-act="customer-open" tabindex="0" (click)="open(c)" (keydown.enter)="open(c)">
                  <td><div class="who"><span class="avatar">{{ c.name.slice(0,1) }}</span><div><strong>{{ c.name }}</strong><span>{{ c.phone || 'No number' }}</span></div></div></td>
                  <td>{{ c.bought || '' }}</td><td class="t-small">{{ niceDate(c.since) }}</td>
                  <td class="num">{{ cast.money(c.value) || '' }}</td>
                  <td class="t-small" [class.warn]="quiet(c) >= 30">{{ since(quiet(c)) }}</td>
                </tr>
              } @empty { <tr><td colspan="5"><div class="empty"><strong>{{ emptyTitle() }}</strong>{{ emptyBody() }}</div></td></tr> }
            </tbody>
          </table>
        </div>
        } @else {
        <div class="list phone">
          @for (c of rows().slice(0, shown()); track c.id) {
            <button type="button" class="li link" data-act="customer-open" (click)="open(c)"><span class="avatar">{{ c.name.slice(0,1) }}</span>
              <span class="tx"><strong>{{ c.name }}</strong><span>{{ line(c.bought, cast.moneyShort(c.value), 'since ' + niceDate(c.since)) }}</span></span>
              <bb-icon name="chev" class="go"/></button>
          } @empty { <div class="empty"><strong>{{ emptyTitle() }}</strong>{{ emptyBody() }}</div> }
        </div>
        }
        <bb-more [total]="rows().length" [shown]="min(shown(), rows().length)" (more)="shown.set(shown() + 30)"/>
      </div>
    }

    <bb-drawer [open]="adding()" [title]="'New ' + word()" [message]="msg()" (closed)="adding.set(false)">
      <ng-template #body>
      @if (restored()) { <div class="kept"><span>Picked up where you left off.</span><button type="button" class="btn quiet sm" data-act="customer-draft-clear" (click)="fresh()">Start again</button></div> }
      <div class="form-grid" (input)="keep()" (change)="keep()">
        <div class="field span"><label for="cu-name">Name</label><input id="cu-name" type="text" [(ngModel)]="draft.name" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!msg()"></div>
        <div class="field"><label for="cu-phone">Their number</label><input id="cu-phone" type="tel" inputmode="tel" [(ngModel)]="draft.phone" autocomplete="off" enterkeyhint="next"></div>
        <div class="field"><label for="cu-value">Worth ({{ cast.word('currency','LKR') }})</label><input id="cu-value" type="text" inputmode="numeric" [(ngModel)]="draft.value" placeholder="0" autocomplete="off" enterkeyhint="next"></div>
        <div class="field span"><label for="cu-bought">What they bought</label><input id="cu-bought" type="text" [(ngModel)]="draft.bought" autocomplete="off" enterkeyhint="go" (keydown.enter)="save()"></div>
      </div>
      </ng-template>
      <ng-template #foot>
        <button class="btn" type="button" data-act="customer-add" [disabled]="busy()" (click)="save()">Add {{ word() }}</button>
        <button class="btn quiet" type="button" data-act="customer-add-cancel" (click)="adding.set(false)">Cancel</button>
      </ng-template>
    </bb-drawer>

    <bb-drawer [open]="!!sel()" [title]="sel()?.name || ''" [editable]="!!sel() && !editing()" [message]="editing() ? emsg() : ''" (edit)="beginEdit()" (closed)="closeSheet()">
      <ng-template #body>
      @if (sel(); as c) {
        @if (editing()) {
          <div class="form-grid" (input)="keepEdit()" (change)="keepEdit()">
            <div class="field span"><label for="ce-name">Name</label><input id="ce-name" type="text" [(ngModel)]="ed.name" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!emsg()"></div>
            <div class="field"><label for="ce-phone">Number</label><input id="ce-phone" type="tel" inputmode="tel" [(ngModel)]="ed.phone" autocomplete="off" enterkeyhint="next"></div>
            <div class="field"><label for="ce-value">Worth ({{ cast.word('currency','LKR') }})</label><input id="ce-value" type="text" inputmode="numeric" [(ngModel)]="ed.value" autocomplete="off" enterkeyhint="next"></div>
            <div class="field span"><label for="ce-bought">What they bought</label><input id="ce-bought" type="text" [(ngModel)]="ed.bought" autocomplete="off" enterkeyhint="next"></div>
            <div class="field span"><label for="ce-notes">Notes</label><textarea id="ce-notes" [(ngModel)]="ed.notes" placeholder="Prefers delivery on Fridays"></textarea></div>
          </div>
        } @else {
          <div class="kpi two">
            <div class="card"><div class="k-label">Lifetime value</div><div class="k-val">{{ cast.moneyShort(c.value) || '0' }}</div></div>
            <div class="card"><div class="k-label">Since</div><div class="k-val since">{{ niceDate(c.since) }}</div></div>
          </div>
          <dl class="facts">
            <div class="f"><dt>Number</dt><dd [class.none]="!c.phone">{{ c.phone || 'Not given' }}</dd></div>
            <div class="f"><dt>Last touch</dt><dd>{{ since(quiet(c)) }}</dd></div>
            <div class="f span"><dt>What they bought</dt><dd [class.none]="!c.bought">{{ c.bought || 'Not written down yet' }}</dd></div>
            <div class="f span"><dt>Notes</dt><dd [class.none]="!c.notes">{{ c.notes || 'None yet' }}</dd></div>
          </dl>
        }
      }
      </ng-template>
      <ng-template #foot>@if (sel(); as c) {
        @if (editing()) {
          <button class="btn" type="button" data-act="customer-save" [disabled]="busy()" (click)="saveEdit(c)">Save changes</button>
          <button class="btn quiet" type="button" data-act="customer-edit-cancel" (click)="cancelEdit(c)">Cancel</button>
        } @else {
          <button class="btn" type="button" data-act="customer-spoke" [disabled]="busy()" (click)="spoke(c)"><bb-icon name="check"/><span>Spoke today</span></button>
          @if (waLink(c.phone, c.name); as w) { <div class="pair"><a class="btn wa-ghost" data-act="customer-whatsapp" [href]="w" target="_blank" rel="noreferrer" (click)="spoke(c, true)"><bb-icon name="wa"/><span>WhatsApp</span></a></div> }
          <button class="btn quiet warn" type="button" data-act="customer-remove" (click)="remove(c)">Remove</button>
        }
      }</ng-template>
    </bb-drawer>`,
  styles: [`.k-val.warn{color:var(--amber)}.warn{color:var(--amber);font-weight:600}.fbar{margin-top:16px}
    .kpi.two{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:18px}.k-val.since{font-size:19px;padding-top:6px}
    .go{color:var(--faint)}
    tr:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}
    `]
})
export class CustomersComponent implements OnInit, OnDestroy {
  cast = inject(CastService); data = inject(DataService); screen = inject(ScreenService); private drafts = inject(DraftService); private ask = inject(AskService); private route = inject(ActivatedRoute); private router = inject(Router);
  waLink = waLink; niceDate = niceDate; min = Math.min; since = since;
  q = signal(''); f = signal<Record<string, string>>({}); shown = signal(WINDOW);
  adding = signal(false); sel = signal<Customer | null>(null); editing = signal(false);
  msg = signal(''); emsg = signal(''); busy = signal(false); restored = signal(false);
  draft: typeof BLANK = { ...BLANK }; ed: typeof BLANK = { ...BLANK };
  word = computed(() => this.cast.word('customer', 'customer').toLowerCase());
  words = computed(() => this.cast.word('customers', 'customers').toLowerCase());
  defs: FilterDef[] = [
    { key: 'touch', label: 'Last touch', all: 'Everyone', options: [{ value: 'quiet', label: 'Quiet 30 days or more' }, { value: 'recent', label: 'Heard from in 30 days' }] },
    { key: 'sort', label: 'Order', all: 'Newest first', options: [{ value: 'value', label: 'Highest value first' }, { value: 'name', label: 'Name, A to Z' }] }];
  private qs: any;
  constructor(){ effect(() => { this.q(); this.f(); this.shown.set(WINDOW); }); }
  ngOnInit(){ this.qs = this.route.queryParams.subscribe(p => this.spend(p)); }
  /* AN ADDRESS THAT CARRIES AN ORDER IS SPENT ONCE. "add", "open" and "view" in the address are taken
     out of it before they are acted on, so a reload or a step Back never opens the same sheet twice. */
  private async spend(p: any){
    if (!p['add'] && !p['open']) return;
    await this.router.navigate([], { relativeTo: this.route, queryParams: { add: null, open: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (p['add']) this.openAdd();
    if (p['open']) { const r = this.data.customers().find(x => x.id === p['open']); if (r) this.open(r); }
  }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  line(...p: (string | undefined)[]){ return p.filter(Boolean).join(' · '); }
  rows = computed(() => { const q = this.q().trim().toLowerCase(), f = this.f();
    const out = this.data.customers().filter(c => (!q || [c.name, c.phone, c.bought].join(' ').toLowerCase().includes(q))
      && (!f['touch'] || (f['touch'] === 'quiet' ? this.quiet(c) >= 30 : this.quiet(c) < 30)));
    if (f['sort'] === 'value') return [...out].sort((a, b) => (b.value || 0) - (a.value || 0));
    if (f['sort'] === 'name') return [...out].sort((a, b) => a.name.localeCompare(b.name));
    return out; });
  ltv = computed(() => this.data.customers().reduce((a, c) => a + (Number(c.value) || 0), 0));
  quiet(c: Customer){ return daysSince(c.updatedAt || c.since); }
  quietOnes = computed(() => this.data.customers().filter(c => this.quiet(c) >= 30).length);
  filtered = computed(() => !!this.q().trim() || !!this.f()['touch']);
  emptyTitle(){ return this.filtered() ? 'No match' : 'No ' + this.words() + ' yet'; }
  emptyBody(){ return this.filtered() ? 'Try another name or clear the filters.' : 'Win a deal and they appear here on their own.'; }
  private num(v: any){ return Number(String(v ?? '').replace(/\D/g, '')) || 0; }

  openAdd(){ this.restored.set(this.drafts.has('customer-new')); this.draft = this.drafts.load('customer-new', BLANK); this.msg.set(''); this.adding.set(true); }
  keep(){ this.drafts.keep('customer-new', this.draft); if (this.msg() && this.draft.name.trim()) this.msg.set(''); }
  fresh(){ this.drafts.clear('customer-new'); this.draft = { ...BLANK }; this.restored.set(false); this.msg.set(''); }
  async save(){
    const n = this.draft.name.trim(); if (!n) { this.msg.set('Add their name first. It is the one thing needed.'); document.getElementById('cu-name')?.focus(); return; }
    if (this.busy()) return; this.busy.set(true);
    try { await this.data.addCustomer({ name: n, phone: this.draft.phone.trim(), bought: this.draft.bought.trim(), value: this.num(this.draft.value), since: today() });
      this.drafts.clear('customer-new'); this.adding.set(false); this.data.toast(`${n} added`); }
    finally { this.busy.set(false); }
  }
  open(c: Customer){ this.sel.set(c); this.emsg.set(''); const key = 'customer-edit-' + c.id;
    if (this.drafts.has(key)) { this.ed = this.drafts.load(key, this.from(c)); this.editing.set(true); } else this.editing.set(false); }
  closeSheet(){ this.sel.set(null); this.editing.set(false); }
  private from(c: Customer){ return { name: c.name || '', phone: c.phone || '', value: c.value ? String(c.value) : '', bought: c.bought || '', notes: c.notes || '' }; }
  beginEdit(){ const c = this.sel(); if (!c) return; this.ed = this.drafts.load('customer-edit-' + c.id, this.from(c)); this.emsg.set(''); this.editing.set(true); }
  keepEdit(){ const c = this.sel(); if (c) this.drafts.keep('customer-edit-' + c.id, this.ed); if (this.emsg() && this.ed.name.trim()) this.emsg.set(''); }
  cancelEdit(c: Customer){ this.drafts.clear('customer-edit-' + c.id); this.editing.set(false); this.emsg.set(''); }
  async saveEdit(c: Customer){
    const name = this.ed.name.trim(); if (!name) { this.emsg.set('A name is needed. Put it back to save.'); return; }
    if (this.busy()) return; this.busy.set(true);
    try { const phone = this.ed.phone.trim();
      await this.patch(c, { name, phone, bought: this.ed.bought.trim(), notes: this.ed.notes.trim(), value: this.num(this.ed.value) });
      /* the deal that made this customer carries the same name and number */
      if (c.dealId && this.data.deals().some(d => d.id === c.dealId)) await this.data.updateDeal(c.dealId, { name, phone });
      this.drafts.clear('customer-edit-' + c.id); this.editing.set(false); this.data.toast('Saved'); }
    finally { this.busy.set(false); }
  }
  async patch(c: Customer, p: Partial<Customer>){ const r = await this.data.updateCustomer(c.id, p); if (r && this.sel()?.id === c.id) this.sel.set(r); }
  async spoke(c: Customer, quietly = false){ await this.patch(c, {}); if (!quietly) this.data.toast('Marked as spoken to today'); }
  async remove(c: Customer){
    if (!(await this.ask.confirm({ title: `Remove ${c.name}?`, body: 'This customer is removed for both seats. Any deal stays in the pipeline.', yes: 'Remove', danger: true }))) return;
    await this.data.removeCustomer(c.id); this.drafts.clear('customer-edit-' + c.id); this.closeSheet(); this.data.toast(`${c.name} removed`);
  }
}
