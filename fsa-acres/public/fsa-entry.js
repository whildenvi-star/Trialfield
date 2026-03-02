/* fsa-entry.js — Filtered/sorted/paginated table, inline edit, slide-in editor, bulk actions */
(function () {
  'use strict';

  var allRecords = [];
  var filtered = [];
  var sortCol = 'farmNumber';
  var sortDir = 'asc';
  var page = 0;
  var pageSize = 100;
  var selected = {};
  var loaded = false;

  document.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'fsa-entry') {
      if (!loaded) populateFilters();
      loadRecords();
    }
  });

  document.addEventListener('ref-data-loaded', function () {
    if (loaded) populateFilters();
  });

  function populateFilters() {
    loaded = true;
    var farmSel = util.$('fsa-farm-filter');
    var cropSel = util.$('fsa-crop-filter');
    var fieldSel = util.$('fsa-field-filter');

    api.get('/api/farm-numbers').then(function (farms) {
      farmSel.innerHTML = '<option value="">All Farms</option>';
      farms.forEach(function (f) {
        farmSel.innerHTML += '<option value="' + f.farmNumber + '">' + f.farmNumber + '</option>';
      });
    });
    api.get('/api/crop-names').then(function (names) {
      cropSel.innerHTML = '<option value="">All Crops</option>';
      names.forEach(function (n) {
        cropSel.innerHTML += '<option value="' + util.esc(n) + '">' + util.esc(n) + '</option>';
      });
    });
    api.get('/api/field-names').then(function (names) {
      fieldSel.innerHTML = '<option value="">All Fields</option>';
      names.forEach(function (n) {
        fieldSel.innerHTML += '<option value="' + util.esc(n) + '">' + util.esc(n) + '</option>';
      });
    });
  }

  function loadRecords() {
    api.get('/api/clu-records').then(function (data) {
      allRecords = data;
      applyFilters();
    });
  }

  // ===== Filtering =====
  function applyFilters() {
    var search = util.$('fsa-search').value.toLowerCase();
    var farm = util.$('fsa-farm-filter').value;
    var crop = util.$('fsa-crop-filter').value;
    var field = util.$('fsa-field-filter').value;
    var reported = util.$('fsa-reported-filter').value;
    var landClass = util.$('fsa-class-filter').value;

    filtered = allRecords.filter(function (r) {
      if (farm && r.farmNumber !== farm) return false;
      if (crop && r.crop !== crop) return false;
      if (field && r.fieldName !== field) return false;
      if (reported === 'true' && !r.reported) return false;
      if (reported === 'false' && r.reported) return false;
      if (landClass && r.landClass !== landClass) return false;
      if (search) {
        var hay = (r.fieldName + ' ' + r.crop + ' ' + r.farmNumber + ' ' + r.farmName + ' ' + r.tractNumber + ' ' + r.clu + ' ' + (r.landClass || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    sortRecords();
    page = 0;
    render();
  }

  // ===== Sorting =====
  function cmpVal(a, b, dir) {
    if (typeof a === 'number' && typeof b === 'number') {
      return dir === 'asc' ? a - b : b - a;
    }
    a = String(a || '').toLowerCase();
    b = String(b || '').toLowerCase();
    if (a < b) return dir === 'asc' ? -1 : 1;
    if (a > b) return dir === 'asc' ? 1 : -1;
    return 0;
  }

  function sortRecords() {
    filtered.sort(function (a, b) {
      // Primary: user-selected column
      var c = cmpVal(a[sortCol], b[sortCol], sortDir);
      if (c !== 0) return c;
      // Tiebreakers: farmNumber → tractNumber → clu (always ascending)
      c = cmpVal(a.farmNumber, b.farmNumber, 'asc');
      if (c !== 0) return c;
      c = cmpVal(a.tractNumber, b.tractNumber, 'asc');
      if (c !== 0) return c;
      return cmpVal(Number(a.clu) || 0, Number(b.clu) || 0, 'asc');
    });
  }

  // Header sort clicks
  util.$('fsa-table').querySelector('thead').addEventListener('click', function (e) {
    var th = e.target.closest('th[data-sort]');
    if (!th) return;
    var col = th.getAttribute('data-sort');
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    // Update header classes
    util.$('fsa-table').querySelectorAll('th').forEach(function (h) {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    sortRecords();
    render();
  });

  // ===== Land Class badge =====
  var LAND_CLASSES = ['Tillable', 'Hay/Forage', 'CRP', 'Grass/GLS', 'Idle', 'NC'];
  function landClassBadge(lc) {
    if (!lc) return '<span style="color:var(--text-light)">&mdash;</span>';
    var cls = 'badge-lc-' + lc.toLowerCase().replace(/[^a-z]/g, '');
    return '<span class="badge ' + cls + '">' + util.esc(lc) + '</span>';
  }

  // ===== Render =====
  function render() {
    var start = page * pageSize;
    var end = Math.min(start + pageSize, filtered.length);
    var slice = filtered.slice(start, end);

    // Info
    var totalAcres = 0;
    filtered.forEach(function (r) { totalAcres += r.fsaAcres || 0; });
    util.$('fsa-info').textContent = filtered.length + ' records | ' + util.comma(totalAcres) + ' acres';

    // Table body
    var html = '';
    slice.forEach(function (r) {
      var flags = '';
      if (r.irrigated) flags += '<span class="badge badge-irr">IRR</span> ';
      if (r.organic) flags += '<span class="badge badge-org">ORG</span> ';
      if (r.doubleCrop) flags += '<span class="badge badge-dc">DC</span> ';
      if (r.coverCrop || r.cc2025) flags += '<span class="badge badge-cc">CC</span> ';

      var statusBadge = r.reported
        ? '<span class="badge badge-reported">Reported</span>'
        : '<span class="badge badge-unreported">Unreported</span>';

      var rowCls = 'fsa-row';
      if (!r.crop || !r.crop.trim()) rowCls += ' row-missing-crop';
      else if (!r.grainPlantDate || !r.grainPlantDate.trim()) rowCls += ' row-missing-date';

      html += '<tr data-id="' + r.id + '" class="' + rowCls + '">' +
        '<td><input type="checkbox" class="row-checkbox fsa-cb" data-id="' + r.id + '"' + (selected[r.id] ? ' checked' : '') + '></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + util.esc(r.farmNumber) + '</td>' +
        '<td>' + util.esc(r.tractNumber) + '</td>' +
        '<td>' + util.esc(r.clu) + '</td>' +
        '<td>' + util.esc(r.fieldName) + '</td>' +
        '<td class="editable" data-id="' + r.id + '" data-field="landClass">' + landClassBadge(r.landClass) + '</td>' +
        '<td class="editable" data-id="' + r.id + '" data-field="crop">' + util.esc(r.crop) + '</td>' +
        '<td class="number editable" data-id="' + r.id + '" data-field="fsaAcres">' + util.comma(r.fsaAcres) + '</td>' +
        '<td>' + flags + '</td>' +
        '<td class="editable" data-id="' + r.id + '" data-field="grainPlantDate">' + util.esc(r.grainPlantDate) + '</td>' +
        '<td class="editable" data-id="' + r.id + '" data-field="use">' + util.esc(r.use) + '</td>' +
        '<td>' + util.esc(r.tillage2025) + '</td>' +
        '<td>' + util.esc(r.cc2025) + '</td>' +
        '<td>' + util.esc(r.unitNumber) + '</td>' +
        '<td>' + (r.aph || '') + '</td>' +
        '<td><button class="btn-danger fsa-delete" data-id="' + r.id + '">Del</button></td>' +
        '</tr>';
    });
    util.$('fsa-tbody').innerHTML = html;

    // Pagination
    renderPagination();
    bindEvents();
  }

  // ===== Pagination =====
  function renderPagination() {
    var totalPages = Math.ceil(filtered.length / pageSize);
    if (totalPages <= 1) { util.$('fsa-pagination').innerHTML = ''; return; }

    var html = '<button ' + (page === 0 ? 'disabled' : '') + ' class="pg-prev">&laquo; Prev</button>';
    for (var i = 0; i < totalPages; i++) {
      if (totalPages > 10 && Math.abs(i - page) > 2 && i !== 0 && i !== totalPages - 1) {
        if (i === 1 || i === totalPages - 2) html += '<span>...</span>';
        continue;
      }
      html += '<button class="pg-num' + (i === page ? ' active' : '') + '" data-page="' + i + '">' + (i + 1) + '</button>';
    }
    html += '<button ' + (page >= totalPages - 1 ? 'disabled' : '') + ' class="pg-next">Next &raquo;</button>';
    html += ' <select class="pg-size">' +
      '<option' + (pageSize === 50 ? ' selected' : '') + ' value="50">50/page</option>' +
      '<option' + (pageSize === 100 ? ' selected' : '') + ' value="100">100/page</option>' +
      '<option' + (pageSize === 250 ? ' selected' : '') + ' value="250">250/page</option>' +
      '<option' + (pageSize === 9999 ? ' selected' : '') + ' value="9999">All</option>' +
      '</select>';
    util.$('fsa-pagination').innerHTML = html;
  }

  util.$('fsa-pagination').addEventListener('click', function (e) {
    if (e.target.classList.contains('pg-prev') && page > 0) { page--; render(); }
    else if (e.target.classList.contains('pg-next')) { page++; render(); }
    else if (e.target.classList.contains('pg-num')) { page = Number(e.target.getAttribute('data-page')); render(); }
  });
  util.$('fsa-pagination').addEventListener('change', function (e) {
    if (e.target.classList.contains('pg-size')) {
      pageSize = Number(e.target.value);
      page = 0;
      render();
    }
  });

  // ===== Events =====
  function bindEvents() {
    // Row click → open editor
    util.$('fsa-tbody').querySelectorAll('.fsa-row').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        // Don't open editor for checkbox, delete, or editable cells
        if (e.target.closest('.fsa-cb') || e.target.closest('.fsa-delete') || e.target.closest('.editable')) return;
        var id = tr.getAttribute('data-id');
        var rec = allRecords.find(function (r) { return r.id === id; });
        if (rec) openEditor(rec, false, loadRecords);
      });
    });

    // Checkbox
    util.$('fsa-tbody').querySelectorAll('.fsa-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) selected[this.getAttribute('data-id')] = true;
        else delete selected[this.getAttribute('data-id')];
      });
    });

    // Delete
    util.$('fsa-tbody').querySelectorAll('.fsa-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        if (!confirm('Delete this record?')) return;
        api.del('/api/clu-records/' + id).then(function () {
          showToast('Record deleted');
          loadRecords();
        });
      });
    });

    // Inline editing (dblclick)
    util.$('fsa-tbody').querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        startInlineEdit(td);
      });
    });
  }

  // ===== Inline edit =====
  function startInlineEdit(td) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var rec = allRecords.find(function (r) { return r.id === id; });
    var currentVal = rec ? (rec[field] !== undefined ? String(rec[field]) : '') : td.textContent.trim();
    // Clean number formatting
    if (field === 'fsaAcres') currentVal = currentVal.replace(/,/g, '');

    td.classList.add('editing');
    td.textContent = '';

    var el;
    if (field === 'landClass') {
      el = document.createElement('select');
      el.innerHTML = '<option value="">--</option>';
      LAND_CLASSES.forEach(function (lc) {
        el.innerHTML += '<option value="' + lc + '"' + (currentVal === lc ? ' selected' : '') + '>' + lc + '</option>';
      });
    } else {
      el = document.createElement('input');
      el.type = field === 'fsaAcres' ? 'number' : 'text';
      if (field === 'fsaAcres') el.step = '0.01';
      el.value = currentVal;
    }
    td.appendChild(el);
    el.focus();
    if (el.select) el.select();

    function save() {
      var newVal = el.value;
      td.classList.remove('editing');

      var update = {};
      if (field === 'fsaAcres') {
        update[field] = Number(newVal) || 0;
        td.textContent = util.comma(update[field]);
      } else if (field === 'landClass') {
        update[field] = newVal;
        td.innerHTML = landClassBadge(newVal);
      } else {
        update[field] = newVal;
        td.textContent = newVal;
      }

      api.put('/api/clu-records/' + id, update).then(function (saved) {
        var rec = allRecords.find(function (r) { return r.id === id; });
        if (rec) Object.assign(rec, saved);
        showToast('Saved');
      }).catch(function () {
        showToast('Save failed', 'error');
        if (field === 'landClass') td.innerHTML = landClassBadge(currentVal);
        else td.textContent = currentVal;
      });
    }

    el.addEventListener('blur', save);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { el.blur(); }
      if (e.key === 'Escape') {
        td.classList.remove('editing');
        if (field === 'landClass') td.innerHTML = landClassBadge(currentVal);
        else td.textContent = currentVal;
      }
    });
    // For selects, also save on change
    if (field === 'landClass') {
      el.addEventListener('change', function () { el.blur(); });
    }
  }

  // ===== Select all =====
  util.$('fsa-select-all').addEventListener('change', function () {
    var checked = this.checked;
    var start = page * pageSize;
    var end = Math.min(start + pageSize, filtered.length);
    for (var i = start; i < end; i++) {
      if (checked) selected[filtered[i].id] = true;
      else delete selected[filtered[i].id];
    }
    util.$('fsa-tbody').querySelectorAll('.fsa-cb').forEach(function (cb) {
      cb.checked = checked;
    });
  });

  // ===== Mark reported =====
  util.$('fsa-mark-reported-btn').addEventListener('click', function () {
    var ids = Object.keys(selected);
    if (ids.length === 0) { showToast('No records selected', 'info'); return; }
    api.put('/api/clu-records/bulk', { ids: ids, updates: { reported: true } }).then(function (res) {
      showToast(res.updated + ' records marked reported');
      selected = {};
      loadRecords();
    });
  });

  util.$('fsa-mark-unreported-btn').addEventListener('click', function () {
    var ids = Object.keys(selected);
    if (ids.length === 0) { showToast('No records selected', 'info'); return; }
    api.put('/api/clu-records/bulk', { ids: ids, updates: { reported: false } }).then(function (res) {
      showToast(res.updated + ' records marked unreported');
      selected = {};
      loadRecords();
    });
  });

  // ===== Add record =====
  util.$('fsa-add-btn').addEventListener('click', function () {
    openEditor({
      farmNumber: '', farmName: '', tractNumber: '', clu: '', fieldName: '', crop: '',
      fsaAcres: 0, irrigated: false, organic: false, doubleCrop: false, coverCrop: false,
      grainPlantDate: '', use: '', tillage2025: '', cc2025: '', cc2025PlantDate: '',
      ntAdoption2025: '', ccAdoption2025: '', tillage2024: '', cc2024: '', cc2024PlantDate: '',
      ntAdoption2024: '', ccAdoption2024: '', cc2023Species: '', cc2023PlantDate: '',
      policyNumber: '', lineNumber: '', unitNumber: '', aph: 0
    }, true, loadRecords);
  });

  // ===== Filter event listeners =====
  util.$('fsa-search').addEventListener('input', debounce(applyFilters, 300));
  util.$('fsa-farm-filter').addEventListener('change', applyFilters);
  util.$('fsa-crop-filter').addEventListener('change', applyFilters);
  util.$('fsa-field-filter').addEventListener('change', applyFilters);
  util.$('fsa-reported-filter').addEventListener('change', applyFilters);
  util.$('fsa-class-filter').addEventListener('change', applyFilters);

  function debounce(fn, ms) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  // ===== Sync from Macro Roll Up =====
  var syncData = [];

  util.$('fsa-sync-macro-btn').addEventListener('click', function () {
    util.$('fsa-sync-macro-btn').disabled = true;
    util.$('fsa-sync-macro-btn').textContent = 'Loading...';
    api.get('/api/sync-crops/preview').then(function (data) {
      util.$('fsa-sync-macro-btn').disabled = false;
      util.$('fsa-sync-macro-btn').textContent = 'Sync from Macro';
      if (data.error) {
        showToast(data.error, 'error');
        return;
      }
      syncData = data.proposals || [];
      if (syncData.length === 0) {
        showToast('No tillable CLUs matched any budget fields — tag CLUs as Tillable first', 'info');
        return;
      }
      openSyncModal(syncData);
    }).catch(function () {
      util.$('fsa-sync-macro-btn').disabled = false;
      util.$('fsa-sync-macro-btn').textContent = 'Sync from Macro';
      showToast('Farm Budget unavailable — is port 3001 running?', 'error');
    });
  });

  function scoreClass(score) {
    if (score >= 90) return 'sync-score-high';
    if (score >= 70) return 'sync-score-mid';
    return 'sync-score-low';
  }

  function openSyncModal(proposals) {
    var overlay = util.$('sync-overlay');
    util.$('sync-subtitle').textContent = proposals.length + ' match' + (proposals.length === 1 ? '' : 'es') + ' found — review and confirm';

    var html = '<table class="sync-table"><thead><tr>' +
      '<th><input type="checkbox" id="sync-select-all" checked></th>' +
      '<th>Field</th><th>Farm#</th><th>CLU</th>' +
      '<th>Current Crop</th><th></th><th>New Crop</th>' +
      '<th>Match</th><th class="number">Acres</th>' +
      '</tr></thead><tbody>';

    proposals.forEach(function (p, i) {
      html += '<tr>' +
        '<td><input type="checkbox" class="sync-cb" data-idx="' + i + '" checked></td>' +
        '<td>' + util.esc(p.fieldName) + '</td>' +
        '<td>' + util.esc(p.farmNumber) + '</td>' +
        '<td>' + util.esc(p.clu) + '</td>' +
        '<td>' + util.esc(p.currentCrop || '(empty)') + '</td>' +
        '<td style="color:var(--primary)">&rarr;</td>' +
        '<td style="color:var(--primary);font-weight:600">' + util.esc(p.proposedCrop) + '</td>' +
        '<td><span class="' + scoreClass(p.matchScore) + '">' + p.matchScore + '%</span></td>' +
        '<td class="number">' + util.comma(p.fsaAcres) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    util.$('sync-body').innerHTML = html;

    // Select all toggle
    util.$('sync-select-all').addEventListener('change', function () {
      var checked = this.checked;
      document.querySelectorAll('.sync-cb').forEach(function (cb) { cb.checked = checked; });
      updateApplyCount();
    });
    document.querySelectorAll('.sync-cb').forEach(function (cb) {
      cb.addEventListener('change', updateApplyCount);
    });
    updateApplyCount();
    overlay.classList.add('visible');
  }

  function updateApplyCount() {
    var count = document.querySelectorAll('.sync-cb:checked').length;
    util.$('sync-apply').textContent = 'Apply ' + count + ' Change' + (count === 1 ? '' : 's');
    util.$('sync-apply').disabled = count === 0;
  }

  util.$('sync-close').addEventListener('click', closeSyncModal);
  util.$('sync-cancel').addEventListener('click', closeSyncModal);
  util.$('sync-overlay').addEventListener('click', function (e) {
    if (e.target === util.$('sync-overlay')) closeSyncModal();
  });

  function closeSyncModal() {
    util.$('sync-overlay').classList.remove('visible');
  }

  util.$('sync-apply').addEventListener('click', function () {
    var updates = [];
    document.querySelectorAll('.sync-cb:checked').forEach(function (cb) {
      var idx = Number(cb.getAttribute('data-idx'));
      var p = syncData[idx];
      if (p) updates.push({ cluId: p.cluId, crop: p.proposedCrop });
    });
    if (updates.length === 0) return;

    util.$('sync-apply').disabled = true;
    util.$('sync-apply').textContent = 'Applying...';

    api.post('/api/sync-crops/apply', { updates: updates }).then(function (res) {
      closeSyncModal();
      showToast('Updated ' + res.updated + ' CLU crop assignment' + (res.updated === 1 ? '' : 's'));
      loadRecords();
    }).catch(function () {
      util.$('sync-apply').disabled = false;
      updateApplyCount();
      showToast('Sync failed', 'error');
    });
  });

})();
