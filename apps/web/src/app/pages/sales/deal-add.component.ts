import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService } from '../../core/data.service';
import { DraftService } from '../../core/draft.service';
import { Deal } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';

const BLANK = { name: '', phone: '', value: '', wants: '', stage: '' };
/* Add a deal straight into the pipeline, for the sale that never came through
   the inbox (a walk-in, a phone call the owner took). */
@Component({
  selector: 'bb-drawer-add',
  standalone: true,
  imports: [FormsModule, DrawerComponent],
  template: `
    <bb-drawer [open]="open" title="New deal" [message]="msg()" (closed)="closed.emit()">
      <ng-template #body>
      @if (restored()) { <div class="kept"><span>Picked up where you left off.</span><button type="button" class="btn quiet sm" data-act="deal-draft-clear" (click)="fresh()">Start again</button></div> }
      <div class="form-grid" (input)="keep()" (change)="keep()">
        <div class="field span"><label for="dl-name">Who</label><input id="dl-name" type="text" [(ngModel)]="d.name" placeholder="Boutique Hotel Galle" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="!!msg()"></div>
        <div class="field"><label for="dl-phone">Their number</label><input id="dl-phone" type="tel" inputmode="tel" [(ngModel)]="d.phone" placeholder="077 123 4567" autocomplete="off" enterkeyhint="next"></div>
        <div class="field"><label for="dl-value">Worth ({{ cast.word('currency','LKR') }})</label><input id="dl-value" type="text" inputmode="numeric" [(ngModel)]="d.value" placeholder="0" autocomplete="off" enterkeyhint="next"></div>
        <div class="field span"><label for="dl-wants">What they want</label><input id="dl-wants" type="text" [(ngModel)]="d.wants" placeholder="Welcome hampers, 40 a month" autocomplete="off" enterkeyhint="go" (keydown.enter)="save()"></div>
        <div class="field span"><label for="dl-stage">Stage</label><select id="dl-stage" [(ngModel)]="d.stage">@for (s of cast.cast()?.stages || []; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select></div>
      </div>
      </ng-template>
      <ng-template #foot>
        <button class="btn" type="button" data-act="deal-add" [disabled]="busy()" (click)="save()">Add deal</button>
        <button class="btn quiet" type="button" data-act="deal-add-cancel" (click)="closed.emit()">Cancel</button>
      </ng-template>
    </bb-drawer>`
})
export class DealAddComponent {
  cast = inject(CastService); data = inject(DataService); private drafts = inject(DraftService);
  @Input() set open(v: boolean){ const was = this._open; this._open = v; if (v && !was) this.begin(); }
  get open(){ return this._open; }
  private _open = false;
  @Output() closed = new EventEmitter<void>(); @Output() saved = new EventEmitter<Deal>();
  d: typeof BLANK = { ...BLANK }; msg = signal(''); busy = signal(false); restored = signal(false);
  private first(){ return this.cast.cast()?.stages[0]?.key || 'talking'; }
  private begin(){ this.restored.set(this.drafts.has('deal-new')); this.d = this.drafts.load('deal-new', BLANK); if (!this.d.stage) this.d.stage = this.first(); this.msg.set(''); }
  /* the stage starts filled in, so it alone is not something the person typed */
  keep(){ const { stage, ...typed } = this.d; this.drafts.keep('deal-new', Object.values(typed).some(Boolean) ? this.d : {}); if (this.msg() && this.d.name.trim()) this.msg.set(''); }
  fresh(){ this.drafts.clear('deal-new'); this.d = { ...BLANK, stage: this.first() }; this.restored.set(false); this.msg.set(''); }
  async save(){
    const n = this.d.name.trim(); if (!n) { this.msg.set('Add who the deal is with first.'); document.getElementById('dl-name')?.focus(); return; }
    if (this.busy()) return; this.busy.set(true);
    try {
      const r = await this.data.addDeal({ name: n, phone: this.d.phone.trim(), wants: this.d.wants.trim(), value: Number(String(this.d.value).replace(/\D/g, '')) || 0, stage: this.d.stage as any });
      this.drafts.clear('deal-new'); this.data.toast(`${n} added`); this.saved.emit(r);
    } finally { this.busy.set(false); }
  }
}
