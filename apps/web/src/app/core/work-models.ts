/* THE WORKSPACE BETWEEN THE CLIENT AND BUSINESS BOOSTER: one record, in the app (mould/workspace/PLAN.md).
   Chat, tasks both ways and posts with approvals. Stage 1 keeps all of it in this browser (the demo); nothing here
   reaches the server until Thulaib says yes to the tables, the file store and a named person per seat.
   Photos and voice notes are FILES kept beside the rows (core/media.ts), never text inside a row. */

/* which side of the work a person or a task is on: the client's team, or Business Booster */
export type Side = 'client' | 'bb';

/* a message points at the task or post it talks about, and is then drawn as a card */
export interface MsgRef { kind: 'task' | 'post'; id: string; }
/* what a card says happened; a plain message has none */
export type MsgEvent = 'task-made' | 'task-accepted' | 'task-outside' | 'task-late' | 'task-done' | 'approved' | 'change' | 'comment';

export interface Msg {
  id: string;
  at: string;                 /* ISO time it was sent */
  side: Side;
  by: string;                 /* the person: a seat name for the client, a role for the team ("Social media manager") */
  role: string;               /* "Owner", "Sales", or "Business Booster" for the team */
  text?: string;
  photos?: string[];          /* media ids */
  voice?: { media: string; secs: number };
  reply?: string;             /* id of the message this answers */
  ref?: MsgRef;
  event?: MsgEvent;
  seen?: boolean;             /* client messages only: the team has seen it. Never recorded the other way round. */
}

export type TaskStage = 'todo' | 'doing' | 'done';
export interface WorkTask {
  id: string;
  title: string;
  for: Side;                  /* 'client' = For you, 'bb' = For us */
  who?: string;               /* who has it */
  due?: string;               /* YYYY-MM-DD */
  stage: TaskStage;
  files: string[];            /* media ids */
  source?: string;            /* id of the chat message it was made from */
  asked?: boolean;            /* a request the client made For us that the team has not accepted yet */
  outside?: string;           /* the team's answer when it is outside the package: why, in one line */
  late?: { reason: string; newDue: string };   /* the team's honest answer to an overdue task For us */
  by: string;                 /* who made it */
  createdAt: string; updatedAt: string; doneAt?: string;
}

export type PostStatus = 'waiting' | 'planned' | 'approved' | 'live';
export type PostTone = 'brand' | 'ink' | 'cream';
export interface PostVersion { v: number; caption: string; head: string; line?: string; tone: PostTone; at: string; }
export interface PostChange { at: string; by: string; v: number; text?: string; voice?: { media: string; secs: number }; }
export interface WorkPost {
  id: string;
  platform: 'Instagram' | 'Facebook' | 'TikTok';
  kind: 'Post' | 'Carousel' | 'Reel';
  slot: string;               /* ISO time it is planned to go out */
  decideBy?: string;          /* ISO time a yes must arrive by to keep the slot */
  status: PostStatus;
  versions: PostVersion[];    /* oldest first; the last one is the one being asked about */
  changes: PostChange[];
  approvedBy?: string; approvedAt?: string;
  createdAt: string; updatedAt: string;
}

export interface WorkBook { msgs: Msg[]; tasks: WorkTask[]; posts: WorkPost[]; }

/* the "needs your hand" strip at the top of the chat */
export interface NeedItem { key: string; kind: 'post' | 'task'; count: number; label: string; link: string; params?: Record<string, string>; }
