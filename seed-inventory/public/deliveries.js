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
        '<td colspan="2"><strong>' + items.length + ' items</strong> &mdash; ' + util.escapeHtml(productSummary) + '</td>' +
        '<td class="number">' + util.escapeHtml(sName) + '</td>' +
        '<td></td>' +
        '<td></td>' +
        '<td>' + util.escapeHtml(first.ticketNumber) + '</td>' +
        '<td><span class="badge ' + vBadge + '">' + (first.verificationMethod || 'MANUAL') + '</span></td>' +
        '<td></td>' +
        '<td></td>' +
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
          '<select class="li-productId" required><option value="">Select product...</option></select>' +
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
            '<option value="tons">Tons</option>' +
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

    // Populate product select
    var productSel = div.querySelector('.li-productId');
    window.refData.products.filter(function (p) { return p.active !== false; }).forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = util.productLabel(p) + ' (' + p.type + ')';
      productSel.appendChild(opt);
    });

    // Wire product change to load open orders
    productSel.addEventListener('change', function () {
      loadOpenOrders(productSel.value, div.querySelector('.li-orderId'));
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
      productSel.value = data.productId || '';
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

  function openModal(receipt) {
    document.getElementById('delivery-modal-title').textContent = receipt ? 'Edit Delivery' : 'Record Delivery';
    form.reset();
    document.getElementById('df-id').value = receipt ? receipt.id : '';
    populateSupplierSelect('df-supplierId');
    lineItemCount = 0;

    var container = document.getElementById('df-items-container');
    container.innerHTML = '';

    if (!receipt) {
      // New delivery — default date to today, start with one empty line item
      document.getElementById('df-dateReceived').value = new Date().toISOString().split('T')[0];
      container.appendChild(createLineItemRow(null));
    } else {
      // Editing existing receipt — fill shared fields and one line item
      document.getElementById('df-supplierId').value = receipt.supplierId || '';
      document.getElementById('df-dateReceived').value = receipt.dateReceived || '';
      document.getElementById('df-ticketNumber').value = receipt.ticketNumber || '';
      document.getElementById('df-receivedBy').value = receipt.receivedBy || '';
      document.getElementById('df-verifiedBy').value = receipt.verifiedBy || '';
      document.getElementById('df-notes').value = receipt.notes || '';
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
    if (!confirm('Delete this delivery record?')) return;
    api.del('/api/receipts/' + id).then(function () {
      loadReceipts();
      util.showToast('Delivery deleted');
    });
  };

  window.editDelivery = function (id) {
    var r = allReceipts.find(function (r) { return r.id === id; });
    if (r) openModal(r);
  };

})();
