import { Component, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { setTop } from '../shell/shell.component';

/* The door. Pick your name, enter the PIN, land on the launcher. On a phone the
   PIN field is 16px so the page never zooms, and the last field submits. */
@Component({
  selector: 'bb-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login">
      <div class="login-card">
        <div class="brand">
          @if (cast.cast()?.brand?.logo) { <img class="mark" [src]="cast.cast()!.brand.logo" [alt]="cast.cast()!.name"> }
          <h1>{{ cast.cast()?.name }}</h1>
          <p>Your OS, by Business Booster</p>
        </div>
        <div class="who">
          @for (u of cast.cast()?.users || []; track u.name) {
            <button type="button" [class.on]="name() === u.name" (click)="name.set(u.name); focusPin()">
              <span class="avatar">{{ u.name.slice(0,1) }}</span>
              <span><strong>{{ u.name }}</strong><em>{{ u.role }}</em></span>
            </button>
          }
        </div>
        <form (submit)="go($event)">
          <div class="field">
            <label for="pin">PIN</label>
            <input id="pin" type="password" inputmode="numeric" autocomplete="off" enterkeyhint="go" [(ngModel)]="pin" name="pin" placeholder="Enter your PIN" [attr.aria-invalid]="bad()">
            @if (bad()) { <span class="err">That is not the PIN for {{ name() || 'this account' }}.</span> }
            @if (cast.cast()?.data?.mode === 'local') { <span class="hint">Demo: the PIN is {{ cast.cast()?.pin }}. A real client gets a private one.</span> }
          </div>
          <button class="btn" type="submit" [disabled]="!name()">Sign in</button>
        </form>
        <div class="foot"><img src="assets/bb-logo.png" alt="Business Booster"></div>
      </div>
    </div>`,
  styles: [`
    .login{min-height:100dvh;display:grid;place-items:center;padding:calc(20px + var(--sat)) 16px calc(20px + var(--sab));background:var(--sidebar)}
    .login-card{width:100%;max-width:400px;background:var(--surface);border-radius:20px;padding:30px 26px;box-shadow:var(--sh-lg)}
    .brand{text-align:center;margin-bottom:22px}.brand .mark{height:44px;margin-bottom:10px}
    .brand h1{font-size:22px;font-weight:700;letter-spacing:-.02em}.brand p{color:var(--muted);font-size:13px;margin-top:4px}
    .who{display:grid;gap:8px;margin-bottom:18px}
    .who button{display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 12px;border:1px solid var(--line-2);border-radius:12px;background:var(--surface);text-align:left;transition:border-color var(--dur) var(--ease),background var(--dur) var(--ease)}
    .who button.on{border-color:var(--brand);background:var(--brand-soft-2)}
    .who strong{display:block;font-size:14px}.who em{display:block;font-style:normal;font-size:12px;color:var(--muted)}
    form{display:grid;gap:14px}.err{font-size:12px;color:var(--red);font-weight:600}
    .btn{width:100%;min-height:46px}
    .foot{margin-top:22px;text-align:center}.foot img{height:22px;opacity:.7}`]
})
export class LoginComponent implements OnDestroy {
  cast = inject(CastService); private session = inject(SessionService); private router = inject(Router);
  name = signal(''); pin = ''; bad = signal(false);
  constructor(){ setTop(getComputedStyle(document.documentElement).getPropertyValue('--sidebar').trim() || '#101012'); if (this.session.user()) this.router.navigate(['/start']); const u = this.cast.cast()?.users?.[0]; if (u) this.name.set(u.name); }
  ngOnDestroy(){ setTop('#f5f5f7'); }
  focusPin(){ setTimeout(() => (document.getElementById('pin') as HTMLInputElement | null)?.focus(), 0); }
  go(e: Event){ e.preventDefault(); if (this.session.login(this.name(), this.pin)) { this.bad.set(false); this.router.navigate(['/start']); } else this.bad.set(true); }
}
