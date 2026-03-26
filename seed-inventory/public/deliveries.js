// Deliveries tab: receipt log with multi-product delivery support
(function () {
  'use strict';

  var allReceipts = [];
  var lineItemCount = 0;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'deliveries') loadReceipts();
  });

  window.addEventListener('ref-data-loaded', function () {
    populateSupplierSelect('df-supplierId');
    if (document.getElementById('tab-deliveries').classList.contains('active')) loadReceipts();
  });

  var searchInput = document.getElementById('delivery-search');
  if (searchInput) searchInput.addEventListener('input', renderReceipts);

  function loadReceipts() {
    api.get('/api/receipts').then(function (data) {
      allReceipts = data;
      renderReceipts();
    });
  }

  function renderReceipts() {
    var tbody = document.getElementById('delivery-tbody');
    if (!tbody) return;

    var q = (searchInput ? searchInput.value : '').toLowerCase();

    var filtered = allReceipts.filter(function (r) {
      if (!q) return true;
      var p = window.refData.products.find(function (p) { return p.id === r.productId; });
      var s = util.supplierName(r.supplierId, window.refData.suppliers);
      var haystack = [util.productLabel(p), s, r.lotNumber, r.ticketNumber, r.receivedBy].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No deliveries recorded yet.</td></tr>';
      return;
    }

    // Group by deliveryGroupId
    var groups = {};
    var ungrouped = [];
    filtered.forEach(function (r) {
      if (r.deliveryGroupId) {
        if (!groups[r.deliveryGroupId]) groups[r.deliveryGroupId] = [];
        groups[r.deliveryGroupId].push(r);
      } else {
        ungrouped.push(r);
      }
    });

    var html = '';

    // Render grouped deliveries
    Object.keys(groups).forEach(function (gid) {
      var items = groups[gid];
      var first = items[0];
      var sName = util.supplierName(first.supplierId, window.refData.suppliers);
      var productSummary = items.map(function (r) {
        var p = window.refData.products.find(function (pp) { return pp.id === r.productId; });
        return util.productLabel(p);
      }).join(', ');
      if (productSummary.length > 80) productSummary = productSummary.substring(0, 77) + '...';

      var vBadge = first.verificationMethod === 'SCAN' ? 'badge-scan' : first.verificationMethod === 'PHOTO' ? 'badge-photo' : 'badge-manual';

      // Group header row
      html += '<tr class="delivery-group-header" onclick="toggleDeliveryGroup(\'' + gid + '\')">' +
        '<td>' + util.escapeHtml(first.dateReceived) + '</td>' +
        '<td><strong>' + items.length + ' items</strong> &mdash; ' + util.escapeHtml(productSummary) + '</td>' +
        '<td>' + util.escapeHtml(sName) + '</td>' +
        '<td class="number"></td>' +
        '<td></td>' +
        '<td></td>' +
        '<td>' + util.escapeHtml(first.ticketNumber) + '</td>' +
        '<td><span class="badge ' + vBadge + '">' + (first.verificationMethod || 'MANUAL') + '</span></td>' +
        '<td></td>' +
        '<td><button class="btn-edit" onclick="event.stopPropagation();editDelivery(\'' + first.id + '\')">Edit</button></td>' +
      '</tr>';

      // Individual item rows (hidden by default)
      items.forEach(function (r) {
        var p = window.refData.products.find(function (pp) { return pp.id === r.productId; });
        html += '<tr class="delivery-group-item hidden" data-group="' + gid + '"' +
          (r.discrepancyFlag ? ' style="background:#fff5f5"' : '') + '>' +
          '<td></td>' +
          '<td style="padding-left:2rem">' + util.escapeHtml(util.productLabel(p)) + '</td>' +
          '<td>' + util.escapeHtml(util.supplierName(r.supplierId, window.refData.suppliers)) + '</td>' +
          '<td class="number">' + util.formatNum(r.quantityReceived) + '</td>' +
          '<td>' + util.escapeHtml(r.unit) + '</td>' +
          '<td>' + util.escapeHtml(r.lotNumber) + '</td>' +
          '<td></td>' +
          '<td></td>' +
          '<td>' + (r.discrepancyFlag ? '<span class="badge badge-discrepancy">YES</span>' : '') + '</td>' +
          '<td>' +
            '<button class="btn-edit" onclick="editDelivery(\'' + r.id + '\')">Edit</button> ' +
            '<button class="btn-danger" onclick="deleteDelivery(\'' + r.id + '\')">Del</button>' +
          '</td>' +
        '</tr>';
      });
    });

    // Render ungrouped (legacy single-item receipts)
    ungrouped.forEach(function (r) {
      var p = window.refData.products.find(function (p) { return p.id === r.productId; });
      var sName = util.supplierName(r.supplierId, window.refData.suppliers);
      var vBadge = r.verificationMethod === 'SCAN' ? 'badge-scan' : r.verificationMethod === 'PHOTO' ? 'badge-photo' : 'badge-manual';
      var photoIcon = r.photoPath ? ' [photo]' : '';
      html += '<tr' + (r.discrepancyFlag ? ' style="background:#fff5f5"' : '') + '>' +
        '<td>' + util.escapeHtml(r.dateReceived) + '</td>' +
        '<td>' + util.escapeHtml(util.productLabel(p)) + '</td>' +
        '<td>' + util.escapeHtml(sName) + '</td>' +
        '<td class="number">' + util.formatNum(r.quantityReceived) + '</td>' +
        '<td>' + util.escapeHtml(r.unit) + '</td>' +
        '<td>' + util.escapeHtml(r.lotNumber) + '</td>' +
        '<td>' + util.escapeHtml(r.ticketNumber) + '</td>' +
        '<td><span class="badge ' + vBadge + '">' + (r.verificationMethod || 'MANUAL') + '</span>' + photoIcon + '</td>' +
        '<td>' + (r.discrepancyFlag ? '<span class="badge badge-discrepancy">YES</span>' : '') + '</td>' +
        '<td>' +
          '<button class="btn-edit" onclick="editDelivery(\'' + r.id + '\')">Edit</button> ' +
          '<button class="btn-danger" onclick="deleteDelivery(\'' + r.id + '\')">Del</button>' +
        '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  }

  window.toggleDeliveryGroup = function (gid) {
    var items = document.querySelectorAll('.delivery-group-item[data-group="' + gid + '"]');
    items.forEach(function (el) { el.classList.toggle('hidden'); });
  };

  // --- Line Item Row ---
  function createLineItemRow(data) {
    lineItemCount++;
    var div = document.createElement('div');
    div.className = 'line-item-row';

    div.innerHTML =
      '<div class="form-grid">' +
        '<div class="form-group">' +
          '<label>Product</label>' +
          '<div class="autocomplete-wrap">' +
            '<input type="text" class="li-product-search" placeholder="Type to search products..." autocomplete="off" required>' +
            '<input type="hidden" class="li-productId">' +
            '<div class="autocomplete-list"></div>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Linked Order</label>' +
          '<select class="li-orderId"><option value="">No linked order</option></select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Quantity</label>' +
          '<input type="number" class="li-quantity" step="any" min="0" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Unit</label>' +
          '<select class="li-unit">' +
            '<option value="units">Units</option><option value="bags">Bags</option>' +
            '<option value="lbs">Lbs</option><option value="gal">Gallons</option>' +
            '<option value="tons">Tons</option><option value="acre">Acre</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Lot Number</label>' +
          '<input type="text" class="li-lotNumber" placeholder="LOT-2026-A1">' +
        '</div>' +
        '<div class="form-group" style="align-self:end">' +
          '<button type="button" class="btn-danger btn-sm li-remove">Remove</button>' +
        '</div>' +
      '</div>';

    // Wire product autocomplete
    var productInput = div.querySelector('.li-product-search');
    var productHidden = div.querySelector('.li-productId');
    var acList = div.querySelector('.autocomplete-list');
    var acIndex = -1;

    function sortProducts(list) {
      return list.slice().sort(function (a, b) {
        // Seeds first, then Inputs
        if (a.type !== b.type) return a.type === 'SEED' ? -1 : 1;
        // Then alphabetically by label
        return util.productLabel(a).localeCompare(util.productLabel(b));
      });
    }

    function filterProducts(query) {
      var q = query.toLowerCase();
      return sortProducts(window.refData.products.filter(function (p) {
        if (p.active === false) return false;
        var label = util.productLabel(p) + ' ' + (p.crop || '') + ' ' + (p.variety || '') + ' ' + (p.productName || '') + ' ' + p.type;
        return label.toLowerCase().indexOf(q) !== -1;
      }));
    }

    function showSuggestions(matches) {
      if (matches.length === 0) { acList.innerHTML = '<div class="autocomplete-item" style="color:var(--text-light);cursor:default">No matches</div>'; acList.classList.add('open'); acIndex = -1; return; }
      var currentType = '';
      var html = '';
      matches.forEach(function (p) {
        if (p.type !== currentType) {
          currentType = p.type;
          html += '<div class="ac-group-label">' + (currentType === 'SEED' ? 'Seeds' : 'Inputs') + '</div>';
        }
        html += '<div class="autocomplete-item" data-id="' + p.id + '">' +
          util.escapeHtml(util.productLabel(p)) +
          '<span class="ac-type">' + util.escapeHtml(p.type) + '</span></div>';
      });
      acList.innerHTML = html;
      acList.classList.add('open');
      acIndex = -1;
    }

    function selectProduct(id) {
      var p = window.refData.products.find(function (pp) { return pp.id === id; });
      if (p) {
        productInput.value = util.productLabel(p) + ' (' + p.type + ')';
        productHidden.value = p.id;
      }
      acList.classList.remove('open');
      loadOpenOrders(productHidden.value, div.querySelector('.li-orderId'));
    }

    productInput.addEventListener('input', function () {
      productHidden.value = '';
      var q = productInput.value.trim();
      if (q.length === 0) {
        acList.classList.remove('open');
      } else {
        showSuggestions(filterProducts(q));
      }
    });

    productInput.addEventListener('focus', function () {
      var q = productInput.value.trim();
      if (q.length > 0 && !productHidden.value) {
        showSuggestions(filterProducts(q));
      }
    });

    productInput.addEventListener('keydown', function (e) {
      var items = acList.querySelectorAll('.autocomplete-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acIndex = Math.min(acIndex + 1, items.length - 1);
        items.forEach(function (el, i) { el.classList.toggle('active', i === acIndex); });
        items[acIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acIndex = Math.max(acIndex - 1, 0);
        items.forEach(function (el, i) { el.classList.toggle('active', i === acIndex); });
        items[acIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && acIndex >= 0) {
        e.preventDefault();
        selectProduct(items[acIndex].getAttribute('data-id'));
      } else if (e.key === 'Escape') {
        acList.classList.remove('open');
      }
    });

    acList.addEventListener('click', function (e) {
      var item = e.target.closest('.autocomplete-item');
      if (item) selectProduct(item.getAttribute('data-id'));
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function (e) {
      if (!div.contains(e.target)) acList.classList.remove('open');
    });

    // Wire remove button
    div.querySelector('.li-remove').addEventListener('click', function () {
      div.remove();
      // Ensure at least one row remains
      var container = document.getElementById('df-items-container');
      if (container && container.children.length === 0) {
        container.appendChild(createLineItemRow(null));
      }
    });

    // Pre-fill if data provided
    if (data) {
      if (data.productId) selectProduct(data.productId);
      div.querySelector('.li-quantity').value = data.quantityReceived || '';
      div.querySelector('.li-unit').value = data.unit || 'units';
      div.querySelector('.li-lotNumber').value = data.lotNumber || '';
      if (data.productId) {
        loadOpenOrders(data.productId, div.querySelector('.li-orderId'), data.orderId);
      }
    }

    return div;
  }

  function loadOpenOrders(productId, selectEl, preselectId) {
    if (!productId) {
      selectEl.innerHTML = '<option value="">No linked order</option>';
      return;
    }
    var year = window.refData.settings.cropYear || 2026;
    api.get('/api/orders/open?cropYear=' + year).then(function (orders) {
      var filtered = orders.filter(function (o) { return o.productId === productId; });
      var opts = '<option value="">No linked order</option>';
      filtered.forEach(function (o) {
        var label = 'Order: ' + util.formatNum(o.quantityOrdered) + ' ' + (o.unit || 'units');
        if (o._remaining != null) label += ' (' + util.formatNum(o._remaining) + ' remaining)';
        opts += '<option value="' + o.id + '">' + label + '</option>';
      });
      selectEl.innerHTML = opts;
      if (preselectId) selectEl.value = preselectId;
    }).catch(function () {
      selectEl.innerHTML = '<option value="">No linked order</option>';
    });
  }

  // --- Modal ---
  var modal = document.getElementById('delivery-modal');
  var form = document.getElementById('delivery-form');

  document.getElementById('add-delivery-btn').addEventListener('click', function () { openModal(null); });
  document.getElementById('delivery-modal-close').addEventListener('click', closeModal);
  document.getElementById('delivery-cancel-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  // Add Item button
  document.getElementById('df-add-item').addEventListener('click', function () {
    document.getElementById('df-items-container').appendChild(createLineItemRow(null));
  });

  // --- Farm autocomplete ---
  var farmSearchInput = document.getElementById('df-farm-search');
  var farmHiddenInput = document.getElementById('df-farmId');
  var farmAcList = document.getElementById('df-farm-aclist');
  var farmAcIndex = -1;
  var allFarms = [];

  function loadFarms() {
    api.get('/api/farms').then(function (fields) {
      allFarms = fields.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    }).catch(function () { allFarms = []; });
  }

  function filterFarms(query) {
    var q = query.toLowerCase();
    return allFarms.filter(function (f) {
      var haystack = (f.name || '') + ' ' + (f.aliases || []).join(' ');
      return haystack.toLowerCase().indexOf(q) !== -1;
    });
  }

  function showFarmSuggestions(matches) {
    if (matches.length === 0) {
      farmAcList.innerHTML = '<div class="autocomplete-item" style="color:var(--text-light);cursor:default">No matches</div>';
      farmAcList.classList.add('open');
      farmAcIndex = -1;
      return;
    }
    farmAcList.innerHTML = matches.map(function (f) {
      var acres = f.reportingAcres ? ' <span class="ac-type">' + f.reportingAcres + ' ac</span>' : '';
      return '<div class="autocomplete-item" data-id="' + f.id + '" data-name="' + util.escapeHtml(f.name) + '">' +
        util.escapeHtml(f.name) + acres + '</div>';
    }).join('');
    farmAcList.classList.add('open');
    farmAcIndex = -1;
  }

  function selectFarm(id, name) {
    farmSearchInput.value = name;
    farmHiddenInput.value = id;
    farmAcList.classList.remove('open');
  }

  if (farmSearchInput) {
    farmSearchInput.addEventListener('input', function () {
      farmHiddenInput.value = '';
      var q = farmSearchInput.value.trim();
      if (q.length === 0) { farmAcList.classList.remove('open'); return; }
      showFarmSuggestions(filterFarms(q));
    });
    farmSearchInput.addEventListener('focus', function () {
      if (!farmHiddenInput.value && farmSearchInput.value.trim()) showFarmSuggestions(filterFarms(farmSearchInput.value.trim()));
    });
    farmSearchInput.addEventListener('keydown', function (e) {
      var items = farmAcList.querySelectorAll('.autocomplete-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); farmAcIndex = Math.min(farmAcIndex + 1, items.length - 1); items.forEach(function (el, i) { el.classList.toggle('active', i === farmAcIndex); }); items[farmAcIndex].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); farmAcIndex = Math.max(farmAcIndex - 1, 0); items.forEach(function (el, i) { el.classList.toggle('active', i === farmAcIndex); }); items[farmAcIndex].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter' && farmAcIndex >= 0) { e.preventDefault(); selectFarm(items[farmAcIndex].getAttribute('data-id'), items[farmAcIndex].getAttribute('data-name')); }
      else if (e.key === 'Escape') { farmAcList.classList.remove('open'); }
    });
    farmAcList.addEventListener('click', function (e) {
      var item = e.target.closest('.autocomplete-item');
      if (item) selectFarm(item.getAttribute('data-id'), item.getAttribute('data-name'));
    });
    document.addEventListener('click', function (e) {
      if (!farmSearchInput.contains(e.target) && !farmAcList.contains(e.target)) farmAcList.classList.remove('open');
    });
  }

  function openModal(receipt) {
    document.getElementById('delivery-modal-title').textContent = receipt ? 'Edit Delivery' : 'Record Delivery';
    form.reset();
    document.getElementById('df-id').value = receipt ? receipt.id : '';
    populateSupplierSelect('df-supplierId');
    lineItemCount = 0;
    loadFarms();

    var container = document.getElementById('df-items-container');
    container.innerHTML = '';

    if (!receipt) {
      // New delivery — default date to today, start with one empty line item
      document.getElementById('df-dateReceived').value = new Date().toISOString().split('T')[0];
      farmSearchInput.value = '';
      farmHiddenInput.value = '';
      container.appendChild(createLineItemRow(null));
    } else {
      // Editing existing receipt — fill shared fields and one line item
      document.getElementById('df-supplierId').value = receipt.supplierId || '';
      document.getElementById('df-dateReceived').value = receipt.dateReceived || '';
      document.getElementById('df-ticketNumber').value = receipt.ticketNumber || '';
      document.getElementById('df-receivedBy').value = receipt.receivedBy || '';
      document.getElementById('df-verifiedBy').value = receipt.verifiedBy || '';
      document.getElementById('df-notes').value = receipt.notes || '';
      farmSearchInput.value = receipt.farmName || '';
      farmHiddenInput.value = receipt.farmId || '';
      container.appendChild(createLineItemRow(receipt));
    }

    modal.classList.remove('hidden');
  }

  function closeModal() { modal.classList.add('hidden'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('df-id').value;

    var shared = {
      supplierId: document.getElementById('df-supplierId').value,
      farmId: document.getElementById('df-farmId').value,
      farmName: document.getElementById('df-farm-search').value,
      dateReceived: document.getElementById('df-dateReceived').value,
      ticketNumber: document.getElementById('df-ticketNumber').value,
      receivedBy: document.getElementById('df-receivedBy').value,
      verifiedBy: document.getElementById('df-verifiedBy').value,
      notes: document.getElementById('df-notes').value
    };

    var rows = document.querySelectorAll('#df-items-container .line-item-row');
    var items = [];
    rows.forEach(function (row) {
      var productId = row.querySelector('.li-productId').value;
      var qty = parseFloat(row.querySelector('.li-quantity').value) || 0;
      if (!productId) return; // skip empty rows
      items.push({
        productId: productId,
        orderId: row.querySelector('.li-orderId').value,
        quantityReceived: qty,
        unit: row.querySelector('.li-unit').value,
        lotNumber: row.querySelector('.li-lotNumber').value
      });
    });

    if (items.length === 0) {
      util.showToast('Add at least one product', 'error');
      return;
    }

    var promise;
    if (id) {
      // Editing existing single receipt
      var data = Object.assign({}, shared, items[0], { verificationMethod: 'MANUAL' });
      promise = api.put('/api/receipts/' + id, data);
    } else if (items.length === 1) {
      // Single new item — use simple endpoint
      var data = Object.assign({}, shared, items[0], { verificationMethod: 'MANUAL' });
      promise = api.post('/api/receipts', data);
    } else {
      // Multiple items — use batch endpoint
      shared.verificationMethod = 'MANUAL';
      promise = api.post('/api/receipts/batch', { shared: shared, items: items });
    }

    promise.then(function () {
      closeModal();
      loadReceipts();
      util.showToast(id ? 'Delivery updated' : items.length + ' item(s) recorded');
    }).catch(function (err) {
      util.showToast('Error: ' + err.message, 'error');
    });
  });

  window.deleteDelivery = function (id) {
    util.confirm('Delete this delivery record?').then(function (ok) {
      if (!ok) return;
      api.del('/api/receipts/' + id).then(function () {
        loadReceipts();
        util.showToast('Delivery deleted');
      }).catch(function (err) {
        util.showToast('Error: ' + err.message, 'error');
      });
    });
  };

  window.editDelivery = function (id) {
    var r = allReceipts.find(function (r) { return r.id === id; });
    if (r) openModal(r);
  };

})();
