import { Component, inject, signal, computed, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, effect } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { WorkService } from '../../core/work.service';
import { CastService } from '../../core/cast.service';
import { DataService } from '../../core/data.service';
import { byDay } from '../../core/work';
import { mediaUrl } from '../../core/media';
import type { Msg, MsgRef } from '../../core/work-models';
import { BubbleComponent } from './bubble.component';
import { ComposerComponent } from './composer.component';
import { DrawerComponent } from '../../ui/drawer.component';
import { IconComponent } from '../../ui/icon.component';
import { WorkSoonComponent } from '../../ui/work-soon.component';

@Component({
  selector: 'bb-chat',
  standalone: true,
  imports: [BubbleComponent, ComposerComponent, DrawerComponent, IconComponent, WorkSoonComponent],
  template: `
    @if (!work.available()) {
      <bb-work-soon what="chat"/>
    } @else {
      <div class="head">
        <div>
          <h1 class="t-h1">You and Business Booster</h1>
          <p class="t-small">Your team and ours, in one place.</p>
        </div>
        @if (wa()) {
          <a class="btn ghost sm" data-act="chat-whatsapp" [href]="wa()" target="_blank" rel="noreferrer" aria-label="WhatsApp, the backup if the app is down">
            <bb-icon name="wa"/>
            <span>{{ cast.isGroup() ? 'Our WhatsApp group' : 'WhatsApp' }}</span>
          </a>
        }
      </div>

      <section class="need" aria-label="Needs your hand">
        <strong><bb-icon name="hand"/><span class="nl">Needs your hand</span></strong>
        @if (work.needs().length > 0) {
          <div class="need-row">
            @for (n of work.needs(); track n.key) {
              <button type="button" class="btn soft sm" [attr.data-act]="'chat-need-' + n.key" (click)="needTap(n)">
                <bb-icon [name]="n.kind === 'post' ? 'post' : 'tasks'"/>
                {{ n.label }}
              </button>
            }
          </div>
        } @else {
          <span class="need-none">Nothing needs your hand right now.</span>
        }
      </section>

      <div class="stream" [style.padding-bottom.px]="dockH() + 16">
        @if (work.msgs().length === 0) {
          <div class="empty">
            <strong>Say hello</strong>
            <p>Write to Business Booster here. Photos and voice notes work too.</p>
          </div>
        } @else {
          @for (g of groups(); track g.day) {
            <div class="day">
              <span>{{ g.label }}</span>
            </div>
            @for (m of g.msgs; track m.id; let i = $index) {
              <bb-bubble
                [msg]="m"
                [mine]="mine(m)"
                [slug]="work.slug()"
                [quote]="work.msg(m.reply)"
                [card]="work.card(m)"
                [showName]="showName(g.msgs, i)"
                [canTask]="canTask(m)"
                [open]="openId() === m.id"
                (toggle)="toggle(m)"
                (reply)="reply($event)"
                (task)="task($event)"
                (openRef)="openRef($event)"
                (openPhoto)="openPhoto($event)"
                (quoteTap)="quoteTap($event)"
              />
            }
          }
        }
      </div>

      <div #dock class="dock" [class.typing]="typing() && kb() === 0" [class.kb]="kb() > 0" [style.bottom]="kb() > 0 ? kb() + 'px' : null">
        <bb-composer
          [replyTo]="replyTo()"
          (send)="send($event)"
          (voice)="voice($event)"
          (cancelReply)="replyTo.set(null)"
          (focused)="setTyping($event)"
        />
      </div>

      <bb-drawer [open]="!!viewer()" [title]="'Photo ' + ((viewer()?.index ?? 0) + 1) + ' of ' + (viewer()?.ids?.length ?? 0)" (closed)="viewer.set(null)">
        <ng-template #body>
          <img [src]="viewUrl()" alt="" class="big"/>
        </ng-template>
        <ng-template #foot>
          <button type="button" class="btn quiet" data-act="photo-prev" [disabled]="(viewer()?.index ?? 0) === 0" (click)="step(-1)">Previous</button>
          <button type="button" class="btn quiet" data-act="photo-next" [disabled]="(viewer()?.index ?? 0) === (viewer()?.ids?.length ?? 0) - 1" (click)="step(1)">Next</button>
        </ng-template>
      </bb-drawer>
    }
  `,
  styles: `
    /* Thulaib, 24 Oct 2026: on a laptop the chat runs edge to edge like WhatsApp on a desk, the team on the left and the
       client on the right, never a narrow column in the middle */
    :host {
      display: block;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    /* hand fix, Claude, after looking at it on a 375px phone: one row, so the strip never eats a third of the chat */
    .head .btn { min-height: 44px; }
    .need {
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: var(--r-l);
      background: var(--brand-soft-2);
      border: 1px solid var(--line);
      padding: 6px 6px 6px 12px;
      margin-bottom: 16px;
      position: sticky;
      top: calc(var(--top-h) + var(--sat));
      z-index: 5;
    }

    .need strong {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex: none;
      --ico: 18px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--brand-text);
    }

    .need-none {
      font-size: 13px;
      color: var(--muted);
      margin-left: 8px;
    }

    .need-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-left: auto;
    }
    @media (max-width: 639px) {
      .need { padding: 6px; }
      .need strong { display: none; }
      .need-row { margin-left: 0; flex-wrap: nowrap; width: 100%; }
      .need-row button { flex: 1 1 auto; min-width: 0; padding-left: 10px; padding-right: 10px; }
    }

    .need-row button {
      min-height: 44px;
    }

    .stream {
      padding-bottom: 16px;
    }

    .day {
      text-align: center;
      margin: 18px 0 8px;
    }

    .day span {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 10px;
    }

    .empty {
      text-align: center;
      padding: 40px 20px;
    }

    .empty strong {
      display: block;
      font-size: 16px;
      margin-bottom: 8px;
    }

    .empty p {
      font-size: 13px;
      color: var(--muted);
      margin: 0;
    }

    /* hand fix, Claude: the dock reaches the bottom edge and the bar floats on it, so the conversation never shows
       through a gap between the composer and the bar */
    .dock {
      position: fixed;
      left: 0;
      right: 0;
      z-index: 20;
      bottom: 0;
      background: var(--bg);
      padding-bottom: calc(76px + var(--sab));
    }

    .dock.typing {
      padding-bottom: var(--sab);
    }
    .dock.kb {
      padding-bottom: 0;
    }

    .dock > bb-composer {
      display: block;
    }
    @media (min-width: 1020px) {
      .dock > bb-composer { padding-left: 24px; padding-right: 24px; }
    }

    .big {
      width: 100%;
      border-radius: var(--r);
      display: block;
      background: var(--surface-2);
      min-height: 200px;
    }

    @media (min-width: 1020px) {
      .dock {
        left: var(--side-w);
        padding-bottom: 0;
      }
    }

    @media (hover: hover) {
      .need-row button:hover {
        background: var(--brand-soft);
      }
    }

    :host ::ng-deep bb-bubble.lit .bub {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
  `
})
export class ChatComponent implements OnInit, AfterViewInit, OnDestroy {
  work = inject(WorkService);
  cast = inject(CastService);
  private data = inject(DataService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChild('dock', { static: true }) dockEl!: ElementRef<HTMLElement>;

  openId = signal<string | null>(null);
  replyTo = signal<Msg | null>(null);
  viewer = signal<{ ids: string[]; index: number } | null>(null);
  viewUrl = signal('');
  typing = signal(false);
  dockH = signal(72);
  kb = signal(0);

  groups = computed(() => byDay(this.work.msgs(), this.work.now()));
  taskSources = computed(() => new Set(this.work.tasks().map(t => t.source).filter(Boolean)));

  wa = computed(() => this.cast.whatsapp('Hello Business Booster, this is ' + this.work.me().name + ' [Hub].'));

  private vvResize = () => this.updateKb();
  private vvScroll = () => this.updateKb();
  private ro: ResizeObserver | null = null;

  ngOnInit(): void {
    this.work.init();

    const msgId = this.route.snapshot.queryParamMap.get('msg');
    setTimeout(() => {
      if (msgId) {
        const el = document.querySelector(`[data-msg="${msgId}"]`);
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.classList.add('lit');
          setTimeout(() => el.classList.remove('lit'), 1600);
        }
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }
    }, 60);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.vvResize);
      window.visualViewport.addEventListener('scroll', this.vvScroll);
      this.updateKb();
    }

  }

  /* hand fix, Claude: the part watched the dock in ngOnInit, before Angular had drawn it (a page error on every open),
     and on a real client's screen there is no dock at all */
  ngAfterViewInit(): void {
    const el = this.dockEl?.nativeElement; if (!el || typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(() => this.dockH.set(el.offsetHeight));
    this.ro.observe(el);
  }

  ngOnDestroy(): void {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.vvResize);
      window.visualViewport.removeEventListener('scroll', this.vvScroll);
    }
    this.ro?.disconnect();
    document.body.classList.remove('composing');
  }

  /* only a keyboard lifts the composer: measured while the person is typing, and anything under 120px (the browser's own
     bar shrinking during a scroll) is not a keyboard. Before 24 Oct 2026 every scroll re-measured and the box jumped. */
  private updateKb(): void {
    const vv = window.visualViewport;
    if (!vv || !this.typing()) { if (this.kb() !== 0) this.kb.set(0); return; }
    const raw = Math.round(window.innerHeight - vv.height - vv.offsetTop);
    const next = raw > 120 ? raw : 0;
    if (next !== this.kb()) this.kb.set(next);
  }

  setTyping(v: boolean): void {
    this.typing.set(v);
    this.updateKb();
    document.body.classList.toggle('composing', v);
  }

  showName(list: Msg[], i: number): boolean {
    if (i === 0) return true;
    const prev = list[i - 1];
    const cur = list[i];
    if (prev.by !== cur.by) return true;
    if (new Date(cur.at).getTime() - new Date(prev.at).getTime() > 10 * 60 * 1000) return true;
    if (prev.event) return true;
    return false;
  }

  mine(m: Msg): boolean {
    return m.side === 'client' && m.by === this.work.me().name;
  }

  canTask(m: Msg): boolean {
    return !m.ref && !m.event && !this.taskSources().has(m.id) && (!!m.text || !!m.photos?.length || !!m.voice);
  }

  toggle(m: Msg): void {
    this.openId.set(this.openId() === m.id ? null : m.id);
  }

  reply(m: Msg): void {
    this.replyTo.set(m);
    this.openId.set(null);
    setTimeout(() => {
      const el = document.getElementById('composer-text');
      el?.focus();
    }, 0);
  }

  task(m: Msg): void {
    const t = this.work.makeTask(m);
    this.openId.set(null);
    if (t) {
      this.data.toast('Made a task. It is in Tasks.');
      setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 60);
    }
  }

  openRef(r: MsgRef): void {
    this.router.navigate([r.kind === 'task' ? '/tasks' : '/posts'], { queryParams: { open: r.id } });
  }

  needTap(n: { key: string; kind: 'post' | 'task'; count: number; label: string; link: string; params?: Record<string, string> }): void {
    this.router.navigate([n.link], { queryParams: n.params || {} });
  }

  async send(e: { text: string; files: File[] }): Promise<void> {
    await this.work.send(e.text, e.files, this.replyTo()?.id);
    this.replyTo.set(null);
    setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 60);
  }

  async voice(e: { blob: Blob; secs: number }): Promise<void> {
    await this.work.sendVoice(e.blob, e.secs, this.replyTo()?.id);
    this.replyTo.set(null);
    setTimeout(() => window.scrollTo(0, document.documentElement.scrollHeight), 60);
  }

  quoteTap(id: string): void {
    const el = document.querySelector(`[data-msg="${id}"]`);
    if (el) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      el.classList.add('lit');
      setTimeout(() => el.classList.remove('lit'), 1600);
    }
  }

  async openPhoto(e: { ids: string[]; index: number }): Promise<void> {
    this.viewer.set(e);
    this.viewUrl.set(await mediaUrl(this.work.slug(), e.ids[e.index]));
  }

  async step(d: number): Promise<void> {
    const v = this.viewer();
    if (!v) return;
    const idx = Math.min(Math.max(v.index + d, 0), v.ids.length - 1);
    this.viewer.set({ ids: v.ids, index: idx });
    this.viewUrl.set(await mediaUrl(this.work.slug(), v.ids[idx]));
  }
}
