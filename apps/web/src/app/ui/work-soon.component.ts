import { Component, computed, inject, input } from '@angular/core';
import { CastService } from '../core/cast.service';
import { SessionService } from '../core/session.service';
import { IconComponent } from './icon.component';

/* STAGE 1 HONESTY. The chat, tasks and posts run on the demo only, kept in the browser. A real client (api mode) sees this
   instead of an empty chat that would keep their words on one phone: the WhatsApp group stays the way to reach the team
   until Thulaib says yes to the tables, the file store and a named person per seat. */
@Component({
  selector: 'bb-work-soon',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="card soon">
      <span class="ic"><bb-icon [name]="what() === 'posts' ? 'post' : what() === 'tasks' ? 'tasks' : 'chat'"/></span>
      <h1 class="t-h2">{{ title() }}</h1>
      <p>{{ line() }}</p>
      @if (wa()) { <a class="btn wa" data-act="soon-whatsapp" [href]="wa()" target="_blank" rel="noreferrer"><bb-icon name="wa"/><span>{{ cast.isGroup() ? 'Open our WhatsApp group' : 'Message Business Booster' }}</span></a> }
    </div>`,
  styles: [`.soon{max-width:520px;margin:24px auto;padding:28px 22px;display:grid;justify-items:start;gap:10px}
    .soon p{color:var(--muted);font-size:14.5px;line-height:1.5}
    .ic{width:48px;height:48px;border-radius:14px;background:var(--brand-soft);color:var(--brand-text);display:grid;place-items:center;--ico:22px}`]
})
export class WorkSoonComponent {
  cast = inject(CastService); private session = inject(SessionService);
  what = input<'chat' | 'tasks' | 'posts'>('chat');
  title = computed(() => this.what() === 'posts' ? 'Your posts arrive here soon' : this.what() === 'tasks' ? 'Tasks with us arrive here soon' : 'The chat with us arrives here soon');
  line = computed(() => 'Until then our WhatsApp group is the way to reach the team. Your library and your sales are ready to use.');
  wa = computed(() => this.cast.whatsapp(`Hello Business Booster, this is ${this.session.user()} from ${this.cast.cast()?.name} [Hub].`));
}
