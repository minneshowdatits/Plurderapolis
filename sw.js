/* PLURderapolis offline support: keeps the crisis pages usable with zero bars.
   Version the cache name when the precached pages change so updates propagate. */
const CACHE_NAME = 'plurderapolis-v58';

// The pages someone might need at a festival with no signal.
const PRECACHE_URLS = [
  '/',
  '/emergency.html',
  '/symptoms.html',
  '/badtrip.html',
  '/spiking.html',
  '/panic.html',
  '/overdose.html',
  '/overdose-es.html',
  '/mentalhealth.html',
  '/snorting.html',
  '/aftercare.html',
  '/test-strips.html',
  '/polydrug.html',
  '/manifest-checker.json',
  '/offline.html',
  '/checklist.html',
  '/offline-bundle.html',
  '/js/section-nav.js'
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

// One-tap full-site caching for offline-bundle.html: the page posts
// {type:'CACHE_ALL', urls:[...]} and gets progress messages back.
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  // Update toast on the homepage posts {type:'SKIP_WAITING'} when a new
  // version is waiting; activate it so the page can reload onto it.
  if (msg.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (msg.type !== 'CACHE_ALL' || !Array.isArray(msg.urls)) return;
  const replyTo = event.source && event.source.id;
  const reply = (m) => {
    const send = (c) => c && c.postMessage(m);
    if (replyTo) clients.get(replyTo).then(send);
    else clients.matchAll().then((cs) => cs.forEach(send));
  };
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let done = 0; const ok = []; const failed = [];
    for (const url of msg.urls) {
      try { await cache.add(url); ok.push(url); }
      catch (e) { failed.push(url); }
      reply({ type: 'CACHE_PROGRESS', done: ++done, total: msg.urls.length });
    }
    reply({ type: 'CACHE_DONE', done: ok.length, total: msg.urls.length, ok, failed });
  })());
});
