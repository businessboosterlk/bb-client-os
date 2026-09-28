import { Injectable, signal } from '@angular/core';

/* ONE LIST IN THE PAGE. A desk reads a table and a phone reads cards. Drawing both and hiding one
   doubled every row in the page. The screen is asked once and again whenever it changes. */
@Injectable({ providedIn: 'root' })
export class ScreenService {
  private mq = matchMedia('(min-width:761px)');
  readonly wide = signal(this.mq.matches);
  constructor(){ this.mq.addEventListener('change', e => this.wide.set(e.matches)); }
}
