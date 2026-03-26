// Suppliers tab: CRUD for vendor directory with Farm Budget sync status
(function () {
  'use strict';

  var allSuppliers = [];
  var mappings = {};

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'suppliers') loadSuppliers();
  });

  window.addEventListener('ref-data-loaded', function () {
    if (document.getElementById('tab-suppliers').classList.contains('active')) loadSuppliers();
  });

  // --- Search ---
  var searchInput = document.getElementById('supplier-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderSuppliers();
    });
  }

  function loadSuppliers() {
    Promise.all([
      api.get('/api/suppliers'),
      api.get('/api/supplier-mappings')
    ]).then(function (results) {
      allSuppliers = results[0].filter(function (s) { return s.active !== false; });
      mappings = {};
      results[1].forEach(function (m) { mappings[m.localSupplierId] = m; });
      renderSuppliers();
    });
  }

  function renderSuppliers() {
    var tbody = document.getElementById('supplier-tbody');
    if (!tbody) return;
    var q = (searchInput ? searchInput.value : '').toLowerCase();

    var filtered = allSuppliers.filter(function (s) {
      if (!q) return true;
      return [s.name, s.contactName, s.phone, s.email].join(' ').toLowerCase().indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No suppliers yet. Click "+ Add Supplier" to get started.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (s) {
      var synced = mappings[s.id];
      var syncBadge = synced
        ? '<span class="sync-badge synced" title="Synced ' + synced.syncedAt + '">&#10003; synced</span>'
        : '<span class="sync-badge not-synced">&#8212; not synced</span>';

      return '<tr>' +
        '<td><strong>' + util.escapeHtml(s.name) + '</strong></td>' +
        '<td>' + util.escapeHtml(s.contactName) + '</td>' +
        '<td>' + util.escapeHtml(s.phone) + '</td>' +
        '<td>' + util.escapeHtml(s.email) + '</td>' +
        '<td>' + syncBadge + '</td>' +
        '<td>' + util.escapeHtml(s.notes) + '</td>' +
        '<td>' +
          '<button class="btn-edit" onclick="editSupplier(\'' + s.id + '\')">Edit</button> ' +
          '<button class="btn-danger" onclick="deleteSupplier(\'' + s.id + '\')">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  // --- Modal ---
  var modal = document.getElementById('supplier-modal');
  var form = document.getElementById('supplier-form');

  document.getElementById('add-supplier-btn').addEventListener('click', function () {
    openModal(null);
  });

  document.getElementById('supplier-modal-close').addEventListener('click', closeModal);
  document.getElementById('supplier-cancel-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  function openModal(supplier) {
    document.getElementById('supplier-modal-title').textContent = supplier ? 'Edit Supplier' : 'Add Supplier';
    form.reset();
    document.getElementById('sf-id').value = supplier ? supplier.id : '';
    if (supplier) {
      document.getElementById('sf-name').value = supplier.name || '';
      document.getElementById('sf-contactName').value = supplier.contactName || '';
      document.getElementById('sf-phone').value = supplier.phone || '';
      document.getElementById('sf-email').value = supplier.email || '';
      document.getElementById('sf-address').value = supplier.address || '';
      document.getElementById('sf-notes').value = supplier.notes || '';
    }
    modal.classList.remove('hidden');
  }

  function closeModal() { modal.classList.add('hidden'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('sf-id').value;
    var data = {
      name: document.getElementById('sf-name').value,
      contactName: document.getElementById('sf-contactName').value,
      phone: document.getElementById('sf-phone').value,
      email: document.getElementById('sf-email').value,
      address: document.getElementById('sf-address').value,
      notes: document.getElementById('sf-notes').value
    };

    var promise = id ? api.put('/api/suppliers/' + id, data) : api.post('/api/suppliers', data);
    promise.then(function () {
      closeModal();
      loadSuppliers();
      reloadRefData();
      util.showToast(id ? 'Supplier updated' : 'Supplier added');
    }).catch(function (err) {
      util.showToast('Error: ' + err.message, 'error');
    });
  });

  window.deleteSupplier = function (id) {
    util.confirm('Delete this supplier?').then(function (ok) {
      if (!ok) return;
      api.del('/api/suppliers/' + id).then(function () {
        loadSuppliers();
        reloadRefData();
        util.showToast('Supplier deleted');
      }).catch(function (err) {
        util.showToast('Error: ' + err.message, 'error');
      });
    });
  };

  window.editSupplier = function (id) {
    var s = allSuppliers.find(function (s) { return s.id === id; });
    if (s) openModal(s);
  };

  // --- Sync All to Farm Budget ---
  var syncAllBtn = document.getElementById('sync-suppliers-btn');
  if (syncAllBtn) {
    syncAllBtn.addEventListener('click', function () {
      util.confirm('Sync all suppliers to Farm Budget? This will create any missing suppliers in the macro.').then(function (ok) {
        if (!ok) return;
        syncAllBtn.disabled = true;
        syncAllBtn.textContent = 'Syncing...';
        api.post('/api/budget/sync-suppliers', {}).then(function (result) {
          util.showToast('Synced: ' + result.created + ' created, ' + result.alreadyMapped + ' already mapped');
          loadSuppliers();
        }).catch(function (err) {
          util.showToast('Sync failed: ' + (err.message || 'Could not reach Farm Budget'), 'error');
        }).finally(function () {
          syncAllBtn.disabled = false;
          syncAllBtn.textContent = 'Sync All to Farm Budget';
        });
      });
    });
  }

})();
