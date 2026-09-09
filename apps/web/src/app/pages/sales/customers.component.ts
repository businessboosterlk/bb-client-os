import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, niceDate, daysSince } from '../../core/data.service';
import { Customer } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';

/* Everyone who has bought. A won deal lands here on its own with what they bought
   and what it was worth; the owner can add one directly too. Lifetime value and
   the last contact, so the quiet ones are visible. */
@Component({
  selector: 'bb-customers',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">{{ cast.word('customers','Customers') }}</h1><p>People who have bought from you. A won deal lands here on its own.</p></div>
      <div class="ph-right"><button class="btn" type="button" (click)="openAdd()"><bb-icon name="plus"/>New {{ cast.word('customer','customer').toLowerCase() }}</button></div></div>
    <div class="kpi">
      <div class="card"><div class="k-label">{{ cast.word('customers','Customers') }}</div><div class="k-val">{{ data.customers().length }}</div><div class="k-sub">on the books</div></div>
      <div class="card"><div class="k-label">Lifetime value</div><div class="k-val up">{{ cast.moneyShort(ltv()) || '0' }}</div><div class="k-sub">all time</div></div>
      <div class="card"><div class="k-label">Average sale</div><div class="k-val">{{ data.customers().length ? cast.moneyShort(ltv() / data.customers().length) : '0' }}</div><div class="k-sub">per {{ cast.word('customer','customer').toLowerCase() }}</div></div>
      <div class="card"><div class="k-label">Quiet</div><div class="k-val" [class.warn]="quietOnes().length">{{ quietOnes().length }}</div><div class="k-sub">not heard from in 30 days</div></div>
    </div>
    <div class="toolbar" style="margin-top:18px"><div class="search grow"><bb-icon name="search"/><input type="search" placeholder="Search by name, number or what they bought" [ngModel]="q()" (ngModelChange)="q.set($event)" enterkeyhint="search"></div></div>
    <div class="card">
      <div class="tbl-wrap desk">
        <table class="tbl">
          <thead><tr><th>Name</th><th>Bought</th><th>Since</th><th class="num">Value</th><th>Last touch</th><th></th></tr></thead>
          <tbody>
            @for (c of rows(); track c.id) {
              <tr (click)="sel.set(c)">
                <td><div class="who"><span class="avatar">{{ c.name.slice(0,1) }}</span><div><strong>{{ c.name }}</strong><span>{{ c.phone || 'no number' }}</span></div></div></td>
                <td>{{ c.bought || '' }}</td><td class="t-small">{{ niceDate(c.since) }}</td>
                <td class="num">{{ cast.money(c.value) || '' }}</td>
                <td class="t-small" [class.warn]="quiet(c) >= 30">{{ quiet(c) === 0 ? 'Today' : quiet(c) + ' days ago' }}</td>
                <td class="acts" (click)="$event.stopPropagation()">@if (waLink(c.phone, c.name); as w) { <a class="btn wa sm icon" [href]="w" target="_blank" rel="noreferrer" (click)="touch(c)"><bb-icon name="wa"/></a> }</td>
              </tr>
            } @empty { <tr><td colspan="6"><div class="empty"><strong>No {{ cast.word('customers','customers').toLowerCase() }} yet</strong>Win a deal and they appear here on their own.</div></td></tr> }
          </tbody>
        </table>
      </div>
      <div class="list phone">
        @for (c of rows(); track c.id) {
          <div class="li link" (click)="sel.set(c)"><span class="avatar">{{ c.name.slice(0,1) }}</span>
            <span class="tx"><strong>{{ c.name }}</strong><span>{{ line(c.bought, cast.money(c.value), 'since ' + niceDate(c.since)) }}</span></span>
            @if (waLink(c.phone, c.name); as w) { <a class="btn wa sm icon" [href]="w" target="_blank" rel="noreferrer" (click)="touch(c); $event.stopPropagation()"><bb-icon name="wa"/></a> }</div>
        } @empty { <div class="empty"><strong>No {{ cast.word('customers','customers').toLowerCase() }} yet</strong>Win a deal and they appear here on their own.</div> }
      </div>
    </div>

    <bb-drawer [open]="adding()" [title]="'New ' + cast.word('customer','customer').toLowerCase()" (closed)="adding.set(false)">
      <div class="form-grid">
        <div class="field span"><label for="cu-name">Name</label><input id="cu-name" type="text" [(ngModel)]="draft.name" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="bad()"></div>
        <div class="field"><label>Their number</label><input type="tel" inputmode="tel" [(ngModel)]="draft.phone" enterkeyhint="next"></div>
        <div class="field"><label>Worth ({{ cast.word('currency','LKR') }})</label><input type="text" inputmode="numeric" [(ngModel)]="draftValue" placeholder="0" enterkeyhint="next"></div>
        <div class="field span"><label>What they bought</label><input type="text" [(ngModel)]="draft.bought" enterkeyhint="go" (keydown.enter)="save()"></div>
      </div>
      <div foot><button class="btn" type="button" (click)="save()">Add {{ cast.word('customer','customer').toLowerCase() }}</button></div>
    </bb-drawer>

    <bb-drawer [open]="!!sel()" [title]="sel()?.name || ''" (closed)="sel.set(null)">
      @if (sel(); as c) {
        <div class="kpi two" style="margin-bottom:16px">
          <div class="card"><div class="k-label">Lifetime value</div><div class="k-val">{{ cast.moneyShort(c.value) || '0' }}</div></div>
          <div class="card"><div class="k-label">Since</div><div class="k-val" style="font-size:19px;padding-top:6px">{{ niceDate(c.since) }}</div></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Number</label><input type="tel" inputmode="tel" [ngModel]="c.phone || ''" (change)="patch(c, { phone: val($event) })"></div>
          <div class="field"><label>Worth ({{ cast.word('currency','LKR') }})</label><input type="text" inputmode="numeric" [ngModel]="c.value || ''" (change)="patch(c, { value: num($event) })"></div>
          <div class="field span"><label>What they bought</label><input type="text" [ngModel]="c.bought || ''" (change)="patch(c, { bought: val($event) })"></div>
          <div class="field span"><label>Notes</label><textarea [ngModel]="c.notes || ''" (change)="patch(c, { notes: val($event) })" placeholder="Prefers delivery on Fridays"></textarea></div>
        </div>
      }
        <div foot>@if (sel(); as c) {
          @if (waLink(c.phone, c.name); as w) { <a class="btn wa" [href]="w" target="_blank" rel="noreferrer" (click)="touch(c)"><bb-icon name="wa"/>WhatsApp</a> }
          <button class="btn ghost" type="button" (click)="touch(c)"><bb-icon name="phone"/>Spoke today</button>
          <button class="btn danger sm" type="button" style="margin-left:auto" (click)="remove(c)"><bb-icon name="trash"/></button>
        }</div>
    </bb-drawer>`,
  styles: [`.k-val.warn{color:var(--amber)}.warn{color:var(--amber);font-weight:600}.phone{display:none}.acts{text-align:right}.kpi.two{grid-template-columns:1fr 1fr}
    @media (max-width:760px){.desk{display:none}.phone{display:grid}}`]
})
export class CustomersComponent {
  line(...p: (string | undefined)[]){ return p.filter(Boolean).join(' · '); }
  cast = inject(CastService); data = inject(DataService);
  waLink = waLink; niceDate = niceDate;
  q = signal(''); adding = signal(false); sel = signal<Customer | null>(null); bad = signal(false);
  draft: Partial<Customer> = {}; draftValue = '';
  rows = computed(() => { const q = this.q().toLowerCase(); return this.data.customers().filter(c => !q || [c.name, c.phone, c.bought].join(' ').toLowerCase().includes(q)); });
  ltv = computed(() => this.data.customers().reduce((a, c) => a + (Number(c.value) || 0), 0));
  quiet(c: Customer){ return daysSince(c.updatedAt || c.since); }
  quietOnes = computed(() => this.data.customers().filter(c => this.quiet(c) >= 30));
  val(e: Event){ return (e.target as HTMLInputElement).value.trim(); }
  num(e: Event){ return Number(this.val(e).replace(/\D/g, '')) || 0; }
  openAdd(){ this.draft = { name: '', phone: '', bought: '' }; this.draftValue = ''; this.bad.set(false); this.adding.set(true); setTimeout(() => document.getElementById('cu-name')?.focus(), 250); }
  async save(){ const n = (this.draft.name || '').trim(); if (!n) { this.bad.set(true); return; }
    await this.data.addCustomer({ ...this.draft, name: n, value: Number(this.draftValue.replace(/\D/g, '')) || 0 }); this.adding.set(false); this.data.toast(`${n} added`); }
  async patch(c: Customer, p: Partial<Customer>){ const r = await this.data.updateCustomer(c.id, p); if (r && this.sel()?.id === c.id) this.sel.set(r); }
  async touch(c: Customer){ await this.patch(c, {}); }
  async remove(c: Customer){ if (!confirm(`Remove ${c.name}?`)) return; await this.data.removeCustomer(c.id); this.sel.set(null); }
}
