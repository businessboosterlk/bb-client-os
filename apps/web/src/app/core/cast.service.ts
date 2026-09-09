import { Injectable, signal, computed } from '@angular/core';
import { Cast } from './models';

/* The cast is the only thing that differs between clients. It is loaded once from
   casts/<slug>.json (static build) or /api/cast/<slug> (API build) and every colour
   on the page is derived from its ONE brand hex, same law as the Client Library. */
@Injectable({ providedIn: 'root' })
export class CastService {
  readonly cast = signal<Cast | null>(null);
  readonly error = signal<string>('');
  readonly slug = computed(() => this.cast()?.slug || '');
  readonly words = computed(() => this.cast()?.words || {});

  slugFromUrl(): string {
    const q = new URLSearchParams(location.search).get('c');
    if (q && /^[a-z0-9-]{2,40}$/.test(q)) { try { localStorage.setItem('bbos_slug', q); } catch {} return q; }
    try { return localStorage.getItem('bbos_slug') || 'demo'; } catch { return 'demo'; }
  }

  async load(): Promise<Cast | null> {
    const slug = this.slugFromUrl();
    try {
      const res = await fetch(`casts/${slug}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      const cast = await res.json() as Cast;
      this.apply(cast);
      this.cast.set(cast);
      return cast;
    } catch {
      this.error.set(`No client configured for "${slug}".`);
      return null;
    }
  }

  /* palette from one hex: dark for pressed, deep for headings on soft, soft tints
     for fills, an ink for the sidebar, and a legibility guard for on-accent text */
  apply(cast: Cast) {
    const root = document.documentElement.style;
    const b = hex(cast.brand.hex) || hex('#8a5a2b')!;
    const set = (k: string, v: string) => root.setProperty(k, v);
    set('--brand', toHex(b));
    set('--brand-dark', toHex(mix(b, [0, 0, 0], .2)));
    set('--brand-deep', toHex(mix(b, [0, 0, 0], .45)));
    set('--brand-soft', toHex(mix(b, [255, 255, 255], .86)));
    set('--brand-soft-2', toHex(mix(b, [255, 255, 255], .93)));
    set('--brand-ink', toHex(mix(b, [12, 12, 14], .88)));
    set('--sidebar', toHex(mix(b, [12, 12, 14], .9)));
    set('--on-accent', lum(b) > .55 ? '#141417' : '#ffffff');
    document.title = `${cast.name} · Your OS`;
    /* per-tenant manifest, so an install opens THIS client (L-028) */
    const m = document.getElementById('manifest') as HTMLLinkElement | null;
    if (m) {
      const man = { name: `${cast.name} · Your OS`, short_name: cast.short || cast.name, start_url: `./?c=${cast.slug}&src=app`,
        display: 'standalone', background_color: '#f5f5f7', theme_color: '#f5f5f7',
        icons: [{ src: new URL('assets/bb-logo.png', location.href).href, sizes: '512x512', type: 'image/png' }] };
      m.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(man));
    }
  }

  word(k: string, fallback: string) { return this.words()[k] || fallback; }
  money(n: number) {
    const cur = this.word('currency', 'LKR');
    return n ? `${cur} ${Math.round(n).toLocaleString('en-GB')}` : '';
  }
  moneyShort(n: number) {
    const cur = this.word('currency', 'LKR');
    if (!n) return '';
    if (n >= 1e6) return `${cur} ${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`;
    if (n >= 1e3) return `${cur} ${Math.round(n / 1e3)}K`;
    return `${cur} ${n}`;
  }
}
type RGB = [number, number, number];
function hex(h: string): RGB | null { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(c: RGB) { return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); }
function mix(a: RGB, b: RGB, t: number): RGB { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function lum(c: RGB) { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
