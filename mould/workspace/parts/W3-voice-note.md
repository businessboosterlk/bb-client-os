Write the COMPLETE contents of one new file: apps/web/src/app/ui/voice-note.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the voice note player inside a chat bubble, like WhatsApp's: a play button, a track that fills as it plays,
the time, and a speed button that goes 1x, 1.5x, 2x and back to 1x.

IMPORTS: Component, OnDestroy, input, signal, computed from '@angular/core'; IconComponent from './icon.component';
import { mediaUrl } from '../core/media'; import { voiceTime } from '../core/work';
  mediaUrl(slug, id): Promise<string> gives a playable address ('' when the file is missing).
  voiceTime(secs): string gives '0:07'.

THE COMPONENT, EXACTLY: selector 'bb-voice-note', class VoiceNoteComponent, standalone, imports [IconComponent].
  slug = input.required<string>(); media = input.required<string>(); secs = input<number>(0); mine = input<boolean>(false);
  State in signals: playing, position (seconds), rate (1, 1.5 or 2), missing (true when mediaUrl gave '').
  The audio element is made in code the first time play is pressed: new Audio(url), preload 'metadata'. ONE note plays
  at a time on the whole page: keep the playing audio in a static field; starting one pauses the other (and that other
  component's playing signal turns false through its own 'pause' listener).
  Listen on the audio for 'timeupdate' (position = currentTime), 'pause' and 'ended' (playing false; on ended position 0).
  The length is secs() (recorded files often report Infinity as their duration, so never trust audio.duration unless it
  is finite and above zero, then prefer it).
  ngOnDestroy pauses the audio and drops it.

THE LAYOUT (one row, min-height 44px, gap 10px, align centre, width 100%, min-width 200px, max-width 300px):
  1. <button type="button" class="vn-play" data-act="voice-play"> 40px circle (border-radius 50%), background var(--brand),
     colour var(--on-accent), holding <bb-icon> 'pause' while playing else 'play' (--ico:18px), aria-label "Pause voice note"
     or "Play voice note". When missing() is true the button is disabled and the label is "Voice note not on this device".
  2. The track: a div class "vn-track" flex 1, height 4px, radius 2px, background var(--line-2), position relative, holding
     a div class "vn-fill" whose width is the played share in per cent (0 when the length is 0), background var(--brand).
     The track is a role="progressbar" with aria-valuemin 0, aria-valuemax the length in whole seconds, aria-valuenow the
     position in whole seconds, aria-label "Voice note progress".
  3. The time: a span class "vn-time num" 12px var(--muted), min-width 34px, showing voiceTime(position) while playing or
     part played, else voiceTime(length).
  4. <button type="button" class="vn-speed" data-act="voice-speed"> min-width 44px, min-height 44px, no border, background
     none, holding a 28px tall pill (radius 999px, background var(--surface-2), 12px weight 700 var(--ink-2), padding 0 8px,
     class num) with "1x", "1.5x" or "2x". aria-label "Play speed, 1x" (the current speed). Pressing it moves to the next
     speed and sets audio.playbackRate when the audio exists.
  When mine() is true the host carries the class "mine" (use host: { '[class.mine]': 'mine()' }) and the play button turns
  to background var(--brand-dark).
