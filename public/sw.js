const CACHE_NAME = 'gym-cache-v3';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
      ),
      clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // HTML navigation: network-first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Same-origin assets: network-first
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cross-origin: network only, no cache
  e.respondWith(fetch(e.request));
});
