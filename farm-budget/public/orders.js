// Orders — PO management (Orders tab)
// Phase 19 Wave 1: shell placeholder — UI implemented in Wave 2
(function () {
  'use strict';

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'orders') loadOrders();
  });

  function loadOrders() {
    var listEl = document.getElementById('ord-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-light)">Loading orders...</div>';
    api.get('/api/orders').then(function (orders) {
      var countEl = document.getElementById('ord-count');
      if (countEl) countEl.textContent = orders.length + ' order' + (orders.length !== 1 ? 's' : '');
      if (orders.length === 0) {
        listEl.innerHTML = util.emptyState('', 'No orders yet', 'Select products in the Forecast tab and click "Create Order from Selected" to create your first order.');
        return;
      }
      var html = '';
      orders.forEach(function (ord) {
        var badge = '<span class="ord-badge ' + (ord.status || 'ordered') + '">' + util.escHtml(ord.status || 'ordered') + '</span>';
        var itemCount = (ord.items || []).length;
        html += '<div class="ord-card">';
        html += '<div class="ord-card-header"><span class="ord-card-supplier">' + util.escHtml(ord.supplierName || 'Unknown Supplier') + '</span>' + badge;
        if (ord.poNumber) html += '<span style="color:var(--text-light);font-size:0.8rem">PO: ' + util.escHtml(ord.poNumber) + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-light)">' + itemCount + ' item' + (itemCount !== 1 ? 's' : '');
        if (ord.createdAt) html += ' &mdash; ' + new Date(ord.createdAt).toLocaleDateString();
        html += '</div>';
        html += '</div>';
      });
      listEl.innerHTML = html;
    }).catch(function (err) {
      listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--danger)">Failed to load orders: ' + util.escHtml(err.message) + '</div>';
    });
  }
})();
