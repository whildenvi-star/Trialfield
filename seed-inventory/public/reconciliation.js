// Reconciliation tab: the key view — forecast vs ordered vs delivered vs returned
(function () {
  'use strict';

  var currentType = '';
  var organicOnly = false;
  var outstandingOnly = true;
  var lastData = [];

  // Type filter toggle
  document.querySelectorAll('.recon-type').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.recon-type').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentType = btn.getAttribute('data-type');
      loadReconciliation();
    });
  });

  // Organic filter
  var organicCheckbox = document.getElementById('recon-organic-only');
  if (organicCheckbox) {
    organicCheckbox.addEventListener('change', function () {
      organicOnly = organicCheckbox.checked;
      loadReconciliation();
    });
  }

  // Outstanding only filter
  var outstandingCheckbox = document.getElementById('recon-outstanding-only');
  if (outstandingCheckbox) {
    outstandingCheckbox.addEventListener('change', function () {
      outstandingOnly = outstandingCheckbox.checked;
      renderReconciliation(lastData);
    });
  }

  // Export organic report
  var exportBtn = document.getElementById('recon-export-organic');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      exportOrganicReport();
    });
  }

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'reconciliation') loadReconciliation();
  });

  window.addEventListener('crop-year-changed', function () {
    if (document.getElementById('tab-reconciliation').classList.contains('active')) loadReconciliation();
  });

  function loadReconciliation() {
    var year = window.refData.settings.cropYear || 2026;
    var url = '/api/reconciliation?cropYear=' + year;
    if (currentType) url += '&type=' + currentType;
    if (organicOnly) url += '&organic=true';

    api.get(url).then(function (data) {
      lastData = data;
      renderReconciliation(data);
    });
  }

  function renderReconciliation(data) {
    var tbody = document.getElementById('recon-tbody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="empty-state">No data for this crop year. Add products, forecasts, and orders to see reconciliation.</td></tr>';
      return;
    }

    var filtered = outstandingOnly ? data.filter(function (r) { return r.balance > 0; }) : data;
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="empty-state">All items fully received. Uncheck "Outstanding Only" to see the full list.</td></tr>';
      return;
    }

    var html = '';
    filtered.forEach(function (r) {
      var name = r.type === 'SEED' ? (r.crop + ' ' + r.variety) : r.productName;
      var badgeClass = r.type === 'SEED' ? 'badge-seed' : 'badge-input';
      var organicBadge = r.organicGround ? ' <span class="badge badge-organic">ORG</span>' : '';

      // Color coding for delivery %
      var pctClass = '';
      if (r.percentDelivered >= 100) pctClass = 'recon-good';
      else if (r.percentDelivered >= 50) pctClass = 'recon-warn';
      else if (r.totalOrdered > 0) pctClass = 'recon-bad';

      // Balance: negative means over-delivered
      var balanceClass = r.balance < 0 ? 'recon-bad' : r.balance === 0 ? 'recon-good' : '';

      var hasPkus = r.pickupRows && r.pickupRows.length > 0;
      var gid = r.productId;

      // Main product row — ordered column shows expand toggle if pickups exist
      var orderedCell = hasPkus
        ? '<td class="number" style="cursor:pointer" onclick="togglePickupRows(\'' + gid + '\')" title="Click to see pickup breakdown">' +
            util.formatNum(r.totalOrdered) + ' <span class="pku-toggle-icon" id="pku-icon-' + gid + '">&#9660;</span></td>'
        : '<td class="number">' + util.formatNum(r.totalOrdered) + '</td>';

      html += '<tr>' +
        '<td><span class="badge ' + badgeClass + '">' + r.type + '</span>' + organicBadge + '</td>' +
        '<td>' + util.escapeHtml(r.brand) + '</td>' +
        '<td>' + util.escapeHtml(name) + '</td>' +
        '<td>' + util.escapeHtml(r.unit || '') + '</td>' +
        '<td class="number">' + util.formatNum(r.forecast) + '</td>' +
        orderedCell +
        '<td class="number">' + util.formatNum(r.totalDelivered) + '</td>' +
        '<td class="number">' + util.formatNum(r.totalReturned) + '</td>' +
        '<td class="number"><strong>' + util.formatNum(r.onHand) + '</strong></td>' +
        '<td class="number ' + balanceClass + '">' + util.formatNum(r.balance) + '</td>' +
        '<td class="number ' + pctClass + '"><strong>' + util.formatNum(r.percentDelivered, 1) + '%</strong></td>' +
        '<td class="number">' + util.formatMoney(r.totalCost) + '</td>' +
      '</tr>';

      // Pickup sub-rows (visible by default, togglable)
      if (hasPkus) {
        r.pickupRows.forEach(function (pku) {
          var pkuStatusClass = pku.status === 'received' ? 'pku-status-received' : pku.status === 'partial' ? 'pku-status-partial' : 'pku-status-pending';
          var pkuLabel = pku.pickupNum || '(unnamed)';
          if (pku.farmName) pkuLabel += ' / ' + pku.farmName;
          if (pku.crop) pkuLabel += ' · ' + pku.crop;
          html += '<tr class="pku-subrow" data-pku-group="' + gid + '">' +
            '<td colspan="4" style="padding-left:2.5rem;color:var(--text-light);font-size:0.82rem">' +
              '<span class="badge ' + pkuStatusClass + ' badge-sm">' + pku.status + '</span> ' +
              util.escapeHtml(pkuLabel) +
            '</td>' +
            '<td></td>' +
            '<td class="number" style="font-size:0.82rem;color:var(--text-light)">' + util.formatNum(pku.authorizedQty) + ' ' + util.escapeHtml(pku.unit) + '</td>' +
            '<td colspan="6"></td>' +
          '</tr>';
        });
      }
    });

    // Totals row (based on visible filtered set)
    var totals = filtered.reduce(function (acc, r) {
      acc.forecast += r.forecast;
      acc.totalOrdered += r.totalOrdered;
      acc.totalDelivered += r.totalDelivered;
      acc.totalReturned += r.totalReturned;
      acc.onHand += r.onHand;
      acc.totalCost += r.totalCost;
      return acc;
    }, { forecast: 0, totalOrdered: 0, totalDelivered: 0, totalReturned: 0, onHand: 0, totalCost: 0 });

    html += '<tr style="font-weight:700;background:#f8f7f4">' +
      '<td colspan="4">TOTALS</td>' +
      '<td class="number">' + util.formatNum(totals.forecast) + '</td>' +
      '<td class="number">' + util.formatNum(totals.totalOrdered) + '</td>' +
      '<td class="number">' + util.formatNum(totals.totalDelivered) + '</td>' +
      '<td class="number">' + util.formatNum(totals.totalReturned) + '</td>' +
      '<td class="number">' + util.formatNum(totals.onHand) + '</td>' +
      '<td class="number"></td>' +
      '<td class="number"></td>' +
      '<td class="number">' + util.formatMoney(totals.totalCost) + '</td>' +
    '</tr>';

    tbody.innerHTML = html;
  }

  window.togglePickupRows = function (gid) {
    var rows = document.querySelectorAll('.pku-subrow[data-pku-group="' + gid + '"]');
    var icon = document.getElementById('pku-icon-' + gid);
    var isHidden = rows.length > 0 && rows[0].classList.contains('hidden');
    rows.forEach(function (r) { r.classList.toggle('hidden', !isHidden); });
    if (icon) icon.innerHTML = isHidden ? '&#9660;' : '&#9658;';
  };

  // --- Organic Report Export (CSV) ---
  function exportOrganicReport() {
    var year = window.refData.settings.cropYear || 2026;
    // Always fetch organic-only data for the export
    api.get('/api/reconciliation?cropYear=' + year + '&organic=true').then(function (data) {
      if (data.length === 0) {
        util.showToast('No organic products to export', 'error');
        return;
      }

      // Split into seeds and inputs
      var seeds = data.filter(function (r) { return r.type === 'SEED'; });
      var inputs = data.filter(function (r) { return r.type === 'INPUT'; });

      var lines = [];
      lines.push('Organic Seed & Input Reconciliation Report');
      lines.push('Crop Year: ' + year);
      lines.push('Generated: ' + new Date().toLocaleDateString());
      lines.push('');

      if (seeds.length > 0) {
        lines.push('=== ORGANIC SEEDS ===');
        lines.push('Brand,Crop,Variety,Unit,Forecast,Ordered,Delivered,Returned,On Hand,Balance,% Delivered,Cost');
        seeds.forEach(function (r) {
          lines.push([
            csvEscape(r.brand), csvEscape(r.crop), csvEscape(r.variety), csvEscape(r.unit),
            r.forecast, r.totalOrdered, r.totalDelivered, r.totalReturned,
            r.onHand, r.balance, r.percentDelivered.toFixed(1) + '%',
            '$' + r.totalCost.toFixed(2)
          ].join(','));
        });
        var seedTotals = sumRows(seeds);
        lines.push(',,SEED TOTALS,,' + seedTotals.forecast + ',' + seedTotals.totalOrdered + ',' +
          seedTotals.totalDelivered + ',' + seedTotals.totalReturned + ',' + seedTotals.onHand + ',,,' +
          '$' + seedTotals.totalCost.toFixed(2));
        lines.push('');
      }

      if (inputs.length > 0) {
        lines.push('=== ORGANIC INPUTS ===');
        lines.push('Brand,Product,Unit,Forecast,Ordered,Delivered,Returned,On Hand,Balance,% Delivered,Cost');
        inputs.forEach(function (r) {
          lines.push([
            csvEscape(r.brand), csvEscape(r.productName), csvEscape(r.unit),
            r.forecast, r.totalOrdered, r.totalDelivered, r.totalReturned,
            r.onHand, r.balance, r.percentDelivered.toFixed(1) + '%',
            '$' + r.totalCost.toFixed(2)
          ].join(','));
        });
        var inputTotals = sumRows(inputs);
        lines.push(',INPUT TOTALS,,' + inputTotals.forecast + ',' + inputTotals.totalOrdered + ',' +
          inputTotals.totalDelivered + ',' + inputTotals.totalReturned + ',' + inputTotals.onHand + ',,,' +
          '$' + inputTotals.totalCost.toFixed(2));
        lines.push('');
      }

      var grandTotals = sumRows(data);
      lines.push('GRAND TOTALS');
      lines.push('Total Forecast: ' + grandTotals.forecast);
      lines.push('Total Ordered: ' + grandTotals.totalOrdered);
      lines.push('Total Delivered: ' + grandTotals.totalDelivered);
      lines.push('Total On Hand: ' + grandTotals.onHand);
      lines.push('Total Cost: $' + grandTotals.totalCost.toFixed(2));

      var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'organic-reconciliation-' + year + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      util.showToast('Organic report exported');
    }).catch(function (err) {
      util.showToast('Export failed: ' + err.message, 'error');
    });
  }

  function csvEscape(val) {
    var s = String(val || '');
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function sumRows(rows) {
    return rows.reduce(function (acc, r) {
      acc.forecast += r.forecast;
      acc.totalOrdered += r.totalOrdered;
      acc.totalDelivered += r.totalDelivered;
      acc.totalReturned += r.totalReturned;
      acc.onHand += r.onHand;
      acc.totalCost += r.totalCost;
      return acc;
    }, { forecast: 0, totalOrdered: 0, totalDelivered: 0, totalReturned: 0, onHand: 0, totalCost: 0 });
  }

})();
