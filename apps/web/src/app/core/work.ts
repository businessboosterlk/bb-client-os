/* THE WORKSPACE RULES, pure: every time comes in as an argument. Built by BB Crew (part W1, DeepSeek V4 Flash, 24 Oct 2026)
   from mould/workspace/parts/W1-rules.md and judged by mould/workspace/checks/w1-rules.mjs. */
import type { Msg, WorkTask, WorkPost, WorkBook, NeedItem, TaskStage, PostStatus, PostVersion, Side } from './work-models';

export const STAGES: { key: TaskStage; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
];

export const POST_STAGES: { key: PostStatus; label: string }[] = [
  { key: 'waiting', label: 'Waiting for you' },
  { key: 'planned', label: 'Planned' },
  { key: 'approved', label: 'Approved' },
  { key: 'live', label: 'Live' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date {
  return new Date(iso);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabelForDate(d: Date, now: Date): string {
  if (sameDate(d, now)) return 'Today';
  const yesterday = addDays(now, -1);
  if (sameDate(d, yesterday)) return 'Yesterday';
  const base = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  if (d.getFullYear() !== now.getFullYear()) {
    return `${base} ${d.getFullYear()}`;
  }
  return base;
}

export function dueOf(t: WorkTask): string | undefined {
  if (t.late) return t.late.newDue;
  return t.due;
}

export function isLate(t: WorkTask, today: string): boolean {
  if (t.stage === 'done' || !t.due) return false;
  return t.due < today;
}

export function isOverdue(t: WorkTask, today: string): boolean {
  if (t.stage === 'done') return false;
  const due = dueOf(t);
  if (!due) return false;
  return due < today;
}

export function needsReason(t: WorkTask, today: string): boolean {
  return t.for === 'bb' && isLate(t, today) && !t.late;
}

export function canMove(t: WorkTask, side: Side): boolean {
  if (t.asked || t.outside) return false;
  if (side === 'client') return t.for === 'client';
  return true;
}

export function requestState(t: WorkTask): 'asked' | 'outside' | 'accepted' | 'none' {
  if (t.for === 'client') return 'none';
  if (t.asked) return 'asked';
  if (t.outside) return 'outside';
  return 'accepted';
}

export function taskFromMsg(m: Msg, now: string, seat: string): Omit<WorkTask, 'id'> {
  const forSide: Side = m.side === 'client' ? 'bb' : 'client';
  const asked = m.side === 'client' ? true : undefined;
  const files = m.photos ? [...m.photos] : [];
  let title: string;
  const text = m.text?.trim();
  if (text) {
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length > 80) {
      const cut = firstLine.lastIndexOf(' ', 80);
      title = cut > 0 ? firstLine.slice(0, cut).trim() : firstLine.slice(0, 80).trim();
    } else {
      title = firstLine;
    }
  } else if (m.photos && m.photos.length > 0) {
    title = m.photos.length === 1 ? `Photo from ${m.by}` : `Photos from ${m.by}`;
  } else if (m.voice) {
    title = `Voice note from ${m.by}`;
  } else {
    title = `Message from ${m.by}`;
  }
  return {
    title,
    for: forSide,
    stage: 'todo',
    files,
    source: m.id,
    by: seat,
    createdAt: now,
    updatedAt: now,
    ...(asked ? { asked } : {}),
  };
}

/* a post whose newest version already carries a change request is with the team, not waiting on the client (Claude, 24 Oct) */
export function changeAsked(p: WorkPost): boolean {
  const v = p.versions.length ? p.versions[p.versions.length - 1].v : 0;
  return (p.changes as { v: number }[]).some(c => c.v === v);
}

export function needs(book: WorkBook, today: string): NeedItem[] {
  const result: NeedItem[] = [];
  const waitingPosts = book.posts.filter(p => p.status === 'waiting' && !changeAsked(p)).length;
  if (waitingPosts > 0) {
    result.push({
      key: 'posts',
      kind: 'post',
      count: waitingPosts,
      label: waitingPosts === 1 ? '1 post to approve' : `${waitingPosts} posts to approve`,
      link: '/posts',
      params: { show: 'waiting' },
    });
  }
  const clientTasks = book.tasks.filter(t => t.for === 'client' && t.stage !== 'done').length;
  if (clientTasks > 0) {
    result.push({
      key: 'tasks',
      kind: 'task',
      count: clientTasks,
      label: clientTasks === 1 ? '1 task for you' : `${clientTasks} tasks for you`,
      link: '/tasks',
      params: { for: 'client' },
    });
  }
  return result;
}

export function needCount(book: WorkBook, today: string): number {
  return needs(book, today).reduce((sum, n) => sum + n.count, 0);
}

export function clockWord(iso: string): string {
  const d = parseIso(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? 'am' : 'pm';
  h = h % 12;
  if (h === 0) h = 12;
  if (m === 0) return `${h}${suffix}`;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

export function timeOfDay(iso: string): string {
  const d = parseIso(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dayLabel(iso: string, now: string): string {
  return dayLabelForDate(parseIso(iso), parseIso(now));
}

export function voiceTime(secs: number): string {
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function slotLine(p: WorkPost, now: string): string {
  const nowDate = parseIso(now);
  const slotDate = parseIso(p.slot);
  const w = DAY_NAMES[slotDate.getDay()];
  const c = clockWord(p.slot);
  const d = dayLabelForDate(slotDate, nowDate);
  if (p.status === 'waiting') {
    if (p.decideBy) {
      const decideDate = parseIso(p.decideBy);
      if (decideDate.getTime() > nowDate.getTime()) {
        let when: string;
        if (sameDate(decideDate, nowDate)) {
          when = 'today';
        } else if (sameDate(decideDate, addDays(nowDate, 1))) {
          when = 'tomorrow';
        } else {
          when = DAY_NAMES[decideDate.getDay()];
        }
        return `Approve by ${clockWord(p.decideBy)} ${when} to keep the ${w} ${c} slot`;
      }
      return `The ${w} ${c} slot has passed. We never post without your yes, so we will offer a new time.`;
    }
    return `Planned for ${d} at ${c}, once you say yes`;
  }
  if (p.status === 'planned') {
    return `Planned for ${d} at ${c}`;
  }
  if (p.status === 'approved') {
    if (p.approvedBy) {
      return `Approved by ${p.approvedBy}. Goes out ${d} at ${c}`;
    }
    return `Approved. Goes out ${d} at ${c}`;
  }
  return `Went out ${d} at ${c}`;
}

export function byDay(msgs: Msg[], now: string): { day: string; label: string; msgs: Msg[] }[] {
  const sorted = [...msgs].sort((a, b) => parseIso(a.at).getTime() - parseIso(b.at).getTime());
  const groups: { day: string; label: string; msgs: Msg[] }[] = [];
  for (const m of sorted) {
    const key = dateKey(parseIso(m.at));
    const last = groups[groups.length - 1];
    if (last && last.day === key) {
      last.msgs.push(m);
    } else {
      groups.push({ day: key, label: dayLabel(m.at, now), msgs: [m] });
    }
  }
  return groups;
}

export function latest(p: WorkPost): PostVersion {
  return p.versions[p.versions.length - 1];
}

export function postCounts(posts: WorkPost[]): Record<PostStatus, number> {
  const counts: Record<PostStatus, number> = { waiting: 0, planned: 0, approved: 0, live: 0 };
  for (const p of posts) {
    counts[p.status] += 1;
  }
  return counts;
}

/* the next post waiting for a yes; a post whose newest version already carries a change is with the team (Claude, 24 Oct) */
export function deckNext(posts: WorkPost[], currentId: string): WorkPost | null {
  const waiting = posts.filter(p => p.status === 'waiting' && p.id !== currentId && !changeAsked(p));
  if (waiting.length === 0) return null;
  return waiting.reduce((earliest, p) => {
    if (!earliest) return p;
    return parseIso(p.slot).getTime() < parseIso(earliest.slot).getTime() ? p : earliest;
  }, null as WorkPost | null);
}

export function summary(m: Msg): string {
  const text = m.text?.trim();
  if (text) {
    return text.split('\n')[0].trim();
  }
  if (m.photos && m.photos.length > 0) {
    return m.photos.length === 1 ? 'Photo' : `${m.photos.length} photos`;
  }
  if (m.voice) {
    return `Voice note ${voiceTime(m.voice.secs)}`;
  }
  return 'Message';
}
