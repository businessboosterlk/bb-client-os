import { Component, inject, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { DataService } from '../core/data.service';
import { IconComponent } from '../ui/icon.component';
import { ThemeService } from '../core/theme.service';

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
        <div style="display:flex;gap:8px"><button class="btn ghost sm icon" type="button" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Day mode' : 'Night mode'"><bb-icon [name]="theme.dark() ? 'sun' : 'moon'"/></button>
        <button class="btn ghost sm" type="button" (click)="out()"><bb-icon name="out"/>Sign out</button></div>
      </header>
      <div class="doors">
        <a class="door" routerLink="/library">
          <span class="d-ic"><bb-icon name="video"/></span>
          <span class="d-tx">
            <strong>Your library</strong>
            <span>Videos, posts, documents and your business profile, produced by Business Booster.</span>
            <em>{{ libLine() }}</em>
          </span>
          <bb-icon name="chev" class="go"/>
        </a>
        <a class="door" routerLink="/sales">
          <span class="d-ic"><bb-icon name="pipe"/></span>
          <span class="d-tx">
            <strong>Your sales</strong>
            <span>Enquiries, your pipeline and your customers. The system you run the business on.</span>
            <em>{{ salesLine() }}</em>
          </span>
          <bb-icon name="chev" class="go"/>
        </a>
      </div>
      <p class="foot"><img class="bb-mark" src="assets/bb-logo.png" alt="Business Booster"> The Hub · {{ cast.cast()?.name }} · {{ session.user() }} seat</p>
    </div>`,
  styles: [`
    .wrap{min-height:100dvh;max-width:720px;margin:0 auto;padding:calc(28px + var(--sat)) 20px calc(28px + var(--sab));display:flex;flex-direction:column}
    header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:22px}
    .doors{display:grid;gap:12px}
    .door{display:flex;align-items:center;gap:16px;padding:22px 20px;background:var(--surface);border:1px solid var(--line);border-radius:16px;transition:border-color var(--dur) var(--ease),transform var(--dur) var(--ease)}
    .door:hover{border-color:var(--brand)}.door:active{transform:scale(.99)}
    .d-ic{width:52px;height:52px;border-radius:14px;background:var(--brand-soft);color:var(--brand-dark);display:grid;place-items:center;--ico:24px;flex-shrink:0}
    .d-tx{flex:1;min-width:0}.d-tx strong{display:block;font-size:17px;font-weight:700;letter-spacing:-.01em}
    .d-tx span{display:block;color:var(--muted);font-size:13px;margin-top:3px}
    .d-tx em{display:block;font-style:normal;font-size:12.5px;font-weight:600;color:var(--brand-dark);margin-top:8px}
    .go{color:var(--faint)}
    .foot{margin-top:auto;padding-top:28px;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}.foot img{height:16px;opacity:.7}`]
})
export class LauncherComponent {
  cast = inject(CastService); session = inject(SessionService); data = inject(DataService); theme = inject(ThemeService); private router = inject(Router);
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
  out(){ this.session.logout(); this.router.navigate(['/login']); }
}
