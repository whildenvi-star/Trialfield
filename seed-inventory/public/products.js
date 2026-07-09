// Products tab — full CRUD management backed by local /api/products store
(function () {
  'use strict';

  var products = [];
  var currentSubtab = 'SEED';
  var currentSearch = '';
  var editingId = null;
  var mergingSourceId = null;

  // ─── Sub-tab switching ──────────────────────────────────────────────

  document.querySelectorAll('.prod-subtab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.prod-subtab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentSubtab = btn.getAttribute('data-subtab');
      currentSearch = '';
      var el = document.getElementById('product-search');
      if (el) el.value = '';
      renderProducts();
    });
  });

  // ─── Search ─────────────────────────────────────────────────────────

  var searchEl = document.getElementById('product-search');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      currentSearch = searchEl.value.toLowerCase();
      renderProducts();
    });
  }

  // ─── Add button ─────────────────────────────────────────────────────

  var addBtn = document.getElementById('add-product-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      openProductModal(null, currentSubtab);
    });
  }

  // ─── Load triggers ──────────────────────────────────────────────────

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'products') loadProducts();
  });

  window.addEventListener('ref-data-loaded', function () {
    var tab = document.getElementById('tab-products');
    if (tab && tab.classList.contains('active')) loadProducts();
  });

  function loadProducts() {
    // Background sync from farm-budget so new seeds added there appear here
    api.post('/api/products/sync-from-budget', {}).catch(function () {});

    api.get('/api/products').then(function (data) {
      products = (data || []).filter(function (p) { return p.active !== false; });
      renderProducts();
    }).catch(function () {
      products = [];
      renderProducts();
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────

  function renderProducts() {
    var tbody = document.getElementById('product-tbody');
    var thead = document.getElementById('product-thead');
    if (!tbody || !thead) return;

    var filtered = products.filter(function (p) {
      if (p.type !== currentSubtab) return false;
      if (currentSearch) {
        var haystack = (currentSubtab === 'SEED')
          ? [p.variety, p.crop, p.brand, p.maturity, p.supplier].join(' ').toLowerCase()
          : [p.productName, p.inputCategory, p.supplier].join(' ').toLowerCase();
        if (haystack.indexOf(currentSearch) === -1) return false;
      }
      return true;
    });

    var sumEl = document.getElementById('product-summary');
    if (sumEl) {
      sumEl.textContent = filtered.length + ' ' + (currentSubtab === 'SEED' ? 'seed' : 'input') + (filtered.length !== 1 ? 's' : '');
    }

    if (currentSubtab === 'SEED') {
      thead.innerHTML = '<tr><th>Crop</th><th>Variety</th><th>Maturity</th><th>Brand</th><th>Billed Unit</th><th>Supplier</th><th>Organic</th><th></th></tr>';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No seeds yet. Use “+ New Product” to add one.</td></tr>';
        return;
      }
      tbody.innerHTML = filtered.map(function (p) {
        var org = p.organicGround ? '<span class="badge badge-seed">ORG</span>' : '';
        return '<tr>' +
          '<td>' + util.escapeHtml(p.crop || '') + '</td>' +
          '<td><strong>' + util.escapeHtml(p.variety || '') + '</strong></td>' +
          '<td>' + util.escapeHtml(p.maturity || '') + '</td>' +
          '<td>' + util.escapeHtml(p.brand || '') + '</td>' +
          '<td>' + util.escapeHtml(p.purchaseUnit || p.unitType || '') + '</td>' +
          '<td>' + util.escapeHtml(p.supplier || '') + '</td>' +
          '<td>' + org + '</td>' +
          '<td class="row-actions">' +
            '<button class="btn-sm prod-edit" data-id="' + p.id + '" title="Edit">✎</button>' +
            ' <button class="btn-sm prod-merge" data-id="' + p.id + '" title="Merge duplicate">⇄</button>' +
            ' <button class="btn-sm btn-danger btn-sm prod-delete" data-id="' + p.id + '" title="Delete">✕</button>' +
          '</td></tr>';
      }).join('');
    } else {
      thead.innerHTML = '<tr><th>Name</th><th>Category</th><th>App Unit</th><th>Billed Unit</th><th>Supplier</th><th>Organic</th><th></th></tr>';
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No inputs yet. Use “+ New Product” to add one.</td></tr>';
        return;
      }
      var catLabel = { FERTILIZER: 'Fertilizer', CHEMICAL: 'Chemical', BIOLOGICAL: 'Biological', OTHER: 'Other' };
      tbody.innerHTML = filtered.map(function (p) {
        var org = p.organicGround ? '<span class="badge badge-biological">ORG</span>' : '';
        return '<tr>' +
          '<td><strong>' + util.escapeHtml(p.productName || '') + '</strong></td>' +
          '<td>' + util.escapeHtml(catLabel[p.inputCategory] || p.inputCategory || '') + '</td>' +
          '<td>' + util.escapeHtml(p.unitType || '') + '</td>' +
          '<td>' + util.escapeHtml(p.purchaseUnit || '') + '</td>' +
          '<td>' + util.escapeHtml(p.supplier || '') + '</td>' +
          '<td>' + org + '</td>' +
          '<td class="row-actions">' +
            '<button class="btn-sm prod-edit" data-id="' + p.id + '" title="Edit">✎</button>' +
            ' <button class="btn-sm prod-merge" data-id="' + p.id + '" title="Merge duplicate">⇄</button>' +
            ' <button class="btn-sm btn-danger btn-sm prod-delete" data-id="' + p.id + '" title="Delete">✕</button>' +
          '</td></tr>';
      }).join('');
    }

    tbody.querySelectorAll('.prod-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = products.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        if (p) openProductModal(p, p.type);
      });
    });

    tbody.querySelectorAll('.prod-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var p = products.find(function (x) { return x.id === id; });
        var label = p ? (p.variety || p.productName || id) : id;
        util.confirm('Delete "' + label + '"? This will also deactivate it in Farm Budget.').then(function (ok) {
          if (!ok) return;
          api.del('/api/products/' + id).then(function () {
            util.showToast('Product deleted');
            loadProducts();
            window.reloadRefData && window.reloadRefData();
          }).catch(function (err) {
            util.showToast('Delete failed: ' + (err.message || 'Unknown error'), 'error');
          });
        });
      });
    });

    tbody.querySelectorAll('.prod-merge').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openMergeModal(btn.getAttribute('data-id'));
      });
    });
  }

  // ─── Add / Edit Modal ───────────────────────────────────────────────

  var productModal = document.getElementById('product-modal');
  var productForm = document.getElementById('product-form');

  var closeModalBtn = document.getElementById('product-modal-close');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeProductModal);
  var cancelBtn = document.getElementById('pf-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeProductModal);
  if (productModal) {
    productModal.addEventListener('click', function (e) {
      if (e.target === productModal) closeProductModal();
    });
  }

  document.querySelectorAll('.pf-type-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (editingId) return; // type locked when editing
      document.querySelectorAll('.pf-type-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      setModalType(btn.getAttribute('data-ptype'));
    });
  });

  function setModalType(type) {
    var seedFields = document.getElementById('pf-seed-fields');
    var inputFields = document.getElementById('pf-input-fields');
    if (seedFields) seedFields.classList.toggle('hidden', type !== 'SEED');
    if (inputFields) inputFields.classList.toggle('hidden', type !== 'INPUT');
  }

  function populateSupplierDropdowns(currentVal) {
    var suppliers = (window.refData && window.refData.suppliers)
      ? window.refData.suppliers.filter(function (s) { return s.active !== false; })
      : [];
    var opts = '<option value="">--</option>' + suppliers.map(function (s) {
      return '<option value="' + util.escapeHtml(s.name) + '">' + util.escapeHtml(s.name) + '</option>';
    }).join('');
    ['pf-supplier', 'pf-supplier-i'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.innerHTML = opts;
        if (currentVal) el.value = currentVal;
      }
    });
  }

  function openProductModal(product, defaultType) {
    editingId = product ? product.id : null;
    var type = product ? product.type : (defaultType || 'SEED');

    document.querySelectorAll('.pf-type-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-ptype') === type);
      b.disabled = !!editingId;
    });
    setModalType(type);

    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('pf-id').value = product ? product.id : '';
    document.getElementById('pf-status').style.display = 'none';

    populateSupplierDropdowns(product ? product.supplier : '');

    if (type === 'SEED') {
      document.getElementById('pf-crop').value = (product && product.crop) || '';
      document.getElementById('pf-variety').value = (product && product.variety) || '';
      document.getElementById('pf-maturity').value = (product && product.maturity) || '';
      document.getElementById('pf-brand').value = (product && product.brand) || '';
      document.getElementById('pf-purchaseUnit').value = (product && product.purchaseUnit) || '';
      document.getElementById('pf-unitType').value = (product && product.unitType) || '';
      document.getElementById('pf-conversionRate').value = (product && product.conversionRate) ? product.conversionRate : '';
      document.getElementById('pf-pricePerUnit').value = (product && product.pricePerUnit != null) ? product.pricePerUnit : '';
      document.getElementById('pf-organicGround').checked = !!(product && product.organicGround);
      document.getElementById('pf-notes').value = (product && product.notes) || '';
    } else {
      document.getElementById('pf-productName').value = (product && product.productName) || '';
      document.getElementById('pf-inputCategory').value = (product && product.inputCategory) || 'FERTILIZER';
      document.getElementById('pf-unitType-i').value = (product && product.unitType) || '';
      document.getElementById('pf-purchaseUnit-i').value = (product && product.purchaseUnit) || '';
      document.getElementById('pf-conversionRate-i').value = (product && product.conversionRate) ? product.conversionRate : '';
      document.getElementById('pf-pricePerUnit-i').value = (product && product.pricePerUnit != null) ? product.pricePerUnit : '';
      document.getElementById('pf-organicGround-i').checked = !!(product && product.organicGround);
      document.getElementById('pf-notes-i').value = (product && product.notes) || '';
    }

    productModal.classList.remove('hidden');
  }

  function closeProductModal() {
    if (productModal) productModal.classList.add('hidden');
    editingId = null;
  }

  if (productForm) {
    productForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var statusEl = document.getElementById('pf-status');
      var saveBtn = productForm.querySelector('[type="submit"]');
      var activeTypeBtn = document.querySelector('.pf-type-btn.active');
      var type = activeTypeBtn ? activeTypeBtn.getAttribute('data-ptype') : 'SEED';

      var payload;
      if (type === 'SEED') {
        var variety = document.getElementById('pf-variety').value.trim();
        if (!variety) {
          statusEl.textContent = 'Variety is required';
          statusEl.style.display = '';
          document.getElementById('pf-variety').focus();
          return;
        }
        var priceStr = document.getElementById('pf-pricePerUnit').value;
        payload = {
          type: 'SEED',
          crop: document.getElementById('pf-crop').value,
          variety: variety,
          maturity: document.getElementById('pf-maturity').value.trim(),
          brand: document.getElementById('pf-brand').value.trim(),
          purchaseUnit: document.getElementById('pf-purchaseUnit').value.trim() || 'units',
          unitType: document.getElementById('pf-unitType').value.trim() || document.getElementById('pf-purchaseUnit').value.trim() || 'units',
          conversionRate: parseFloat(document.getElementById('pf-conversionRate').value) || 1,
          pricePerUnit: priceStr !== '' ? parseFloat(priceStr) : null,
          supplier: document.getElementById('pf-supplier').value,
          organicGround: document.getElementById('pf-organicGround').checked,
          notes: document.getElementById('pf-notes').value.trim()
        };
      } else {
        var name = document.getElementById('pf-productName').value.trim();
        if (!name) {
          statusEl.textContent = 'Product name is required';
          statusEl.style.display = '';
          document.getElementById('pf-productName').focus();
          return;
        }
        var iPriceStr = document.getElementById('pf-pricePerUnit-i').value;
        payload = {
          type: 'INPUT',
          productName: name,
          inputCategory: document.getElementById('pf-inputCategory').value,
          unitType: document.getElementById('pf-unitType-i').value.trim() || 'lbs',
          purchaseUnit: document.getElementById('pf-purchaseUnit-i').value.trim() || 'lbs',
          conversionRate: parseFloat(document.getElementById('pf-conversionRate-i').value) || 1,
          pricePerUnit: iPriceStr !== '' ? parseFloat(iPriceStr) : null,
          supplier: document.getElementById('pf-supplier-i').value,
          organicGround: document.getElementById('pf-organicGround-i').checked,
          notes: document.getElementById('pf-notes-i').value.trim()
        };
      }

      saveBtn.disabled = true;
      statusEl.textContent = 'Saving…';
      statusEl.style.display = '';

      var id = document.getElementById('pf-id').value;
      var req = id ? api.put('/api/products/' + id, payload) : api.post('/api/products', payload);
      req.then(function () {
        closeProductModal();
        util.showToast(id ? 'Product updated' : 'Product added');
        loadProducts();
        window.reloadRefData && window.reloadRefData();
      }).catch(function (err) {
        saveBtn.disabled = false;
        statusEl.textContent = 'Error: ' + (err.message || 'Save failed');
      });
    });
  }

  // ─── Merge Modal ────────────────────────────────────────────────────

  var mergeModal = document.getElementById('merge-modal');
  var mergeTargetSearch = document.getElementById('merge-target-search');
  var mergeTargetId = document.getElementById('merge-target-id');
  var mergeTargetAclist = document.getElementById('merge-target-aclist');

  var mergeCancelBtn = document.getElementById('merge-cancel-btn');
  if (mergeCancelBtn) mergeCancelBtn.addEventListener('click', closeMergeModal);
  var mergeCloseBtn = document.getElementById('merge-modal-close');
  if (mergeCloseBtn) mergeCloseBtn.addEventListener('click', closeMergeModal);
  if (mergeModal) {
    mergeModal.addEventListener('click', function (e) {
      if (e.target === mergeModal) closeMergeModal();
    });
  }

  if (mergeTargetSearch) {
    mergeTargetSearch.addEventListener('input', function () {
      if (mergeTargetId) mergeTargetId.value = '';
      var mcb = document.getElementById('merge-confirm-btn');
      if (mcb) mcb.disabled = true;

      var q = mergeTargetSearch.value.toLowerCase();
      if (!q) { if (mergeTargetAclist) mergeTargetAclist.classList.remove('open'); return; }

      var src = products.find(function (p) { return p.id === mergingSourceId; });
      var matches = products.filter(function (p) {
        if (p.id === mergingSourceId) return false;
        if (src && p.type !== src.type) return false;
        var label = [p.variety, p.productName, p.crop, p.brand].join(' ');
        return label.toLowerCase().indexOf(q) !== -1;
      });

      if (!mergeTargetAclist) return;
      if (matches.length === 0) {
        mergeTargetAclist.innerHTML = '<div class="autocomplete-item" style="color:var(--text-light);cursor:default">No matches</div>';
        mergeTargetAclist.classList.add('open');
        return;
      }
      mergeTargetAclist.innerHTML = matches.slice(0, 8).map(function (p) {
        var label = p.type === 'SEED'
          ? (p.variety || '') + (p.crop ? ' (' + p.crop + ')' : '') + (p.maturity ? ' ' + p.maturity : '')
          : (p.productName || '');
        return '<div class="autocomplete-item" data-id="' + p.id + '">' + util.escapeHtml(label) + '</div>';
      }).join('');
      mergeTargetAclist.classList.add('open');
    });
  }

  if (mergeTargetAclist) {
    mergeTargetAclist.addEventListener('click', function (e) {
      var item = e.target.closest('[data-id]');
      if (!item) return;
      if (mergeTargetId) mergeTargetId.value = item.getAttribute('data-id');
      if (mergeTargetSearch) mergeTargetSearch.value = item.textContent;
      mergeTargetAclist.classList.remove('open');
      var mcb = document.getElementById('merge-confirm-btn');
      if (mcb) mcb.disabled = false;
    });
  }

  var mergeConfirmBtnEl = document.getElementById('merge-confirm-btn');
  if (mergeConfirmBtnEl) {
    mergeConfirmBtnEl.addEventListener('click', function () {
      var targetId = mergeTargetId && mergeTargetId.value;
      if (!targetId || !mergingSourceId) return;
      var statusEl = document.getElementById('merge-status');
      mergeConfirmBtnEl.disabled = true;
      statusEl.textContent = 'Merging…';
      statusEl.style.display = '';

      api.post('/api/products/' + mergingSourceId + '/merge', { targetProductId: targetId }).then(function () {
        closeMergeModal();
        util.showToast('Products merged');
        loadProducts();
        window.reloadRefData && window.reloadRefData();
      }).catch(function (err) {
        mergeConfirmBtnEl.disabled = false;
        statusEl.textContent = 'Error: ' + (err.message || 'Merge failed');
      });
    });
  }

  function openMergeModal(sourceId) {
    mergingSourceId = sourceId;
    var p = products.find(function (x) { return x.id === sourceId; });
    var label = p ? (p.variety || p.productName || sourceId) : sourceId;
    var srcLabel = document.getElementById('merge-source-label');
    if (srcLabel) srcLabel.textContent = 'Merging away: ' + label;
    if (mergeTargetSearch) mergeTargetSearch.value = '';
    if (mergeTargetId) mergeTargetId.value = '';
    if (mergeTargetAclist) mergeTargetAclist.classList.remove('open');
    var mcb = document.getElementById('merge-confirm-btn');
    if (mcb) mcb.disabled = true;
    var statusEl = document.getElementById('merge-status');
    if (statusEl) statusEl.style.display = 'none';
    if (mergeModal) mergeModal.classList.remove('hidden');
  }

  function closeMergeModal() {
    if (mergeModal) mergeModal.classList.add('hidden');
    mergingSourceId = null;
  }

})();
