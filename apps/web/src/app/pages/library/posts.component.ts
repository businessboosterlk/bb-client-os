import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { LibRowComponent, monthLabel } from './lib.shared';

@Component({
  selector: 'bb-posts',
  standalone: true,
  imports: [LibRowComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Posts</h1><p>What went live on your pages, by month.</p></div></div>
    @if (months().length) {
      <div class="chips" style="margin-bottom:14px">@for (m of months(); track m.id) { <button type="button" [class.on]="sel() === m.id" (click)="sel.set(m.id)">{{ label(m) }}</button> }</div>
      <div class="card list">
        @for (p of current()?.posts || []; track p.href) { <bb-lib-row [item]="p" icon="post"/> }
        @empty { <div class="empty">No posts in {{ current()?.label }}.</div> }
      </div>
    } @else { <div class="card empty"><strong>Nothing here yet</strong>Your first month's posts will appear here.</div> }`
})
export class PostsComponent implements OnInit, OnDestroy {
  cast = inject(CastService); private route = inject(ActivatedRoute);
  private qs: any;
  ngOnInit(){ this.qs = this.route.queryParams.subscribe(p => { if (p['m'] && this.months().some(m => m.id === p['m'])) this.sel.set(p['m']); }); }
  ngOnDestroy(){ this.qs?.unsubscribe(); }
  months = computed(() => this.cast.cast()!.library.months.filter(m => m.posts.length));
  sel = signal(this.months()[0]?.id || '');
  current = computed(() => this.months().find(m => m.id === this.sel()));
  spans = computed(() => new Set(this.months().map(m => m.id.slice(0, 4))).size > 1);
  label(m: { id: string; label: string }){ return monthLabel(m.id, m.label, this.spans()); }
}
