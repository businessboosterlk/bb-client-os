/* The library a client sees is the rows BB's team keeps in bb_library_items, read live on
   every open, so a video added in the backend this morning is in the Hub this morning.
   Same mapping as the old library's caster (scripts/pull-month.py): video and post rows by
   month, doc rows, fact rows. Hidden rows and anything that is not https never leave the
   server. A section with no rows keeps what the cast carried, so a new client's business
   profile shows from day one. */
import { mode, supa } from './store.js';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const byOrder = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.id ?? 0) - (b.id ?? 0);
const day = r => String(r.updated_at || '').slice(0, 10);
const safe = u => /^https:\/\//.test(String(u || ''));

export function mergeLibrary(config, rows){
  if (!config) return config;
  const vis = (rows || []).filter(r => !r.hidden).sort(byOrder);
  const lib = { hello: '', sub: '', months: [], docs: [], facts: [], ...(config.library || {}) };
  const byMonth = new Map();
  for (const r of vis) {
    if ((r.kind !== 'video' && r.kind !== 'post') || !/^\d{4}-\d{2}$/.test(r.month || '') || !safe(r.url)) continue;
    if (!byMonth.has(r.month)) byMonth.set(r.month, { videos: [], posts: [] });
    const b = byMonth.get(r.month);
    if (r.kind === 'video') b.videos.push({ title: r.title, note: r.sub || '', href: r.url, added: day(r) });
    else b.posts.push({ title: r.title, date: r.sub || '', platform: '', href: r.url, added: day(r) });
  }
  const months = [...byMonth.keys()].sort().reverse()
    .map(id => ({ id, label: MONTHS[Number(id.slice(5, 7)) - 1], ...byMonth.get(id) }));
  const docs = vis.filter(r => r.kind === 'doc' && safe(r.url))
    .map(r => ({ title: r.title, kind: r.sub || 'Document', date: '', href: r.url, added: day(r) }));
  const factRows = vis.filter(r => r.kind === 'fact' && r.title);
  if (months.length) lib.months = months;
  if (docs.length) lib.docs = docs;
  /* the line from the team lives in the client's settings (library.note), set with onboard.mjs. bb_library_items
     accepts only video, post, doc and fact (a check on the table), so a note is not a library row. */
  if (factRows.length) {
    lib.facts = factRows.map(r => ({ k: r.title, v: r.sub || '' }));
    const latest = factRows.map(day).filter(Boolean).sort().pop();
    if (latest) lib.factsReviewed = new Date(latest + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return { ...config, library: lib };
}

export async function withLibrary(config){
  if (mode !== 'supabase' || !config?.slug) return config;
  try {
    /* paged: the database hands over 1,000 rows at most and says nothing, and a library grows every month */
    const db = await supa(), rows = [];
    for (let off = 0; off < 100000; off += 1000) {
      const { data, error } = await db.from('bb_library_items')
        .select('id,kind,month,title,sub,url,sort,hidden,updated_at').eq('client_slug', config.slug)
        .order('id', { ascending: true }).range(off, off + 999);
      if (error) return config;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return mergeLibrary(config, rows);
  } catch { return config; }
}
