Write the COMPLETE contents of one new file: apps/web/src/app/pages/work/bubble.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: one message in a WhatsApp style chat between a client's team and their marketing agency, Business Booster.
The client's own messages sit on the right, everyone else's on the left. A message can carry words, photos, a voice note,
a quote of the message it answers, and a CARD when it is about a task or a post (a task was made, a post was approved).

IMPORTS: Component, input, output, signal, computed from '@angular/core'; IconComponent from '../../ui/icon.component';
PhotoGridComponent from '../../ui/photo-grid.component' (selector bb-photo-grid, inputs slug and ids, output open(index));
VoiceNoteComponent from '../../ui/voice-note.component' (selector bb-voice-note, inputs slug, media, secs, mine);
import type { Msg, MsgRef } from '../../core/work-models'; import { timeOfDay, summary } from '../../core/work';
  interface Msg { id: string; at: string; side: 'client' | 'bb'; by: string; role: string; text?: string; photos?: string[];
    voice?: { media: string; secs: number }; reply?: string; ref?: { kind: 'task' | 'post'; id: string }; event?: string; seen?: boolean; }
  timeOfDay(iso) gives '09:05'. summary(msg) gives one short line for a message ('Photo', 'Voice note 0:07', its first line).

export interface BubbleCard { pill: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'brand'; title: string; line: string; }

THE COMPONENT, EXACTLY: selector 'bb-bubble', class BubbleComponent, standalone,
  imports [IconComponent, PhotoGridComponent, VoiceNoteComponent].
  msg = input.required<Msg>(); mine = input<boolean>(false); slug = input.required<string>();
  quote = input<Msg | null>(null);           the message this one answers, when there is one
  card = input<BubbleCard | null>(null);      worked out by the chat screen from msg().ref
  showName = input<boolean>(true);            false for the second and later messages in a run by the same person
  canTask = input<boolean>(false);            the message can become a task
  open = input<boolean>(false);               the actions under the bubble are showing
  toggle = output<void>(); reply = output<Msg>(); task = output<Msg>(); openRef = output<MsgRef>();
  openPhoto = output<{ ids: string[]; index: number }>(); quoteTap = output<string>();

THE LAYOUT:
  The host: display flex, flex-direction column, align-items flex-start; with mine() align-items flex-end. Host classes
  through host: { '[class.mine]': 'mine()', '[attr.data-msg]': 'msg().id' }. Margin top 2px, or 10px when showName().
  A row div class "row" (display flex, align-items centre, gap 2px, max-width min(84%, 420px); with mine the row is
  flex-direction row-reverse) holding:
  1. THE BUBBLE: a div class "bub" (padding 8px 10px 6px, border-radius 14px, background var(--surface), border 1px solid
     var(--line), colour var(--ink), min-width 92px, overflow-wrap anywhere, touch-action pan-y, transition transform 160ms
     var(--ease)). With mine: background var(--brand-soft), border-color transparent. A (click) on the bubble div emits
     toggle(), EXCEPT when the click came from inside a button or a link (check (event.target as HTMLElement).closest('button,a')).
     Inside, in order, each only when it applies:
     a. the name line, only when showName() and not mine(): a div class "who" 12.5px weight 600, "{by}" then " · {role}"
        in weight 500 var(--muted); colour var(--brand-text) when msg().side is 'bb', else var(--ink-2). One line, ellipsis.
     b. the quote, when quote() is set: <button type="button" class="q" data-act="msg-quote"> (display block, width 100%,
        text-align left, border 0, border-radius 8px, background var(--surface-2), padding 6px 8px, margin 2px 0 6px,
        min-height 44px) holding a strong (12px weight 600 var(--brand-text), quote().by) and a span (12.5px var(--muted),
        one line with ellipsis, summary(quote())). It emits quoteTap(quote().id). aria-label "Go to the message from {by}".
     c. the card, when card() is set: a div class "card-in" (border-radius 10px, background var(--bg), border 1px solid
        var(--line), padding 10px, margin 2px 0 6px, display grid, gap 4px) holding a span class "pill" plus the tone
        class (green: "won", amber: "quoted", red: "over", blue: "new", brand: "brand") with card().pill; a strong 14px
        weight 600 with card().title; a span 12.5px var(--muted) with card().line; and when msg().ref is set
        <button type="button" class="btn ghost sm" data-act="msg-open-ref"> with the words "Open" and <bb-icon name="chev"/>
        emitting openRef(msg().ref). The button is justify-self start.
     d. the photos: <bb-photo-grid [slug]="slug()" [ids]="msg().photos" (open)="openPhoto.emit({ ids: msg().photos, index: $event })"/>
        with margin-bottom 4px (guard photos being set and not empty; inside the guard you may write msg().photos!).
     e. the voice note: <bb-voice-note [slug]="slug()" [media]="msg().voice.media" [secs]="msg().voice.secs" [mine]="mine()"/>
     f. the words: a p class "tx" (margin 0, 15px, line-height 1.4, white-space pre-wrap) with msg().text.
     g. the meta line: a div class "meta" (display flex, justify-content flex-end, align-items centre, gap 3px, margin-top
        2px, 11px var(--muted), class num) with timeOfDay(msg().at) and, only when mine(), the ticks: <bb-icon name="ticks"/>
        when msg().seen, else <bb-icon name="check"/>, --ico:14px, inside a span with role="img" and an aria-label "Seen by
        the team" or "Sent"; the seen ticks are coloured var(--brand-text).
  2. THE ACTIONS BUTTON beside the bubble: <button type="button" class="more" data-act="msg-more"> 44px by 44px, flex
     none, border 0, background none, border-radius 50%, colour var(--faint), holding <bb-icon name="more"/> (--ico:16px),
     aria-label "Reply or make a task", [attr.aria-expanded]="open()". It emits toggle().
  3. SWIPE TO REPLY on the bubble div: on pointerdown with pointerType 'touch' note the x and y; on pointermove when the
     finger moved right more than it moved up or down, translate the bubble right by the distance (at most 64px, never
     left) through a signal read in [style.transform]; on pointerup or pointercancel, when the distance reached 56px emit
     reply(msg()); always spring back to 0. A swipe that emitted reply must not also emit toggle.
  4. THE ACTION BAR, only when open(): a div class "acts" under the row (display flex, gap 8px, margin 6px 0 2px) holding
     <button type="button" class="btn soft sm" data-act="msg-reply"> with <bb-icon name="reply"/> and "Reply" (emits
     reply(msg())), and only when canTask(): <button type="button" class="btn soft sm" data-act="msg-task"> with
     <bb-icon name="tasks"/> and "Make a task" (emits task(msg())). Both min-height 44px.
