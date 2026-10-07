/* The Hub data layer. One records table keyed by kind, rows carry a JSON document, so
   the API never disagrees with the app about column names.
     memory:   per process. Demo and local dev. Nothing survives a restart, on purpose.
     supabase: SERVICE ROLE key server side only. RLS is on with no policies, so the
               anon key in every BB front end reads nothing from these tables.
   Every read and write is scoped by client slug. No path reads across clients. */
const KINDS = new Set(['enquiries', 'deals', 'customers', 'tasks', 'activities']);
export const mode = process.env.DATA_MODE || (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory');
/* THE DATABASE HANDS OVER 1,000 ROWS AT MOST AND SAYS NOTHING. Every list read names a limit and
   an offset, ordered on a stable pair (made, then id), and the app pages until a short page
   comes back. A read that names no limit gets the first page, never an unbounded one. */
export const PAGE_MAX = 1000, PAGE_DEFAULT = 500;
export function paging(url){
  const q = new URL(url).searchParams;
  const n = v => { const x = parseInt(v ?? '', 10); return Number.isFinite(x) && x >= 0 ? x : null; };
  const limit = Math.min(Math.max(n(q.get('limit')) ?? PAGE_DEFAULT, 1), PAGE_MAX);
  return { limit, offset: n(q.get('offset')) ?? 0 };
}
const now = () => new Date().toISOString();
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ── memory ── */
/* one memory for the whole process. Each route is built on its own, so a plain Map here gave every
   route its own empty memory: a row written through one address could not be read through another
   (the tenant wall run, 28 Sep 2026). Memory mode only. */
const mem = (globalThis.__hubMemory ||= new Map());
const bucket = (slug, kind) => { if (!mem.has(slug)) mem.set(slug, new Map()); const t = mem.get(slug); if (!t.has(kind)) t.set(kind, new Map()); return t.get(kind); };
const memory = {
  async list(slug, kind, { limit = PAGE_DEFAULT, offset = 0 } = {}){ return [...bucket(slug, kind).values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || String(b.id).localeCompare(String(a.id))).slice(offset, offset + Math.min(limit, PAGE_MAX)); },
  async get(slug, kind, id){ return bucket(slug, kind).get(id) || null; },
  /* memory refuses what the real table refuses: os_records has a check on kind. A memory store that
     accepted anything let a route write 'events' in every test while the real table would refuse it. */
  async create(slug, kind, data){ if (!KINDS.has(kind)) throw new Error('os_records refuses kind ' + kind); const row = { ...data, id: uid(), createdAt: now(), updatedAt: now() }; bucket(slug, kind).set(row.id, row); return row; },
  async update(slug, kind, id, patch){ const b = bucket(slug, kind); const cur = b.get(id); if (!cur) return null; const row = { ...cur, ...patch, id, updatedAt: now() }; b.set(id, row); return row; },
  async remove(slug, kind, id){ return bucket(slug, kind).delete(id); },
  async audit(){ },
  async seen(slug, seat, what, detail, src){ const l = (globalThis.__hubSeen ||= []); l.push({ client: slug, by: seat, what, detail, src, createdAt: now(), id: uid() }); },
  async seenList(slug, { limit = PAGE_DEFAULT, offset = 0 } = {}){ return (globalThis.__hubSeen || []).filter(e => e.client === slug).slice().reverse().slice(offset, offset + Math.min(limit, PAGE_MAX)).map(({ client, ...e }) => e); }
};

/* ── supabase ── */
let sb = null;
export async function supa(){
  if (sb) return sb;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase mode needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  sb = createClient(url, key, { auth: { persistSession: false } });
  return sb;
}
const flat = r => ({ ...r.data, id: r.id, createdAt: r.created_at, updatedAt: r.updated_at });
const supabase = {
  async list(slug, kind, { limit = PAGE_DEFAULT, offset = 0 } = {}){
    const n = Math.min(limit, PAGE_MAX);
    const { data, error } = await (await supa()).from('os_records').select('*').eq('client', slug).eq('kind', kind)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + n - 1);
    if (error) throw error; return data.map(flat);
  },
  async get(slug, kind, id){ const { data, error } = await (await supa()).from('os_records').select('*').eq('client', slug).eq('kind', kind).eq('id', id).maybeSingle(); if (error) throw error; return data ? flat(data) : null; },
  async create(slug, kind, data){ const { id, createdAt, updatedAt, ...doc } = data; const { data: row, error } = await (await supa()).from('os_records').insert({ client: slug, kind, data: doc }).select().single(); if (error) throw error; return flat(row); },
  async update(slug, kind, id, patch){
    const cur = await this.get(slug, kind, id); if (!cur) return null;
    const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    const { data: row, error } = await (await supa()).from('os_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id).select().single(); if (error) throw error; return flat(row);
  },
  async remove(slug, kind, id){ const { error } = await (await supa()).from('os_records').delete().eq('client', slug).eq('kind', kind).eq('id', id); if (error) throw error; return true; },
  async audit(slug, seat, action, kind, record_id){ try { await (await supa()).from('os_audit').insert({ client: slug, seat, action, kind, record_id: /^[0-9a-f-]{36}$/.test(record_id || '') ? record_id : null }); } catch {} },
  /* VISITS live in os_audit, which already exists and already takes one row per thing a seat did:
     action 'seen-open' | 'seen-view' | 'seen-tap', kind '<src>:<detail>'. os_records only accepts the
     five book kinds (a check on the table), and changing that would be a schema change. Found when
     the code first met the real table on 7 Oct 2026: the memory store had accepted 'events'. */
  async seen(slug, seat, what, detail, src){ const { error } = await (await supa()).from('os_audit').insert({ client: slug, seat, action: 'seen-' + what, kind: (src + ':' + detail).slice(0, 200) }); if (error) throw error; },
  async seenList(slug, { limit = PAGE_DEFAULT, offset = 0 } = {}){
    const n = Math.min(limit, PAGE_MAX);
    const { data, error } = await (await supa()).from('os_audit').select('id,seat,action,kind,at').eq('client', slug).like('action', 'seen-%')
      .order('at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + n - 1);
    if (error) throw error;
    return data.map(r => { const k = String(r.kind || ''), i = k.indexOf(':'); return { id: String(r.id), what: r.action.slice(5), src: i > 0 ? k.slice(0, i) : 'direct', detail: i > 0 ? k.slice(i + 1) : k, by: r.seat || '', createdAt: r.at }; });
  }
};
export const store = mode === 'supabase' ? supabase : memory;
export function validKind(k){ return KINDS.has(k); }
