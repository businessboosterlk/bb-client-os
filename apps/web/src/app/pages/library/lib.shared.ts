import { Component, Input, inject } from '@angular/core';
import { LibItem } from '../../core/models';
import { IconComponent } from '../../ui/icon.component';

export function isNew(added?: string, days = 14){ if (!added) return false; return (Date.now() - new Date(added).getTime()) / 86400000 <= days; }
export function monthLabel(id: string, label: string, spansYears: boolean){ return spansYears ? `${label} ${id.slice(0, 4)}` : label; }

/* One row for a library item: icon, title, a note line, opens in a new tab. */
@Component({
  selector: 'bb-lib-row',
  standalone: true,
  imports: [IconComponent],
  template: `
    <a class="li link" [href]="item.href" target="_blank" rel="noreferrer">
      <span class="ic"><bb-icon [name]="icon"/></span>
      <span class="tx"><strong>{{ item.title }}@if (fresh) { <span class="new-badge">New</span> }</strong><span>{{ sub }}</span></span>
      <bb-icon name="ext" class="go"/>
    </a>`
})
export class LibRowComponent {
  @Input() item!: LibItem; @Input() icon = 'doc';
  get fresh(){ return isNew(this.item.added); }
  get sub(){ return [this.item.note, this.item.kind, this.item.platform, this.item.date].filter(Boolean).join(' · '); }
}
