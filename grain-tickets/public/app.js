// App shell: tab navigation and shared utilities
(function () {
  'use strict';

  // --- Tab Navigation ---
  var tabs = document.querySelectorAll('.tab-btn');
  var contents = document.querySelectorAll('.tab-content');

  function activateTab(tabName) {
    tabs.forEach(function (b) { b.classList.remove('active'); });
    contents.forEach(function (c) { c.classList.remove('active'); });
    var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    if (btn) btn.classList.add('active');
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
  window.api = {
    get: function (url) {
      return fetch(url).then(function (r) { return r.json(); });
    },
    post: function (url, body) {
      return fetch(url, {
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
      return fetch(url, {
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
      return fetch(url, { method: 'DELETE' }).then(function (r) { return r.json(); });
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
  window.refData = { cropConfig: {}, farmNames: [], destinations: [] };

  Promise.all([
    api.get('/api/crops'),
    api.get('/api/farm-names'),
    api.get('/api/destinations')
  ]).then(function (results) {
    window.refData.cropConfig = results[0];
    window.refData.farmNames = results[1];
    window.refData.destinations = results[2];
    window.dispatchEvent(new Event('ref-data-loaded'));
  });

})();
