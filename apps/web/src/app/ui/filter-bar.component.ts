import { Component, Input, WritableSignal, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { DrawerComponent } from './drawer.component';

export interface FilterDef { key: string; label: string; all: string; options: { value: string; label: string }[]; }
/* THE FILTER BAR, one for every list. Cast from the Workshop OS mould (17 Sep 2026).
   Desk: search and a dropdown per filter on one row, a Clear when anything is set.
   Phone: search and a Filters button carrying the count of what is set; the dropdowns open in a
   sheet whose one main button says how many rows will show. State lives in signals the screen
   owns, so the list recomputes the moment anything changes, and it is remembered per screen. */
@Component({
  selector: 'bb-filter-bar',
  standalone: true,
  imports: [FormsModule, IconComponent, DrawerComponent],
  template: `
    <div class="fb">
      <div class="search fb-q"><bb-icon name="search"/><input type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="placeholder" [attr.aria-label]="label || placeholder" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      @if (defs.length) {
        <div class="fb-sels">
          @for (d of defs; track d.key) {
            <label class="fsel" [class.on]="!!state()[d.key]">
              <span class="sr">{{ d.label }}</span>
              <select [ngModel]="state()[d.key] || ''" (ngModelChange)="set(d.key, $event)" [attr.aria-label]="d.label" [attr.data-act]="'filter-' + d.key">
                <option value="">{{ d.all }}</option>
                @for (o of d.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select>
            </label>
          }
          @if (active() > 0 || query()) { <button type="button" class="btn quiet sm fb-clear" data-act="filter-clear" (click)="clear()">Clear</button> }
        </div>
        <button type="button" class="btn ghost fb-open" data-act="filter-open" (click)="open.set(true)" [attr.aria-label]="'Filters' + (active() ? ', ' + active() + ' set' : '')">
          <bb-icon name="filter"/><span>Filters</span>@if (active() > 0) { <span class="fb-n">{{ active() }}</span> }
        </button>
      }
    </div>
    @if (defs.length) {
      <bb-drawer title="Filters" [open]="open()" (closed)="open.set(false)">
      <ng-template #body>
        <div class="fb-sheet">
          @for (d of defs; track d.key) {
            <div class="field"><label [attr.for]="uid + d.key">{{ d.label }}</label>
              <select [id]="uid + d.key" [ngModel]="state()[d.key] || ''" (ngModelChange)="set(d.key, $event)" [attr.data-act]="'filter-sheet-' + d.key">
                <option value="">{{ d.all }}</option>
                @for (o of d.options; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
              </select></div>
          }
        </div>
      </ng-template>
      <ng-template #foot>
          <button class="btn" type="button" data-act="filter-show" (click)="open.set(false)">Show {{ count.toLocaleString('en-GB') }} {{ count === 1 ? noun : nouns }}</button>
          <button class="btn quiet" type="button" data-act="filter-clear-all" (click)="clear()" [disabled]="!active()">Clear all</button>
        </ng-template>
    </bb-drawer>
    }`,
  styles: [`
    :host{display:block;margin-bottom:12px}
    .fb{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .fb-q{flex:1 1 240px;min-width:0}
    .fb-sels{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .fsel{position:relative;display:block}
    .fsel select{min-height:40px;padding:0 44px 0 12px;border:1px solid var(--line-2);border-radius:10px;background-color:var(--surface);font-size:13.5px;font-weight:500;color:var(--ink-2);max-width:220px;transition:border-color var(--dur) var(--ease)}
    .fsel select:focus{outline:none;border-color:var(--brand)}
    .fsel.on select{border-color:var(--brand);color:var(--ink);font-weight:600;background-color:var(--brand-soft-2)}
    .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .fb-open{display:none;min-height:40px;gap:8px;flex:0 0 auto}
    .fb-n{min-width:20px;height:20px;display:inline-grid;place-items:center;padding:1px 6px 0;border-radius:999px;background:var(--brand);color:var(--on-accent);font-size:11px;font-weight:700;line-height:1}
    .fb-sheet{display:grid;gap:14px}
    @media (max-width:760px){.fb-sels{display:none}.fb-open{display:inline-flex}.fb{flex-wrap:nowrap}.fb-q{flex:1 1 0}}`]
})
export class FilterBarComponent implements OnInit {
  @Input({ required: true }) state!: WritableSignal<Record<string, string>>;
  @Input({ required: true }) query!: WritableSignal<string>;
  @Input() defs: FilterDef[] = [];
  @Input() placeholder = 'Search';
  @Input() label = '';
  @Input() count = 0; @Input() noun = 'result'; @Input() nouns = 'results';
  @Input() store = '';
  uid = 'fb' + Math.random().toString(36).slice(2, 7) + '-';
  open = signal(false);
  active = computed(() => Object.values(this.state()).filter(Boolean).length);
  ngOnInit(){ if (!this.store) return; try { const s = JSON.parse(localStorage.getItem('hub_f_' + this.store) || '{}'); const ok = Object.fromEntries(Object.entries(s).filter(([k, v]) => this.defs.some(d => d.key === k && d.options.some(o => o.value === v)))); if (Object.keys(ok).length) this.state.set({ ...this.state(), ...ok as any }); } catch {} }
  set(k: string, v: string){ const n = { ...this.state(), [k]: v }; if (!v) delete n[k]; this.state.set(n); this.save(); }
  clear(){ this.state.set({}); this.query.set(''); this.save(); }
  private save(){ if (!this.store) return; try { localStorage.setItem('hub_f_' + this.store, JSON.stringify(this.state())); } catch {} }
}
