import { Component, Input, signal, computed, ElementRef, inject, HostListener, ViewChild, AfterViewInit, OnDestroy, Injector, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../ui/icon.component';

export interface MenuAction { label: string; icon: string; link?: string; params?: Record<string, any>; href?: string; run?: () => void; }
export interface MenuTab { path: string; label: string; icon: string; badge?: () => number; menu?: MenuAction[]; }

/* The phone bar, built to the uselayouts Bottom Menu (MIT, 21st.dev, 0xUrvish):
   a small floating pill of icons; tap one and a panel grows out of the pill from
   the bottom centre, width and height together, 300ms on cubic-bezier(.45,0,.25,1),
   scale .95/.9 to 1, opacity 0 to 1; switch while open and the contents crossfade
   with a 10px blur over 250ms; tap outside or Escape and it folds back in.
   The tap ALSO navigates, because a bar that only opens menus is not a nav. */
@Component({
  selector: 'bb-bottom-menu',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="bm" [class.open]="open()">
      <div class="bm-sub" [class.on]="open()" [style.width.px]="w()" [style.height.px]="h()">
        <div class="bm-card" #card>
          @for (c of view(); track c.path) {
            <div class="bm-view" [class.swap]="swapped()">
              <div class="bm-title">{{ c.label }}</div>
              @for (a of c.menu; track a.label) {
                <button type="button" class="bm-item" (click)="act(a)"><bb-icon [name]="a.icon"/><span>{{ a.label }}</span></button>
              }
            </div>
          }
        </div>
      </div>
      <div class="bm-bar" role="tablist" aria-label="Screens">
        @for (it of items; track it.path) {
          <button type="button" class="bm-btn" [class.on]="active === it.path" [class.sel]="open() === it.path" (click)="tap(it, $event)" [attr.aria-label]="it.label" [attr.aria-expanded]="open() === it.path">
            <bb-icon [name]="it.icon"/>
            @if (it.badge && it.badge() > 0) { <i class="dot"></i> }
          </button>
        }
      </div>
    </div>`,
  styles: [`
    :host{display:block}
    .bm{position:fixed;left:50%;bottom:calc(14px + var(--sab));transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;align-items:center;
      transition:opacity 180ms var(--ease),translate 180ms var(--ease)}
    /* a sheet or the rail owns the screen: the bar steps down and out of its way */
    :host-context(body.sheet-open) .bm{opacity:0;translate:0 18px;pointer-events:none}
    .bm-bar{display:flex;align-items:center;gap:4px;padding:4px;border-radius:18px;border:1px solid var(--line);
      background:var(--pill);border-color:var(--pill-line);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
      box-shadow:var(--sh-lg)}
    .bm-btn{position:relative;width:46px;height:46px;border:0;border-radius:16px;background:none;color:var(--muted);display:grid;place-items:center;
      transition:background 150ms var(--ease),color 150ms var(--ease),transform 150ms var(--ease)}
    .bm-btn bb-icon{--ico:22px}
    .bm-btn.on{color:var(--brand-dark)}
    .bm-btn.sel{background:var(--surface-2);color:var(--ink)}
    .bm-btn:active{transform:scale(.92)}
    .bm-btn .dot{position:absolute;top:9px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--brand);border:2px solid var(--dot-ring)}
    /* the wrapper knows the final size (measured), carries the shadow, and only ever moves
       by transform and opacity. Nothing here animates layout, nothing clips the shadow. */
    .bm-sub{position:absolute;bottom:70px;left:50%;translate:-50% 0;width:0;height:0;border-radius:18px;
      opacity:0;transform:scale(.95,.9);transform-origin:bottom center;pointer-events:none;will-change:transform,opacity;
      box-shadow:var(--sh-lg);
      transition:opacity .3s cubic-bezier(.45,0,.25,1),transform .3s cubic-bezier(.45,0,.25,1),box-shadow .3s cubic-bezier(.45,0,.25,1)}
    .bm-sub.on{opacity:1;transform:none;pointer-events:auto}
    /* the card reveals itself from the bottom edge up, a clip on the compositor, same 300ms curve */
    .bm-card{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:max-content;border-radius:18px;border:1px solid var(--line);
      background:var(--card-glass);border-color:var(--pill-line);clip-path:inset(100% 0 0 0 round 18px);
      transition:clip-path .3s cubic-bezier(.45,0,.25,1)}
    .bm-sub.on .bm-card{clip-path:inset(0 0 0 0 round 18px)}
    .bm-view{min-width:214px;padding:6px}
    .bm-view.swap{animation:bmSwap .25s cubic-bezier(.42,0,.58,1) both}
    @keyframes bmSwap{from{opacity:0;transform:scale(.97);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
    .bm-title{font-size:11px;font-weight:600;color:var(--muted);padding:8px 12px 4px;letter-spacing:.01em}
    .bm-item{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:12px;background:none;text-align:left;
      font-size:15px;color:var(--ink-2);transition:background 100ms linear,color 100ms linear,transform 120ms var(--ease)}
    .bm-item bb-icon{--ico:20px;color:var(--muted);transition:color 100ms linear}
    .bm-item:hover,.bm-item:active{background:var(--surface-2);color:var(--ink)}.bm-item:hover bb-icon,.bm-item:active bb-icon{color:var(--ink)}
    .bm-item:active{transform:scale(.985)}
    @media (prefers-reduced-motion:reduce){.bm-sub,.bm-card,.bm-btn,.bm-item{transition:none}.bm-view.swap{animation:none}}
`]
})
export class BottomMenuComponent implements AfterViewInit, OnDestroy {
  private router = inject(Router); private host = inject(ElementRef<HTMLElement>); private injector = inject(Injector);
  @Input() items: MenuTab[] = [];
  @Input() active = '';
  @ViewChild('card') card!: ElementRef<HTMLElement>;
  open = signal<string | null>(null);
  swapped = signal(false);
  w = signal(0); h = signal(0);
  view = computed(() => { const k = this.open(); const it = this.items.find(i => i.path === k); return it && it.menu?.length ? [it] : []; });

  private ro?: ResizeObserver;
  ngAfterViewInit(){
    /* the panel follows the card's real size, whenever it changes: first open, a switch
       while open, a longer label. No frame timing to get wrong. */
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this.card.nativeElement);
    }
  }
  ngOnDestroy(){ this.ro?.disconnect(); }
  tap(it: MenuTab, ev: Event){
    ev.stopPropagation();
    const same = this.open() === it.path;
    if (this.active !== it.path) this.router.navigateByUrl(it.path);
    if (same || !it.menu?.length) { this.close(); return; }
    this.swapped.set(!!this.open());
    this.open.set(it.path);
    /* measure the moment Angular has rendered the new view, not on a browser frame:
       a throttled tab still sizes the panel correctly */
    afterNextRender(() => this.measure(), { injector: this.injector });
  }
  private measure(){
    if (!this.open()) return;
    const c = this.card?.nativeElement; if (!c) return;
    /* layout size, never the rendered rect: the closed wrapper is scaled .95/.9 and a
       rect read through that transform came back 10px short, leaving the shadow box
       smaller than the card on first open */
    const w = c.offsetWidth, h = c.offsetHeight;
    if (w > 4 && h > 4) { this.w.set(w); this.h.set(h); }
  }
  close(){ if (!this.open()) return; this.open.set(null); this.swapped.set(false); this.w.set(0); this.h.set(0); }
  act(a: MenuAction){
    this.close();
    if (a.href) { window.open(a.href, '_blank', 'noopener'); return; }
    if (a.run) { a.run(); return; }
    if (a.link) this.router.navigate([a.link], { queryParams: a.params || {} });
  }
  @HostListener('document:pointerdown', ['$event']) outside(e: Event){ if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close(); }
  @HostListener('document:keydown.escape') esc(){ this.close(); }
}
