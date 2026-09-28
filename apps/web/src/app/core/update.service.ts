import { Injectable, signal } from '@angular/core';
import { BUILD } from './build';

/* AN INSTALLED APP KEEPS ITS FIRST COPY. On open, and every time the app comes back to the front,
   read the small version file. When its stamp differs from the one this copy was built with, reload
   ONCE. Drafts live on the device (DraftService), so nothing a person typed is lost by the reload.
   The page itself is never fetched to read a stamp. */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly build = BUILD;
  readonly checked = signal('');
  private busy = false;
  start(){
    this.check();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.check(); });
  }
  async check(){
    if (this.busy) return; this.busy = true;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const live = String((await r.json()).build || '');
      this.checked.set(live);
      if (!live || live === BUILD) { try { sessionStorage.removeItem('hub_reloaded_for'); } catch {} return; }
      /* once per stamp: a version file that is ahead of the page for a minute must not loop */
      let done = ''; try { done = sessionStorage.getItem('hub_reloaded_for') || ''; } catch {}
      if (done === live) return;
      try { sessionStorage.setItem('hub_reloaded_for', live); } catch {}
      if ('serviceWorker' in navigator) { try { const reg = await navigator.serviceWorker.getRegistration(); await reg?.update(); } catch {} }
      location.reload();
    } catch { /* no connection: the copy on the device carries on */ }
    finally { this.busy = false; }
  }
}
