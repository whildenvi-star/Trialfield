// Returns tab: product return tracking with credit management
(function () {
  'use strict';

  var allReturns = [];

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'returns') loadReturns();
  });

  window.addEventListener('ref-data-loaded', function () {
    populateProductSelect('rf-productId');
    populateSupplierSelect('rf-supplierId');
    if (document.getElementById('tab-returns').classList.contains('active')) loadReturns();
  });

  var searchInput = document.getElementById('return-search');
  if (searchInput) searchInput.addEventListener('input', renderReturns);

  function loadReturns() {
    api.get('/api/returns').then(function (data) {
      allReturns = data;
      renderReturns();
    });
  }

  function renderReturns() {
    var tbody = document.getElementById('return-tbody');
    if (!tbody) return;

    var q = (searchInput ? searchInput.value : '').toLowerCase();

    var filtered = allReturns.filter(function (r) {
      if (!q) return true;
      var p = window.refData.products.find(function (p) { return p.id === r.productId; });
      var s = util.supplierName(r.supplierId, window.refData.suppliers);
      var haystack = [util.productLabel(p), s, r.reason, r.processedBy].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No returns recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (r) {
      var p = window.refData.products.find(function (p) { return p.id === r.productId; });
      var sName = util.supplierName(r.supplierId, window.refData.suppliers);
      return '<tr>' +
        '<td>' + util.escapeHtml(r.dateReturned) + '</td>' +
        '<td>' + util.escapeHtml(util.productLabel(p)) + '</td>' +
        '<td>' + util.escapeHtml(sName) + '</td>' +
        '<td class="number">' + util.formatNum(r.quantityReturned) + '</td>' +
        '<td>' + util.escapeHtml(r.unit) + '</td>' +
        '<td>' + util.escapeHtml(r.reason) + '</td>' +
        '<td class="number">' + util.formatMoney(r.creditAmount) + '</td>' +
        '<td>' + (r.creditReceived ? '<span class="badge badge-paid">YES</span>' : '<span class="badge badge-unpaid">NO</span>') + '</td>' +
        '<td>' +
          '<button class="btn-edit" onclick="editReturn(\'' + r.id + '\')">Edit</button> ' +
          '<button class="btn-danger" onclick="deleteReturn(\'' + r.id + '\')">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  // --- Modal ---
  var modal = document.getElementById('return-modal');
  var form = document.getElementById('return-form');

  document.getElementById('add-return-btn').addEventListener('click', function () { openModal(null); });
  document.getElementById('return-modal-close').addEventListener('click', closeModal);
  document.getElementById('return-cancel-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  function openModal(ret) {
    document.getElementById('return-modal-title').textContent = ret ? 'Edit Return' : 'Record Return';
    form.reset();
    document.getElementById('rf-id').value = ret ? ret.id : '';
    populateProductSelect('rf-productId');
    populateSupplierSelect('rf-supplierId');
    if (!ret) {
      document.getElementById('rf-dateReturned').value = new Date().toISOString().split('T')[0];
    }
    if (ret) {
      document.getElementById('rf-productId').value = ret.productId || '';
      document.getElementById('rf-supplierId').value = ret.supplierId || '';
      document.getElementById('rf-dateReturned').value = ret.dateReturned || '';
      document.getElementById('rf-quantityReturned').value = ret.quantityReturned || '';
      document.getElementById('rf-unit').value = ret.unit || 'units';
      document.getElementById('rf-reason').value = ret.reason || '';
      document.getElementById('rf-creditAmount').value = ret.creditAmount || '';
      document.getElementById('rf-processedBy').value = ret.processedBy || '';
      document.getElementById('rf-creditReceived').checked = ret.creditReceived || false;
      document.getElementById('rf-notes').value = ret.notes || '';
    }
    modal.classList.remove('hidden');
  }

  function closeModal() { modal.classList.add('hidden'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('rf-id').value;
    var data = {
      productId: document.getElementById('rf-productId').value,
      orderId: document.getElementById('rf-orderId').value,
      supplierId: document.getElementById('rf-supplierId').value,
      dateReturned: document.getElementById('rf-dateReturned').value,
      quantityReturned: parseFloat(document.getElementById('rf-quantityReturned').value) || 0,
      unit: document.getElementById('rf-unit').value,
      reason: document.getElementById('rf-reason').value,
      creditAmount: parseFloat(document.getElementById('rf-creditAmount').value) || 0,
      creditReceived: document.getElementById('rf-creditReceived').checked,
      processedBy: document.getElementById('rf-processedBy').value,
      notes: document.getElementById('rf-notes').value
    };

    var promise = id ? api.put('/api/returns/' + id, data) : api.post('/api/returns', data);
    promise.then(function () {
      closeModal();
      loadReturns();
      util.showToast(id ? 'Return updated' : 'Return recorded');
    }).catch(function (err) {
      util.showToast('Error: ' + err.message, 'error');
    });
  });

  window.deleteReturn = function (id) {
    util.confirm('Delete this return?').then(function (ok) {
      if (!ok) return;
      api.del('/api/returns/' + id).then(function () {
        loadReturns();
        util.showToast('Return deleted');
      }).catch(function (err) {
        util.showToast('Error: ' + err.message, 'error');
      });
    });
  };

  window.editReturn = function (id) {
    var r = allReturns.find(function (r) { return r.id === id; });
    if (r) openModal(r);
  };

})();
