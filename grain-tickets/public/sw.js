var CACHE_NAME = 'grain-tickets-v5';
var PRECACHE = [
  '/',
  '/style.css',
  '/app.js',
  '/calc.js',
  '/tickets.js',
  '/farms.js',
  '/lookup.js',
  '/scan.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy: try network, fall back to cache
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;

  e.respondWith(
    fetch(e.request).then(function (response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) {
        cache.put(e.request, clone);
      });
      return response;
    }).catch(function () {
      return caches.match(e.request);
    })
  );
});
