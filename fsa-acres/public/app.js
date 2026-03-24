/* app.js — Tab nav, API helper, utilities, ref data */
(function () {
  'use strict';

  // ===== API helper =====
  var B = window.__BASE || '';
  window.api = {
    get: function (url) {
      return fetch(B + url).then(function (r) { return r.json(); });
    },
    post: function (url, body) {
      return fetch(B + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); });
    },
    put: function (url, body) {
      return fetch(B + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); });
    },
    del: function (url) {
      return fetch(B + url, { method: 'DELETE' }).then(function (r) { return r.json(); });
    }
  };

  // ===== Utilities =====
  window.util = {
    $(id) { return document.getElementById(id); },
    comma: function (n) {
      if (n === null || n === undefined) return '';
      return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    commaInt: function (n) {
      if (n === null || n === undefined) return '';
      return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },
    dollar: function (n) {
      if (n === null || n === undefined) return '';
      return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    fmtNum: function (n, decimals) {
      if (n === null || n === undefined) return '--';
      return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
    },
    esc: function (s) {
      if (!s) return '';
      var div = document.createElement('div');
      div.textContent = String(s);
      return div.innerHTML;
    }
  };

  // ===== Toast =====
  var toastTimer = null;
  window.showToast = function (msg, type) {
    var el = util.$('toast');
    var msgEl = util.$('toast-msg');
    msgEl.textContent = msg;
    el.className = 'toast visible' + (type === 'error' ? ' toast-error' : type === 'info' ? ' toast-info' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'toast'; }, 3000);
  };

  // ===== Ref data =====
  window.refData = {
    farms: [],
    fieldNames: [],
    cropNames: [],
    tillageCodes: {}
  };

  function loadRefData() {
    Promise.all([
      api.get('/api/farm-numbers'),
      api.get('/api/field-names'),
      api.get('/api/crop-names'),
      api.get('/api/tillage-codes')
    ]).then(function (results) {
      refData.farms = results[0];
      refData.fieldNames = results[1];
      refData.cropNames = results[2];
      refData.tillageCodes = results[3];
      document.dispatchEvent(new CustomEvent('ref-data-loaded'));
    });
  }

  // ===== Tab navigation =====
  var tabs = document.querySelectorAll('.tab-btn');
  var contents = document.querySelectorAll('.tab-content');

  function activateTab(tabName) {
    tabs.forEach(function (b) { b.classList.remove('active'); });
    contents.forEach(function (c) { c.classList.remove('active'); });
    var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
    if (btn) btn.classList.add('active');
    var tabEl = util.$('tab-' + tabName);
    if (tabEl) tabEl.classList.add('active');
    document.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: tabName } }));
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
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', restoreTab);

  // ===== Editor overlay =====
  var overlay = util.$('editor-overlay');
  var editorState = { id: null, isNew: false, onSave: null };
  window.editorState = editorState;

  window.openEditor = function (record, isNew, onSave) {
    editorState.id = record ? record.id : null;
    editorState.isNew = !!isNew;
    editorState.onSave = onSave;

    // All editor field ids
    var fields = [
      'farmNumber', 'farmName', 'tractNumber', 'clu', 'fieldName', 'registryFieldId', 'crop', 'fsaAcres',
      'landClass', 'use', 'grainPlantDate', 'irrigated', 'organic', 'doubleCrop', 'coverCrop',
      'tillage2025', 'cc2025', 'cc2025PlantDate', 'ntAdoption2025', 'ccAdoption2025',
      'tillage2024', 'cc2024', 'cc2024PlantDate', 'ntAdoption2024', 'ccAdoption2024',
      'cc2023Species', 'cc2023PlantDate',
      'policyNumber', 'lineNumber', 'unitNumber', 'aph'
    ];

    fields.forEach(function (f) {
      var el = util.$('ed-' + f);
      if (!el) return;
      var val = record ? (record[f] !== undefined ? record[f] : '') : '';
      if (el.tagName === 'SELECT') {
        el.value = String(val);
      } else {
        el.value = val;
      }
    });

    util.$('editor-title').textContent = isNew ? 'New CLU Record' : 'Edit CLU Record';
    overlay.classList.add('visible');
  };

  window.closeEditor = function () {
    overlay.classList.remove('visible');
    editorState.id = null;
    editorState.onSave = null;
  };

  util.$('editor-close').addEventListener('click', closeEditor);
  util.$('editor-cancel').addEventListener('click', closeEditor);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeEditor();
  });

  util.$('editor-save').addEventListener('click', function () {
    var data = {};
    var fields = [
      'farmNumber', 'farmName', 'tractNumber', 'clu', 'fieldName', 'registryFieldId', 'crop',
      'landClass', 'use', 'grainPlantDate',
      'tillage2025', 'cc2025', 'cc2025PlantDate', 'ntAdoption2025', 'ccAdoption2025',
      'tillage2024', 'cc2024', 'cc2024PlantDate', 'ntAdoption2024', 'ccAdoption2024',
      'cc2023Species', 'cc2023PlantDate',
      'policyNumber', 'lineNumber', 'unitNumber'
    ];
    var numFields = ['fsaAcres', 'aph'];
    var boolFields = ['irrigated', 'organic', 'doubleCrop', 'coverCrop'];

    fields.forEach(function (f) {
      var el = util.$('ed-' + f);
      if (el) data[f] = el.value;
    });
    numFields.forEach(function (f) {
      var el = util.$('ed-' + f);
      if (el) data[f] = Number(el.value) || 0;
    });
    boolFields.forEach(function (f) {
      var el = util.$('ed-' + f);
      if (el) data[f] = el.value === 'true';
    });

    var promise;
    if (editorState.isNew) {
      promise = api.post('/api/clu-records', data);
    } else {
      promise = api.put('/api/clu-records/' + editorState.id, data);
    }

    promise.then(function () {
      showToast(editorState.isNew ? 'Record created' : 'Record saved');
      closeEditor();
      if (editorState.onSave) editorState.onSave();
      // Refresh ref data in case new farm/field/crop was added
      loadRefData();
    }).catch(function () {
      showToast('Save failed', 'error');
    });
  });

  // ===== Split CLU =====
  util.$('editor-split').addEventListener('click', function () {
    if (editorState.isNew || !editorState.id) {
      showToast('Save the record first, then split', 'info');
      return;
    }

    var currentAcres = Number(util.$('ed-fsaAcres').value) || 0;
    if (currentAcres <= 0) {
      showToast('Cannot split a record with 0 acres', 'error');
      return;
    }

    var splitAcres = prompt(
      'Split CLU: ' + util.$('ed-fieldName').value + ' (' + currentAcres + ' ac)\n\n' +
      'Enter acres for the NEW record.\n' +
      'The original will keep the remainder.'
    );
    if (!splitAcres) return;
    splitAcres = Number(splitAcres);
    if (!splitAcres || splitAcres <= 0 || splitAcres >= currentAcres) {
      showToast('Split acres must be between 0 and ' + currentAcres, 'error');
      return;
    }

    var newCrop = prompt(
      'What crop for the new ' + splitAcres + ' acre record?\n' +
      '(Leave blank to copy current crop: ' + (util.$('ed-crop').value || 'none') + ')'
    );
    if (newCrop === null) return; // cancelled
    if (!newCrop) newCrop = util.$('ed-crop').value || '';

    api.post('/api/clu-records/' + editorState.id + '/split', {
      splitAcres: splitAcres,
      newCrop: newCrop
    }).then(function (result) {
      var remaining = result.original.fsaAcres;
      showToast('Split: ' + remaining + ' ac + ' + splitAcres + ' ac (CLU ' + result.newRecord.clu + ')');
      closeEditor();
      if (editorState.onSave) editorState.onSave();
      loadRefData();
    }).catch(function () {
      showToast('Split failed', 'error');
    });
  });

  // Hide split button when creating new records
  var origOpen = window.openEditor;
  window.openEditor = function (record, isNew, onSave) {
    origOpen(record, isNew, onSave);
    util.$('editor-split').style.display = isNew ? 'none' : '';
  };

  // ===== Field Name Autocomplete (registry-backed, stores registryFieldId) =====
  // registryFields: array of { id, name, aliases, reportingAcres, organicAcres, ownership }
  var registryFields = [];

  function loadRegistryFields() {
    api.get('/api/registry/fields-autocomplete')
      .then(function (fields) { registryFields = fields || []; })
      .catch(function () { registryFields = []; });
  }

  (function initAutocomplete() {
    var input = util.$('ed-fieldName');
    var hiddenId = util.$('ed-registryFieldId');
    var dropdown = util.$('ac-fieldName-dropdown');
    var activeIdx = -1;
    // Track currently matched fields for keyboard navigation
    var currentMatches = [];

    function renderDropdown(matches) {
      currentMatches = matches;
      if (!matches.length) { dropdown.style.display = 'none'; return; }
      activeIdx = -1;
      dropdown.innerHTML = matches.map(function (field, i) {
        return '<div class="ac-item" data-idx="' + i + '">' + util.esc(field.name) + '</div>';
      }).join('');
      dropdown.style.display = '';
    }

    function selectItem(field) {
      input.value = field.name;
      // Store the canonical registry field ID alongside the display name
      if (hiddenId) hiddenId.value = field.id || '';
      dropdown.style.display = 'none';
      currentMatches = [];
    }

    function updateHighlight() {
      var items = dropdown.querySelectorAll('.ac-item');
      items.forEach(function (el, i) {
        el.classList.toggle('ac-active', i === activeIdx);
      });
      if (activeIdx >= 0 && items[activeIdx]) {
        items[activeIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    input.addEventListener('input', function () {
      // Clear registryFieldId when user types freely (selection required for ID)
      if (hiddenId) hiddenId.value = '';
      var q = input.value.trim().toLowerCase();
      if (!q) { dropdown.style.display = 'none'; currentMatches = []; return; }
      var matches = registryFields.filter(function (field) {
        return field.name.toLowerCase().indexOf(q) !== -1 ||
          (field.aliases || []).some(function (a) { return a.toLowerCase().indexOf(q) !== -1; });
      });
      // Sort: prefix matches first, then contains
      matches.sort(function (a, b) {
        var aStart = a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
        var bStart = b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
        if (aStart !== bStart) return aStart - bStart;
        return a.name.localeCompare(b.name);
      });
      renderDropdown(matches.slice(0, 12));
    });

    input.addEventListener('focus', function () {
      if (input.value.trim()) {
        input.dispatchEvent(new Event('input'));
      }
    });

    input.addEventListener('keydown', function (e) {
      var items = dropdown.querySelectorAll('.ac-item');
      if (!items.length || dropdown.style.display === 'none') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % items.length;
        updateHighlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
        updateHighlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && currentMatches[activeIdx]) {
          selectItem(currentMatches[activeIdx]);
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
        currentMatches = [];
      }
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.ac-item');
      if (item) {
        var idx = parseInt(item.getAttribute('data-idx'), 10);
        if (currentMatches[idx]) selectItem(currentMatches[idx]);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#ac-fieldName-wrapper')) {
        dropdown.style.display = 'none';
        currentMatches = [];
      }
    });
  })();

  // ===== Init =====
  loadRefData();
  loadRegistryFields();

  // Fire initial tab-activate — restore from hash or default to season
  setTimeout(function () {
    if (!restoreTab()) {
      activateTab('season');
    }
  }, 100);
})();
