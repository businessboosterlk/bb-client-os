/* BB Client OS service worker. Navigations and casts are always fetched fresh with
   {cache:'no-cache'} (L-BSWL-020: GitHub Pages answers a plain fetch from its
   ten minute cache and the app serves the previous build). Static assets are
   cached by name. Client DATA is never cached: it lives in the browser store or
   behind the API, and a stale customer list is worse than none. */
const V = 'bbos-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/api/')) return;
  const fresh = e.request.mode === 'navigate' || url.pathname.includes('/casts/');
  if (fresh) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => {
      if (r.ok && e.request.mode === 'navigate') caches.open(V).then(c => c.put(e.request, r.clone()));
      if (r.status === 404 && url.pathname.includes('/casts/')) caches.open(V).then(c => c.delete(e.request));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone())); return r; })));
});
