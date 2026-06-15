// App shell: tab navigation and shared utilities
(function () {
  'use strict';

  // --- Tab Navigation ---
  var tabs = document.querySelectorAll('.tab-btn');
  var contents = document.querySelectorAll('.tab-content');

  function activateTab(tabName) {
    tabs.forEach(function (b) { b.classList.remove('active'); });
    contents.forEach(function (c) { c.classList.remove('active'); });
    // Activate ALL nav buttons with this tab name (sidebar + bottom nav)
    document.querySelectorAll('.tab-btn[data-tab="' + tabName + '"]').forEach(function (b) {
      b.classList.add('active');
    });
    var panel = document.getElementById('tab-' + tabName);
    if (panel) panel.classList.add('active');
    window.dispatchEvent(new CustomEvent('tab-activate', { detail: tabName }));
  }

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');
      location.hash = target;
      activateTab(target);
    });
  });

  // Restore tab from URL hash on load / back-forward navigation
  function restoreTab() {
    var hash = location.hash.replace('#', '');
    if (hash && document.querySelector('.tab-btn[data-tab="' + hash + '"]')) {
      activateTab(hash);
    }
  }
  restoreTab();
  window.addEventListener('hashchange', restoreTab);

  // --- Shared API helper ---
  var B = window.__BASE || '';
  window.api = {
    get: function (url) {
      return fetch(B + url).then(function (r) { return r.json(); });
    },
    post: function (url, body) {
      return fetch(B + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) {
          return r.json().then(function (err) {
            var e = new Error(err.message || err.error || 'Request failed');
            e.status = r.status;
            e.data = err;
            throw e;
          });
        }
        return r.json();
      });
    },
    put: function (url, body) {
      return fetch(B + url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) {
          return r.json().then(function (err) {
            var e = new Error(err.message || err.error || 'Request failed');
            e.status = r.status;
            e.data = err;
            throw e;
          });
        }
        return r.json();
      });
    },
    del: function (url) {
      return fetch(B + url, { method: 'DELETE' }).then(function (r) { return r.json(); });
    }
  };

  // --- Shared utilities ---
  window.util = {
    formatNum: function (n, decimals) {
      if (n === null || n === undefined || isNaN(n)) return '--';
      return Number(n).toLocaleString('en-US', {
        minimumFractionDigits: decimals || 0,
        maximumFractionDigits: decimals || 2
      });
    },
    showToast: function (msg, duration, type) {
      var toast = document.getElementById('entry-toast');
      toast.textContent = msg;
      toast.className = 'toast' + (type ? ' ' + type : '');
      setTimeout(function () { toast.classList.add('hidden'); }, duration || 3000);
    },
    getNestedVal: function (obj, path) {
      return path.split('.').reduce(function (o, k) { return o && o[k]; }, obj);
    }
  };

  // --- Load reference data on startup ---
  window.refData = { cropConfig: {}, farmNames: [], destinations: [], cropTypes: [] };

  Promise.all([
    api.get('/api/crops'),
    api.get('/api/farm-names'),
    api.get('/api/destinations'),
    api.get('/api/crop-types')
  ]).then(function (results) {
    window.refData.cropConfig = results[0];
    window.refData.farmNames = results[1];
    window.refData.destinations = results[2];
    window.refData.cropTypes = results[3];
    window.dispatchEvent(new Event('ref-data-loaded'));

    // Cache reference data in IDB for offline use
    if (window.ticketQueue) {
      window.ticketQueue.cacheRef('cropConfig', results[0]);
      window.ticketQueue.cacheRef('farmNames', results[1]);
      window.ticketQueue.cacheRef('destinations', results[2]);
      window.ticketQueue.cacheRef('cropTypes', results[3]);
    }

    // Load dashboard KPIs
    loadDashboard();
  });

  function getCropYear() {
    var now = new Date();
    var month = now.getMonth() + 1;
    return month <= 5 ? now.getFullYear() - 1 : now.getFullYear();
  }

  function loadDashboard() {
    var cropYear = getCropYear();
    // Update banner year
    var yearEl = document.getElementById('harvest-year');
    if (yearEl) yearEl.textContent = cropYear + ' Harvest';

    api.get('/api/tickets?cropYear=' + cropYear).then(function (tickets) {
      if (!Array.isArray(tickets)) return;
      var totalBU = 0;
      var totalMoisture = 0;
      var totalFm = 0;
      tickets.forEach(function (t) {
        if (t._computed) totalBU += (t._computed.netBU || 0);
        totalMoisture += (t.moisture || 0);
        totalFm += (t.fm || 0);
      });
      var n = tickets.length;

      var buEl = document.getElementById('harvest-bu');
      if (buEl) buEl.textContent = util.formatNum(totalBU, 0) + ' BU';

      var kpiBU = document.getElementById('kpi-season-bu');
      if (kpiBU) kpiBU.textContent = util.formatNum(totalBU, 0);

      var kpiCount = document.getElementById('kpi-ticket-count');
      if (kpiCount) kpiCount.textContent = n;

      var kpiMoist = document.getElementById('kpi-avg-moisture');
      if (kpiMoist) kpiMoist.textContent = n > 0 ? util.formatNum(totalMoisture / n, 1) + '%' : '--';

      var kpiFm = document.getElementById('kpi-avg-fm');
      if (kpiFm) kpiFm.textContent = n > 0 ? util.formatNum(totalFm / n, 2) + '%' : '--';
    }).catch(function () {});
  }

  // Reload dashboard when switching to home tab
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'home') loadDashboard();
  });

  // --- Offline Banner ---
  var offlineBanner = null;

  function createOfflineBanner() {
    offlineBanner = document.createElement('div');
    offlineBanner.id = 'offline-banner';
    offlineBanner.className = 'offline-banner hidden';
    offlineBanner.textContent = "You're offline \u2014 changes will sync when connected";
    document.body.insertBefore(offlineBanner, document.body.firstChild);
  }

  function showOfflineBanner() {
    if (!offlineBanner) return;
    offlineBanner.classList.remove('hidden');
    document.body.classList.add('has-offline-banner');
  }

  function hideOfflineBanner() {
    if (!offlineBanner) return;
    offlineBanner.classList.add('hidden');
    document.body.classList.remove('has-offline-banner');
  }

  createOfflineBanner();

  if (!navigator.onLine) {
    showOfflineBanner();
  }

  window.addEventListener('online', function () {
    hideOfflineBanner();
    window.dispatchEvent(new CustomEvent('app-online'));
  });

  window.addEventListener('offline', function () {
    showOfflineBanner();
  });

  // --- Service Worker message listener ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      var msg = event.data;
      if (!msg || msg.type !== 'ticket-sync-complete') return;

      var synced = msg.synced || 0;
      var conflicts = msg.conflicts || 0;

      if (synced > 0 || conflicts > 0) {
        var parts = [];
        if (synced > 0) parts.push('Synced ' + synced + ' ticket' + (synced === 1 ? '' : 's'));
        if (conflicts > 0) parts.push(conflicts + ' conflict' + (conflicts === 1 ? '' : 's') + ' need review');
        showSyncToast(parts.join(' \u2014 '));
      }

      window.dispatchEvent(new CustomEvent('tickets-synced', { detail: msg }));
    });
  }

  function showSyncToast(msg) {
    var existing = document.getElementById('sync-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'sync-toast';
    toast.className = 'sync-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('visible');
      });
    });

    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 4000);
  }

  // --- IndexedDB ticket queue (window.ticketQueue) ---

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

  function generateId() {
    return 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  window.ticketQueue = {
    add: function (ticketData) {
      return openTicketDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var entry = {
            id: generateId(),
            body: ticketData,
            status: 'pending',
            createdAt: Date.now(),
            retryCount: 0
          };
          var tx = db.transaction('ticket-queue', 'readwrite');
          var store = tx.objectStore('ticket-queue');
          var req = store.put(entry);
          req.onsuccess = function () { resolve(entry); };
          req.onerror = function (e) { reject(e.target.error); };
        });
      });
    },

    getAll: function () {
      return openTicketDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('ticket-queue', 'readonly');
          var store = tx.objectStore('ticket-queue');
          var req = store.getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function (e) { reject(e.target.error); };
        });
      });
    },

    getPending: function () {
      return window.ticketQueue.getAll().then(function (entries) {
        return entries.filter(function (e) { return e.status === 'pending'; });
      });
    },

    getConflicts: function () {
      return window.ticketQueue.getAll().then(function (entries) {
        return entries.filter(function (e) { return e.status === 'conflict'; });
      });
    },

    delete: function (id) {
      return openTicketDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('ticket-queue', 'readwrite');
          var store = tx.objectStore('ticket-queue');
          var req = store.delete(id);
          req.onsuccess = function () { resolve(); };
          req.onerror = function (e) { reject(e.target.error); };
        });
      });
    },

    update: function (id, fields) {
      return openTicketDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction('ticket-queue', 'readwrite');
          var store = tx.objectStore('ticket-queue');
          var getReq = store.get(id);
          getReq.onsuccess = function () {
            var existing = getReq.result;
            if (!existing) { resolve(); return; }
            var updated = Object.assign({}, existing, fields);
            var putReq = store.put(updated);
            putReq.onsuccess = function () { resolve(updated); };
            putReq.onerror = function (e) { reject(e.target.error); };
          };
          getReq.onerror = function (e) { reject(e.target.error); };
        });
      });
    },

    requestSync: function () {
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        return navigator.serviceWorker.ready.then(function (reg) {
          return reg.sync.register('ticket-sync');
        }).catch(function () {
          // Background Sync not available — trigger manual sync
          return window.ticketQueue._manualSync();
        });
      }
      // Fallback: manual sync
      return window.ticketQueue._manualSync();
    },

    // Manual sync fallback when Background Sync API is unavailable
    _manualSync: function () {
      return window.ticketQueue.getAll().then(function (entries) {
        var pending = entries.filter(function (e) {
          return e.status === 'pending' && (e.retryCount || 0) < 3;
        });
        pending.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });

        var synced = 0;
        var conflicts = 0;
        var failed = 0;

        var chain = Promise.resolve();
        pending.forEach(function (entry) {
          chain = chain.then(function () {
            return fetch('/api/tickets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(entry.body)
            }).then(function (r) {
              if (r.status === 201) {
                synced++;
                return window.ticketQueue.delete(entry.id);
              } else if (r.status === 409) {
                conflicts++;
                return r.json().then(function (data) {
                  return window.ticketQueue.update(entry.id, { status: 'conflict', conflictData: data });
                });
              } else {
                failed++;
                return r.json().then(function (data) {
                  return window.ticketQueue.update(entry.id, {
                    status: 'failed',
                    errorMessage: data.message || data.error || ('HTTP ' + r.status)
                  });
                });
              }
            }).catch(function () {
              var newRetry = (entry.retryCount || 0) + 1;
              failed++;
              return window.ticketQueue.update(entry.id, { retryCount: newRetry });
            });
          });
        });

        return chain.then(function () {
          if (synced > 0 || conflicts > 0) {
            window.dispatchEvent(new CustomEvent('tickets-synced', {
              detail: { synced: synced, conflicts: conflicts, failed: failed }
            }));
            var parts = [];
            if (synced > 0) parts.push('Synced ' + synced + ' ticket' + (synced === 1 ? '' : 's'));
            if (conflicts > 0) parts.push(conflicts + ' conflict' + (conflicts === 1 ? '' : 's') + ' need review');
            if (parts.length) showSyncToast(parts.join(' \u2014 '));
          }
        });
      });
    },

    // Cache reference data for offline use
    cacheRef: function (key, value) {
      return openTicketDB().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction('ref-cache', 'readwrite');
          var store = tx.objectStore('ref-cache');
          store.put({ key: key, value: value, cachedAt: Date.now() });
          tx.oncomplete = function () { resolve(); };
        });
      }).catch(function () { /* non-fatal */ });
    },

    // Read reference data from cache (fallback when offline)
    getRef: function (key) {
      return openTicketDB().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction('ref-cache', 'readonly');
          var store = tx.objectStore('ref-cache');
          var req = store.get(key);
          req.onsuccess = function () {
            resolve(req.result ? req.result.value : null);
          };
          req.onerror = function () { resolve(null); };
        });
      }).catch(function () { return null; });
    }
  };

})();
