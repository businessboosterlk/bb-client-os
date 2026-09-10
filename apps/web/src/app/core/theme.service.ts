import { Injectable, signal, effect } from '@angular/core';

/* Day and night. Auto follows the phone, and one tap overrides it. The choice is
   remembered on the device. The door is always night: that is where the mark lives. */
export type Theme = 'auto' | 'light' | 'dark';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<Theme>('auto');
  readonly dark = signal(false);
  onChange?: (dark: boolean) => void;
  private mq = matchMedia('(prefers-color-scheme: dark)');
  constructor(){
    try { const t = localStorage.getItem('hub_theme') as Theme | null; if (t === 'light' || t === 'dark' || t === 'auto') this.mode.set(t); } catch {}
    this.mq.addEventListener('change', () => this.apply());
    effect(() => { this.apply(); });
  }
  apply(){
    const m = this.mode();
    const dark = m === 'dark' || (m === 'auto' && this.mq.matches);
    this.dark.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    this.onChange?.(dark);
    /* the browser chrome and the status strip follow the page, unless the door owns them */
    if (!document.body.classList.contains('on-door')) {
      const bg = dark ? '#0c0d10' : '#f5f5f7';
      document.documentElement.style.setProperty('--top', bg);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
    }
  }
  toggle(){ this.mode.set(this.dark() ? 'light' : 'dark'); try { localStorage.setItem('hub_theme', this.mode()); } catch {} }
}
