import { Injectable, signal, inject } from '@angular/core';
import { CastService } from './cast.service';

/* Who is at the keyboard. The demo checks the cast PIN in the browser, which is
   a demo and says so; the API build moves this to a server session. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private cast = inject(CastService);
  readonly user = signal<string>('');
  private key() { return 'bbos_session_' + this.cast.slug(); }

  restore() {
    try { const u = sessionStorage.getItem(this.key()); if (u) this.user.set(u); } catch {}
    return !!this.user();
  }
  login(name: string, pin: string): boolean {
    const c = this.cast.cast();
    if (!c) return false;
    const ok = c.users.some(u => u.name === name) && (!c.pin || c.pin === pin);
    if (ok) { this.user.set(name); try { sessionStorage.setItem(this.key(), name); } catch {} }
    return ok;
  }
  logout() { this.user.set(''); try { sessionStorage.removeItem(this.key()); } catch {} }
  initial() { return (this.user() || '?').slice(0, 1).toUpperCase(); }
}
