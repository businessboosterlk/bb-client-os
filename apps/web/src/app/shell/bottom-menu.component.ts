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
            <div class="bm-view">
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
    .bm{position:fixed;left:50%;bottom:calc(14px + var(--sab));transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;align-items:center}
    .bm-bar{display:flex;align-items:center;gap:4px;padding:4px;border-radius:18px;border:1px solid var(--line);
      background:rgba(255,255,255,.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 8px 28px rgba(20,20,23,.12),0 1px 2px rgba(20,20,23,.06)}
    .bm-btn{position:relative;width:46px;height:46px;border:0;border-radius:16px;background:none;color:var(--muted);display:grid;place-items:center;
      transition:background var(--dur) var(--ease),color var(--dur) var(--ease)}
    .bm-btn bb-icon{--ico:22px}
    .bm-btn.on{color:var(--brand-dark)}
    .bm-btn.sel{background:var(--surface-2);color:var(--ink)}
    .bm-btn:active{background:var(--surface-2)}
    .bm-btn .dot{position:absolute;top:9px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--brand);border:2px solid #fff}
    /* the panel: sized in px from the measured card so width and height can animate */
    .bm-sub{position:absolute;bottom:70px;left:50%;translate:-50% 0;overflow:hidden;width:0;height:0;opacity:0;transform:scale(.95,.9);transform-origin:bottom center;
      transition:width .3s cubic-bezier(.45,0,.25,1),height .3s cubic-bezier(.45,0,.25,1),opacity .3s cubic-bezier(.45,0,.25,1),transform .3s cubic-bezier(.45,0,.25,1);pointer-events:none}
    .bm-sub.on{opacity:1;transform:none;pointer-events:auto}
    .bm-card{position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:max-content;border-radius:18px;border:1px solid var(--line);
      background:rgba(255,255,255,.95);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 8px 28px rgba(20,20,23,.12)}
    .bm-view{min-width:210px;padding:6px;animation:bmIn .25s cubic-bezier(.42,0,.58,1) both}
    @keyframes bmIn{from{opacity:0;transform:scale(.96);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}
    .bm-title{font-size:11px;font-weight:600;color:var(--muted);padding:6px 12px 4px}
    .bm-item{display:flex;align-items:center;gap:12px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:12px;background:none;text-align:left;
      font-size:15px;color:var(--ink-2);transition:background 75ms linear,color 75ms linear}
    .bm-item bb-icon{--ico:20px;color:var(--muted);transition:color 75ms linear}
    .bm-item:hover,.bm-item:active{background:var(--surface-2);color:var(--ink)}.bm-item:hover bb-icon{color:var(--ink)}
    @media (prefers-reduced-motion:reduce){.bm-sub{transition:none}.bm-view{animation:none}}`]
})
export class BottomMenuComponent implements AfterViewInit, OnDestroy {
  private router = inject(Router); private host = inject(ElementRef<HTMLElement>); private injector = inject(Injector);
  @Input() items: MenuTab[] = [];
  @Input() active = '';
  @ViewChild('card') card!: ElementRef<HTMLElement>;
  open = signal<string | null>(null);
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
    this.open.set(it.path);
    /* measure the moment Angular has rendered the new view, not on a browser frame:
       a throttled tab still sizes the panel correctly */
    afterNextRender(() => this.measure(), { injector: this.injector });
  }
  private measure(){
    if (!this.open()) return;
    const c = this.card?.nativeElement; if (!c) return;
    const r = c.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) { this.w.set(Math.ceil(r.width)); this.h.set(Math.ceil(r.height)); }
  }
  close(){ if (!this.open()) return; this.open.set(null); this.w.set(0); this.h.set(0); }
  act(a: MenuAction){
    this.close();
    if (a.href) { window.open(a.href, '_blank', 'noopener'); return; }
    if (a.run) { a.run(); return; }
    if (a.link) this.router.navigate([a.link], { queryParams: a.params || {} });
  }
  @HostListener('document:pointerdown', ['$event']) outside(e: Event){ if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close(); }
  @HostListener('document:keydown.escape') esc(){ this.close(); }
}
