// Deliveries — delivery receipt management (Deliveries tab)
// Phase 19 Wave 1: shell placeholder — UI implemented in Wave 2
(function () {
  'use strict';

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'deliveries') loadDeliveries();
  });

  function loadDeliveries() {
    var listEl = document.getElementById('del-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-light)">Loading deliveries...</div>';
    api.get('/api/deliveries').then(function (deliveries) {
      var countEl = document.getElementById('del-count');
      if (countEl) countEl.textContent = deliveries.length + ' deliver' + (deliveries.length !== 1 ? 'ies' : 'y');
      if (deliveries.length === 0) {
        listEl.innerHTML = util.emptyState('', 'No deliveries yet', 'Create an order first, then record deliveries as products arrive.');
        return;
      }
      var html = '';
      deliveries.forEach(function (del) {
        var itemCount = (del.items || []).length;
        html += '<div class="del-card">';
        html += '<div class="del-card-header">';
        if (del.deliveredAt) html += '<span>' + new Date(del.deliveredAt + 'T12:00:00Z').toLocaleDateString() + '</span>';
        if (del.ticketNumber) html += '<span style="color:var(--text-light);font-size:0.8rem">Ticket: ' + util.escHtml(del.ticketNumber) + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.8rem;color:var(--text-light)">' + itemCount + ' item' + (itemCount !== 1 ? 's' : '');
        if (del.orderId) html += ' &mdash; Order: ' + util.escHtml(del.orderId);
        html += '</div>';
        html += '</div>';
      });
      listEl.innerHTML = html;
    }).catch(function (err) {
      listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--danger)">Failed to load deliveries: ' + util.escHtml(err.message) + '</div>';
    });
  }
})();
