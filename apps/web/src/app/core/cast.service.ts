import { Injectable, signal, computed } from '@angular/core';
import { Cast } from './models';

/* The cast is the only thing that differs between clients. In the Hub it arrives with
   the login (the API sends it beside the session token). The static demo still loads
   casts/<slug>.json. Every colour on the page derives from its ONE brand hex. */
export interface HubConfig { api: string; }
@Injectable({ providedIn: 'root' })
export class CastService {
  readonly cast = signal<Cast | null>(null);
  readonly config = signal<HubConfig>({ api: '' });
  readonly slug = computed(() => this.cast()?.slug || '');
  readonly words = computed(() => this.cast()?.words || {});
  readonly apiMode = computed(() => !!this.config().api);

  async loadConfig(){
    try { const r = await fetch('config.json', { cache: 'no-cache' }); if (r.ok) this.config.set({ api: '', ...(await r.json()) }); } catch {}
    const q = new URLSearchParams(location.search).get('api'); if (q && /^https?:\/\//.test(q)) this.config.set({ api: q.replace(/\/$/, '') });
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
    set('--on-accent', lum(b) > .55 ? '#141417' : '#ffffff');
    if (dark) set('--brand-dark', toHex(mix(b, [255, 255, 255], .18)));
    document.title = `${cast.name} · The Hub`;
    const m = document.getElementById('manifest') as HTMLLinkElement | null;
    if (m) {
      const man = { name: `${cast.name} · The Hub`, short_name: cast.short || cast.name, start_url: `./?src=app`, display: 'standalone', background_color: '#f5f5f7', theme_color: '#f5f5f7',
        icons: [{ src: new URL('icon-192.png', location.href).href, sizes: '192x192', type: 'image/png' }, { src: new URL('icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }, { src: new URL('icon-maskable-512.png', location.href).href, sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
      m.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(man));
    }
  }
  word(k: string, fallback: string) { return this.words()[k] || fallback; }
  money(n: number) { const cur = this.word('currency', 'LKR'); return n ? `${cur} ${Math.round(n).toLocaleString('en-GB')}` : ''; }
  moneyShort(n: number) { const cur = this.word('currency', 'LKR'); if (!n) return ''; if (n >= 1e6) return `${cur} ${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`; if (n >= 1e3) return `${cur} ${Math.round(n / 1e3)}K`; return `${cur} ${n}`; }
}
type RGB = [number, number, number];
function hex(h: string): RGB | null { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(c: RGB) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function mix(a: RGB, b: RGB, t: number): RGB { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function lum(c: RGB) { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
