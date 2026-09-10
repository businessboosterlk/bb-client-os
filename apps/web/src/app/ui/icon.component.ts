import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/* One stroke set, currentColor, never emoji. Add a glyph here, use it everywhere. */
const P: Record<string, string> = {
  home: '<path d="M4 11.5 12 5l8 6.5M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5"/>',
  video: '<rect x="2.5" y="5.5" width="14" height="13" rx="2.5"/><path d="m16.5 10 5-3v10l-5-3"/>',
  post: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
  doc: '<path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/><path d="M14 2.5v4.5h4.5M8.5 12h7M8.5 16h7"/>',
  brain: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/>',
  dash: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  inbox: '<path d="M3.5 6.5h17v11h-17z"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  pipe: '<path d="M4 6h16M4 12h11M4 18h6"/><circle cx="19" cy="17.5" r="2.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M21 20c0-3-1.9-5.2-4.5-5.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  chevd: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  meet: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  note: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 12h8M8 16h5"/>',
  quote: '<path d="M6 2.5h8l4 4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/><path d="M9 13h6M9 17h4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  money: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.5 9.5c0-1-1-1.5-2.5-1.5s-2.5.7-2.5 1.7c0 2.4 5 1.4 5 3.8 0 1-1 1.7-2.5 1.7s-2.5-.6-2.5-1.5"/>',
  flame: '<path d="M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 12c0-1 .3-2 1-3 .3 1.5 1 2 2 2 0-3-1-5 1-8Z"/>',
  alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  out: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m12.5 7.5 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  wa: 'WA'
};
const WA = '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>';

@Component({
  selector: 'bb-icon',
  standalone: true,
  template: `<svg viewBox="0 0 24 24" [attr.aria-hidden]="true" [innerHTML]="svg" [attr.fill]="name==='wa'?'currentColor':'none'" [attr.stroke]="name==='wa'?'none':'currentColor'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></svg>`,
  styles: [`:host{display:inline-flex;flex-shrink:0;line-height:0} svg{width:var(--ico,16px);height:var(--ico,16px)}`]
})
export class IconComponent {
  private san = inject(DomSanitizer);
  private cache = new Map<string, SafeHtml>();
  @Input() name = 'home';
  get svg(): SafeHtml {
    const k = this.name;
    if (!this.cache.has(k)) this.cache.set(k, this.san.bypassSecurityTrustHtml(k === 'wa' ? WA : (P[k] || P['home'])));
    return this.cache.get(k)!;
  }
}
