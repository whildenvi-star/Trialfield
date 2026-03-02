/* settlements.js — Settlement import UI module
 * Follows the same vanilla JS pattern as tickets.js and farms.js
 * Called from tab activation in app.js (data-tab="settlements")
 */
(function () {
  'use strict';

  // Module state
  var settlementId = null;
  var parsedHeaders = [];
  var settlementsInitialized = false;

  // The 8 SettlementLine fields available for column mapping
  var SETTLEMENT_FIELDS = [
    { key: 'ticketNo',   label: 'Ticket Number',   required: true  },
    { key: 'date',       label: 'Date',             required: false },
    { key: 'netWeight',  label: 'Net Weight (lbs)', required: false },
    { key: 'moisture',   label: 'Moisture %',       required: false },
    { key: 'netBushels', label: 'Net Bushels',      required: false },
    { key: 'price',      label: 'Price ($/bu)',     required: false },
    { key: 'deductions', label: 'Deductions ($)',   required: false },
    { key: 'netPayment', label: 'Net Payment ($)',  required: false }
  ];

  // --- Crop year helper (same harvest-season logic as tickets.js) ---
  function getCropYear() {
    var now = new Date();
    var month = now.getMonth() + 1; // 1-12
    var year = now.getFullYear();
    // Jan-May = late delivery from prior harvest season
    return (month >= 1 && month <= 5) ? year - 1 : year;
  }

  // --- Wire tab-activate event to initialize settlements on first visit ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'settlements') {
      window.initSettlements();
    }
  });

  // --- Initialize settlements tab (called once on first tab visit) ---
  window.initSettlements = function () {
    if (settlementsInitialized) return;
    settlementsInitialized = true;

    // Sub-nav toggle: Import / History
    var subNav = document.querySelectorAll('.settlement-sub-nav button');
    subNav.forEach(function (btn) {
      btn.addEventListener('click', function () {
        subNav.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var target = btn.dataset.view;
        document.querySelectorAll('.settlement-view').forEach(function (v) {
          v.style.display = (v.id === 'settlement-' + target) ? 'block' : 'none';
        });
        if (target === 'history') loadSettlements();
      });
    });

    // File upload button
    var uploadBtn = document.getElementById('settlement-upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', handleFileUpload);

    // Commit button
    var commitBtn = document.getElementById('settlement-commit-btn');
    if (commitBtn) commitBtn.addEventListener('click', handleCommit);

    // Set default crop year
    var cropYearInput = document.getElementById('settlement-crop-year');
    if (cropYearInput && !cropYearInput.value) {
      cropYearInput.value = getCropYear();
    }

    // Populate buyers once ref data is loaded
    if (window.refData && window.refData.destinations && window.refData.destinations.length > 0) {
      loadSettlementBuyers();
    }
    document.addEventListener('ref-data-loaded', function () {
      loadSettlementBuyers();
      // Restore crop year default if ref-data fires after init
      var cy = document.getElementById('settlement-crop-year');
      if (cy && !cy.value) cy.value = getCropYear();
    });
  };

  // --- Populate buyer dropdown from refData.destinations (buyers only, not bins) ---
  window.loadSettlementBuyers = function () {
    var sel = document.getElementById('settlement-buyer');
    if (!sel) return;
    var current = sel.value;
    // Keep blank placeholder
    while (sel.options.length > 1) sel.remove(1);

    if (!window.refData || !window.refData.destinations) return;

    var buyers = window.refData.destinations.filter(function (d) { return d.type === 'buyer'; });
    buyers.sort(function (a, b) { return a.name.localeCompare(b.name); });
    buyers.forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b.id; // numeric buyer id
      opt.textContent = b.name + (b.shortCode ? ' (' + b.shortCode + ')' : '');
      sel.appendChild(opt);
    });

    // Restore previous selection if still valid
    if (current) sel.value = current;
  };

  // --- Handle file upload + parse ---
  window.handleFileUpload = function () {
    var buyerSel = document.getElementById('settlement-buyer');
    var cropYearInput = document.getElementById('settlement-crop-year');
    var fileInput = document.getElementById('settlement-file');
    var statusDiv = document.getElementById('settlement-status');

    var buyerId = buyerSel ? buyerSel.value : '';
    var cropYear = cropYearInput ? cropYearInput.value.trim() : '';
    var file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

    clearStatus();

    if (!buyerId) { showStatus('Please select a buyer.', 'error'); return; }
    if (!cropYear) { showStatus('Please enter a crop year.', 'error'); return; }
    if (!file) { showStatus('Please select a CSV or Excel file.', 'error'); return; }

    var formData = new FormData();
    formData.append('file', file);
    formData.append('buyerId', buyerId);
    formData.append('cropYear', cropYear);

    showStatus('Uploading and parsing file...', 'loading');
    var uploadBtn = document.getElementById('settlement-upload-btn');
    if (uploadBtn) uploadBtn.disabled = true;

    fetch('/api/settlements/parse', { method: 'POST', body: formData })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (uploadBtn) uploadBtn.disabled = false;
        if (!res.ok) {
          showStatus(res.data.error || 'Upload failed.', 'error');
          return;
        }
        settlementId = res.data.settlementId;
        parsedHeaders = res.data.headers;
        clearStatus();
        renderColumnMapping(res.data.headers, res.data.savedMapping || {});
        renderPreview(res.data.headers, res.data.previewRows || []);
        var commitBtn = document.getElementById('settlement-commit-btn');
        if (commitBtn) commitBtn.style.display = 'inline-block';
      })
      .catch(function (err) {
        if (uploadBtn) uploadBtn.disabled = false;
        showStatus('Upload error: ' + err.message, 'error');
      });
  };

  // --- Render column mapping panel (8 SettlementLine fields x file headers) ---
  window.renderColumnMapping = function (headers, savedMapping) {
    var container = document.getElementById('column-mapping-container');
    if (!container) return;
    container.innerHTML = '';

    SETTLEMENT_FIELDS.forEach(function (field) {
      var row = document.createElement('div');
      row.className = 'map-row';

      var label = document.createElement('label');
      label.textContent = field.label + (field.required ? ' *' : '');
      row.appendChild(label);

      var sel = document.createElement('select');
      sel.name = 'map-' + field.key;
      sel.dataset.field = field.key;

      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '-- skip --';
      sel.appendChild(blank);

      headers.forEach(function (h) {
        var opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        if (savedMapping[field.key] === h) opt.selected = true;
        sel.appendChild(opt);
      });

      row.appendChild(sel);
      container.appendChild(row);
    });

    var panel = document.getElementById('column-mapping-panel');
    if (panel) panel.style.display = 'block';
  };

  // --- Render 5-row data preview table ---
  window.renderPreview = function (headers, previewRows) {
    var container = document.getElementById('preview-table-container');
    if (!container) return;
    container.innerHTML = '';

    if (!headers.length) {
      container.innerHTML = '<p class="settlement-status">No columns found in file.</p>';
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'table-wrap';

    var tbl = document.createElement('table');
    tbl.className = 'preview-table';

    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    headers.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    tbl.appendChild(thead);

    var tbody = document.createElement('tbody');
    if (previewRows.length === 0) {
      var emptyRow = document.createElement('tr');
      var emptyTd = document.createElement('td');
      emptyTd.colSpan = headers.length;
      emptyTd.textContent = 'No data rows found.';
      emptyTd.style.textAlign = 'center';
      emptyTd.style.color = 'var(--text-light)';
      emptyRow.appendChild(emptyTd);
      tbody.appendChild(emptyRow);
    } else {
      previewRows.forEach(function (row) {
        var tr = document.createElement('tr');
        for (var i = 0; i < headers.length; i++) {
          var td = document.createElement('td');
          var val = row[i];
          // Format Date objects for display
          if (val instanceof Date) {
            td.textContent = val.toLocaleDateString();
          } else {
            td.textContent = val != null ? String(val) : '';
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    }
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);

    var caption = document.createElement('p');
    caption.style.fontSize = '0.8rem';
    caption.style.color = 'var(--text-light)';
    caption.style.marginTop = '0.5rem';
    caption.textContent = 'Showing up to 5 data rows from your file. Review before committing.';

    container.appendChild(wrapper);
    container.appendChild(caption);
    container.style.display = 'block';
  };

  // --- Handle commit — apply mapping, insert SettlementLines ---
  window.handleCommit = function () {
    if (!settlementId) {
      showStatus('No file uploaded. Please upload a file first.', 'error');
      return;
    }

    // Collect mapping from selects
    var mappingContainer = document.getElementById('column-mapping-container');
    var mapping = {};
    if (mappingContainer) {
      mappingContainer.querySelectorAll('select[data-field]').forEach(function (sel) {
        if (sel.value) mapping[sel.dataset.field] = sel.value;
      });
    }

    // Validate at least ticketNo is mapped
    if (!mapping.ticketNo) {
      showStatus('Please map the Ticket Number field before committing.', 'error');
      return;
    }

    var commitBtn = document.getElementById('settlement-commit-btn');
    if (commitBtn) commitBtn.disabled = true;
    showStatus('Committing import...', 'loading');

    fetch('/api/settlements/' + settlementId + '/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapping: mapping })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (commitBtn) commitBtn.disabled = false;
        if (!res.ok) {
          showStatus(res.data.error || 'Commit failed.', 'error');
          return;
        }
        // Success
        clearStatus();
        showToast('Import complete — ' + res.data.linesCreated + ' lines created.');
        resetImportForm();
        // Switch to history view
        var historyBtn = document.querySelector('.settlement-sub-nav button[data-view="history"]');
        if (historyBtn) historyBtn.click();
        else loadSettlements();
      })
      .catch(function (err) {
        if (commitBtn) commitBtn.disabled = false;
        showStatus('Commit error: ' + err.message, 'error');
      });
  };

  // --- Load and render settlement history list ---
  window.loadSettlements = function () {
    var container = document.getElementById('settlement-list-container');
    if (!container) return;
    container.innerHTML = '<p style="color:var(--text-light)">Loading...</p>';

    fetch('/api/settlements')
      .then(function (r) { return r.json(); })
      .then(function (settlements) {
        renderSettlementList(settlements, container);
      })
      .catch(function (err) {
        container.innerHTML = '<p style="color:var(--danger)">Error loading settlements: ' + err.message + '</p>';
      });
  };

  function renderSettlementList(settlements, container) {
    container.innerHTML = '';

    if (!settlements.length) {
      container.innerHTML = '<p style="color:var(--text-light);font-style:italic;">No settlements imported yet.</p>';
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'table-wrap';

    var tbl = document.createElement('table');
    tbl.className = 'settlement-list';

    var thead = document.createElement('thead');
    thead.innerHTML = '<tr>' +
      '<th>Buyer</th>' +
      '<th>Crop Year</th>' +
      '<th>Source File</th>' +
      '<th>Imported</th>' +
      '<th class="number">Lines</th>' +
      '<th></th>' +
      '</tr>';
    tbl.appendChild(thead);

    var tbody = document.createElement('tbody');
    settlements.forEach(function (s) {
      var tr = document.createElement('tr');
      var importedDate = s.importedAt ? new Date(s.importedAt).toLocaleDateString() : '--';
      var lineCount = s._count ? s._count.lines : (s.lines ? s.lines.length : '--');
      tr.innerHTML = '<td>' + escHtml(s.buyer ? s.buyer.name : '--') + '</td>' +
        '<td>' + escHtml(String(s.cropYear)) + '</td>' +
        '<td>' + escHtml(s.sourceFile || '--') + '</td>' +
        '<td>' + escHtml(importedDate) + '</td>' +
        '<td class="number">' + lineCount + '</td>' +
        '<td><button class="btn-danger" data-id="' + s.id + '">Delete</button></td>';
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);
    container.appendChild(wrapper);

    // Wire delete buttons
    container.querySelectorAll('.btn-danger[data-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleDeleteSettlement(parseInt(btn.dataset.id, 10));
      });
    });
  }

  // --- Handle delete settlement ---
  window.handleDeleteSettlement = function (id) {
    if (!confirm('Delete this settlement and all its lines? This cannot be undone.')) return;
    fetch('/api/settlements/' + id, { method: 'DELETE' })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          alert('Delete failed: ' + (res.data.error || 'Unknown error'));
          return;
        }
        showToast('Settlement deleted.');
        loadSettlements();
      })
      .catch(function (err) {
        alert('Delete error: ' + err.message);
      });
  };

  // --- Reset import form ---
  function resetImportForm() {
    settlementId = null;
    parsedHeaders = [];

    var fileInput = document.getElementById('settlement-file');
    if (fileInput) fileInput.value = '';

    var cropYearInput = document.getElementById('settlement-crop-year');
    if (cropYearInput) cropYearInput.value = getCropYear();

    var mappingPanel = document.getElementById('column-mapping-panel');
    if (mappingPanel) mappingPanel.style.display = 'none';

    var previewContainer = document.getElementById('preview-table-container');
    if (previewContainer) { previewContainer.innerHTML = ''; previewContainer.style.display = 'none'; }

    var commitBtn = document.getElementById('settlement-commit-btn');
    if (commitBtn) commitBtn.style.display = 'none';

    clearStatus();
  }

  // --- Status helpers ---
  function showStatus(msg, type) {
    var div = document.getElementById('settlement-status');
    if (!div) return;
    div.textContent = msg;
    div.className = 'settlement-status ' + (type || '');
    div.style.display = 'block';
  }

  function clearStatus() {
    var div = document.getElementById('settlement-status');
    if (!div) return;
    div.textContent = '';
    div.style.display = 'none';
  }

  function showToast(msg) {
    // Reuse existing toast element if available, else fallback to alert
    var toast = document.getElementById('entry-toast');
    if (toast) {
      toast.textContent = msg;
      toast.className = 'toast';
      setTimeout(function () { toast.className = 'toast hidden'; }, 3000);
    } else {
      alert(msg);
    }
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
