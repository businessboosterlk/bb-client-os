import { Component, inject, computed, signal } from '@angular/core';
import { CastService } from '../../core/cast.service';
import { LibRowComponent } from './lib.shared';
import { MoreComponent, WINDOW } from '../../ui/more.component';
import { readSeen } from '../../core/library';

@Component({
  selector: 'bb-docs',
  standalone: true,
  imports: [LibRowComponent, MoreComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Documents</h1><p>Reports, plans and profiles. Everything on file.</p></div></div>
    <div class="card list">
      @for (d of docs().slice(0, shown()); track d.href) { <bb-lib-row [item]="d" icon="doc" [ref]="ref"/> }
      @empty { <div class="empty"><strong>Nothing on file yet</strong>Your monthly report lands here once it is written.</div> }
      <bb-more [total]="docs().length" [shown]="min(shown(), docs().length)" (more)="shown.set(shown() + 30)"/>
    </div>`
})
export class DocsComponent { cast = inject(CastService); ref = readSeen(this.cast.slug()); docs = computed(() => this.cast.cast()!.library.docs); shown = signal(WINDOW); min = Math.min; }
