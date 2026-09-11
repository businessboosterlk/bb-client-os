import { Component, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { DataService } from '../core/data.service';
import { ThemeService } from '../core/theme.service';

/* The door. Black and white only: the mark, the name, the date, two fields, one
   button. No accent, no glow, no decoration. Everything premium here comes from
   the ground being properly black, the type being properly spaced and the one
   white button carrying all the weight on the screen. */
const GROUND = '#08080a';

@Component({
  selector: 'bb-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="door">
      <div class="card">
        <img class="mark" src="assets/bb-logo-600.png" alt="Business Booster" width="834" height="338">
        <div class="sys">The Hub</div>
        <div class="date">{{ today }}</div>
        <form (submit)="go($event)" autocomplete="off">
          <input id="biz" class="big" type="text" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false"
            enterkeyhint="next" [(ngModel)]="business" name="business" placeholder="BUSINESS NAME" aria-label="Business name"
            [attr.aria-invalid]="!!session.error()">
          <input id="pin" class="big" type="password" autocapitalize="characters" autocorrect="off" spellcheck="false"
            enterkeyhint="go" [(ngModel)]="code" name="code" placeholder="CODE" aria-label="Code"
            [attr.aria-invalid]="!!session.error()">
          <button class="enter" type="submit" [disabled]="busy()">{{ busy() ? 'Opening' : 'Enter' }}</button>
          <div class="err" [class.on]="!!session.error()" aria-live="polite">{{ session.error() }}</div>
        </form>
        @if (!cast.apiMode()) { <div class="demo">Demo: <b>cinnamon.lk</b> with code <b>1111</b></div> }
      </div>
      <div class="foot">Lost your code? <a [href]="lost" target="_blank" rel="noreferrer">Message Business Booster</a> and a new one is issued in a minute.</div>
    </div>`,
  styles: [`
    :host{display:block}
    .door{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;
      background:#08080a;background-image:linear-gradient(180deg,#0e0e11 0%,#08080a 55%);
      padding:calc(24px + var(--sat)) 20px calc(24px + var(--sab));overflow-y:auto}
    .card{width:100%;max-width:440px;background:#131316;border:1px solid rgba(255,255,255,.07);border-radius:20px;
      padding:54px 44px 36px;box-shadow:0 28px 80px rgba(0,0,0,.6);text-align:center}
    .mark{width:236px;max-width:74%;height:auto;display:block;margin:0 auto}
    /* letter-spacing adds a trailing gap after the last character, which pulls a centred
       line visually to the left. The matching indent puts it back on the optical centre. */
    .sys{margin-top:16px;color:rgba(255,255,255,.72);font-size:11.5px;font-weight:700;
      letter-spacing:.38em;text-indent:.38em;text-transform:uppercase}
    .date{color:#7c7f88;font-size:13px;margin:14px 0 30px}
    form{display:grid;gap:12px}
    .big{width:100%;min-height:58px;padding:16px 18px;border-radius:12px;border:1px solid rgba(255,255,255,.08);
      background:#1b1b1f;color:#f4f4f6;text-align:center;font-size:14px;font-weight:600;letter-spacing:.22em;
      text-indent:.22em;text-transform:uppercase;transition:border-color 160ms var(--ease),background 160ms var(--ease)}
    .big::placeholder{color:#63666f;letter-spacing:.24em;text-transform:uppercase;font-weight:600}
    .big:focus{outline:none;border-color:rgba(255,255,255,.42);background:#212127}
    .big[aria-invalid="true"]{border-color:rgba(248,113,113,.5)}
    /* the browser paints its own wash on a remembered field: hold the dark ground */
    .big:-webkit-autofill,.big:-webkit-autofill:hover,.big:-webkit-autofill:focus{
      -webkit-text-fill-color:#f4f4f6;-webkit-box-shadow:0 0 0 1000px #1b1b1f inset;transition:background-color 9999s ease-out}
    .enter{width:100%;min-height:58px;margin-top:6px;border:0;border-radius:12px;background:#f4f4f6;color:#0a0a0c;
      font-weight:800;font-size:14px;letter-spacing:.24em;text-indent:.24em;text-transform:uppercase;
      transition:transform 160ms var(--ease),box-shadow 160ms var(--ease),background 160ms var(--ease)}
    .enter:hover{background:#fff;transform:translateY(-1px);box-shadow:0 14px 34px rgba(0,0,0,.55)}
    .enter:active{transform:translateY(0) scale(.99)}
    .enter:disabled{opacity:.55;transform:none;box-shadow:none}
    .err{min-height:20px;margin-top:8px;font-size:12.5px;font-weight:600;color:#f87171;opacity:0;
      transition:opacity 160ms var(--ease)}
    .err.on{opacity:1}
    .demo{margin-top:16px;font-size:12px;color:#63666f}.demo b{color:#a2a5ad;font-weight:600}
    .foot{color:#63666f;font-size:12px;text-align:center;max-width:360px;line-height:1.55}
    .foot a{color:#a2a5ad;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(255,255,255,.25)}
    .foot a:hover{color:#f4f4f6}
    @media (max-width:480px){.card{padding:42px 26px 28px}.mark{width:206px}}
    @media (prefers-reduced-motion:reduce){.enter,.big{transition:none}}`]
})
export class LoginComponent implements OnDestroy {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService);
  theme = inject(ThemeService); private router = inject(Router);
  business = ''; code = ''; busy = signal(false);
  get lost(){ return `https://wa.me/${this.cast.config().bbWa || '94767412531'}?text=${encodeURIComponent('Hello, I need a new code for The Hub.')}`; }
  today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  constructor(){
    document.body.classList.add('on-door');
    document.documentElement.style.setProperty('--top', GROUND);
    document.documentElement.style.setProperty('--door-ground', GROUND);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', GROUND);
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
