// Orders — PO management (Orders tab)
// Phase 19 Wave 2: full Orders tab implementation
(function () {
  'use strict';

  var allOrders = [];
  var deliveryCacheByOrder = {}; // orderId -> {loaded: bool, items: []}

  // --- Tab activation ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'orders') loadOrders();
  });

  // Reload orders when deliveries change (status might have updated)
  window.addEventListener('forecast-changed', function () {
    if (document.getElementById('tab-orders').classList.contains('active')) {
      deliveryCacheByOrder = {}; // clear cache so expanded orders reload delivery data
      loadOrders();
    }
  });

  // Handle start-delivery event from Orders tab "Record Delivery" buttons
  window.addEventListener('start-delivery', function (e) {
    // deliveries.js handles the actual pre-selection; just navigate
    location.hash = 'deliveries';
    window.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: 'deliveries', orderId: (e.detail || {}).orderId } }));
  });

  // --- Load all orders ---
  function loadOrders() {
    var listEl = document.getElementById('ord-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-light)">Loading orders...</div>';

    api.get('/api/orders').then(function (orders) {
      // Sort most-recent first
      allOrders = (orders || []).sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      applyFilterAndRender();
    }).catch(function (err) {
      listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--danger)">Failed to load orders: ' + util.escHtml(err.message) + '</div>';
    });
  }

  // --- Apply status filter and render ---
  function applyFilterAndRender() {
    var filterEl = document.getElementById('ord-filter-status');
    var filterVal = filterEl ? filterEl.value : '';
    var filtered = filterVal
      ? allOrders.filter(function (o) { return o.status === filterVal; })
      : allOrders;

    var countEl = document.getElementById('ord-count');
    if (countEl) {
      if (filterVal) {
        countEl.textContent = filtered.length + ' of ' + allOrders.length + ' order' + (allOrders.length !== 1 ? 's' : '');
      } else {
        countEl.textContent = allOrders.length + ' order' + (allOrders.length !== 1 ? 's' : '');
      }
    }

    renderOrderList(filtered);
  }

  // --- Status filter change ---
  var filterEl = document.getElementById('ord-filter-status');
  if (filterEl) {
    filterEl.addEventListener('change', function () {
      applyFilterAndRender();
    });
  }

  // --- Render order list ---
  function renderOrderList(orders) {
    var listEl = document.getElementById('ord-list');
    if (!listEl) return;

    if (orders.length === 0) {
      listEl.innerHTML = util.emptyState('\uD83D\uDCCB', 'No orders yet', 'Select products on the Forecasts tab and click Create Order');
      return;
    }

    var html = '';
    orders.forEach(function (ord) {
      var status = ord.status || 'ordered';
      var itemCount = (ord.items || []).length;
      var itemTotal = (ord.items || []).reduce(function (s, it) {
        return s + ((it.orderedQty || 0) * (it.unitCost || 0));
      }, 0);

      html += '<div class="ord-card" id="ord-card-' + util.escHtml(ord.id) + '">';

      // Card header (clickable to expand)
      html += '<div class="ord-card-header ord-card-toggle" data-order-id="' + util.escHtml(ord.id) + '" style="cursor:pointer">';
      html += '<span class="ord-card-supplier">' + util.escHtml(ord.supplierName || 'Unknown Supplier') + '</span>';
      html += '<span class="ord-badge ' + util.escHtml(status) + '">' + util.escHtml(status) + '</span>';
      if (ord.poNumber) {
        html += '<span style="color:var(--text-light);font-size:0.8rem">PO: ' + util.escHtml(ord.poNumber) + '</span>';
      }
      html += '<span style="margin-left:auto;color:var(--text-light);font-size:0.75rem">&#9654;</span>';
      html += '</div>';

      // Card summary line
      html += '<div class="ord-card-meta" style="font-size:0.8rem;color:var(--text-light)">';
      html += itemCount + ' item' + (itemCount !== 1 ? 's' : '');
      html += ' \u2014 ' + util.formatMoney(itemTotal);
      if (ord.createdAt) {
        html += ' \u2014 ' + new Date(ord.createdAt).toLocaleDateString();
      }
      html += '</div>';

      // Expandable detail (hidden by default)
      html += '<div class="ord-detail" id="ord-detail-' + util.escHtml(ord.id) + '" style="display:none;margin-top:0.75rem">';

      // PO Number
      html += '<div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap">';
      html += '<label style="font-size:0.8rem;color:var(--text-light)">PO #:</label>';
      html += '<input type="text" class="ord-po-input" data-order-id="' + util.escHtml(ord.id) + '" value="' + util.escHtml(ord.poNumber || '') + '" placeholder="Enter PO number" style="flex:1;min-width:120px;font-size:0.85rem">';
      html += '</div>';

      // Notes
      html += '<div style="margin-bottom:0.75rem">';
      html += '<label style="font-size:0.8rem;color:var(--text-light);display:block;margin-bottom:0.25rem">Notes:</label>';
      html += '<textarea class="ord-notes-input" data-order-id="' + util.escHtml(ord.id) + '" rows="2" style="width:100%;font-size:0.85rem;resize:vertical" placeholder="Order notes...">' + util.escHtml(ord.notes || '') + '</textarea>';
      html += '</div>';

      // Line items table header
      html += '<div style="font-size:0.75rem;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.4rem">Line Items</div>';
      html += '<div id="ord-lines-' + util.escHtml(ord.id) + '">';
      html += '<div style="font-size:0.8rem;color:var(--text-light)">Loading delivery data...</div>';
      html += '</div>';

      // Action buttons
      html += '<div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap">';
      html += '<button class="btn-sm btn-primary ord-record-delivery-btn" data-order-id="' + util.escHtml(ord.id) + '">Record Delivery</button>';
      html += '<button class="btn-sm ord-delete-btn" data-order-id="' + util.escHtml(ord.id) + '" style="color:var(--danger);border-color:var(--danger)">Delete Order</button>';
      html += '</div>';

      html += '</div>'; // end ord-detail
      html += '</div>'; // end ord-card
    });

    listEl.innerHTML = html;

    // --- Wire interactions ---

    // Toggle expand/collapse
    listEl.querySelectorAll('.ord-card-toggle').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        var ordId = hdr.getAttribute('data-order-id');
        var detail = document.getElementById('ord-detail-' + ordId);
        var caret = hdr.querySelector('span:last-child');
        if (!detail) return;
        var open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : '';
        if (caret) caret.innerHTML = open ? '&#9654;' : '&#9660;';
        if (!open) {
          // Load delivery data for this order's line items
          loadOrderLines(ordId);
        }
      });
    });

    // PO number inline save on blur
    listEl.querySelectorAll('.ord-po-input').forEach(function (input) {
      input.addEventListener('blur', function () {
        var ordId = input.getAttribute('data-order-id');
        var order = allOrders.find(function (o) { return o.id === ordId; });
        if (!order) return;
        if (input.value === (order.poNumber || '')) return; // no change
        api.put('/api/orders/' + ordId, { poNumber: input.value }).then(function (updated) {
          order.poNumber = updated.poNumber;
          util.showToast('PO number saved', 2000, 'success');
        }).catch(function (err) {
          util.showToast('Failed to save PO: ' + err.message, 3000, 'error');
        });
      });
    });

    // Notes inline save on blur
    listEl.querySelectorAll('.ord-notes-input').forEach(function (textarea) {
      textarea.addEventListener('blur', function () {
        var ordId = textarea.getAttribute('data-order-id');
        var order = allOrders.find(function (o) { return o.id === ordId; });
        if (!order) return;
        if (textarea.value === (order.notes || '')) return; // no change
        api.put('/api/orders/' + ordId, { notes: textarea.value }).then(function (updated) {
          order.notes = updated.notes;
          util.showToast('Notes saved', 2000, 'success');
        }).catch(function (err) {
          util.showToast('Failed to save notes: ' + err.message, 3000, 'error');
        });
      });
    });

    // Record Delivery button
    listEl.querySelectorAll('.ord-record-delivery-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ordId = btn.getAttribute('data-order-id');
        window.dispatchEvent(new CustomEvent('start-delivery', { detail: { orderId: ordId } }));
      });
    });

    // Delete Order button
    listEl.querySelectorAll('.ord-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ordId = btn.getAttribute('data-order-id');
        var order = allOrders.find(function (o) { return o.id === ordId; });
        var supplierLabel = order ? (order.supplierName || 'this order') : 'this order';
        if (!confirm('Delete order for ' + supplierLabel + '? This cannot be undone.')) return;
        api.del('/api/orders/' + ordId).then(function () {
          util.showToast('Order deleted', 2000, 'success');
          deliveryCacheByOrder = {};
          loadOrders();
        }).catch(function (err) {
          util.showToast('Failed to delete: ' + err.message, 3000, 'error');
        });
      });
    });
  }

  // --- Load line items for a specific order (with delivery aggregation) ---
  function loadOrderLines(ordId) {
    var linesEl = document.getElementById('ord-lines-' + ordId);
    if (!linesEl) return;

    var order = allOrders.find(function (o) { return o.id === ordId; });
    if (!order) return;

    // Use cached delivery data if available
    if (deliveryCacheByOrder[ordId] && deliveryCacheByOrder[ordId].loaded) {
      renderOrderLines(linesEl, order, deliveryCacheByOrder[ordId].byProduct);
      return;
    }

    // Fetch deliveries for this order
    api.get('/api/deliveries?orderId=' + encodeURIComponent(ordId)).then(function (deliveries) {
      // Aggregate deliveredQty per productName
      var byProduct = {};
      (deliveries || []).forEach(function (del) {
        (del.items || []).forEach(function (item) {
          var pName = item.productName;
          if (!byProduct[pName]) byProduct[pName] = 0;
          byProduct[pName] += (item.deliveredQty || 0);
        });
      });
      deliveryCacheByOrder[ordId] = { loaded: true, byProduct: byProduct };
      renderOrderLines(linesEl, order, byProduct);
    }).catch(function () {
      // Show lines without delivery data on error
      renderOrderLines(linesEl, order, {});
    });
  }

  // --- Render order line items table ---
  function renderOrderLines(container, order, deliveredByProduct) {
    var items = order.items || [];
    if (items.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-light)">No line items</div>';
      return;
    }

    var html = '<div style="overflow-x:auto">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
    html += '<thead><tr style="color:var(--text-light);text-align:left;border-bottom:1px solid var(--border)">';
    html += '<th style="padding:0.3rem 0.5rem">Product</th>';
    html += '<th style="padding:0.3rem 0.5rem">Unit</th>';
    html += '<th style="padding:0.3rem 0.5rem;text-align:right">Forecast Qty</th>';
    html += '<th style="padding:0.3rem 0.5rem;text-align:right">Ordered Qty</th>';
    html += '<th style="padding:0.3rem 0.5rem;text-align:right">Delivered</th>';
    html += '<th style="padding:0.3rem 0.5rem;text-align:right">Remaining</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    items.forEach(function (item) {
      var delivered = deliveredByProduct[item.productName] || 0;
      var remaining = (item.orderedQty || 0) - delivered;
      var remainStyle = remaining < 0 ? 'color:var(--danger)' : '';

      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:0.35rem 0.5rem">' + util.escHtml(item.productName) + '</td>';
      html += '<td style="padding:0.35rem 0.5rem;color:var(--text-light)">' + util.escHtml(item.unit || '') + '</td>';
      html += '<td style="padding:0.35rem 0.5rem;text-align:right;color:var(--text-light)">' + util.formatNum(item.forecastQty || 0, 0) + '</td>';
      // Ordered qty — double-click inline edit
      html += '<td style="padding:0.35rem 0.5rem;text-align:right" class="ord-qty-cell" data-order-id="' + util.escHtml(order.id) + '" data-product="' + util.escHtml(item.productName) + '" data-qty="' + (item.orderedQty || 0) + '">';
      html += '<span class="ord-qty-display">' + util.formatNum(item.orderedQty || 0, 0) + '</span>';
      html += '</td>';
      html += '<td style="padding:0.35rem 0.5rem;text-align:right">' + util.formatNum(delivered, 0) + '</td>';
      html += '<td style="padding:0.35rem 0.5rem;text-align:right;' + remainStyle + '">' + util.formatNum(remaining, 0) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    // Double-click inline edit for Ordered Qty cells
    container.querySelectorAll('.ord-qty-cell').forEach(function (cell) {
      cell.addEventListener('dblclick', function () {
        if (cell.querySelector('input')) return; // already editing
        var display = cell.querySelector('.ord-qty-display');
        var currentVal = cell.getAttribute('data-qty') || '0';
        var ordId = cell.getAttribute('data-order-id');
        var productName = cell.getAttribute('data-product');

        var input = document.createElement('input');
        input.type = 'number';
        input.value = currentVal;
        input.min = '0';
        input.style.cssText = 'width:70px;text-align:right;font-size:0.82rem';
        cell.replaceChild(input, display);
        input.focus();
        input.select();

        function save() {
          var newVal = parseFloat(input.value);
          if (isNaN(newVal) || newVal < 0) newVal = parseFloat(currentVal);

          var order = allOrders.find(function (o) { return o.id === ordId; });
          if (!order) return;

          // Build updated items array
          var newItems = (order.items || []).map(function (it) {
            if (it.productName === productName) {
              return Object.assign({}, it, { orderedQty: newVal });
            }
            return it;
          });

          api.put('/api/orders/' + ordId, { items: newItems }).then(function (updated) {
            order.items = updated.items || newItems;
            cell.setAttribute('data-qty', newVal);
            // Re-render this order's line items
            deliveryCacheByOrder[ordId] = null; // invalidate so it refetches delivered data
            loadOrderLines(ordId);
            util.showToast('Qty updated', 2000, 'success');
          }).catch(function (err) {
            util.showToast('Failed to save qty: ' + err.message, 3000, 'error');
            cell.innerHTML = '<span class="ord-qty-display">' + util.formatNum(parseFloat(currentVal), 0) + '</span>';
          });
        }

        input.addEventListener('blur', save);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { input.blur(); }
          if (e.key === 'Escape') {
            cell.innerHTML = '<span class="ord-qty-display">' + util.formatNum(parseFloat(currentVal), 0) + '</span>';
          }
        });
      });
    });
  }

})();
