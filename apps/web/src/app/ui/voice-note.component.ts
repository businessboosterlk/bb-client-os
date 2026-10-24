import { Component, OnDestroy, input, signal, computed, effect } from '@angular/core';
import { IconComponent } from './icon.component';
import { mediaUrl } from '../core/media';
import { voiceTime } from '../core/work';

@Component({
  selector: 'bb-voice-note',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="vn-row" [class.mine]="mine()">
      <button
        type="button"
        class="vn-play"
        data-act="voice-play"
        [disabled]="missing()"
        [attr.aria-label]="missing() ? 'Voice note not on this device' : (playing() ? 'Pause voice note' : 'Play voice note')"
        (click)="togglePlay()"
      >
        <bb-icon [name]="playing() ? 'pause' : 'play'" />
      </button>
      <div
        class="vn-track"
        role="progressbar"
        aria-label="Voice note progress"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="length()"
        [attr.aria-valuenow]="position()"
      >
        <div class="vn-fill" [style.width.%]="fillPercent()"></div>
      </div>
      <span class="vn-time num">{{ playing() ? voiceTime(position()) : voiceTime(length()) }}</span>
      <button
        type="button"
        class="vn-speed"
        data-act="voice-speed"
        [attr.aria-label]="'Play speed, ' + rate() + 'x'"
        (click)="cycleRate()"
      >
        <span class="vn-pill num">{{ rate() }}x</span>
      </button>
    </div>
  `,
  styles: `
    .vn-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-width: 200px;
      max-width: 300px;
      min-height: 44px;
    }
    .vn-play {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--brand);
      color: var(--on-accent);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      --ico: 18px;
    }
    .vn-play:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .mine .vn-play {
      background: var(--brand-dark);
    }
    .vn-track {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: var(--line-2);
      position: relative;
      overflow: hidden;
    }
    .vn-fill {
      height: 100%;
      background: var(--brand);
      border-radius: 2px;
    }
    .vn-time {
      font-size: 12px;
      color: var(--muted);
      min-width: 34px;
      text-align: right;
    }
    .vn-speed {
      min-width: 44px;
      min-height: 44px;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .vn-pill {
      height: 28px;
      border-radius: 999px;
      background: var(--surface-2);
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-2);
      padding: 0 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    @media (hover: hover) {
      .vn-play:not(:disabled):hover {
        background: var(--brand-dark);
      }
      .mine .vn-play:not(:disabled):hover {
        background: var(--brand);
      }
      .vn-speed:hover .vn-pill {
        background: var(--line-2);
      }
    }
  `,
  host: {
    '[class.mine]': 'mine()'
  }
})
export class VoiceNoteComponent implements OnDestroy {
  readonly voiceTime = voiceTime;
  slug = input.required<string>();
  media = input.required<string>();
  secs = input<number>(0);
  mine = input<boolean>(false);

  playing = signal(false);
  position = signal(0);
  rate = signal(1);
  /* hand fix, Claude: this started true and nothing ever cleared it, so every voice note was disabled. It now asks the
     store once the inputs are known. */
  missing = signal(false);
  constructor() {
    effect(() => { const s = this.slug(), m = this.media(); mediaUrl(s, m).then(u => this.missing.set(!u)); });
  }

  private audio: HTMLAudioElement | null = null;
  private static activeAudio: HTMLAudioElement | null = null;

  readonly length = computed(() => {
    const s = this.secs();
    return s > 0 ? s : 0;
  });

  readonly fillPercent = computed(() => {
    const len = this.length();
    if (len === 0) return 0;
    return Math.min(100, (this.position() / len) * 100);
  });

  async togglePlay(): Promise<void> {
    if (this.missing()) return;

    if (this.playing()) {
      this.audio?.pause();
      return;
    }

    if (!this.audio) {
      const url = await mediaUrl(this.slug(), this.media());
      if (!url) {
        this.missing.set(true);
        return;
      }
      this.audio = new Audio(url);
      this.audio.preload = 'metadata';
      this.audio.playbackRate = this.rate();

      this.audio.addEventListener('timeupdate', () => {
        this.position.set(this.audio?.currentTime ?? 0);
      });
      this.audio.addEventListener('pause', () => {
        this.playing.set(false);
      });
      this.audio.addEventListener('ended', () => {
        this.playing.set(false);
        this.position.set(0);
      });
    }

    if (VoiceNoteComponent.activeAudio && VoiceNoteComponent.activeAudio !== this.audio) {
      VoiceNoteComponent.activeAudio.pause();
    }
    VoiceNoteComponent.activeAudio = this.audio;

    this.audio.playbackRate = this.rate();
    await this.audio.play();
    this.playing.set(true);
  }

  cycleRate(): void {
    const next = this.rate() === 1 ? 1.5 : this.rate() === 1.5 ? 2 : 1;
    this.rate.set(next);
    if (this.audio) {
      this.audio.playbackRate = next;
    }
  }

  ngOnDestroy(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
      if (VoiceNoteComponent.activeAudio === this.audio) {
        VoiceNoteComponent.activeAudio = null;
      }
    }
  }
}
