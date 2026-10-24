Write the COMPLETE contents of one new file: apps/web/src/app/ui/post-art.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the artwork of one social media post waiting for the client's yes, drawn from words (a type led graphic: a
big headline, a short line, the business name), so the demo shows real designed posts without photographs. It is shown
small on a board card and large in the post sheet, so every size is relative to its own width (container units).

IMPORTS: Component, input, computed from '@angular/core'; import type { PostVersion } from '../core/work-models';
  interface PostVersion { v: number; caption: string; head: string; line?: string; tone: 'brand' | 'ink' | 'cream'; at: string; }

THE COMPONENT, EXACTLY: selector 'bb-post-art', class PostArtComponent, standalone, imports [].
  version = input.required<PostVersion>(); kind = input<string>('Post'); business = input<string>('');
  The host is display block, container-type inline-size, width 100%.

THE LAYOUT: a div class "art" with the tone as a class ("brand", "ink" or "cream"), aspect-ratio 4 / 5, border-radius
  var(--r), overflow hidden, display flex, flex-direction column, justify-content space-between, padding 7cqw.
  Colours: brand: background var(--brand), colour var(--on-accent). ink: background var(--ink), colour var(--bg).
  cream: background var(--brand-soft), colour var(--brand-text).
  Top row: the kind word ("Post", "Carousel" or "Reel") in a pill: font-size 3.4cqw, weight 700, padding .6cqw 2.2cqw,
  radius 999px, border 1px solid currentColor, opacity .85, align-self flex-start. When the kind is "Carousel" add after the
  word " · 1 of 3" (exactly that text) inside the same pill.
  Middle: an h4 class "art-h" with version().head: font-size 9.5cqw, line-height 1.02, weight 700, letter-spacing -.02em,
  margin 0, text-wrap balance, overflow-wrap anywhere; then when version().line is set a p class "art-l": font-size 4.2cqw,
  line-height 1.3, margin 3cqw 0 0, opacity .85, max-width 80%.
  Bottom row: business() in font-size 3.6cqw weight 600 opacity .9, white-space nowrap, overflow hidden, text-overflow
  ellipsis.
  The div carries role="img" and an aria-label: "{kind}: {head}" (the line added after ". " when set).
