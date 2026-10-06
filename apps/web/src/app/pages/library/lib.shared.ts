import { Component, Input, inject } from '@angular/core';
import { LibItem } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';
import { SeenService } from '../../core/seen.service';
import { isNewSince, readSeen } from '../../core/library';

export function monthLabel(id: string, label: string, spansYears: boolean){ return spansYears ? `${label} ${id.slice(0, 4)}` : label; }

/* One row for a library item: icon, title, a note line, opens in a new tab. */
@Component({
  selector: 'bb-lib-row',
  standalone: true,
  imports: [IconComponent],
  template: `
    <a class="li link" data-act="library-open" [href]="item.href" target="_blank" rel="noreferrer" [attr.aria-label]="item.title + ', opens in a new tab'" (click)="seen.tap(item.title, item.href)">
      <span class="ic"><bb-icon [name]="icon"/></span>
      <span class="tx"><strong>{{ item.title }}@if (fresh) { <span class="new-badge">New</span> }</strong><span>{{ sub }}</span></span>
      <bb-icon name="ext" class="go"/>
    </a>`
})
export class LibRowComponent {
  seen = inject(SeenService);
  @Input() item!: LibItem; @Input() icon = 'doc'; @Input() ref = '';
  get fresh(){ return isNewSince(this.item.added, this.ref); }
  get sub(){ return [this.item.note, this.item.kind, this.item.platform, this.item.date].filter(Boolean).join(' · '); }
}
