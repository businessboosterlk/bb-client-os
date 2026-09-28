import { Component, inject, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { DataService } from '../core/data.service';
import { IconComponent } from '../ui/icon.component';
import { ThemeService } from '../core/theme.service';
import { UpdateService } from '../core/update.service';
import { AskService } from '../core/ask.service';

/* Two doors. The library is what BB made for them; the sales system is what they
   run their business on. Each door carries one live number so the choice is informed. */
@Component({
  selector: 'bb-launcher',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="wrap">
      <header>
        <div>
          <p class="t-small">{{ greet() }}, {{ session.user() }}.</p>
          <h1 class="t-h1">Where to?</h1>
        </div>
        <div class="acts"><button class="btn ghost icon" type="button" data-act="launcher-theme" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Day mode' : 'Night mode'" [attr.aria-pressed]="theme.dark()"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
        <button class="btn ghost" type="button" data-act="launcher-sign-out" (click)="out()"><bb-icon name="out"/><span>Sign out</span></button></div>
      </header>
      <div class="doors">
        <a class="door" routerLink="/library" data-act="door-library">
          <span class="d-ic"><bb-icon name="video"/></span>
          <span class="d-tx">
            <strong>Your library</strong>
            <span>Videos, posts, documents and your business profile, produced by Business Booster.</span>
            <em>{{ libLine() }}</em>
          </span>
          <bb-icon name="chev" class="go"/>
        </a>
        <a class="door" routerLink="/sales" data-act="door-sales">
          <span class="d-ic"><bb-icon name="pipe"/></span>
          <span class="d-tx">
            <strong>Your sales</strong>
            <span>Enquiries, your pipeline and your customers. The system you run the business on.</span>
            <em>{{ salesLine() }}</em>
          </span>
          <bb-icon name="chev" class="go"/>
        </a>
      </div>
      @if (data.offline()) { <p class="offline" role="status"><bb-icon name="offline"/><span>No connection. Showing what was saved on this device.</span></p> }
      <p class="foot"><img class="bb-mark" src="assets/bb-logo.png" alt="Business Booster"><span>The Hub · {{ cast.cast()?.name }} · {{ session.user() }} seat<br><span class="bld">Build {{ update.build }}</span></span></p>
    </div>`,
  styles: [`
    .wrap{min-height:100dvh;max-width:720px;margin:0 auto;padding:calc(28px + var(--sat)) 20px calc(28px + var(--sab));display:flex;flex-direction:column}
    header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:22px}
    .acts{display:flex;gap:8px;flex-shrink:0}
    .offline{margin-top:16px}
    .doors{display:grid;gap:12px}
    .door{display:flex;align-items:center;gap:16px;padding:22px 20px;background:var(--surface);border:1px solid var(--line);border-radius:16px;transition:border-color var(--dur) var(--ease),transform var(--dur) var(--ease)}
    @media (hover:hover){.door:hover{border-color:var(--brand)}}.door:active{transform:scale(.99)}
    .d-ic{width:52px;height:52px;border-radius:14px;background:var(--brand-soft);color:var(--brand-text);display:grid;place-items:center;--ico:24px;flex-shrink:0}
    .d-tx{flex:1;min-width:0}.d-tx strong{display:block;font-size:17px;font-weight:700;letter-spacing:-.01em}
    .d-tx span{display:block;color:var(--muted);font-size:13px;margin-top:3px}
    .d-tx em{display:block;font-style:normal;font-size:12.5px;font-weight:600;color:var(--brand-text);margin-top:8px}
    .go{color:var(--faint)}
    .foot{margin-top:auto;padding-top:28px;display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px;line-height:1.4}.foot img{height:16px;opacity:.7;flex-shrink:0}.foot span{min-width:0}.foot .bld{white-space:nowrap;font-variant-numeric:tabular-nums}
    .d-ic bb-icon{--ico:24px}`]
})
export class LauncherComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); theme = inject(ThemeService); update = inject(UpdateService); private ask = inject(AskService); private router = inject(Router);
  constructor(){ this.theme.apply(); }
  greet(){ const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  libLine = computed(() => {
    const L = this.cast.cast()?.library; if (!L) return '';
    const v = L.months.reduce((a, m) => a + m.videos.length, 0), p = L.months.reduce((a, m) => a + m.posts.length, 0);
    return v + p ? `${v} videos · ${p} posts · ${L.docs.length} documents` : 'Your first month is on its way';
  });
  salesLine = computed(() => {
    const w = this.data.waiting().length, d = this.data.openDeals().length, v = this.data.pipeValue();
    if (!w && !d) return 'Nothing waiting. Add your first enquiry.';
    return `${w} waiting · ${d} in progress${v ? ' · ' + this.cast.money(v) : ''}`;
  });
  async out(){
    const n = this.data.pending();
    if (n > 0 && !(await this.ask.confirm({ title: 'Sign out now?', body: `${n} ${n === 1 ? 'change has' : 'changes have'} not reached the server yet. Signing out removes ${n === 1 ? 'it' : 'them'} from this device.`, yes: 'Sign out anyway', no: 'Stay signed in', danger: true }))) return;
    await this.data.signOut(); this.router.navigate(['/login']);
  }
}
