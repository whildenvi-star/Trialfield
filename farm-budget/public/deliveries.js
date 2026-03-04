// Deliveries — delivery receipt management (Deliveries tab)
// Phase 19 Wave 2: full Deliveries tab implementation
(function () {
  'use strict';

  var allDeliveries = [];
  var allOrders = [];
  var pendingOrderId = null;
  var editingDeliveryId = null;

  // --- Tab activation ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'deliveries') {
      loadDeliveries().then(function () {
        // If navigated here from Orders tab via start-delivery event, open the form
        if (pendingOrderId) {
          var id = pendingOrderId;
          pendingOrderId = null;
          openDeliveryForm(id);
        } else if (e.detail && e.detail.orderId) {
          openDeliveryForm(e.detail.orderId);
        }
      });
    }
  });

  // --- Handle start-delivery from orders.js (Record Delivery button) ---
  window.addEventListener('start-delivery', function (e) {
    var orderId = e.detail && e.detail.orderId;
    if (document.getElementById('tab-deliveries') &&
        document.getElementById('tab-deliveries').classList.contains('active')) {
      openDeliveryForm(orderId);
    } else {
      pendingOrderId = orderId;
      location.hash = 'deliveries';
      window.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: 'deliveries', orderId: orderId } }));
    }
  });

  // --- Reload when deliveries change externally ---
  window.addEventListener('forecast-changed', function () {
    var tab = document.getElementById('tab-deliveries');
    if (tab && tab.classList.contains('active')) {
      loadDeliveries();
    }
  });

  // --- Load deliveries and orders ---
  function loadDeliveries() {
    var listEl = document.getElementById('del-list');
    if (!listEl) return Promise.resolve();
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-light)">Loading deliveries...</div>';

    return Promise.all([
      api.get('/api/deliveries'),
      api.get('/api/orders')
    ]).then(function (results) {
      allDeliveries = results[0] || [];
      allOrders = results[1] || [];
      renderDeliveryList(allDeliveries);
    }).catch(function (err) {
      listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--danger)">Failed to load deliveries: ' + util.escHtml(err.message) + '</div>';
    });
  }

  // --- Render delivery list ---
  function renderDeliveryList(deliveries) {
    var listEl = document.getElementById('del-list');
    if (!listEl) return;

    // Update count
    var countEl = document.getElementById('del-count');
    if (countEl) {
      countEl.textContent = deliveries.length + ' deliver' + (deliveries.length !== 1 ? 'ies' : 'y');
    }

    if (deliveries.length === 0) {
      listEl.innerHTML = util.emptyState('\uD83D\uDCE6', 'No deliveries recorded', 'Record deliveries from the Orders tab');
      return;
    }

    // Sort by deliveredAt descending
    var sorted = deliveries.slice().sort(function (a, b) {
      return new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0);
    });

    var html = '';
    sorted.forEach(function (del) {
      var order = allOrders.find(function (o) { return o.id === del.orderId; });
      var supplierName = order ? (order.supplierName || 'Unknown Supplier') : (del.orderId ? 'Order: ' + del.orderId : 'No Order');
      var itemCount = (del.items || []).length;
      var detailId = 'del-detail-' + del.id;

      html += '<div class="del-card">';

      // Card header (clickable to expand)
      html += '<div class="del-card-header del-card-toggle" data-delivery-id="' + util.escHtml(del.id) + '" style="cursor:pointer">';
      if (del.deliveredAt) {
        html += '<span>' + new Date(del.deliveredAt + 'T12:00:00Z').toLocaleDateString() + '</span>';
      }
      if (del.ticketNumber) {
        html += '<span style="color:var(--text-light);font-size:0.8rem">Ticket: ' + util.escHtml(del.ticketNumber) + '</span>';
      }
      html += '<span style="color:var(--text-light);font-size:0.8rem">' + util.escHtml(supplierName) + '</span>';
      html += '<span style="margin-left:auto;color:var(--text-light);font-size:0.75rem">&#9654;</span>';
      html += '</div>';

      // Item summary
      html += '<div style="font-size:0.8rem;color:var(--text-light);margin-bottom:0.25rem">';
      html += itemCount + ' item' + (itemCount !== 1 ? 's' : '') + ' received';
      html += '</div>';

      // Expandable detail
      html += '<div class="del-detail" id="' + detailId + '" style="display:none;margin-top:0.5rem">';

      // Items sub-table
      if (del.items && del.items.length > 0) {
        html += '<div style="overflow-x:auto;margin-bottom:0.75rem">';
        html += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
        html += '<thead><tr style="color:var(--text-light);text-align:left;border-bottom:1px solid var(--border)">';
        html += '<th style="padding:0.25rem 0.5rem">Product</th>';
        html += '<th style="padding:0.25rem 0.5rem">Unit</th>';
        html += '<th style="padding:0.25rem 0.5rem;text-align:right">Delivered Qty</th>';
        html += '</tr></thead><tbody>';
        del.items.forEach(function (item) {
          html += '<tr style="border-bottom:1px solid var(--border)">';
          html += '<td style="padding:0.3rem 0.5rem">' + util.escHtml(item.productName || '') + '</td>';
          html += '<td style="padding:0.3rem 0.5rem;color:var(--text-light)">' + util.escHtml(item.unit || '') + '</td>';
          html += '<td style="padding:0.3rem 0.5rem;text-align:right">' + util.formatNum(item.deliveredQty || 0, 0) + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }

      if (del.notes) {
        html += '<div style="font-size:0.82rem;color:var(--text-light);margin-bottom:0.75rem;font-style:italic">' + util.escHtml(del.notes) + '</div>';
      }

      // Action buttons
      html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">';
      html += '<button class="btn-sm btn-primary del-edit-btn" data-delivery-id="' + util.escHtml(del.id) + '">Edit</button>';
      html += '<button class="btn-sm del-delete-btn" data-delivery-id="' + util.escHtml(del.id) + '" style="color:var(--danger);border-color:var(--danger)">Delete</button>';
      html += '</div>';

      html += '</div>'; // end del-detail
      html += '</div>'; // end del-card
    });

    listEl.innerHTML = html;

    // Wire toggle expand/collapse
    listEl.querySelectorAll('.del-card-toggle').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        var delId = hdr.getAttribute('data-delivery-id');
        var detail = document.getElementById('del-detail-' + delId);
        var caret = hdr.querySelector('span:last-child');
        if (!detail) return;
        var open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : '';
        if (caret) caret.innerHTML = open ? '&#9654;' : '&#9660;';
      });
    });

    // Wire edit buttons
    listEl.querySelectorAll('.del-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var delId = btn.getAttribute('data-delivery-id');
        openDeliveryForm(null, delId);
      });
    });

    // Wire delete buttons
    listEl.querySelectorAll('.del-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var delId = btn.getAttribute('data-delivery-id');
        var del = allDeliveries.find(function (d) { return d.id === delId; });
        var label = del && del.deliveredAt ? new Date(del.deliveredAt + 'T12:00:00Z').toLocaleDateString() : 'this delivery';
        if (!confirm('Delete delivery from ' + label + '? This cannot be undone.')) return;
        api.del('/api/deliveries/' + delId).then(function () {
          util.showToast('Delivery deleted', 2000, 'success');
          window.dispatchEvent(new Event('forecast-changed'));
          return loadDeliveries();
        }).catch(function (err) {
          util.showToast('Failed to delete: ' + err.message, 3000, 'error');
        });
      });
    });
  }

  // --- Search filter ---
  var searchEl = document.getElementById('del-search');
  if (searchEl) {
    searchEl.addEventListener('keyup', function () {
      var q = searchEl.value.trim().toLowerCase();
      if (!q) {
        renderDeliveryList(allDeliveries);
        return;
      }
      var filtered = allDeliveries.filter(function (del) {
        if (del.ticketNumber && del.ticketNumber.toLowerCase().includes(q)) return true;
        if (del.items && del.items.some(function (item) {
          return item.productName && item.productName.toLowerCase().includes(q);
        })) return true;
        return false;
      });
      renderDeliveryList(filtered);
    });
  }

  // --- Open delivery form ---
  function openDeliveryForm(orderId, deliveryId) {
    var formEl = document.getElementById('del-form');
    if (!formEl) return;

    editingDeliveryId = deliveryId || null;

    // Find existing delivery if editing
    var existingDel = null;
    if (deliveryId) {
      existingDel = allDeliveries.find(function (d) { return d.id === deliveryId; });
      if (existingDel) orderId = existingDel.orderId;
    }

    // Get active (non-complete) orders for selector
    var activeOrders = allOrders.filter(function (o) { return o.status !== 'complete'; });
    // If the order is complete but we're editing a delivery for it, include it anyway
    if (orderId && !activeOrders.find(function (o) { return o.id === orderId; })) {
      var specificOrder = allOrders.find(function (o) { return o.id === orderId; });
      if (specificOrder) activeOrders = [specificOrder].concat(activeOrders);
    }

    // Build order options
    var orderOptions = '<option value="">-- Select Order --</option>';
    activeOrders.forEach(function (o) {
      var label = (o.supplierName || 'Unknown') + (o.poNumber ? ' / ' + o.poNumber : '') + ' (' + (o.status || 'ordered') + ')';
      var selected = (o.id === orderId) ? ' selected' : '';
      orderOptions += '<option value="' + util.escHtml(o.id) + '"' + selected + '>' + util.escHtml(label) + '</option>';
    });

    // Default date: today
    var today = new Date().toISOString().slice(0, 10);
    var existingDate = existingDel ? existingDel.deliveredAt : today;
    var existingTicket = existingDel ? (existingDel.ticketNumber || '') : '';
    var existingNotes = existingDel ? (existingDel.notes || '') : '';

    var formHtml = '<div class="del-form-inner">';
    formHtml += '<h3 style="color:var(--primary);margin-bottom:0.75rem">' + (editingDeliveryId ? 'Edit Delivery' : 'Record Delivery') + '</h3>';

    formHtml += '<div style="display:grid;gap:0.75rem">';

    // Order selector
    formHtml += '<div>';
    formHtml += '<label style="font-size:0.8rem;color:var(--text-light);display:block;margin-bottom:0.25rem">Order</label>';
    formHtml += '<select id="del-form-order" style="width:100%">' + orderOptions + '</select>';
    formHtml += '</div>';

    // Date + Ticket row
    formHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">';
    formHtml += '<div>';
    formHtml += '<label style="font-size:0.8rem;color:var(--text-light);display:block;margin-bottom:0.25rem">Delivery Date</label>';
    formHtml += '<input type="date" id="del-form-date" value="' + util.escHtml(existingDate || today) + '" style="width:100%">';
    formHtml += '</div>';
    formHtml += '<div>';
    formHtml += '<label style="font-size:0.8rem;color:var(--text-light);display:block;margin-bottom:0.25rem">Ticket / Invoice #</label>';
    formHtml += '<input type="text" id="del-form-ticket" value="' + util.escHtml(existingTicket) + '" placeholder="Optional" style="width:100%">';
    formHtml += '</div>';
    formHtml += '</div>';

    // Notes
    formHtml += '<div>';
    formHtml += '<label style="font-size:0.8rem;color:var(--text-light);display:block;margin-bottom:0.25rem">Notes</label>';
    formHtml += '<textarea id="del-form-notes" rows="2" style="width:100%;resize:vertical" placeholder="Optional notes...">' + util.escHtml(existingNotes) + '</textarea>';
    formHtml += '</div>';

    // Line items area
    formHtml += '<div>';
    formHtml += '<div style="font-size:0.75rem;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.5rem">Line Items</div>';
    formHtml += '<div id="del-form-items">Select an order to see line items</div>';
    formHtml += '</div>';

    // Buttons
    formHtml += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem">';
    formHtml += '<button id="del-form-save" class="btn-sm btn-primary">Save Delivery</button>';
    formHtml += '<button id="del-form-cancel" class="btn-sm">Cancel</button>';
    formHtml += '</div>';

    formHtml += '</div>'; // end grid
    formHtml += '</div>'; // end del-form-inner

    formEl.innerHTML = formHtml;
    formEl.classList.remove('hidden');
    formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Populate line items for selected order
    var orderSel = document.getElementById('del-form-order');
    if (orderSel) {
      populateLineItems(orderSel.value, existingDel);
      orderSel.addEventListener('change', function () {
        populateLineItems(orderSel.value, null);
      });
    }

    // Save handler
    var saveBtn = document.getElementById('del-form-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveDelivery();
      });
    }

    // Cancel handler
    var cancelBtn = document.getElementById('del-form-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        closeDeliveryForm();
      });
    }
  }

  // --- Populate line items from selected order ---
  function populateLineItems(orderId, existingDel) {
    var itemsEl = document.getElementById('del-form-items');
    if (!itemsEl) return;

    if (!orderId) {
      itemsEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-light)">Select an order to see line items</div>';
      return;
    }

    var order = allOrders.find(function (o) { return o.id === orderId; });
    if (!order || !order.items || order.items.length === 0) {
      itemsEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-light)">No line items on this order</div>';
      return;
    }

    // Build delivered qty lookup from existing delivery if editing
    var existingByProduct = {};
    if (existingDel && existingDel.items) {
      existingDel.items.forEach(function (item) {
        existingByProduct[item.productName] = item.deliveredQty || 0;
      });
    }

    var html = '<div style="overflow-x:auto">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
    html += '<thead><tr style="color:var(--text-light);text-align:left;border-bottom:1px solid var(--border)">';
    html += '<th style="padding:0.3rem 0.5rem">Product</th>';
    html += '<th style="padding:0.3rem 0.5rem">Unit</th>';
    html += '<th style="padding:0.3rem 0.5rem;text-align:right">Ordered Qty</th>';
    html += '<th style="padding:0.3rem 0.5rem;text-align:right">Delivered Qty</th>';
    html += '</tr></thead><tbody>';

    order.items.forEach(function (item, idx) {
      // Pre-fill with orderedQty (most deliveries are full) or existing delivery qty
      var prefill = existingByProduct.hasOwnProperty(item.productName)
        ? existingByProduct[item.productName]
        : (item.orderedQty || 0);

      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:0.3rem 0.5rem">' + util.escHtml(item.productName || '') + '</td>';
      html += '<td style="padding:0.3rem 0.5rem;color:var(--text-light)">' + util.escHtml(item.unit || '') + '</td>';
      html += '<td style="padding:0.3rem 0.5rem;text-align:right;color:var(--text-light)">' + util.formatNum(item.orderedQty || 0, 0) + '</td>';
      html += '<td style="padding:0.3rem 0.5rem;text-align:right">';
      html += '<input type="number" class="del-qty-input" data-product="' + util.escHtml(item.productName) + '" data-unit="' + util.escHtml(item.unit || '') + '" value="' + prefill + '" min="0" step="any" style="width:80px;text-align:right;font-size:0.82rem">';
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    itemsEl.innerHTML = html;
  }

  // --- Save delivery ---
  function saveDelivery() {
    var orderSel = document.getElementById('del-form-order');
    var dateInput = document.getElementById('del-form-date');
    var ticketInput = document.getElementById('del-form-ticket');
    var notesInput = document.getElementById('del-form-notes');

    var selectedOrderId = orderSel ? orderSel.value : '';
    if (!selectedOrderId) {
      util.showToast('Please select an order', 3000, 'error');
      return;
    }

    var dateValue = dateInput ? dateInput.value : '';
    var ticketValue = ticketInput ? ticketInput.value.trim() : '';
    var notesValue = notesInput ? notesInput.value.trim() : '';

    // Collect line items with delivered qty > 0
    var lineItems = [];
    var qtyInputs = document.querySelectorAll('#del-form-items .del-qty-input');
    qtyInputs.forEach(function (input) {
      var qty = parseFloat(input.value);
      if (!isNaN(qty) && qty > 0) {
        lineItems.push({
          productName: input.getAttribute('data-product'),
          unit: input.getAttribute('data-unit'),
          deliveredQty: qty
        });
      }
    });

    if (lineItems.length === 0) {
      util.showToast('Enter at least one delivered quantity', 3000, 'error');
      return;
    }

    var saveBtn = document.getElementById('del-form-save');
    if (saveBtn) saveBtn.disabled = true;

    var payload = {
      orderId: selectedOrderId,
      deliveredAt: dateValue,
      ticketNumber: ticketValue,
      notes: notesValue,
      items: lineItems
    };

    var req;
    if (editingDeliveryId) {
      req = api.put('/api/deliveries/' + editingDeliveryId, payload);
    } else {
      req = api.post('/api/deliveries', payload);
    }

    req.then(function () {
      var msg = editingDeliveryId ? 'Delivery updated' : 'Delivery recorded';
      util.showToast(msg, 3000, 'success');
      closeDeliveryForm();
      // Dispatch forecast-changed so inventory.js and orders.js refresh
      window.dispatchEvent(new Event('forecast-changed'));
      return loadDeliveries();
    }).catch(function (err) {
      if (saveBtn) saveBtn.disabled = false;
      util.showToast('Failed to save: ' + err.message, 4000, 'error');
    });
  }

  // --- Close delivery form ---
  function closeDeliveryForm() {
    var formEl = document.getElementById('del-form');
    if (formEl) {
      formEl.innerHTML = '';
      formEl.classList.add('hidden');
    }
    editingDeliveryId = null;
  }

})();
