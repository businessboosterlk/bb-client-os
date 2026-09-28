import { Component, inject } from '@angular/core';
import { AskService } from '../core/ask.service';
import { DrawerComponent } from './drawer.component';

/* The app's own question sheet. One primary answer, a quiet way out, or a pick from a list. */
@Component({
  selector: 'bb-ask',
  standalone: true,
  imports: [DrawerComponent],
  template: `
    <bb-drawer [open]="!!ask.q()" [title]="ask.q()?.title || ''" [centre]="true" [raised]="true" (closed)="ask.answer(null)">
      <ng-template #body>
      @if (ask.q(); as q) {
        @if (q.body) { <p class="ask-body">{{ q.body }}</p> }
        @if (q.options; as opts) {
          <div class="ask-opts">
            @for (o of opts; track o) { <button type="button" class="ask-opt" data-act="ask-pick" (click)="ask.answer(o)">{{ o }}</button> }
          </div>
        }
      }
      </ng-template>
      <ng-template #foot>
        @if (ask.q(); as q) {
          @if (!q.options) { <button class="btn" [class.danger-solid]="q.danger" type="button" data-act="ask-yes" (click)="ask.answer(true)">{{ q.yes || 'Yes' }}</button> }
          <button class="btn quiet" type="button" data-act="ask-no" (click)="ask.answer(null)">{{ q.no || 'Cancel' }}</button>
        }
      </ng-template>
    </bb-drawer>`,
  styles: [`
    .ask-body{font-size:14px;line-height:1.5;color:var(--ink-2)}
    .ask-opts{display:grid;gap:8px}
    .ask-opt{min-height:48px;padding:0 16px;border:1px solid var(--line-2);border-radius:12px;background:var(--surface);font-size:14px;font-weight:600;text-align:left;color:var(--ink);transition:background 120ms var(--ease),border-color 120ms var(--ease)}
    @media (hover:hover){.ask-opt:hover{background:var(--surface-2)}}.ask-opt:active{background:var(--line)}`]
})
export class AskComponent { ask = inject(AskService); }
