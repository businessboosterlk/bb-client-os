/* The data layer. One interface, two adapters.
 *   memory:   per-process, seeded empty, for demos and local dev. Nothing persists
 *             across a restart, which is the point of a demo.
 *   supabase: server-side only, with the SERVICE ROLE key from the environment. The
 *             key never reaches a browser. Tables are in sql/schema.sql and are NOT
 *             created by this code: a schema change needs Thulaib's yes.
 * Every row is scoped by client slug. There is no path that reads across clients. */
const TABLES = new Set(['enquiries', 'deals', 'customers', 'tasks', 'activities']);
const MODE = process.env.DATA_MODE || 'memory';

const mem = new Map(); // slug -> table -> Map(id -> row)
function bucket(slug, table){
  if(!mem.has(slug)) mem.set(slug, new Map());
  const t = mem.get(slug);
  if(!t.has(table)) t.set(table, new Map());
  return t.get(table);
}
const id = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => new Date().toISOString();

const memory = {
  async list(slug, table){ return [...bucket(slug, table).values()].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')); },
  async get(slug, table, rid){ return bucket(slug, table).get(rid) || null; },
  async create(slug, table, data){
    const row = { ...data, id: id(), client: slug, created_at: now(), updated_at: now() };
    bucket(slug, table).set(row.id, row); return row;
  },
  async update(slug, table, rid, data){
    const b = bucket(slug, table); const cur = b.get(rid);
    if(!cur) return null;
    const row = { ...cur, ...data, id: rid, client: slug, updated_at: now() };
    b.set(rid, row); return row;
  },
  async remove(slug, table, rid){ return bucket(slug, table).delete(rid); }
};

let sb = null;
async function supa(){
  if(sb) return sb;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('DATA_MODE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  sb = createClient(url, key, { auth: { persistSession: false } });
  return sb;
}
const T = (table) => 'os_' + table;
const supabase = {
  async list(slug, table){
    const { data, error } = await (await supa()).from(T(table)).select('*').eq('client', slug).order('updated_at', { ascending: false });
    if(error) throw error; return data;
  },
  async get(slug, table, rid){
    const { data, error } = await (await supa()).from(T(table)).select('*').eq('client', slug).eq('id', rid).maybeSingle();
    if(error) throw error; return data;
  },
  async create(slug, table, data){
    const { data: row, error } = await (await supa()).from(T(table)).insert({ ...data, client: slug }).select().single();
    if(error) throw error; return row;
  },
  async update(slug, table, rid, data){
    const { data: row, error } = await (await supa()).from(T(table)).update({ ...data, updated_at: now() }).eq('client', slug).eq('id', rid).select().maybeSingle();
    if(error) throw error; return row;
  },
  async remove(slug, table, rid){
    const { error } = await (await supa()).from(T(table)).delete().eq('client', slug).eq('id', rid);
    if(error) throw error; return true;
  }
};

export const store = MODE === 'supabase' ? supabase : memory;
export const mode = MODE;
export function validTable(t){ return TABLES.has(t); }
