import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../../core/cast.service';
import { SeenService } from '../../core/seen.service';
import { IconComponent } from '../../ui/icon.component';
import { LibRowComponent } from './lib.shared';
import { lead, updatedLine, emptyLine, hasAnything, readSeen, writeSeen, newSince, newCount, searchLibrary, shouldHint, installWords, HINT_KEY } from '../../core/library';

/* THE LIBRARY HOME. Hello; the one thing worth opening first (the newest report, else the newest
   film); a line from the team; what is new since THIS person last looked; then the four sections,
   each saying how much it holds and how much of that is new. One search over all of it. A library
   with nothing in it says so in one honest line, never three zeros. */
@Component({
  selector: 'bb-month',
  standalone: true,
  imports: [RouterLink, FormsModule, IconComponent, LibRowComponent],
  template: `
    <div class="ph"><div>
      <h1 class="t-h1">{{ L().hello }}</h1><p>{{ L().sub }}</p>
      <p class="t-small upd" data-upd>{{ updated() }}</p>
    </div></div>

    <div class="search lib-q">
      <bb-icon name="search"/>
      <input type="search" data-act="library-search" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Search your library" aria-label="Search your library" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false">
    </div>

    @if (q().trim().length >= 2) {
      <div class="sec" data-search-results><div class="sec-head"><h3>Results</h3><span>{{ found().hits.length + found().facts.length }} found</span></div>
        <div class="card list">
          @for (h of found().hits; track h.item.href) { <bb-lib-row [item]="h.item" [icon]="h.icon" [ref]="ref"/> }
          @for (f of found().facts; track f.k) { <a class="li link" data-act="search-fact" routerLink="/library/business" [queryParams]="{ f: f.k }"><span class="ic"><bb-icon name="brain"/></span><span class="tx"><strong>{{ f.k }}</strong><span>{{ f.v }}</span></span><bb-icon name="chev" class="go"/></a> }
          @if (!found().hits.length && !found().facts.length) { <div class="empty"><strong>Nothing matches</strong>Try a word from a title, a month or a business fact.</div> }
        </div></div>
    } @else {
      @if (!any()) {
        <div class="card lead-empty"><bb-icon name="clock"/><div><strong>Your first month is on its way</strong><span>{{ emptyWords() }}</span></div></div>
      }
      @if (lead(); as l) {
        <a class="lead" data-act="lead-open" [href]="l.hit.item.href" target="_blank" rel="noreferrer" (click)="seen.tap(l.hit.item.title, l.hit.item.href)">
          <span class="lead-ic"><bb-icon [name]="l.hit.icon === 'doc' ? 'doc' : l.hit.icon === 'video' ? 'play' : 'post'"/></span>
          <span class="lead-tx"><em>{{ l.eyebrow }}</em><strong>{{ l.hit.item.title }}</strong><span>{{ l.action }}</span></span>
          <bb-icon name="ext" class="go"/>
        </a>
      }
      @if (L().note; as n) {
        <div class="card note"><p>{{ n.text }}</p>@if (n.by || n.date) { <span>{{ [n.by, n.date].join(' · ') }}</span> }</div>
      }
      @if (fresh().length) {
        <div class="sec"><div class="sec-head"><h3>New since your last visit</h3><span>{{ fresh().length }}</span></div>
          <div class="card list">@for (f of fresh(); track f.item.href) { <bb-lib-row [item]="f.item" [icon]="f.icon" [ref]="ref"/> }</div></div>
      }
      <div class="sec"><div class="sec-head"><h3>Your library</h3><span>Tap a section</span></div>
        <div class="card list">
          <a class="li link" data-act="month-videos" routerLink="/library/videos"><span class="ic"><bb-icon name="video"/></span><span class="tx"><strong>Videos</strong><span>{{ line(counts().v, 'video', 'videos', counts().vn) }}</span></span><bb-icon name="chev" class="go"/></a>
          <a class="li link" data-act="month-posts" routerLink="/library/posts"><span class="ic"><bb-icon name="post"/></span><span class="tx"><strong>Posts</strong><span>{{ line(counts().p, 'post', 'posts', counts().pn) }}</span></span><bb-icon name="chev" class="go"/></a>
          <a class="li link" data-act="month-docs" routerLink="/library/docs"><span class="ic"><bb-icon name="doc"/></span><span class="tx"><strong>Documents</strong><span>{{ L().docs.length ? plural(L().docs.length, 'document', 'documents') + ' on file' + more(counts().dn) : 'Your reports will appear here' }}</span></span><bb-icon name="chev" class="go"/></a>
          <a class="li link" data-act="month-business" routerLink="/library/business"><span class="ic"><bb-icon name="brain"/></span><span class="tx"><strong>Your business</strong><span>{{ L().facts.length ? plural(L().facts.length, 'fact', 'facts') + ' guiding your work' : 'Your profile is on its way' }}</span></span><bb-icon name="chev" class="go"/></a>
        </div></div>
      @if (hint()) {
        <div class="card hint" role="note">
          <bb-icon name="smartphone"/>
          <div class="hint-tx"><strong>Keep this on your phone</strong><span>{{ hintWords }}</span></div>
          <button type="button" class="x" data-act="hint-dismiss" (click)="dismiss()" aria-label="Dismiss"><bb-icon name="x"/></button>
        </div>
      }
    }`,
  styles: [`
    .upd{margin-top:8px}
    .lib-q{margin:0 0 18px}
    /* THE ONE ACCENT MOMENT on this screen: the thing worth opening first, on the client's colour */
    .lead{display:flex;align-items:center;gap:16px;padding:18px 18px;border-radius:16px;background:var(--brand);color:var(--on-accent);margin-bottom:14px;transition:transform var(--dur) var(--ease)}
    .lead:active{transform:scale(.99)}@media (hover:hover){.lead:hover{background:var(--brand-dark)}}
    .lead-ic{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.18);display:grid;place-items:center;--ico:26px;flex-shrink:0}
    html[data-theme="dark"] .lead-ic{background:rgba(0,0,0,.18)}
    .lead-tx{flex:1;min-width:0}.lead-tx em{display:block;font-style:normal;font-size:12px;font-weight:600;opacity:.82}
    /* a title gets two lines before it is cut: a report's name is the point of the card */
    .lead-tx strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:17px;font-weight:700;letter-spacing:-.01em;line-height:1.25;margin-top:3px;overflow:hidden}
    .lead-tx span{display:block;font-size:12.5px;font-weight:600;margin-top:6px;opacity:.9}
    .lead .go{opacity:.75}
    .lead-empty{display:flex;align-items:center;gap:14px;padding:18px;margin-bottom:14px;--ico:22px;color:var(--muted)}
    .lead-empty strong{display:block;color:var(--ink);font-weight:600;margin-bottom:3px}.lead-empty span{display:block;font-size:13px;line-height:1.45}
    .note{padding:16px 18px;margin-bottom:14px}.note p{font-size:14.5px;line-height:1.5;color:var(--ink)}.note span{display:block;margin-top:8px;font-size:12px;color:var(--muted)}
    .hint{display:flex;align-items:flex-start;gap:12px;padding:14px 10px 14px 16px;margin-top:22px;--ico:20px;color:var(--brand-text)}
    .hint-tx{flex:1;min-width:0}.hint-tx strong{display:block;color:var(--ink);font-weight:600;font-size:13.5px}.hint-tx span{display:block;color:var(--muted);font-size:12.5px;line-height:1.45;margin-top:3px}
    .hint .x{flex-shrink:0;margin:-6px -2px 0 0}`]
})
export class MonthComponent implements OnInit {
  cast = inject(CastService); seen = inject(SeenService);
  L = computed(() => this.cast.cast()!.library);
  /* the stamp of the last visit, read once before this visit writes its own */
  ref = readSeen(this.cast.slug());
  q = signal('');
  found = computed(() => searchLibrary(this.L(), this.q()));
  any = computed(() => hasAnything(this.L()));
  lead = computed(() => lead(this.L()));
  updated = computed(() => updatedLine(this.L()));
  emptyWords = computed(() => emptyLine(this.cast.cast()?.short || this.cast.cast()?.name || 'you'));
  counts = computed(() => { const m = this.L().months; const v = m.flatMap(x => x.videos), p = m.flatMap(x => x.posts);
    return { v: v.length, p: p.length, vn: newCount(v, this.ref), pn: newCount(p, this.ref), dn: newCount(this.L().docs, this.ref), months: m.length }; });
  fresh = computed(() => newSince(this.L(), this.ref).slice(0, 6));
  hint = signal(false);
  hintWords = installWords(navigator.userAgent);
  ngOnInit(){
    let dismissed = false; try { dismissed = localStorage.getItem(HINT_KEY(this.cast.slug())) === '1'; } catch {}
    const standalone = matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone;
    this.hint.set(shouldHint(matchMedia('(pointer:coarse)').matches, standalone, dismissed, this.seen.src));
    /* this visit becomes the last visit once the person has had a moment to read what was new */
    setTimeout(() => writeSeen(this.cast.slug()), 1500);
  }
  dismiss(){ try { localStorage.setItem(HINT_KEY(this.cast.slug()), '1'); } catch {} this.hint.set(false); }
  plural(n: number, a: string, b: string){ return `${n} ${n === 1 ? a : b}`; }
  more(n: number){ return n ? ` · ${n} new` : ''; }
  line(n: number, a: string, b: string, fresh: number){ return n ? `${this.plural(n, a, b)} across ${this.plural(this.counts().months, 'month', 'months')}${this.more(fresh)}` : 'Nothing here yet'; }
}
