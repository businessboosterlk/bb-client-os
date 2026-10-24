Write the COMPLETE contents of one new file: apps/web/src/app/pages/work/tasks.component.ts. Output ONLY one ```ts code block.

{{COMMON}}
(This screen MAY use FormsModule and [(ngModel)] for its form fields, like the reference files below.)

WHAT IT IS: the tasks between a client and their marketing agency, Business Booster, both ways: "For you" (the client's
to do) and "For us" (what the client asked of the agency). One switch for For you / For us, one switch for Board / List,
both remembered on the device. Three stages only: To do, Doing, Done. The client moves only its own For you tasks; the
agency's stages belong to the agency. A request For us is a request, not a promise, until the team accepts it with a
person and a date, or says it is outside the package. Overdue is honest: the original date in red, and from the team a
reason and a new date.

COPY THE PATTERNS OF THESE TWO FILES OF THE SAME APP (pasted at the end): pipeline.component.ts (board with CDK drag and
a 220ms touch delay, list, the Board/List switch in a .seg, the filter bar, windows of 15 per column and 30 per list) and
follow-ups.component.ts (the tick, the sheets: add, view, Edit through the sheet head, Save changes and Cancel, drafts are
NOT needed here, the address that carries an order is spent once). Use the same global classes they use (ph, ph-right,
seg, board, col, col-h, col-t, col-n, col-b, col-empty, col-more, dc, dc-sub, dc-meta, card list, li, tx, tick, empty,
skel, sheet-pills, facts, f, form-grid, field, span, hint).

IMPORTS: Component, inject, computed, signal, effect, OnInit, OnDestroy from '@angular/core'; ActivatedRoute, Router from
'@angular/router'; FormsModule from '@angular/forms'; CdkDragDrop, DragDropModule from '@angular/cdk/drag-drop';
import { WorkService, todayStr } from '../../core/work.service'; import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service'; import { AskService } from '../../core/ask.service';
import { STAGES, canMove, isLate, isOverdue, needsReason, requestState, dueOf, summary } from '../../core/work';
import type { WorkTask, TaskStage, Side } from '../../core/work-models';
DrawerComponent from '../../ui/drawer.component'; IconComponent from '../../ui/icon.component';
FilterBarComponent and type FilterDef from '../../ui/filter-bar.component'; MoreComponent and WINDOW from '../../ui/more.component';
PhotoGridComponent from '../../ui/photo-grid.component'; WorkSoonComponent from '../../ui/work-soon.component'.

WHAT THEY GIVE YOU:
  WorkService (public work): available(), init(), slug(), me() { name, role }, tasks() WorkTask[], msg(id) Msg | null,
    canEdit(t) boolean, moveTask(id, stage) WorkTask | null, updateTask(id, { title?, due?, who? }) WorkTask | null,
    removeTask(id) boolean, addTask({ title, for, due?, who?, files? }) Promise<WorkTask | null>,
    comment({ kind: 'task', id }, text) Msg | null.
  todayStr() 'YYYY-MM-DD'. CastService: cast()?.users { name, role }[] (the client's seats). DataService: toast(text).
  AskService: confirm({ title, body, yes, danger }) Promise<boolean>.
  STAGES [{ key: 'todo', label: 'To do' }, { key: 'doing', label: 'Doing' }, { key: 'done', label: 'Done' }].
  canMove(t, 'client'), isLate(t, today), isOverdue(t, today), needsReason(t, today), requestState(t) 'asked' | 'outside'
  | 'accepted' | 'none', dueOf(t), summary(msg) one line for a message.
  WorkTask { id, title, for: 'client' | 'bb', who?, due?, stage, files: string[], source?, asked?, outside?,
    late?: { reason, newDue }, by, createdAt, updatedAt, doneAt? }.
  <bb-photo-grid [slug] [ids] (open)>; <bb-work-soon what="tasks"/> when !work.available().

THE COMPONENT: selector 'bb-work-tasks', class WorkTasksComponent, standalone.
  side = signal<Side>(stored 'hub_work_tasks_for' or 'client'); view = signal<'board' | 'list'>(stored
  'hub_work_tasks_view' or 'board'); both written to localStorage on change (wrapped in try).
  q, f (filter state, key 'show': '' open | 'late' | 'done' | 'all'), shown (WINDOW), colShown per stage (15).
  rows = computed: tasks of side(), filtered by show (open = stage not done; late = isLate; done; all) and the words of q
    in title or who, sorted: not done first, then by dueOf ascending (no date last).
  columns = computed: STAGES each with its tasks from rows (show filter ignored on the board except the words).
  counts for the header: forYou (for client and not done), forUs (for bb and not done).
  The address: query params 'for' (client or bb), 'view', 'open' (a task id), 'add' (1) are each acted on and then removed
    from the address with router.navigate([], { queryParams: { for: null, view: null, open: null, add: null },
    queryParamsHandling: 'merge', replaceUrl: true }) BEFORE acting, like spend() in follow-ups.component.ts. Opening a
    task by id also switches side() to that task's side.

THE TEMPLATE:
  @if (!work.available()) { <bb-work-soon what="tasks"/> } @else {
  .ph: h1 "Tasks", p: "{forYou} for you · {forUs} for us" ; .ph-right holds:
    a .seg role group aria-label "Whose tasks" with buttons data-act "wtask-side-client" ("For you") and "wtask-side-bb"
    ("For us") with aria-pressed; a .seg aria-label "View" with data-act "wtask-view-board" (board icon, "Board") and
    "wtask-view-list" (list icon, "List"); a button class "btn" data-act "wtask-new" with plus icon and "New task".
  <bb-filter-bar [state]="f" [query]="q" [defs]="defs" placeholder="Search tasks" label="Search tasks" [count]="rows().length"
    noun="task" nouns="tasks" store="work-tasks"/> where defs is [{ key: 'show', label: 'Show', all: 'Open tasks',
    options: [{ value: 'late', label: 'Late' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'Every task' }] }].
  Under it, only when side() is 'bb': a p class "t-small" "Asked means waiting for the team to accept it with a person and
    a date. The team moves its own tasks."
  BOARD (cdkDropListGroup): one section.col per stage with .col-h (.col-t with the label, .col-n with the count) and a
    .col-b cdkDropList [cdkDropListData]="col.key" (cdkDropListDropped)="drop($event)". Each task a
    <button type="button" class="dc" data-act="wtask-open" cdkDrag [cdkDragData]="t" [cdkDragDisabled]="!canMove(t, 'client')"
    [cdkDragStartDelay]="touch ? 220 : 0" (click)="open(t)"> with: strong title; .dc-sub with meta(t); a .dc-meta line of
    pills: requestState 'asked' a "pill quoted" "Asked"; 'outside' a "pill quoted" "Outside the package"; isLate a "pill over"
    "Late"; files a small span with <bb-icon name="clip"/> and the count; source a <bb-icon name="chat"/> with aria-label
    "From the chat". Empty column: .col-empty "Nothing here". More: button data-act "wtask-column-more".
    drop(e): when the stage differs and canMove(task, 'client') call work.moveTask; when it cannot move, data.toast('The
    team moves its own tasks. Ask in the chat if something should change.').
  LIST: .card.list of .li rows; For you rows start with the tick button (data-act "wtask-tick", like follow ups, toggling
    done and todo through work.moveTask, aria-pressed and an aria-label "Mark done: {title}" or "Mark not done: {title}");
    then <button type="button" class="tx" data-act="wtask-open"> with strong title and span meta(t); then the stage
    pill ("pill" plus "won" when done, "new" when doing) with the stage label. Late shows "pill over" "Late" instead.
    Empty: .empty with "Nothing here" and "Add a task and it lands here." (or "No match" / "Try another word or clear the
    filters." when filtered). <bb-more> for the window.
  meta(t): joined with " · ": who (or "Nobody yet" for For us tasks with no who), the date: when t.late "New date {niceDate(newDue)}"
    else when due "By {niceDate(due)}", and "Done {niceDate(doneAt)}" when done.

  THE TASK SHEET <bb-drawer [open]="!!sel()" [title]="sel()?.title || ''" [editable]="!!sel() && work.canEdit(sel()!) && !editing()"
    [message]="editing() ? emsg() : ''" (edit)="beginEdit()" (closed)="closeSheet()">
    body when not editing: .sheet-pills with the stage pill and the request or late pill; then a status line block
      (a div class "card note", padding 12px, margin 12px 0, 13.5px) only when one applies:
        asked: "Asked. Waiting for the team to accept it with a person and a date."
        outside: "Outside the package. " + t.outside
        late with t.late: "Late. " + t.late.reason + " New date " + niceDate(t.late.newDue) + "."
        needsReason: "Late. The team owes you a reason and a new date."
      then dl.facts with .f rows: "Who has it" (who, or "Nobody yet"), "Due" (when late: niceDate(newDue) then a span class
      "was" in var(--red) " · was " + niceDate(due); else niceDate(due) or "No date"), "Stage" (label), "Files" (span f with
      <bb-photo-grid [slug]="work.slug()" [ids]="t.files"/> when there are files, else "None"), "From" (when t.source has a
      message: summary of it and a <button type="button" class="btn ghost sm" data-act="wtask-source"> "Open in the chat"
      navigating to '/chat' with queryParams { msg: t.source }; else "Added here"), "Made by" (t.by + " · " + niceDate(t.createdAt)).
      Then a comment row: <div class="say"><input id="wt-say" type="text" placeholder="Say something about this task"
      aria-label="Say something about this task" [(ngModel)]="say" enterkeyhint="send"><button type="button" class="btn soft"
      data-act="wtask-comment" (click)="comment(t)">Send</button></div> (flex, gap 8px, margin-top 14px, input min-height 44px,
      flex 1, border 1px solid var(--line-2), radius 10px, padding 8px 12px, background var(--surface), font-size 15px and 16px
      on a coarse pointer). comment(): work.comment({ kind: 'task', id }, say); say = ''; data.toast('Sent to the chat').
    body when editing: .form-grid with "What needs doing" (input id "wt-e-title"), "By when" (date id "wt-e-due"), and for For
      you tasks "Who" (select id "wt-e-who": the seats, plus "Anyone" value ''). Save refuses an empty title with the message
      "A task needs its words. Put them back to save." in emsg.
    foot when editing: <button class="btn" data-act="wtask-save">Save changes</button> and <button class="btn quiet"
      data-act="wtask-edit-cancel">Cancel</button>.
    foot when not editing, For you: stage todo: primary "Start" (data-act "wtask-start", to doing) and soft "Mark done"
      (data-act "wtask-done"); stage doing: primary "Mark done" (data-act "wtask-done") and soft "Back to To do" (data-act
      "wtask-undo"); stage done: primary "Back to To do" (data-act "wtask-undo"). Then, when work.canEdit(t), a quiet warn
      "Remove" (data-act "wtask-remove", asks first: title "Remove this task?", body the title, yes "Remove", danger).
      Every stage change toasts ("Started", "Done", "Back to To do") and closes the sheet.
    foot when not editing, For us: when asked and work.canEdit(t): a quiet warn "Withdraw the request" (data-act
      "wtask-remove", asks first: title "Withdraw this request?", yes "Withdraw", danger); always a quiet "Close" (data-act
      "wtask-close").

  THE ADD SHEET <bb-drawer [open]="adding()" title="New task" [message]="msg()" (closed)="adding.set(false)">
    body: .form-grid with "What needs doing" (input id "wt-title", span, placeholder "Send the price list"), a field "For"
      holding a .seg with two buttons data-act "wtask-add-side-client" ("For you") and "wtask-add-side-bb" ("For us"),
      aria-pressed, "By when" (date id "wt-due"), and for For you "Who" (select id "wt-who", the seats, default the signed
      in seat). Under the grid, for For us: a p class "t-small" "The team will accept it with a person and a date, or tell
      you if it is outside your package." Photos: a label class "btn ghost sm" data-act "wtask-add-photo" holding
      <bb-icon name="camera"/>, the words "Add photos" (or "{n} photos added") and an input type file accept image/*
      multiple class "sr-only" aria-label "Add photos".
    foot: primary "Add task" (data-act "wtask-add"), quiet "Cancel" (data-act "wtask-add-cancel"). An empty title is refused
      with "Write what needs doing first." in msg and the title field focused. On success: toast "Task added" (For you) or
      "Asked of the team" (For us), close, switch side() to the new task's side.
  }
  touch = matchMedia('(pointer:coarse)').matches, read once in a field.
