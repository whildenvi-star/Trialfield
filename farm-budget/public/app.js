// App shell: tab navigation, shared API helper, utilities
(function () {
  'use strict';

  // --- Role-based access control ---
  // Role is injected by the portal via ?role= URL param.
  // Valid values: admin, agronomist, office, operator
  // Defaults to 'admin' so direct access (no portal) remains fully functional.
  var _role = new URLSearchParams(window.location.search).get('role') || 'admin';
  window.APP_ROLE = _role;
  document.documentElement.setAttribute('data-role', _role);

  // --- Portal postMessage bridge ---
  // Receives theme and text-scale changes from the Glomalin portal so the
  // settings panel in the portal header also controls this embedded app.
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data.type !== 'string') return;
    if (e.data.type === 'glomalin-theme') {
      if (e.data.theme === 'light') {
        document.body.classList.add('light');
      } else {
        document.body.classList.remove('light');
      }
    }
    if (e.data.type === 'glomalin-scale') {
      var scale = parseFloat(e.data.scale);
      if (!isNaN(scale)) {
        document.documentElement.style.setProperty('--text-scale', String(scale));
      }
    }
  });

  // --- API Helper ---
  var B = window.__BASE || '';
  window.api = {
    get: function (url) {
      return fetch(B + url).then(function (r) {
        if (!r.ok) throw new Error('API error ' + r.status);
        return r.json();
      });
    },
    post: function (url, data) {
      return fetch(B + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Error'); });
        return r.json();
      });
    },
    put: function (url, data) {
      return fetch(B + url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Error'); });
        return r.json();
      });
    },
    del: function (url) {
      return fetch(B + url, { method: 'DELETE' }).then(function (r) {
        if (!r.ok) throw new Error('Delete failed');
        return r.json();
      });
    }
  };

  // --- Utilities ---
  window.util = {
    formatNum: function (n, dec) {
      if (n === null || n === undefined || isNaN(n)) return '--';
      return Number(n).toLocaleString('en-US', {
        minimumFractionDigits: dec || 0,
        maximumFractionDigits: dec || 0
      });
    },
    formatMoney: function (n, dec) {
      if (n === null || n === undefined || isNaN(n)) return '--';
      return '$' + Number(n).toLocaleString('en-US', {
        minimumFractionDigits: dec === undefined ? 2 : dec,
        maximumFractionDigits: dec === undefined ? 2 : dec
      });
    },
    showToast: function (msg, duration, type) {
      var toast = document.getElementById('toast');
      var icons = { success: '\u2713', error: '\u2717', info: '\u2139' };
      var t = type || 'success';
      toast.className = 'toast toast-' + t;
      toast.innerHTML = '<span class="toast-icon">' + (icons[t] || '') + '</span>' +
        '<span>' + util.escHtml(msg) + '</span>';
      toast.offsetHeight; // force reflow
      toast.classList.add('visible');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(function () {
        toast.classList.remove('visible');
      }, duration || 3000);
    },
    showLoading: function (containerId, rows) {
      var el = document.getElementById(containerId);
      if (!el) return;
      var html = '';
      for (var i = 0; i < (rows || 5); i++) {
        html += '<div class="skeleton-row">' +
          '<div class="skeleton skeleton-cell"></div>' +
          '<div class="skeleton skeleton-cell"></div>' +
          '<div class="skeleton skeleton-cell"></div>' +
          '</div>';
      }
      el.innerHTML = html;
    },
    emptyState: function (icon, msg, hint) {
      return '<div class="empty-state">' +
        '<div class="empty-state-icon">' + (icon || '') + '</div>' +
        '<div class="empty-state-msg">' + util.escHtml(msg || 'No data yet') + '</div>' +
        (hint ? '<div class="empty-state-hint">' + util.escHtml(hint) + '</div>' : '') +
        '</div>';
    },
    escHtml: function (str) {
      var div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    },
    profitClass: function (val) {
      if (val > 0) return 'profit-pos';
      if (val < 0) return 'profit-neg';
      return '';
    },
    generateId: function (prefix) {
      return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    }
  };

  // --- Reference Data ---
  window.refData = {
    enterprises: [],
    cropNames: [],
    productNames: [],
    implementNames: [],
    seedVarieties: [],
    settings: {},
    products: [],
    implements: [],
    seeds: [],
    cropPricing: [],
    cropTypes: [],
    laborOverhead: [],
    buyers: [],
    suppliers: [],
    programs: [],
    unitPacks: [],
    machineryPrograms: [],
    quickPlanConfig: []
  };

  // Full reference data load: 12 API calls.
  // crop-names, product-names, implement-names, seed-varieties are derived
  // client-side from products/implements/seeds/cropTypes — no extra HTTP needed.
  function loadRefData() {
    return Promise.all([
      api.get('/api/enterprises'),
      api.get('/api/settings'),
      api.get('/api/products'),
      api.get('/api/implements'),
      api.get('/api/seeds'),
      api.get('/api/crop-pricing'),
      api.get('/api/crop-types'),
      api.get('/api/labor-overhead'),
      api.get('/api/buyers'),
      api.get('/api/suppliers'),
      api.get('/api/programs'),
      api.get('/api/unit-packs'),
      api.get('/api/machinery-programs'),
      api.get('/api/quick-plan-config')
    ]).then(function (results) {
      window.refData.enterprises = results[0];
      window.refData.settings = results[1];
      window.refData.products = results[2];
      window.refData.implements = results[3];
      window.refData.seeds = results[4];
      window.refData.cropPricing = results[5];
      window.refData.cropTypes = results[6];
      window.refData.laborOverhead = results[7];
      window.refData.buyers = results[8];
      window.refData.suppliers = results[9];
      window.refData.programs = results[10];
      window.refData.unitPacks = results[11] || [];
      window.refData.machineryPrograms = results[12] || [];
      window.refData.quickPlanConfig = results[13] || [];

      // Derive convenience lists client-side (saves 4 HTTP round-trips)
      deriveConvenienceLists();

      // Build enterprise dropdown menu and pill bar
      buildEnterpriseNav();

      // Populate search datalists
      populateDataLists();

      // Clear crop pricing cache so budgets use fresh pricing data
      if (typeof Calc !== 'undefined' && Calc.clearCropPricingCache) {
        Calc.clearCropPricingCache();
      }

      window.dispatchEvent(new Event('ref-data-loaded'));
    }).catch(function (err) {
      console.error('Failed to load reference data:', err);
    });
  }

  // Derive name lists from full datasets — no extra API calls needed.
  function deriveConvenienceLists() {
    // cropNames from cropTypes (or legacy cropPricing)
    if (window.refData.cropTypes && window.refData.cropTypes.length > 0) {
      var names = [];
      window.refData.cropTypes.forEach(function (ct) {
        (ct.subCrops || []).forEach(function (sc) { names.push(sc.name); });
      });
      window.refData.cropNames = names.filter(function (n, i, a) { return a.indexOf(n) === i; }).sort();
    } else {
      var cpNames = window.refData.cropPricing.map(function (cp) { return cp.crop; });
      window.refData.cropNames = cpNames.filter(function (n, i, a) { return a.indexOf(n) === i; }).sort();
    }
    // productNames from products
    window.refData.productNames = window.refData.products.map(function (p) { return p.name; }).sort();
    // implementNames from implements
    window.refData.implementNames = window.refData.implements.map(function (i) { return i.name; }).sort();
    // seedVarieties from seeds
    window.refData.seedVarieties = window.refData.seeds.map(function (s) {
      return { variety: s.variety, brand: s.brand, crop: s.crop, pricePerUnit: s.pricePerUnit };
    });
  }

  function populateDataLists() {
    var prodList = document.getElementById('prod-search-list');
    if (prodList) {
      prodList.innerHTML = window.refData.productNames.map(function (n) {
        return '<option value="' + util.escHtml(n) + '">';
      }).join('');
    }
    var implList = document.getElementById('impl-search-list');
    if (implList) {
      implList.innerHTML = window.refData.implementNames.map(function (n) {
        return '<option value="' + util.escHtml(n) + '">';
      }).join('');
    }
    // Populate field name datalist from all fields across enterprises,
    // merged with all active fields from the farm registry so that registry
    // fields that haven't yet been added to farm-budget still appear as suggestions.
    var fieldList = document.getElementById('field-name-list');
    if (fieldList) {
      var budgetPromise = api.get('/api/fields?all=true').catch(function () { return []; });
      var registryPromise = (typeof FarmRegistry !== 'undefined')
        ? FarmRegistry.getFields({ active: true }).catch(function () { return []; })
        : Promise.resolve([]);
      Promise.all([budgetPromise, registryPromise]).then(function (results) {
        var budgetFields = results[0] || [];
        var registryFields = results[1] || [];
        var names = [];
        var seen = {};
        budgetFields.forEach(function (f) {
          var n = f.name || '';
          if (n && !seen[n]) { seen[n] = true; names.push(n); }
        });
        registryFields.forEach(function (f) {
          var n = f.name || '';
          if (n && !seen[n]) { seen[n] = true; names.push(n); }
        });
        names.sort();
        fieldList.innerHTML = names.map(function (n) {
          return '<option value="' + util.escHtml(n) + '">';
        }).join('');
      });
    }
  }

  // Targeted reload: only re-fetch specific collections instead of all 11.
  // Usage: reloadRefData('products') or reloadRefData('products,seeds')
  // Passing no argument reloads everything (backward compat).
  window.reloadRefDataSelective = function (keys) {
    if (!keys) return loadRefData();
    var keyList = keys.split(',').map(function (k) { return k.trim(); });
    var fetches = keyList.map(function (k) { return api.get('/api/' + k); });
    return Promise.all(fetches).then(function (results) {
      var apiToRef = {
        'enterprises': 'enterprises', 'settings': 'settings',
        'products': 'products', 'implements': 'implements',
        'seeds': 'seeds', 'crop-pricing': 'cropPricing',
        'crop-types': 'cropTypes', 'labor-overhead': 'laborOverhead',
        'buyers': 'buyers', 'suppliers': 'suppliers', 'programs': 'programs',
        'unit-packs': 'unitPacks', 'machinery-programs': 'machineryPrograms',
        'quick-plan-config': 'quickPlanConfig'
      };
      keyList.forEach(function (k, i) {
        var refKey = apiToRef[k];
        if (refKey) window.refData[refKey] = results[i];
      });
      deriveConvenienceLists();
      populateDataLists();
      window.dispatchEvent(new Event('ref-data-loaded'));
    }).catch(function (err) {
      console.error('Failed to reload ref data:', err);
    });
  };

  // --- Enterprise Navigation ---
  function buildEnterpriseNav() {
    var menu = document.getElementById('enterprise-menu');
    var bar = document.getElementById('nav-enterprise-bar');
    var enterprises = window.refData.enterprises;

    // Build dropdown menu
    menu.innerHTML = enterprises.map(function (ent, idx) {
      return '<button data-enterprise-idx="' + idx + '">' + util.escHtml(ent.shortName || ent.name) + '</button>';
    }).join('');

    // Build pill bar
    bar.innerHTML = enterprises.map(function (ent, idx) {
      return '<button class="ent-pill" data-enterprise-idx="' + idx + '">' + util.escHtml(ent.shortName || ent.name) + '</button>';
    }).join('');

    // Dropdown item click
    menu.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-enterprise-idx'));
        activateEnterprise(idx);
        closeDropdown();
      });
    });

    // Pill click
    bar.querySelectorAll('.ent-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-enterprise-idx'));
        activateEnterprise(idx);
      });
    });
  }

  // --- Tab Navigation ---
  var tabSections = document.querySelectorAll('.tab-content');
  var currentEnterpriseIdx = 0;
  var dropdownOpen = false;

  // Enterprise dropdown trigger
  var trigger = document.getElementById('enterprise-trigger');
  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    var menu = document.getElementById('enterprise-menu');
    dropdownOpen = !dropdownOpen;
    if (dropdownOpen) {
      menu.classList.add('open');
    } else {
      menu.classList.remove('open');
    }
  });

  function closeDropdown() {
    dropdownOpen = false;
    document.getElementById('enterprise-menu').classList.remove('open');
  }

  // Close dropdown on outside click
  document.addEventListener('click', function () {
    closeDropdown();
  });

  function activateEnterprise(idx) {
    currentEnterpriseIdx = idx;
    location.hash = 'enterprise-' + idx;

    // Update pill active states
    var pills = document.querySelectorAll('.ent-pill');
    pills.forEach(function (p) { p.classList.remove('active'); });
    if (pills[idx]) pills[idx].classList.add('active');

    // Show enterprise bar
    document.getElementById('nav-enterprise-bar').classList.add('visible');

    // Update primary nav active states
    var navBtns = document.querySelectorAll('.nav-primary > .tab-btn, .nav-dropdown-trigger');
    navBtns.forEach(function (b) { b.classList.remove('active'); });
    document.getElementById('enterprise-trigger').classList.add('active');

    // Show enterprise tab content
    tabSections.forEach(function (sec) {
      sec.classList.remove('active');
      if (sec.id === 'tab-enterprise') sec.classList.add('active');
    });

    // Fire event
    window.dispatchEvent(new CustomEvent('tab-activate', {
      detail: { tab: 'enterprise', enterpriseIdx: currentEnterpriseIdx }
    }));
  }

  // Activate a regular (non-enterprise) tab by name
  function activateRegularTab(tabName) {
    var navBtns = document.querySelectorAll('.nav-primary > .tab-btn, .nav-dropdown-trigger');
    navBtns.forEach(function (b) { b.classList.remove('active'); });
    var btn = document.querySelector('.nav-primary > .tab-btn[data-tab="' + tabName + '"]');
    if (btn) btn.classList.add('active');

    // Sync bottom nav
    document.querySelectorAll('.app-bottom-nav .tab-btn').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.app-bottom-nav .tab-btn[data-tab="' + tabName + '"]').forEach(function(b){ b.classList.add('active'); });

    document.getElementById('nav-enterprise-bar').classList.remove('visible');

    tabSections.forEach(function (sec) {
      sec.classList.remove('active');
      if (sec.id === 'tab-' + tabName) sec.classList.add('active');
    });

    window.dispatchEvent(new CustomEvent('tab-activate', {
      detail: { tab: tabName, enterpriseIdx: currentEnterpriseIdx }
    }));
  }

  // Regular tab buttons (non-enterprise) — sidebar and bottom nav
  document.querySelectorAll('.nav-primary > .tab-btn[data-tab], .app-bottom-nav .tab-btn[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabName = btn.getAttribute('data-tab');
      location.hash = tabName;
      activateRegularTab(tabName);
    });
  });

  // Restore tab from URL hash on load / back-forward navigation
  var refDataReady = false;
  window.addEventListener('ref-data-loaded', function () { refDataReady = true; });

  function restoreTab() {
    var hash = location.hash.replace('#', '');
    if (!hash) return false;
    // Enterprise tab: hash = "enterprise-N"
    if (hash.indexOf('enterprise-') === 0) {
      var idx = parseInt(hash.split('-')[1], 10) || 0;
      if (refDataReady) {
        // Ref data already loaded — activate immediately
        activateEnterprise(idx);
      } else {
        // Initial page load — defer until ref data arrives (one-shot)
        window.addEventListener('ref-data-loaded', function onLoad() {
          window.removeEventListener('ref-data-loaded', onLoad);
          activateEnterprise(idx);
        });
      }
      return true;
    }
    // Regular tab
    if (document.querySelector('.nav-primary > .tab-btn[data-tab="' + hash + '"]')) {
      activateRegularTab(hash);
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', function () { restoreTab(); });

  window.getEnterpriseIdx = function () { return currentEnterpriseIdx; };
  window.setEnterpriseIdx = function (idx) { currentEnterpriseIdx = idx; };
  window.activateEnterprise = activateEnterprise;

  // Reload ref data helper (full reload — backward compat)
  window.reloadRefData = loadRefData;

  // --- Reference Sub-Navigation ---
  document.querySelectorAll('.ref-sub-btn[data-ref-sub]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.ref-sub-btn[data-ref-sub]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var sub = btn.getAttribute('data-ref-sub');
      document.querySelectorAll('#tab-reference .ref-sub-content').forEach(function (sec) {
        sec.classList.toggle('active', sec.id === 'ref-sub-' + sub);
      });
      // Trigger data loading for merged tabs
      if (sub === 'seeds') {
        window.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: 'seeds' } }));
      } else if (sub === 'forecast') {
        window.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: 'forecasts' } }));
      } else if (sub === 'demand') {
        window.dispatchEvent(new CustomEvent('demand-activate'));
      }
    });
  });

  // --- Role: hide restricted tabs ---
  // For operator role, remove Programs, Sales, and Map from the navigation entirely.
  if (_role === 'operator') {
    ['programs', 'sales', 'map'].forEach(function (tabName) {
      var btn = document.querySelector('.nav-primary > .tab-btn[data-tab="' + tabName + '"]');
      if (btn) btn.style.display = 'none';
    });
  }
  // For office role, remove Programs (bulk program management is admin-only).
  // Sales and Map remain accessible for contract entry and field geography.
  if (_role === 'office') {
    var btn = document.querySelector('.nav-primary > .tab-btn[data-tab="programs"]');
    if (btn) btn.style.display = 'none';
  }

  // --- Initial Load ---
  var restoredFromHash = restoreTab();
  loadRefData().then(function () {
    // Ensure dashboard loads on first visit (no hash = dashboard is default active tab)
    if (!restoredFromHash) {
      activateRegularTab('dashboard');
    }
  });
})();
