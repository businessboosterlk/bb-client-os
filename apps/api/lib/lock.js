/* A LOCK AFTER REPEATED WRONG CODES (door finding 3, 29 Sep 2026). Until now the only thing between
   a guesser and the door was a delay of 0.6 seconds.
     - counted per business AND per caller, so one person's slips never lock out anyone else and a
       stranger cannot lock a client out of their own Hub from somewhere else;
     - a second, wider count per caller across every business, for someone walking the list;
     - while a lock stands even the RIGHT code is refused, or the guessing would simply carry on;
     - a right code wipes the count.
   KEPT IN MEMORY, on purpose: no table, no schema change. It therefore lives in one running copy
   of the API and is forgotten when that copy restarts. A lock that must survive a restart or span
   several copies needs a table, and that is Thulaib's decision. */
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

/* seconds left on a lock, or 0 when the door is open to this caller for this business */
export function lockedFor(name, who){
  let left = 0;
  keys(name, who).forEach((k, i) => { const e = live(k); if (e && e.n >= (i ? WIDE : TRIES)) left = Math.max(left, Math.ceil((e.first + SECONDS * 1000 - Date.now()) / 1000)); });
  return left;
}
export function wrong(name, who){
  keys(name, who).forEach(k => { const e = live(k); if (e) e.n++; else book.set(k, { n: 1, first: Date.now() }); });
  /* the book never grows without end: past ten thousand entries the run out ones are swept */
  if (book.size > 10000) for (const k of book.keys()) live(k);
}
export function right(name, who){ book.delete(keys(name, who)[0]); }
export function words(seconds){
  const m = Math.ceil(seconds / 60);
  return `Too many tries. Wait ${m <= 1 ? 'a minute' : m + ' minutes'} and try again, or message Business Booster for a new code.`;
}
