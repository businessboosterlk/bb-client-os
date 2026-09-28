import { Injectable, signal } from '@angular/core';

/* THE APP ASKS ITS OWN QUESTIONS. The browser's confirm and prompt boxes carry the site address,
   ignore the theme and freeze the page. One sheet asks instead: a yes or no, or a pick from a list. */
export interface Question { title: string; body?: string; yes?: string; no?: string; danger?: boolean; options?: string[]; }
@Injectable({ providedIn: 'root' })
export class AskService {
  readonly q = signal<Question | null>(null);
  private done?: (v: any) => void;
  confirm(q: Question): Promise<boolean> { return this.open(q).then(v => v === true); }
  choose(q: Question & { options: string[] }): Promise<string | null> { return this.open(q).then(v => typeof v === 'string' ? v : null); }
  private open(q: Question): Promise<any> { this.done?.(null); this.q.set(q); return new Promise(res => this.done = res); }
  answer(v: boolean | string | null){ const d = this.done; this.done = undefined; this.q.set(null); d?.(v); }
}
