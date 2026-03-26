// Verify tab: mobile-first delivery verification with Claude Vision (multi-product)
(function () {
  'use strict';

  var currentStep = 1;
  var selectedSupplierId = '';
  var scanData = null;
  var photoPath = '';
  var scannedItems = [];
  var itemMatches = [];
  var itemSelections = [];

  // --- Step 1: Supplier Selection ---
  var supplierSelect = document.getElementById('verify-supplier');
  var nextBtn1 = document.getElementById('verify-next-1');

  window.addEventListener('ref-data-loaded', function () {
    populateVerifySuppliers();
  });

  function populateVerifySuppliers() {
    if (!supplierSelect) return;
    var opts = '<option value="">Choose supplier...</option>';
    window.refData.suppliers.forEach(function (s) {
      if (s.active === false) return;
      opts += '<option value="' + s.id + '">' + util.escapeHtml(s.name) + '</option>';
    });
    supplierSelect.innerHTML = opts;
  }

  if (supplierSelect) {
    supplierSelect.addEventListener('change', function () {
      selectedSupplierId = supplierSelect.value;
      nextBtn1.disabled = !selectedSupplierId;
    });
  }

  if (nextBtn1) {
    nextBtn1.addEventListener('click', function () {
      if (!selectedSupplierId) return;
      showStep(2);
    });
  }

  // --- Step 2: Photo Capture ---
  var scanBtn = document.getElementById('verify-scan-btn');
  var scanInput = document.getElementById('verify-scan-input');
  var scanStatus = document.getElementById('verify-scan-status');
  var skipScanBtn = document.getElementById('verify-skip-scan');

  if (scanBtn) {
    scanBtn.addEventListener('click', function () {
      scanInput.click();
    });
  }

  if (scanInput) {
    scanInput.addEventListener('change', function () {
      var file = scanInput.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showScanStatus('Please select an image file.', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showScanStatus('Image too large (max 10MB).', 'error');
        return;
      }

      uploadAndScan(file);
    });
  }

  if (skipScanBtn) {
    skipScanBtn.addEventListener('click', function () {
      scanData = {};
      photoPath = '';
      scannedItems = [];
      itemMatches = [];
      // Skip to step 4 with empty form for manual entry
      showStep(4);
      populateManualConfirm();
    });
  }

  function uploadAndScan(file) {
    scanBtn.disabled = true;
    showScanStatus('Scanning packing slip... this may take a few seconds.', 'loading');

    var formData = new FormData();
    formData.append('image', file);

    fetch('/api/verify/scan', {
      method: 'POST',
      body: formData
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.error || 'Scan failed');
        });
      }
      return res.json();
    })
    .then(function (data) {
      scanData = data.scanData || {};
      photoPath = data.photoPath || '';
      scannedItems = (scanData.items || []);

      if (scannedItems.length === 0) {
        showScanStatus('No products found in scan. Enter manually.', 'error');
        showStep(4);
        populateManualConfirm();
        return;
      }

      showScanStatus('Found ' + scannedItems.length + ' item(s). Matching against open orders...', 'success');
      matchAgainstOrders();
    })
    .catch(function (err) {
      showScanStatus('Scan error: ' + err.message, 'error');
    })
    .finally(function () {
      scanBtn.disabled = false;
      scanInput.value = '';
    });
  }

  function showScanStatus(msg, type) {
    scanStatus.textContent = msg;
    scanStatus.className = 'scan-status ' + type;
  }

  // --- Step 3: Match ---
  function matchAgainstOrders() {
    api.post('/api/verify/match', {
      scanData: scanData,
      supplierId: selectedSupplierId
    }).then(function (result) {
      itemMatches = result.itemMatches || [];
      itemSelections = new Array(itemMatches.length).fill(null);
      renderMultiMatches();
      showStep(3);
    });
  }

  function renderMultiMatches() {
    var scanResults = document.getElementById('verify-scan-results');
    var matchList = document.getElementById('verify-matches');

    // Show shared scan data at top
    var fields = '';
    if (scanData) {
      ['supplier', 'ticketNumber', 'date', 'notes'].forEach(function (k) {
        if (scanData[k] != null) {
          fields += '<div class="field"><span class="field-label">' + k + '</span><span class="field-value">' + util.escapeHtml(String(scanData[k])) + '</span></div>';
        }
      });
    }
    scanResults.innerHTML = fields || '<p>No shared data extracted.</p>';

    // Build per-item matching UI
    var html = '<h4 style="margin:1rem 0 0.5rem">Scanned Items (' + itemMatches.length + ')</h4>';

    itemMatches.forEach(function (im, itemIdx) {
      var si = im.scannedItem;
      html += '<div class="scanned-item-block" data-item-idx="' + itemIdx + '">';
      html += '<div class="scanned-item-header">' +
        '<strong>' + util.escapeHtml(si.product || '(unknown)') + '</strong>' +
        ' &mdash; Qty: ' + (si.quantity || '?') + ' ' + util.escapeHtml(si.unit || '') +
        (si.lotNumber ? ' | Lot: ' + util.escapeHtml(si.lotNumber) : '') +
      '</div>';

      var matches = im.matches || [];
      if (matches.length === 0) {
        html += '<p class="help-text">No matching orders found.</p>' +
          '<button class="btn-sm" onclick="assignManualItem(' + itemIdx + ')">Select Manually</button>';
      } else {
        // Show top 3 matches as selectable cards
        matches.slice(0, 3).forEach(function (m, matchIdx) {
          var cardClass = m.score >= 50 ? 'match-good' : m.score >= 25 ? 'match-partial' : 'match-none';
          var label = m.score >= 50 ? 'Good Match' : m.score >= 25 ? 'Partial' : 'Low';
          var p = m.product;
          var productName = p ? util.productLabel(p) : '(unknown)';

          html += '<div class="match-card ' + cardClass + '" onclick="selectItemMatch(' + itemIdx + ',' + matchIdx + ')">' +
            '<div class="match-header">' +
              '<strong>' + util.escapeHtml(productName) + '</strong>' +
              '<span class="match-score">' + label + ' (' + m.score + ')</span>' +
            '</div>' +
            '<div class="match-details">' +
              'Ordered: ' + util.formatNum(m.order.quantityOrdered) +
              ' | Remaining: ' + util.formatNum(m.remaining) +
            '</div>' +
          '</div>';
        });
        html += '<button class="btn-sm" style="margin-top:0.25rem" onclick="assignManualItem(' + itemIdx + ')">None match</button>';
      }
      html += '</div>';
    });

    html += '<hr style="margin:1rem 0">' +
      '<button class="btn-primary full-width" id="verify-confirm-all" disabled>Confirm All Items</button>' +
      '<button class="btn-sm full-width" style="margin-top:0.5rem" onclick="selectManualEntry()">Skip Matching — Enter All Manually</button>';

    matchList.innerHTML = html;

    // Wire confirm-all button
    var confirmAllBtn = document.getElementById('verify-confirm-all');
    if (confirmAllBtn) {
      confirmAllBtn.addEventListener('click', function () {
        showStep(4);
        populateMultiConfirm();
      });
    }
  }

  window.selectItemMatch = function (itemIdx, matchIdx) {
    var im = itemMatches[itemIdx];
    var m = im.matches[matchIdx];
    itemSelections[itemIdx] = {
      orderId: m.order.id,
      productId: m.order.productId,
      remaining: m.remaining
    };

    // Highlight selected card
    var block = document.querySelector('.scanned-item-block[data-item-idx="' + itemIdx + '"]');
    if (block) {
      block.querySelectorAll('.match-card').forEach(function (card, ci) {
        card.style.opacity = ci === matchIdx ? '1' : '0.4';
        card.style.outline = ci === matchIdx ? '2px solid #2563eb' : 'none';
      });
    }

    checkAllSelected();
  };

  window.assignManualItem = function (itemIdx) {
    itemSelections[itemIdx] = { orderId: '', productId: '', remaining: 0 };

    // Dim all cards in that block
    var block = document.querySelector('.scanned-item-block[data-item-idx="' + itemIdx + '"]');
    if (block) {
      block.querySelectorAll('.match-card').forEach(function (card) {
        card.style.opacity = '0.4';
        card.style.outline = 'none';
      });
    }

    checkAllSelected();
  };

  function checkAllSelected() {
    var allDone = itemSelections.every(function (s) { return s !== null; });
    var btn = document.getElementById('verify-confirm-all');
    if (btn) btn.disabled = !allDone;
  }

  window.selectManualEntry = function () {
    scannedItems = [];
    itemMatches = [];
    itemSelections = [];
    showStep(4);
    populateManualConfirm();
  };

  // --- Step 4: Confirm ---

  function populateManualConfirm() {
    var container = document.getElementById('verify-confirm-table');
    container.innerHTML =
      '<p class="help-text">Enter items manually below.</p>' +
      '<div id="vc-manual-items"></div>' +
      '<button type="button" class="btn-sm" id="vc-add-manual" style="margin-top:0.5rem">+ Add Item</button>';

    var manualContainer = document.getElementById('vc-manual-items');
    addManualRow(manualContainer);

    document.getElementById('vc-add-manual').addEventListener('click', function () {
      addManualRow(manualContainer);
    });

    wireSubmitButton();
  }

  function addManualRow(container) {
    var div = document.createElement('div');
    div.className = 'manual-item-row';
    div.innerHTML =
      '<div class="form-grid">' +
        '<div class="form-group">' +
          '<label>Product</label>' +
          '<select class="mi-productId" required><option value="">Select...</option></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Qty</label>' +
          '<input type="number" class="mi-qty" step="any" min="0" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Unit</label>' +
          '<select class="mi-unit">' +
            '<option value="units">Units</option><option value="bags">Bags</option>' +
            '<option value="lbs">Lbs</option><option value="gal">Gallons</option><option value="tons">Tons</option><option value="acre">Acre</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Lot #</label>' +
          '<input type="text" class="mi-lot">' +
        '</div>' +
        '<div class="form-group" style="align-self:end">' +
          '<button type="button" class="btn-danger btn-sm mi-remove">X</button>' +
        '</div>' +
      '</div>';

    var productSel = div.querySelector('.mi-productId');
    window.refData.products.filter(function (p) { return p.active !== false; }).forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = util.productLabel(p);
      productSel.appendChild(opt);
    });

    div.querySelector('.mi-remove').addEventListener('click', function () {
      div.remove();
    });

    container.appendChild(div);
  }

  function populateMultiConfirm() {
    var container = document.getElementById('verify-confirm-table');
    var html = '<table class="confirm-table"><thead><tr>' +
      '<th>Product</th><th>Qty</th><th>Unit</th><th>Lot #</th><th>Order</th>' +
    '</tr></thead><tbody>';

    scannedItems.forEach(function (si, idx) {
      var sel = itemSelections[idx] || {};
      var p = sel.productId ? window.refData.products.find(function (pp) { return pp.id === sel.productId; }) : null;
      var productDisplay = p ? util.productLabel(p) : util.escapeHtml(si.product || '(manual)');
      html += '<tr>' +
        '<td>' + productDisplay + '<input type="hidden" class="vc-productId" value="' + (sel.productId || '') + '">' +
          '<input type="hidden" class="vc-orderId" value="' + (sel.orderId || '') + '">' +
          '<input type="hidden" class="vc-remaining" value="' + (sel.remaining || 0) + '"></td>' +
        '<td><input type="number" class="vc-item-qty" value="' + (si.quantity || 0) + '" step="any" style="width:80px"></td>' +
        '<td>' + util.escapeHtml(si.unit || 'units') + '<input type="hidden" class="vc-item-unit" value="' + util.escapeHtml(si.unit || 'units') + '"></td>' +
        '<td><input type="text" class="vc-item-lot" value="' + util.escapeHtml(si.lotNumber || '') + '" style="width:100px"></td>' +
        '<td>' + (sel.orderId ? 'Linked' : 'None') + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    wireSubmitButton();
  }

  function wireSubmitButton() {
    var btn = document.getElementById('verify-submit-all');
    if (btn) {
      // Remove old listener by cloning
      var newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', submitConfirm);
    }
  }

  function submitConfirm() {
    var receivedBy = document.getElementById('vc-receivedBy').value;

    // Check if this is a manual entry or scan-based
    var manualRows = document.querySelectorAll('.manual-item-row');
    var items = [];

    if (manualRows.length > 0) {
      // Manual entry mode
      manualRows.forEach(function (row) {
        var productId = row.querySelector('.mi-productId').value;
        var qty = parseFloat(row.querySelector('.mi-qty').value) || 0;
        if (!productId) return;
        items.push({
          productId: productId,
          orderId: '',
          quantityReceived: qty,
          unit: row.querySelector('.mi-unit').value,
          lotNumber: row.querySelector('.mi-lot').value,
          discrepancyFlag: false,
          discrepancyNotes: ''
        });
      });
    } else {
      // Scan-based confirmation
      var qtyInputs = document.querySelectorAll('.vc-item-qty');
      var lotInputs = document.querySelectorAll('.vc-item-lot');
      var productIds = document.querySelectorAll('.vc-productId');
      var orderIds = document.querySelectorAll('.vc-orderId');
      var remainings = document.querySelectorAll('.vc-remaining');
      var unitInputs = document.querySelectorAll('.vc-item-unit');

      scannedItems.forEach(function (si, idx) {
        var qty = parseFloat(qtyInputs[idx].value) || 0;
        var remaining = parseFloat(remainings[idx].value) || 0;

        var discrepancy = false;
        var discrepancyNotes = '';
        if (remaining > 0 && Math.abs(qty - remaining) > 0.5) {
          discrepancy = true;
          discrepancyNotes = 'Expected ' + remaining + ', received ' + qty;
        }

        items.push({
          orderId: orderIds[idx].value || '',
          productId: productIds[idx].value || '',
          quantityReceived: qty,
          unit: unitInputs[idx].value || si.unit || 'units',
          lotNumber: lotInputs[idx].value || '',
          discrepancyFlag: discrepancy,
          discrepancyNotes: discrepancyNotes
        });
      });
    }

    if (items.length === 0) {
      util.showToast('Add at least one item', 'error');
      return;
    }

    var payload = {
      shared: {
        supplierId: selectedSupplierId,
        dateReceived: (scanData && scanData.date) || new Date().toISOString().split('T')[0],
        ticketNumber: (scanData && scanData.ticketNumber) || '',
        receivedBy: receivedBy,
        verifiedBy: receivedBy,
        verificationMethod: photoPath ? 'SCAN' : 'MANUAL',
        photoPath: photoPath,
        scanData: scanData,
        notes: (scanData && scanData.notes) || ''
      },
      items: items
    };

    // Use batch confirm if multiple items, single confirm if one
    var endpoint = items.length > 1 ? '/api/verify/confirm' : '/api/verify/confirm';

    api.post(endpoint, payload).then(function (result) {
      var msg;
      if (result.receipts) {
        msg = result.receipts.length + ' receipts created.';
      } else {
        msg = 'Receipt ' + result.id + ' created.';
      }
      var hasDiscrepancy = items.some(function (i) { return i.discrepancyFlag; });
      if (hasDiscrepancy) msg += ' DISCREPANCY FLAGGED.';

      document.getElementById('verify-done-msg').textContent = msg;
      showStep('done');
    }).catch(function (err) {
      util.showToast('Error: ' + err.message, 'error');
    });
  }

  // --- Restart ---
  var restartBtn = document.getElementById('verify-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', function () {
      resetWizard();
    });
  }

  // --- Step Navigation ---
  function showStep(step) {
    currentStep = step;
    ['verify-step-1', 'verify-step-2', 'verify-step-3', 'verify-step-4', 'verify-step-done'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    var target = step === 'done' ? 'verify-step-done' : 'verify-step-' + step;
    var el = document.getElementById(target);
    if (el) el.classList.remove('hidden');
  }

  function resetWizard() {
    currentStep = 1;
    selectedSupplierId = '';
    scanData = null;
    photoPath = '';
    scannedItems = [];
    itemMatches = [];
    itemSelections = [];
    if (supplierSelect) supplierSelect.value = '';
    if (nextBtn1) nextBtn1.disabled = true;
    if (scanStatus) scanStatus.className = 'scan-status hidden';
    showStep(1);
  }

  // Reset when tab activates
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'verify') {
      populateVerifySuppliers();
      resetWizard();
    }
  });

})();
