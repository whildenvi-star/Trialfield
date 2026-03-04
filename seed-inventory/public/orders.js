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
      return '<tr>' +
        '<td>' + util.escapeHtml(util.productLabel(p)) + '</td>' +
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

  function openModal(order) {
    document.getElementById('order-modal-title').textContent = order ? 'Edit Order' : 'Add Order';
    form.reset();
    document.getElementById('of-id').value = order ? order.id : '';
    populateProductSelect('of-productId');
    populateSupplierSelect('of-supplierId');
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
    modal.classList.remove('hidden');
  }

  function closeModal() { modal.classList.add('hidden'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('of-id').value;
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
      notes: document.getElementById('of-notes').value
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
    if (!confirm('Delete this order?')) return;
    api.del('/api/orders/' + id).then(function () {
      loadOrders();
      util.showToast('Order deleted');
    });
  };

  window.editOrder = function (id) {
    var o = allOrders.find(function (o) { return o.id === id; });
    if (o) openModal(o);
  };

})();
