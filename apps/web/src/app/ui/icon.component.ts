import { Component, Input, HostBinding, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LINE, BRAND } from './icons.generated';
import { OFFSETS, AIR } from './icon-offsets.generated';

/* THE ONE PLACE A DRAWING IS ASSEMBLED. Every shape is read from icons.generated.ts, which
   scripts/build-icons.mjs writes from Lucide (line) and Simple Icons (brand marks). Nothing is
   typed by hand, and ~/bb-systems/qa/hand-svg.mjs fails the build on any other svg in the source. */
@Component({
  selector: 'bb-icon',
  standalone: true,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" [innerHTML]="svg" [attr.fill]="brand ? 'currentColor' : 'none'" [attr.stroke]="brand ? 'none' : 'currentColor'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></svg>`,
  styles: [`:host{display:inline-flex;flex-shrink:0;line-height:0} svg{width:var(--ico,16px);height:var(--ico,16px)}`]
})
export class IconComponent {
  private san = inject(DomSanitizer);
  private static cache = new Map<string, SafeHtml>();
  @Input() name = 'home';
  /* the air this drawing carries at its side, for the rule that pulls a leading icon in */
  @HostBinding('style.--air') get air(){ return AIR[this.name] ?? 3; }
  get brand(){ return !!BRAND[this.name]; }
  get svg(): SafeHtml {
    const k = this.name, C = IconComponent.cache;
    if (!C.has(k)) { const o = OFFSETS[k]; const body = BRAND[k] || LINE[k] || LINE['home']; C.set(k, this.san.bypassSecurityTrustHtml(o ? `<g transform="translate(${o[0]} ${o[1]})">${body}</g>` : body)); }
    return C.get(k)!;
  }
}
