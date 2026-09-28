import { Injectable, inject } from '@angular/core';
import { CastService } from './cast.service';

/* NOTHING A PERSON TYPED IS EVER LOST. Every form keeps its draft on the device as it is typed, so
   it survives a closed sheet, a reload, a session that ended and the app updating itself. A draft
   is cleared by a save, by the person discarding it or by signing out. Keyed by client and form. */
@Injectable({ providedIn: 'root' })
export class DraftService {
  private cast = inject(CastService);
  private key(form: string){ return `hub_draft_${this.cast.slug() || 'door'}_${form}`; }
  load<T extends object>(form: string, blank: T): T {
    try { const raw = localStorage.getItem(this.key(form)); if (!raw) return { ...blank }; const v = JSON.parse(raw); return v && typeof v === 'object' ? { ...blank, ...v } : { ...blank }; } catch { return { ...blank }; }
  }
  has(form: string): boolean { try { return !!localStorage.getItem(this.key(form)); } catch { return false; } }
  /* an untouched form is not a draft: only keep it once something has been typed */
  keep(form: string, value: object){
    const typed = Object.values(value).some(v => v !== '' && v !== null && v !== undefined && v !== 0 && v !== false);
    try { if (typed) localStorage.setItem(this.key(form), JSON.stringify(value)); else localStorage.removeItem(this.key(form)); } catch {}
  }
  clear(form: string){ try { localStorage.removeItem(this.key(form)); } catch {} }
  clearAll(slug: string){ try { const pre = `hub_draft_${slug}_`; Object.keys(localStorage).filter(k => k.startsWith(pre)).forEach(k => localStorage.removeItem(k)); } catch {} }
}
