const CACHE_NAME = 'gym-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
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

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          const url = new URL(e.request.url);
          if (url.origin === self.location.origin) {
            cache.put(e.request, clone);
          }
        });
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
