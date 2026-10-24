Write the COMPLETE contents of one new file: apps/web/src/app/pages/work/posts.component.ts. Output ONLY one ```ts code block.

{{COMMON}}
(This screen MAY use FormsModule and [(ngModel)] for its one text field.)

WHAT IT IS: the client's posts from their marketing agency, Business Booster: Waiting for you, Planned, Approved, Live, as
a board and a list with one remembered switch. Opening a post shows its artwork, its version, its caption and its slot,
and the two answers: Approve, or Ask for a change (in words or a voice note). The client never edits the caption: a
change is a request so the version and the approval stay true. Silence is not approval: a missed slot says so. After an
answer, the next post waiting for a yes opens on its own, like a deck. A live post points at the client's Library.
Posts are made by the team, so there is no New button and no drag (a stage changes only by an answer).

COPY THE PATTERNS OF THE PIPELINE FILE pasted at the end (board columns, the .seg switch, the filter bar, list, windows).

IMPORTS: Component, inject, computed, signal, effect, OnInit, OnDestroy from '@angular/core'; ActivatedRoute, Router from
'@angular/router'; FormsModule from '@angular/forms';
import { WorkService } from '../../core/work.service'; import { CastService } from '../../core/cast.service';
import { DataService, niceDate } from '../../core/data.service';
import { POST_STAGES, latest, slotLine, deckNext, clockWord, voiceTime } from '../../core/work';
import { VoiceRecorder } from '../../core/media';
import type { WorkPost, PostStatus } from '../../core/work-models';
DrawerComponent, IconComponent, FilterBarComponent and type FilterDef, MoreComponent and WINDOW (same paths as in the
pipeline file under ../../ui/), PostArtComponent from '../../ui/post-art.component', VoiceNoteComponent from
'../../ui/voice-note.component', WorkSoonComponent from '../../ui/work-soon.component'.

WHAT THEY GIVE YOU:
  WorkService (public work): available(), init(), slug(), now() ISO string, posts() WorkPost[], post(id) WorkPost | null,
    changeAsked(p) boolean (the newest version already carries a change request: it is with the team),
    approve(id) WorkPost | null, askChange(id, text, voice?: { blob, secs }) Promise<WorkPost | null>,
    comment({ kind: 'post', id }, text).
  CastService: cast()?.short or cast()?.name (the business name for the artwork).
  WorkPost { id, platform, kind, slot, decideBy?, status, versions: { v, caption, head, line?, tone, at }[],
    changes: { at, by, v, text?, voice? }[], approvedBy?, approvedAt?, createdAt, updatedAt }.
  POST_STAGES [{ key: 'waiting', label: 'Waiting for you' }, planned Planned, approved Approved, live Live]; latest(p) the
  newest version; slotLine(p, now) the sentence under a post; deckNext(posts, id) the next post waiting, or null;
  clockWord(iso) '6pm'; voiceTime(secs) '0:07'. VoiceRecorder as in the media part: static supported(), start(),
  elapsed(), stop() { blob, secs }, cancel(). <bb-post-art [version] [kind] [business]/> draws the artwork at its width.
  <bb-voice-note [slug] [media] [secs]/> plays a stored voice note. <bb-work-soon what="posts"/> when !work.available().

THE COMPONENT: selector 'bb-work-posts', class WorkPostsComponent, standalone.
  view signal stored in 'hub_work_posts_view' (default 'board'). q, f (filter keys 'show' with the four statuses, and
  'platform' with Instagram, Facebook, TikTok). rows: posts filtered and searched (head, caption, platform), sorted by
  slot ascending for waiting and planned and approved, live newest first (sort live after the others). columns: the four
  POST_STAGES (only the chosen one when show is set) with their rows. waitingCount: waiting posts not changeAsked.
  The address: query params 'open' (a post id), 'show', 'view' are acted on and then removed (replaceUrl) BEFORE acting,
  like the pipeline. 'show' sets the filter.
  Sheet state: sel (WorkPost | null), asking (boolean), changeText (string), rec (boolean), recSecs (number, read from
  elapsed() every 250ms while recording), voice ({ blob, secs } | null), busy (boolean), deckNote (string).

THE TEMPLATE:
  @if (!work.available()) { <bb-work-soon what="posts"/> } @else {
  .ph: h1 "Posts", p: "{waitingCount} waiting for your yes" (or "1 waiting for your yes", or "Nothing waiting for your yes");
    .ph-right: .seg aria-label "View" with data-act "wpost-view-board" and "wpost-view-list" (Board / List with icons).
  <bb-filter-bar ... placeholder="Search posts" label="Search posts" noun="post" nouns="posts" store="work-posts"/>
  BOARD: section.col per column with .col-h (.col-t label, .col-n count); .col-b holds cards
    <button type="button" class="pc" data-act="wpost-open" (click)="open(p)"> (display grid, gap 8px, padding 10px,
    text-align left, width 100%, background var(--surface), border 1px solid var(--line), border-radius var(--r), margin-bottom
    8px): <bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()"/>, then a strong 13.5px (latest(p).head, two
    lines at most with -webkit-line-clamp 2), a span 12px var(--muted) "{platform} · {niceDate(slot)} at {clockWord(slot)}",
    and a pill row: "pill quoted" "Waiting for you" when waiting and not changeAsked, "pill new" "With the team" when
    changeAsked, "pill" "Version {v}" when v > 1. Empty column: .col-empty "Nothing here". Window 15 per column with a more
    button data-act "wpost-column-more". On a phone the columns behave like the pipeline's (the global .board styles).
  LIST: .card.list of .li rows: a 56px wide <bb-post-art> (wrapped in a div width 56px, flex none), then a
    <button type="button" class="tx" data-act="wpost-open"> with strong head and span "{platform} · {kind} · {niceDate(slot)}",
    then the status pill (waiting "pill quoted", planned "pill new", approved and live "pill won"). Empty and <bb-more> as in
    the pipeline.
  THE SHEET <bb-drawer [open]="!!sel()" [title]="sel() ? latest(sel()!).head : ''" [message]="msg()" (closed)="closeSheet()">
    body: when deckNote() is set, a p class "t-small" first with it (the words "Next post waiting for your yes.").
      <div class="big"><bb-post-art [version]="latest(p)" [kind]="p.kind" [business]="biz()"/></div> (max-width 360px,
      margin 0 auto 12px); .sheet-pills: the status pill, "Version {v}", the platform; a p class "slot" (14px weight 600;
      var(--red) when the slot line starts with "The " (a missed slot), else var(--ink)) with slotLine(p, work.now());
      then a section "Caption" (an h4 13px weight 600 var(--muted) "Caption", a p with white-space pre-wrap and the caption);
      then, when p.versions.length > 1 or p.changes.length, a section "History" (h4 "History") listing for each version,
      oldest first: "Version {v} · {niceDate(at)}" and under it each change asked on that version: "{by} asked: {text}" or
      "{by} sent a voice note" followed by <bb-voice-note [slug]="work.slug()" [media]="c.voice.media" [secs]="c.voice.secs"/>.
      When status is 'live': <a class="btn ghost sm" data-act="wpost-library" routerLink is NOT imported, so use (click) to
      router.navigate(['/library/posts'])> written as a <button type="button" class="btn ghost sm" data-act="wpost-library">
      "See it in your Library". When status is 'approved' and approvedBy: a p class "t-small" "Approved by {approvedBy} on
      {niceDate(approvedAt)}".
      When asking(): a field: label for "wp-change" "What should change?", a textarea id "wp-change" rows 3 [(ngModel)]="changeText"
      placeholder "Make the price bigger on the first slide" (16px on a coarse pointer); then the voice row: when not
      recording and no voice: a button class "btn ghost sm" data-act "wpost-voice-start" with mic icon "Record a voice note
      instead" (only when VoiceRecorder.supported()); while recording: a red 10px dot, "{voiceTime(recSecs())} Recording",
      a button class "btn soft sm" data-act "wpost-voice-stop" "Stop"; with a voice kept: "Voice note {voiceTime(secs)} ready"
      and a button class "btn quiet sm" data-act "wpost-voice-clear" "Remove". A failed microphone writes "The microphone is
      off for this app. Allow it in Settings to send a voice note." into msg.
      A comment row as in tasks when not asking: input id "wp-say" placeholder "Say something about this post", button
      data-act "wpost-comment" "Send", toast "Sent to the chat".
    foot:
      waiting and not changeAsked and not asking: primary <button class="btn" data-act="wpost-approve"><bb-icon name="approve"/>
        <span>Approve</span></button> and soft <button class="btn soft" data-act="wpost-change">Ask for a change</button>.
      asking: primary "Send the change" (data-act "wpost-change-send", refused with "Write what should change, or record a
        voice note." in msg when both are empty) and quiet "Cancel" (data-act "wpost-change-cancel").
      changeAsked: the msg input shows "Your change is with the team. The new version comes back here." and the foot has a
        quiet "Close" (data-act "wpost-close").
      every other status: a quiet "Close" (data-act "wpost-close").
    approve(): busy guard; work.approve(id); toast "Approved. It goes out as planned."; then deck().
    sendChange(): busy guard; await work.askChange(id, changeText, voice); toast "Change sent to the team"; then deck().
    deck(): const next = deckNext(work.posts(), id); when next: reset the sheet state, sel.set(next), deckNote.set('Next post
      waiting for your yes.'); else close the sheet.
    closeSheet() cancels any recording, clears the sheet state and sel.
  }
