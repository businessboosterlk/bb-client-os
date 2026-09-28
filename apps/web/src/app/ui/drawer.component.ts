import { Component, Input, Output, EventEmitter, HostListener, OnDestroy, ElementRef, ViewChild, ContentChild, TemplateRef, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from './icon.component';

let seq = 0;
/* THE ONE SHEET. Cast from the Workshop OS mould (17 Sep 2026) with the Apple grade pass on top:
   - it locks the page behind it the iOS way (pin the body at its scroll position, restore on close);
   - ONE page lock and ONE history entry are shared by every sheet, so a sheet opened from inside
     another never closes itself and the phone's Back closes exactly the sheet on screen;
   - it is a NAMED DIALOGUE: focus moves in when it opens and goes back to the control that opened
     it when it closes, and Tab stays inside while it is open;
   - a message that explains the main button is written BESIDE that button, inside the pinned bar;
   - A CLOSED SHEET DRAWS NOTHING. Its body and its bar are templates, drawn when it opens and let go
     once it has slid away. Six closed forms used to sit in every screen and a page of thirty rows
     carried more than a thousand elements (the data run, 28 Sep 2026). */
@Component({
  selector: 'bb-drawer',
  standalone: true,
  imports: [IconComponent, NgTemplateOutlet],
  template: `
    <div class="scrim" [class.on]="open" [class.raised]="raised" (click)="close()"></div>
    <aside #box class="drawer" [class.on]="open" [class.centre]="centre" [class.raised]="raised" role="dialog" aria-modal="true" [attr.aria-labelledby]="id" [attr.aria-hidden]="!open" [attr.inert]="open ? null : ''" tabindex="-1" (keydown)="trap($event)">
      <div class="d-head">
        <h3 [id]="id">{{ title }}</h3>
        @if (editable) { <button class="btn ghost sm d-edit" type="button" data-act="sheet-edit" (click)="edit.emit()"><bb-icon name="edit"/><span>Edit</span></button> }
        <button class="x" type="button" data-act="sheet-close" (click)="close()" aria-label="Close"><bb-icon name="x"/></button>
      </div>
      <div class="d-body">@if (live() && body) { <ng-container [ngTemplateOutlet]="body"/> }</div>
      @if (foot) {
        <div class="d-foot">
          @if (message) { <p class="msg" role="alert">{{ message }}</p> }
          <div class="bar">@if (live()) { <ng-container [ngTemplateOutlet]="foot"/> }</div>
        </div>
      }
    </aside>`
})
export class DrawerComponent implements OnDestroy {
  @ViewChild('box') box!: ElementRef<HTMLElement>;
  readonly id = 'sheet-' + (++seq);
  @ContentChild('body') body?: TemplateRef<unknown>;
  @ContentChild('foot') foot?: TemplateRef<unknown>;
  /* drawn while open, and for the moment it takes to slide away */
  readonly live = signal(false);
  private gone: any;
  @Input() title = '';
  @Input() centre = false;
  /* a question asked from inside a sheet rides above it and dims it */
  @Input() raised = false;
  /* written inside the action bar, beside the button it explains */
  @Input() message = '';
  @Input() set open(v: boolean) { if (v !== this._open) { this._open = v; this.draw(v); v ? this.lock() : this.unlock(); } }
  private draw(v: boolean){ clearTimeout(this.gone); if (v) this.live.set(true); else this.gone = setTimeout(() => this.live.set(false), 260); }
  get open() { return this._open; }
  @Output() closed = new EventEmitter<void>();
  @Input() editable = false;
  @Output() edit = new EventEmitter<void>();
  private _open = false;
  private pushed = false;
  private opener: HTMLElement | null = null;

  static openCount = 0;
  private static lockedY = 0;
  private static handoff = false;
  private static ignorePopUntil = 0;

  close() { if (!this._open) return; this._open = false; this.draw(false); this.unlock(); this.closed.emit(); }
  @HostListener('document:keydown.escape') onEsc() { if (this.top()) this.close(); }
  @HostListener('window:popstate') onPop() {
    if (performance.now() < DrawerComponent.ignorePopUntil) return;
    if (this._open && this.top()) { this.pushed = false; this.close(); }
  }
  /* with two sheets open, Escape and Back close the one in front */
  private top(){ const on = [...document.querySelectorAll('.drawer.on')]; return !on.length || on[on.length - 1] === this.box?.nativeElement || !on.includes(this.box?.nativeElement); }
  trap(e: KeyboardEvent){
    if (e.key !== 'Tab' || !this._open) return;
    const f = this.focusable(); if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || a === this.box.nativeElement)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }
  private focusable(){ return [...this.box.nativeElement.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(e => !e.hasAttribute('disabled') && e.offsetParent !== null); }
  private lock() {
    const D = DrawerComponent;
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (D.openCount === 0) { D.lockedY = window.scrollY; document.body.style.top = `-${D.lockedY}px`; document.body.classList.add('sheet-open'); }
    D.openCount++;
    /* focus in: the first field of a form, else the sheet itself so a screen reader says its name.
       On a touch screen a focused field raises the keyboard over a sheet nobody has read yet, so
       there the sheet takes the focus and the person taps the field they want. */
    setTimeout(() => { if (!this._open) return; const coarse = matchMedia('(pointer:coarse)').matches;
      const field = coarse ? null : this.box.nativeElement.querySelector<HTMLElement>('.d-body input:not([type=hidden]),.d-body textarea,.d-body select');
      (field || this.box.nativeElement).focus({ preventScroll: true }); }, 60);
    if (typeof history === 'undefined') return;
    history.scrollRestoration = 'manual';
    if (D.handoff) { D.handoff = false; this.pushed = true; }
    else { history.pushState({ drawer: 1 }, ''); this.pushed = true; }
  }
  private unlock() {
    const D = DrawerComponent;
    D.openCount = Math.max(0, D.openCount - 1);
    if (D.openCount === 0) { document.body.classList.remove('sheet-open'); document.body.style.top = ''; window.scrollTo(0, D.lockedY); }
    const back = this.opener; this.opener = null;
    if (back && document.contains(back)) setTimeout(() => back.focus({ preventScroll: true }), 0);
    if (!this.pushed) return;
    this.pushed = false;
    /* wait one tick: if another sheet opens now, it takes this entry and nothing steps back */
    D.handoff = true;
    setTimeout(() => { if (!D.handoff) return; D.handoff = false; D.ignorePopUntil = performance.now() + 500; history.back(); }, 0);
  }
  /* a sheet whose screen is left while it is open (a button inside it navigates) hands the page back.
     No history step here: the router has already moved on. */
  ngOnDestroy() {
    clearTimeout(this.gone);
    if (!this._open) return; this._open = false; this.pushed = false;
    const D = DrawerComponent; D.openCount = Math.max(0, D.openCount - 1);
    if (D.openCount === 0) { document.body.classList.remove('sheet-open'); document.body.style.top = ''; }
  }
}
