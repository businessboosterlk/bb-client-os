import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { IconComponent } from '../../ui/icon.component';
import { LibRowComponent, isNew } from './lib.shared';

/* The library home: hello, the month in three figures, what is new, then the sections. */
@Component({
  selector: 'bb-month',
  standalone: true,
  imports: [RouterLink, IconComponent, LibRowComponent],
  template: `
    <div class="ph"><div>
      <h1 class="t-h1">{{ L().hello }}</h1><p>{{ L().sub }}</p>
      <p class="t-small" style="margin-top:8px">Updated {{ cast.cast()?.updated }}@if (latest(); as l) { · Latest: <strong>{{ l }}</strong> }</p>
    </div></div>
    <div class="kpi three">
      <div class="card"><div class="k-label">Videos</div><div class="k-val">{{ counts().v }}</div><div class="k-sub">{{ counts().vm ? 'in ' + counts().vm : 'across ' + plural(L().months.length,'month','months') }}</div></div>
      <div class="card"><div class="k-label">Posts</div><div class="k-val">{{ counts().p }}</div><div class="k-sub">published</div></div>
      <div class="card"><div class="k-label">Documents</div><div class="k-val">{{ L().docs.length }}</div><div class="k-sub">on file</div></div>
    </div>
    @if (fresh().length) {
      <div class="sec"><div class="sec-head"><h3>New since your last visit</h3><span>{{ fresh().length }}</span></div>
        <div class="card list">@for (f of fresh(); track f.item.href) { <bb-lib-row [item]="f.item" [icon]="f.icon"/> }</div></div>
    }
    <div class="sec"><div class="sec-head"><h3>Your library</h3><span>Tap a section</span></div>
      <div class="card list">
        <a class="li link" routerLink="/library/videos"><span class="ic"><bb-icon name="video"/></span><span class="tx"><strong>Videos</strong><span>{{ counts().v ? plural(counts().v,'video','videos') + ' across ' + plural(L().months.length,'month','months') : 'Nothing here yet' }}</span></span><bb-icon name="chev" class="go"/></a>
        <a class="li link" routerLink="/library/posts"><span class="ic"><bb-icon name="post"/></span><span class="tx"><strong>Posts</strong><span>{{ counts().p ? plural(counts().p,'post','posts') + ' across ' + plural(L().months.length,'month','months') : 'Nothing here yet' }}</span></span><bb-icon name="chev" class="go"/></a>
        <a class="li link" routerLink="/library/docs"><span class="ic"><bb-icon name="doc"/></span><span class="tx"><strong>Documents</strong><span>{{ L().docs.length ? plural(L().docs.length,'document','documents') + ' on file' : 'Your reports will appear here' }}</span></span><bb-icon name="chev" class="go"/></a>
        <a class="li link" routerLink="/library/business"><span class="ic"><bb-icon name="brain"/></span><span class="tx"><strong>Your business</strong><span>{{ L().facts.length ? plural(L().facts.length,'fact','facts') + ' guiding your work' : 'Your profile is on its way' }}</span></span><bb-icon name="chev" class="go"/></a>
      </div></div>`,
  styles: [`.kpi.three{grid-template-columns:repeat(3,minmax(0,1fr))}`]
})
export class MonthComponent {
  cast = inject(CastService);
  L = computed(() => this.cast.cast()!.library);
  counts = computed(() => { const m = this.L().months; const last = m[0]; return { v: m.reduce((a, x) => a + x.videos.length, 0), p: m.reduce((a, x) => a + x.posts.length, 0), vm: last ? last.label : '' }; });
  latest = computed(() => this.L().months[0]?.videos[0]?.title || this.L().months[0]?.posts[0]?.title || '');
  fresh = computed(() => { const out: { item: any; icon: string }[] = [];
    this.L().months.forEach(m => { m.videos.forEach(v => isNew(v.added) && out.push({ item: v, icon: 'video' })); m.posts.forEach(p => isNew(p.added) && out.push({ item: p, icon: 'post' })); });
    this.L().docs.forEach(d => isNew(d.added) && out.push({ item: d, icon: 'doc' })); return out.slice(0, 6); });
  plural(n: number, a: string, b: string){ return `${n} ${n === 1 ? a : b}`; }
}
