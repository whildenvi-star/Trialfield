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
        showToast('Import complete — ' + res.data.linesCreated + ' lines created.');
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
      '<div style="display:flex;flex-wrap:wrap;gap:1.5rem;">' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Buyer</span><br><strong>' + escHtml(buyerName) + '</strong></div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Crop Year</span><br><strong>' + escHtml(String(settlement.cropYear)) + '</strong></div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Source</span><br>' + sourceLabel + '</div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Date</span><br>' + escHtml(importedDate) + '</div>' +
      '<div><span class="label" style="font-size:0.8rem;color:var(--text-light)">Lines</span><br><strong>' + lines.length + '</strong></div>' +
      '</div>';
    container.appendChild(headerCard);

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
