Write the COMPLETE contents of one new file: apps/web/src/app/core/work-remote.ts. Output ONLY one ```ts code block.

THE APP: The Hub, Angular 19, TypeScript strict. This file is a plain TypeScript class, NO Angular decorator. Its only import:
import { Msg, MsgRef, WorkTask, WorkPost, WorkBook, Side, TaskStage, PostTone } from './work-models';
(Import only the names the code actually uses: the build runs with noUnusedLocals.)

WHAT IT IS: the app's client for the workspace server. Every call carries the signed token. The server stamps every write
with the signed in person, so this class never sends a name, side or role.

EXPORTS, exactly:
export interface Me { name: string; role: string; side: Side; }
export type NewTask = { fromMsg: string } | { title: string; for: Side; due?: string; who?: string; files?: string[] };
export type TaskChange = { stage: TaskStage } | { title?: string; due?: string; who?: string } | { accept: { who?: string; due?: string } }
  | { outside: string } | { late: { reason: string; newDue: string } };
export interface PostBody { caption: string; head: string; line?: string; tone?: PostTone; art?: string; }
export type NewPost = PostBody & { platform: 'Instagram' | 'Facebook' | 'TikTok'; kind: 'Post' | 'Carousel' | 'Reel'; slot: string; decideBy?: string };
export type PostAct = { answer: 'approved' | 'change'; v: number; text?: string; voice?: { file: string; secs: number } }
  | { version: PostBody } | { status: 'planned' | 'live'; slot?: string };
export class WorkRemote {
  constructor(api: string, slug: string, token: () => string, onAuthLost: () => void)
  book(): Promise<WorkBook & { me: Me }>                           GET    /work
  one(kind: 'msg' | 'task' | 'post', id: string): Promise<Msg | WorkTask | WorkPost | null>   GET /work/one?kind=..&id=.. (404 -> null)
  send(body: { text?: string; photos?: string[]; voice?: { file: string; secs: number }; reply?: string; ref?: MsgRef }): Promise<Msg>   POST /work/msgs
  seen(ids: string[]): Promise<number>                             POST   /work/seen      answer { seen }
  addTask(body: NewTask): Promise<WorkTask>                        POST   /work/tasks
  patchTask(id: string, body: TaskChange): Promise<WorkTask>       PATCH  /work/tasks/<id>
  removeTask(id: string): Promise<void>                            DELETE /work/tasks/<id>
  addPost(body: NewPost): Promise<WorkPost>                        POST   /work/posts
  actOnPost(id: string, body: PostAct): Promise<WorkPost>          POST   /work/posts/<id>
  upload(blob: Blob, kind: 'photo' | 'voice' | 'art', secs?: number): Promise<string>   the new file's id
  fileUrl(id: string): Promise<string>                             GET    /work/files/<id>   answer { url }
}

RULES:
- Every address is `${api}/api/${encodeURIComponent(slug)}/work` + the path above. Headers: 'Content-Type': 'application/json'
  and Authorization: 'Bearer ' + token(). A body is JSON.stringify(body).
- fetch failing to reach the server throws new Error('Could not reach the Hub. Check the signal and try again.').
- 401 calls onAuthLost() then throws new Error('401').
- Any other answer that is not ok throws new Error(answer.error) when the answer is JSON with an error string, else
  new Error('The Hub could not save that. Try again.').
- 204 resolves with nothing. one() resolves null on 404.
- upload: mime = blob.type.split(';')[0].trim(), or 'audio/webm' for a voice note and 'image/jpeg' otherwise when empty.
  POST /work/files with { kind, mime, bytes: blob.size, secs } (secs only for a voice note). The answer is
  { id, upload: { url } }. The upload url may be absolute (starts with 'http') or a path on the API (then prefix api).
  PUT the blob to it with the header 'Content-Type': mime (no Authorization header on this one: the link is signed). A PUT
  that is not ok throws new Error('That file did not upload. Try again.'). Resolve the id.
- fileUrl keeps each answer in a Map for 50 minutes (the server signs links for an hour) and answers from the Map inside that
  time. The time is Date.now(): this file is not a component, so it may read the clock.
- No `any`. JSON answers are read as unknown and narrowed, or cast to the documented type.

Start the file with this comment, word for word:
/* THE WORKSPACE SERVER CLIENT (Stage 2, 25 Oct 2026). One method per route of /api/<slug>/work. The server stamps every
   write with the signed in person and enforces who may do what, so nothing here sends a name, a side or a role. */
