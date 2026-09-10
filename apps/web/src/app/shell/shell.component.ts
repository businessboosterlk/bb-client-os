import { Component, inject, signal, computed, HostListener, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { DataService } from '../core/data.service';
import { IconComponent } from '../ui/icon.component';
import { BottomMenuComponent, MenuTab, MenuAction } from './bottom-menu.component';
import { ThemeService } from '../core/theme.service';

/* one colour at the top: the status strip and the browser chrome take the colour of
   the screen they sit on. Cream inside the app, the dark ink only on the door. */
export function setTop(color: string){
  document.documentElement.style.setProperty('--top', color);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', color);
}
export function pageColour(){ return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f5f5f7'; }
interface NavItem { path: string; label: string; icon: string; badge?: () => number; }
interface NavGroup { key: 'library' | 'sales'; label: string; items: NavItem[]; }

/* The shell both systems share. Desktop: a 232px rail with TWO collapsible groups,
   Library and Sales, a hairline divider between them, the active screen on a 3px
   accent rail. Phone: a 56px glass topbar and a bottom tab bar carrying the current
   system's screens; the rail slides in from the menu button to switch systems. */
@Component({
  selector: 'bb-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, BottomMenuComponent],
  template: `
    <div class="scrim" [class.on]="railOpen()" (click)="railOpen.set(false)"></div>
    <aside class="rail" [class.open]="railOpen()" aria-label="Navigation">
      <div class="r-brand">
        <img src="assets/bb-logo.png" alt="Business Booster">
        <span class="r-eyebrow">The Hub</span>
      </div>
      <div class="r-clock">{{ clock() }}</div>
      <a class="r-client" routerLink="/start" (click)="railOpen.set(false)">
        @if (cast.cast()?.brand?.logo) { <img [src]="cast.cast()!.brand.logo" alt=""> }
        <span><strong>{{ cast.cast()?.name }}</strong><em>Change system</em></span>
      </a>
      @for (g of groups; track g.key; let last = $last) {
        <div class="grp" [class.off]="collapsed().has(g.key)">
          <button class="grp-h" type="button" (click)="toggle(g.key)" [attr.aria-expanded]="!collapsed().has(g.key)">
            <span>{{ g.label }}</span><bb-icon name="chevd" class="chev"/>
          </button>
          <nav><div>
            @for (it of g.items; track it.path) {
              <a [routerLink]="'/' + g.key + '/' + it.path" routerLinkActive="on" (click)="railOpen.set(false)">
                <bb-icon [name]="it.icon"/>{{ it.label }}
                @if (it.badge && it.badge() > 0) { <span class="nb">{{ it.badge() }}</span> }
              </a>
            }
          </div></nav>
        </div>
        @if (!last) { <hr class="div"> }
      }
      <div class="r-foot">
        <span class="avatar">{{ session.initial() }}</span>
        <span class="who"><strong>{{ session.user() }}</strong><em>{{ role() }}</em></span>
        <button class="x" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Day mode' : 'Night mode'"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
        <button class="x" type="button" (click)="out()" aria-label="Sign out"><bb-icon name="out"/></button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="x hamb" type="button" (click)="railOpen.set(true)" aria-label="Menu"><bb-icon name="menu"/></button>
        <div class="tt"><strong>{{ title() }}</strong><span>{{ system() === 'library' ? 'Your library' : 'Your sales' }} · {{ cast.cast()?.name }}</span>
          @if (data.pending() > 0) { <em class="off">{{ data.pending() }} waiting to sync</em> }</div>
        <div class="tr">
          <button class="x theme" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Day mode' : 'Night mode'" [attr.aria-pressed]="theme.dark()"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
          <a class="btn wa sm" [href]="wa()" target="_blank" rel="noreferrer"><bb-icon name="wa"/><span class="lbl">Message BB</span></a>
        </div>
      </header>
      <main class="page" [class.enter]="entering()"><router-outlet/></main>
      <bb-bottom-menu class="tabs" [items]="tabs()" [active]="activeUrl()"/>
    </div>`,
  styles: [`
    :host{display:block}
    .rail{position:fixed;top:0;left:0;bottom:0;width:var(--side-w);background:var(--sidebar);color:var(--sidebar-txt);z-index:85;
      display:flex;flex-direction:column;padding:calc(18px + var(--sat)) 12px calc(14px + var(--sab));overflow-y:auto;overscroll-behavior:contain;border-right:1px solid var(--sidebar-line)}
    .r-brand{display:flex;flex-direction:column;gap:6px;padding:0 8px 14px}.r-brand img{height:22px;width:auto;align-self:flex-start;filter:brightness(0) invert(1);opacity:.9}
    .r-eyebrow{font-size:10.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--sidebar-faint)}
    .r-clock{font-size:12px;color:var(--sidebar-faint);padding:0 8px 14px;font-variant-numeric:tabular-nums}
    .r-client{display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:10px;margin-bottom:8px;transition:background var(--dur) var(--ease)}
    .r-client:hover{background:rgba(255,255,255,.06)}
    .r-client img{width:30px;height:30px;border-radius:8px;background:#fff;padding:3px;object-fit:contain}
    .r-client strong{display:block;color:#fff;font-size:14px;font-weight:600}.r-client em{display:block;font-style:normal;font-size:11px;color:var(--sidebar-faint)}
    .grp-h{display:flex;align-items:center;justify-content:space-between;width:100%;padding:8px 8px 6px;border:0;background:none;color:var(--sidebar-faint);font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border-radius:8px}
    .grp-h:hover{color:var(--sidebar-txt)}.grp-h .chev{transition:transform var(--dur) var(--ease);--ico:14px}
    .grp.off .grp-h .chev{transform:rotate(-90deg)}
    /* groups fold on a grid track, so the rail never snaps */
    .grp>nav{display:grid;grid-template-rows:1fr;transition:grid-template-rows 240ms var(--ease),opacity 200ms var(--ease)}
    .grp.off>nav{grid-template-rows:0fr;opacity:0;pointer-events:none}
    .grp>nav>div{min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:2px}
    nav a{position:relative;display:flex;align-items:center;gap:11px;min-height:40px;padding:0 10px;border-radius:9px;font-size:13.5px;font-weight:500;color:var(--sidebar-txt);transition:background var(--dur) var(--ease),color var(--dur) var(--ease)}
    nav a:hover{background:rgba(255,255,255,.06);color:#fff}
    nav a.on{background:rgba(255,255,255,.08);color:#fff;font-weight:600}
    nav a.on::before{content:"";position:absolute;left:-12px;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--brand)}
    nav a bb-icon{--ico:17px;opacity:.85}nav a.on bb-icon{opacity:1;color:var(--brand)}
    .nb{margin-left:auto;font-size:11px;font-weight:700;background:var(--brand);color:var(--on-accent);padding:1px 7px;border-radius:999px}
    .div{border:0;border-top:1px solid var(--sidebar-line);margin:10px 4px}
    .r-foot{margin-top:auto;display:flex;align-items:center;gap:10px;padding:14px 4px 0;border-top:1px solid var(--sidebar-line)}
    .r-foot .avatar{background:var(--brand);color:var(--on-accent)}
    .r-foot .who{flex:1;min-width:0}.r-foot strong{display:block;color:#fff;font-size:13px}.r-foot em{display:block;font-style:normal;font-size:11px;color:var(--sidebar-faint)}
    .r-foot .x{color:var(--sidebar-faint)}.r-foot .x:hover{background:rgba(255,255,255,.08);color:#fff}
    .main{margin-left:var(--side-w);min-height:100dvh;display:flex;flex-direction:column}
    .topbar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;height:calc(var(--top-h) + var(--sat));padding:var(--sat) 24px 0;
      background:var(--glass);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);border-bottom:1px solid var(--line)}
    .hamb{display:none}
    .tt{flex:1;min-width:0}.tt strong{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tt span{display:block;font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tt .off{display:inline-block;font-style:normal;font-size:10.5px;font-weight:600;color:var(--amber);background:var(--amber-soft);padding:1px 7px;border-radius:999px;margin-top:2px}
    .tr{display:flex;gap:6px;align-items:center}.theme{color:var(--muted)}.theme:hover{color:var(--ink)}
    .page{flex:1}
    .page.enter{animation:pageIn 260ms var(--ease) both}
    @keyframes pageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.page.enter{animation:none}}
    .tabs{display:none}
    @media (max-width:1019px){
      .rail{transform:translateX(-24px);opacity:0;visibility:hidden;transition:transform 240ms var(--ease),opacity 240ms var(--ease),visibility 0s 240ms;box-shadow:var(--sh-lg)}
      .rail.open{transform:none;opacity:1;visibility:visible;transition:transform 240ms var(--ease),opacity 240ms var(--ease)}
      .main{margin-left:0}
      .hamb{display:grid}
      .topbar{padding:var(--sat) 12px 0 8px}
      .page{padding:16px 16px calc(84px + var(--sab))}
      .btn.wa .lbl{display:none}.btn.wa.sm{width:38px;padding:0;border-radius:10px}
      .tabs{display:block}
    }`]
})
export class ShellComponent implements OnInit, OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); theme = inject(ThemeService);
  private route = inject(ActivatedRoute); private router = inject(Router);
  railOpen = signal(false);
  system = signal<'library' | 'sales'>('library');
  title = signal('');
  clock = signal('');
  collapsed = signal(new Set<string>());
  private timer: any; private sub: any;
  groups: NavGroup[] = [
    { key: 'library', label: 'Library', items: [
      { path: 'month', label: 'This month', icon: 'home' }, { path: 'videos', label: 'Videos', icon: 'video' },
      { path: 'posts', label: 'Posts', icon: 'post' }, { path: 'docs', label: 'Documents', icon: 'doc' },
      { path: 'business', label: 'Your business', icon: 'brain' } ] },
    { key: 'sales', label: 'Sales', items: [
      { path: 'dashboard', label: 'Dashboard', icon: 'dash' },
      { path: 'enquiries', label: 'Enquiries', icon: 'inbox', badge: () => this.data.waiting().length },
      { path: 'pipeline', label: 'Pipeline', icon: 'pipe', badge: () => this.data.stale().length },
      { path: 'customers', label: 'Customers', icon: 'users' },
      { path: 'tasks', label: 'Tasks', icon: 'check', badge: () => this.data.dueTasks().length } ] }
  ];
  activeUrl = signal('');
  entering = signal(false);
  /* the phone bar: every tab carries the quick actions that screen offers */
  tabs = computed<MenuTab[]>(() => {
    const sys = this.system(); const c = this.cast.cast();
    const months = (m: 'videos' | 'posts'): MenuAction[] => (c?.library.months || []).filter(x => x[m].length).slice(0, 6)
      .map(x => ({ label: x.label + ' ' + x.id.slice(0, 4), icon: m === 'videos' ? 'video' : 'post', link: '/library/' + m, params: { m: x.id } }));
    const menus: Record<string, MenuAction[]> = {
      month: [ { label: 'Message Business Booster', icon: 'wa', href: this.wa() }, { label: 'Your sales', icon: 'pipe', link: '/sales' } ],
      videos: months('videos'), posts: months('posts'), docs: [],
      business: [ { label: 'Update a detail', icon: 'edit', href: `https://wa.me/${c?.wa}?text=${encodeURIComponent(`Hello, this is ${c?.name} [OS]. One of the business details needs updating: `)}` } ],
      dashboard: [ { label: 'New ' + this.cast.word('enquiry', 'enquiry').toLowerCase(), icon: 'plus', link: '/sales/enquiries', params: { add: 1 } }, { label: 'Your library', icon: 'video', link: '/library' }, { label: 'Sign out', icon: 'out', run: () => this.out() } ],
      enquiries: [ { label: 'New ' + this.cast.word('enquiry', 'enquiry').toLowerCase(), icon: 'plus', link: '/sales/enquiries', params: { add: 1 } }, { label: 'Waiting', icon: 'inbox', link: '/sales/enquiries', params: { f: 'new' } }, { label: 'Everything', icon: 'list', link: '/sales/enquiries', params: { f: 'all' } } ],
      pipeline: [ { label: 'Board', icon: 'board', link: '/sales/pipeline', params: { view: 'board' } }, { label: 'List', icon: 'list', link: '/sales/pipeline', params: { view: 'list' } }, { label: 'New deal', icon: 'plus', link: '/sales/pipeline', params: { add: 1 } } ],
      customers: [ { label: 'New ' + this.cast.word('customer', 'customer').toLowerCase(), icon: 'plus', link: '/sales/customers', params: { add: 1 } } ],
      tasks: [ { label: 'New task', icon: 'plus', link: '/sales/tasks', params: { add: 1 } }, { label: 'Open', icon: 'check', link: '/sales/tasks' } ]
    };
    return this.groups.find(g => g.key === sys)!.items.map(it => ({ ...it, path: '/' + sys + '/' + it.path, menu: menus[it.path] || [] }));
  });
  role = computed(() => this.cast.cast()?.users.find(u => u.name === this.session.user())?.role || '');
  wa = computed(() => `https://wa.me/${this.cast.cast()?.wa}?text=${encodeURIComponent(`Hello, this is ${this.session.user()} from ${this.cast.cast()?.name} [OS].`)}`);

  ngOnInit(){
    document.body.classList.add('in-shell'); setTop(pageColour());
    this.system.set(this.route.snapshot.data['system']);
    /* the other system starts collapsed, so the rail reads as one group with a door to the other */
    const other = this.system() === 'library' ? 'sales' : 'library';
    this.collapsed.set(new Set([other]));
    this.readTitle();
    this.theme.apply();
    this.sub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const was = this.activeUrl(); this.readTitle();
      /* a screen change rises in; a query-param change on the same screen does not */
      if (was && was !== this.activeUrl()) { this.entering.set(false); requestAnimationFrame(() => this.entering.set(true)); }
    });
    this.tick(); this.timer = setInterval(() => this.tick(), 15000);
  }
  ngOnDestroy(){ document.body.classList.remove('in-shell'); clearInterval(this.timer); this.sub?.unsubscribe(); }
  private readTitle(){ let r = this.route; while (r.firstChild) r = r.firstChild; this.title.set(r.snapshot.data['title'] || ''); this.activeUrl.set(this.router.url.split('?')[0]); }
  private tick(){ const d = new Date(); const D = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    this.clock.set(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} · ${D[d.getDay()]} ${d.getDate()} ${M[d.getMonth()]}`); }
  toggle(k: string){ const s = new Set(this.collapsed()); s.has(k) ? s.delete(k) : s.add(k); this.collapsed.set(s); }
  out(){ this.session.logout(); this.router.navigate(['/login']); }
  @HostListener('document:keydown.escape') esc(){ this.railOpen.set(false); }
}
