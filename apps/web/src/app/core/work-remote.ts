/* THE WORKSPACE SERVER CLIENT (Stage 2, 25 Oct 2026). One method per route of /api/<slug>/work. The server stamps every
   write with the signed in person and enforces who may do what, so nothing here sends a name, a side or a role. */
import { Msg, MsgRef, WorkTask, WorkPost, WorkBook, Side, TaskStage, PostTone } from './work-models';

export interface Me { name: string; role: string; side: Side; }
export type NewTask = { fromMsg: string } | { title: string; for: Side; due?: string; who?: string; files?: string[] };
export type TaskChange = { stage: TaskStage } | { title?: string; due?: string; who?: string } | { accept: { who?: string; due?: string } }
  | { outside: string } | { late: { reason: string; newDue: string } };
export interface PostBody { caption: string; head: string; line?: string; tone?: PostTone; art?: string; }
export type NewPost = PostBody & { platform: 'Instagram' | 'Facebook' | 'TikTok'; kind: 'Post' | 'Carousel' | 'Reel'; slot: string; decideBy?: string };
export type PostAct = { answer: 'approved' | 'change'; v: number; text?: string; voice?: { file: string; secs: number } }
  | { version: PostBody } | { status: 'planned' | 'live'; slot?: string };

export class WorkRemote {
  private readonly base: string;
  private readonly root: string;
  private readonly fileCache = new Map<string, { url: string; expires: number }>();

  constructor(
    api: string,
    slug: string,
    private readonly token: () => string,
    private readonly onAuthLost: () => void
  ) {
    this.root = api;
    this.base = `${api}/api/${encodeURIComponent(slug)}/work`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.base}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + this.token(),
          ...(init?.headers ?? {})
        }
      });
    } catch {
      throw new Error('Could not reach the Hub. Check the signal and try again.');
    }

    if (response.status === 401) {
      this.onAuthLost();
      throw new Error('401');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (response.status === 404 && path.startsWith('/one')) {
      return null as T;
    }

    if (!response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text) as unknown;
        if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
          throw new Error((data as { error: string }).error);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'The Hub could not save that. Try again.') {
          throw e;
        }
      }
      throw new Error('The Hub could not save that. Try again.');
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  async book(): Promise<WorkBook & { me: Me }> {
    return this.request<WorkBook & { me: Me }>('');
  }

  async one(kind: 'msg' | 'task' | 'post', id: string): Promise<Msg | WorkTask | WorkPost | null> {
    return this.request<Msg | WorkTask | WorkPost | null>(`/one?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
  }

  async send(body: { text?: string; photos?: string[]; voice?: { file: string; secs: number }; reply?: string; ref?: MsgRef }): Promise<Msg> {
    return this.request<Msg>('/msgs', { method: 'POST', body: JSON.stringify(body) });
  }

  async seen(ids: string[]): Promise<number> {
    const data = await this.request<{ seen: number }>('/seen', { method: 'POST', body: JSON.stringify({ ids }) });
    return data.seen;
  }

  async addTask(body: NewTask): Promise<WorkTask> {
    return this.request<WorkTask>('/tasks', { method: 'POST', body: JSON.stringify(body) });
  }

  async patchTask(id: string, body: TaskChange): Promise<WorkTask> {
    return this.request<WorkTask>(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async removeTask(id: string): Promise<void> {
    await this.request<void>(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async addPost(body: NewPost): Promise<WorkPost> {
    return this.request<WorkPost>('/posts', { method: 'POST', body: JSON.stringify(body) });
  }

  async actOnPost(id: string, body: PostAct): Promise<WorkPost> {
    return this.request<WorkPost>(`/posts/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify(body) });
  }

  async upload(blob: Blob, kind: 'photo' | 'voice' | 'art', secs?: number): Promise<string> {
    let mime = blob.type.split(';')[0].trim();
    if (!mime) {
      mime = kind === 'voice' ? 'audio/webm' : 'image/jpeg';
    }

    const body: Record<string, unknown> = { kind, mime, bytes: blob.size };
    if (kind === 'voice' && secs !== undefined) {
      body['secs'] = secs;
    }

    const data = await this.request<{ id: string; upload: { url: string } }>('/files', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    let uploadUrl = data.upload.url;
    if (!uploadUrl.startsWith('http')) {
      uploadUrl = `${this.root}${uploadUrl}`;
    }

    let putResponse: Response;
    try {
      putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: blob
      });
    } catch {
      throw new Error('That file did not upload. Try again.');
    }

    if (!putResponse.ok) {
      throw new Error('That file did not upload. Try again.');
    }

    return data.id;
  }

  async fileUrl(id: string): Promise<string> {
    const cached = this.fileCache.get(id);
    if (cached && cached.expires > Date.now()) {
      return cached.url;
    }

    const data = await this.request<{ url: string }>(`/files/${encodeURIComponent(id)}`);
    /* memory mode signs a path on this API; the database signs a full address on the store */
    const url = data.url.startsWith('http') ? data.url : `${this.root}${data.url}`;
    this.fileCache.set(id, { url, expires: Date.now() + 50 * 60 * 1000 });
    return url;
  }
}
