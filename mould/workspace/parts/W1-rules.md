Write the COMPLETE contents of one new TypeScript file: apps/web/src/app/core/work.ts. Output ONLY one ```ts code block.

WHAT IT IS: the pure rules of a client workspace (chat, tasks, posts for approval) inside a Sri Lankan marketing agency's
client app. No Angular, no DOM, no storage, no network. Every function is pure: the current time always comes in as an
argument, never from the clock. Dates and times are read in LOCAL time (the device's time zone) with the ordinary Date
methods (getFullYear, getMonth, getDate, getDay, getHours, getMinutes).

THE FIRST LINE OF THE FILE, EXACTLY:
import type { Msg, WorkTask, WorkPost, WorkBook, NeedItem, TaskStage, PostStatus, PostVersion, Side } from './work-models';
Import nothing else. Use `import type` only (the file is also run by Node with types stripped).

THE TYPES (already written in work-models.ts, do NOT redeclare them):
  type Side = 'client' | 'bb';
  interface Msg { id: string; at: string; side: Side; by: string; role: string; text?: string; photos?: string[];
    voice?: { media: string; secs: number }; reply?: string; ref?: { kind: 'task' | 'post'; id: string }; event?: string; seen?: boolean; }
  type TaskStage = 'todo' | 'doing' | 'done';
  interface WorkTask { id: string; title: string; for: Side; who?: string; due?: string; stage: TaskStage; files: string[];
    source?: string; asked?: boolean; outside?: string; late?: { reason: string; newDue: string }; by: string;
    createdAt: string; updatedAt: string; doneAt?: string; }
  type PostStatus = 'waiting' | 'planned' | 'approved' | 'live';
  interface PostVersion { v: number; caption: string; head: string; line?: string; tone: 'brand' | 'ink' | 'cream'; at: string; }
  interface WorkPost { id: string; platform: string; kind: string; slot: string; decideBy?: string; status: PostStatus;
    versions: PostVersion[]; changes: unknown[]; approvedBy?: string; approvedAt?: string; createdAt: string; updatedAt: string; }
  interface WorkBook { msgs: Msg[]; tasks: WorkTask[]; posts: WorkPost[]; }
  interface NeedItem { key: string; kind: 'post' | 'task'; count: number; label: string; link: string; params?: Record<string, string>; }
  A task with for 'client' is shown as "For you"; for 'bb' is "For us" (the agency). Dates YYYY-MM-DD, times ISO strings.

EXPORT EXACTLY THESE, with these names and signatures:

export const STAGES: { key: TaskStage; label: string }[]  = To do (todo), Doing (doing), Done (done), in that order.
export const POST_STAGES: { key: PostStatus; label: string }[] = Waiting for you (waiting), Planned, Approved, Live, in that order.

export function dueOf(t: WorkTask): string | undefined   the new date when t.late is set, else t.due.
export function isLate(t: WorkTask, today: string): boolean   true when the task is not done and t.due (the ORIGINAL date) is
  before today (string compare of YYYY-MM-DD). Due today is not late. No date is never late.
export function isOverdue(t: WorkTask, today: string): boolean   not done and dueOf(t) is before today.
export function needsReason(t: WorkTask, today: string): boolean   t.for is 'bb', isLate(t, today) and no t.late.
export function canMove(t: WorkTask, side: Side): boolean   a person on side 'client' may move only tasks with for 'client';
  side 'bb' may move any task. Nobody may move a task that is asked or has outside set.
export function requestState(t: WorkTask): 'asked' | 'outside' | 'accepted' | 'none'   for 'client' tasks: 'none'.
  For 'bb' tasks: 'asked' when t.asked, else 'outside' when t.outside is set, else 'accepted'.
export function taskFromMsg(m: Msg, now: string, seat: string): Omit<WorkTask, 'id'>
  for: 'bb' when m.side is 'client' (a client's message becomes a request to the agency), else 'client'.
  asked: true when m.side is 'client', otherwise leave asked out (undefined).
  stage 'todo', files: a copy of m.photos or [], source: m.id, by: seat, createdAt: now, updatedAt: now. No id property.
  title: from m.text when it has words: the first line, trimmed; when longer than 80 characters, cut at the last space at
  or before character 80 and trimmed (no ellipsis, no dots added). With no words: one photo "Photo from {m.by}", several
  "Photos from {m.by}", a voice note "Voice note from {m.by}", otherwise "Message from {m.by}".
export function needs(book: WorkBook, today: string): NeedItem[]   at most two items, in this order, each only when its count
  is above zero:
  { key: 'posts', kind: 'post', count: waiting posts, label: '1 post to approve' or 'N posts to approve', link: '/posts', params: { show: 'waiting' } }
  { key: 'tasks', kind: 'task', count: tasks for 'client' not done, label: '1 task for you' or 'N tasks for you', link: '/tasks', params: { for: 'client' } }
  (today is accepted for later use; it does not change the counts.)
export function needCount(book: WorkBook, today: string): number   the sum of the counts in needs().
export function clockWord(iso: string): string   12 hour, no leading zero, minutes only when not zero: '3pm', '9:30am',
  '12pm' at noon, '12:05am' just after midnight.
export function timeOfDay(iso: string): string   24 hour 'HH:MM' with leading zeros, '09:05'.
export function dayLabel(iso: string, now: string): string   'Today' on the same local date as now, 'Yesterday' on the
  date before, otherwise the weekday, the day number and the month in full: 'Monday 19 October', with the year added
  after a space only when the year differs from now's: 'Wednesday 31 December 2025'. No commas.
export function voiceTime(secs: number): string   rounded to whole seconds, 'M:SS': 0 '0:00', 7 '0:07', 65 '1:05', 7.6 '0:08'.
export function slotLine(p: WorkPost, now: string): string   the sentence under a post. W = weekday name of the slot
  (Friday), C = clockWord(slot), D = 'Friday 23 October' (weekday, day, month; the year added only when it differs from
  now's), all in local time:
  status 'waiting' with decideBy after now: 'Approve by {clockWord(decideBy)} {when} to keep the {W} {C} slot', where when is
    'today' if decideBy is on now's date, 'tomorrow' if on the next date, else the weekday name of decideBy.
  status 'waiting' with decideBy at or before now: 'The {W} {C} slot has passed. We never post without your yes, so we will offer a new time.'
  status 'waiting' with no decideBy: 'Planned for {D} at {C}, once you say yes'
  'planned': 'Planned for {D} at {C}'
  'approved': 'Approved by {approvedBy}. Goes out {D} at {C}'  (when approvedBy is missing write 'Approved. Goes out {D} at {C}')
  'live': 'Went out {D} at {C}'
  Compare times with new Date(x).getTime().
export function byDay(msgs: Msg[], now: string): { day: string; label: string; msgs: Msg[] }[]   a sorted COPY (never sort
  the input in place) oldest first by at, grouped by local date; day is 'YYYY-MM-DD' (local), label is dayLabel(first at, now).
export function latest(p: WorkPost): PostVersion   the last item of p.versions.
export function postCounts(posts: WorkPost[]): Record<PostStatus, number>   every status present, zero when none,
  keys in the order waiting, planned, approved, live.
export function deckNext(posts: WorkPost[], currentId: string): WorkPost | null   among posts with status 'waiting' and id
  not equal to currentId, the one with the earliest slot; null when none.
export function summary(m: Msg): string   the first line of m.text trimmed when it has words; else one photo 'Photo',
  several 'N photos'; else a voice note 'Voice note ' + voiceTime(secs); else 'Message'.

RULES: TypeScript strict, no `any`, no classes, no default export, no console. Never write Date.now() and never new Date()
with no argument. Day and month names written as arrays in the file (English). British English in comments. Never write
an em dash or an en dash anywhere. Keep helper functions private (not exported) unless listed above.
