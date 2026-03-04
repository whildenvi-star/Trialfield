// Forecasts tab: read-only product-grouped view pulled from Farm Budget macro
(function () {
  'use strict';

  var allProducts = [];

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'forecasts') loadForecasts();
  });

  window.addEventListener('ref-data-loaded', function () {
    if (document.getElementById('tab-forecasts').classList.contains('active')) loadForecasts();
  });

  function loadForecasts() {
    var year = window.refData.settings.cropYear || 2026;
    api.get('/api/forecasts/by-product?cropYear=' + year).then(function (data) {
      allProducts = data;
      renderForecasts();
    });
  }

  function productLabel(p) {
    if (p.type === 'SEED') return (p.brand ? p.brand + ' ' : '') + (p.variety || p.crop || '');
    return (p.brand ? p.brand + ' ' : '') + (p.productName || '');
  }

  var categoryLabels = {
    'SEED': 'Seed', 'FERTILIZER': 'Fertilizer', 'CHEMICAL': 'Chemical',
    'BIOLOGICAL': 'Biological', 'OTHER': 'Other'
  };

  function categoryLabel(p) {
    if (p.type === 'SEED') return 'Seed';
    return categoryLabels[p.category] || p.category || 'Input';
  }

  function renderForecasts() {
    var tbody = document.getElementById('forecast-tbody');
    if (!tbody) return;

    var q = (document.getElementById('forecast-search') || {}).value;
    q = (q || '').toLowerCase();

    // Apply category filter
    var catFilter = document.querySelector('.forecast-type.active');
    var catVal = catFilter ? catFilter.getAttribute('data-cat') : '';

    var filtered = allProducts.filter(function (p) {
      if (catVal) {
        var pCat = p.type === 'SEED' ? 'SEED' : (p.category || '');
        if (pCat !== catVal) return false;
      }
      if (!q) return true;
      var haystack = [productLabel(p), p.category, p.unit].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No forecasts synced. Click "Sync from Farm Budget" to pull data from the macro.</td></tr>';
      updateSummary(0, 0);
      return;
    }

    var totalQty = 0;
    var totalAcres = 0;

    tbody.innerHTML = filtered.map(function (p, idx) {
      totalQty += p.totalQty;
      totalAcres += p.totalAcres;

      var rowId = 'fct-row-' + idx;
      var fieldsHtml = p.fields.map(function (f) {
        return '<tr class="field-detail-row">' +
          '<td class="indent">' + util.escapeHtml(f.fieldName) + '</td>' +
          '<td class="number">' + util.formatNum(f.acres) + '</td>' +
          '<td class="number">' + util.formatNum(f.rate) + '</td>' +
          '<td class="number">' + util.formatNum(f.qty) + '</td>' +
          '<td>' + util.escapeHtml(f.season) + '</td>' +
        '</tr>';
      }).join('');

      return '<tr class="product-row" data-target="' + rowId + '">' +
        '<td class="product-name"><span class="expand-icon">&#9654;</span> ' + util.escapeHtml(productLabel(p)) + '</td>' +
        '<td><span class="badge badge-' + (p.type === 'SEED' ? 'seed' : (p.category || 'other').toLowerCase()) + '">' + categoryLabel(p) + '</span></td>' +
        '<td class="number">' + util.formatNum(p.totalAcres) + '</td>' +
        '<td class="number"><strong>' + util.formatNum(p.totalQty) + '</strong></td>' +
        '<td>' + util.escapeHtml(p.unit) + '</td>' +
        '<td class="number">' + p.fieldCount + ' field' + (p.fieldCount !== 1 ? 's' : '') + '</td>' +
      '</tr>' +
      '<tr class="field-details hidden" id="' + rowId + '"><td colspan="6">' +
        '<table class="sub-table"><thead><tr>' +
          '<th>Field</th><th class="number">Acres</th><th class="number">Rate/Ac</th><th class="number">Qty</th><th>Season</th>' +
        '</tr></thead><tbody>' + fieldsHtml + '</tbody></table>' +
      '</td></tr>';
    }).join('');

    updateSummary(filtered.length, totalAcres);

    // Attach expand/collapse to product rows
    tbody.querySelectorAll('.product-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var target = document.getElementById(row.getAttribute('data-target'));
        var icon = row.querySelector('.expand-icon');
        if (target) {
          target.classList.toggle('hidden');
          icon.innerHTML = target.classList.contains('hidden') ? '&#9654;' : '&#9660;';
          row.classList.toggle('expanded');
        }
      });
    });
  }

  function updateSummary(count, acres) {
    var el = document.getElementById('forecast-summary');
    if (el) el.textContent = count + ' product' + (count !== 1 ? 's' : '') + ' across ' + util.formatNum(acres) + ' total acres';
  }

  // --- Search ---
  var searchInput = document.getElementById('forecast-search');
  if (searchInput) searchInput.addEventListener('input', renderForecasts);

  // --- Type filter ---
  document.querySelectorAll('.forecast-type').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.forecast-type').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderForecasts();
    });
  });

  // --- Sync from Farm Budget ---
  var syncBtn = document.getElementById('sync-budget-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', function () {
      if (!confirm('Pull all forecasts from Farm Budget?\n\nThis will sync products and forecast records from the macro roll-up.')) return;
      syncBtn.disabled = true;
      syncBtn.textContent = 'Syncing...';
      api.post('/api/forecasts/pull-from-budget', {}).then(function (result) {
        util.showToast('Synced: ' + result.created + ' created, ' + result.updated + ' updated');
        window.dispatchEvent(new Event('ref-data-reload'));
        loadForecasts();
      }).catch(function (err) {
        util.showToast('Sync failed: ' + (err.message || 'Could not reach Farm Budget'), 'error');
      }).finally(function () {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync from Farm Budget';
      });
    });
  }

})();
