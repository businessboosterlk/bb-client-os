import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, niceDate, ago } from '../../core/data.service';
import { Enquiry } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';

/* The inbox. Every person who asked, with where they came from and what they want.
   A table on a desk, cards on a phone, one drawer to add and one to work a row.
   Start moves it into the pipeline and keeps the link back. */
@Component({
  selector: 'bb-enquiries',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">{{ cast.word('enquiries','Enquiries') }}</h1><p>Everyone who has asked. Start one and it moves to your pipeline.</p></div>
      <div class="ph-right"><button class="btn" type="button" (click)="openAdd()"><bb-icon name="plus"/>New {{ cast.word('enquiry','enquiry').toLowerCase() }}</button></div></div>

    <div class="kpi">
      <div class="card"><div class="k-label">Waiting</div><div class="k-val">{{ data.waiting().length }}</div><div class="k-sub">to answer</div></div>
      <div class="card"><div class="k-label">This week</div><div class="k-val">{{ week().length }}</div><div class="k-sub">came in</div></div>
      <div class="card"><div class="k-label">Started</div><div class="k-val up">{{ converted().length }}</div><div class="k-sub">now in the pipeline</div></div>
      <div class="card"><div class="k-label">Top source</div><div class="k-val src">{{ topSource() || 'none yet' }}</div><div class="k-sub">where they find you</div></div>
    </div>

    <div class="toolbar" style="margin-top:18px">
      <div class="search grow"><bb-icon name="search"/><input type="search" placeholder="Search by name, number or what they want" [ngModel]="q()" (ngModelChange)="q.set($event)" enterkeyhint="search"></div>
      <div class="chips">
        @for (f of filters; track f[0]) { <button type="button" [class.on]="status() === f[0]" (click)="status.set(f[0])">{{ f[1] }}@if (count(f[0]); as n) { <span class="n">{{ n }}</span> }</button> }
      </div>
    </div>

    <div class="card">
      <div class="tbl-wrap desk">
        <table class="tbl">
          <thead><tr><th>Name</th><th>Wants</th><th>Source</th><th>Status</th><th>Came in</th><th></th></tr></thead>
          <tbody>
            @for (e of rows(); track e.id) {
              <tr (click)="sel.set(e)">
                <td><div class="who"><span class="avatar">{{ e.name.slice(0,1) }}</span><div><strong>{{ e.name }}</strong><span>{{ e.phone || 'no number' }}</span></div></div></td>
                <td>{{ e.wants || '' }}</td>
                <td>{{ e.source || '' }}</td>
                <td><span class="pill" [class]="'pill ' + e.status"><i class="dot"></i>{{ label(e.status) }}</span></td>
                <td class="t-small">{{ when(e.createdAt) }}</td>
                <td class="acts" (click)="$event.stopPropagation()">
                  @if (e.status === 'new') { <button class="btn sm" type="button" (click)="start(e)">Start</button> }
                  @if (waLink(e.phone, e.name); as w) { <a class="btn wa sm icon" [href]="w" target="_blank" rel="noreferrer"><bb-icon name="wa"/></a> }
                </td>
              </tr>
            } @empty { <tr><td colspan="6"><div class="empty"><strong>{{ emptyTitle() }}</strong>{{ emptyBody() }}</div></td></tr> }
          </tbody>
        </table>
      </div>
      <div class="list phone">
        @for (e of rows(); track e.id) {
          <div class="li link" (click)="sel.set(e)">
            <span class="avatar">{{ e.name.slice(0,1) }}</span>
            <span class="tx"><strong>{{ e.name }}</strong><span>{{ [e.wants, e.source, when(e.createdAt)].join(' · ') }}</span></span>
            @if (e.status === 'new') { <button class="btn sm" type="button" (click)="start(e); $event.stopPropagation()">Start</button> } @else { <span class="pill" [class]="'pill ' + e.status">{{ label(e.status) }}</span> }
          </div>
        } @empty { <div class="empty"><strong>{{ emptyTitle() }}</strong>{{ emptyBody() }}</div> }
      </div>
    </div>

    <bb-drawer [open]="adding()" [title]="'New ' + cast.word('enquiry','enquiry').toLowerCase()" (closed)="adding.set(false)">
      <div class="form-grid">
        <div class="field span"><label for="en-name">Who enquired</label><input id="en-name" type="text" [(ngModel)]="draft.name" placeholder="Nimal Perera" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="bad()"> @if (bad()) { <span class="hint" style="color:var(--red)">A name is the one thing we need.</span> }</div>
        <div class="field"><label>Their number</label><input type="tel" inputmode="tel" [(ngModel)]="draft.phone" placeholder="077 123 4567" autocomplete="off" enterkeyhint="next"></div>
        <div class="field"><label>Where from</label><select [(ngModel)]="draft.source"><option value="">Not sure</option>@for (s of cast.cast()?.sources || []; track s) { <option [value]="s">{{ s }}</option> }</select></div>
        <div class="field span"><label>What they want</label><input type="text" [(ngModel)]="draft.wants" placeholder="20kg cinnamon a month, delivered" autocomplete="off" enterkeyhint="go" (keydown.enter)="save()"></div>
      </div>
      <div foot><button class="btn" type="button" (click)="save()">Add {{ cast.word('enquiry','enquiry').toLowerCase() }}</button><button class="btn ghost" type="button" (click)="save(true)">Add and start</button></div>
    </bb-drawer>

    <bb-drawer [open]="!!sel()" [title]="sel()?.name || ''" (closed)="sel.set(null)">
      @if (sel(); as e) {
        <div class="pills" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          <span class="pill" [class]="'pill ' + e.status"><i class="dot"></i>{{ label(e.status) }}</span>
          @if (e.source) { <span class="pill">{{ e.source }}</span> }
          <span class="pill">{{ when(e.createdAt) }}</span>
        </div>
        <div class="form-grid">
          <div class="field"><label>Number</label><input type="tel" inputmode="tel" [ngModel]="e.phone || ''" (change)="patch(e, { phone: val($event) })"></div>
          <div class="field"><label>Where from</label><select [ngModel]="e.source || ''" (change)="patch(e, { source: val($event) })"><option value="">Not sure</option>@for (s of cast.cast()?.sources || []; track s) { <option [value]="s">{{ s }}</option> }</select></div>
          <div class="field span"><label>What they want</label><input type="text" [ngModel]="e.wants || ''" (change)="patch(e, { wants: val($event) })"></div>
        </div>
        @if (e.dealId) { <p class="t-small" style="margin-top:14px">This one is in your pipeline. <a class="lnk" (click)="goDeal(e)">Open the deal</a></p> }
      }
        <div foot>@if (sel(); as e) {
          @if (e.status === 'new') { <button class="btn" type="button" (click)="start(e)"><bb-icon name="pipe"/>Start working it</button> }
          @if (waLink(e.phone, e.name); as w) { <a class="btn wa" [href]="w" target="_blank" rel="noreferrer" (click)="touch(e)"><bb-icon name="wa"/>WhatsApp</a> }
          @if (e.status === 'new') { <button class="btn ghost" type="button" (click)="patch(e, { status: 'closed' })">Not a fit</button> }
          <button class="btn danger sm" type="button" style="margin-left:auto" (click)="remove(e)"><bb-icon name="trash"/></button>
        }</div>
    </bb-drawer>`,
  styles: [`
    .k-val.src{font-size:19px;padding-top:6px}
    .chips .n{margin-left:6px;opacity:.7}
    .acts{white-space:nowrap;text-align:right}.acts .btn{margin-left:6px}
    .phone{display:none}
    .lnk{color:var(--brand-dark);font-weight:600;cursor:pointer}
    @media (max-width:760px){.desk{display:none}.phone{display:grid}.acts{display:none}}`]
})
export class EnquiriesComponent implements OnInit {
  cast = inject(CastService); data = inject(DataService); private route = inject(ActivatedRoute); private router = inject(Router);
  waLink = waLink;
  q = signal(''); status = signal<string>('new'); adding = signal(false); sel = signal<Enquiry | null>(null); bad = signal(false);
  draft: Partial<Enquiry> = { name: '', phone: '', source: '', wants: '' };
  filters: [string, string][] = [['new', 'Waiting'], ['converted', 'Started'], ['closed', 'Not a fit'], ['all', 'All']];
  ngOnInit(){ const p = this.route.snapshot.queryParams; if (p['add']) this.openAdd(); if (p['open']) { const e = this.data.enquiries().find(x => x.id === p['open']); if (e) this.sel.set(e); } }
  rows = computed(() => { const s = this.status(), q = this.q().toLowerCase();
    return this.data.enquiries().filter(e => s === 'all' || e.status === s).filter(e => !q || [e.name, e.phone, e.wants, e.source].join(' ').toLowerCase().includes(q)); });
  count(s: string){ return s === 'all' ? this.data.enquiries().length : this.data.enquiries().filter(e => e.status === s).length; }
  week = computed(() => this.data.enquiries().filter(e => (Date.now() - new Date(e.createdAt).getTime()) < 7 * 86400000));
  converted = computed(() => this.data.enquiries().filter(e => e.status === 'converted'));
  topSource = computed(() => { const m = new Map<string, number>(); this.data.enquiries().forEach(e => e.source && m.set(e.source, (m.get(e.source) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1])[0]?.[0] || ''; });
  label(s: string){ return ({ new: 'Waiting', contacted: 'Talking', converted: 'Started', closed: 'Not a fit' } as any)[s] || s; }
  when(iso: string){ const a = ago(iso); return a === 'today' || a === 'yesterday' ? a[0].toUpperCase() + a.slice(1) : niceDate(iso); }
  emptyTitle(){ return this.q() ? 'No match' : this.status() === 'new' ? 'Nothing waiting' : 'Nothing here'; }
  emptyBody(){ return this.q() ? 'Try another name or number.' : this.status() === 'new' ? 'When someone asks about your work, add them and it lands here.' : ''; }
  val(e: Event){ return (e.target as HTMLInputElement).value.trim(); }
  openAdd(){ this.draft = { name: '', phone: '', source: '', wants: '' }; this.bad.set(false); this.adding.set(true); setTimeout(() => document.getElementById('en-name')?.focus(), 250); }
  async save(andStart = false){
    const name = (this.draft.name || '').trim(); if (!name) { this.bad.set(true); return; }
    const e = await this.data.addEnquiry({ ...this.draft, name });
    this.adding.set(false); this.status.set('new');
    if (andStart) await this.start(e); else this.data.toast(`${name} added`);
  }
  async start(e: Enquiry){ const d = await this.data.convertEnquiry(e); this.sel.set(null); this.data.toast(`${e.name} is in your pipeline`, '/sales/pipeline', 'See it'); return d; }
  async patch(e: Enquiry, p: Partial<Enquiry>){ const r = await this.data.updateEnquiry(e.id, p); if (r && this.sel()?.id === e.id) this.sel.set(r); }
  async touch(e: Enquiry){ if (e.status === 'new') await this.patch(e, { status: 'contacted' }); }
  async remove(e: Enquiry){ if (!confirm(`Remove ${e.name}?`)) return; await this.data.removeEnquiry(e.id); this.sel.set(null); }
  goDeal(e: Enquiry){ this.sel.set(null); this.router.navigate(['/sales/pipeline'], { queryParams: { open: e.dealId } }); }
}
