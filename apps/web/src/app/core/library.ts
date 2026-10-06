import { Cast, LibItem } from './models';

/* THE LIBRARY, READ HONESTLY. Pure functions over the cast's library, so every screen and every
   check agrees on what is newest, what is new to THIS person and what the one thing to show first is.
   Nothing here touches the page. Taken from the single-file Client Library (Aug to Sep 2026), whose
   deep pass found that the Updated date lied and that an empty library showed three zeros. */
export type Lib = Cast['library'];
export interface LibHit { item: LibItem; icon: 'video' | 'post' | 'doc'; where: string; }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* every item with the month it belongs to, newest month first, documents last */
export function allItems(L: Lib): LibHit[] {
  const out: LibHit[] = [];
  (L.months || []).forEach(m => { m.videos.forEach(v => out.push({ item: v, icon: 'video', where: m.label })); m.posts.forEach(p => out.push({ item: p, icon: 'post', where: m.label })); });
  (L.docs || []).forEach(d => out.push({ item: d, icon: 'doc', where: d.kind || 'Document' }));
  return out;
}
/* the newest real change: the latest `added` on any item. No stamp from a rebuild, no date typed
   into a file. Nothing added means nothing added, said plainly. */
export function newestAdded(L: Lib): string {
  return allItems(L).map(h => h.item.added || '').filter(Boolean).sort().pop() || '';
}
export function longDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
export function updatedLine(L: Lib): string {
  const d = newestAdded(L); return d ? `Updated ${longDay(d)}` : 'Nothing added yet';
}
/* THE ONE THING TO SHOW FIRST. A client forwards the report, not a count: the newest report is the
   lead whenever there is one, then the newest film, then the newest post. */
export function lead(L: Lib): { hit: LibHit; eyebrow: string; action: string } | null {
  const items = allItems(L);
  const byAdded = (a: LibHit, b: LibHit) => (b.item.added || '').localeCompare(a.item.added || '');
  const report = items.filter(h => h.icon === 'doc' && /report/i.test(h.item.kind || '')).sort(byAdded)[0];
  if (report) { const d = report.item.added || ''; const month = d ? MONTHS[Number(d.slice(5, 7)) - 1] : ''; return { hit: report, eyebrow: month ? `Your ${month} report is ready` : 'Your report is ready', action: 'Open the report' }; }
  const film = items.filter(h => h.icon === 'video').sort(byAdded)[0];
  if (film) return { hit: film, eyebrow: `Latest film · ${film.where}`, action: 'Watch on Drive' };
  const post = items.filter(h => h.icon === 'post').sort(byAdded)[0];
  if (post) return { hit: post, eyebrow: `Latest post · ${post.where}`, action: 'Open the post' };
  return null;
}
/* one honest line for a library with nothing in it yet, instead of three zeros */
export function emptyLine(name: string): string { return `Your first month is being prepared. Your films, posts and reports for ${name} will appear here as they are made.`; }
export function hasAnything(L: Lib): boolean { return allItems(L).length > 0; }

/* NEW TO THIS PERSON. The stamp of their last visit is read BEFORE this visit updates it, so
   "new since your last visit" means exactly that. With no stamp (a first visit) the last 14 days
   count as new, which is what a first visitor would call new. */
export const SEEN_KEY = (slug: string) => 'hub_seen_' + slug;
export function readSeen(slug: string): string { try { return localStorage.getItem(SEEN_KEY(slug)) || ''; } catch { return ''; } }
export function writeSeen(slug: string, iso = new Date().toISOString()){ try { localStorage.setItem(SEEN_KEY(slug), iso); } catch {} }
export function isNewSince(added: string | undefined, ref: string): boolean {
  if (!added) return false;
  if (ref) return added > ref.slice(0, 10) || (added.length > 10 && added > ref);
  return (Date.now() - new Date(added).getTime()) / 86400000 <= 14;
}
export function newSince(L: Lib, ref: string): LibHit[] {
  return allItems(L).filter(h => isNewSince(h.item.added, ref)).sort((a, b) => (b.item.added || '').localeCompare(a.item.added || ''));
}
export function newCount(items: LibItem[], ref: string): number { return items.filter(i => isNewSince(i.added, ref)).length; }

/* ONE SEARCH over everything in the library: titles, notes, kinds, platforms and the business facts */
export function searchLibrary(L: Lib, q: string): { hits: LibHit[]; facts: { k: string; v: string }[] } {
  const t = q.trim().toLowerCase(); if (t.length < 2) return { hits: [], facts: [] };
  const has = (...s: (string | undefined)[]) => s.some(x => (x || '').toLowerCase().includes(t));
  return {
    hits: allItems(L).filter(h => has(h.item.title, h.item.note, h.item.kind, h.item.platform, h.where)).slice(0, 12),
    facts: (L.facts || []).filter(f => has(f.k, f.v)).slice(0, 6)
  };
}

/* INSTALL TEACHING. Shown on a touch screen that is not yet the installed app, never again once
   dismissed or installed, and never inside WhatsApp's own browser (reached by the monthly link,
   `src=wa`), where Add to Home Screen does not exist. The words are for the phone in the hand:
   iOS 26 has no share button on screen, the way in is the three dots (walked 29 Sep 2026). */
export function shouldHint(coarse: boolean, standalone: boolean, dismissed: boolean, src: string): boolean {
  return coarse && !standalone && !dismissed && src !== 'wa';
}
export function installWords(ua: string): string {
  return /iPad|iPhone|iPod/.test(ua)
    ? 'Open this page in Safari, tap the three dots at the bottom, then Share, View More and Add to Home Screen. An older iPhone shows the share button by itself.'
    : 'In Chrome tap the three dots at the top, then Add to Home screen.';
}
export const HINT_KEY = (slug: string) => 'hub_hint_' + slug;
/* where this visit came from: the monthly message (wa), the installed app (app) or a typed address
   (direct). Read once from the address and kept for the session, so a reload inside the visit never
   turns a prompted open into an unprompted one (the old library's beacon did exactly that). */
export function visitSource(search: string, saved: string): string {
  const q = new URLSearchParams(search).get('src') || '';
  return /^(wa|app|bb)$/.test(q) ? q : (saved || 'direct');
}
