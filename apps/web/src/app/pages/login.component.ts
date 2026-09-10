import { Component, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { DataService } from '../core/data.service';
import { setTop } from '../shell/shell.component';

/* The door. Business name and the code Business Booster gave you. One door for every
   client; the name decides whose Hub opens, the code decides the seat. */
@Component({
  selector: 'bb-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login">
      <div class="login-card">
        <div class="brand">
          <img class="bb" src="assets/bb-logo.png" alt="Business Booster">
          <h1>The Hub</h1>
          <p>Your library and your sales, in one place.</p>
        </div>
        <form (submit)="go($event)" autocomplete="off">
          <div class="field">
            <label for="biz">Business name</label>
            <input id="biz" type="text" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" [(ngModel)]="business" name="business" placeholder="yourbusiness.lk" [attr.aria-invalid]="!!session.error()">
          </div>
          <div class="field">
            <label for="pin">Code</label>
            <input id="pin" type="password" inputmode="text" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" [(ngModel)]="code" name="code" placeholder="The code you were given" [attr.aria-invalid]="!!session.error()">
            @if (session.error()) { <span class="err">{{ session.error() }}</span> }
            @if (!cast.apiMode()) { <span class="hint">Demo: business <strong>cinnamon.lk</strong>, code <strong>1111</strong>. A real client gets private codes.</span> }
          </div>
          <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? 'Opening' : 'Open my Hub' }}</button>
        </form>
        <p class="foot">Lost your code? Message Business Booster and a new one is issued in a minute.</p>
      </div>
    </div>`,
  styles: [`
    .login{min-height:100dvh;display:grid;place-items:center;padding:calc(20px + var(--sat)) 16px calc(20px + var(--sab));background:#101012}
    .login-card{width:100%;max-width:400px;background:var(--surface);border-radius:20px;padding:30px 26px;box-shadow:var(--sh-lg)}
    .brand{text-align:center;margin-bottom:22px}.brand .bb{height:24px;margin-bottom:14px;opacity:.9}
    .brand h1{font-size:24px;font-weight:700;letter-spacing:-.02em}.brand p{color:var(--muted);font-size:13px;margin-top:4px}
    form{display:grid;gap:14px}.err{font-size:12px;color:var(--red);font-weight:600}
    .btn{width:100%;min-height:46px;margin-top:4px}
    .foot{margin-top:18px;text-align:center;color:var(--muted);font-size:12px;line-height:1.5}`]
})
export class LoginComponent implements OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); private router = inject(Router);
  business = ''; code = ''; busy = signal(false);
  constructor(){
    setTop('#101012');
    if (this.session.user() && this.cast.cast()) this.router.navigate(['/start']);
    const c = new URLSearchParams(location.search).get('c'); if (c) this.business = c;
  }
  ngOnDestroy(){ setTop('#f5f5f7'); }
  async go(e: Event){
    e.preventDefault(); if (this.busy()) return; this.busy.set(true);
    try {
      if (await this.session.login(this.business, this.code)) { await this.data.init(); this.router.navigate(['/start']); }
    } finally { this.busy.set(false); }
  }
}
