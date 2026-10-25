/* Who can come through the door. A client has a slug, the names they may type at the
   door (waverley.lk, waverley), a config (brand, words, stages, library metadata, never a
   lead) and its PEOPLE (os_people): one named person per code, stored only as a salted scrypt hash. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { mode, supa } from './store.js';

/* memory mode reads its clients from the cast files. A test names its own folder of test casts. */
const CASTS = process.env.HUB_CASTS_DIR ? path.resolve(process.env.HUB_CASTS_DIR) : path.resolve(process.cwd(), '..', '..', 'casts');
export const norm = s => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/\s+/g, '');

export function hashCode(code, salt = randomBytes(12).toString('hex')){
  return { salt, hash: scryptSync(String(code).replace(/[\s-]/g, '').toUpperCase(), salt, 32).toString('hex') };
}
export function checkCode(code, seat){
  if (!seat || seat.revoked) return false;
  const h = scryptSync(String(code).replace(/[\s-]/g, '').toUpperCase(), seat.salt, 32);
  const want = Buffer.from(seat.hash, 'hex');
  return h.length === want.length && timingSafeEqual(h, want);
}
/* codes read aloud on a phone call: three groups, no ambiguous letters */
export function newCode(prefix){
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const g = n => Array.from({ length: n }, () => A[randomBytes(1)[0] % A.length]).join('');
  return `${prefix}-${g(4)}-${g(4)}`;
}

/* memory mode: the cast files ARE the clients, and every seat opens with HUB_DEMO_CODE */
async function fileClients(){
  const out = [];
  for (const f of (await readdir(CASTS)).filter(f => f.endsWith('.json'))) {
    const c = JSON.parse(await readFile(path.join(CASTS, f), 'utf8'));
    out.push({ slug: c.slug, name: c.name, aliases: [c.slug, ...(c.aliases || [])], config: c, seats: [{ label: 'Owner' }, { label: 'Team' }], active: true });
  }
  return out;
}
export async function findClient(typed){
  const t = norm(typed);
  if (!/^[a-z0-9.-]{1,80}$/.test(t)) return null;   /* a name is letters, digits, dots and hyphens; anything else never reaches the filter below (door finding 1, 28 Sep 2026) */
  if (mode !== 'supabase') return (await fileClients()).find(c => c.slug === t || c.aliases.map(norm).includes(t)) || null;
  const s = await supa();
  const { data, error } = await s.from('os_clients').select('*').eq('active', true).or(`slug.eq.${t},aliases.cs.{${t}}`).limit(1);
  if (error) throw error;
  return data[0] || null;
}
export async function loadCast(slug){
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  if (mode !== 'supabase') { try { return JSON.parse(await readFile(path.join(CASTS, slug + '.json'), 'utf8')); } catch { return null; } }
  const { data } = await (await supa()).from('os_clients').select('config').eq('slug', slug).eq('active', true).maybeSingle();
  return data?.config || null;
}
/* WHO IS AT THE DOOR: one named PERSON per code (Stage 2, bb_pending 693). Database mode reads os_people for that client,
   never a revoked person, and answers with the person: id, name, role and side (the client's team or Business Booster).
   Memory mode (the demo and every test): HUB_DEMO_CODE opens as the cast's first user on the client's side, and
   HUB_DEMO_BB_CODE, when set, opens as a team member on Business Booster's side, so both sides can be tested. */
export async function verifySeat(client, code){
  if (mode !== 'supabase') {
    const owner = (client.config?.users || [])[0] || { name: 'Owner', role: 'Owner' };
    if (String(code) === (process.env.HUB_DEMO_CODE || '1111')) return { id: null, name: owner.name, role: owner.role || 'Owner', side: 'client', label: owner.name };
    if (process.env.HUB_DEMO_BB_CODE && String(code) === process.env.HUB_DEMO_BB_CODE) return { id: null, name: 'Tiana', role: 'Social media manager', side: 'bb', label: 'Tiana' };
    return null;
  }
  const s = await supa();
  const { data, error } = await s.from('os_people').select('id,name,role,side,code_salt,code_hash').eq('client', client.slug).is('revoked_at', null).limit(200);
  if (error) throw error;
  const p = (data || []).find(r => checkCode(code, { salt: r.code_salt, hash: r.code_hash }));
  if (!p) return null;
  await s.from('os_people').update({ last_in_at: new Date().toISOString() }).eq('client', client.slug).eq('id', p.id);
  return { id: p.id, name: p.name, role: p.role, side: p.side, label: p.name };
}
