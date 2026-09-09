import { Component, inject, computed } from '@angular/core';
import { CastService } from '../../core/cast.service';

/* The business profile: what BB understands about the client, grouped, with the
   review date. A wrong fact is corrected by a WhatsApp line, not by editing here. */
@Component({
  selector: 'bb-business',
  standalone: true,
  template: `
    <div class="ph"><div><h1 class="t-h1">What we understand about {{ cast.cast()?.short || cast.cast()?.name }}</h1>
      <p>These facts guide every piece of work. @if (L().factsReviewed) { Reviewed {{ L().factsReviewed }}. }</p></div>
      <div class="ph-right"><a class="btn ghost sm" [href]="fix()" target="_blank" rel="noreferrer">Update a detail</a></div></div>
    @for (g of groups(); track g.name) {
      <div class="sec"><div class="sec-head"><h3>{{ g.name }}</h3><span>{{ g.facts.length }}</span></div>
        <div class="card">@for (f of g.facts; track f.k) { <div class="fact"><span>{{ f.k }}</span><strong>{{ f.v }}</strong></div> }</div></div>
    } @empty { <div class="card empty"><strong>Your profile is on its way</strong>Once the intake is back, what we know about your business appears here.</div> }`,
  styles: [`.fact{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:14px 16px;border-top:1px solid var(--line)}.fact:first-child{border-top:0}
    .fact span{font-size:12px;font-weight:600;color:var(--muted)}.fact strong{font-weight:500;font-size:14px}
    @media (max-width:640px){.fact{grid-template-columns:1fr;gap:3px}}`]
})
export class BusinessComponent {
  cast = inject(CastService);
  L = computed(() => this.cast.cast()!.library);
  groups = computed(() => { const m = new Map<string, any[]>(); this.L().facts.forEach(f => { const g = f.g || 'Business'; if (!m.has(g)) m.set(g, []); m.get(g)!.push(f); }); return [...m].map(([name, facts]) => ({ name, facts })); });
  fix = computed(() => `https://wa.me/${this.cast.cast()?.wa}?text=${encodeURIComponent(`Hello, this is ${this.cast.cast()?.name} [OS]. One of the business details needs updating: `)}`);
}
