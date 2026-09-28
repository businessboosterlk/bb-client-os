import { Injectable, signal, computed } from '@angular/core';
import { Cast } from './models';

/* The cast is the only thing that differs between clients. In the Hub it arrives with
   the login (the API sends it beside the session token). The static demo still loads
   casts/<slug>.json. Every colour on the page derives from its ONE brand hex. */
export interface HubConfig { api: string; bbWa?: string; }
@Injectable({ providedIn: 'root' })
export class CastService {
  readonly cast = signal<Cast | null>(null);
  readonly config = signal<HubConfig>({ api: '', bbWa: '94767412531' });
  readonly slug = computed(() => this.cast()?.slug || '');
  readonly words = computed(() => this.cast()?.words || {});
  readonly apiMode = computed(() => !!this.config().api);

  async loadConfig(){
    try { const r = await fetch('config.json', { cache: 'no-cache' }); if (r.ok) this.config.set({ api: '', bbWa: '94767412531', ...(await r.json()) }); } catch {}
    /* the address may name another API ONLY on a developer's own machine. Anywhere else a link could
       point the door at a stranger's server, and the door sends the business name and the code. */
    const q = new URLSearchParams(location.search).get('api');
    if (q && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(q) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) this.config.set({ ...this.config(), api: q.replace(/\/$/, '') });
  }
  /* static demo path: the cast file named in the address, or the last one used */
  async loadStatic(slug?: string): Promise<Cast | null> {
    const s = slug || new URLSearchParams(location.search).get('c') || '';
    if (!/^[a-z0-9-]{2,40}$/.test(s)) return null;
    try {
      const res = await fetch(`casts/${s}.json`, { cache: 'no-cache' });
      if (!res.ok) return null;
      const cast = await res.json() as Cast; this.use(cast); return cast;
    } catch { return null; }
  }
  use(cast: Cast){ this.apply(cast); this.cast.set(cast); }
  clear(){ this.cast.set(null); }

  apply(cast: Cast) {
    const root = document.documentElement.style;
    const b = hex(cast.brand.hex) || hex('#8a5a2b')!;
    const set = (k: string, v: string) => root.setProperty(k, v);
    set('--brand', toHex(b)); set('--brand-dark', toHex(mix(b, [0, 0, 0], .2))); set('--brand-deep', toHex(mix(b, [0, 0, 0], .45)));
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    set('--brand-soft', toHex(mix(b, dark ? [22, 23, 28] : [255, 255, 255], dark ? .72 : .86))); set('--brand-soft-2', toHex(mix(b, dark ? [22, 23, 28] : [255, 255, 255], dark ? .84 : .93)));
    set('--brand-lite', toHex(mix(b, [255, 255, 255], .35)));
    set('--brand-ink', toHex(mix(b, [12, 12, 14], .88))); set('--sidebar', toHex(mix(b, [12, 12, 14], .9)));
    /* words on the accent take whichever of white and ink reads better against THIS client's colour */
    set('--on-accent', ratio([255, 255, 255], b) >= ratio([20, 20, 23], b) ? '#ffffff' : '#141417');
    if (dark) set('--brand-dark', toHex(mix(b, [255, 255, 255], .18)));
    /* THE ACCENT AS WORDS. A client's colour is chosen for a logo, not for reading at 12px. The
       colour used for words and initials is walked towards ink (or towards white at night) until
       it reads at 4.5 to 1 on the soft tile AND on a card, whatever hex the cast carries. */
    const soft = mix(b, dark ? [22, 23, 28] : [255, 255, 255], dark ? .72 : .86), card: RGB = dark ? [22, 23, 28] : [255, 255, 255], to: RGB = dark ? [255, 255, 255] : [0, 0, 0];
    let text = b; for (let t = 0; t <= 1.001 && (ratio(text, soft) < 4.6 || ratio(text, card) < 4.6); t += .04) text = mix(b, to, t);
    set('--brand-text', toHex(text));
    document.title = `${cast.name} · The Hub`;
    const m = document.getElementById('manifest') as HTMLLinkElement | null;
    if (m) {
      const man = { name: `${cast.name} · The Hub`, short_name: cast.short || cast.name, start_url: `./?src=app`, display: 'standalone', background_color: '#08080a', theme_color: '#f5f5f7',
        icons: [{ src: new URL('icon-192.png', location.href).href, sizes: '192x192', type: 'image/png' }, { src: new URL('icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }, { src: new URL('icon-maskable-512.png', location.href).href, sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
      m.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(man));
    }
  }
  /* the client's group with BB when one is set, else BB's own line with a first line
     written for them. Never the client's own number. */
  whatsapp(text: string): string {
    const c = this.cast(); if (!c) return '';
    if (c.bb?.group && /^https:\/\/chat\.whatsapp\.com\//.test(c.bb.group)) return c.bb.group;
    const n = c.bb?.wa || this.config().bbWa; if (!n) return '';
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  }
  isGroup(){ return !!this.cast()?.bb?.group; }
  word(k: string, fallback: string) { return this.words()[k] || fallback; }
  /* nothing yet, written with its currency and never split from it */
  zero() { return `${this.word('currency', 'LKR')}\u00a00`; }
  money(n: number) { const cur = this.word('currency', 'LKR'); return n ? `${cur}\u00a0${Math.round(n).toLocaleString('en-GB')}` : ''; }
  moneyShort(n: number) { const cur = this.word('currency', 'LKR'); if (!n) return ''; if (n >= 1e6) return `${cur}\u00a0${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`; if (n >= 1e3) return `${cur}\u00a0${Math.round(n / 1e3)}K`; return `${cur}\u00a0${Math.round(n)}`; }
}
type RGB = [number, number, number];
function hex(h: string): RGB | null { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(c: RGB) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function mix(a: RGB, b: RGB, t: number): RGB { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function ratio(a: RGB, b: RGB) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function lum(c: RGB) { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
