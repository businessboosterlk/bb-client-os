import { Component, input, output, signal, computed } from '@angular/core';
import { IconComponent } from '../../ui/icon.component';
import { PhotoGridComponent } from '../../ui/photo-grid.component';
import { VoiceNoteComponent } from '../../ui/voice-note.component';
import type { Msg, MsgRef } from '../../core/work-models';
import { timeOfDay, summary } from '../../core/work';

export interface BubbleCard {
  pill: string;
  tone: 'green' | 'amber' | 'red' | 'blue' | 'brand';
  title: string;
  line: string;
}

@Component({
  selector: 'bb-bubble',
  standalone: true,
  imports: [IconComponent, PhotoGridComponent, VoiceNoteComponent],
  host: {
    '[class.mine]': 'mine()',
    '[attr.data-msg]': 'msg().id',
  },
  template: `
    <div class="row">
      <div
        class="bub"
        (click)="onBubbleClick($event)"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        [style.transform]="swipeTransform()"
      >
        @if (showName() && !mine()) {
          <div class="who" [class.bb]="msg().side === 'bb'">
            <span class="by">{{ msg().by }}</span>
            <span class="role"> · {{ msg().role }}</span>
          </div>
        }
        @if (quote(); as q) {
          <button type="button" class="q" data-act="msg-quote" (click)="quoteTap.emit(q.id)" [attr.aria-label]="'Go to the message from ' + q.by">
            <strong>{{ q.by }}</strong>
            <span>{{ summary(q) }}</span>
          </button>
        }
        @if (card(); as c) {
          <div class="card-in">
            <span [class]="'pill ' + tones[c.tone]">{{ c.pill }}</span>
            <strong>{{ c.title }}</strong>
            <span class="line">{{ c.line }}</span>
            @if (msg().ref; as ref) {
              <button type="button" class="btn ghost sm" data-act="msg-open-ref" (click)="openRef.emit(ref)">
                Open
                <bb-icon name="chev" />
              </button>
            }
          </div>
        }
        @if (msg().photos && msg().photos!.length > 0) {
          <bb-photo-grid
            [slug]="slug()"
            [ids]="msg().photos!"
            (open)="openPhoto.emit({ ids: msg().photos!, index: $event })"
            class="photos"
          />
        }
        @if (msg().voice; as v) {
          <bb-voice-note [slug]="slug()" [media]="v.media" [secs]="v.secs" [mine]="mine()" />
        }
        @if (msg().text; as t) {
          <p class="tx">{{ t }}</p>
        }
        <div class="meta">
          <span class="num">{{ timeOfDay(msg().at) }}</span>
          @if (mine()) {
            <span class="seen" [attr.role]="'img'" [attr.aria-label]="msg().seen ? 'Seen by the team' : 'Sent'">
              <bb-icon [name]="msg().seen ? 'ticks' : 'check'" />
            </span>
          }
        </div>
      </div>
      <button
        type="button"
        class="more"
        data-act="msg-more"
        (click)="toggle.emit()"
        [attr.aria-expanded]="open()"
        aria-label="Reply or make a task"
      >
        <bb-icon name="more" />
      </button>
    </div>
    @if (open()) {
      <div class="acts">
        <button type="button" class="btn soft sm" data-act="msg-reply" (click)="reply.emit(msg())">
          <bb-icon name="reply" />
          Reply
        </button>
        @if (canTask()) {
          <button type="button" class="btn soft sm" data-act="msg-task" (click)="task.emit(msg())">
            <bb-icon name="tasks" />
            Make a task
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-top: 2px;
    }
    :host.mine {
      align-items: flex-end;
    }
    :host([data-msg]) {
      margin-top: 2px;
    }
    :host([data-msg]) .row {
      display: flex;
      align-items: center;
      gap: 2px;
      max-width: min(84%, 420px);
    }
    :host.mine .row {
      flex-direction: row-reverse;
    }
    .bub {
      padding: 8px 10px 6px;
      border-radius: 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      color: var(--ink);
      min-width: 92px;
      overflow-wrap: anywhere;
      touch-action: pan-y;
      transition: transform 160ms var(--ease);
      cursor: pointer;
    }
    :host.mine .bub {
      background: var(--brand-soft);
      border-color: transparent;
    }
    .who {
      font-size: 12.5px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ink-2);
    }
    .who.bb {
      color: var(--brand-text);
    }
    .who .role {
      font-weight: 500;
      color: var(--muted);
    }
    .q {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      border-radius: 8px;
      background: var(--surface-2);
      padding: 6px 8px;
      margin: 2px 0 6px;
      min-height: 44px;
      cursor: pointer;
    }
    .q strong {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--brand-text);
    }
    .q span {
      display: block;
      font-size: 12.5px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card-in {
      border-radius: 10px;
      background: var(--bg);
      border: 1px solid var(--line);
      padding: 10px;
      margin: 2px 0 6px;
      display: grid;
      gap: 4px;
    }
    .card-in .pill {
      justify-self: start;
    }
    .card-in strong {
      font-size: 14px;
      font-weight: 600;
    }
    .card-in .line {
      font-size: 12.5px;
      color: var(--muted);
    }
    .card-in .btn {
      justify-self: start;
      min-height: 44px;
    }
    .photos {
      margin-bottom: 4px;
    }
    .tx {
      margin: 0;
      font-size: 15px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .meta {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 3px;
      margin-top: 2px;
      font-size: 11px;
      color: var(--muted);
    }
    .meta .seen {
      display: inline-flex;
      align-items: center;
    }
    .meta .seen bb-icon {
      --ico: 14px;
      color: var(--faint);
    }
    :host.mine .meta .seen bb-icon {
      color: var(--brand-text);
    }
    .more {
      width: 44px;
      height: 44px;
      flex: none;
      border: 0;
      background: none;
      border-radius: 50%;
      color: var(--faint);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .more bb-icon {
      --ico: 16px;
    }
    .acts {
      display: flex;
      gap: 8px;
      margin: 6px 0 2px;
    }
    .acts .btn {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .acts .btn bb-icon {
      --ico: 16px;
    }
    @media (hover: hover) {
      .bub:hover {
        transform: translateY(-1px);
      }
      .more:hover {
        background: var(--surface-2);
        color: var(--ink-2);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bub {
        transition: none;
      }
    }
  
    /* hand fix, Claude: the role carries its own ellipsis so a long one ends in a mark on a 320px phone */
    .who { display: flex; min-width: 0; }
    .who .by { flex: none; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .who .role { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class BubbleComponent {
  /* a card's tone to the app's pill classes (hand fix, Claude: the part bound ngClass without importing it and mapped no tone) */
  readonly tones: Record<BubbleCard['tone'], string> = { green: 'won', amber: 'quoted', red: 'over', blue: 'new', brand: 'brand' };
  msg = input.required<Msg>();
  mine = input<boolean>(false);
  slug = input.required<string>();
  quote = input<Msg | null>(null);
  card = input<BubbleCard | null>(null);
  showName = input<boolean>(true);
  canTask = input<boolean>(false);
  open = input<boolean>(false);

  toggle = output<void>();
  reply = output<Msg>();
  task = output<Msg>();
  openRef = output<MsgRef>();
  openPhoto = output<{ ids: string[]; index: number }>();
  quoteTap = output<string>();

  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeDistance = signal(0);
  private swipeEmitted = false;

  readonly timeOfDay = timeOfDay;
  readonly summary = summary;

  swipeTransform = computed(() => {
    const d = this.swipeDistance();
    return d > 0 ? `translateX(${d}px)` : '';
  });

  onBubbleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('button, a')) {
      return;
    }
    if (this.swipeEmitted) {
      this.swipeEmitted = false;
      return;
    }
    this.toggle.emit();
  }

  onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
    this.swipeDistance.set(0);
    this.swipeEmitted = false;
  }

  onPointerMove(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }
    const dx = event.clientX - this.swipeStartX;
    const dy = event.clientY - this.swipeStartY;
    if (dx > 0 && dx > Math.abs(dy)) {
      this.swipeDistance.set(Math.min(dx, 64));
    }
  }

  onPointerUp(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }
    const d = this.swipeDistance();
    if (d >= 56) {
      this.swipeEmitted = true;
      this.reply.emit(this.msg());
    }
    this.swipeDistance.set(0);
  }
}
