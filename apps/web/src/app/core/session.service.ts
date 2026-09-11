import { Injectable, signal, inject } from '@angular/core';
import { CastService } from './cast.service';
import { Cast } from './models';

/* Who is at the keyboard. In the Hub a session is a signed token from the API for one
   client and one seat, kept for ten days. The static demo checks the cast PIN in the
   browser and says so on screen. */
interface Saved { token: string; slug: string; seat: string; cast: Cast; }
const KEY = 'hub_session';
@Injectable({ providedIn: 'root' })
export class SessionService {
  private castSvc = inject(CastService);
  readonly user = signal<string>('');
  readonly token = signal<string>('');
  readonly error = signal<string>('');

  restore(): boolean {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return false;
      const s = JSON.parse(raw) as Saved;
      if (!s.cast || !s.slug) return false;
      this.castSvc.use(s.cast); this.user.set(s.seat); this.token.set(s.token || '');
      return true;
    } catch { return false; }
  }
  async login(business: string, code: string): Promise<boolean> {
    this.error.set('');
    const api = this.castSvc.config().api;
    if (api) {
      try {
        const r = await fetch(`${api}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business, code }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { this.error.set(j.error || 'That business name and code do not match.'); return false; }
        this.save({ token: j.token, slug: j.slug, seat: j.seat, cast: j.cast }); return true;
      } catch { this.error.set('Could not reach the Hub. Check the signal and try again.'); return false; }
    }
    /* static demo: the alias index turns what was typed into a cast file, the code is the cast PIN */
    const typed = String(business || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/\s+/g, '');
    let slug = '';
    try { const idx = await (await fetch('casts/index.json', { cache: 'no-cache' })).json() as { slug: string; aliases: string[] }[];
      slug = (idx.find(c => c.slug === typed || c.aliases.map(a => a.toLowerCase().replace(/\s+/g, '')).includes(typed)) || {}).slug || ''; } catch {}
    const cast = slug ? await this.castSvc.loadStatic(slug) : null;
    if (!cast || !cast.pin || cast.pin !== code) { this.error.set('That business name and code do not match.'); this.castSvc.clear(); return false; }
    const seat = cast.users?.[0]?.name || 'Owner';
    this.save({ token: '', slug: cast.slug, seat, cast }); return true;
  }
  /* on every open: fetch this seat's settings and library fresh, so new work and a new
     group link arrive without a new login. A seat the server no longer accepts goes to the door. */
  async refresh(){
    const api = this.castSvc.config().api; const c = this.castSvc.cast();
    if (!api || !c || !this.token()) return;
    try {
      const r = await fetch(`${api}/api/${c.slug}/cast`, { headers: { Authorization: 'Bearer ' + this.token() } });
      if (r.status === 401) { this.logout(); this.error.set('Your session ended. Sign in again.'); return; }
      if (r.ok) this.save({ token: this.token(), slug: c.slug, seat: this.user(), cast: await r.json() });
    } catch { /* offline: keep the saved copy */ }
  }
  private save(s: Saved){ this.castSvc.use(s.cast); this.user.set(s.seat); this.token.set(s.token); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
  logout() { this.user.set(''); this.token.set(''); this.castSvc.clear(); try { localStorage.removeItem(KEY); } catch {} }
  initial() { return (this.user() || '?').slice(0, 1).toUpperCase(); }
}
