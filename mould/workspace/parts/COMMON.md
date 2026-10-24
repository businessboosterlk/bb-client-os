THE APP: The Hub, Angular 19, standalone components, signals, the new control flow (@if, @for with track, @else).
No NgIf, no NgFor, no CommonModule, no other library. Template and styles inline in the component. TypeScript strict.

HOUSE RULES FOR EVERY UI PART (the check tests them):
- Icons ONLY as <bb-icon name="..."/> (import { IconComponent } from '<relative path>/ui/icon.component'). Never type an
  <svg>. Size an icon with the CSS variable --ico (for example --ico:18px), never width or height on bb-icon.
  Icon names available: chat send mic stop pause play camera photos reply ticks check tasks hand approve voice clip late
  undo info x plus edit chev back clock alert post video doc board list wa more trash ext.
- Colours ONLY from these CSS variables (they flip for night mode): --bg --surface --surface-2 --line --line-2 --ink
  --ink-2 --muted --faint --brand --brand-dark --brand-soft --brand-soft-2 --brand-text (the brand colour safe for words)
  --on-accent (words on a --brand fill) --green --green-soft --amber --amber-soft --red --red-soft --blue --blue-soft.
  Radii --r-s (8px) --r (12px) --r-l (16px). Easing var(--ease). No hex, rgb or named colours in your styles.
- Global classes you may use: card (surface, hairline, radius), btn (the main button, brand fill), btn ghost, btn soft,
  btn quiet, btn sm, pill, pill won (green), pill quoted (amber), pill new (blue), pill over (red), num (tabular figures),
  t-small (small muted text). Font is inherited, never set font-family.
- EVERY element a finger can press (button, a, label acting as a button) carries data-act="<part>-<what>" with the exact
  name the brief gives. Buttons are <button type="button">. An icon-only button carries an aria-label.
- Every tap target at least 44px tall on a phone (min-height:44px, or a 44px box). Text never smaller than 11px. Single
  line text that can be long: overflow:hidden;text-overflow:ellipsis;white-space:nowrap.
- No box-shadow on cards, no gradient, no decorative bar or dash before a heading or label, no uppercase, no emoji.
  Hover styles only inside @media (hover:hover). Motion only on a state the person caused, 120 to 240ms, var(--ease),
  and none under @media (prefers-reduced-motion:reduce).
- Words in British English, plain and short. NO em dash or en dash anywhere, no comma before "and", "or", "but", "nor".
  Join short facts on one line with " · ".
- No Date.now(), no new Date() without an argument inside a component: the time comes in through an input.
- No `any`. Import only what the code uses (the build runs with noUnusedLocals).
- ANGULAR TRAPS THAT FAILED BUILDS: a template sees ONLY members of the class, so an imported function used in the
  template needs a class field (readonly voiceTime = voiceTime;). A signal is read as x() and written as x.set(v). An
  @Input that the template reads after a change must be a signal input (input()) or a setter; prefer input() and
  output() from '@angular/core' (read them as this.thing() in code and thing() in the template).
- LEARNED ON THIS BUILD (24 Oct 2026), each one a fault a part shipped: never redeclare the app's global classes (ph,
  ph-right, seg, board, col, card, list, li, empty, field, pill, btn, t-small) in a component's styles; a ViewChild is read
  in ngAfterViewInit, never ngOnInit; a signal that says something is missing or refused starts false and is set from a
  real check; every <bb-drawer> body sits inside <ng-template #body> and its buttons inside <ng-template #foot>; a
  button's words carry their own colour (color:inherit or a token), never the browser's default; a file picker keeps the
  File objects, never their names.
