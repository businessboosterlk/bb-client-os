/* The Hub data layer. One records table keyed by kind, rows carry a JSON document, so
   the API never disagrees with the app about column names.
     memory:   per process. Demo and local dev. Nothing survives a restart, on purpose.
     supabase: SERVICE ROLE key server side only. RLS is on with no policies, so the
               anon key in every BB front end reads nothing from these tables.
   Every read and write is scoped by client slug. No path reads across clients. */
const KINDS = new Set(['enquiries', 'deals', 'customers', 'tasks', 'activities']);
export const mode = process.env.DATA_MODE || (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory');
const now = () => new Date().toISOString();
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ── memory ── */
const mem = new Map();
const bucket = (slug, kind) => { if (!mem.has(slug)) mem.set(slug, new Map()); const t = mem.get(slug); if (!t.has(kind)) t.set(kind, new Map()); return t.get(kind); };
const memory = {
  async list(slug, kind){ return [...bucket(slug, kind).values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); },
  async get(slug, kind, id){ return bucket(slug, kind).get(id) || null; },
  async create(slug, kind, data){ const row = { ...data, id: uid(), createdAt: now(), updatedAt: now() }; bucket(slug, kind).set(row.id, row); return row; },
  async update(slug, kind, id, patch){ const b = bucket(slug, kind); const cur = b.get(id); if (!cur) return null; const row = { ...cur, ...patch, id, updatedAt: now() }; b.set(id, row); return row; },
  async remove(slug, kind, id){ return bucket(slug, kind).delete(id); },
  async audit(){ }
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
  async list(slug, kind){ const { data, error } = await (await supa()).from('os_records').select('*').eq('client', slug).eq('kind', kind).order('updated_at', { ascending: false }); if (error) throw error; return data.map(flat); },
  async get(slug, kind, id){ const { data, error } = await (await supa()).from('os_records').select('*').eq('client', slug).eq('kind', kind).eq('id', id).maybeSingle(); if (error) throw error; return data ? flat(data) : null; },
  async create(slug, kind, data){ const { id, createdAt, updatedAt, ...doc } = data; const { data: row, error } = await (await supa()).from('os_records').insert({ client: slug, kind, data: doc }).select().single(); if (error) throw error; return flat(row); },
  async update(slug, kind, id, patch){
    const cur = await this.get(slug, kind, id); if (!cur) return null;
    const { id: _i, createdAt, updatedAt, ...doc } = { ...cur, ...patch };
    const { data: row, error } = await (await supa()).from('os_records').update({ data: doc, updated_at: now() }).eq('client', slug).eq('kind', kind).eq('id', id).select().single(); if (error) throw error; return flat(row);
  },
  async remove(slug, kind, id){ const { error } = await (await supa()).from('os_records').delete().eq('client', slug).eq('kind', kind).eq('id', id); if (error) throw error; return true; },
  async audit(slug, seat, action, kind, record_id){ try { await (await supa()).from('os_audit').insert({ client: slug, seat, action, kind, record_id: /^[0-9a-f-]{36}$/.test(record_id || '') ? record_id : null }); } catch {} }
};
export const store = mode === 'supabase' ? supabase : memory;
export function validKind(k){ return KINDS.has(k); }
