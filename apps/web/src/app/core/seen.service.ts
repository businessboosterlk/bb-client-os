import { Injectable, inject } from '@angular/core';
import { CastService } from './cast.service';
import { SessionService } from './session.service';
import { visitSource } from './library';

/* WHO OPENED WHAT. The one question the library has to answer in December is whether clients come
   back without being asked. So a signed-in seat on the Hub (api mode) tells the server three
   things, and nothing else: that the app was OPENED and where the visit came from, which library
   screen was VIEWED, and which file was TAPPED. One row each, in the client's own records as the
   kind `events`, read back by BB with scripts/visits.mjs. Nothing is recorded in the static demo,
   and a row that cannot be sent is let go: a visit is telemetry, never a record a person made. */
@Injectable({ providedIn: 'root' })
export class SeenService {
  private cast = inject(CastService); private session = inject(SessionService);
  private opened = false;
  readonly src = (() => { let saved = ''; try { saved = sessionStorage.getItem('hub_src') || ''; } catch {} const s = visitSource(location.search, saved); try { sessionStorage.setItem('hub_src', s); } catch {} return s; })();
  /* once per session: the app came to the front with a seat signed in */
  open(){ if (this.opened) return; this.opened = true; this.send('open', this.src); }
  view(screen: string){ this.send('view', screen); }
  tap(title: string, href: string){ this.send('tap', title, href); }
  private send(what: 'open' | 'view' | 'tap', detail: string, href = ''){
    const api = this.cast.config().api, c = this.cast.cast(), token = this.session.token();
    if (!api || !c || !token) return;
    const body = JSON.stringify({ what, detail: String(detail).slice(0, 160), href: String(href).slice(0, 400), src: this.src });
    fetch(`${api}/api/${c.slug}/seen`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body, keepalive: true }).catch(() => {});
  }
}
