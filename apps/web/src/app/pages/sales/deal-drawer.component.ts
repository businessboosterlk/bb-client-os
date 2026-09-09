import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, niceDate, ago, daysSince } from '../../core/data.service';
import { Deal, Stage } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';

/* One deal, everything about it: the stage ladder with the win chance, what it is
   worth, the next step and when, one-tap logging of a call, message or meeting,
   the activity trail, and Won or Lost with a reason. Shared by board and list. */
@Component({
  selector: 'bb-deal-drawer',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent],
  template: `
    <bb-drawer [open]="!!deal" [title]="deal?.name || ''" (closed)="closed.emit()">
      @if (deal; as d) {
        <div class="top">
          <div class="pills">
            <span class="pill" [class]="'pill ' + d.stage"><i class="dot"></i>{{ stageLabel(d.stage) }}@if (prob(d.stage) !== null) { · {{ prob(d.stage) }}% }</span>
            @if (d.value) { <span class="pill">{{ cast.money(d.value) }}</span> }
            @if (quiet(d) >= 5 && open(d)) { <span class="pill" [class.red]="quiet(d) >= 10">{{ quiet(d) }} days quiet</span> }
          </div>
          <p class="t-small">{{ line(d.phone, d.wants) || 'No details yet' }}</p>
        </div>
        <div class="acts">
          @if (wa(d)) { <a class="btn wa sm" [href]="wa(d)" target="_blank" rel="noreferrer" (click)="log(d,'message','WhatsApp sent')"><bb-icon name="wa"/>WhatsApp</a> }
          <button class="btn ghost sm" type="button" (click)="log(d,'call','Called them')"><bb-icon name="phone"/>Called</button>
          <button class="btn ghost sm" type="button" (click)="log(d,'meeting','Met them')"><bb-icon name="meet"/>Met</button>
        </div>
        @if (open(d)) {
          <div class="sec"><div class="sec-head"><h3>Stage</h3><span>Tap to move</span></div>
            <div class="ladder">
              @for (s of stages(); track s.key) { <button type="button" [class.on]="d.stage === s.key" (click)="move(d, s.key)">{{ s.label }}<em>{{ s.prob }}%</em></button> }
            </div>
            @if (playbook(d.stage); as pb) { <p class="pb"><strong>Now:</strong> {{ pb.goal }} <strong>Next:</strong> {{ pb.ask }}</p> }
          </div>
        }
        <div class="sec"><div class="sec-head"><h3>The deal</h3></div>
          <div class="form-grid">
            <div class="field"><label>Worth ({{ cast.word('currency','LKR') }})</label><input type="text" inputmode="numeric" [ngModel]="d.value || ''" (change)="setValue(d, $event)" placeholder="0" enterkeyhint="next"></div>
            <div class="field"><label>Next step by</label><input type="date" [ngModel]="d.nextAt || ''" (change)="patch(d, { nextAt: val($event) })"></div>
            <div class="field span"><label>Next step</label><input type="text" [ngModel]="d.nextStep || ''" (change)="patch(d, { nextStep: val($event) })" placeholder="Send the price list" enterkeyhint="done"></div>
            <div class="field span"><label>What they want</label><input type="text" [ngModel]="d.wants || ''" (change)="patch(d, { wants: val($event) })" placeholder="20kg a month, delivered" enterkeyhint="done"></div>
          </div>
        </div>
        <div class="sec"><div class="sec-head"><h3>Activity</h3><span>{{ trail().length }}</span></div>
          <div class="note-add"><input type="text" placeholder="Add a note" [(ngModel)]="note" enterkeyhint="done" (keydown.enter)="addNote(d)"><button class="btn sm" type="button" (click)="addNote(d)">Add</button></div>
          <div class="trail">
            @for (a of trail(); track a.id) { <div class="tr-row"><bb-icon [name]="icon(a.type)"/><span><strong>{{ a.summary }}</strong><em>{{ when(a.createdAt) }}</em></span></div> }
            @empty { <div class="empty">Nothing logged yet. Tap Called, Met or WhatsApp above and it lands here.</div> }
          </div>
        </div>
        @if (lostAsk()) {
          <div class="sec lost-ask"><div class="sec-head"><h3>Why was it lost?</h3></div>
            <div class="chips">@for (r of reasons; track r) { <button type="button" (click)="lose(d, r)">{{ r }}</button> }</div></div>
        }
      }
      <div foot>@if (deal; as d) {
          @if (open(d)) {
            <button class="btn" type="button" (click)="win(d)"><bb-icon name="check"/>Mark won</button>
            <button class="btn ghost" type="button" (click)="lostAsk.set(!lostAsk())">Mark lost</button>
          } @else {
            <button class="btn ghost" type="button" (click)="move(d, 'talking')">Reopen</button>
          }
          <button class="btn danger sm" type="button" style="margin-left:auto" (click)="remove(d)"><bb-icon name="trash"/></button>
      }</div>
    </bb-drawer>`,
  styles: [`
    .top{margin-bottom:14px}.pills{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.pill.red{background:var(--red-soft);color:var(--red);border-color:transparent}
    .acts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}
    .sec{margin-top:20px}
    .ladder{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    .ladder button{min-height:48px;border-radius:10px;border:1px solid var(--line-2);background:var(--surface);font-weight:600;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
    .ladder button em{font-style:normal;font-size:11px;color:var(--muted);font-weight:500}
    .ladder button.on{background:var(--brand);border-color:transparent;color:var(--on-accent)}.ladder button.on em{color:inherit;opacity:.85}
    .pb{font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.5}.pb strong{color:var(--ink)}
    .note-add{display:flex;gap:8px;margin-bottom:10px}.note-add input{flex:1;min-width:0;min-height:38px;padding:8px 12px;border:1px solid var(--line-2);border-radius:10px;font-size:14px}
    .note-add input:focus{outline:none;border-color:var(--brand)}
    .trail{display:grid}.tr-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}.tr-row:first-child{border-top:0}
    .tr-row bb-icon{color:var(--muted);margin-top:2px}.tr-row strong{display:block;font-weight:500;font-size:13.5px}.tr-row em{display:block;font-style:normal;font-size:11.5px;color:var(--muted)}
    .lost-ask{padding:14px;border:1px dashed var(--line-2);border-radius:12px}`]
})
export class DealDrawerComponent {
  line(...p: (string | undefined)[]){ return p.filter(Boolean).join(' · '); }
  cast = inject(CastService); data = inject(DataService);
  @Input() deal: Deal | null = null;
  @Output() closed = new EventEmitter<void>();
  note = ''; lostAsk = signal(false);
  reasons = ['Price too high', 'Went elsewhere', 'No budget', 'Bad timing', 'No response', 'Other'];
  stages = computed(() => this.cast.cast()?.stages || []);
  trail = computed(() => this.deal ? this.data.activityFor(this.deal.id) : []);
  open(d: Deal){ return d.stage !== 'won' && d.stage !== 'lost'; }
  quiet(d: Deal){ return daysSince(d.lastContactAt || d.stageAt || d.createdAt); }
  wa(d: Deal){ return waLink(d.phone, d.name); }
  stageLabel(k: Stage){ return this.stages().find(s => s.key === k)?.label || (k === 'won' ? 'Won' : k === 'lost' ? 'Lost' : k); }
  prob(k: Stage){ if (k === 'won') return 100; if (k === 'lost') return 0; return this.stages().find(s => s.key === k)?.prob ?? null; }
  playbook(k: Stage){ return ({
    talking: { goal: 'find out exactly what they need and by when.', ask: 'agree to send a price.' },
    quoted: { goal: 'walk them through the price and answer every question.', ask: 'a yes in principle.' },
    closing: { goal: 'clear the last objection and confirm the date.', ask: 'the first order.' } } as any)[k] || null; }
  icon(t: string){ return ({ call: 'phone', message: 'msg', meeting: 'meet', quote: 'quote' } as any)[t] || 'note'; }
  when(iso: string){ const a = ago(iso); return a === 'today' ? 'Today' : a === 'yesterday' ? 'Yesterday' : niceDate(iso); }
  val(e: Event){ return (e.target as HTMLInputElement).value.trim(); }
  async patch(d: Deal, p: Partial<Deal>){ const r = await this.data.updateDeal(d.id, p); if (r) this.deal = r; }
  async setValue(d: Deal, e: Event){ await this.patch(d, { value: Number(this.val(e).replace(/\D/g, '')) || 0 }); }
  async log(d: Deal, type: any, summary: string){ await this.data.log(d.id, type, summary); this.deal = this.data.deals().find(x => x.id === d.id) || d; this.data.toast('Logged: ' + summary); }
  async addNote(d: Deal){ const n = this.note.trim(); if (!n) return; await this.data.log(d.id, 'note', n); this.note = ''; }
  async move(d: Deal, s: Stage){ const r = await this.data.moveDeal(d.id, s); if (r) this.deal = r; this.lostAsk.set(false); }
  async win(d: Deal){ const r = await this.data.moveDeal(d.id, 'won'); if (r) this.deal = r; this.data.toast(`${d.name} is now a customer`, '/sales/customers', 'See them'); }
  async lose(d: Deal, reason: string){ const r = await this.data.moveDeal(d.id, 'lost', { lostReason: reason }); if (r) this.deal = r; this.lostAsk.set(false); this.data.toast('Marked lost: ' + reason); }
  async remove(d: Deal){ if (!confirm(`Remove ${d.name}? The activity goes with it.`)) return; await this.data.removeDeal(d.id); this.deal = null; this.closed.emit(); }
}
