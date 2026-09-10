/* Who can come through the door. A client has a slug, the names they may type at the
   door (waverley.lk, waverley), a config (brand, words, stages, library metadata, never a
   lead) and two seats. A seat is a code, stored only as a salted scrypt hash. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { mode, supa } from './store.js';

const CASTS = path.resolve(process.cwd(), '..', '..', 'casts');
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
export function verifySeat(client, code){
  if (mode !== 'supabase') return String(code) === (process.env.HUB_DEMO_CODE || '1111') ? (client.seats[0] || { label: 'Owner' }) : null;
  return (client.seats || []).find(s => checkCode(code, s)) || null;
}
