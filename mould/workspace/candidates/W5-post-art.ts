import { Component, input, computed } from '@angular/core';
import type { PostVersion } from '../core/work-models';

@Component({
  selector: 'bb-post-art',
  standalone: true,
  imports: [],
  template: `
    <div
      class="art {{ version().tone }}"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      <div class="top">
        <span class="pill">{{ kindLabel() }}</span>
      </div>
      <div class="middle">
        <h4 class="art-h">{{ version().head }}</h4>
        @if (version().line) {
          <p class="art-l">{{ version().line }}</p>
        }
      </div>
      <div class="bottom">{{ business() }}</div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
      width: 100%;
    }

    .art {
      aspect-ratio: 4 / 5;
      border-radius: var(--r);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 7cqw;
    }

    .art.brand {
      background: var(--brand);
      color: var(--on-accent);
    }

    .art.ink {
      background: var(--ink);
      color: var(--bg);
    }

    .art.cream {
      background: var(--brand-soft);
      color: var(--brand-text);
    }

    .top {
      align-self: flex-start;
    }

    .pill {
      font-size: 3.4cqw;
      font-weight: 700;
      padding: 0.6cqw 2.2cqw;
      border-radius: 999px;
      border: 1px solid currentColor;
      opacity: 0.85;
      display: inline-block;
    }

    .art-h {
      font-size: 9.5cqw;
      line-height: 1.02;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
      text-wrap: balance;
      overflow-wrap: anywhere;
    }

    .art-l {
      font-size: 4.2cqw;
      line-height: 1.3;
      margin: 3cqw 0 0;
      opacity: 0.85;
      max-width: 80%;
    }

    .bottom {
      font-size: 3.6cqw;
      font-weight: 600;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class PostArtComponent {
  version = input.required<PostVersion>();
  kind = input<string>('Post');
  business = input<string>('');

  readonly kindLabel = computed(() => {
    const base = this.kind();
    return base === 'Carousel' ? `${base} · 1 of 3` : base;
  });

  readonly ariaLabel = computed(() => {
    const head = this.version().head;
    const line = this.version().line;
    return line ? `${this.kind()}: ${head}. ${line}` : `${this.kind()}: ${head}`;
  });
}
