import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { LibRowComponent, monthLabel } from './lib.shared';
import { MoreComponent, WINDOW } from '../../ui/more.component';

/* A month picker, then that month only. Tap a month, see that month. */
@Component({
  selector: 'bb-videos',
  standalone: true,
  imports: [LibRowComponent, MoreComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Videos</h1><p>Every film we produced, by month. Tap one to open the Drive folder.</p></div></div>
    @if (months().length) {
      <div class="chips" style="margin-bottom:14px">@for (m of months(); track m.id) { <button type="button" data-act="videos-month" [class.on]="sel() === m.id" [attr.aria-pressed]="sel() === m.id" (click)="pick(m.id)">{{ label(m) }}</button> }</div>
      <div class="card list">
        @for (v of (current()?.videos || []).slice(0, shown()); track v.href) { <bb-lib-row [item]="v" icon="video"/> }
        @empty { <div class="empty">No videos in {{ current()?.label }}.</div> }
        <bb-more [total]="(current()?.videos || []).length" [shown]="min(shown(), (current()?.videos || []).length)" (more)="shown.set(shown() + 30)"/>
      </div>
    } @else { <div class="card empty"><strong>Nothing here yet</strong>Your first month's videos will appear here.</div> }`
})
export class VideosComponent implements OnInit, OnDestroy {
  cast = inject(CastService); private route = inject(ActivatedRoute);
  private qs: any; shown = signal(WINDOW); min = Math.min;
  pick(id: string){ this.sel.set(id); this.shown.set(WINDOW); }
  ngOnInit(){ this.qs = this.route.queryParams.subscribe(p => { if (p['m'] && this.months().some(m => m.id === p['m'])) this.sel.set(p['m']); }); }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  months = computed(() => this.cast.cast()!.library.months.filter(m => m.videos.length));
  sel = signal(this.months()[0]?.id || '');
  current = computed(() => this.months().find(m => m.id === this.sel()));
  spans = computed(() => new Set(this.months().map(m => m.id.slice(0, 4))).size > 1);
  label(m: { id: string; label: string }){ return monthLabel(m.id, m.label, this.spans()); }
}
