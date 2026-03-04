// Inventory — Forecast Hub (Forecasts tab)
// Phase 19 Wave 2: full Forecast Hub implementation
(function () {
  'use strict';

  var currentForecast = null;
  var selectedProducts = new Set();
  var printMenuOpen = false;

  // --- Tab activation (always reload, no caching) ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'forecasts') loadForecast();
  });

  // --- Refresh status bars when a delivery is saved ---
  window.addEventListener('forecast-changed', function () {
    if (document.getElementById('tab-forecasts').classList.contains('active')) {
      loadForecast();
    }
  });

  // --- Close print dropdown on outside click ---
  document.addEventListener('click', function (e) {
    if (printMenuOpen && !e.target.closest('#fc-print-menu-wrap')) {
      closePrintMenu();
    }
  });

  // --- Load forecast from server ---
  function loadForecast() {
    var container = document.getElementById('fc-categories');
    if (!container) return;
    container.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-light)">Loading forecast...</div>';

    api.get('/api/forecast').then(function (data) {
      currentForecast = data;
      renderForecast(data);
    }).catch(function (err) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center;color:var(--danger)">Failed to load forecast: ' + util.escHtml(err.message) + '</div>';
    });
  }

  // --- Render the full forecast ---
  function renderForecast(data) {
    var container = document.getElementById('fc-categories');
    if (!container) return;

    var categories = (data && data.categories) || [];

    // Filter out categories with no products
    var visibleCats = categories.filter(function (c) { return c.products && c.products.length > 0; });

    if (visibleCats.length === 0) {
      container.innerHTML = util.emptyState('\uD83D\uDCE6', 'No forecast data', 'Add inputs to fields in the Macro Roll-Up to see forecasts here');
      updateSummary(0, 0);
      return;
    }

    // Reset selection (fresh render clears stale state)
    selectedProducts.clear();
    updateCreateOrderBtn();

    var html = '';
    var grandTotalProducts = 0;
    var grandTotalCost = 0;

    visibleCats.forEach(function (cat) {
      var products = (cat.products || []).filter(function (p) { return (p.totalQty || 0) > 0; });
      if (products.length === 0) return;

      var catCost = products.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
      grandTotalProducts += products.length;
      grandTotalCost += catCost;

      var catId = 'cat-' + encodeURIComponent(cat.name).replace(/%/g, '_');

      html += '<div class="fc-category" id="' + catId + '">';

      // Category header with toggle + select-all/clear
      html += '<div class="fc-category-header" data-cat-id="' + util.escHtml(catId) + '">';
      html += '<span class="fc-category-name">' + util.escHtml(cat.name) + '</span>';
      html += '<span class="fc-category-total badge-neutral">' + products.length + ' product' + (products.length !== 1 ? 's' : '') + '</span>';
      html += '<span class="fc-category-total">' + util.formatMoney(catCost) + '</span>';
      html += '<span class="fc-category-toggle" id="toggle-' + catId + '">&#9660;</span>';
      html += '<button class="fc-sel-btn btn-sm" data-action="select-all" data-cat-id="' + util.escHtml(catId) + '" style="margin-left:auto">Select All</button>';
      html += '<button class="fc-sel-btn btn-sm" data-action="clear" data-cat-id="' + util.escHtml(catId) + '">Clear</button>';
      html += '</div>';

      // Column header
      html += '<div class="fc-row fc-header">';
      html += '<span></span>';
      html += '<span>Product</span>';
      html += '<span>Supplier</span>';
      html += '<span>Amount</span>';
      html += '<span>Unit Cost</span>';
      html += '<span>Total Cost</span>';
      html += '<span>Ordered</span>';
      html += '<span>Remaining</span>';
      html += '<span>% Ordered</span>';
      html += '</div>';

      // Product rows
      products.forEach(function (p, pIdx) {
        var pctRaw = p.pctOrdered || 0;
        var pct = Math.min(pctRaw, 100);
        var fillClass = pctRaw > 100 ? 'over' : (pctRaw >= 100 ? 'complete' : '');
        var remaining = (p.totalQty || 0) - (p.orderedQty || 0);
        var remainClass = remaining < 0 ? 'color:var(--danger)' : '';
        var rowId = 'row-' + catId + '-' + pIdx;
        var breakdownId = 'breakdown-' + catId + '-' + pIdx;
        var cbxId = 'cbx-' + catId + '-' + pIdx;

        html += '<div class="fc-row" id="' + rowId + '">';

        // Checkbox (44px tap target via padding)
        html += '<span style="min-width:1.5rem;padding:0.6rem 0.25rem">';
        html += '<input type="checkbox" id="' + cbxId + '" data-product-name="' + util.escHtml(p.productName) + '" style="cursor:pointer;width:16px;height:16px">';
        html += '</span>';

        // Product name (clickable to expand)
        html += '<span class="fc-expand-target" data-breakdown="' + breakdownId + '" data-row="' + rowId + '" style="cursor:pointer;padding:0.6rem 0.25rem">';
        if (p.fields && p.fields.length > 0) {
          html += '<span class="fc-caret" id="caret-' + breakdownId + '" style="display:inline-block;margin-right:0.25rem;font-size:0.7rem;color:var(--text-light)">&#9654;</span>';
        }
        html += '<span>' + util.escHtml(p.productName) + '</span>';
        if (p.isSeedVariety) {
          html += ' <span style="font-size:0.7rem;color:var(--primary)">[seed]</span>';
        }
        html += '</span>';

        // Supplier
        html += '<span style="color:var(--text-light);padding:0.4rem 0.25rem">' + util.escHtml(p.supplierName || '\u2014') + '</span>';

        // Amount
        html += '<span style="padding:0.4rem 0.25rem">' + util.formatNum(p.totalQty, 0) + ' ' + util.escHtml(p.unit || '') + '</span>';

        // Unit cost
        html += '<span style="padding:0.4rem 0.25rem">' + util.formatMoney(p.unitCost, 4) + '</span>';

        // Total cost
        html += '<span style="padding:0.4rem 0.25rem">' + util.formatMoney(p.totalCost, 2) + '</span>';

        // Ordered qty
        html += '<span style="padding:0.4rem 0.25rem">' + util.formatNum(p.orderedQty || 0, 0) + '</span>';

        // Remaining
        html += '<span style="padding:0.4rem 0.25rem;' + remainClass + '">' + util.formatNum(remaining, 0) + '</span>';

        // % ordered bar
        html += '<span style="padding:0.4rem 0.25rem">';
        html += '<div class="pct-bar"><div class="pct-bar-fill ' + fillClass + '" style="width:' + pct + '%"></div></div>';
        html += '<span style="font-size:0.75rem;color:var(--text-light)">' + Math.round(pctRaw) + '%</span>';
        html += '</span>';

        html += '</div>'; // end fc-row

        // Field breakdown (hidden by default)
        if (p.fields && p.fields.length > 0) {
          html += '<div class="fc-field-breakdown" id="' + breakdownId + '" style="display:none">';
          html += '<div class="fc-field-row" style="font-weight:600;color:var(--text-light)"><span>Field</span><span>Acres</span><span>Qty</span><span>Season</span></div>';
          p.fields.forEach(function (f) {
            html += '<div class="fc-field-row">';
            html += '<span>' + util.escHtml(f.fieldName) + '</span>';
            html += '<span>' + util.formatNum(f.acres, 1) + '</span>';
            html += '<span>' + util.formatNum(f.qty, 0) + ' ' + util.escHtml(p.unit || '') + '</span>';
            html += '<span>' + util.escHtml(f.season || '') + '</span>';
            html += '</div>';
          });
          html += '</div>';
        }
      });

      html += '</div>'; // end fc-category
    });

    container.innerHTML = html;
    updateSummary(grandTotalProducts, grandTotalCost);

    // --- Wire up interactions ---

    // Category header toggle (collapse/expand product list)
    container.querySelectorAll('.fc-category-header').forEach(function (hdr) {
      hdr.addEventListener('click', function (e) {
        // Don't toggle if clicking buttons
        if (e.target.tagName === 'BUTTON') return;
        var catId = hdr.getAttribute('data-cat-id');
        var catEl = document.getElementById(catId);
        if (!catEl) return;
        var rows = catEl.querySelectorAll('.fc-row:not(.fc-header), .fc-field-breakdown');
        var toggleEl = document.getElementById('toggle-' + catId);
        var collapsed = catEl.getAttribute('data-collapsed') === '1';
        rows.forEach(function (r) { r.style.display = collapsed ? '' : 'none'; });
        if (toggleEl) toggleEl.innerHTML = collapsed ? '&#9660;' : '&#9654;';
        catEl.setAttribute('data-collapsed', collapsed ? '0' : '1');
      });
    });

    // Select All / Clear buttons
    container.querySelectorAll('.fc-sel-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var catId = btn.getAttribute('data-cat-id');
        var action = btn.getAttribute('data-action');
        var catEl = document.getElementById(catId);
        if (!catEl) return;
        catEl.querySelectorAll('input[type=checkbox]').forEach(function (cbx) {
          var pName = cbx.getAttribute('data-product-name');
          if (action === 'select-all') {
            cbx.checked = true;
            selectedProducts.add(pName);
          } else {
            cbx.checked = false;
            selectedProducts.delete(pName);
          }
        });
        updateCreateOrderBtn();
      });
    });

    // Individual checkboxes
    container.querySelectorAll('input[type=checkbox]').forEach(function (cbx) {
      cbx.addEventListener('change', function () {
        var pName = cbx.getAttribute('data-product-name');
        if (cbx.checked) {
          selectedProducts.add(pName);
        } else {
          selectedProducts.delete(pName);
        }
        updateCreateOrderBtn();
      });
    });

    // Expandable field breakdown (click on product name cell)
    container.querySelectorAll('.fc-expand-target').forEach(function (cell) {
      cell.addEventListener('click', function () {
        var breakdownId = cell.getAttribute('data-breakdown');
        var rowId = cell.getAttribute('data-row');
        var breakdown = document.getElementById(breakdownId);
        var caret = document.getElementById('caret-' + breakdownId);
        var row = document.getElementById(rowId);
        if (!breakdown) return;
        var open = breakdown.style.display !== 'none';
        breakdown.style.display = open ? 'none' : '';
        if (caret) caret.innerHTML = open ? '&#9654;' : '&#9660;';
        if (row) row.classList.toggle('expanded', !open);
      });
    });
  }

  // --- Update summary line ---
  function updateSummary(count, total) {
    var summaryEl = document.getElementById('fc-summary');
    if (summaryEl) {
      if (count === 0) {
        summaryEl.textContent = '';
      } else {
        summaryEl.textContent = count + ' product' + (count !== 1 ? 's' : '') + ' \u2014 ' + util.formatMoney(total) + ' total forecast';
      }
    }
  }

  // --- Enable/disable Create Order button ---
  function updateCreateOrderBtn() {
    var btn = document.getElementById('fc-create-order');
    if (btn) btn.disabled = selectedProducts.size === 0;
  }

  // --- Create Order button handler ---
  var createBtn = document.getElementById('fc-create-order');
  if (createBtn) {
    createBtn.addEventListener('click', function () {
      if (!currentForecast || selectedProducts.size === 0) return;

      var allProducts = (currentForecast.categories || []).reduce(function (acc, cat) {
        return acc.concat(cat.products || []);
      }, []);

      var chosen = allProducts.filter(function (p) { return selectedProducts.has(p.productName); });

      // Group by supplierId
      var bySupplier = {};
      chosen.forEach(function (p) {
        var key = p.supplierId || '__none__';
        if (!bySupplier[key]) {
          bySupplier[key] = { supplierId: p.supplierId || null, supplierName: p.supplierName || 'No Supplier', items: [] };
        }
        bySupplier[key].items.push({
          productName: p.productName,
          unit: p.unit || '',
          forecastQty: p.totalQty || 0,
          orderedQty: p.totalQty || 0,
          unitCost: p.unitCost || 0
        });
      });

      var groups = Object.values(bySupplier);
      var orderPromises = groups.map(function (g) {
        return api.post('/api/orders', {
          supplierId: g.supplierId,
          supplierName: g.supplierName,
          status: 'ordered',
          poNumber: '',
          notes: '',
          createdAt: new Date().toISOString(),
          items: g.items
        });
      });

      Promise.all(orderPromises).then(function () {
        util.showToast('Created ' + groups.length + ' order' + (groups.length !== 1 ? 's' : ''), 3000, 'success');
        selectedProducts.clear();
        updateCreateOrderBtn();
        // Reload forecast to refresh ordered quantities
        loadForecast();
        // Navigate to Orders tab
        location.hash = 'orders';
        window.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: 'orders' } }));
      }).catch(function (err) {
        util.showToast('Failed to create orders: ' + err.message, 4000, 'error');
      });
    });
  }

  // --- Print Reports dropdown ---
  var printBtn = document.getElementById('fc-print-menu');
  if (printBtn) {
    // Wrap print button in a positioned container for dropdown positioning
    var parentEl = printBtn.parentNode;
    var wrap = document.createElement('span');
    wrap.id = 'fc-print-menu-wrap';
    wrap.style.cssText = 'position:relative;display:inline-block';
    parentEl.insertBefore(wrap, printBtn);
    wrap.appendChild(printBtn);

    var menuEl = document.createElement('div');
    menuEl.id = 'fc-print-dropdown';
    menuEl.style.cssText = 'display:none;position:absolute;top:100%;left:0;z-index:200;background:var(--card);border:1px solid var(--border);border-radius:4px;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.3)';
    wrap.appendChild(menuEl);

    var reportItems = [
      { label: 'Agronomist/Supplier Order Sheet', type: 'agronomist' },
      { label: 'Field-Level Input Plan', type: 'field-plan' },
      { label: 'Forecast Summary', type: 'forecast-summary' },
      { label: 'Order Status Report', type: 'order-status' },
      { label: 'Delivery Receipt Log', type: 'delivery-log' }
    ];

    menuEl.innerHTML = reportItems.map(function (item) {
      return '<button class="fc-print-item" data-report-type="' + item.type + '" style="display:block;width:100%;text-align:left;padding:0.5rem 1rem;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text);cursor:pointer;font-size:0.85rem">' + util.escHtml(item.label) + '</button>';
    }).join('');

    menuEl.querySelectorAll('.fc-print-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var reportType = item.getAttribute('data-report-type');
        window.dispatchEvent(new CustomEvent('print-report', { detail: { type: reportType } }));
        closePrintMenu();
      });
    });

    printBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      printMenuOpen = !printMenuOpen;
      menuEl.style.display = printMenuOpen ? 'block' : 'none';
    });
  }

  function closePrintMenu() {
    printMenuOpen = false;
    var menuEl = document.getElementById('fc-print-dropdown');
    if (menuEl) menuEl.style.display = 'none';
  }

})();
