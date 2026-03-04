/* settlements.js — Settlement import UI module
 * Follows the same vanilla JS pattern as tickets.js and farms.js
 * Called from tab activation in app.js (data-tab="settlements")
 */
(function () {
  'use strict';

  // Module state
  var settlementId = null;          // active settlement for file import
  var manualSettlementId = null;    // active settlement for manual entry session
  var parsedHeaders = [];
  var settlementsInitialized = false;

  // Reconciliation selection state for manual linking
  var selectedFarmTicketId = null;
  var selectedSettlementLineId = null;

  // The 8 SettlementLine fields available for column mapping and manual entry
  var SETTLEMENT_FIELDS = [
    { key: 'ticketNo',   label: 'Ticket Number',   required: true,  type: 'text',   step: null,     placeholder: 'e.g. H066666' },
    { key: 'date',       label: 'Date',             required: false, type: 'date',   step: null,     placeholder: '' },
    { key: 'netWeight',  label: 'Net Weight (lbs)', required: false, type: 'number', step: '1',      placeholder: 'e.g. 55480' },
    { key: 'moisture',   label: 'Moisture %',       required: false, type: 'number', step: '0.1',    placeholder: 'e.g. 12.9' },
    { key: 'netBushels', label: 'Net Bushels',      required: false, type: 'number', step: '0.01',   placeholder: 'e.g. 985.3' },
    { key: 'price',      label: 'Price ($/bu)',     required: false, type: 'number', step: '0.0001', placeholder: 'e.g. 5.4500' },
    { key: 'deductions', label: 'Deductions ($)',   required: false, type: 'number', step: '0.01',   placeholder: 'e.g. 12.50' },
    { key: 'netPayment', label: 'Net Payment ($)',  required: false, type: 'number', step: '0.01',   placeholder: 'e.g. 5357.39' }
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

    // Sub-nav toggle: Import / Manual Entry / History
    var subNavBtns = document.querySelectorAll('.settlement-sub-nav .settlement-nav-btn');
    subNavBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        subNavBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var target = btn.dataset.view;
        // Hide all settlement views
        document.querySelectorAll('.settlement-view').forEach(function (v) {
          v.classList.add('hidden');
        });
        // Show target view
        var targetEl = document.getElementById('settlement-' + target);
        if (targetEl) targetEl.classList.remove('hidden');
        // Load data for specific views
        if (target === 'history') loadSettlements();
        if (target === 'manual') renderManualEntryView();
        if (target === 'reconciliation') loadReconciliation();
        if (target === 'season-summary') loadSeasonSummary();
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

  // --- Build buyer options HTML for a new select element ---
  function buildBuyerOptions(selectedId) {
    var html = '<option value="">Select buyer...</option>';
    if (!window.refData || !window.refData.destinations) return html;
    var buyers = window.refData.destinations.filter(function (d) { return d.type === 'buyer'; });
    buyers.sort(function (a, b) { return a.name.localeCompare(b.name); });
    buyers.forEach(function (b) {
      var sel = (String(b.id) === String(selectedId)) ? ' selected' : '';
      html += '<option value="' + b.id + '"' + sel + '>' + escHtml(b.name + (b.shortCode ? ' (' + b.shortCode + ')' : '')) + '</option>';
    });
    return html;
  }

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
        var matchMsg = '';
        if (res.data.matched !== undefined && res.data.unmatched !== undefined) {
          matchMsg = ', ' + res.data.matched + ' matched, ' + res.data.unmatched + ' unmatched';
        }
        showSettlementToast('Import complete: ' + res.data.linesCreated + ' lines' + matchMsg);
        showToast('Import complete — ' + res.data.linesCreated + ' lines created' + matchMsg + '.');
        resetImportForm();
        // Switch to history view
        var historyBtn = document.querySelector('.settlement-sub-nav .settlement-nav-btn[data-view="history"]');
        if (historyBtn) historyBtn.click();
        else loadSettlements();
      })
      .catch(function (err) {
        if (commitBtn) commitBtn.disabled = false;
        showStatus('Commit error: ' + err.message, 'error');
      });
  };

  // ============================================================
  // MANUAL ENTRY
  // ============================================================

  // --- Render the Manual Entry view ---
  window.renderManualEntryView = function () {
    var container = document.getElementById('settlement-manual');
    if (!container) return;

    if (manualSettlementId) {
      // Active manual session — show line entry form + lines table
      renderManualLineForm(container, manualSettlementId);
    } else {
      // No session yet — show "start" form
      renderManualStartForm(container);
    }
  };

  // --- Render "Start Manual Settlement" form (select buyer + crop year) ---
  function renderManualStartForm(container) {
    container.innerHTML = '';

    var card = document.createElement('div');
    card.className = 'import-form';

    var heading = document.createElement('h3');
    heading.textContent = 'Start Manual Settlement';
    heading.style.marginBottom = '1rem';
    card.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'form-grid';

    // Buyer select
    var buyerGroup = document.createElement('div');
    buyerGroup.className = 'form-group';
    var buyerLabel = document.createElement('label');
    buyerLabel.textContent = 'Buyer';
    buyerLabel.setAttribute('for', 'manual-buyer');
    var buyerSel = document.createElement('select');
    buyerSel.id = 'manual-buyer';
    buyerSel.innerHTML = buildBuyerOptions(null);
    buyerGroup.appendChild(buyerLabel);
    buyerGroup.appendChild(buyerSel);
    grid.appendChild(buyerGroup);

    // Crop year input
    var yearGroup = document.createElement('div');
    yearGroup.className = 'form-group';
    var yearLabel = document.createElement('label');
    yearLabel.textContent = 'Crop Year';
    yearLabel.setAttribute('for', 'manual-crop-year');
    var yearInput = document.createElement('input');
    yearInput.type = 'number';
    yearInput.id = 'manual-crop-year';
    yearInput.min = '2020';
    yearInput.max = '2099';
    yearInput.step = '1';
    yearInput.placeholder = 'e.g. 2025';
    yearInput.value = getCropYear();
    yearGroup.appendChild(yearLabel);
    yearGroup.appendChild(yearInput);
    grid.appendChild(yearGroup);

    // Start button
    var btnGroup = document.createElement('div');
    btnGroup.className = 'form-group';
    btnGroup.style.justifyContent = 'flex-end';
    btnGroup.style.paddingTop = '1.4rem';
    var startBtn = document.createElement('button');
    startBtn.className = 'btn-primary';
    startBtn.textContent = 'Start Manual Settlement';
    startBtn.addEventListener('click', function () {
      var buyerId = buyerSel.value;
      var cropYear = yearInput.value.trim();
      if (!buyerId) { alert('Please select a buyer.'); return; }
      if (!cropYear) { alert('Please enter a crop year.'); return; }

      startBtn.disabled = true;
      startBtn.textContent = 'Creating...';

      fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId: parseInt(buyerId, 10), cropYear: parseInt(cropYear, 10) })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok) {
            startBtn.disabled = false;
            startBtn.textContent = 'Start Manual Settlement';
            alert('Error creating settlement: ' + (res.data.error || 'Unknown error'));
            return;
          }
          manualSettlementId = res.data.id;
          showToast('Settlement created. Add lines below.');
          renderManualLineForm(container, manualSettlementId);
        })
        .catch(function (err) {
          startBtn.disabled = false;
          startBtn.textContent = 'Start Manual Settlement';
          alert('Error: ' + err.message);
        });
    });
    btnGroup.appendChild(startBtn);
    grid.appendChild(btnGroup);

    card.appendChild(grid);
    container.appendChild(card);
  }

  // --- Render active manual line entry form + lines table ---
  function renderManualLineForm(container, sId) {
    // First fetch settlement details and existing lines
    Promise.all([
      fetch('/api/settlements/' + sId).then(function (r) { return r.json(); }),
      fetch('/api/settlements/' + sId + '/lines').then(function (r) { return r.json(); })
    ]).then(function (results) {
      var settlement = results[0];
      var lines = results[1];
      buildManualLineUI(container, settlement, lines);
    }).catch(function (err) {
      container.innerHTML = '<p style="color:var(--danger)">Error loading settlement: ' + err.message + '</p>';
    });
  }

  function buildManualLineUI(container, settlement, lines) {
    container.innerHTML = '';

    // Session header
    var header = document.createElement('div');
    header.className = 'import-form';
    header.style.marginBottom = '1rem';
    var buyerName = settlement.buyer ? settlement.buyer.name : 'Unknown';
    header.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><strong>Settlement:</strong> ' + escHtml(buyerName) + ' — Crop Year ' + escHtml(String(settlement.cropYear)) + '</div>' +
      '<button id="manual-end-session-btn" class="btn-sm" style="color:var(--danger)">End Session</button>' +
      '</div>';
    container.appendChild(header);

    // Wire "End Session" button
    var endBtn = header.querySelector('#manual-end-session-btn');
    if (endBtn) {
      endBtn.addEventListener('click', function () {
        manualSettlementId = null;
        renderManualStartForm(container);
        showToast('Manual entry session ended.');
      });
    }

    // Lines table container (rendered/refreshed separately)
    var linesContainer = document.createElement('div');
    linesContainer.id = 'manual-lines-container';
    container.appendChild(linesContainer);
    renderManualLinesTable(linesContainer, settlement.id, lines);

    // Add Line form
    var formCard = document.createElement('div');
    formCard.className = 'import-form';
    formCard.style.marginTop = '1rem';

    var formHeading = document.createElement('h3');
    formHeading.textContent = 'Add Line';
    formHeading.style.marginBottom = '1rem';
    formCard.appendChild(formHeading);

    var grid = document.createElement('div');
    grid.className = 'form-grid';

    SETTLEMENT_FIELDS.forEach(function (field) {
      var group = document.createElement('div');
      group.className = 'form-group';

      var label = document.createElement('label');
      label.textContent = field.label;
      label.setAttribute('for', 'manual-field-' + field.key);
      group.appendChild(label);

      var input = document.createElement('input');
      input.type = field.type;
      input.id = 'manual-field-' + field.key;
      input.name = field.key;
      if (field.step) input.step = field.step;
      if (field.placeholder) input.placeholder = field.placeholder;
      group.appendChild(input);

      grid.appendChild(group);
    });

    // Notes field — full width
    var notesGroup = document.createElement('div');
    notesGroup.className = 'form-group full-width';
    var notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes';
    notesLabel.setAttribute('for', 'manual-field-notes');
    var notesInput = document.createElement('input');
    notesInput.type = 'text';
    notesInput.id = 'manual-field-notes';
    notesInput.name = 'notes';
    notesInput.placeholder = 'Optional note for this line';
    notesGroup.appendChild(notesLabel);
    notesGroup.appendChild(notesInput);
    grid.appendChild(notesGroup);

    formCard.appendChild(grid);

    // Submit button
    var addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.textContent = 'Add Line';
    addBtn.style.marginTop = '0.75rem';
    addBtn.addEventListener('click', function () {
      var body = {};
      SETTLEMENT_FIELDS.forEach(function (field) {
        var inp = document.getElementById('manual-field-' + field.key);
        if (inp) body[field.key] = inp.value;
      });
      var notesInp = document.getElementById('manual-field-notes');
      if (notesInp) body.notes = notesInp.value;

      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';

      fetch('/api/settlements/' + settlement.id + '/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          addBtn.disabled = false;
          addBtn.textContent = 'Add Line';
          if (!res.ok) {
            alert('Error adding line: ' + (res.data.error || 'Unknown error'));
            return;
          }
          // Clear all field inputs but keep settlement context
          SETTLEMENT_FIELDS.forEach(function (field) {
            var inp = document.getElementById('manual-field-' + field.key);
            if (inp) inp.value = '';
          });
          var notesInp2 = document.getElementById('manual-field-notes');
          if (notesInp2) notesInp2.value = '';

          showToast('Line added.');

          // Refresh lines table
          fetch('/api/settlements/' + settlement.id + '/lines')
            .then(function (r) { return r.json(); })
            .then(function (updatedLines) {
              renderManualLinesTable(linesContainer, settlement.id, updatedLines);
            });
        })
        .catch(function (err) {
          addBtn.disabled = false;
          addBtn.textContent = 'Add Line';
          alert('Error: ' + err.message);
        });
    });
    formCard.appendChild(addBtn);
    container.appendChild(formCard);
  }

  // --- Render the manual lines table (also used by detail view refresh) ---
  function renderManualLinesTable(container, sId, lines) {
    container.innerHTML = '';

    if (!lines || lines.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);font-style:italic;">No lines yet. Add the first line below.</p>';
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'table-wrap';
    var tbl = document.createElement('table');
    tbl.className = 'preview-table';

    tbl.innerHTML = '<thead><tr>' +
      '<th>Ticket No</th><th>Date</th><th class="number">Net Wt</th><th class="number">Moist%</th>' +
      '<th class="number">Net Bu</th><th class="number">Price</th><th class="number">Deductions</th>' +
      '<th class="number">Net Pay</th><th>Notes</th><th></th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    lines.forEach(function (line) {
      var tr = document.createElement('tr');
      tr.dataset.lineId = line.id;
      tr.innerHTML =
        '<td>' + escHtml(line.ticketNo || '') + '</td>' +
        '<td>' + formatDate(line.date) + '</td>' +
        '<td class="number">' + fmtNum(line.netWeight, 0) + '</td>' +
        '<td class="number">' + fmtNum(line.moisture, 1) + '</td>' +
        '<td class="number">' + fmtNum(line.netBushels, 2) + '</td>' +
        '<td class="number">' + fmtNum(line.price, 4) + '</td>' +
        '<td class="number">' + fmtNum(line.deductions, 2) + '</td>' +
        '<td class="number">' + fmtNum(line.netPayment, 2) + '</td>' +
        '<td>' + escHtml(line.notes || '') + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn-sm edit-line-btn" data-id="' + line.id + '">Edit</button> ' +
          '<button class="btn-sm btn-danger delete-line-btn" data-id="' + line.id + '">Del</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);
    container.appendChild(wrapper);

    // Wire delete buttons
    container.querySelectorAll('.delete-line-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lineId = parseInt(btn.dataset.id, 10);
        if (!confirm('Delete this line? This cannot be undone.')) return;
        fetch('/api/settlements/' + sId + '/lines/' + lineId, { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function () {
            showToast('Line deleted.');
            fetch('/api/settlements/' + sId + '/lines')
              .then(function (r) { return r.json(); })
              .then(function (updated) { renderManualLinesTable(container, sId, updated); });
          })
          .catch(function (err) { alert('Delete error: ' + err.message); });
      });
    });

    // Wire edit buttons — inline edit row
    container.querySelectorAll('.edit-line-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lineId = parseInt(btn.dataset.id, 10);
        var tr = container.querySelector('tr[data-line-id="' + lineId + '"]');
        if (!tr) return;
        makeLineEditable(tr, sId, lineId, container);
      });
    });
  }

  // --- Convert a line row to inline edit inputs (Escape=cancel, Enter/Save=commit) ---
  function makeLineEditable(tr, sId, lineId, linesContainer) {
    // Snapshot original HTML for cancel
    var originalHTML = tr.innerHTML;

    var line = null;
    // Find the line data from the row cells
    var cells = tr.querySelectorAll('td');
    // cells: 0=ticketNo, 1=date, 2=netWt, 3=moist, 4=netBu, 5=price, 6=ded, 7=netPay, 8=notes, 9=actions
    var fieldKeys = ['ticketNo', 'date', 'netWeight', 'moisture', 'netBushels', 'price', 'deductions', 'netPayment', 'notes'];
    var fieldTypes = ['text', 'date', 'number', 'number', 'number', 'number', 'number', 'number', 'text'];
    var fieldSteps = [null, null, '1', '0.1', '0.01', '0.0001', '0.01', '0.01', null];

    // Replace data cells with inputs
    for (var i = 0; i < fieldKeys.length; i++) {
      var td = cells[i];
      var currentVal = td.textContent.trim();
      var inp = document.createElement('input');
      inp.type = fieldTypes[i];
      inp.style.width = '100%';
      inp.style.minWidth = (fieldTypes[i] === 'date') ? '130px' : '70px';
      inp.style.fontSize = '0.85rem';
      if (fieldSteps[i]) inp.step = fieldSteps[i];
      if (fieldTypes[i] === 'date' && currentVal) {
        inp.value = currentVal; // already YYYY-MM-DD format from formatDate
      } else {
        inp.value = currentVal;
      }
      td.innerHTML = '';
      td.appendChild(inp);
    }

    // Replace action cell with Save/Cancel buttons
    var actionTd = cells[cells.length - 1];
    actionTd.innerHTML = '<button class="btn-sm btn-primary save-inline-btn">Save</button> ' +
      '<button class="btn-sm cancel-inline-btn">Cancel</button>';

    function doSave() {
      var body = {};
      for (var j = 0; j < fieldKeys.length; j++) {
        var inp2 = cells[j].querySelector('input');
        if (inp2) body[fieldKeys[j]] = inp2.value;
      }
      fetch('/api/settlements/' + sId + '/lines/' + lineId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok) { alert('Save failed: ' + (res.data.error || 'Unknown error')); return; }
          showToast('Line updated.');
          fetch('/api/settlements/' + sId + '/lines')
            .then(function (r) { return r.json(); })
            .then(function (updated) { renderManualLinesTable(linesContainer, sId, updated); });
        })
        .catch(function (err) { alert('Save error: ' + err.message); });
    }

    function doCancel() {
      tr.innerHTML = originalHTML;
      // Re-wire the edit/delete buttons
      var editBtn = tr.querySelector('.edit-line-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          makeLineEditable(tr, sId, lineId, linesContainer);
        });
      }
      var delBtn = tr.querySelector('.delete-line-btn');
      if (delBtn) {
        delBtn.addEventListener('click', function () {
          if (!confirm('Delete this line? This cannot be undone.')) return;
          fetch('/api/settlements/' + sId + '/lines/' + lineId, { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function () {
              showToast('Line deleted.');
              fetch('/api/settlements/' + sId + '/lines')
                .then(function (r) { return r.json(); })
                .then(function (updated) { renderManualLinesTable(linesContainer, sId, updated); });
            });
        });
      }
    }

    actionTd.querySelector('.save-inline-btn').addEventListener('click', doSave);
    actionTd.querySelector('.cancel-inline-btn').addEventListener('click', doCancel);

    // Enter key on any input = save; Escape = cancel
    tr.querySelectorAll('input').forEach(function (inp3) {
      inp3.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSave();
        if (e.key === 'Escape') doCancel();
      });
    });
  }

  // ============================================================
  // SETTLEMENT DETAIL VIEW
  // ============================================================

  // --- Show settlement detail view (works for file-import and manual settlements) ---
  window.showSettlementDetail = function (sId) {
    // Hide sub-nav active state (no button represents detail view)
    document.querySelectorAll('.settlement-sub-nav .settlement-nav-btn').forEach(function (b) {
      b.classList.remove('active');
    });

    // Hide all views
    document.querySelectorAll('.settlement-view').forEach(function (v) {
      v.classList.add('hidden');
    });

    var detailContainer = document.getElementById('settlement-detail');
    if (!detailContainer) return;
    detailContainer.classList.remove('hidden');
    detailContainer.innerHTML = '<p style="color:var(--text-light)">Loading...</p>';

    Promise.all([
      fetch('/api/settlements/' + sId).then(function (r) { return r.json(); }),
      fetch('/api/settlements/' + sId + '/lines').then(function (r) { return r.json(); })
    ]).then(function (results) {
      var settlement = results[0];
      var lines = results[1];
      buildDetailView(detailContainer, settlement, lines);
    }).catch(function (err) {
      detailContainer.innerHTML = '<p style="color:var(--danger)">Error loading settlement: ' + err.message + '</p>';
    });
  };

  function buildDetailView(container, settlement, lines) {
    container.innerHTML = '';

    // Back link
    var backLink = document.createElement('a');
    backLink.href = '#';
    backLink.textContent = '\u2190 Back to History';
    backLink.style.display = 'inline-block';
    backLink.style.marginBottom = '1rem';
    backLink.style.color = 'var(--primary)';
    backLink.addEventListener('click', function (e) {
      e.preventDefault();
      var histBtn = document.querySelector('.settlement-sub-nav .settlement-nav-btn[data-view="history"]');
      if (histBtn) histBtn.click();
    });
    container.appendChild(backLink);

    // Settlement header card
    var headerCard = document.createElement('div');
    headerCard.className = 'import-form';
    headerCard.style.marginBottom = '1rem';
    var buyerName = settlement.buyer ? settlement.buyer.name : 'Unknown';
    var sourceLabel = settlement.sourceFile ? escHtml(settlement.sourceFile) : '<em>Manual Entry</em>';
    var importedDate = settlement.importedAt ? new Date(settlement.importedAt).toLocaleDateString() : '--';
    headerCard.innerHTML =
      '<div style="display:flex;flex-wrap:wrap;gap:1.5rem;align-items:flex-end;">' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Buyer</span><br><strong>' + escHtml(buyerName) + '</strong></div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Crop Year</span><br><strong>' + escHtml(String(settlement.cropYear)) + '</strong></div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Source</span><br>' + sourceLabel + '</div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Date</span><br>' + escHtml(importedDate) + '</div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Lines</span><br><strong>' + lines.length + '</strong></div>' +
      '<div style="margin-left:auto;"><button id="rematch-btn" class="btn-sm">Re-match Tickets</button></div>' +
      '</div>';
    container.appendChild(headerCard);

    // Wire Re-match button
    var rematchBtn = headerCard.querySelector('#rematch-btn');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', function () {
        rematchBtn.disabled = true;
        rematchBtn.textContent = 'Re-matching...';
        fetch('/api/settlements/' + settlement.id + '/rematch', { method: 'POST' })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
          .then(function (res) {
            rematchBtn.disabled = false;
            rematchBtn.textContent = 'Re-match Tickets';
            if (!res.ok) {
              showSettlementToast('Re-match failed: ' + (res.data.error || 'Unknown error'));
              return;
            }
            var d = res.data;
            showSettlementToast('Re-matched: ' + (d.matched || 0) + ' matched, ' + (d.unmatched || 0) + ' unmatched');
            showToast('Re-matched: ' + (d.matched || 0) + ' matched, ' + (d.unmatched || 0) + ' unmatched');
          })
          .catch(function (err) {
            rematchBtn.disabled = false;
            rematchBtn.textContent = 'Re-match Tickets';
            showSettlementToast('Re-match error: ' + err.message);
          });
      });
    }

    // Lines table container
    var linesContainer = document.createElement('div');
    linesContainer.id = 'detail-lines-container';
    container.appendChild(linesContainer);
    renderDetailLinesTable(linesContainer, settlement.id, lines);

    // "Add Line" button
    var addLineBtn = document.createElement('button');
    addLineBtn.className = 'btn-primary';
    addLineBtn.textContent = 'Add Line';
    addLineBtn.style.marginTop = '1rem';
    addLineBtn.addEventListener('click', function () {
      // Inline add-line form below the button
      addLineBtn.style.display = 'none';
      var formDiv = document.createElement('div');
      formDiv.className = 'import-form';
      formDiv.style.marginTop = '1rem';
      formDiv.innerHTML = '<h3 style="margin-bottom:1rem;">Add Line</h3>';
      var grid = document.createElement('div');
      grid.className = 'form-grid';

      SETTLEMENT_FIELDS.forEach(function (field) {
        var group = document.createElement('div');
        group.className = 'form-group';
        var lbl = document.createElement('label');
        lbl.textContent = field.label;
        lbl.setAttribute('for', 'detail-add-' + field.key);
        var inp = document.createElement('input');
        inp.type = field.type;
        inp.id = 'detail-add-' + field.key;
        inp.name = field.key;
        if (field.step) inp.step = field.step;
        if (field.placeholder) inp.placeholder = field.placeholder;
        group.appendChild(lbl);
        group.appendChild(inp);
        grid.appendChild(group);
      });

      var notesGroup = document.createElement('div');
      notesGroup.className = 'form-group full-width';
      var notesLbl = document.createElement('label');
      notesLbl.textContent = 'Notes';
      notesLbl.setAttribute('for', 'detail-add-notes');
      var notesInp = document.createElement('input');
      notesInp.type = 'text';
      notesInp.id = 'detail-add-notes';
      notesInp.placeholder = 'Optional note';
      notesGroup.appendChild(notesLbl);
      notesGroup.appendChild(notesInp);
      grid.appendChild(notesGroup);

      formDiv.appendChild(grid);

      var btnRow = document.createElement('div');
      btnRow.style.marginTop = '0.75rem';
      var saveBtn = document.createElement('button');
      saveBtn.className = 'btn-primary';
      saveBtn.textContent = 'Add Line';
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-sm';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.marginLeft = '0.5rem';
      btnRow.appendChild(saveBtn);
      btnRow.appendChild(cancelBtn);
      formDiv.appendChild(btnRow);
      container.appendChild(formDiv);

      cancelBtn.addEventListener('click', function () {
        formDiv.remove();
        addLineBtn.style.display = 'inline-block';
      });

      saveBtn.addEventListener('click', function () {
        var body = {};
        SETTLEMENT_FIELDS.forEach(function (field) {
          var inp2 = document.getElementById('detail-add-' + field.key);
          if (inp2) body[field.key] = inp2.value;
        });
        var ni = document.getElementById('detail-add-notes');
        if (ni) body.notes = ni.value;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Adding...';

        fetch('/api/settlements/' + settlement.id + '/lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
          .then(function (res) {
            if (!res.ok) {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Add Line';
              alert('Error: ' + (res.data.error || 'Unknown error'));
              return;
            }
            showToast('Line added.');
            formDiv.remove();
            addLineBtn.style.display = 'inline-block';
            fetch('/api/settlements/' + settlement.id + '/lines')
              .then(function (r) { return r.json(); })
              .then(function (updated) {
                renderDetailLinesTable(linesContainer, settlement.id, updated);
                // Update header count
                var countEl = headerCard.querySelector('strong:last-of-type');
                // Simple reload of header section
                buildDetailView(container, Object.assign({}, settlement, { buyer: settlement.buyer }), updated);
              });
          })
          .catch(function (err) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Add Line';
            alert('Error: ' + err.message);
          });
      });
    });
    container.appendChild(addLineBtn);
  }

  // --- Render detail view lines table (with inline edit/delete, same as manual entry) ---
  function renderDetailLinesTable(container, sId, lines) {
    container.innerHTML = '';

    if (!lines || lines.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);font-style:italic;">No lines in this settlement.</p>';
      return;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'table-wrap';
    var tbl = document.createElement('table');
    tbl.className = 'preview-table';
    tbl.innerHTML = '<thead><tr>' +
      '<th>Ticket No</th><th>Date</th><th class="number">Net Wt</th><th class="number">Moist%</th>' +
      '<th class="number">Net Bu</th><th class="number">Price</th><th class="number">Deductions</th>' +
      '<th class="number">Net Pay</th><th>Notes</th><th></th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    lines.forEach(function (line) {
      var tr = document.createElement('tr');
      tr.dataset.lineId = line.id;
      tr.innerHTML =
        '<td>' + escHtml(line.ticketNo || '') + '</td>' +
        '<td>' + formatDate(line.date) + '</td>' +
        '<td class="number">' + fmtNum(line.netWeight, 0) + '</td>' +
        '<td class="number">' + fmtNum(line.moisture, 1) + '</td>' +
        '<td class="number">' + fmtNum(line.netBushels, 2) + '</td>' +
        '<td class="number">' + fmtNum(line.price, 4) + '</td>' +
        '<td class="number">' + fmtNum(line.deductions, 2) + '</td>' +
        '<td class="number">' + fmtNum(line.netPayment, 2) + '</td>' +
        '<td>' + escHtml(line.notes || '') + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn-sm edit-line-btn" data-id="' + line.id + '">Edit</button> ' +
          '<button class="btn-sm btn-danger delete-line-btn" data-id="' + line.id + '">Del</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);
    container.appendChild(wrapper);

    // Wire delete buttons
    container.querySelectorAll('.delete-line-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lineId = parseInt(btn.dataset.id, 10);
        if (!confirm('Delete this line? This cannot be undone.')) return;
        fetch('/api/settlements/' + sId + '/lines/' + lineId, { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function () {
            showToast('Line deleted.');
            fetch('/api/settlements/' + sId + '/lines')
              .then(function (r) { return r.json(); })
              .then(function (updated) { renderDetailLinesTable(container, sId, updated); });
          })
          .catch(function (err) { alert('Delete error: ' + err.message); });
      });
    });

    // Wire edit buttons — inline edit row
    container.querySelectorAll('.edit-line-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lineId = parseInt(btn.dataset.id, 10);
        var tr = container.querySelector('tr[data-line-id="' + lineId + '"]');
        if (!tr) return;
        makeLineEditable(tr, sId, lineId, container);
      });
    });
  }

  // ============================================================
  // SETTLEMENT HISTORY
  // ============================================================

  // --- Load and render settlement history list ---
  window.loadSettlements = function () {
    var container = document.getElementById('settlement-history');
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
      container.innerHTML = '<p style="color:var(--text-light);font-style:italic;">No settlements yet.</p>';
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
      '<th>Source</th>' +
      '<th>Date</th>' +
      '<th class="number">Lines</th>' +
      '<th></th>' +
      '</tr>';
    tbl.appendChild(thead);

    var tbody = document.createElement('tbody');
    settlements.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      var importedDate = s.importedAt ? new Date(s.importedAt).toLocaleDateString() : '--';
      var lineCount = s._count ? s._count.lines : (s.lines ? s.lines.length : '--');
      var sourceLabel = s.sourceFile ? escHtml(s.sourceFile) : 'Manual Entry';
      tr.innerHTML = '<td>' + escHtml(s.buyer ? s.buyer.name : '--') + '</td>' +
        '<td>' + escHtml(String(s.cropYear)) + '</td>' +
        '<td>' + sourceLabel + '</td>' +
        '<td>' + escHtml(importedDate) + '</td>' +
        '<td class="number">' + lineCount + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn-sm view-settlement-btn" data-id="' + s.id + '">View</button> ' +
          '<button class="btn-sm btn-danger delete-settlement-btn" data-id="' + s.id + '">Delete</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);
    container.appendChild(wrapper);

    // Wire view buttons
    container.querySelectorAll('.view-settlement-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.showSettlementDetail(parseInt(btn.dataset.id, 10));
      });
    });

    // Wire row click for detail view
    container.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON') return; // let button handle its own click
        var viewBtn = tr.querySelector('.view-settlement-btn');
        if (viewBtn) window.showSettlementDetail(parseInt(viewBtn.dataset.id, 10));
      });
    });

    // Wire delete buttons
    container.querySelectorAll('.delete-settlement-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
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

  // ============================================================
  // HELPERS
  // ============================================================

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

  // --- Format a date value to YYYY-MM-DD ---
  function formatDate(val) {
    if (!val) return '';
    var d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var day = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // --- Format a numeric/decimal value to N decimal places ---
  function fmtNum(val, decimals) {
    if (val == null || val === '') return '';
    var n = parseFloat(val);
    if (isNaN(n)) return String(val);
    return n.toFixed(decimals);
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

  // ============================================================
  // RECONCILIATION VIEW
  // ============================================================

  // --- Settlement toast (distinct from entry toast, appears bottom-right) ---
  function showSettlementToast(msg, duration) {
    duration = duration || 4000;
    var toast = document.getElementById('settlement-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'settlement-toast';
      toast.className = 'settlement-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () {
      toast.classList.remove('visible');
    }, duration);
  }

  // --- Load the reconciliation view ---
  function loadReconciliation() {
    var container = document.getElementById('settlement-reconciliation');
    if (!container) return;
    container.innerHTML = '';

    // Filter bar
    var filterCard = document.createElement('div');
    filterCard.className = 'import-form';
    filterCard.style.marginBottom = '1.5rem';

    var filterGrid = document.createElement('div');
    filterGrid.className = 'form-grid';
    filterGrid.style.marginBottom = '0';

    // Buyer dropdown
    var buyerGroup = document.createElement('div');
    buyerGroup.className = 'form-group';
    var buyerLabel = document.createElement('label');
    buyerLabel.textContent = 'Buyer';
    buyerLabel.setAttribute('for', 'recon-buyer');
    var buyerSel = document.createElement('select');
    buyerSel.id = 'recon-buyer';
    buyerSel.innerHTML = buildBuyerOptions(null);
    buyerGroup.appendChild(buyerLabel);
    buyerGroup.appendChild(buyerSel);
    filterGrid.appendChild(buyerGroup);

    // Crop year dropdown (populated from known crop years)
    var yearGroup = document.createElement('div');
    yearGroup.className = 'form-group';
    var yearLabel = document.createElement('label');
    yearLabel.textContent = 'Crop Year';
    yearLabel.setAttribute('for', 'recon-crop-year');
    var yearSel = document.createElement('select');
    yearSel.id = 'recon-crop-year';
    var currentCropYear = getCropYear();
    // Build a reasonable range of crop years
    var yearOptions = '<option value="">Select year...</option>';
    for (var y = currentCropYear; y >= currentCropYear - 5; y--) {
      yearOptions += '<option value="' + y + '"' + (y === currentCropYear ? ' selected' : '') + '>' + y + '</option>';
    }
    yearSel.innerHTML = yearOptions;
    yearGroup.appendChild(yearLabel);
    yearGroup.appendChild(yearSel);
    filterGrid.appendChild(yearGroup);

    // Load button
    var loadGroup = document.createElement('div');
    loadGroup.className = 'form-group';
    loadGroup.style.justifyContent = 'flex-end';
    loadGroup.style.paddingTop = '1.4rem';
    var loadBtn = document.createElement('button');
    loadBtn.className = 'btn-primary';
    loadBtn.textContent = 'Load';
    loadBtn.id = 'recon-load-btn';
    loadGroup.appendChild(loadBtn);
    filterGrid.appendChild(loadGroup);

    filterCard.appendChild(filterGrid);
    container.appendChild(filterCard);

    // Tolerance Settings panel (collapsible, between filter bar and results)
    var tolerancePanel = document.createElement('div');
    tolerancePanel.className = 'import-form';
    tolerancePanel.style.cssText = 'margin-bottom:1.5rem;';
    tolerancePanel.id = 'recon-tolerance-panel';

    var toleranceHeader = document.createElement('div');
    toleranceHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;cursor:pointer;';
    toleranceHeader.id = 'recon-tolerance-header';

    var toleranceTitle = document.createElement('span');
    toleranceTitle.style.cssText = 'font-size:0.85rem;font-weight:500;color:var(--text);';
    toleranceTitle.textContent = 'Tolerance Settings';

    var toleranceToggle = document.createElement('button');
    toleranceToggle.style.cssText = 'background:none;border:none;color:var(--text-light);cursor:pointer;font-size:0.85rem;padding:0;';
    toleranceToggle.id = 'recon-tolerance-toggle';

    // Restore expanded state from localStorage
    var toleranceExpanded = localStorage.getItem('recon-tolerance-expanded') === 'true';

    toleranceHeader.appendChild(toleranceTitle);
    toleranceHeader.appendChild(toleranceToggle);
    tolerancePanel.appendChild(toleranceHeader);

    var toleranceBody = document.createElement('div');
    toleranceBody.id = 'recon-tolerance-body';
    toleranceBody.style.cssText = 'margin-top:0.75rem;';
    tolerancePanel.appendChild(toleranceBody);

    container.appendChild(tolerancePanel);

    // Helper to show/hide tolerance body and update toggle label
    function setToleranceExpanded(expanded) {
      toleranceExpanded = expanded;
      localStorage.setItem('recon-tolerance-expanded', expanded ? 'true' : 'false');
      toleranceBody.style.display = expanded ? 'block' : 'none';
      toleranceToggle.textContent = expanded ? '- Collapse' : '+ Expand';
    }

    // Helper to load and render tolerance settings for a given crop year
    function loadToleranceSettings(cropYear) {
      if (!toleranceExpanded || !cropYear) return;
      toleranceBody.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Loading...</p>';
      fetch('/api/crop-config/tolerances?cropYear=' + cropYear)
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          toleranceBody.innerHTML = '';
          if (!rows || rows.length === 0) {
            var noData = document.createElement('p');
            noData.style.cssText = 'font-size:0.85rem;color:var(--text-light);font-style:italic;';
            noData.textContent = 'No crop configurations found for ' + cropYear + '. Add crops in the admin panel first.';
            toleranceBody.appendChild(noData);
            return;
          }

          // Table of crops with editable tolerance inputs
          var tbl = document.createElement('table');
          tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:0.85rem;';

          var thead = document.createElement('thead');
          thead.innerHTML = '<tr>' +
            '<th style="text-align:left;padding:0.35rem 0.5rem;color:var(--text-light);font-weight:500;border-bottom:1px solid var(--border);">Crop</th>' +
            '<th style="text-align:right;padding:0.35rem 0.5rem;color:var(--text-light);font-weight:500;border-bottom:1px solid var(--border);">Tolerance %</th>' +
            '<th style="text-align:right;padding:0.35rem 0.5rem;color:var(--text-light);font-weight:500;border-bottom:1px solid var(--border);">Tolerance Lbs</th>' +
            '<th style="padding:0.35rem 0.5rem;border-bottom:1px solid var(--border);"></th>' +
            '</tr>';
          tbl.appendChild(thead);

          var tbody = document.createElement('tbody');
          rows.forEach(function (row) {
            var tr = document.createElement('tr');

            var nameTd = document.createElement('td');
            nameTd.style.cssText = 'padding:0.4rem 0.5rem;color:var(--text);';
            nameTd.textContent = row.cropName;
            tr.appendChild(nameTd);

            var pctTd = document.createElement('td');
            pctTd.style.cssText = 'padding:0.4rem 0.5rem;text-align:right;';
            var pctInput = document.createElement('input');
            pctInput.type = 'number';
            pctInput.step = '0.1';
            pctInput.min = '0';
            pctInput.value = row.tolerancePct;
            pctInput.style.cssText = 'width:6rem;text-align:right;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:0.2rem 0.4rem;';
            pctTd.appendChild(pctInput);
            tr.appendChild(pctTd);

            var lbsTd = document.createElement('td');
            lbsTd.style.cssText = 'padding:0.4rem 0.5rem;text-align:right;';
            var lbsInput = document.createElement('input');
            lbsInput.type = 'number';
            lbsInput.step = '1';
            lbsInput.min = '0';
            lbsInput.value = row.toleranceLbs;
            lbsInput.style.cssText = 'width:6rem;text-align:right;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:0.2rem 0.4rem;';
            lbsTd.appendChild(lbsInput);
            tr.appendChild(lbsTd);

            // Status cell for "Saved" indicator
            var statusTd = document.createElement('td');
            statusTd.style.cssText = 'padding:0.4rem 0.5rem;min-width:3rem;';
            tr.appendChild(statusTd);

            // Auto-save on blur or Enter
            function saveTolerance() {
              var pct = parseFloat(pctInput.value);
              var lbs = parseFloat(lbsInput.value);
              if (isNaN(pct) || pct < 0 || isNaN(lbs) || lbs < 0) {
                statusTd.textContent = 'Invalid';
                statusTd.style.color = 'var(--danger)';
                return;
              }
              fetch('/api/crop-config/' + row.id + '/tolerance', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tolerancePct: pct, toleranceLbs: lbs })
              })
                .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
                .then(function (res) {
                  if (res.ok) {
                    statusTd.textContent = 'Saved';
                    statusTd.style.color = 'var(--success, #4caf50)';
                    clearTimeout(statusTd._hideTimer);
                    statusTd._hideTimer = setTimeout(function () {
                      statusTd.textContent = '';
                    }, 2000);
                  } else {
                    statusTd.textContent = 'Error';
                    statusTd.style.color = 'var(--danger)';
                  }
                })
                .catch(function () {
                  statusTd.textContent = 'Error';
                  statusTd.style.color = 'var(--danger)';
                });
            }

            [pctInput, lbsInput].forEach(function (inp) {
              inp.addEventListener('blur', saveTolerance);
              inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { inp.blur(); }
              });
            });

            tbody.appendChild(tr);
          });
          tbl.appendChild(tbody);
          toleranceBody.appendChild(tbl);
        })
        .catch(function () {
          toleranceBody.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;">Failed to load tolerance settings.</p>';
        });
    }

    // Toggle expand/collapse
    toleranceHeader.addEventListener('click', function () {
      setToleranceExpanded(!toleranceExpanded);
      if (toleranceExpanded) {
        var cy = yearSel.value;
        if (cy) loadToleranceSettings(parseInt(cy, 10));
      }
    });

    // Apply initial state
    setToleranceExpanded(toleranceExpanded);

    // Results area
    var resultsArea = document.createElement('div');
    resultsArea.id = 'recon-results';
    container.appendChild(resultsArea);

    loadBtn.addEventListener('click', function () {
      var buyerId = buyerSel.value;
      var cropYear = yearSel.value;
      if (!buyerId) { showSettlementToast('Please select a buyer.'); return; }
      if (!cropYear) { showSettlementToast('Please select a crop year.'); return; }
      // Refresh tolerance panel if expanded
      if (toleranceExpanded) loadToleranceSettings(parseInt(cropYear, 10));
      renderReconciliation(resultsArea, parseInt(buyerId, 10), parseInt(cropYear, 10));
    });
  }

  // --- Render reconciliation results for a buyer + cropYear ---
  function renderReconciliation(container, buyerId, cropYear) {
    container.innerHTML = '<p style="color:var(--text-light)">Loading reconciliation data...</p>';

    // Reset selection state
    selectedFarmTicketId = null;
    selectedSettlementLineId = null;

    Promise.all([
      fetch('/api/reconciliation/summary?buyerId=' + buyerId + '&cropYear=' + cropYear).then(function (r) { return r.json(); }),
      fetch('/api/reconciliation/unmatched?buyerId=' + buyerId + '&cropYear=' + cropYear).then(function (r) { return r.json(); })
    ]).then(function (results) {
      var summary = results[0];
      var unmatched = results[1];
      container.innerHTML = '';

      renderReconSummary(container, summary, buyerId, cropYear);
      renderUnmatchedPanels(container, unmatched, buyerId, cropYear);
    }).catch(function (err) {
      container.innerHTML = '<p style="color:var(--danger)">Error loading reconciliation data: ' + err.message + '</p>';
    });
  }

  // --- Render the settlement summary table (per-crop farm vs buyer lbs) ---
  function renderReconSummary(container, summaryRows, buyerId, cropYear) {
    var section = document.createElement('div');
    section.style.marginBottom = '2rem';

    var heading = document.createElement('h3');
    heading.style.cssText = 'font-size:0.9rem;color:var(--primary);margin-bottom:0.75rem;font-weight:400;';
    heading.textContent = 'Settlement Summary — ' + cropYear;
    section.appendChild(heading);

    if (!summaryRows || summaryRows.length === 0) {
      var emptyMsg = document.createElement('p');
      emptyMsg.style.color = 'var(--text-light)';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.textContent = 'No settlement data for this buyer and crop year.';
      section.appendChild(emptyMsg);
      container.appendChild(section);
      return;
    }

    var tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';

    var tbl = document.createElement('table');
    tbl.className = 'recon-summary-table';
    tbl.innerHTML = '<thead><tr>' +
      '<th>Crop</th>' +
      '<th class="number">Farm Lbs</th>' +
      '<th class="number">Buyer Lbs</th>' +
      '<th class="number">Variance (lbs / %)</th>' +
      '<th class="number">Tickets</th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    summaryRows.forEach(function (row) {
      var tr = document.createElement('tr');
      var variancePct = row.variancePct || 0;
      // Use server-computed withinTolerance if present; fall back to legacy 1% threshold
      var varianceClass;
      if (typeof row.withinTolerance === 'boolean') {
        varianceClass = row.withinTolerance ? 'variance-ok' : 'variance-warn';
      } else {
        varianceClass = Math.abs(variancePct) <= 1 ? 'variance-ok' : 'variance-warn';
      }
      var varianceLbs = row.varianceLbs || 0;
      var varianceSign = varianceLbs >= 0 ? '+' : '';
      var varianceDisplay = varianceSign + Math.round(varianceLbs).toLocaleString() + ' lbs (' + varianceSign + variancePct.toFixed(2) + '%)';

      // Build tooltip for tolerance context
      var tolPct = row.tolerancePct || 0;
      var tolLbs = row.toleranceLbs || 0;
      var tolDesc = '';
      if (tolPct > 0) {
        tolDesc = tolPct + '% tolerance';
      } else if (tolLbs > 0) {
        tolDesc = tolLbs.toLocaleString() + ' lbs tolerance';
      } else {
        tolDesc = 'No tolerance configured';
      }
      var withinLabel = (typeof row.withinTolerance === 'boolean')
        ? (row.withinTolerance ? 'Within tolerance' : 'Exceeds tolerance')
        : '';
      var tooltip = withinLabel ? withinLabel + ': ' + tolDesc : tolDesc;

      var varianceTd = document.createElement('td');
      varianceTd.className = 'number ' + varianceClass;
      varianceTd.textContent = varianceDisplay;
      varianceTd.title = tooltip;

      var cropTd = document.createElement('td');
      cropTd.textContent = row.crop || '--';
      var farmLbsTd = document.createElement('td');
      farmLbsTd.className = 'number';
      farmLbsTd.textContent = Math.round(row.farmLbs || 0).toLocaleString();
      var buyerLbsTd = document.createElement('td');
      buyerLbsTd.className = 'number';
      buyerLbsTd.textContent = Math.round(row.buyerLbs || 0).toLocaleString();
      var ticketsTd = document.createElement('td');
      ticketsTd.className = 'number';
      ticketsTd.textContent = (row.farmCount || 0);

      tr.appendChild(cropTd);
      tr.appendChild(farmLbsTd);
      tr.appendChild(buyerLbsTd);
      tr.appendChild(varianceTd);
      tr.appendChild(ticketsTd);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    tableWrap.appendChild(tbl);
    section.appendChild(tableWrap);
    container.appendChild(section);
  }

  // --- Render the two-panel unmatched loads view with manual link capability ---
  function renderUnmatchedPanels(container, unmatched, buyerId, cropYear) {
    var farmOnly = (unmatched && unmatched.farmOnly) ? unmatched.farmOnly : [];
    var settlementOnly = (unmatched && unmatched.settlementOnly) ? unmatched.settlementOnly : [];

    var section = document.createElement('div');
    section.style.marginBottom = '2rem';

    var heading = document.createElement('h3');
    heading.style.cssText = 'font-size:0.9rem;color:var(--primary);margin-bottom:0.75rem;font-weight:400;';
    heading.textContent = 'Unmatched Loads';
    section.appendChild(heading);

    if (farmOnly.length === 0 && settlementOnly.length === 0) {
      var emptyMsg = document.createElement('p');
      emptyMsg.style.color = 'var(--text-light)';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.textContent = 'All loads are matched.';
      section.appendChild(emptyMsg);
      container.appendChild(section);
      return;
    }

    // Link button (above panels for visibility)
    var linkRow = document.createElement('div');
    linkRow.style.cssText = 'margin-bottom:0.75rem;display:flex;align-items:center;gap:1rem;';
    var linkBtn = document.createElement('button');
    linkBtn.className = 'btn-primary';
    linkBtn.textContent = 'Link Selected';
    linkBtn.disabled = true;
    linkBtn.id = 'recon-link-btn';
    var linkHint = document.createElement('span');
    linkHint.style.cssText = 'font-size:0.8rem;color:var(--text-light);';
    linkHint.textContent = 'Select one farm ticket and one settlement line to link them manually.';
    linkRow.appendChild(linkBtn);
    linkRow.appendChild(linkHint);
    section.appendChild(linkRow);

    var panels = document.createElement('div');
    panels.className = 'recon-panels';

    // Left panel: Farm-Only Tickets
    var leftPanel = document.createElement('div');
    leftPanel.className = 'recon-panel';
    var leftHeading = document.createElement('div');
    leftHeading.style.cssText = 'font-size:0.85rem;color:var(--text-light);margin-bottom:0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.35rem;';
    leftHeading.textContent = 'Farm-Only Tickets (' + farmOnly.length + ')';
    leftPanel.appendChild(leftHeading);

    var leftList = document.createElement('div');
    leftList.id = 'recon-farm-list';
    if (farmOnly.length === 0) {
      leftList.innerHTML = '<p style="color:var(--text-light);font-style:italic;font-size:0.85rem;">No unmatched farm tickets.</p>';
    } else {
      farmOnly.forEach(function (ticket) {
        var item = document.createElement('div');
        item.className = 'recon-item';
        item.dataset.ticketId = ticket.id;
        var lbs = ticket.netWeight ? Math.round(ticket.netWeight).toLocaleString() + ' lbs' : '--';
        item.innerHTML =
          '<div style="font-size:0.85rem;"><strong>' + escHtml(ticket.ticketNo || '--') + '</strong>' +
          ' &mdash; ' + escHtml(ticket.date || '') + ' &mdash; ' + lbs + '</div>' +
          '<div>' + escHtml(ticket.crop || '') + '</div>';
        if (ticket.hint) {
          var hint = document.createElement('div');
          hint.className = 'recon-item-hint';
          hint.textContent = ticket.hint;
          item.appendChild(hint);
        }
        item.addEventListener('click', function () {
          leftList.querySelectorAll('.recon-item').forEach(function (el) { el.classList.remove('selected'); });
          item.classList.add('selected');
          selectedFarmTicketId = ticket.id;
          updateLinkButton(linkBtn);
        });
        leftList.appendChild(item);
      });
    }
    leftPanel.appendChild(leftList);
    panels.appendChild(leftPanel);

    // Right panel: Settlement-Only Lines
    var rightPanel = document.createElement('div');
    rightPanel.className = 'recon-panel';
    var rightHeading = document.createElement('div');
    rightHeading.style.cssText = 'font-size:0.85rem;color:var(--text-light);margin-bottom:0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.35rem;';
    rightHeading.textContent = 'Settlement-Only Lines (' + settlementOnly.length + ')';
    rightPanel.appendChild(rightHeading);

    var rightList = document.createElement('div');
    rightList.id = 'recon-settlement-list';
    if (settlementOnly.length === 0) {
      rightList.innerHTML = '<p style="color:var(--text-light);font-style:italic;font-size:0.85rem;">No unmatched settlement lines.</p>';
    } else {
      settlementOnly.forEach(function (line) {
        var item = document.createElement('div');
        item.className = 'recon-item';
        item.dataset.lineId = line.id;
        var lbs = line.netWeight ? Math.round(line.netWeight).toLocaleString() + ' lbs' : '--';
        item.innerHTML =
          '<div style="font-size:0.85rem;"><strong>' + escHtml(line.ticketNo || '--') + '</strong>' +
          ' &mdash; ' + escHtml(line.date || '') + ' &mdash; ' + lbs + '</div>';
        item.addEventListener('click', function () {
          rightList.querySelectorAll('.recon-item').forEach(function (el) { el.classList.remove('selected'); });
          item.classList.add('selected');
          selectedSettlementLineId = line.id;
          updateLinkButton(linkBtn);
        });
        rightList.appendChild(item);
      });
    }
    rightPanel.appendChild(rightList);
    panels.appendChild(rightPanel);

    section.appendChild(panels);
    container.appendChild(section);

    // Wire Link button
    linkBtn.addEventListener('click', function () {
      if (!selectedFarmTicketId || !selectedSettlementLineId) return;
      linkBtn.disabled = true;
      linkBtn.textContent = 'Linking...';
      fetch('/api/reconciliation/manual-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: selectedFarmTicketId, settlementLineId: selectedSettlementLineId })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          linkBtn.textContent = 'Link Selected';
          selectedFarmTicketId = null;
          selectedSettlementLineId = null;
          if (!res.ok) {
            showSettlementToast('Link failed: ' + (res.data.error || 'Unknown error'));
            linkBtn.disabled = false;
            return;
          }
          showSettlementToast('Linked successfully');
          // Reload unmatched
          fetch('/api/reconciliation/unmatched?buyerId=' + buyerId + '&cropYear=' + cropYear)
            .then(function (r) { return r.json(); })
            .then(function (refreshed) {
              var resultsArea = document.getElementById('recon-results');
              if (resultsArea) {
                // Remove and re-render unmatched section
                var existingSection = resultsArea.querySelectorAll('div > div');
                // Simple approach: re-render full results
                var selBuyer = document.getElementById('recon-buyer');
                var selYear = document.getElementById('recon-crop-year');
                if (selBuyer && selYear) {
                  renderReconciliation(resultsArea, parseInt(selBuyer.value, 10), parseInt(selYear.value, 10));
                }
              }
            });
        })
        .catch(function (err) {
          linkBtn.disabled = false;
          linkBtn.textContent = 'Link Selected';
          showSettlementToast('Link error: ' + err.message);
        });
    });

    // Render fuzzy match suggestions below the unmatched panels
    renderFuzzySuggestions(container, buyerId, cropYear);

    // Also render matched tickets with dispute capability below
    renderMatchedWithDispute(container, buyerId, cropYear);
  }

  // --- Enable/disable the Link button based on selection state ---
  function updateLinkButton(linkBtn) {
    linkBtn.disabled = !(selectedFarmTicketId && selectedSettlementLineId);
  }

  // --- Render fuzzy match suggestions section ---
  function renderFuzzySuggestions(container, buyerId, cropYear) {
    var section = document.createElement('div');
    section.id = 'fuzzy-suggestions-section';
    section.style.marginBottom = '2rem';

    var heading = document.createElement('h3');
    heading.style.cssText = 'font-size:0.9rem;color:var(--primary);margin-bottom:0.75rem;font-weight:400;';
    heading.textContent = 'Suggested Matches';
    section.appendChild(heading);

    var bodyDiv = document.createElement('div');
    bodyDiv.id = 'fuzzy-suggestions-body';
    bodyDiv.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Searching for fuzzy matches...</p>';
    section.appendChild(bodyDiv);
    container.appendChild(section);

    fetch('/api/reconciliation/fuzzy-candidates?buyerId=' + buyerId + '&cropYear=' + cropYear)
      .then(function (r) { return r.json(); })
      .then(function (candidates) {
        bodyDiv.innerHTML = '';

        if (!candidates || candidates.length === 0) {
          var empty = document.createElement('p');
          empty.className = 'fuzzy-suggestions-empty';
          empty.textContent = 'No fuzzy match suggestions available.';
          bodyDiv.appendChild(empty);
          return;
        }

        candidates.forEach(function (item) {
          var card = document.createElement('div');
          // Determine match quality from best candidate
          var best = item.candidates[0];
          var matchClass = 'wide-match';
          if (best && best.weightVariancePct < 0.5) matchClass = 'close-match';
          else if (best && best.weightVariancePct < 2) matchClass = 'moderate-match';
          card.className = 'fuzzy-suggestion ' + matchClass;

          // Header row: settlement line info
          var header = document.createElement('div');
          header.className = 'fuzzy-suggestion-header';

          var leftSide = document.createElement('div');
          leftSide.className = 'fuzzy-suggestion-side';
          var leftLabel = document.createElement('div');
          leftLabel.className = 'fuzzy-suggestion-label';
          leftLabel.textContent = 'Settlement Line';
          var leftDetail = document.createElement('div');
          var lineWt = item.lineNetWeight ? Math.round(item.lineNetWeight).toLocaleString() + ' lbs' : '--';
          leftDetail.textContent = escHtml(item.lineTicketNo || '--') + ' \u2014 ' + escHtml(item.lineDate || '') + ' \u2014 ' + lineWt;
          leftSide.appendChild(leftLabel);
          leftSide.appendChild(leftDetail);

          var arrow = document.createElement('div');
          arrow.className = 'fuzzy-suggestion-arrow';
          arrow.textContent = '\u2194';

          var rightSide = document.createElement('div');
          rightSide.className = 'fuzzy-suggestion-side';
          var rightLabel = document.createElement('div');
          rightLabel.className = 'fuzzy-suggestion-label';
          rightLabel.textContent = 'Farm Ticket Candidates';
          rightSide.appendChild(rightLabel);

          header.appendChild(leftSide);
          header.appendChild(arrow);
          header.appendChild(rightSide);
          card.appendChild(header);

          // Candidates as radio buttons (or single item if only one)
          var radioName = 'fuzzy-candidate-' + item.settlementLineId;
          var candidatesWrap = document.createElement('div');

          item.candidates.forEach(function (cand, idx) {
            var radioWrap = document.createElement('label');
            radioWrap.className = 'fuzzy-candidate-radio';

            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = radioName;
            radio.value = cand.ticketId;
            if (idx === 0) radio.checked = true; // pre-select best match

            var info = document.createElement('div');
            var candWt = cand.netWeight ? Math.round(cand.netWeight).toLocaleString() + ' lbs' : '--';
            var dateStr = cand.date || '';
            var textMain = document.createElement('div');
            textMain.textContent = escHtml(cand.ticketNo || '--') + ' \u2014 ' + escHtml(dateStr) + ' \u2014 ' + candWt + ' (' + escHtml(cand.crop) + ')';

            var textVariance = document.createElement('div');
            textVariance.className = 'fuzzy-candidate-variance';
            var varParts = [];
            if (cand.weightVarianceLbs !== null) varParts.push('\u00b1' + cand.weightVarianceLbs.toLocaleString() + ' lbs (' + cand.weightVariancePct.toFixed(2) + '%)');
            if (cand.dateDiffDays !== null) varParts.push(cand.dateDiffDays + (cand.dateDiffDays === 1 ? ' day' : ' days') + ' apart');
            textVariance.textContent = varParts.join(', ');

            info.appendChild(textMain);
            info.appendChild(textVariance);
            radioWrap.appendChild(radio);
            radioWrap.appendChild(info);
            candidatesWrap.appendChild(radioWrap);
          });
          card.appendChild(candidatesWrap);

          // Confirm Link button
          var confirmBtn = document.createElement('button');
          confirmBtn.className = 'btn-primary fuzzy-confirm-btn';
          confirmBtn.textContent = 'Confirm Link';
          confirmBtn.addEventListener('click', function () {
            var selectedRadio = card.querySelector('input[name="' + radioName + '"]:checked');
            if (!selectedRadio) return;
            var ticketId = parseInt(selectedRadio.value, 10);
            var settlementLineId = item.settlementLineId;

            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Linking...';

            fetch('/api/reconciliation/manual-link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticketId: ticketId, settlementLineId: settlementLineId })
            })
              .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
              .then(function (result) {
                if (!result.ok) {
                  showSettlementToast('Link failed: ' + (result.data.error || 'Unknown error'));
                  confirmBtn.disabled = false;
                  confirmBtn.textContent = 'Confirm Link';
                  return;
                }
                showSettlementToast('Fuzzy match confirmed');
                // Remove this card from the suggestions
                card.remove();
                // Check if any cards remain
                if (bodyDiv.querySelectorAll('.fuzzy-suggestion').length === 0) {
                  bodyDiv.innerHTML = '';
                  var empty = document.createElement('p');
                  empty.className = 'fuzzy-suggestions-empty';
                  empty.textContent = 'No fuzzy match suggestions available.';
                  bodyDiv.appendChild(empty);
                }
                // Refresh the full reconciliation view to update counts
                var selBuyer = document.getElementById('recon-buyer');
                var selYear = document.getElementById('recon-crop-year');
                if (selBuyer && selYear) {
                  var resultsArea = document.getElementById('recon-results');
                  if (resultsArea) {
                    renderReconciliation(resultsArea, parseInt(selBuyer.value, 10), parseInt(selYear.value, 10));
                  }
                }
              })
              .catch(function (err) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Link';
                showSettlementToast('Link error: ' + err.message);
              });
          });
          card.appendChild(confirmBtn);

          bodyDiv.appendChild(card);
        });
      })
      .catch(function () {
        bodyDiv.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;">Failed to load fuzzy match suggestions.</p>';
      });
  }

  // --- Render matched ticket rows with inline Dispute capability ---
  function renderMatchedWithDispute(container, buyerId, cropYear) {
    var section = document.createElement('div');
    section.style.marginBottom = '2rem';

    var heading = document.createElement('h3');
    heading.style.cssText = 'font-size:0.9rem;color:var(--primary);margin-bottom:0.75rem;font-weight:400;';
    heading.textContent = 'Matched Tickets';
    section.appendChild(heading);

    // Fetch all settlement lines for this buyer+cropYear with match status
    fetch('/api/reconciliation/summary?buyerId=' + buyerId + '&cropYear=' + cropYear)
      .then(function (r) { return r.json(); })
      .then(function () {
        // Fetch settlements list to get settlement IDs for this buyer+cropYear
        return fetch('/api/settlements?buyerId=' + buyerId + '&cropYear=' + cropYear)
          .then(function (r) { return r.json(); });
      })
      .then(function (settlements) {
        if (!settlements || settlements.length === 0) {
          section.innerHTML += '<p style="color:var(--text-light);font-style:italic;font-size:0.85rem;">No settlements found for this buyer and year.</p>';
          container.appendChild(section);
          return;
        }

        // Fetch lines for all settlements and flatten
        var linePromises = settlements.map(function (s) {
          return fetch('/api/settlements/' + s.id + '/lines').then(function (r) { return r.json(); });
        });
        return Promise.all(linePromises).then(function (lineArrays) {
          var allLines = [];
          lineArrays.forEach(function (arr) { allLines = allLines.concat(arr); });
          var matched = allLines.filter(function (l) {
            return l.matchStatus === 'matched' || l.matchStatus === 'manual' || l.matchStatus === 'disputed';
          });
          renderMatchedTable(section, matched);
          container.appendChild(section);
        });
      })
      .catch(function (err) {
        section.innerHTML += '<p style="color:var(--danger);font-size:0.85rem;">Error loading matched lines: ' + err.message + '</p>';
        container.appendChild(section);
      });
  }

  // --- Render the matched lines table with inline dispute UI ---
  function renderMatchedTable(section, lines) {
    if (!lines || lines.length === 0) {
      var empty = document.createElement('p');
      empty.style.cssText = 'color:var(--text-light);font-style:italic;font-size:0.85rem;';
      empty.textContent = 'No matched tickets yet.';
      section.appendChild(empty);
      return;
    }

    var tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    tableWrap.id = 'matched-table-wrap';

    var tbl = document.createElement('table');
    tbl.className = 'recon-summary-table';
    tbl.innerHTML = '<thead><tr>' +
      '<th>Ticket No</th>' +
      '<th class="number">Buyer Lbs</th>' +
      '<th>Status</th>' +
      '<th>Notes</th>' +
      '<th></th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');
    lines.forEach(function (line) {
      var tr = document.createElement('tr');
      tr.dataset.lineId = line.id;
      buildMatchedLineRow(tr, line);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    tableWrap.appendChild(tbl);
    section.appendChild(tableWrap);
  }

  // --- Build a single matched line row (normal or dispute-editing mode) ---
  function buildMatchedLineRow(tr, line) {
    var statusClass = 'badge-' + (line.matchStatus || 'unreconciled');
    var statusLabel = { matched: 'Matched', manual: 'Manual', disputed: 'Disputed' }[line.matchStatus] || line.matchStatus;

    // Enhanced: show resolution status inside badge for disputed lines
    if (line.matchStatus === 'disputed' && line.resolutionStatus) {
      var isResolved = line.resolutionStatus !== 'Pending';
      statusClass = isResolved ? 'badge-resolved' : 'badge-pending-dispute';
      statusLabel = 'Disputed: ' + line.resolutionStatus;
    }

    var lbs = line.netWeight ? Math.round(line.netWeight).toLocaleString() + ' lbs' : '--';

    // Resolution date display for disputed + resolved lines
    var resDateHtml = '';
    if (line.matchStatus === 'disputed' && line.resolutionDate) {
      var rd = new Date(line.resolutionDate);
      resDateHtml = '<br><span style="font-size:0.75rem;color:var(--text-light);">' +
        rd.toLocaleDateString() + '</span>';
    }

    // Notes: show resolutionNotes for disputed lines, fall back to general notes
    var notesText = (line.matchStatus === 'disputed' && line.resolutionNotes)
      ? line.resolutionNotes
      : (line.disputeNotes || line.notes || '');

    tr.innerHTML =
      '<td>' + escHtml(line.ticketNo || '--') + '</td>' +
      '<td class="number">' + lbs + '</td>' +
      '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span>' + resDateHtml + '</td>' +
      '<td>' + escHtml(notesText) + '</td>' +
      '<td style="white-space:nowrap;">';

    // Only show Dispute button for matched/manual/disputed lines
    if (line.matchStatus === 'matched' || line.matchStatus === 'manual' || line.matchStatus === 'disputed') {
      var lastTd = tr.querySelector('td:last-child');
      var disputeBtn = document.createElement('button');
      disputeBtn.className = 'btn-sm';
      disputeBtn.textContent = line.matchStatus === 'disputed' ? 'Edit Dispute' : 'Dispute';
      disputeBtn.addEventListener('click', function () {
        showInlineDisputeForm(tr, line);
      });
      lastTd.appendChild(disputeBtn);
    }
  }

  // --- Show inline dispute form with structured resolution fields ---
  function showInlineDisputeForm(tr, line) {
    var originalHTML = tr.innerHTML;
    var cells = tr.querySelectorAll('td');
    var notesTd = cells[3]; // Notes cell
    var actionTd = cells[4]; // Action cell

    var currentStatus = line.resolutionStatus || 'Pending';
    var currentNotes = line.resolutionNotes || '';
    var currentDate = '';
    if (line.resolutionDate) {
      var d = new Date(line.resolutionDate);
      currentDate = d.toISOString().split('T')[0];
    } else if (currentStatus !== 'Pending') {
      // Default to today for resolved statuses
      currentDate = new Date().toISOString().split('T')[0];
    }

    var todayStr = new Date().toISOString().split('T')[0];

    notesTd.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:0.3rem;min-width:280px;">' +
        '<div style="display:flex;gap:0.5rem;align-items:center;">' +
          '<label style="font-size:0.75rem;color:var(--text-light);min-width:60px;">Status</label>' +
          '<select id="dispute-status-' + line.id + '" style="flex:1;font-size:0.8rem;background:var(--card);color:var(--text);border:1px solid var(--primary);padding:0.2rem;">' +
            '<option value="Pending"' + (currentStatus === 'Pending' ? ' selected' : '') + '>Pending</option>' +
            '<option value="Buyer Error"' + (currentStatus === 'Buyer Error' ? ' selected' : '') + '>Buyer Error</option>' +
            '<option value="Our Error"' + (currentStatus === 'Our Error' ? ' selected' : '') + '>Our Error</option>' +
            '<option value="Write-off"' + (currentStatus === 'Write-off' ? ' selected' : '') + '>Write-off</option>' +
          '</select>' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;">' +
          '<label style="font-size:0.75rem;color:var(--text-light);min-width:60px;">Resolved</label>' +
          '<input type="date" id="dispute-date-' + line.id + '" value="' + currentDate + '"' +
            (currentStatus === 'Pending' ? ' disabled style="opacity:0.4;"' : '') +
            ' style="flex:1;font-size:0.8rem;background:var(--card);color:var(--text);border:1px solid var(--primary);padding:0.2rem;">' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:flex-start;">' +
          '<label style="font-size:0.75rem;color:var(--text-light);min-width:60px;padding-top:0.2rem;">Notes</label>' +
          '<textarea id="dispute-notes-' + line.id + '" style="flex:1;height:52px;font-size:0.8rem;background:var(--card);color:var(--text);border:1px solid var(--primary);padding:0.3rem;" placeholder="Resolution notes...">' +
            escHtml(currentNotes) +
          '</textarea>' +
        '</div>' +
      '</div>';

    // Wire status change to enable/disable date field
    var statusSel = notesTd.querySelector('#dispute-status-' + line.id);
    var dateInput = notesTd.querySelector('#dispute-date-' + line.id);
    if (statusSel && dateInput) {
      statusSel.addEventListener('change', function () {
        var isPending = statusSel.value === 'Pending';
        dateInput.disabled = isPending;
        dateInput.style.opacity = isPending ? '0.4' : '1';
        if (!isPending && !dateInput.value) {
          dateInput.value = todayStr;
        }
      });
    }

    actionTd.innerHTML = '';
    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn-sm btn-primary';
    saveBtn.textContent = 'Save';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginLeft = '0.4rem';
    actionTd.appendChild(saveBtn);
    actionTd.appendChild(cancelBtn);

    cancelBtn.addEventListener('click', function () {
      tr.innerHTML = originalHTML;
      buildMatchedLineRow(tr, line);
    });

    saveBtn.addEventListener('click', function () {
      var statusEl = document.getElementById('dispute-status-' + line.id);
      var dateEl = document.getElementById('dispute-date-' + line.id);
      var notesEl = document.getElementById('dispute-notes-' + line.id);
      var resolutionStatus = statusEl ? statusEl.value : 'Pending';
      var resolutionDate = dateEl ? dateEl.value : '';
      var resolutionNotes = notesEl ? notesEl.value : '';

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      fetch('/api/settlement-lines/' + line.id + '/dispute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionStatus: resolutionStatus,
          resolutionNotes: resolutionNotes,
          resolutionDate: resolutionStatus !== 'Pending' && resolutionDate ? resolutionDate : null
        })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (!res.ok) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
            showSettlementToast('Dispute save failed: ' + (res.data.error || 'Unknown error'));
            return;
          }
          showSettlementToast('Dispute saved: ' + resolutionStatus);
          // Update local line data and re-render row
          line.matchStatus = 'disputed';
          line.resolutionStatus = resolutionStatus;
          line.resolutionNotes = resolutionNotes;
          line.resolutionDate = res.data.resolutionDate || null;
          tr.innerHTML = '';
          buildMatchedLineRow(tr, line);
        })
        .catch(function (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          showSettlementToast('Dispute error: ' + err.message);
        });
    });
  }

  // --- Load season summary view ---
  function loadSeasonSummary() {
    var container = document.getElementById('settlement-season-summary');
    if (!container) return;
    container.innerHTML = '';

    // Year selector header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;';

    var nowYear = getCropYear();
    var yearSel = document.createElement('select');
    yearSel.style.cssText = 'font-size:0.85rem;background:var(--card);color:var(--text);border:1px solid var(--border);padding:0.3rem 0.5rem;border-radius:3px;';
    for (var y = nowYear; y >= nowYear - 5; y--) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y + ' Crop Year';
      if (y === nowYear) opt.selected = true;
      yearSel.appendChild(opt);
    }

    var loadBtn = document.createElement('button');
    loadBtn.className = 'btn-sm btn-primary';
    loadBtn.textContent = 'Load';

    header.appendChild(yearSel);
    header.appendChild(loadBtn);
    container.appendChild(header);

    var resultsArea = document.createElement('div');
    container.appendChild(resultsArea);

    function doLoad() {
      var cropYear = parseInt(yearSel.value, 10);
      loadBtn.disabled = true;
      loadBtn.textContent = 'Loading...';
      resultsArea.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">Loading season summary...</p>';

      fetch('/api/reconciliation/season-summary?cropYear=' + cropYear)
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          loadBtn.disabled = false;
          loadBtn.textContent = 'Load';
          if (!res.ok) {
            resultsArea.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;">Error: ' + escHtml(res.data.error || 'Unknown error') + '</p>';
            return;
          }
          renderSeasonSummaryTable(resultsArea, res.data, cropYear);
        })
        .catch(function (err) {
          loadBtn.disabled = false;
          loadBtn.textContent = 'Load';
          resultsArea.innerHTML = '<p style="color:var(--danger);font-size:0.85rem;">Error: ' + escHtml(err.message) + '</p>';
        });
    }

    loadBtn.addEventListener('click', doLoad);
    // Auto-load on first render
    doLoad();
  }

  function renderSeasonSummaryTable(container, rows, cropYear) {
    container.innerHTML = '';

    if (!rows || rows.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);font-style:italic;font-size:0.85rem;">No data found for ' + cropYear + ' crop year.</p>';
      return;
    }

    var heading = document.createElement('h3');
    heading.style.cssText = 'font-size:0.9rem;color:var(--text-light);margin-bottom:0.75rem;';
    heading.textContent = cropYear + ' Crop Year — All Buyers';
    container.appendChild(heading);

    var tblWrap = document.createElement('div');
    tblWrap.className = 'table-wrap';

    var tbl = document.createElement('table');
    tbl.className = 'recon-summary-table';

    // Header
    tbl.innerHTML =
      '<thead><tr>' +
        '<th>Buyer</th>' +
        '<th class="number">Tickets</th>' +
        '<th class="number">Total Weight</th>' +
        '<th class="number">Lines</th>' +
        '<th class="number">Matched</th>' +
        '<th class="number">Unmatched</th>' +
        '<th class="number">Disputed</th>' +
        '<th class="number">Total Payment</th>' +
        '<th class="number">Variance</th>' +
        '<th>Status</th>' +
      '</tr></thead>';

    var tbody = document.createElement('tbody');

    // Grand totals accumulators
    var totals = {
      ticketCount: 0,
      totalWeightLbs: 0,
      settlementLineCount: 0,
      matchedCount: 0,
      unmatchedCount: 0,
      disputedCount: 0,
      totalPayment: 0,
      varianceLbs: 0
    };

    rows.forEach(function (row) {
      totals.ticketCount += row.ticketCount || 0;
      totals.totalWeightLbs += row.totalWeightLbs || 0;
      totals.settlementLineCount += row.settlementLineCount || 0;
      totals.matchedCount += row.matchedCount || 0;
      totals.unmatchedCount += row.unmatchedCount || 0;
      totals.disputedCount += row.disputedCount || 0;
      totals.totalPayment += row.totalPayment || 0;
      totals.varianceLbs += row.varianceLbs || 0;

      var tr = document.createElement('tr');

      // Payment status badge
      var statusColor = {
        'Fully Matched': 'color:var(--success);',
        'Partially Matched': 'color:var(--amber);',
        'Has Disputes': 'color:var(--danger);',
        'No Settlements': 'color:var(--text-light);'
      }[row.paymentStatus] || 'color:var(--text-light);';

      var varianceCls = row.varianceLbs > 0 ? 'color:var(--success);' : (row.varianceLbs < 0 ? 'color:var(--danger);' : '');
      var varianceStr = (row.varianceLbs !== 0 ? (row.varianceLbs > 0 ? '+' : '') + row.varianceLbs.toLocaleString() : '0') + ' lbs';
      if (row.variancePct !== 0) {
        varianceStr += '<br><span style="font-size:0.75rem;">' +
          (row.variancePct > 0 ? '+' : '') + row.variancePct.toFixed(2) + '%</span>';
      }

      var buyerDisplay = escHtml(row.buyerName);
      if (row.buyerShortCode) {
        buyerDisplay += ' <span style="font-size:0.75rem;color:var(--text-light);">(' + escHtml(row.buyerShortCode) + ')</span>';
      }

      tr.innerHTML =
        '<td>' + buyerDisplay + '</td>' +
        '<td class="number">' + (row.ticketCount || 0).toLocaleString() + '</td>' +
        '<td class="number">' + (row.totalWeightLbs || 0).toLocaleString() + ' lbs</td>' +
        '<td class="number">' + (row.settlementLineCount || 0).toLocaleString() + '</td>' +
        '<td class="number"><span style="color:var(--success);">' + (row.matchedCount || 0) + '</span></td>' +
        '<td class="number"><span style="color:' + (row.unmatchedCount > 0 ? 'var(--amber)' : 'inherit') + ';">' + (row.unmatchedCount || 0) + '</span></td>' +
        '<td class="number"><span style="color:' + (row.disputedCount > 0 ? 'var(--danger)' : 'inherit') + ';">' + (row.disputedCount || 0) + '</span></td>' +
        '<td class="number">$' + (row.totalPayment || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
        '<td class="number" style="' + varianceCls + '">' + varianceStr + '</td>' +
        '<td><span class="payment-status-badge" style="' + statusColor + '">' + escHtml(row.paymentStatus) + '</span></td>';

      tbody.appendChild(tr);
    });

    // Grand totals row
    var totalVarianceCls = totals.varianceLbs > 0 ? 'color:var(--success);' : (totals.varianceLbs < 0 ? 'color:var(--danger);' : '');
    var totalVarianceStr = (totals.varianceLbs !== 0 ? (totals.varianceLbs > 0 ? '+' : '') + totals.varianceLbs.toLocaleString() : '0') + ' lbs';

    var totalRow = document.createElement('tr');
    totalRow.className = 'season-summary-total';
    totalRow.innerHTML =
      '<td><strong>TOTAL (' + rows.length + ' buyers)</strong></td>' +
      '<td class="number"><strong>' + totals.ticketCount.toLocaleString() + '</strong></td>' +
      '<td class="number"><strong>' + totals.totalWeightLbs.toLocaleString() + ' lbs</strong></td>' +
      '<td class="number"><strong>' + totals.settlementLineCount.toLocaleString() + '</strong></td>' +
      '<td class="number"><strong>' + totals.matchedCount.toLocaleString() + '</strong></td>' +
      '<td class="number"><strong>' + totals.unmatchedCount.toLocaleString() + '</strong></td>' +
      '<td class="number"><strong>' + totals.disputedCount.toLocaleString() + '</strong></td>' +
      '<td class="number"><strong>$' + totals.totalPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong></td>' +
      '<td class="number" style="' + totalVarianceCls + '"><strong>' + totalVarianceStr + '</strong></td>' +
      '<td></td>';
    tbody.appendChild(totalRow);

    tbl.appendChild(tbody);
    tblWrap.appendChild(tbl);
    container.appendChild(tblWrap);
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
