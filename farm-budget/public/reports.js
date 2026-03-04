// Reports — print-optimized HTML reports for procurement pipeline
// Phase 19 Wave 2: full 5-report implementation
(function () {
  'use strict';

  var PRINT_CSS = [
    'body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }',
    'table { width: 100%; border-collapse: collapse; margin-bottom: 1em; }',
    'th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; }',
    'th { background: #e8e8e8; font-weight: bold; font-size: 10pt; }',
    'td.num { text-align: right; }',
    'h1 { font-size: 16pt; margin: 0 0 4px 0; }',
    'h2 { font-size: 13pt; margin: 1.5em 0 0.5em 0; page-break-before: always; }',
    'h2:first-of-type { page-break-before: avoid; }',
    '.subtitle { font-size: 10pt; color: #666; margin-bottom: 1em; }',
    'tr { page-break-inside: avoid; }',
    'thead { display: table-header-group; }',
    'tfoot { display: table-footer-group; }',
    '.total-row td { font-weight: bold; border-top: 2px solid #333; }',
    '.no-print { display: none; }',
    '@page { margin: 0.75in; }',
    '@media print { body { -webkit-print-color-adjust: exact; } }'
  ].join('\n');

  // --- Helper: format money for print ---
  function fmtMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Helper: format number for print ---
  function fmtNum(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: dec || 0,
      maximumFractionDigits: dec || 0
    });
  }

  // --- Helper: escape HTML ---
  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Helper: format date for print ---
  function fmtDate(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString();
  }

  // --- Get current year ---
  function getYear() {
    return (window.refData && window.refData.settings && window.refData.settings.year)
      ? window.refData.settings.year
      : new Date().getFullYear();
  }

  // --- Farm name ---
  function getFarmName(settings) {
    return (settings && settings.farmName) ? settings.farmName : 'Hughes Farm';
  }

  // --- Listen for print-report events dispatched by inventory.js dropdown ---
  window.addEventListener('print-report', function (e) {
    var type = e.detail && e.detail.type;
    if (!type) return;
    generateReport(type);
  });

  // --- Listen for forecast-changed to clear any cached data (none cached here, but good practice) ---
  window.addEventListener('forecast-changed', function () {
    // Reports fetch fresh data on every invocation — nothing to invalidate
  });

  // --- Generate a report: open window first (sync), then write data async ---
  function generateReport(type) {
    // Open window synchronously to avoid popup blocker
    var win = window.open('', '_blank');
    if (!win) {
      util.showToast('Enable popups to print reports', 4000, 'error');
      return;
    }

    // Show loading indicator in window
    win.document.write('<!DOCTYPE html><html><head><title>Loading report...</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#666}</style></head><body><p>Loading report data...</p></body></html>');

    // Fetch all data in parallel
    Promise.all([
      api.get('/api/forecast'),
      api.get('/api/orders'),
      api.get('/api/deliveries'),
      api.get('/api/fields?all=true'),
      api.get('/api/settings')
    ]).then(function (results) {
      var forecast = results[0];
      var orders = results[1];
      var deliveries = results[2];
      var fields = results[3];
      var settings = results[4];

      var html = buildReportHtml(type, forecast, orders, deliveries, fields, settings);

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }).catch(function (err) {
      win.document.open();
      win.document.write('<!DOCTYPE html><html><head><title>Report Error</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#c00}</style></head><body><h1>Failed to load report</h1><p>' + esc(err.message) + '</p></body></html>');
      win.document.close();
    });
  }

  // --- Build report HTML based on type ---
  function buildReportHtml(type, forecast, orders, deliveries, fields, settings) {
    switch (type) {
      case 'agronomist':   return buildAgronomistReport(forecast, settings);
      case 'field-plan':   return buildFieldPlanReport(forecast, fields, settings);
      case 'forecast-summary': return buildForecastSummaryReport(forecast, settings);
      case 'order-status': return buildOrderStatusReport(orders, settings);
      case 'delivery-log': return buildDeliveryLogReport(deliveries, orders, settings);
      default:
        return '<!DOCTYPE html><html><head><title>Unknown Report</title></head><body><p>Unknown report type: ' + esc(type) + '</p></body></html>';
    }
  }

  // --- Report wrapper: header + body ---
  function reportWrapper(title, farmName, bodyHtml) {
    var generated = new Date().toLocaleDateString();
    return '<!DOCTYPE html><html><head>' +
      '<title>' + esc(title) + '</title>' +
      '<style>' + PRINT_CSS + '</style>' +
      '</head><body>' +
      '<h1>' + esc(farmName) + '</h1>' +
      '<h1 style="font-size:14pt;font-weight:normal;margin:2px 0 0 0">' + esc(title) + '</h1>' +
      '<p class="subtitle">Generated: ' + generated + '</p>' +
      bodyHtml +
      '</body></html>';
  }

  // ================================================================
  // Report 1: Agronomist / Supplier Order Sheet
  // ================================================================
  function buildAgronomistReport(forecast, settings) {
    var year = getYear();
    var farmName = getFarmName(settings);
    var title = 'Agronomist Order Sheet \u2014 ' + year;

    var categories = (forecast && forecast.categories) || [];

    // Flatten all products across categories
    var allProducts = [];
    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        if ((p.totalQty || 0) > 0) {
          allProducts.push(p);
        }
      });
    });

    // Group products by supplier
    var bySupplier = {};
    var supplierOrder = [];
    allProducts.forEach(function (p) {
      var key = p.supplierName || 'No Supplier Assigned';
      if (!bySupplier[key]) {
        bySupplier[key] = [];
        supplierOrder.push(key);
      }
      bySupplier[key].push(p);
    });

    var body = '';
    var grandTotal = 0;

    supplierOrder.forEach(function (supplierName, si) {
      var products = bySupplier[supplierName];
      var supplierTotal = 0;

      body += '<h2>' + esc(supplierName) + '</h2>';
      body += '<table>';
      body += '<thead><tr>';
      body += '<th>Product</th><th>Amount</th><th>Unit</th><th>Unit Cost</th><th>Total Cost</th><th>Fields</th>';
      body += '</tr></thead>';
      body += '<tbody>';

      products.forEach(function (p) {
        var total = p.totalCost || 0;
        supplierTotal += total;
        var fieldNames = (p.fields || []).map(function (f) { return f.fieldName; }).join(', ');

        body += '<tr>';
        body += '<td>' + esc(p.productName) + (p.isSeedVariety ? ' [seed]' : '') + '</td>';
        body += '<td class="num">' + fmtNum(p.totalQty, 0) + '</td>';
        body += '<td>' + esc(p.unit || '') + '</td>';
        body += '<td class="num">' + fmtMoney(p.unitCost) + '</td>';
        body += '<td class="num">' + fmtMoney(total) + '</td>';
        body += '<td style="font-size:9pt">' + esc(fieldNames || '\u2014') + '</td>';
        body += '</tr>';
      });

      body += '</tbody>';
      body += '<tfoot><tr class="total-row">';
      body += '<td colspan="4">' + esc(supplierName) + ' Subtotal</td>';
      body += '<td class="num">' + fmtMoney(supplierTotal) + '</td>';
      body += '<td></td>';
      body += '</tr></tfoot>';
      body += '</table>';

      grandTotal += supplierTotal;
    });

    // Grand total
    if (supplierOrder.length > 1 || supplierOrder.length === 0) {
      body += '<table style="margin-top:1em">';
      body += '<tbody><tr class="total-row">';
      body += '<td colspan="4" style="font-size:12pt"><strong>Farm-Wide Grand Total</strong></td>';
      body += '<td class="num" style="font-size:12pt"><strong>' + fmtMoney(grandTotal) + '</strong></td>';
      body += '<td></td>';
      body += '</tr></tbody></table>';
    }

    if (allProducts.length === 0) {
      body += '<p>No forecast products found. Add inputs to fields in the Macro Roll-Up first.</p>';
    }

    return reportWrapper(title, farmName, body);
  }

  // ================================================================
  // Report 2: Field-Level Input Plan
  // ================================================================
  function buildFieldPlanReport(forecast, fields, settings) {
    var year = getYear();
    var farmName = getFarmName(settings);
    var title = 'Field-Level Input Plan \u2014 ' + year;

    var categories = (forecast && forecast.categories) || [];

    // Build a map from fieldName -> list of {product, qty, unit, season, isSeed, variety, population, bags}
    var fieldInputMap = {};

    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        (p.fields || []).forEach(function (f) {
          if (!fieldInputMap[f.fieldName]) {
            fieldInputMap[f.fieldName] = { acres: f.acres || 0, inputs: [] };
          }
          fieldInputMap[f.fieldName].inputs.push({
            productName: p.productName,
            unit: p.unit || '',
            qty: f.qty || 0,
            season: f.season || '',
            isSeed: p.isSeedVariety || false,
            ratePerAc: f.acres > 0 ? (f.qty / f.acres) : 0
          });
        });
      });
    });

    // Sort field names alphabetically
    var fieldNames = Object.keys(fieldInputMap).sort();

    var body = '';

    if (fieldNames.length === 0) {
      body += '<p>No field-level input data found. Add inputs to fields in the Macro Roll-Up first.</p>';
    } else {
      fieldNames.forEach(function (fieldName) {
        var fieldData = fieldInputMap[fieldName];
        body += '<h2>' + esc(fieldName) + ' (' + fmtNum(fieldData.acres, 1) + ' ac)</h2>';
        body += '<table>';
        body += '<thead><tr>';
        body += '<th>Product</th><th>Season</th><th>Qty</th><th>Unit</th><th>Rate/Ac</th>';
        body += '</tr></thead>';
        body += '<tbody>';

        fieldData.inputs.forEach(function (inp) {
          body += '<tr>';
          body += '<td>' + esc(inp.productName) + (inp.isSeed ? ' <em>[seed]</em>' : '') + '</td>';
          body += '<td>' + esc(inp.season) + '</td>';
          body += '<td class="num">' + fmtNum(inp.qty, 0) + '</td>';
          body += '<td>' + esc(inp.unit) + '</td>';
          body += '<td class="num">' + fmtNum(inp.ratePerAc, 2) + '</td>';
          body += '</tr>';
        });

        body += '</tbody></table>';
      });
    }

    return reportWrapper(title, farmName, body);
  }

  // ================================================================
  // Report 3: Forecast Summary
  // ================================================================
  function buildForecastSummaryReport(forecast, settings) {
    var year = getYear();
    var farmName = getFarmName(settings);
    var title = 'Farm Forecast Summary \u2014 ' + year;

    var categories = (forecast && forecast.categories) || [];

    // Summary stats
    var totalProducts = 0;
    var totalForecastCost = 0;
    var totalOrderedCost = 0;

    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        if ((p.totalQty || 0) > 0) {
          totalProducts++;
          totalForecastCost += p.totalCost || 0;
          totalOrderedCost += (p.orderedQty || 0) * (p.unitCost || 0);
        }
      });
    });

    var body = '';

    // Summary stats table at top
    body += '<table style="margin-bottom:1.5em">';
    body += '<tbody>';
    body += '<tr><td><strong>Total Products</strong></td><td class="num">' + totalProducts + '</td></tr>';
    body += '<tr><td><strong>Total Forecast Cost</strong></td><td class="num">' + fmtMoney(totalForecastCost) + '</td></tr>';
    body += '<tr><td><strong>Total Ordered Cost</strong></td><td class="num">' + fmtMoney(totalOrderedCost) + '</td></tr>';
    body += '</tbody></table>';

    var grandTotal = 0;

    categories.forEach(function (cat) {
      var products = (cat.products || []).filter(function (p) { return (p.totalQty || 0) > 0; });
      if (products.length === 0) return;

      var catTotal = 0;
      body += '<h2>' + esc(cat.name) + '</h2>';
      body += '<table>';
      body += '<thead><tr>';
      body += '<th>Product</th><th>Supplier</th><th>Amount</th><th>Unit</th><th>Unit Cost</th><th>Total Cost</th><th>Ordered</th><th>Remaining</th>';
      body += '</tr></thead>';
      body += '<tbody>';

      products.forEach(function (p) {
        var total = p.totalCost || 0;
        catTotal += total;
        var remaining = (p.totalQty || 0) - (p.orderedQty || 0);

        body += '<tr>';
        body += '<td>' + esc(p.productName) + '</td>';
        body += '<td>' + esc(p.supplierName || '\u2014') + '</td>';
        body += '<td class="num">' + fmtNum(p.totalQty, 0) + '</td>';
        body += '<td>' + esc(p.unit || '') + '</td>';
        body += '<td class="num">' + fmtMoney(p.unitCost) + '</td>';
        body += '<td class="num">' + fmtMoney(total) + '</td>';
        body += '<td class="num">' + fmtNum(p.orderedQty || 0, 0) + '</td>';
        body += '<td class="num">' + fmtNum(remaining, 0) + '</td>';
        body += '</tr>';
      });

      body += '</tbody>';
      body += '<tfoot><tr class="total-row">';
      body += '<td colspan="5">' + esc(cat.name) + ' Subtotal</td>';
      body += '<td class="num">' + fmtMoney(catTotal) + '</td>';
      body += '<td colspan="2"></td>';
      body += '</tr></tfoot>';
      body += '</table>';

      grandTotal += catTotal;
    });

    body += '<table style="margin-top:1em">';
    body += '<tbody><tr class="total-row">';
    body += '<td colspan="5" style="font-size:12pt"><strong>Grand Total</strong></td>';
    body += '<td class="num" style="font-size:12pt"><strong>' + fmtMoney(grandTotal) + '</strong></td>';
    body += '<td colspan="2"></td>';
    body += '</tr></tbody></table>';

    return reportWrapper(title, farmName, body);
  }

  // ================================================================
  // Report 4: Order Status Report
  // ================================================================
  function buildOrderStatusReport(orders, settings) {
    var year = getYear();
    var farmName = getFarmName(settings);
    var title = 'Order Status Report \u2014 ' + year;

    var ordCount = (orders || []).length;
    var nOrdered = 0, nPartial = 0, nComplete = 0;
    (orders || []).forEach(function (o) {
      if (o.status === 'ordered') nOrdered++;
      else if (o.status === 'partial') nPartial++;
      else if (o.status === 'complete') nComplete++;
    });

    var body = '';

    // Summary
    body += '<table style="margin-bottom:1em">';
    body += '<tbody>';
    body += '<tr><td><strong>Total Orders</strong></td><td class="num">' + ordCount + '</td></tr>';
    body += '<tr><td>Ordered</td><td class="num">' + nOrdered + '</td></tr>';
    body += '<tr><td>Partial</td><td class="num">' + nPartial + '</td></tr>';
    body += '<tr><td>Complete</td><td class="num">' + nComplete + '</td></tr>';
    body += '</tbody></table>';

    body += '<table>';
    body += '<thead><tr>';
    body += '<th>Supplier</th><th>PO#</th><th>Status</th><th>Items</th><th>Total</th><th>Created</th><th>Notes</th>';
    body += '</tr></thead>';
    body += '<tbody>';

    var sortedOrders = (orders || []).slice().sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (sortedOrders.length === 0) {
      body += '<tr><td colspan="7" style="text-align:center;color:#666">No orders found</td></tr>';
    } else {
      sortedOrders.forEach(function (ord) {
        var itemCount = (ord.items || []).length;
        var total = (ord.items || []).reduce(function (s, it) {
          return s + ((it.orderedQty || 0) * (it.unitCost || 0));
        }, 0);
        var createdDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : '--';

        body += '<tr>';
        body += '<td>' + esc(ord.supplierName || 'Unknown') + '</td>';
        body += '<td>' + esc(ord.poNumber || '\u2014') + '</td>';
        body += '<td>' + esc(ord.status || 'ordered') + '</td>';
        body += '<td class="num">' + itemCount + '</td>';
        body += '<td class="num">' + fmtMoney(total) + '</td>';
        body += '<td>' + createdDate + '</td>';
        body += '<td style="font-size:9pt">' + esc(ord.notes || '') + '</td>';
        body += '</tr>';
      });
    }

    body += '</tbody></table>';

    return reportWrapper(title, farmName, body);
  }

  // ================================================================
  // Report 5: Delivery Receipt Log
  // ================================================================
  function buildDeliveryLogReport(deliveries, orders, settings) {
    var year = getYear();
    var farmName = getFarmName(settings);
    var title = 'Delivery Receipt Log \u2014 ' + year;

    // Build order lookup
    var orderMap = {};
    (orders || []).forEach(function (o) { orderMap[o.id] = o; });

    var totalDeliveries = (deliveries || []).length;
    var totalItems = 0;
    (deliveries || []).forEach(function (d) { totalItems += (d.items || []).length; });

    var body = '';

    // Summary
    body += '<table style="margin-bottom:1em">';
    body += '<tbody>';
    body += '<tr><td><strong>Total Deliveries</strong></td><td class="num">' + totalDeliveries + '</td></tr>';
    body += '<tr><td><strong>Total Items Received</strong></td><td class="num">' + totalItems + '</td></tr>';
    body += '</tbody></table>';

    body += '<table>';
    body += '<thead><tr>';
    body += '<th>Date</th><th>Supplier</th><th>Order PO#</th><th>Ticket#</th><th>Products</th><th>Notes</th>';
    body += '</tr></thead>';
    body += '<tbody>';

    var sortedDels = (deliveries || []).slice().sort(function (a, b) {
      return new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0);
    });

    if (sortedDels.length === 0) {
      body += '<tr><td colspan="6" style="text-align:center;color:#666">No deliveries recorded</td></tr>';
    } else {
      sortedDels.forEach(function (del) {
        var order = del.orderId ? orderMap[del.orderId] : null;
        var supplierName = order ? (order.supplierName || 'Unknown') : '\u2014';
        var poNumber = order ? (order.poNumber || '\u2014') : '\u2014';
        var productsSummary = (del.items || []).map(function (item) {
          return esc(item.productName) + ' (' + fmtNum(item.deliveredQty, 0) + ' ' + esc(item.unit || '') + ')';
        }).join(', ');

        body += '<tr>';
        body += '<td>' + fmtDate(del.deliveredAt) + '</td>';
        body += '<td>' + esc(supplierName) + '</td>';
        body += '<td>' + esc(poNumber) + '</td>';
        body += '<td>' + esc(del.ticketNumber || '\u2014') + '</td>';
        body += '<td style="font-size:9pt">' + (productsSummary || '\u2014') + '</td>';
        body += '<td style="font-size:9pt">' + esc(del.notes || '') + '</td>';
        body += '</tr>';
      });
    }

    body += '</tbody></table>';

    return reportWrapper(title, farmName, body);
  }

})();
