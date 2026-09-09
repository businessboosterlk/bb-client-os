import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { CastService } from './core/cast.service';
import { DataService } from './core/data.service';
import { runSelftest } from './core/selftest';

@Component({
  selector: 'bb-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    @if (cast.error()) {
      <div class="nocast">
        <img src="assets/bb-logo.png" alt="Business Booster">
        <strong>No client configured.</strong>
        <p>{{ cast.error() }} Check the link you were sent, or ask your Business Booster team for the right one.</p>
      </div>
    } @else {
      <router-outlet/>
    }
    @if (data.toastMsg(); as t) {
      <div class="toast on" role="status">{{ t.text }}
        @if (t.href) { <button type="button" [routerLink]="t.href">{{ t.label || 'Open' }}</button> }
      </div>
    }`,
  styles: [`.nocast{min-height:100dvh;display:grid;place-content:center;text-align:center;padding:40px 24px;gap:10px;max-width:420px;margin:0 auto}
    .nocast img{width:96px;margin:0 auto 10px}.nocast strong{font-size:18px}.nocast p{color:var(--muted);font-size:13.5px}`]
})
export class AppComponent {
  cast = inject(CastService); data = inject(DataService);
  constructor(){
    if ('serviceWorker' in navigator && location.protocol !== 'file:' && !location.hostname.startsWith('localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (new URLSearchParams(location.search).has('selftest')) setTimeout(() => runSelftest(this.cast, this.data).then(r => (window as any).__bbos = r), 1500);
  }
}
