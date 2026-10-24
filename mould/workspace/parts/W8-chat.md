Write the COMPLETE contents of one new file: apps/web/src/app/pages/work/chat.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the screen that opens first in The Hub: a WhatsApp style chat between the client's team and Business
Booster, the main channel between them (their WhatsApp group stays as the backup). On top, a strip of what needs the
client's hand (posts waiting for their yes, tasks for them). Then the messages by day. At the bottom, the composer.
The app shell around this screen already draws the top bar (with the title "Chat") and, on a phone, a floating bar of
five icons 14px above the bottom of the screen and 56px tall.

IMPORTS (exactly these, plus what Angular needs):
  Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild, effect from '@angular/core';
  Router, ActivatedRoute from '@angular/router';
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

WHAT THEY GIVE YOU:
  WorkService (public field work): available() boolean; ready() boolean; init(): void (call in ngOnInit); slug() string;
    me() { name: string; role: string }; msgs() Msg[] (oldest first); now() ISO string of the current minute;
    needs() { key: string; kind: 'post' | 'task'; count: number; label: string; link: string; params?: Record<string, string> }[];
    msg(id?: string): Msg | null; card(m: Msg): BubbleCard | null; tasks() { source?: string }[];
    send(text: string, files: File[], reply?: string): Promise<Msg | null>;
    sendVoice(blob: Blob, secs: number, reply?: string): Promise<Msg | null>;
    makeTask(m: Msg): { id: string } | null.
  CastService (public field cast): whatsapp(text: string): string (a wa.me or group link, '' when none); isGroup(): boolean.
  DataService (private field data): toast(text: string): void shows a short message at the bottom.
  byDay(msgs, now): { day: string; label: string; msgs: Msg[] }[].
  mediaUrl(slug, id): Promise<string>.
  <bb-bubble> inputs: msg (Msg), mine (boolean), slug (string), quote (Msg | null), card (BubbleCard | null), showName
    (boolean), canTask (boolean), open (boolean); outputs: toggle (void), reply (Msg), task (Msg), openRef (MsgRef),
    openPhoto ({ ids: string[]; index: number }), quoteTap (string: a message id). Its host has the attribute data-msg="{id}".
  <bb-composer> input replyTo (Msg | null); outputs send ({ text: string; files: File[] }), voice ({ blob: Blob; secs:
    number }), cancelReply (void), focused (boolean).
  <bb-drawer> (the app's one sheet): inputs open (boolean), title (string); output closed; content in
    <ng-template #body>...</ng-template> and <ng-template #foot>...</ng-template>. It locks the page and handles Back.
  <bb-work-soon what="chat"/> draws the "arrives soon" panel for a client not on the demo. Use it when !work.available().

THE COMPONENT: selector 'bb-chat', class ChatComponent, standalone, imports [BubbleComponent, ComposerComponent,
  DrawerComponent, IconComponent, WorkSoonComponent]. Public fields work, cast; private data, router, route.
  Signals: openId (string | null: the message whose actions show), replyTo (Msg | null), viewer ({ ids: string[]; index:
  number } | null), viewUrl (string), typing (boolean), dockH (number, default 72), kb (number: keyboard height, 0).
  groups = computed(() => byDay(this.work.msgs(), this.work.now())).
  taskSources = computed(() => new Set(tasks().map(t => t.source).filter(Boolean))).

  showName(list: Msg[], i: number): true when i is 0, or the message before has a different by, or more than 10 minutes
    passed since it (compare new Date(x).getTime()), or the message before carries an event.
  mine(m): m.side === 'client' && m.by === work.me().name.
  canTask(m): !m.ref && !m.event && !taskSources().has(m.id) && (!!m.text || !!m.photos?.length || !!m.voice).

  ngOnInit: work.init(); read the query param 'msg' once (route.snapshot.queryParamMap.get('msg')): when set, after the
  first render scroll that message into view (block centre) and add the class "lit" to its element for 1600ms; else scroll
  to the bottom: window.scrollTo(0, document.documentElement.scrollHeight). Use setTimeout(.., 60) for both.
  Listen to window.visualViewport 'resize' and 'scroll' (when it exists): kb.set(Math.max(0, Math.round(innerHeight -
  vv.height - vv.offsetTop))). A ResizeObserver on the dock element sets dockH to its height. ngOnDestroy removes every
  listener, disconnects the observer and removes the body class 'composing'.
  typing(v): this.typing.set(v); document.body.classList.toggle('composing', v) (the shell hides its floating bar then).

  ACTIONS:
  toggle(m): openId.set(openId() === m.id ? null : m.id).
  reply(m): replyTo.set(m); openId.set(null); focus document.getElementById('composer-text').
  task(m): const t = work.makeTask(m); openId.set(null); when t: data.toast('Made a task. It is in Tasks.'); scroll to bottom.
  openRef(r): router.navigate([r.kind === 'task' ? '/tasks' : '/posts'], { queryParams: { open: r.id } }).
  needTap(n): router.navigate([n.link], { queryParams: n.params || {} }).
  async send(e): await work.send(e.text, e.files, replyTo()?.id); replyTo.set(null); scroll to bottom.
  async voice(e): await work.sendVoice(e.blob, e.secs, replyTo()?.id); replyTo.set(null); scroll to bottom.
  quoteTap(id): scroll [data-msg="id"] into view (block centre, smooth unless reduced motion) and light it as above.
  openPhoto(e): viewer.set(e) and load viewUrl with mediaUrl(work.slug(), e.ids[e.index]); step(d) moves the index within
    range and loads that url.
  wa = computed(() => cast.whatsapp('Hello Business Booster, this is ' + work.me().name + ' [Hub].')).

THE TEMPLATE:
  @if (!work.available()) { <bb-work-soon what="chat"/> } @else {
  1. A header div class "head": an h1 class "t-h1" "You and Business Booster" and a p class "t-small" "Your team and ours,
     in one place." and, when wa() is set, an <a class="btn ghost sm" data-act="chat-whatsapp" [href]="wa()" target="_blank"
     rel="noreferrer"> with <bb-icon name="wa"/> and a span: "Our WhatsApp group" when cast.isGroup() else "WhatsApp",
     plus the aria-label "WhatsApp, the backup if the app is down". The header is display flex, justify-content
     space-between, align-items flex-end, gap 12px, flex-wrap wrap, margin-bottom 12px.
  2. THE STRIP: a section class "need" aria-label "Needs your hand" (border-radius var(--r-l), background var(--brand-soft-2),
     border 1px solid var(--line), padding 10px, margin-bottom 16px, position sticky, top calc(var(--top-h) + var(--sat)),
     z-index 5). Inside: a strong 12.5px weight 600 var(--brand-text) "Needs your hand" and then:
     when work.needs() has items: a div class "need-row" (display flex, gap 8px, flex-wrap wrap, margin-top 8px) of
       <button type="button" class="btn soft sm" [attr.data-act]="'chat-need-' + n.key"> each with
       <bb-icon [name]="n.kind === 'post' ? 'post' : 'tasks'"/> and n.label, min-height 44px, calling needTap(n).
     else: a span 13px var(--muted) "Nothing needs your hand right now." after the strong, on the same line.
  3. THE STREAM: a div class "stream" with padding-bottom equal to dockH() + 16 px (through [style.padding-bottom.px]).
     @for each group (track g.day): a div class "day" (text-align centre, margin 18px 0 8px) holding a span (display
     inline-block, 12px weight 600 var(--muted), background var(--surface), border 1px solid var(--line), border-radius
     999px, padding 3px 10px) with g.label; then @for each message (track m.id; let i = $index):
     <bb-bubble [msg]="m" [mine]="mine(m)" [slug]="work.slug()" [quote]="work.msg(m.reply)" [card]="work.card(m)"
       [showName]="showName(g.msgs, i)" [canTask]="canTask(m)" [open]="openId() === m.id" (toggle)="toggle(m)"
       (reply)="reply($event)" (task)="task($event)" (openRef)="openRef($event)" (openPhoto)="openPhoto($event)"
       (quoteTap)="quoteTap($event)"/>
     When there are no messages at all: a div class "empty" with a strong "Say hello" and the words "Write to Business
     Booster here. Photos and voice notes work too.".
  4. THE DOCK: a div #dock class "dock" (position fixed, left 0, right 0, z-index 20, bottom: kb() when kb() > 0, else on a
     phone calc(84px + var(--sab)) and at 1020px wide and above 0 with left var(--side-w)). Set the bottom with
     [style.bottom] = kb() > 0 ? kb() + 'px' : null, and the CSS default bottom calc(84px + var(--sab)), with
     @media (min-width:1020px){ .dock{ left:var(--side-w); bottom:0 } }; when typing() and kb() is 0 on a phone the bottom is
     var(--sab) (class "typing" on the dock: bottom var(--sab)). Inside: <bb-composer [replyTo]="replyTo()"
     (send)="send($event)" (voice)="voice($event)" (cancelReply)="replyTo.set(null)" (focused)="typing($event)"/>. The dock
     holds the composer at max-width 820px, margin 0 auto.
  5. THE PHOTO VIEWER: <bb-drawer [open]="!!viewer()" [title]="'Photo ' + ((viewer()?.index ?? 0) + 1) + ' of ' + (viewer()?.ids?.length ?? 0)"
     (closed)="viewer.set(null)"> with a body template holding <img [src]="viewUrl()" alt="" class="big"> (width 100%,
     border-radius var(--r), display block, background var(--surface-2), min-height 200px) and a foot template with
     <button type="button" class="btn quiet" data-act="photo-prev" [disabled]="(viewer()?.index ?? 0) === 0" (click)="step(-1)">Previous</button>
     and <button type="button" class="btn quiet" data-act="photo-next" [disabled]="..last.." (click)="step(1)">Next</button>.
  }
  STYLES also hold: :host{display:block;max-width:820px;margin:0 auto} and a class "lit" rule for the host of a
  bub-ble: :host ::ng-deep bb-bubble.lit .bub{outline:2px solid var(--brand);outline-offset:2px} (state, not decoration).
