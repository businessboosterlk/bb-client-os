/* The Hub service worker.
   FRESH FIRST: the page, the casts, config.json and version.json are always asked of the network
   with {cache:'no-store'} (L-BSWL-020: GitHub Pages answers a plain fetch from its ten minute cache
   and the app serves the previous build). The copy in the cache answers only with no connection.
   NAMED FILES: scripts, styles, fonts and pictures carry their build in their name, so the cache
   answers first. Client DATA is never cached here: it lives in the device copy the app keeps itself
   or behind the API, and a stale customer list served by a worker is worse than none. */
const V = 'hub-v3';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/api/')) return;
  const nav = e.request.mode === 'navigate';
  const fresh = nav || /\/casts\/|\/config\.json$|\/version\.json$|\/manifest\.webmanifest$/.test(url.pathname);
  if (fresh) {
    const key = nav ? new Request(new URL('./', self.registration.scope).href) : new Request(url.origin + url.pathname);
    e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(key, copy)); }
      if (r.status === 404 && url.pathname.includes('/casts/')) caches.open(V).then(c => c.delete(key));
      return r;
    }).catch(() => caches.match(key).then(hit => hit || Response.error())));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); } return r; })));
});
