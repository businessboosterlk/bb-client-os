import { Component, inject, computed } from '@angular/core';
import { CastService } from '../../core/cast.service';
import { LibRowComponent } from './lib.shared';

@Component({
  selector: 'bb-docs',
  standalone: true,
  imports: [LibRowComponent],
  template: `
    <div class="ph"><div><h1 class="t-h1">Documents</h1><p>Reports, plans and profiles. Everything on file.</p></div></div>
    <div class="card list">
      @for (d of docs(); track d.href) { <bb-lib-row [item]="d" icon="doc"/> }
      @empty { <div class="empty"><strong>Nothing on file yet</strong>Your monthly report lands here once it is written.</div> }
    </div>`
})
export class DocsComponent { cast = inject(CastService); docs = computed(() => this.cast.cast()!.library.docs); }
