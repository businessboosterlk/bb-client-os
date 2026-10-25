/* A LOCK AFTER REPEATED WRONG CODES (door finding 3, 29 Sep 2026). Until now the only thing between
   a guesser and the door was a delay of 0.6 seconds.
     - counted per business AND per caller, so one person's slips never lock out anyone else and a
       stranger cannot lock a client out of their own Hub from somewhere else;
     - a second, wider count per caller across every business, for someone walking the list;
     - while a lock stands even the RIGHT code is refused, or the guessing would simply carry on;
     - a right code wipes the count.
   Memory mode keeps the count in this running copy. DATABASE MODE KEEPS IT IN os_door_tries (Stage 2, 24 Oct 2026):
   on Vercel many copies of the API run at once and each would have counted on its own. The caller is stored as a
   hash, never the address itself. Rows older than a day are swept now and then by the wrong code path. */
import { createHash } from 'node:crypto';
import { SECRET } from './auth.js';
import { mode, supa } from './store.js';
const TRIES = Math.max(1, parseInt(process.env.HUB_LOCK_TRIES || '8', 10) || 8);
const SECONDS = Math.max(1, parseInt(process.env.HUB_LOCK_SECONDS || '900', 10) || 900);
const WIDE = TRIES * 4;
const book = (globalThis.__hubLocks ||= new Map());

export function caller(req){
  const f = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return (f || req.headers.get('x-real-ip') || 'unknown').slice(0, 64);
}
const keys = (name, who) => [`n:${name}|${who}`, `c:${who}`];
const live = k => { const e = book.get(k); if (!e) return null; if (Date.now() - e.first > SECONDS * 1000) { book.delete(k); return null; } return e; };

const hashed = who => createHash('sha256').update((SECRET || 'dev') + '|' + who).digest('hex').slice(0, 32);
/* seconds left on a lock, or 0 when the door is open to this caller for this business */
export async function lockedFor(name, who){
  if (mode === 'supabase') {
    const s = await supa(), c = hashed(who), since = new Date(Date.now() - SECONDS * 1000).toISOString();
    const [one, all] = await Promise.all([
      s.from('os_door_tries').select('at').eq('business', name.slice(0, 90)).eq('caller', c).gte('at', since).order('at', { ascending: true }).limit(TRIES),
      s.from('os_door_tries').select('at').eq('caller', c).gte('at', since).order('at', { ascending: true }).limit(WIDE)]);
    let left = 0;
    for (const [r, n] of [[one, TRIES], [all, WIDE]]) if ((r.data || []).length >= n) left = Math.max(left, Math.ceil((Date.parse(r.data[0].at) + SECONDS * 1000 - Date.now()) / 1000));
    return left;
  }
  let left = 0;
  keys(name, who).forEach((k, i) => { const e = live(k); if (e && e.n >= (i ? WIDE : TRIES)) left = Math.max(left, Math.ceil((e.first + SECONDS * 1000 - Date.now()) / 1000)); });
  return left;
}
export async function wrong(name, who){
  if (mode === 'supabase') {
    const s = await supa();
    await s.from('os_door_tries').insert({ business: name.slice(0, 90), caller: hashed(who) });
    if (Math.random() < 0.02) await s.from('os_door_tries').delete().lt('at', new Date(Date.now() - 86400000).toISOString());
    return;
  }
  keys(name, who).forEach(k => { const e = live(k); if (e) e.n++; else book.set(k, { n: 1, first: Date.now() }); });
  /* the book never grows without end: past ten thousand entries the run out ones are swept */
  if (book.size > 10000) for (const k of book.keys()) live(k);
}
export async function right(name, who){
  if (mode === 'supabase') { await (await supa()).from('os_door_tries').delete().eq('business', name.slice(0, 90)).eq('caller', hashed(who)); return; }
  book.delete(keys(name, who)[0]);
}
export function words(seconds){
  const m = Math.ceil(seconds / 60);
  return `Too many tries. Wait ${m <= 1 ? 'a minute' : m + ' minutes'} and try again, or message Business Booster for a new code.`;
}
