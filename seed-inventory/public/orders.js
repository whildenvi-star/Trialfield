// Orders tab: purchase order management
(function () {
  'use strict';

  var allOrders = [];

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'orders') loadOrders();
  });

  window.addEventListener('ref-data-loaded', function () {
    populateProductSelect('of-productId');
    populateSupplierSelect('of-supplierId');
    if (document.getElementById('tab-orders').classList.contains('active')) loadOrders();
  });

  // --- Filters ---
  var searchInput = document.getElementById('order-search');
  var paymentFilter = document.getElementById('order-payment-filter');
  if (searchInput) searchInput.addEventListener('input', renderOrders);
  if (paymentFilter) paymentFilter.addEventListener('change', renderOrders);

  function loadOrders() {
    var year = window.refData.settings.cropYear || 2026;
    api.get('/api/orders?cropYear=' + year).then(function (data) {
      allOrders = data;
      renderOrders();
    });
  }

  function renderOrders() {
    var tbody = document.getElementById('order-tbody');
    if (!tbody) return;

    var q = (searchInput ? searchInput.value : '').toLowerCase();
    var status = paymentFilter ? paymentFilter.value : '';

    var filtered = allOrders.filter(function (o) {
      if (status && o.paymentStatus !== status) return false;
      if (q) {
        var p = window.refData.products.find(function (p) { return p.id === o.productId; });
        var s = util.supplierName(o.supplierId, window.refData.suppliers);
        var haystack = [util.productLabel(p), s, o.invoiceNumber, o.notes].join(' ').toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No orders for this crop year.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (o) {
      var p = window.refData.products.find(function (p) { return p.id === o.productId; });
      var sName = util.supplierName(o.supplierId, window.refData.suppliers);
      var badgeClass = o.paymentStatus === 'PAID' ? 'badge-paid' : o.paymentStatus === 'PARTIAL' ? 'badge-partial' : 'badge-unpaid';
      var pkus = o.pickupNumbers || [];
      var pkuBadge = pkus.length > 0
        ? ' <span class="badge badge-pickup" title="' + pkus.length + ' pickup number(s)">' + pkus.length + ' PKU</span>'
        : '';
      return '<tr>' +
        '<td>' + util.escapeHtml(util.productLabel(p)) + pkuBadge + '</td>' +
        '<td>' + util.escapeHtml(sName) + '</td>' +
        '<td class="number">' + util.formatNum(o.quantityOrdered) + '</td>' +
        '<td>' + util.escapeHtml(o.unit) + '</td>' +
        '<td class="number">' + util.formatMoney(o.pricePerUnit) + '</td>' +
        '<td class="number"><strong>' + util.formatMoney(o.totalCost) + '</strong></td>' +
        '<td>' + util.escapeHtml(o.invoiceNumber) + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + o.paymentStatus + '</span></td>' +
        '<td>' + util.escapeHtml(o.dueDate) + '</td>' +
        '<td>' +
          '<button class="btn-edit" onclick="editOrder(\'' + o.id + '\')">Edit</button> ' +
          '<button class="btn-danger" onclick="deleteOrder(\'' + o.id + '\')">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  // --- Modal ---
  var modal = document.getElementById('order-modal');
  var form = document.getElementById('order-form');

  document.getElementById('add-order-btn').addEventListener('click', function () { openModal(null); });
  document.getElementById('order-modal-close').addEventListener('click', closeModal);
  document.getElementById('order-cancel-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  // Add-product panel in order form
  var oapPanel = document.getElementById('order-add-product-panel');
  document.getElementById('order-add-product-btn').addEventListener('click', function () {
    document.getElementById('oap-name').value = '';
    document.getElementById('oap-status').style.display = 'none';
    oapPanel.classList.toggle('hidden');
    if (!oapPanel.classList.contains('hidden')) document.getElementById('oap-name').focus();
  });
  document.getElementById('oap-type').addEventListener('change', function () {
    document.getElementById('oap-catgroup').style.display = this.value === 'SEED' ? 'none' : '';
  });
  document.getElementById('oap-cancel').addEventListener('click', function () { oapPanel.classList.add('hidden'); });
  document.getElementById('oap-save').addEventListener('click', function () {
    var name = document.getElementById('oap-name').value.trim();
    if (!name) { document.getElementById('oap-name').focus(); return; }
    var type = document.getElementById('oap-type').value;
    var cat  = document.getElementById('oap-category').value;
    var unit = document.getElementById('oap-unit').value.trim() || 'lbs';
    var pUnit = document.getElementById('oap-purchaseUnit').value.trim() || unit;
    var statusEl = document.getElementById('oap-status');
    var saveBtn = document.getElementById('oap-save');
    saveBtn.disabled = true;
    statusEl.textContent = 'Saving…'; statusEl.style.display = '';
    api.post('/api/products', {
      type: type,
      productName: type === 'INPUT' ? name : '',
      variety: type === 'SEED' ? name : '',
      inputCategory: type === 'INPUT' ? cat : '',
      unitType: unit,
      purchaseUnit: pUnit,
      conversionRate: 1,
      notes: 'Added during order entry'
    }).then(function (created) {
      window.reloadRefData().then(function () {
        oapPanel.classList.add('hidden');
        saveBtn.disabled = false;
        populateProductSelect('of-productId');
        document.getElementById('of-productId').value = created.id;
      });
    }).catch(function (err) {
      saveBtn.disabled = false;
      statusEl.textContent = 'Error: ' + (err.message || 'Save failed');
    });
  });

  // Pickup numbers state (belongs to the currently-open order)
  var pickupNumbers = [];

  function openModal(order) {
    document.getElementById('order-modal-title').textContent = order ? 'Edit Order' : 'Add Order';
    form.reset();
    document.getElementById('of-id').value = order ? order.id : '';
    populateProductSelect('of-productId');
    populateSupplierSelect('of-supplierId');
    pickupNumbers = order && Array.isArray(order.pickupNumbers) ? JSON.parse(JSON.stringify(order.pickupNumbers)) : [];
    if (order) {
      document.getElementById('of-productId').value = order.productId || '';
      document.getElementById('of-supplierId').value = order.supplierId || '';
      document.getElementById('of-quantityOrdered').value = order.quantityOrdered || '';
      document.getElementById('of-unit').value = order.unit || 'units';
      document.getElementById('of-pricePerUnit').value = order.pricePerUnit || '';
      document.getElementById('of-prepayDiscount').value = (order.prepayDiscount || 0) * 100;
      document.getElementById('of-invoiceNumber').value = order.invoiceNumber || '';
      document.getElementById('of-invoiceDate').value = order.invoiceDate || '';
      document.getElementById('of-dueDate').value = order.dueDate || '';
      document.getElementById('of-paymentStatus').value = order.paymentStatus || 'UNPAID';
      document.getElementById('of-notes').value = order.notes || '';
    }
    renderPickupNumbers();
    modal.classList.remove('hidden');
  }

  function closeModal() { modal.classList.add('hidden'); }

  // --- Pickup Numbers ---

  function renderPickupNumbers() {
    var container = document.getElementById('pku-container');
    if (!container) return;

    var section = document.getElementById('pku-section');
    if (section) section.classList.toggle('hidden', pickupNumbers.length === 0);

    if (pickupNumbers.length === 0) return;

    container.innerHTML = pickupNumbers.map(function (pku, i) {
      var statusClass = pku.status === 'received' ? 'pku-status-received' : pku.status === 'partial' ? 'pku-status-partial' : 'pku-status-pending';
      return '<tr class="pku-row" data-idx="' + i + '">' +
        '<td><input class="pku-num" type="text" value="' + util.escapeHtml(pku.pickupNum || '') + '" placeholder="P003" style="width:5rem"></td>' +
        '<td><input class="pku-qty" type="number" value="' + (pku.authorizedQty || '') + '" step="any" min="0" placeholder="10" style="width:5rem"></td>' +
        '<td><select class="pku-unit">' +
          ['units','bags','lbs','gal','tons','acre'].map(function (u) {
            return '<option value="' + u + '"' + (pku.unit === u ? ' selected' : '') + '>' + u.charAt(0).toUpperCase() + u.slice(1) + '</option>';
          }).join('') +
        '</select></td>' +
        '<td><input class="pku-farm" type="text" value="' + util.escapeHtml(pku.farmName || '') + '" placeholder="Farm (optional)" style="width:9rem"></td>' +
        '<td><input class="pku-crop" type="text" value="' + util.escapeHtml(pku.crop || '') + '" placeholder="Crop (optional)" style="width:7rem"></td>' +
        '<td><span class="badge ' + statusClass + '">' + (pku.status || 'pending') + '</span></td>' +
        '<td><input class="pku-notes" type="text" value="' + util.escapeHtml(pku.notes || '') + '" placeholder="Notes" style="width:9rem"></td>' +
        '<td><button type="button" class="btn-danger btn-sm pku-remove">Remove</button></td>' +
      '</tr>';
    }).join('');

    // Wire inputs to update pickupNumbers array on change
    container.querySelectorAll('.pku-row').forEach(function (row) {
      var idx = parseInt(row.getAttribute('data-idx'));
      row.querySelector('.pku-num').addEventListener('change', function () { pickupNumbers[idx].pickupNum = this.value; });
      row.querySelector('.pku-qty').addEventListener('change', function () { pickupNumbers[idx].authorizedQty = parseFloat(this.value) || 0; });
      row.querySelector('.pku-unit').addEventListener('change', function () { pickupNumbers[idx].unit = this.value; });
      row.querySelector('.pku-farm').addEventListener('change', function () { pickupNumbers[idx].farmName = this.value; });
      row.querySelector('.pku-crop').addEventListener('change', function () { pickupNumbers[idx].crop = this.value; });
      row.querySelector('.pku-notes').addEventListener('change', function () { pickupNumbers[idx].notes = this.value; });
      row.querySelector('.pku-remove').addEventListener('click', function () {
        pickupNumbers.splice(idx, 1);
        renderPickupNumbers();
      });
    });
  }

  var addPkuBtn = document.getElementById('pku-add-btn');
  if (addPkuBtn) {
    addPkuBtn.addEventListener('click', function () {
      var orderUnit = document.getElementById('of-unit').value || 'tons';
      pickupNumbers.push({
        id: 'pku_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
        pickupNum: '',
        authorizedQty: 0,
        unit: orderUnit,
        farmName: '',
        crop: '',
        notes: '',
        status: 'pending'
      });
      var section = document.getElementById('pku-section');
      if (section) section.classList.remove('hidden');
      renderPickupNumbers();
    });
  }

  // --- Form Submit ---

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('of-id').value;

    // Collect any in-flight edits from inputs (change events may not have fired if user tabs fast)
    var rows = document.querySelectorAll('#pku-container .pku-row');
    rows.forEach(function (row) {
      var idx = parseInt(row.getAttribute('data-idx'));
      if (pickupNumbers[idx]) {
        pickupNumbers[idx].pickupNum = row.querySelector('.pku-num').value;
        pickupNumbers[idx].authorizedQty = parseFloat(row.querySelector('.pku-qty').value) || 0;
        pickupNumbers[idx].unit = row.querySelector('.pku-unit').value;
        pickupNumbers[idx].farmName = row.querySelector('.pku-farm').value;
        pickupNumbers[idx].crop = row.querySelector('.pku-crop').value;
        pickupNumbers[idx].notes = row.querySelector('.pku-notes').value;
      }
    });

    var data = {
      productId: document.getElementById('of-productId').value,
      supplierId: document.getElementById('of-supplierId').value,
      cropYear: window.refData.settings.cropYear || 2026,
      quantityOrdered: parseFloat(document.getElementById('of-quantityOrdered').value) || 0,
      unit: document.getElementById('of-unit').value,
      pricePerUnit: parseFloat(document.getElementById('of-pricePerUnit').value) || 0,
      prepayDiscount: (parseFloat(document.getElementById('of-prepayDiscount').value) || 0) / 100,
      invoiceNumber: document.getElementById('of-invoiceNumber').value,
      invoiceDate: document.getElementById('of-invoiceDate').value,
      dueDate: document.getElementById('of-dueDate').value,
      paymentStatus: document.getElementById('of-paymentStatus').value,
      notes: document.getElementById('of-notes').value,
      pickupNumbers: pickupNumbers
    };

    var promise = id ? api.put('/api/orders/' + id, data) : api.post('/api/orders', data);
    promise.then(function () {
      closeModal();
      loadOrders();
      util.showToast(id ? 'Order updated' : 'Order added');
    }).catch(function (err) {
      util.showToast('Error: ' + err.message, 'error');
    });
  });

  window.deleteOrder = function (id) {
    util.confirm('Delete this order?').then(function (ok) {
      if (!ok) return;
      api.del('/api/orders/' + id).then(function () {
        loadOrders();
        util.showToast('Order deleted');
      }).catch(function (err) {
        util.showToast('Error: ' + err.message, 'error');
      });
    });
  };

  window.editOrder = function (id) {
    var o = allOrders.find(function (o) { return o.id === id; });
    if (o) openModal(o);
  };

})();
