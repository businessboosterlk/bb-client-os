import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { DataService } from '../../core/data.service';
import { Deal } from '../../core/models';
import { DrawerComponent } from '../../ui/drawer.component';

/* Add a deal straight into the pipeline, for the sale that never came through
   the inbox (a walk-in, a phone call the owner took). */
@Component({
  selector: 'bb-drawer-add',
  standalone: true,
  imports: [FormsModule, DrawerComponent],
  template: `
    <bb-drawer [open]="open" title="New deal" (closed)="closed.emit()">
      <div class="form-grid">
        <div class="field span"><label for="dl-name">Who</label><input id="dl-name" type="text" [(ngModel)]="name" placeholder="Boutique Hotel Galle" autocomplete="off" enterkeyhint="next" [attr.aria-invalid]="bad()"></div>
        <div class="field"><label>Their number</label><input type="tel" inputmode="tel" [(ngModel)]="phone" placeholder="077 123 4567" enterkeyhint="next"></div>
        <div class="field"><label>Worth ({{ cast.word('currency','LKR') }})</label><input type="text" inputmode="numeric" [(ngModel)]="value" placeholder="0" enterkeyhint="next"></div>
        <div class="field span"><label>What they want</label><input type="text" [(ngModel)]="wants" placeholder="Welcome hampers, 40 a month" enterkeyhint="go" (keydown.enter)="save()"></div>
        <div class="field span"><label>Stage</label><select [(ngModel)]="stage">@for (s of cast.cast()?.stages || []; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select></div>
      </div>
      <div foot><button class="btn" type="button" (click)="save()">Add deal</button></div>
    </bb-drawer>`
})
export class DealAddComponent {
  cast = inject(CastService); data = inject(DataService);
  @Input() set open(v: boolean){ this._open = v; if (v) { this.name = ''; this.phone = ''; this.value = ''; this.wants = ''; this.stage = this.cast.cast()?.stages[0]?.key || 'talking'; this.bad.set(false); setTimeout(() => document.getElementById('dl-name')?.focus(), 250); } }
  get open(){ return this._open; }
  private _open = false;
  @Output() closed = new EventEmitter<void>(); @Output() saved = new EventEmitter<Deal>();
  name = ''; phone = ''; value = ''; wants = ''; stage: any = 'talking'; bad = signal(false);
  async save(){ const n = this.name.trim(); if (!n) { this.bad.set(true); return; }
    const d = await this.data.addDeal({ name: n, phone: this.phone.trim(), wants: this.wants.trim(), value: Number(this.value.replace(/\D/g, '')) || 0, stage: this.stage });
    this.data.toast(`${n} added`); this.saved.emit(d); }
}
