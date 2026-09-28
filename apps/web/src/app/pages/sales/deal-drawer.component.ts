import { Component, Input, Output, EventEmitter, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService, waLink, niceDate, ago, daysSince } from '../../core/data.service';
import { DraftService } from '../../core/draft.service';
import { AskService } from '../../core/ask.service';
import { Deal, Stage } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { MoreComponent, WINDOW } from '../../ui/more.component';

export const LOST_REASONS = ['Price too high', 'Went elsewhere', 'No budget', 'Bad timing', 'No response', 'Other'];
const BLANK = { name: '', phone: '', value: '', nextStep: '', nextAt: '', wants: '' };

/* One deal, everything about it: the stage ladder with the win chance, what it is worth, the
   next step and when, one-tap logging of a call or a meeting, the activity trail and Won or Lost
   with a reason. Shared by the board and the list. Edit sits in the head. ONE main button. */
@Component({
  selector: 'bb-deal-drawer',
  standalone: true,
  imports: [FormsModule, DrawerComponent, IconComponent, MoreComponent],
  template: `
    <bb-drawer [open]="!!deal" [title]="deal?.name || ''" [editable]="!!deal && !editing()" [message]="editing() ? msg() : ''" (edit)="beginEdit()" (closed)="shut()">
      <ng-template #body>
      @if (deal; as d) {
        @if (editing()) {
          <div class="form-grid" (input)="keep()" (change)="keep()">
            <div class="field span"><label for="de-name">Who</label><input id="de-name" type="text" [(ngModel)]="ed.name" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!msg()"></div>
            <div class="field"><label for="de-phone">Their number</label><input id="de-phone" type="tel" inputmode="tel" [(ngModel)]="ed.phone" autocomplete="off" enterkeyhint="next"></div>
            <div class="field"><label for="de-value">Worth ({{ cast.word('currency','LKR') }})</label><input id="de-value" type="text" inputmode="numeric" [(ngModel)]="ed.value" placeholder="0" autocomplete="off" enterkeyhint="next"></div>
            <div class="field span"><label for="de-wants">What they want</label><input id="de-wants" type="text" [(ngModel)]="ed.wants" autocomplete="off" enterkeyhint="next"></div>
            <div class="field"><label for="de-next">Next step</label><input id="de-next" type="text" [(ngModel)]="ed.nextStep" placeholder="Send the price list" autocomplete="off" enterkeyhint="next"></div>
            <div class="field"><label for="de-at">Next step by</label><input id="de-at" type="date" [class.empty]="!ed.nextAt" [(ngModel)]="ed.nextAt"></div>
          </div>
        } @else {
          <div class="sheet-pills">
            <span class="pill" [class]="'pill ' + d.stage"><i class="dot"></i>{{ stageLabel(d.stage) }}@if (prob(d.stage) !== null) { · {{ prob(d.stage) }}% }</span>
            @if (d.value) { <span class="pill">{{ cast.money(d.value) }}</span> }
            @if (quiet(d) >= 5 && open(d)) { <span class="pill" [class.red]="quiet(d) >= 10">{{ quiet(d) }} days quiet</span> }
            @if (d.stage === 'lost' && d.lostReason) { <span class="pill">{{ d.lostReason }}</span> }
          </div>
          <dl class="facts">
            <div class="f"><dt>Their number</dt><dd [class.none]="!d.phone">{{ d.phone || 'Not given' }}</dd></div>
            <div class="f"><dt>Worth</dt><dd [class.none]="!d.value">{{ cast.money(d.value) || 'Not priced yet' }}</dd></div>
            <div class="f span"><dt>What they want</dt><dd [class.none]="!d.wants">{{ d.wants || 'Not written down yet' }}</dd></div>
            <div class="f"><dt>Next step</dt><dd [class.none]="!d.nextStep">{{ d.nextStep || 'None set' }}</dd></div>
            <div class="f"><dt>By</dt><dd [class.none]="!d.nextAt">{{ d.nextAt ? niceDate(d.nextAt) : 'No date' }}</dd></div>
          </dl>
          @if (open(d)) {
            <div class="sec"><div class="sec-head"><h3>Stage</h3><span>Tap to move</span></div>
              <div class="ladder">
                @for (s of stages(); track s.key) { <button type="button" data-act="deal-stage" [class.on]="d.stage === s.key" [attr.aria-pressed]="d.stage === s.key" (click)="move(d, s.key)"><span>{{ s.label }}</span><em>{{ s.prob }}%</em></button> }
              </div>
              @if (playbook(d.stage); as pb) { <p class="pb"><strong>Now:</strong> {{ pb.goal }} <strong>Next:</strong> {{ pb.ask }}</p> }
            </div>
          }
          <div class="sec"><div class="sec-head"><h3>Activity</h3><span>{{ trail().length }}</span></div>
            <div class="log">
              <button class="btn ghost sm" type="button" data-act="deal-log-call" (click)="log(d,'call','Called them')"><bb-icon name="phone"/><span>Called</span></button>
              <button class="btn ghost sm" type="button" data-act="deal-log-meet" (click)="log(d,'meeting','Met them')"><bb-icon name="meet"/><span>Met</span></button>
            </div>
            <div class="note-add"><input type="text" placeholder="Add a note" aria-label="Add a note" [(ngModel)]="note" (input)="keepNote(d)" enterkeyhint="done" autocomplete="off" (keydown.enter)="addNote(d)"><button class="btn ghost sm" type="button" data-act="deal-note-add" (click)="addNote(d)">Add</button></div>
            <div class="trail">
              @for (a of trail().slice(0, shown()); track a.id) { <div class="tr-row"><bb-icon [name]="icon(a.type)"/><span><strong>{{ a.summary }}</strong><em>{{ when(a.createdAt) }}</em></span></div> }
              @empty { <p class="none-yet">Nothing logged yet. Tap Called or Met and it lands here.</p> }
            </div>
            <bb-more [total]="trail().length" [shown]="min(shown(), trail().length)" (more)="shown.set(shown() + 30)"/>
          </div>
        }
      }
      </ng-template>
      <ng-template #foot>@if (deal; as d) {
        @if (editing()) {
          <button class="btn" type="button" data-act="deal-save" [disabled]="busy()" (click)="save(d)">Save changes</button>
          <button class="btn quiet" type="button" data-act="deal-edit-cancel" (click)="cancel(d)">Cancel</button>
        } @else {
          @if (open(d)) {
            <button class="btn" type="button" data-act="deal-won" [disabled]="busy()" (click)="win(d)"><bb-icon name="check"/><span>Mark won</span></button>
            <div class="pair">
              @if (wa(d)) { <a class="btn wa-ghost" data-act="deal-whatsapp" [href]="wa(d)" target="_blank" rel="noreferrer" (click)="log(d,'message','WhatsApp sent')"><bb-icon name="wa"/><span>WhatsApp</span></a> }
              <button class="btn ghost" type="button" data-act="deal-lost" (click)="lose(d)">Mark lost</button>
            </div>
          } @else {
            <button class="btn" type="button" data-act="deal-reopen" [disabled]="busy()" (click)="move(d, firstStage())">Reopen the deal</button>
            @if (wa(d)) { <div class="pair"><a class="btn wa-ghost" data-act="deal-whatsapp" [href]="wa(d)" target="_blank" rel="noreferrer" (click)="log(d,'message','WhatsApp sent')"><bb-icon name="wa"/><span>WhatsApp</span></a></div> }
          }
          <button class="btn quiet warn" type="button" data-act="deal-remove" (click)="remove(d)">Remove</button>
        }
      }</ng-template>
    </bb-drawer>`,
  styles: [`
    .pill.red{background:var(--red-soft);color:var(--red);border-color:transparent}
    .sec{margin-top:22px}
    .ladder{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ladder button{min-height:52px;min-width:0;padding:0 6px;border-radius:12px;border:1px solid var(--line-2);background:var(--surface);font-weight:600;font-size:13px;color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:background 120ms var(--ease),border-color 120ms var(--ease)}
    .ladder button span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ladder button em{font-style:normal;font-size:11px;color:var(--muted);font-weight:500}
    .ladder button.on{background:var(--brand);border-color:transparent;color:var(--on-accent)}.ladder button.on em{color:inherit;opacity:.85}
    .pb{font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.5}.pb strong{color:var(--ink)}
    .log{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}.log .btn{min-height:44px}
    .note-add{display:flex;gap:8px;margin-bottom:6px}
    .note-add input{flex:1;min-width:0;min-height:44px;padding:8px 12px;border:1px solid var(--line-2);border-radius:10px;background:var(--surface);font-size:14px}
    .note-add input:focus{outline:none;border-color:var(--brand)}.note-add .btn{min-height:44px;flex-shrink:0}
    .trail{display:grid}.tr-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}.tr-row:first-child{border-top:0}
    .tr-row bb-icon{color:var(--muted);margin-top:2px}.tr-row strong{display:block;font-weight:500;font-size:13.5px;overflow-wrap:anywhere}.tr-row em{display:block;font-style:normal;font-size:11.5px;color:var(--muted)}
    .none-yet{padding:14px 0;font-size:13px;color:var(--muted)}`]
})
export class DealDrawerComponent {
  cast = inject(CastService); data = inject(DataService); private drafts = inject(DraftService); private ask = inject(AskService);
  niceDate = niceDate; min = Math.min;
  private _deal: Deal | null = null;
  /* the trail reads this signal, so it follows the deal on screen and every note added to it */
  private id = signal('');
  @Input() set deal(d: Deal | null){
    const changed = d?.id !== this._deal?.id; this._deal = d; this.id.set(d?.id || '');
    if (!d) { this.editing.set(false); return; }
    if (changed) { this.shown.set(WINDOW); this.msg.set(''); this.note = this.drafts.load('deal-note-' + d.id, { note: '' }).note;
      if (this.drafts.has('deal-edit-' + d.id)) { this.ed = this.drafts.load('deal-edit-' + d.id, this.from(d)); this.editing.set(true); } else this.editing.set(false); }
  }
  get deal(){ return this._deal; }
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<Deal>();
  note = ''; editing = signal(false); msg = signal(''); busy = signal(false); shown = signal(WINDOW);
  ed: typeof BLANK = { ...BLANK };
  stages = computed(() => this.cast.cast()?.stages || []);
  firstStage(){ return (this.stages()[0]?.key || 'talking') as Stage; }
  trail = computed(() => { const id = this.id(); return id ? this.data.activities().filter(a => a.dealId === id) : []; });
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
  private set(r: Deal | null | undefined){ if (r) { this._deal = r; this.changed.emit(r); } }
  private from(d: Deal){ return { name: d.name || '', phone: d.phone || '', value: d.value ? String(d.value) : '', nextStep: d.nextStep || '', nextAt: d.nextAt || '', wants: d.wants || '' }; }
  shut(){ this.editing.set(false); this.closed.emit(); }
  beginEdit(){ const d = this._deal; if (!d) return; this.ed = this.drafts.load('deal-edit-' + d.id, this.from(d)); this.msg.set(''); this.editing.set(true); }
  keep(){ const d = this._deal; if (d) this.drafts.keep('deal-edit-' + d.id, this.ed); if (this.msg() && this.ed.name.trim()) this.msg.set(''); }
  cancel(d: Deal){ this.drafts.clear('deal-edit-' + d.id); this.editing.set(false); this.msg.set(''); }
  async save(d: Deal){
    const name = this.ed.name.trim(); if (!name) { this.msg.set('A name is needed. Put it back to save.'); return; }
    if (this.busy()) return; this.busy.set(true);
    try {
      const phone = this.ed.phone.trim();
      this.set(await this.data.updateDeal(d.id, { name, phone, wants: this.ed.wants.trim(), nextStep: this.ed.nextStep.trim(), nextAt: this.ed.nextAt, value: Number(String(this.ed.value).replace(/\D/g, '')) || 0 }));
      /* an edit keeps linked records true: the customer this deal made carries the same name and number */
      if (d.customerId) await this.data.updateCustomer(d.customerId, { name, phone });
      this.drafts.clear('deal-edit-' + d.id); this.editing.set(false); this.data.toast('Saved');
    } finally { this.busy.set(false); }
  }
  keepNote(d: Deal){ this.drafts.keep('deal-note-' + d.id, { note: this.note }); }
  async log(d: Deal, type: any, summary: string){ await this.data.log(d.id, type, summary); this.set(this.data.deals().find(x => x.id === d.id)); this.data.toast('Logged: ' + summary); }
  async addNote(d: Deal){ const n = this.note.trim(); if (!n) return; await this.data.log(d.id, 'note', n); this.note = ''; this.drafts.clear('deal-note-' + d.id); }
  async move(d: Deal, s: Stage){ if (this.busy() || d.stage === s) return; this.busy.set(true); try { this.set(await this.data.moveDeal(d.id, s)); } finally { this.busy.set(false); } }
  async win(d: Deal){ if (this.busy()) return; this.busy.set(true); try { this.set(await this.data.moveDeal(d.id, 'won')); this.data.toast(`${d.name} is now a customer`, '/sales/customers', 'See them'); } finally { this.busy.set(false); } }
  async lose(d: Deal){
    const reason = await this.ask.choose({ title: `Why was ${d.name} lost?`, body: 'The reason shows on the deal and in your numbers.', options: LOST_REASONS, no: 'Keep it open' });
    if (!reason) return;
    this.set(await this.data.moveDeal(d.id, 'lost', { lostReason: reason })); this.data.toast('Marked lost: ' + reason);
  }
  async remove(d: Deal){
    if (!(await this.ask.confirm({ title: `Remove ${d.name}?`, body: d.customerId ? 'The deal and its activity go. The customer it made stays.' : 'The deal and its activity go for both seats.', yes: 'Remove', danger: true }))) return;
    await this.data.removeDeal(d.id); this.drafts.clear('deal-edit-' + d.id); this.drafts.clear('deal-note-' + d.id); this._deal = null; this.shut(); this.data.toast(`${d.name} removed`);
  }
}
