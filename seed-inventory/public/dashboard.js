// Dashboard tab: summary stats
(function () {
  'use strict';

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'dashboard') loadDashboard();
  });

  window.addEventListener('ref-data-loaded', function () {
    // Always load dashboard on startup since it's the default tab
    loadDashboard();
  });

  window.addEventListener('crop-year-changed', function () {
    loadDashboard();
  });

  function loadDashboard() {
    api.get('/api/dashboard').then(function (data) {
      document.getElementById('stat-seeds').textContent = data.seedProducts || 0;
      document.getElementById('stat-inputs').textContent = data.inputProducts || 0;
      document.getElementById('stat-suppliers').textContent = data.totalSuppliers || 0;
      document.getElementById('stat-orders').textContent = data.totalOrders || 0;
      document.getElementById('stat-order-value').textContent = util.formatMoney(data.totalOrderValue);
      document.getElementById('stat-delivery-pct').textContent = data.overallDeliveryPercent + '%';
      document.getElementById('stat-receipts').textContent = data.totalReceipts || 0;
      document.getElementById('stat-discrepancies').textContent = data.discrepancyCount || 0;
    }).catch(function () {
      // Server may not be ready yet
    });
  }

  // Quick action: jump to Deliveries tab to log a new receipt
  var logBtn = document.getElementById('dash-log-delivery');
  if (logBtn) {
    logBtn.addEventListener('click', function () {
      // Activate the deliveries tab
      var tab = document.querySelector('.tab-btn[data-tab="deliveries"]');
      if (tab) tab.click();
      // Give the tab time to render, then click the New Delivery button
      setTimeout(function () {
        var newBtn = document.getElementById('add-delivery-btn');
        if (newBtn) newBtn.click();
      }, 150);
    });
  }

  // Quick action: jump to reconciliation with outstanding filter
  var outstandingBtn = document.getElementById('dash-view-outstanding');
  if (outstandingBtn) {
    outstandingBtn.addEventListener('click', function () {
      var tab = document.querySelector('.tab-btn[data-tab="reconciliation"]');
      if (tab) tab.click();
    });
  }

})();
