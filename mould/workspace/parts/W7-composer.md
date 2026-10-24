Write the COMPLETE contents of one new file: apps/web/src/app/pages/work/composer.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the bar at the bottom of a WhatsApp style chat where the client writes, adds photos or records a voice note.
The chat screen places it; this part draws only the bar.

IMPORTS: Component, OnDestroy, ElementRef, ViewChild, input, output, signal, computed from '@angular/core';
IconComponent from '../../ui/icon.component'; import type { Msg } from '../../core/work-models';
import { summary, voiceTime } from '../../core/work'; import { VoiceRecorder } from '../../core/media';
  VoiceRecorder: static supported(): boolean; get recording(): boolean; start(): Promise<void>; elapsed(): number
  (seconds so far); stop(): Promise<{ blob: Blob; secs: number }>; cancel(): void.
  summary(msg) gives one short line for a message. voiceTime(secs) gives '0:07'.

THE COMPONENT, EXACTLY: selector 'bb-composer', class ComposerComponent, standalone, imports [IconComponent].
  replyTo = input<Msg | null>(null);
  send = output<{ text: string; files: File[] }>(); voice = output<{ blob: Blob; secs: number }>(); cancelReply = output<void>();
  focused = output<boolean>();                 true when the text box gains focus, false when it loses it
  @ViewChild('box') box!: ElementRef<HTMLTextAreaElement>;
  State in signals: text (string), files (File[]), previews (string[]: object URLs of the picked files, revoked when a file
  is removed, after a send and in ngOnDestroy), rec (boolean: recording), secs (number: the recording time shown, read
  from the recorder's elapsed() every 250ms by setInterval while recording; clear the interval on stop, cancel and
  destroy), refused (string: '' or the reason the microphone did not start).
  canSend = computed: text has words, or files is not empty. canRecord: VoiceRecorder.supported() read once into a field.

THE LAYOUT: the host is display block, background var(--bg), padding 8px 10px; border-top 1px solid var(--line).
  1. THE REPLY CHIP, only when replyTo() is set: a div class "rp" (display flex, align-items centre, gap 8px, padding 6px
     6px 6px 10px, margin-bottom 6px, border-radius 10px, background var(--surface-2)) holding a div (flex 1, min-width 0)
     with a strong (12px weight 600 var(--brand-text), "Replying to {replyTo().by}") and a span (12.5px var(--muted), one
     line, ellipsis, summary(replyTo())), then <button type="button" class="x" data-act="composer-reply-cancel"> 44px square,
     <bb-icon name="x"/>, aria-label "Stop replying", emitting cancelReply().
  2. THE PICKED PHOTOS, only when previews is not empty: a div class "pk" (display flex, gap 6px, overflow-x auto,
     margin-bottom 6px) of 64px squares (border-radius 10px, overflow hidden, position relative, flex none) each with an
     img (object-fit cover, 100 per cent) and <button type="button" class="pk-x" data-act="composer-photo-remove"> (44px
     square in the top right corner, position absolute, top -6px, right -6px, border 0, background none, display grid,
     place-items centre) holding a 22px circle span (background var(--ink), colour var(--bg)) with <bb-icon name="x"/>
     (--ico:12px); aria-label "Remove photo {i + 1}". At most 10 files are kept; more are ignored.
  3. WHILE RECORDING (rec() true) the row is: a span class "dot" (10px circle, background var(--red)), the time
     voiceTime(secs()) (15px weight 600, class num, flex 1, aria-live polite, with the words " Recording" after it in
     var(--muted) 13px), <button type="button" class="btn quiet sm" data-act="composer-record-cancel">Cancel</button>,
     <button type="button" class="btn sm" data-act="composer-record-send"><bb-icon name="send"/><span>Send</span></button>.
     Both min-height 44px.
  4. OTHERWISE the row (display flex, align-items flex-end, gap 6px):
     a. a label class "pick" data-act="composer-photo" (44px square, display grid, place-items centre, border-radius
        50%, colour var(--muted), cursor pointer) holding <bb-icon name="camera"/> (--ico:22px) and an
        <input type="file" accept="image/*" multiple class="sr-only" aria-label="Add photos" (change)="picked($event)">.
        picked() appends the chosen files (up to 10 in all), makes their previews and clears the input value.
     b. <textarea #box id="composer-text" rows="1" placeholder="Message" aria-label="Write a message" enterkeyhint="send">
        flex 1, min-height 44px, max-height 132px, resize none, border 1px solid var(--line-2), border-radius 22px,
        padding 11px 14px, background var(--surface), colour var(--ink), font inherit, font-size 15px, line-height 1.4,
        and @media (pointer:coarse) font-size 16px. On input: text.set(value) and grow the box (height auto, then height
        scrollHeight in px, at most 132). Keydown Enter WITHOUT shift on a fine pointer (matchMedia('(pointer:fine)'))
        sends and prevents the new line. focus emits focused(true), blur emits focused(false).
     c. when canSend() or not canRecord: <button type="button" class="go" data-act="composer-send"> 44px circle,
        background var(--brand), colour var(--on-accent), border 0, <bb-icon name="send"/> (--ico:20px), aria-label "Send",
        disabled when not canSend(). Pressing it emits send({ text: text().trim(), files: files() }) and then clears text,
        files, previews and the box height.
        otherwise: <button type="button" class="go" data-act="composer-mic"> the same circle with <bb-icon name="mic"/>,
        aria-label "Record a voice note". Pressing it calls start() on a VoiceRecorder made then; on success rec.set(true)
        and the 250ms interval starts; on failure refused.set('The microphone is off for this app. Allow it in Settings to
        send a voice note.').
  5. when refused() is not '': a p class "t-small" role="alert" with refused(), margin 6px 4px 0.
  Record send: stop the recorder, rec.set(false), and when secs is at least 0.5 emit voice({ blob, secs }).
  Record cancel: cancel the recorder, rec.set(false).
