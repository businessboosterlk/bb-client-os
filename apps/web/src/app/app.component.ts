import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CastService } from './core/cast.service';
import { DataService } from './core/data.service';
import { SessionService } from './core/session.service';
import { runSelftest } from './core/selftest';

@Component({
  selector: 'bb-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <router-outlet/>
    @if (data.toastMsg(); as t) {
      <div class="toast on" role="status">{{ t.text }}
        @if (t.href) { <button type="button" [routerLink]="t.href">{{ t.label || 'Open' }}</button> }
      </div>
    }`
})
export class AppComponent {
  cast = inject(CastService); data = inject(DataService); session = inject(SessionService); private router = inject(Router);
  constructor(){
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.hostname.startsWith('localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (new URLSearchParams(location.search).has('selftest')) setTimeout(() => runSelftest(this.cast, this.data).then(r => (window as any).__bbos = r), 1500);
    /* a seat that the server no longer accepts goes back to the door, with a word why */
    effect(() => { if (this.data.authLost()) { this.data.authLost.set(false); this.session.logout(); this.session.error.set('Your session ended. Sign in again.'); this.router.navigate(['/login']); } });
  }
}
