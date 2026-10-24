import {
  Component,
  OnDestroy,
  ElementRef,
  ViewChild,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { IconComponent } from '../../ui/icon.component';
import type { Msg } from '../../core/work-models';
import { summary, voiceTime } from '../../core/work';
import { VoiceRecorder } from '../../core/media';

@Component({
  selector: 'bb-composer',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (replyTo(); as reply) {
      <div class="rp">
        <div class="rp-text">
          <strong>Replying to {{ reply.by }}</strong>
          <span>{{ summary(reply) }}</span>
        </div>
        <button
          type="button"
          class="x"
          data-act="composer-reply-cancel"
          aria-label="Stop replying"
          (click)="cancelReply.emit()"
        >
          <bb-icon name="x" />
        </button>
      </div>
    }

    @if (previews().length > 0) {
      <div class="pk">
        @for (preview of previews(); track preview; let i = $index) {
          <div class="pk-item">
            <img [src]="preview" alt="" />
            <button
              type="button"
              class="pk-x"
              data-act="composer-photo-remove"
              [attr.aria-label]="'Remove photo ' + (i + 1)"
              (click)="removePhoto(i)"
            >
              <span class="pk-x-circle">
                <bb-icon name="x" />
              </span>
            </button>
          </div>
        }
      </div>
    }

    @if (rec()) {
      <div class="rec-row">
        <span class="dot"></span>
        <span class="rec-time num" aria-live="polite">
          {{ voiceTime(secs()) }}<span class="rec-label"> Recording</span>
        </span>
        <button
          type="button"
          class="btn quiet sm"
          data-act="composer-record-cancel"
          (click)="cancelRecording()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn sm"
          data-act="composer-record-send"
          (click)="sendRecording()"
        >
          <bb-icon name="send" />
          <span>Send</span>
        </button>
      </div>
    } @else {
      <div class="row">
        <label class="pick" data-act="composer-photo">
          <bb-icon name="camera" />
          <input
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            aria-label="Add photos"
            (change)="picked($event)"
          />
        </label>

        <textarea
          #box
          id="composer-text"
          rows="1"
          placeholder="Message"
          aria-label="Write a message"
          enterkeyhint="send"
          [value]="text()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
          (focus)="focused.emit(true)"
          (blur)="focused.emit(false)"
        ></textarea>

        @if (canSend() || !canRecord) {
          <button
            type="button"
            class="go"
            data-act="composer-send"
            aria-label="Send"
            [disabled]="!canSend()"
            (click)="sendText()"
          >
            <bb-icon name="send" />
          </button>
        } @else {
          <button
            type="button"
            class="go"
            data-act="composer-mic"
            aria-label="Record a voice note"
            (click)="startRecording()"
          >
            <bb-icon name="mic" />
          </button>
        }
      </div>
    }

    @if (refused() !== '') {
      <p class="t-small" role="alert">{{ refused() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      background: var(--bg);
      padding: 8px 10px;
      border-top: 1px solid var(--line);
    }

    .rp {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 6px 6px 10px;
      margin-bottom: 6px;
      border-radius: 10px;
      background: var(--surface-2);
    }

    .rp-text {
      flex: 1;
      min-width: 0;
    }

    .rp-text strong {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--brand-text);
    }

    .rp-text span {
      display: block;
      font-size: 12.5px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .x {
      width: 44px;
      height: 44px;
      border: 0;
      background: none;
      display: grid;
      place-items: center;
      color: var(--muted);
      cursor: pointer;
      padding: 0;
    }

    .x bb-icon {
      --ico: 18px;
    }

    .pk {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      margin-bottom: 6px;
    }

    .pk-item {
      width: 64px;
      height: 64px;
      border-radius: 10px;
      overflow: hidden;
      position: relative;
      flex: none;
    }

    .pk-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .pk-x {
      width: 44px;
      height: 44px;
      position: absolute;
      top: -6px;
      right: -6px;
      border: 0;
      background: none;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }

    .pk-x-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--ink);
      color: var(--bg);
      display: grid;
      place-items: center;
    }

    .pk-x-circle bb-icon {
      --ico: 12px;
    }

    .rec-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--red);
      flex: none;
    }

    .rec-time {
      font-size: 15px;
      font-weight: 600;
      flex: 1;
    }

    .rec-label {
      color: var(--muted);
      font-size: 13px;
      font-weight: 400;
    }

    .rec-row .btn {
      min-height: 44px;
    }

    .row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
    }

    .pick {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: var(--muted);
      cursor: pointer;
      flex: none;
    }

    .pick bb-icon {
      --ico: 22px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    textarea {
      flex: 1;
      min-height: 44px;
      max-height: 132px;
      resize: none;
      border: 1px solid var(--line-2);
      border-radius: 22px;
      padding: 11px 14px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 15px;
      line-height: 1.4;
      box-sizing: border-box;
    }

    @media (pointer: coarse) {
      textarea {
        font-size: 16px;
      }
    }

    .go {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--brand);
      color: var(--on-accent);
      border: 0;
      display: grid;
      place-items: center;
      cursor: pointer;
      flex: none;
      padding: 0;
    }

    .go:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .go bb-icon {
      --ico: 20px;
    }

    .t-small {
      margin: 6px 4px 0;
    }
  `,
})
export class ComposerComponent implements OnDestroy {
  replyTo = input<Msg | null>(null);
  send = output<{ text: string; files: File[] }>();
  voice = output<{ blob: Blob; secs: number }>();
  cancelReply = output<void>();
  focused = output<boolean>();

  @ViewChild('box') box!: ElementRef<HTMLTextAreaElement>;

  text = signal('');
  files = signal<File[]>([]);
  previews = signal<string[]>([]);
  rec = signal(false);
  secs = signal(0);
  refused = signal('');

  canSend = computed(() => {
    const t = this.text().trim();
    return t.length > 0 || this.files().length > 0;
  });

  readonly canRecord = VoiceRecorder.supported();

  private recorder: VoiceRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private finePointer = window.matchMedia('(pointer:fine)');

  picked(event: Event) {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    const current = this.files();
    const room = 10 - current.length;
    if (room <= 0) {
      input.value = '';
      return;
    }
    const kept = chosen.slice(0, room);
    const newFiles = [...current, ...kept];
    this.files.set(newFiles);
    const newPreviews = kept.map((file) => URL.createObjectURL(file));
    this.previews.set([...this.previews(), ...newPreviews]);
    input.value = '';
  }

  removePhoto(index: number) {
    const previews = this.previews();
    const files = this.files();
    URL.revokeObjectURL(previews[index]);
    this.previews.set(previews.filter((_, i) => i !== index));
    this.files.set(files.filter((_, i) => i !== index));
  }

  onInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.text.set(textarea.value);
    this.growBox();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && this.finePointer.matches) {
      event.preventDefault();
      this.sendText();
    }
  }

  private growBox() {
    const textarea = this.box?.nativeElement;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 132) + 'px';
  }

  sendText() {
    if (!this.canSend()) return;
    this.send.emit({ text: this.text().trim(), files: this.files() });
    this.clearComposer();
  }

  private clearComposer() {
    this.text.set('');
    this.files.set([]);
    this.previews().forEach((url) => URL.revokeObjectURL(url));
    this.previews.set([]);
    const textarea = this.box?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }

  async startRecording() {
    this.refused.set('');
    const recorder = new VoiceRecorder();
    this.recorder = recorder;
    try {
      await recorder.start();
      this.rec.set(true);
      this.secs.set(0);
      this.timer = setInterval(() => {
        this.secs.set(recorder.elapsed());
      }, 250);
    } catch {
      this.refused.set(
        'The microphone is off for this app. Allow it in Settings to send a voice note.'
      );
    }
  }

  async sendRecording() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.clearTimer();
    try {
      const { blob, secs } = await recorder.stop();
      this.rec.set(false);
      this.secs.set(0);
      if (secs >= 0.5) {
        this.voice.emit({ blob, secs });
      }
    } catch {
      this.rec.set(false);
      this.secs.set(0);
    }
    this.recorder = null;
  }

  cancelRecording() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.clearTimer();
    recorder.cancel();
    this.rec.set(false);
    this.secs.set(0);
    this.recorder = null;
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy() {
    this.clearTimer();
    this.previews().forEach((url) => URL.revokeObjectURL(url));
    if (this.recorder && this.recorder.recording) {
      this.recorder.cancel();
    }
  }
}
