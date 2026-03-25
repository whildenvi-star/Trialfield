var CACHE_NAME = 'grain-tickets-v7';
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

// --- IndexedDB helpers for ticket queue ---

function openTicketDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open('grain-tickets-offline', 1);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('ticket-queue')) {
        db.createObjectStore('ticket-queue', { keyPath: 'id', autoIncrement: false });
      }
      if (!db.objectStoreNames.contains('ref-cache')) {
        db.createObjectStore('ref-cache', { keyPath: 'key' });
      }
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}

function getAllPending() {
  return openTicketDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('ticket-queue', 'readonly');
      var store = tx.objectStore('ticket-queue');
      var req = store.getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  });
}

function deletePending(id) {
  return openTicketDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('ticket-queue', 'readwrite');
      var store = tx.objectStore('ticket-queue');
      var req = store.delete(id);
      req.onsuccess = function () { resolve(); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  });
}

function updatePending(id, data) {
  return openTicketDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('ticket-queue', 'readwrite');
      var store = tx.objectStore('ticket-queue');
      var getReq = store.get(id);
      getReq.onsuccess = function () {
        var existing = getReq.result;
        if (!existing) { resolve(); return; }
        var updated = Object.assign({}, existing, data);
        var putReq = store.put(updated);
        putReq.onsuccess = function () { resolve(); };
        putReq.onerror = function (e) { reject(e.target.error); };
      };
      getReq.onerror = function (e) { reject(e.target.error); };
    });
  });
}

// --- Install & Activate ---

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

// --- Background Sync: ticket-sync ---

self.addEventListener('sync', function (e) {
  if (e.tag === 'ticket-sync') {
    e.waitUntil(replayTicketQueue());
  }
});

function replayTicketQueue() {
  return getAllPending().then(function (entries) {
    // Sort FIFO by createdAt
    entries.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

    var synced = 0;
    var conflicts = 0;
    var failed = 0;

    // Process sequentially to preserve order
    var chain = Promise.resolve();
    entries.forEach(function (entry) {
      if (entry.status === 'conflict') {
        // Skip already-conflicted items — wait for user resolution
        return;
      }
      chain = chain.then(function () {
        return fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.body)
        }).then(function (r) {
          if (r.status === 201) {
            synced++;
            return deletePending(entry.id);
          } else if (r.status === 409) {
            conflicts++;
            return r.json().then(function (data) {
              return updatePending(entry.id, {
                status: 'conflict',
                conflictData: data
              });
            });
          } else if (r.status >= 400 && r.status < 500) {
            failed++;
            return r.json().then(function (data) {
              return updatePending(entry.id, {
                status: 'failed',
                errorMessage: data.message || data.error || ('HTTP ' + r.status)
              });
            });
          } else {
            // 5xx or unexpected
            var newRetryCount = (entry.retryCount || 0) + 1;
            failed++;
            if (newRetryCount >= 3) {
              return updatePending(entry.id, {
                status: 'failed',
                retryCount: newRetryCount,
                errorMessage: 'Max retries reached (HTTP ' + r.status + ')'
              });
            }
            return updatePending(entry.id, {
              retryCount: newRetryCount,
              status: 'pending'
            });
          }
        }).catch(function (networkErr) {
          // Network error — increment retry count
          var newRetryCount = (entry.retryCount || 0) + 1;
          failed++;
          if (newRetryCount >= 3) {
            return updatePending(entry.id, {
              status: 'failed',
              retryCount: newRetryCount,
              errorMessage: 'Network unavailable after 3 attempts'
            });
          }
          return updatePending(entry.id, {
            retryCount: newRetryCount,
            status: 'pending'
          });
        });
      });
    });

    return chain.then(function () {
      // Notify all clients of sync result
      return self.clients.matchAll().then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({
            type: 'ticket-sync-complete',
            synced: synced,
            conflicts: conflicts,
            failed: failed
          });
        });
      });
    });
  });
}

// --- Fetch handler ---

// Reference data API paths to cache for offline form use
var REF_CACHE_PATHS = ['/api/crops', '/api/farm-names', '/api/destinations', '/api/crop-types', '/api/registry/crops'];

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  var isGet = e.request.method === 'GET';

  // Cache stale-while-revalidate for reference data APIs
  if (isGet) {
    var isRefPath = REF_CACHE_PATHS.some(function (p) { return url.indexOf(p) !== -1; });
    if (isRefPath) {
      e.respondWith(
        caches.open(CACHE_NAME).then(function (cache) {
          return cache.match(e.request).then(function (cached) {
            var networkFetch = fetch(e.request).then(function (response) {
              if (response.ok) {
                cache.put(e.request, response.clone());
              }
              return response;
            }).catch(function () {
              return null;
            });

            // Return cached immediately if available, otherwise wait for network
            return cached || networkFetch;
          });
        })
      );
      return;
    }
  }

  // Skip non-GET requests and other API calls
  if (!isGet || url.indexOf('/api/') !== -1) return;

  // Network-first strategy for all other GET requests
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
