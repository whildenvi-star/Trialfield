// Reconciliation tab: the key view — forecast vs ordered vs delivered vs returned
(function () {
  'use strict';

  var currentType = '';

  // Type filter toggle
  document.querySelectorAll('.recon-type').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.recon-type').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentType = btn.getAttribute('data-type');
      loadReconciliation();
    });
  });

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

    api.get(url).then(function (data) {
      renderReconciliation(data);
    });
  }

  function renderReconciliation(data) {
    var tbody = document.getElementById('recon-tbody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No data for this crop year. Add products, forecasts, and orders to see reconciliation.</td></tr>';
      return;
    }

    var html = data.map(function (r) {
      var name = r.type === 'SEED' ? (r.crop + ' ' + r.variety) : r.productName;
      var badgeClass = r.type === 'SEED' ? 'badge-seed' : 'badge-input';

      // Color coding for delivery %
      var pctClass = '';
      if (r.percentDelivered >= 100) pctClass = 'recon-good';
      else if (r.percentDelivered >= 50) pctClass = 'recon-warn';
      else if (r.totalOrdered > 0) pctClass = 'recon-bad';

      // Balance: negative means over-delivered
      var balanceClass = r.balance < 0 ? 'recon-bad' : r.balance === 0 ? 'recon-good' : '';

      return '<tr>' +
        '<td><span class="badge ' + badgeClass + '">' + r.type + '</span></td>' +
        '<td>' + util.escapeHtml(r.brand) + '</td>' +
        '<td>' + util.escapeHtml(name) + '</td>' +
        '<td class="number">' + util.formatNum(r.forecast) + '</td>' +
        '<td class="number">' + util.formatNum(r.totalOrdered) + '</td>' +
        '<td class="number">' + util.formatNum(r.totalDelivered) + '</td>' +
        '<td class="number">' + util.formatNum(r.totalReturned) + '</td>' +
        '<td class="number"><strong>' + util.formatNum(r.onHand) + '</strong></td>' +
        '<td class="number ' + balanceClass + '">' + util.formatNum(r.balance) + '</td>' +
        '<td class="number ' + pctClass + '"><strong>' + util.formatNum(r.percentDelivered, 1) + '%</strong></td>' +
        '<td class="number">' + util.formatMoney(r.totalCost) + '</td>' +
      '</tr>';
    }).join('');

    // Totals row
    var totals = data.reduce(function (acc, r) {
      acc.forecast += r.forecast;
      acc.totalOrdered += r.totalOrdered;
      acc.totalDelivered += r.totalDelivered;
      acc.totalReturned += r.totalReturned;
      acc.onHand += r.onHand;
      acc.totalCost += r.totalCost;
      return acc;
    }, { forecast: 0, totalOrdered: 0, totalDelivered: 0, totalReturned: 0, onHand: 0, totalCost: 0 });

    html += '<tr style="font-weight:700;background:#f8f7f4">' +
      '<td colspan="3">TOTALS</td>' +
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

})();
