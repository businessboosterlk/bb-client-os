import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CastService } from '../../core/cast.service';
import { DataService, daysSince, niceDate, longDate, monthName } from '../../core/data.service';
import { SessionService } from '../../core/session.service';
import { IconComponent } from '../../ui/icon.component';

/* The dashboard, built like the Home Depot and Leon mold: greeting, the money
   hero (won this month against target, open pipeline weighted), four figures,
   the at-risk radar, six months of won revenue, then what needs attention today. */
@Component({
  selector: 'bb-dashboard',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="ph"><div>
      <p class="t-small">{{ dateLine() }}</p>
      <h1 class="t-h1">{{ greet() }}, {{ session.user() }}.</h1>
      <p>{{ brief() }}</p>
    </div><div class="ph-right"><a class="btn" data-act="dashboard-new-enquiry-top" routerLink="/sales/enquiries" [queryParams]="{ add: 1 }"><bb-icon name="plus"/><span>New {{ cast.word('enquiry','enquiry').toLowerCase() }}</span></a></div></div>

    <div class="hero card">
      <div class="h-cell">
        <span class="k-label">Won in {{ monthName() }}</span>
        <strong class="h-val">{{ cast.money(data.wonValueThisMonth()) || cast.zero() }}</strong>
        @if (target()) {
          <div class="track"><i [style.width.%]="pct()"></i></div>
          <span class="h-sub">{{ pct() }}% of the {{ cast.money(target()) }} target</span>
        } @else { <span class="h-sub">{{ data.wonThisMonth().length }} {{ data.wonThisMonth().length === 1 ? 'deal' : 'deals' }} closed</span> }
      </div>
      <div class="h-cell">
        <span class="k-label">Open pipeline</span>
        <strong class="h-val">{{ cast.money(data.pipeValue()) || cast.zero() }}</strong>
        <span class="h-sub">{{ data.openDeals().length }} open · {{ cast.money(data.weighted()) || 'nothing' }} weighted by stage</span>
      </div>
    </div>

    <div class="kpi">
      <a class="card" data-act="kpi-waiting" routerLink="/sales/enquiries"><div class="k-label">Waiting</div><div class="k-val">{{ data.waiting().length }}</div><div class="k-sub">{{ data.waiting().length ? 'new ' + cast.word('enquiries','enquiries').toLowerCase() + ' to answer' : 'inbox clear' }}</div></a>
      <a class="card" data-act="kpi-progress" routerLink="/sales/pipeline"><div class="k-label">In progress</div><div class="k-val">{{ data.openDeals().length }}</div><div class="k-sub">{{ quotedValue() ? cast.money(quotedValue()) + ' quoted' : 'nothing quoted yet' }}</div></a>
      <a class="card" data-act="kpi-won" routerLink="/sales/pipeline" [queryParams]="{ view: 'list' }"><div class="k-label">Won this month</div><div class="k-val up">{{ data.wonThisMonth().length }}</div><div class="k-sub">{{ cast.money(data.wonValueThisMonth()) || 'nothing closed yet' }}</div></a>
      <a class="card" data-act="kpi-customers" routerLink="/sales/customers"><div class="k-label">Customers</div><div class="k-val">{{ data.customers().length }}</div><div class="k-sub">{{ ltv() ? cast.money(ltv()) + ' lifetime' : 'none yet' }}</div></a>
    </div>

    @if (data.loading()) { <div class="sec"><div class="card skel" aria-busy="true" aria-label="Loading your numbers"><i></i><i></i><i></i></div></div> }
    @if (data.atRisk().length) {
      <div class="sec"><div class="sec-head"><h3>Going cold</h3><span>{{ cast.money(riskValue()) }} at risk</span></div>
        <div class="card list">
          @for (d of data.atRisk(); track d.id) {
            <a class="li link" data-act="cold-open" routerLink="/sales/pipeline" [queryParams]="{ open: d.id }">
              <span class="ic red"><bb-icon name="alert"/></span>
              <span class="tx"><strong>{{ d.name }}</strong><span>{{ stageLabel(d.stage) }} · {{ cast.money(d.value) }} · {{ quiet(d) }} days quiet</span></span>
              <bb-icon name="chev" class="go"/>
            </a>
          }
        </div></div>
    }

    <div class="grid2">
      <div class="sec"><div class="sec-head"><h3>Won revenue, last six months</h3><span>{{ cast.word('currency','LKR') }}</span></div>
        <div class="card chart" role="img" [attr.aria-label]="chartLabel()">
          @for (b of bars(); track b.m; let last = $last) {
            <div class="bar"><span class="v">{{ b.v ? short(b.v) : '' }}</span><span class="track"><i [style.height.%]="b.pct" [class.now]="last"></i></span><span class="m">{{ b.m }}</span></div>
          }
        </div></div>
      <div class="sec"><div class="sec-head"><h3>Needs attention today</h3><span>{{ queue().length ? queue().length + ' to do' : 'all clear' }}</span></div>
        <div class="card list">
          @for (q of queue(); track q.key) {
            <a class="li link" data-act="queue-open" [routerLink]="q.href" [queryParams]="q.params">
              <span class="ic" [class.red]="q.level === 'critical'" [class.amber]="q.level === 'high'"><bb-icon [name]="q.icon"/></span>
              <span class="tx"><strong>{{ q.title }}</strong><span>{{ q.why }}</span></span>
              <bb-icon name="chev" class="go"/>
            </a>
          } @empty { <div class="empty"><strong>All clear</strong>Nothing needs you right now.</div> }
        </div></div>
    </div>`,
  styles: [`
    .hero{display:grid;grid-template-columns:1fr 1fr;background:var(--hero);color:#fff;border:0;margin-bottom:12px}
    .h-cell{padding:22px 24px;display:flex;flex-direction:column;gap:6px}.h-cell+.h-cell{border-left:1px solid var(--hero-line)}
    .hero .k-label{font-size:11px;font-weight:600;color:rgba(255,255,255,.7)}
    .h-val{font-size:30px;font-weight:700;letter-spacing:-.025em;font-variant-numeric:tabular-nums;line-height:1.1}
    .h-sub{font-size:12px;color:rgba(255,255,255,.7)}
    .track{height:6px;border-radius:3px;background:rgba(255,255,255,.14);margin-top:8px;overflow:hidden}.track i{display:block;height:100%;background:var(--brand);border-radius:3px;transition:width .7s var(--ease)}
    .kpi a{display:block;color:inherit}@media (hover:hover){.kpi a:hover{border-color:var(--line-2)}}
    .grid2{display:grid;grid-template-columns:1.2fr 1fr;gap:16px}
    /* the chart is drawn in the page's own boxes, so its words are real text at a real size */
    .chart{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;height:196px;padding:16px 14px 12px}
    .bar{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;height:100%}
    .bar .v{height:16px;font-size:11px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
    .bar .track{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;min-height:0}
    .bar i{display:block;width:100%;max-width:56px;min-height:4px;border-radius:6px;background:var(--line-2);transition:height .6s var(--ease)}
    .bar i.now{background:var(--brand)}
    .bar .m{font-size:12px;color:var(--muted)}
    .go{color:var(--faint)}
    .list .ic.red{background:var(--red-soft);color:var(--red)}.list .ic.amber{background:var(--amber-soft);color:var(--amber)}
    @media (max-width:900px){.hero{grid-template-columns:1fr}.h-cell+.h-cell{border-left:0;border-top:1px solid var(--hero-line)}.grid2{grid-template-columns:1fr}.h-val{font-size:26px}}`]
})
export class DashboardComponent {
  cast = inject(CastService); data = inject(DataService); session = inject(SessionService);
  greet(){ const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  dateLine(){ return longDate(); }
  monthName(){ return monthName(); }
  target = computed(() => this.cast.cast()?.target?.month || 0);
  pct = computed(() => this.target() ? Math.min(100, Math.round(this.data.wonValueThisMonth() / this.target() * 100)) : 0);
  quotedValue = computed(() => this.data.openDeals().filter(d => d.stage === 'quoted' || d.stage === 'closing').reduce((a, d) => a + (Number(d.value) || 0), 0));
  ltv = computed(() => this.data.customers().reduce((a, c) => a + (Number(c.value) || 0), 0));
  riskValue = computed(() => this.data.atRisk().reduce((a, d) => a + (Number(d.value) || 0), 0));
  quiet(d: any){ return daysSince(d.lastContactAt || d.stageAt || d.createdAt); }
  stageLabel(k: string){ return this.cast.cast()?.stages.find(s => s.key === k)?.label || k; }
  brief = computed(() => {
    const w = this.data.waiting().length, due = this.data.dueTasks().length, cold = this.data.stale().length;
    const bits = [w ? `${w} waiting` : '', due ? `${due} due today` : '', cold ? `${cold} going cold` : ''].filter(Boolean);
    return bits.length ? bits.join(', ') + '.' : 'Nothing waiting and nothing overdue. Nice and clear.';
  });
  short(n: number){ return n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n); }
  chartLabel = computed(() => 'Won revenue by month. ' + this.bars().map(b => `${b.m}: ${b.v ? this.cast.money(b.v) : 'nothing'}`).join('. ') + '.');
  bars = computed(() => {
    const out: { m: string; v: number; h: number; pct: number }[] = []; const now = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const ym = d.toISOString().slice(0, 7);
      out.push({ m: d.toLocaleDateString('en-GB', { month: 'short' }), v: this.data.deals().filter(x => x.stage === 'won' && (x.updatedAt || '').slice(0, 7) === ym).reduce((a, x) => a + (Number(x.value) || 0), 0), h: 0, pct: 0 }); }
    const max = Math.max(1, ...out.map(b => b.v)); out.forEach(b => b.pct = b.v ? Math.max(5, Math.round(b.v / max * 100)) : 0); return out;
  });
  /* what to do first: overdue tasks, then quiet deals, then hot deals, then waiting enquiries */
  queue = computed(() => {
    const q: any[] = []; const seen = new Set<string>();
    this.data.dueTasks().forEach(t => q.push({ key: 't' + t.id, level: 'critical', icon: 'clock', title: t.text, why: 'Due ' + (t.due === new Date().toISOString().slice(0, 10) ? 'today' : niceDate(t.due)), href: '/sales/tasks', params: { open: t.id } }));
    this.data.stale().forEach(d => { if (seen.has(d.id)) return; seen.add(d.id); const n = this.quiet(d); q.push({ key: 'd' + d.id, level: n >= 10 ? 'critical' : 'high', icon: 'alert', title: d.name, why: `${n} days quiet · ${this.stageLabel(d.stage)}${d.value ? ' · ' + this.cast.money(d.value) : ''}`, href: '/sales/pipeline', params: { open: d.id } }); });
    this.data.openDeals().filter(d => d.stage === 'closing' && !seen.has(d.id)).forEach(d => { seen.add(d.id); q.push({ key: 'h' + d.id, level: 'normal', icon: 'flame', title: d.name, why: 'Closing' + (d.nextStep ? ' · ' + d.nextStep : ''), href: '/sales/pipeline', params: { open: d.id } }); });
    this.data.waiting().slice(0, 3).forEach(e => q.push({ key: 'e' + e.id, level: 'high', icon: 'inbox', title: e.name, why: 'New ' + this.cast.word('enquiry', 'enquiry').toLowerCase() + (e.wants ? ' · ' + e.wants : ''), href: '/sales/enquiries', params: { open: e.id } }));
    return q.slice(0, 6);
  });
}
