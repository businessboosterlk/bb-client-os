Write the COMPLETE contents of one new file: apps/web/src/app/ui/photo-grid.component.ts. Output ONLY one ```ts code block.

{{COMMON}}

WHAT IT IS: the photos inside a chat bubble or a task, laid out like WhatsApp: one big, two side by side, three as one tall
on the left and two stacked on the right, four or more as a two by two grid where the fourth tile says "+N" over the photo
when more than four were sent.

IMPORTS: Component, effect, input, output, signal from '@angular/core'; import { mediaUrl } from '../core/media';
  mediaUrl(slug, id): Promise<string> gives an address for an <img src> ('' when the file is missing).

THE COMPONENT, EXACTLY: selector 'bb-photo-grid', class PhotoGridComponent, standalone, imports [] (an empty array).
  slug = input.required<string>(); ids = input.required<string[]>(); open = output<number>();
  urls = signal<Record<string, string>>({}). An effect reads slug() and ids() and, for each id not yet in urls, awaits
  mediaUrl and sets urls to a new object with that id added (never mutate the old object).
  shown(): the first four ids. more(): the count beyond four (0 when four or fewer).

THE LAYOUT: a div class "pg" with a class for the count: "n1", "n2", "n3" or "n4" (four or more). display grid, gap 3px,
  border-radius var(--r) (12px), overflow hidden, width 100%, max-width 280px.
  n1: one tile, aspect-ratio 4 / 3. n2: two columns, each tile aspect-ratio 1. n3: two columns and two rows, the first tile
  spans both rows (grid-row: span 2), the grid itself aspect-ratio 1. n4: two by two, each tile aspect-ratio 1.
  Each tile is <button type="button" class="pg-t" data-act="photo-open" (click)="open.emit(i)"> with padding 0, border 0,
  background var(--surface-2), position relative, display block, width 100%, height 100%, min-height 44px, holding
  <img [src]="url" alt="" loading="lazy" decoding="async"> filling the tile with object-fit cover (only when the url is
  known; until then the tile stays the plain surface). aria-label "Open photo {i + 1} of {total}".
  On the fourth tile when more() > 0: a span class "pg-more" covering the tile (position absolute, inset 0, display grid,
  place-items centre, background var(--ink) at opacity .55 is NOT allowed as a colour trick, so instead: background
  color-mix(in srgb, var(--ink) 55%, transparent), colour var(--bg), 22px weight 700) with "+{more()}".
  :active on a tile sets opacity .85 for 120ms.
