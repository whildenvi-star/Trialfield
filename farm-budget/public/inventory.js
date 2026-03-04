// Inventory — Forecast Hub (Forecasts tab)
// Phase 19 Wave 1: shell placeholder — UI implemented in Wave 2
(function () {
  'use strict';

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'forecasts') loadForecast();
  });

  function loadForecast() {
    var container = document.getElementById('fc-categories');
    if (!container) return;
    container.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-light)">Loading forecast...</div>';
    api.get('/api/forecast').then(function (data) {
      renderForecast(data);
    }).catch(function (err) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;color:var(--danger)">Failed to load forecast: ' + util.escHtml(err.message) + '</div>';
    });
  }

  function renderForecast(data) {
    var container = document.getElementById('fc-categories');
    if (!container) return;
    var categories = (data && data.categories) || [];
    if (categories.length === 0) {
      container.innerHTML = util.emptyState('', 'No forecast data yet', 'Add inputs to fields in the enterprise editor to see procurement forecast.');
      return;
    }
    var html = '';
    categories.forEach(function (cat) {
      var products = cat.products || [];
      var catTotal = products.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
      html += '<div class="fc-category">';
      html += '<div class="fc-category-header">';
      html += '<span class="fc-category-name">' + util.escHtml(cat.name) + '</span>';
      html += '<span class="fc-category-total">' + products.length + ' product' + (products.length !== 1 ? 's' : '') + ' &mdash; ' + util.formatMoney(catTotal) + '</span>';
      html += '</div>';
      // Header row
      html += '<div class="fc-row fc-header">';
      html += '<span></span>';
      html += '<span>Product</span>';
      html += '<span>Supplier</span>';
      html += '<span>Total Qty</span>';
      html += '<span>Unit Cost</span>';
      html += '<span>Total Cost</span>';
      html += '<span>Ordered</span>';
      html += '<span>% Ordered</span>';
      html += '<span></span>';
      html += '</div>';
      products.forEach(function (p) {
        var pct = Math.min(p.pctOrdered || 0, 100);
        var overOrdered = (p.orderedQty || 0) > p.totalQty;
        var fullyOrdered = (p.orderedQty || 0) >= p.totalQty;
        var fillClass = overOrdered ? 'over' : (fullyOrdered ? 'complete' : '');
        html += '<div class="fc-row">';
        html += '<span></span>';
        html += '<span>' + util.escHtml(p.productName) + (p.isSeedVariety ? ' <span style="font-size:0.7rem;color:var(--primary)">[seed]</span>' : '') + '</span>';
        html += '<span style="color:var(--text-light)">' + util.escHtml(p.supplierName || '—') + '</span>';
        html += '<span>' + util.formatNum(p.totalQty, 0) + ' ' + util.escHtml(p.unit || '') + '</span>';
        html += '<span>' + util.formatMoney(p.unitCost, 3) + '</span>';
        html += '<span>' + util.formatMoney(p.totalCost) + '</span>';
        html += '<span>' + util.formatNum(p.orderedQty || 0, 0) + '</span>';
        html += '<span><div class="pct-bar"><div class="pct-bar-fill ' + fillClass + '" style="width:' + pct + '%"></div></div><span style="font-size:0.75rem;color:var(--text-light)">' + (p.pctOrdered || 0) + '%</span></span>';
        html += '<span></span>';
        html += '</div>';
        // Field breakdown (simplified for Wave 1 shell)
        if (p.fields && p.fields.length > 0) {
          html += '<div class="fc-field-breakdown" style="display:none">';
          html += '<div class="fc-field-row" style="font-weight:600;color:var(--text-light)"><span>Field</span><span>Acres</span><span>Qty</span><span>Season</span></div>';
          p.fields.forEach(function (f) {
            html += '<div class="fc-field-row"><span>' + util.escHtml(f.fieldName) + '</span><span>' + util.formatNum(f.acres, 1) + '</span><span>' + util.formatNum(f.qty, 0) + '</span><span>' + util.escHtml(f.season || '') + '</span></div>';
          });
          html += '</div>';
        }
      });
      html += '</div>';
    });
    container.innerHTML = html;

    // Update summary
    var summaryEl = document.getElementById('fc-summary');
    if (summaryEl) {
      var totalProducts = categories.reduce(function (s, c) { return s + c.products.length; }, 0);
      var grandTotal = categories.reduce(function (s, c) { return s + c.products.reduce(function (cs, p) { return cs + (p.totalCost || 0); }, 0); }, 0);
      summaryEl.textContent = totalProducts + ' products — ' + util.formatMoney(grandTotal) + ' total forecast cost';
    }
  }
})();
