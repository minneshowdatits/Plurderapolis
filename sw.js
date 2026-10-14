/* PLURderapolis offline support: keeps the crisis pages usable with zero bars.
   Version the cache name when the precached pages change so updates propagate. */
const CACHE_NAME = 'plurderapolis-v18';

// The pages someone might need at a festival with no signal.
const PRECACHE_URLS = [
  '/emergency.html',
  '/symptoms.html',
  '/badtrip.html',
  '/spiking.html',
  '/panic.html',
  '/overdose.html',
  '/mentalhealth.html',
  '/snorting.html',
  '/aftercare.html',
  '/polydrug.html',
  '/manifest-checker.json',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => { /* first visit on flaky connection: try again next time */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Runtime-cache same-origin page navigations so more of the site
        // becomes available offline the more it's used.
        if (url.origin === self.location.origin && event.request.mode === 'navigate') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Offline and not cached: show the offline fallback for page loads.
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
