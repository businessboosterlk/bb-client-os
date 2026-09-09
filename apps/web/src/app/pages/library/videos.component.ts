import { Component, inject, computed, signal } from '@angular/core';
import { CastService } from '../../core/cast.service';
import { LibRowComponent, monthLabel } from './lib.shared';

/* A month picker, then that month only. Tap a month, see that month. */
@Component({
  selector: 'bb-videos',
  standalone: true,
  imports: [LibRowComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Videos</h1><p>Every film we produced, by month. Tap one to open the Drive folder.</p></div></div>
    @if (months().length) {
      <div class="chips" style="margin-bottom:14px">@for (m of months(); track m.id) { <button type="button" [class.on]="sel() === m.id" (click)="sel.set(m.id)">{{ label(m) }}</button> }</div>
      <div class="card list">
        @for (v of current()?.videos || []; track v.href) { <bb-lib-row [item]="v" icon="video"/> }
        @empty { <div class="empty">No videos in {{ current()?.label }}.</div> }
      </div>
    } @else { <div class="card empty"><strong>Nothing here yet</strong>Your first month's videos will appear here.</div> }`
})
export class VideosComponent {
  cast = inject(CastService);
  months = computed(() => this.cast.cast()!.library.months.filter(m => m.videos.length));
  sel = signal(this.months()[0]?.id || '');
  current = computed(() => this.months().find(m => m.id === this.sel()));
  spans = computed(() => new Set(this.months().map(m => m.id.slice(0, 4))).size > 1);
  label(m: { id: string; label: string }){ return monthLabel(m.id, m.label, this.spans()); }
}
