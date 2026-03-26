// App shell: tab navigation, API helpers, shared utilities
(function () {
  'use strict';

  // --- Tab Navigation ---
  var tabs = document.querySelectorAll('.tab-btn');
  var contents = document.querySelectorAll('.tab-content');

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-tab');
      tabs.forEach(function (b) { b.classList.remove('active'); });
      contents.forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
      window.dispatchEvent(new CustomEvent('tab-activate', { detail: target }));
    });
  });

  // --- Shared API helper ---
  var B = window.__BASE || '';
  window.api = {
    get: function (url) {
      return fetch(B + url).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Request failed'); });
        return r.json();
      });
    },
    post: function (url, body) {
      return fetch(B + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Request failed'); });
        return r.json();
      });
    },
    put: function (url, body) {
      return fetch(B + url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Request failed'); });
        return r.json();
      });
    },
    del: function (url) {
      return fetch(B + url, { method: 'DELETE' }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Request failed'); });
        return r.json();
      });
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
    formatMoney: function (n) {
      if (n === null || n === undefined || isNaN(n)) return '--';
      return '$' + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },
    showToast: function (msg, type) {
      var toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast' + (type === 'error' ? ' error' : '');
      setTimeout(function () { toast.classList.add('hidden'); }, 3000);
    },
    productLabel: function (p) {
      if (!p) return '(unknown)';
      if (p.type === 'SEED') return (p.brand ? p.brand + ' ' : '') + (p.variety || p.crop);
      return (p.brand ? p.brand + ' ' : '') + (p.productName || '');
    },
    supplierName: function (id, suppliers) {
      var s = suppliers.find(function (s) { return s.id === id; });
      return s ? s.name : '';
    },
    escapeHtml: function (str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    confirm: function (msg) {
      return new Promise(function (resolve) {
        var modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-modal-msg').textContent = msg;
        modal.classList.remove('hidden');
        function cleanup() {
          modal.classList.add('hidden');
          document.getElementById('confirm-modal-ok').removeEventListener('click', onOk);
          document.getElementById('confirm-modal-cancel').removeEventListener('click', onCancel);
        }
        function onOk() { cleanup(); resolve(true); }
        function onCancel() { cleanup(); resolve(false); }
        document.getElementById('confirm-modal-ok').addEventListener('click', onOk);
        document.getElementById('confirm-modal-cancel').addEventListener('click', onCancel);
      });
    }
  };

  // --- Shared reference data ---
  window.refData = {
    products: [],
    suppliers: [],
    settings: {}
  };

  function loadRefData() {
    return Promise.all([
      api.get('/api/products?active=true'),
      api.get('/api/suppliers'),
      api.get('/api/settings')
    ]).then(function (results) {
      window.refData.products = results[0];
      window.refData.suppliers = results[1];
      window.refData.settings = results[2];
      window.dispatchEvent(new Event('ref-data-loaded'));
    });
  }

  window.reloadRefData = loadRefData;
  loadRefData();

  // Allow other modules to trigger a ref-data reload (e.g. after budget sync creates products)
  window.addEventListener('ref-data-reload', loadRefData);

  // --- Crop Year selector (dashboard) ---
  var cropYearSelect = document.getElementById('crop-year-select');
  if (cropYearSelect) {
    cropYearSelect.addEventListener('change', function () {
      api.put('/api/settings', { cropYear: parseInt(cropYearSelect.value) }).then(function (settings) {
        window.refData.settings = settings;
        window.dispatchEvent(new Event('ref-data-loaded'));
        window.dispatchEvent(new CustomEvent('crop-year-changed', { detail: settings.cropYear }));
      });
    });
  }

  // Populate product/supplier dropdowns helper
  window.populateProductSelect = function (selectId, type) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var current = sel.value;
    var opts = '<option value="">Select product...</option>';
    window.refData.products.forEach(function (p) {
      if (type && p.type !== type) return;
      opts += '<option value="' + p.id + '">' + util.escapeHtml(util.productLabel(p)) + ' (' + p.type + ')</option>';
    });
    sel.innerHTML = opts;
    if (current) sel.value = current;
  };

  window.populateSupplierSelect = function (selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var current = sel.value;
    var opts = '<option value="">Select supplier...</option>';
    window.refData.suppliers.forEach(function (s) {
      opts += '<option value="' + s.id + '">' + util.escapeHtml(s.name) + '</option>';
    });
    sel.innerHTML = opts;
    if (current) sel.value = current;
  };

})();
