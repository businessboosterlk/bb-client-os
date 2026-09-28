import { Component, Input, Output, EventEmitter } from '@angular/core';

/* LISTS DRAW A WINDOW: thirty rows, then the next thirty. A book of five thousand customers draws
   thirty of them, and the person asks for more with one button that says how many are left to
   show. Nothing loads by itself as the page scrolls: a list that grows under a moving thumb moves
   the very button the thumb was reaching for (found by the click path run, 28 Sep 2026). */
export const WINDOW = 30;
@Component({
  selector: 'bb-more',
  standalone: true,
  template: `
    @if (total > shown) {
      <div class="more">
        <span>Showing {{ shown }} of {{ total.toLocaleString('en-GB') }}</span>
        <button type="button" class="btn ghost sm" data-act="show-more" (click)="more.emit()">Show {{ next }} more</button>
      </div>
    } @else if (total > 30) { <div class="more end"><span>All {{ total.toLocaleString('en-GB') }} shown</span></div> }`,
  styles: [`:host{display:block}
    .more{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
    .more .btn{min-height:40px}
    .more.end{justify-content:center}`]
})
export class MoreComponent {
  @Input() total = 0; @Input() shown = 0;
  @Output() more = new EventEmitter<void>();
  get next(){ return Math.min(WINDOW, this.total - this.shown); }
}
