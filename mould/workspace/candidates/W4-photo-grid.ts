import { Component, effect, input, output, signal } from '@angular/core';
import { mediaUrl } from '../core/media';

@Component({
  selector: 'bb-photo-grid',
  standalone: true,
  imports: [],
  template: `
    <div class="pg" [class]="'n' + (shown().length > 3 ? 4 : shown().length)">
      @for (id of shown(); track id; let i = $index) {
        <button
          type="button"
          class="pg-t"
          data-act="photo-open"
          (click)="open.emit(i)"
          [attr.aria-label]="'Open photo ' + (i + 1) + ' of ' + ids().length"
        >
          @if (urls()[id]) {
            <img [src]="urls()[id]" alt="" loading="lazy" decoding="async" />
          }
          @if (i === 3 && more() > 0) {
            <span class="pg-more">+{{ more() }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      .pg {
        display: grid;
        gap: 3px;
        border-radius: var(--r);
        overflow: hidden;
        width: 100%;
        max-width: 280px;
      }

      .pg.n1 {
        grid-template-columns: 1fr;
      }

      .pg.n1 .pg-t {
        aspect-ratio: 4 / 3;
      }

      .pg.n2 {
        grid-template-columns: 1fr 1fr;
      }

      .pg.n2 .pg-t {
        aspect-ratio: 1;
      }

      .pg.n3 {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        aspect-ratio: 1;
      }

      .pg.n3 .pg-t:first-child {
        grid-row: span 2;
      }

      .pg.n3 .pg-t {
        aspect-ratio: auto;
      }

      .pg.n4 {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
      }

      .pg.n4 .pg-t {
        aspect-ratio: 1;
      }

      .pg-t {
        padding: 0;
        border: 0;
        background: var(--surface-2);
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        min-height: 44px;
        cursor: pointer;
      }

      .pg-t img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .pg-more {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--ink) 55%, transparent);
        color: var(--bg);
        font-size: 22px;
        font-weight: 700;
      }

      @media (hover: hover) {
        .pg-t:hover {
          opacity: 0.85;
        }
      }

      .pg-t:active {
        opacity: 0.85;
        transition: opacity 120ms var(--ease);
      }

      @media (prefers-reduced-motion: reduce) {
        .pg-t:active {
          transition: none;
        }
      }
    `,
  ],
})
export class PhotoGridComponent {
  slug = input.required<string>();
  ids = input.required<string[]>();
  open = output<number>();

  urls = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const slug = this.slug();
      const ids = this.ids();
      const current = this.urls();

      for (const id of ids) {
        if (!current[id]) {
          mediaUrl(slug, id).then((url) => {
            this.urls.set({ ...this.urls(), [id]: url });
          });
        }
      }
    });
  }

  shown(): string[] {
    return this.ids().slice(0, 4);
  }

  more(): number {
    return Math.max(0, this.ids().length - 4);
  }
}
