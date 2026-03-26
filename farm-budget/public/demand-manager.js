// Demand Manager — Product Demand Forecast Table for Receiving Manager
// Task 4: Shows all expected incoming products (seeds + inputs) with forecasted quantities
// derived from active farm plans. Receiving manager can update status. Supports CSV export and print.
(function () {
  'use strict';

  var demandRows = [];
  var loaded = false;

  // Activate on demand sub-tab
  window.addEventListener('demand-activate', function () { loadDemand(); });

  function loadDemand() {
    api.get('/api/demand').then(function (data) {
      demandRows = data.rows || [];
      renderDemandTable(demandRows);
      var el = document.getElementById('demand-generated');
      if (el && data.generatedAt) {
        el.textContent = 'Generated: ' + new Date(data.generatedAt).toLocaleString();
      }
      loaded = true;
    }).catch(function (err) {
      console.error('Demand load failed:', err);
      var tbody = document.getElementById('demand-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--danger)">Failed to load demand data</td></tr>';
    });
  }

  function renderDemandTable(rows) {
    var tbody = document.getElementById('demand-tbody');
    if (!tbody) return;

    // Apply filters
    var search = (document.getElementById('demand-search') || {}).value || '';
    var statusFilter = (document.getElementById('demand-filter-status') || {}).value || '';
    var typeFilter = (document.getElementById('demand-filter-type') || {}).value || '';

    var filtered = rows.filter(function (r) {
      if (search && !r.productName.toLowerCase().includes(search.toLowerCase()) &&
          !(r.supplierName || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10">' + util.emptyState('📦', 'No demand data', 'Add field inputs and seeds to generate demand forecasts') + '</td></tr>';
      updateCount(0, rows.length);
      return;
    }

    var html = '';
    filtered.forEach(function (row) {
      html += '<tr>' +
        '<td>' + util.escHtml(row.productName) + '</td>' +
        '<td><span class="demand-type-badge type-' + row.type + '">' + row.type + '</span></td>' +
        '<td>' + util.escHtml(row.supplierName || '--') + '</td>' +
        '<td>' + util.escHtml(row.unitPackDesc || '--') + '</td>' +
        '<td class="number">' + util.formatNum(row.packQty, 0) + '</td>' +
        '<td class="number bold">' + util.formatNum(row.totalUnitsExpected || row.totalQty, 0) + '</td>' +
        '<td class="number">' + (row.orderedQty > 0 ? util.formatNum(row.orderedQty, 0) : '--') + '</td>' +
        '<td class="number">' + (row.deliveredQty > 0 ? util.formatNum(row.deliveredQty, 0) : '--') + '</td>' +
        '<td>' + util.escHtml(row.deliveryWindow || '--') + '</td>' +
        '<td><span class="status-badge status-' + row.status + '" data-product="' + util.escHtml(row.productName) + '" data-type="' + row.type + '">' + row.status + '</span></td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    updateCount(filtered.length, rows.length);

    // Bind status badge click to cycle status
    tbody.querySelectorAll('.status-badge').forEach(function (badge) {
      badge.addEventListener('click', function () {
        var productName = badge.getAttribute('data-product');
        var currentStatus = badge.textContent.trim().toLowerCase();
        var nextStatus = currentStatus === 'pending' ? 'ordered' :
                         currentStatus === 'ordered' ? 'received' : 'pending';
        badge.textContent = nextStatus;
        badge.className = 'status-badge status-' + nextStatus;

        // Update local data
        var row = demandRows.find(function (r) { return r.productName === productName; });
        if (row) row.status = nextStatus;
      });
    });
  }

  function updateCount(shown, total) {
    var el = document.getElementById('demand-count');
    if (el) el.textContent = shown + ' of ' + total + ' products';
    var info = document.getElementById('demand-info');
    if (info) info.textContent = total + ' demand items from active farm plans';
  }

  // Filter handlers
  ['demand-search', 'demand-filter-status', 'demand-filter-type'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener(el.type === 'text' ? 'input' : 'change', function () {
        renderDemandTable(demandRows);
      });
    }
  });

  // Refresh button
  var refreshBtn = document.getElementById('demand-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      loaded = false;
      loadDemand();
      util.showToast('Demand data refreshed');
    });
  }

  // CSV Export
  var csvBtn = document.getElementById('demand-export-csv');
  if (csvBtn) {
    csvBtn.addEventListener('click', function () {
      if (!demandRows.length) { util.showToast('No data to export', 3000, 'error'); return; }
      var headers = ['Product Name', 'Type', 'Category', 'Supplier', 'Unit/Pack', 'Pack Qty', 'Total Expected', 'Ordered', 'Delivered', 'Delivery Window', 'Status'];
      var csvRows = [headers.join(',')];
      demandRows.forEach(function (r) {
        csvRows.push([
          '"' + (r.productName || '').replace(/"/g, '""') + '"',
          r.type,
          r.category,
          '"' + (r.supplierName || '').replace(/"/g, '""') + '"',
          '"' + (r.unitPackDesc || '').replace(/"/g, '""') + '"',
          r.packQty,
          r.totalUnitsExpected || r.totalQty,
          r.orderedQty || 0,
          r.deliveredQty || 0,
          '"' + (r.deliveryWindow || '').replace(/"/g, '""') + '"',
          r.status
        ].join(','));
      });
      var blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'product-demand-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      util.showToast('CSV exported');
    });
  }

  // Print
  var printBtn = document.getElementById('demand-print');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      if (!demandRows.length) { util.showToast('No data to print', 3000, 'error'); return; }
      var win = window.open('', '_blank');
      var html = '<!DOCTYPE html><html><head><title>Product Demand Report</title>';
      html += '<style>';
      html += 'body { font-family: -apple-system, sans-serif; font-size: 12px; margin: 1rem; }';
      html += 'h1 { font-size: 16px; margin-bottom: 0.5rem; }';
      html += 'p { color: #666; font-size: 11px; margin-bottom: 1rem; }';
      html += 'table { width: 100%; border-collapse: collapse; }';
      html += 'th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 11px; }';
      html += 'th { background: #f5f5f5; font-weight: 600; }';
      html += '.number { text-align: right; }';
      html += '.status { text-transform: uppercase; font-weight: 600; font-size: 10px; }';
      html += '.status-pending { color: #b8860b; }';
      html += '.status-ordered { color: #2196F3; }';
      html += '.status-received { color: #4CAF50; }';
      html += '@media print { body { margin: 0; } }';
      html += '</style></head><body>';
      html += '<h1>Product Demand Report</h1>';
      html += '<p>Generated: ' + new Date().toLocaleString() + '</p>';
      html += '<table><thead><tr>';
      html += '<th>Product</th><th>Type</th><th>Supplier</th><th>Unit/Pack</th>';
      html += '<th>Pack Qty</th><th class="number">Total Expected</th>';
      html += '<th class="number">Ordered</th><th class="number">Delivered</th>';
      html += '<th>Delivery Window</th><th>Status</th>';
      html += '</tr></thead><tbody>';
      demandRows.forEach(function (r) {
        html += '<tr>';
        html += '<td>' + (r.productName || '') + '</td>';
        html += '<td>' + (r.type || '') + '</td>';
        html += '<td>' + (r.supplierName || '--') + '</td>';
        html += '<td>' + (r.unitPackDesc || '--') + '</td>';
        html += '<td class="number">' + (r.packQty || 1) + '</td>';
        html += '<td class="number">' + (r.totalUnitsExpected || r.totalQty || 0) + '</td>';
        html += '<td class="number">' + (r.orderedQty || '--') + '</td>';
        html += '<td class="number">' + (r.deliveredQty || '--') + '</td>';
        html += '<td>' + (r.deliveryWindow || '--') + '</td>';
        html += '<td class="status status-' + r.status + '">' + r.status + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></body></html>';
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(function () { win.print(); }, 500);
    });
  }

})();
