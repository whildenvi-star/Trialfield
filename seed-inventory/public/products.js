// Products tab: read-only lookup from Farm Budget catalog with local organic cert overlay
(function () {
  'use strict';

  var catalog = [];
  var overlays = {};
  var currentFilter = { cat: '', search: '' };

  // --- Category filter ---
  document.querySelectorAll('.catalog-cat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.catalog-cat').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter.cat = btn.getAttribute('data-cat');
      renderCatalog();
    });
  });

  // --- Search ---
  var searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      currentFilter.search = searchInput.value.toLowerCase();
      renderCatalog();
    });
  }

  // --- Load on tab activate ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'products') loadCatalog();
  });

  window.addEventListener('ref-data-loaded', function () {
    if (document.getElementById('tab-products').classList.contains('active')) loadCatalog();
  });

  function loadCatalog() {
    Promise.all([
      api.get('/api/budget/catalog'),
      api.get('/api/product-overlays')
    ]).then(function (results) {
      var catData = results[0];
      var ovls = results[1];

      var offlineBanner = document.getElementById('catalog-offline');

      if (catData.offline) {
        if (offlineBanner) offlineBanner.classList.remove('hidden');
        catalog = [];
        renderCatalog();
        return;
      }

      if (offlineBanner) offlineBanner.classList.add('hidden');
      catalog = catData.catalog || [];

      // Build overlay lookup
      overlays = {};
      ovls.forEach(function (o) { overlays[o.budgetProductId] = o; });

      renderCatalog();
    }).catch(function () {
      var offlineBanner = document.getElementById('catalog-offline');
      if (offlineBanner) offlineBanner.classList.remove('hidden');
    });
  }

  var categoryBadgeMap = {
    'Seed': 'seed', 'Fertilizer': 'fertilizer', 'Chemical': 'chemical',
    'Biological': 'biological', 'Other': 'other'
  };

  function renderCatalog() {
    var tbody = document.getElementById('product-tbody');
    if (!tbody) return;

    var filtered = catalog.filter(function (p) {
      if (currentFilter.cat && p.category !== currentFilter.cat) return false;
      if (currentFilter.search) {
        var haystack = [p.name, p.category, p.supplier, p.unit, p.crop, p.brand, p.variety].join(' ').toLowerCase();
        if (haystack.indexOf(currentFilter.search) === -1) return false;
      }
      return true;
    });

    updateSummary(filtered.length);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">' +
        (catalog.length === 0 ? 'Catalog unavailable. Ensure Farm Budget is running on port 3001.' : 'No products match your filter.') +
        '</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (p, idx) {
      var ovl = overlays[p.budgetId] || {};
      var badgeClass = categoryBadgeMap[p.category] || 'other';
      var organicFlag = p.organic ? '<span class="badge badge-seed">ORG</span>' : '';
      var certNum = ovl.organicCertNumber || '';
      var omri = ovl.omriListed ? ' <span class="badge badge-biological">OMRI</span>' : '';
      var rowId = 'cat-row-' + idx;

      // Price display
      var price = '';
      if (p.budgetType === 'seed' && p.pricePerUnit) {
        price = util.formatMoney(p.pricePerUnit) + '/unit';
      } else if (p.applicationPrice) {
        price = util.formatMoney(p.applicationPrice) + '/' + (p.unit || 'unit');
      } else if (p.unitBilledPrice) {
        price = util.formatMoney(p.unitBilledPrice) + '/' + (p.purchaseUnit || p.unit || 'unit');
      }

      // Detail row
      var details = [];
      if (p.budgetType === 'seed') {
        if (p.crop) details.push('<strong>Crop:</strong> ' + util.escapeHtml(p.crop));
        if (p.brand) details.push('<strong>Brand:</strong> ' + util.escapeHtml(p.brand));
        if (p.variety) details.push('<strong>Variety:</strong> ' + util.escapeHtml(p.variety));
        if (p.seedsPerUnit) details.push('<strong>Seeds/Unit:</strong> ' + util.formatNum(p.seedsPerUnit));
        if (p.pricePerUnit) details.push('<strong>Price/Unit:</strong> ' + util.formatMoney(p.pricePerUnit));
      } else {
        if (p.unitBilledPrice) details.push('<strong>Billed Price:</strong> ' + util.formatMoney(p.unitBilledPrice) + '/' + util.escapeHtml(p.purchaseUnit || p.unit || 'unit'));
        if (p.conversionRate && p.conversionRate !== 1) details.push('<strong>Conversion:</strong> ' + p.conversionRate + ' ' + util.escapeHtml(p.unit) + '/' + util.escapeHtml(p.purchaseUnit || 'unit'));
        if (p.applicationPrice) details.push('<strong>App Price:</strong> ' + util.formatMoney(p.applicationPrice) + '/' + util.escapeHtml(p.unit || 'unit'));
        if (p.p205) details.push('<strong>P2O5:</strong> ' + p.p205 + '%');
        if (p.k20) details.push('<strong>K2O:</strong> ' + p.k20 + '%');
      }
      if (ovl.localNotes) details.push('<strong>Notes:</strong> ' + util.escapeHtml(ovl.localNotes));

      var detailHtml = details.length > 0
        ? '<tr class="field-details hidden" id="' + rowId + '"><td colspan="8"><div class="detail-grid">' + details.join(' &nbsp;&bull;&nbsp; ') + '</div></td></tr>'
        : '';

      // Supplier select
      var suppliers = window.refData.suppliers || [];
      var supplierOpts = '<option value="">--</option>';
      suppliers.forEach(function (s) {
        if (s.active === false) return;
        supplierOpts += '<option value="' + s.id + '">' + util.escapeHtml(s.name) + '</option>';
      });
      var supplierCell = '<select class="supplier-select" data-bid="' + p.budgetId + '" data-btype="' + p.budgetType + '">' + supplierOpts + '</select>';
      if (p.supplier) {
        supplierCell = '<span class="current-supplier">' + util.escapeHtml(p.supplier) + '</span> ' + supplierCell;
      }

      return '<tr class="product-row" data-target="' + rowId + '">' +
        '<td class="product-name"><span class="expand-icon">&#9654;</span> ' + util.escapeHtml(p.name) + '</td>' +
        '<td><span class="badge badge-' + badgeClass + '">' + util.escapeHtml(p.category) + '</span></td>' +
        '<td class="supplier-cell">' + supplierCell + '</td>' +
        '<td>' + util.escapeHtml(p.unit || '') + '</td>' +
        '<td class="number">' + price + '</td>' +
        '<td>' + organicFlag + omri + '</td>' +
        '<td>' + util.escapeHtml(certNum) + '</td>' +
        '<td><button class="btn-cert" data-bid="' + p.budgetId + '" data-btype="' + p.budgetType + '">Edit Cert</button></td>' +
      '</tr>' + detailHtml;
    }).join('');

    // Attach supplier change handlers
    tbody.querySelectorAll('.supplier-select').forEach(function (sel) {
      sel.addEventListener('click', function (e) { e.stopPropagation(); });
      sel.addEventListener('change', function () {
        var bid = sel.getAttribute('data-bid');
        var btype = sel.getAttribute('data-btype');
        var supplierId = sel.value;
        if (!supplierId) return;
        sel.disabled = true;
        api.post('/api/budget/assign-supplier', {
          budgetProductId: bid,
          budgetProductType: btype,
          localSupplierId: supplierId
        }).then(function () {
          util.showToast('Supplier synced to Farm Budget');
          loadCatalog();
        }).catch(function (err) {
          util.showToast('Sync failed: ' + (err.message || 'Could not reach Farm Budget'), 'error');
        }).finally(function () {
          sel.disabled = false;
        });
      });
    });

    // Attach expand/collapse
    tbody.querySelectorAll('.product-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.btn-cert') || e.target.closest('.supplier-select')) return;
        var target = document.getElementById(row.getAttribute('data-target'));
        var icon = row.querySelector('.expand-icon');
        if (target) {
          target.classList.toggle('hidden');
          icon.innerHTML = target.classList.contains('hidden') ? '&#9654;' : '&#9660;';
          row.classList.toggle('expanded');
        }
      });
    });

    // Attach cert edit buttons
    tbody.querySelectorAll('.btn-cert').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openCertModal(btn.getAttribute('data-bid'), btn.getAttribute('data-btype'));
      });
    });
  }

  function updateSummary(count) {
    var el = document.getElementById('catalog-summary');
    if (el) el.textContent = count + ' product' + (count !== 1 ? 's' : '') + ' in catalog';
  }

  // --- Cert Modal ---
  var certModal = document.getElementById('cert-modal');
  var certForm = document.getElementById('cert-form');

  if (document.getElementById('cert-modal-close')) {
    document.getElementById('cert-modal-close').addEventListener('click', closeCertModal);
  }
  if (document.getElementById('cert-cancel-btn')) {
    document.getElementById('cert-cancel-btn').addEventListener('click', closeCertModal);
  }
  if (certModal) {
    certModal.addEventListener('click', function (e) {
      if (e.target === certModal) closeCertModal();
    });
  }

  function openCertModal(budgetId, budgetType) {
    var ovl = overlays[budgetId] || {};
    var item = catalog.find(function (p) { return p.budgetId === budgetId; });
    document.getElementById('cert-modal-title').textContent = 'Organic Cert — ' + (item ? item.name : budgetId);
    document.getElementById('cf-budgetId').value = budgetId;
    document.getElementById('cf-budgetType').value = budgetType;
    document.getElementById('cf-organicCertNumber').value = ovl.organicCertNumber || '';
    document.getElementById('cf-omriListed').checked = ovl.omriListed || false;
    document.getElementById('cf-localNotes').value = ovl.localNotes || '';
    certModal.classList.remove('hidden');
  }

  function closeCertModal() {
    certModal.classList.add('hidden');
  }

  if (certForm) {
    certForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var budgetId = document.getElementById('cf-budgetId').value;
      var data = {
        budgetProductType: document.getElementById('cf-budgetType').value,
        organicCertNumber: document.getElementById('cf-organicCertNumber').value,
        omriListed: document.getElementById('cf-omriListed').checked,
        localNotes: document.getElementById('cf-localNotes').value
      };
      api.put('/api/product-overlays/' + budgetId, data).then(function (ovl) {
        overlays[budgetId] = ovl;
        closeCertModal();
        renderCatalog();
        util.showToast('Organic cert saved');
      }).catch(function (err) {
        util.showToast('Error: ' + err.message, 'error');
      });
    });
  }

})();
