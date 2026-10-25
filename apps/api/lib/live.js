/* THE LIVE NUDGE (Stage 2). The app is TOLD something changed, it never asks the database on a timer. Supabase Realtime
   broadcast on the client's topic (never the slug), carrying the kind and the id only: someone who learnt a topic would
   see only that something happened, and the app reads the row itself through the signed in server. */
import { mode } from './store.js';
import { topicFor } from './auth.js';

export async function poke(slug, kind, id) {
  try {
    if (mode !== 'supabase') {
      const map = (globalThis.__hubPokes ||= new Map());
      const list = map.get(slug) || [];
      list.push({ kind, id, at: new Date().toISOString() });
      if (list.length > 200) list.splice(0, list.length - 200);
      map.set(slug, list);
      /* a local test of the real live channel: memory mode sends the same nudge with the PUBLIC key, which public channels
         accept. Only when HUB_LIVE_TEST is 1; never set on the host, where the service key sends it. */
      if (process.env.HUB_LIVE_TEST !== '1' || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;
    }
    const key = mode === 'supabase' ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
    const res = await fetch(`${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ topic: topicFor(slug), event: 'change', payload: { kind, id }, private: false }]
      }),
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.warn('live nudge not sent: ' + err.message);
  }
}

export function pokesFor(slug) {
  if (mode === 'supabase') return [];
  const list = (globalThis.__hubPokes ||= new Map()).get(slug);
  return list ? [...list] : [];
}
