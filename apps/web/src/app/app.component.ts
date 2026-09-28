import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CastService } from './core/cast.service';
import { DataService } from './core/data.service';
import { SessionService } from './core/session.service';
import { runSelftest } from './core/selftest';
import { ThemeService } from './core/theme.service';
import { UpdateService } from './core/update.service';
import { AskComponent } from './ui/ask.component';

@Component({
  selector: 'bb-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AskComponent],
  template: `
    <router-outlet/>
    <bb-ask/>
    @if (data.toastMsg(); as t) {
      <div class="toast on" role="status">{{ t.text }}
        @if (t.href) { <button type="button" data-act="toast-open" [routerLink]="t.href">{{ t.label || 'Open' }}</button> }
      </div>
    }`
})
export class AppComponent {
  cast = inject(CastService); data = inject(DataService); session = inject(SessionService); theme = inject(ThemeService); update = inject(UpdateService); private router = inject(Router);
  constructor(){
    this.theme.onChange = () => { const c = this.cast.cast(); if (c) this.cast.apply(c); };
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.hostname.startsWith('localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
    this.update.start();
    /* how far the phone has slid the page up for the keyboard, so the status strip can stay put */
    const vv = window.visualViewport;
    if (vv) { const f = () => document.documentElement.style.setProperty('--vv-top', Math.max(0, Math.round(vv.offsetTop)) + 'px'); vv.addEventListener('scroll', f); vv.addEventListener('resize', f); f(); }
    if (new URLSearchParams(location.search).has('selftest')) setTimeout(() => runSelftest(this.cast, this.data).then(r => (window as any).__bbos = r), 1500);
    /* a seat that the server no longer accepts goes back to the door, with a word why. The drafts
       and the device copy stay: the same person signs in again and finds what they were typing. */
    effect(() => { if (this.data.authLost()) { this.data.authLost.set(false); this.session.logout(); this.session.error.set('Your session ended. Sign in again.'); this.router.navigate(['/login']); } });
  }
}
