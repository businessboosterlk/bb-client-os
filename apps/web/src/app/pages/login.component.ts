import { Component, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { DataService } from '../core/data.service';
import { ThemeService } from '../core/theme.service';

/* The door, built to the BB Video System's: night, the mark large and white, the
   system name as a spaced eyebrow in Business Booster violet, today's date, two big
   fields, one gradient button. Business name and code, nothing else. */
@Component({
  selector: 'bb-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="door">
      <div class="card">
        <img class="mark" src="assets/bb-logo-600.png" alt="Business Booster" width="600" height="243">
        <div class="sys">The Hub</div>
        <div class="date">{{ today }}</div>
        <form (submit)="go($event)" autocomplete="off">
          <input id="biz" class="big" type="text" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" [(ngModel)]="business" name="business" placeholder="BUSINESS NAME" aria-label="Business name" [attr.aria-invalid]="!!session.error()">
          <input id="pin" class="big" type="password" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" [(ngModel)]="code" name="code" placeholder="CODE" aria-label="Code" [attr.aria-invalid]="!!session.error()">
          <button class="enter" type="submit" [disabled]="busy()">{{ busy() ? 'Opening' : 'Enter' }}</button>
          <div class="err" [class.on]="!!session.error()" aria-live="polite">{{ session.error() }}</div>
        </form>
        @if (!cast.apiMode()) { <div class="demo">Demo: <b>cinnamon.lk</b> with code <b>1111</b></div> }
      </div>
      <div class="foot">Lost your code? Message Business Booster and a new one is issued in a minute.</div>
    </div>`,
  styles: [`
    :host{display:block}
    .door{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
      background:#0b0b0e;background-image:radial-gradient(60% 50% at 50% 0%,rgba(168,85,247,.10),transparent 70%);
      padding:calc(24px + var(--sat)) 20px calc(24px + var(--sab));overflow-y:auto}
    .card{width:100%;max-width:440px;background:#141419;border:1px solid rgba(255,255,255,.08);border-radius:20px;
      padding:52px 44px 36px;box-shadow:0 24px 80px rgba(0,0,0,.55);text-align:center}
    .mark{width:240px;max-width:72%;height:auto;display:block;margin:0 auto 10px}
    .sys{color:#a855f7;font-size:12px;font-weight:700;letter-spacing:.32em;text-transform:uppercase;margin-top:2px}
    .date{color:#8a8d96;font-size:13px;margin:12px 0 28px}
    form{display:grid;gap:12px}
    .big{width:100%;min-height:58px;padding:16px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#1c1d24;color:#f2f2f5;
      text-align:center;font-size:14px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;transition:border-color 150ms var(--ease),background 150ms var(--ease)}
    .big::placeholder{color:#6b6e78;letter-spacing:.24em;text-transform:uppercase;font-weight:600}
    .big:focus{outline:none;border-color:rgba(168,85,247,.7);background:#20212a}
    .big[aria-invalid="true"]{border-color:rgba(239,68,68,.6)}
    /* the browser's autofill wash is the one thing that can turn these fields pale blue */
    .big:-webkit-autofill,.big:-webkit-autofill:focus{-webkit-text-fill-color:#f2f2f5;-webkit-box-shadow:0 0 0 1000px #1c1d24 inset;transition:background-color 9999s ease-out}
    .enter{width:100%;min-height:58px;margin-top:4px;border:0;border-radius:12px;color:#fff;font-weight:800;font-size:14px;letter-spacing:.24em;text-transform:uppercase;
      background:linear-gradient(135deg,#a855f7 0%,#7c3aed 100%);box-shadow:0 8px 24px rgba(168,85,247,.3);transition:transform 150ms var(--ease),box-shadow 150ms var(--ease)}
    .enter:hover{transform:translateY(-1px);box-shadow:0 12px 30px rgba(168,85,247,.38)}.enter:active{transform:translateY(0) scale(.99)}
    .enter:disabled{opacity:.7;transform:none}
    .err{min-height:20px;margin-top:6px;font-size:12.5px;font-weight:600;color:#f87171;opacity:0;transition:opacity 150ms var(--ease)}.err.on{opacity:1}
    .demo{margin-top:14px;font-size:12px;color:#6b6e78}.demo b{color:#a9acb6;font-weight:600}
    .foot{color:#6b6e78;font-size:12px;text-align:center;max-width:360px;line-height:1.5}
    @media (max-width:480px){.card{padding:40px 26px 28px}.mark{width:210px}}`]
})
export class LoginComponent implements OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); theme = inject(ThemeService); private router = inject(Router);
  business = ''; code = ''; busy = signal(false);
  today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  constructor(){
    document.body.classList.add('on-door');
    document.documentElement.style.setProperty('--top', '#0b0b0e');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#0b0b0e');
    if (this.session.user() && this.cast.cast()) this.router.navigate(['/start']);
    const c = new URLSearchParams(location.search).get('c'); if (c) this.business = c;
  }
  ngOnDestroy(){ document.body.classList.remove('on-door'); this.theme.apply(); }
  async go(e: Event){
    e.preventDefault(); if (this.busy()) return; this.busy.set(true);
    try { if (await this.session.login(this.business, this.code)) { await this.data.init(); this.router.navigate(['/start']); } }
    finally { this.busy.set(false); }
  }
}
