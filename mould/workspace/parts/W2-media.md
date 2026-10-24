Write the COMPLETE contents of one new TypeScript file: apps/web/src/app/core/media.ts. Output ONLY one ```ts code block.

WHAT IT IS: the place a client app keeps photos and voice notes as FILES in this browser (IndexedDB), never as text inside
a data row. One store for every client on the device; every key starts with the client's slug. No Angular, no imports.

THE DATABASE: indexedDB.open('hub_media', 1); on upgradeneeded create the object store 'files' (out of line keys). The key
of a file is `${slug}:${id}`. Open the database once and keep the promise in a module variable; when indexedDB is not
there every function still resolves (put returns the id, get returns null, url returns '').

EXPORT EXACTLY:
export function newMediaId(): string   'md' + a base 36 time part from performance.now and Math.random, 12 or more letters.
export async function putMedia(slug: string, blob: Blob, id?: string): Promise<string>   stores the blob under the id (a new
  one when none is given) and returns the id.
export async function hasMedia(slug: string, id: string): Promise<boolean>
export async function getMedia(slug: string, id: string): Promise<Blob | null>
export async function mediaUrl(slug: string, id: string): Promise<string>   an object URL for the blob, made ONCE per key and
  kept in a Map so the same file is never turned into two URLs; '' when there is no such file.
export async function removeMedia(slug: string, id: string): Promise<void>   also revokes and forgets its URL.
export async function clearMedia(slug: string): Promise<void>   removes every key that starts with `${slug}:` (walk the keys
  with a cursor or getAllKeys) and revokes their URLs.
export async function seedMedia(slug: string, id: string, href: string): Promise<void>   when the key is missing, fetch(href),
  and when the answer is ok store its blob under id. Any failure is swallowed (the demo still opens).
export async function shrinkImage(file: Blob, max = 1600, quality = 0.82): Promise<Blob>   draws the picture with
  createImageBitmap into a canvas no wider or taller than max (keep the proportion, never enlarge), and returns
  canvas.toBlob(type 'image/jpeg', quality). When anything fails, or the file is not an image, return the file unchanged.
export class VoiceRecorder
  static supported(): boolean   true when navigator.mediaDevices?.getUserMedia and window.MediaRecorder exist.
  get recording(): boolean
  async start(): Promise<void>   asks for the microphone ({ audio: true }), picks the first type MediaRecorder.isTypeSupported
    says yes to from 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm' (none: let the browser choose), collects the
    chunks from dataavailable, notes performance.now() as the start. A second start while recording does nothing.
  elapsed(): number   seconds since start while recording, else 0.
  async stop(): Promise<{ blob: Blob; secs: number }>   stops, waits for the recorder's stop event, builds one Blob of the
    chunks with the recorder's mimeType, stops every track of the stream (the red microphone light goes out), and returns
    the seconds rounded to one decimal (at least 0.5).
  cancel(): void   stops without keeping anything and stops every track.

RULES: TypeScript strict, no `any` (use unknown and narrow), no default export, no console. Never write Date.now().
Every transaction resolves on its complete event and rejects on error and abort; the public functions catch and fall
back as described so a failing store never breaks a screen. British English in comments. No em dash, no en dash.
