import { Component, Input, Output, EventEmitter, HostListener, OnDestroy } from '@angular/core';
import { IconComponent } from './icon.component';

/* The one overlay. It locks the page behind it the iOS way (pin the body at its
   scroll position, restore on close), pushes a history entry so the phone back
   button closes it, and closes on Escape. Hidden in place, never parked off screen. */
@Component({
  selector: 'bb-drawer',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="scrim" [class.on]="open" (click)="close()"></div>
    <aside class="drawer" [class.on]="open" role="dialog" [attr.aria-hidden]="!open" [attr.inert]="open ? null : ''">
      <div class="d-head">
        <h3>{{ title }}</h3>
        <button class="x" type="button" (click)="close()" aria-label="Close"><bb-icon name="x"/></button>
      </div>
      <div class="d-body"><ng-content/></div>
      <div class="d-foot" [hidden]="!foot"><ng-content select="[foot]"/></div>
    </aside>`
})
export class DrawerComponent implements OnDestroy {
  @Input() title = '';
  @Input() foot = true;
  @Input() set open(v: boolean) { if (v !== this._open) { this._open = v; v ? this.lock() : this.unlock(); } }
  get open() { return this._open; }
  @Output() closed = new EventEmitter<void>();
  private _open = false;
  private lockedY = 0;
  private pushed = false;
  private closing = false;

  close() { if (!this._open) return; this._open = false; this.unlock(); this.closed.emit(); }
  /* a sheet whose screen is left while it is open (a button inside it navigates) must hand the page
     back. Found 17 Sep 2026 in the Workshop OS: Make a quote from an enquiry sheet left the body pinned,
     so the next screen could not scroll on a phone. Ported to the Hub the same day. No history.back
     here: the router has already moved on. */
  ngOnDestroy() {
    if (!this._open) return; this._open = false;
    document.body.classList.remove('sheet-open'); document.body.style.top = '';
  }
  @HostListener('document:keydown.escape') onEsc() { this.close(); }
  @HostListener('window:popstate') onPop() { if (this._open && !this.closing) { this.pushed = false; this.close(); } }
  private lock() {
    if (typeof history !== 'undefined') { history.scrollRestoration = 'manual'; history.pushState({ drawer: 1 }, ''); this.pushed = true; }
    this.lockedY = window.scrollY;
    document.body.style.top = `-${this.lockedY}px`;
    document.body.classList.add('sheet-open');
  }
  private unlock() {
    document.body.classList.remove('sheet-open');
    document.body.style.top = '';
    window.scrollTo(0, this.lockedY);
    if (this.pushed) { this.closing = true; this.pushed = false; history.back(); setTimeout(() => this.closing = false, 50); }
  }
}
