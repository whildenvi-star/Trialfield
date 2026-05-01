// Reports — print-optimized HTML reports for procurement pipeline
// Phase 19 Wave 2: full 5-report implementation
(function () {
  'use strict';

  var PRINT_CSS = [
    /* ── Reset & base ── */
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #1a1a1a; margin: 0; padding: 0; line-height: 1.45; }',

    /* ── Report header block ── */
    '.rpt-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1a1a1a; padding-bottom: 7px; margin-bottom: 14px; }',
    '.rpt-header-left .rpt-farm { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.07em; color: #1a1a1a; line-height: 1.1; }',
    '.rpt-header-left .rpt-title { font-size: 10pt; color: #444; margin-top: 2px; }',
    '.rpt-header-right { font-size: 7.5pt; color: #666; text-align: right; line-height: 1.6; }',
    '.rpt-rule { border: none; border-top: 1px solid #ccc; margin: 10px 0 14px; }',

    /* ── Section headings ── */
    'h2 { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; color: #fff; background: #2c2c2c; padding: 5px 8px; margin: 1.4em 0 0 0; page-break-after: avoid; }',
    'h2:first-of-type { margin-top: 0; }',
    'h3 { font-size: 9pt; margin: 0.8em 0 0.3em; color: #333; }',

    /* ── Tables ── */
    'table { width: 100%; border-collapse: collapse; margin-bottom: 1.2em; font-size: 9pt; }',
    'thead th { background: #3a3a3a; color: #fff; padding: 5px 8px; font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #3a3a3a; vertical-align: bottom; }',
    'th.num { text-align: right; }',
    'td { border: 1px solid #d4d4d4; padding: 4px 8px; vertical-align: top; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'td.num { text-align: right; }',
    'tbody tr:nth-child(even) { background: #f6f6f6; }',
    'tbody tr:nth-child(odd)  { background: #ffffff; }',
    'tfoot { display: table-footer-group; }',
    'thead { display: table-header-group; }',

    /* ── Special rows ── */
    '.total-row td { font-weight: bold; background: #e2e2e2 !important; border-top: 2px solid #2c2c2c; font-size: 9.5pt; }',
    '.subtotal-row td { font-weight: bold; background: #ececec !important; border-top: 1.5px solid #888; font-size: 8.5pt; }',
    '.group-header-row td { font-weight: bold; background: #d5d5d5 !important; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #222; }',

    /* ── P&L colours ── */
    '.profit-neg { color: #8b0000 !important; }',
    '.profit-pos { color: #1a5c10 !important; }',
    '.confirmed-row td { background: #f0f9f0 !important; }',

    /* ── Page setup — letter portrait, extra left margin for binder ── */
    '@page { size: letter portrait; margin: 0.7in 0.7in 0.8in 1.15in; }',
    '@page { @bottom-right { content: "Page " counter(page) " of " counter(pages); font-family: Arial, sans-serif; font-size: 7.5pt; color: #888; } }',

    /* ── Print overrides ── */
    '@media print {',
    '  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '  tr { page-break-inside: avoid; }',
    '  h2 { page-break-after: avoid; }',
    '  thead { display: table-header-group !important; }',
    '  tfoot { display: table-footer-group !important; }',
    '  .profit-neg { color: #8b0000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '  .profit-pos { color: #1a5c10 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '}'
  ].join('\n');

  // --- Helper: format money for print ---
  function fmtMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Helper: format money with accounting parentheses for negative values ---
  // Negative: (123.45) in red; positive: $123.45
  function formatPrintMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    var v = Number(n);
    if (v < 0) {
      var abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return '<span class="profit-neg">($' + abs + ')</span>';
    }
    if (v === 0) {
      return '$0.00';
    }
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    // Crop plan and field history have config modals — intercept before opening popup
    if (type === 'crop-plan') {
      // If a saved config with at least one included enterprise exists, print directly
      var savedCfg = loadCropPlanConfig();
      if (savedCfg.__included && savedCfg.__included.length > 0) {
        var win = window.open('', '_blank');
        if (!win) { util.showToast('Enable popups to print reports', 4000, 'error'); return; }
        win.document.write('<!DOCTYPE html><html><head><title>Loading...</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#666}</style></head><body><p>Building crop plan...</p></body></html>');
        Promise.all([
          api.get('/api/fields?all=true'),
          api.get('/api/settings')
        ]).then(function (res) {
          var html = buildCropPlanReport(res[0], res[1], savedCfg);
          win.document.open();
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
        }).catch(function (err) {
          win.document.open();
          win.document.write('<!DOCTYPE html><html><head><title>Error</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#c00}</style></head><body><h1>Report failed</h1><p>' + esc(err.message) + '</p></body></html>');
          win.document.close();
        });
        return;
      }
      showCropPlanConfig();
      return;
    }
    if (type === 'crop-plan-setup') {
      showCropPlanConfig();
      return;
    }
    if (type === 'field-history') {
      showFieldHistoryConfig();
      return;
    }

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
      case 'crop-plan':    return buildCropPlanReport(fields, settings);
      default:
        return '<!DOCTYPE html><html><head><title>Unknown Report</title></head><body><p>Unknown report type: ' + esc(type) + '</p></body></html>';
    }
  }

  // --- Report wrapper: professional binder-ready header + body ---
  function reportWrapper(title, farmName, bodyHtml, extraCss, printId) {
    var year = getYear();
    var generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var metaRight = esc(year) + ' Crop Year<br>Generated ' + esc(generated);
    if (printId) metaRight += '<br><strong>Print #' + esc(String(printId)) + '</strong>';
    return '<!DOCTYPE html><html><head>' +
      '<title>' + esc(farmName) + ' \u2014 ' + esc(title) + '</title>' +
      '<style>' + PRINT_CSS + (extraCss ? '\n' + extraCss : '') + '</style>' +
      '</head><body>' +
      '<div class="rpt-header">' +
        '<div class="rpt-header-left">' +
          '<div class="rpt-farm">' + esc(farmName) + '</div>' +
          '<div class="rpt-title">' + esc(title) + '</div>' +
        '</div>' +
        '<div class="rpt-header-right">' + metaRight + '</div>' +
      '</div>' +
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

    // Sort fields alphabetically by name
    var sortedFields = (fields || []).slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    var body = '';

    if (sortedFields.length === 0) {
      body += '<p>No field-level input data found. Add inputs to fields in the Macro Roll-Up first.</p>';
    } else {
      sortedFields.forEach(function (field) {
        // Enrich on-the-fly if fetched via all=true (no _computed)
        var b = field._computed || (window.Calc && window.refData
          ? window.Calc.computeFieldBudget(field, window.refData, settings)
          : {});
        var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;

        body += '<h2>' + esc(field.name) + ' (' + fmtNum(acres, 1) + ' ac) — ' + esc(field.crop || '') + '</h2>';

        // Budget group subtotals table (matching field editor preview layout)
        body += '<table style="margin-bottom:0.5em">';
        body += '<thead><tr><th>Budget Category</th><th>Item</th><th class="num">/Ac</th><th class="num">Total</th></tr></thead>';
        body += '<tbody>';

        // Land group
        body += '<tr class="group-header-row"><td colspan="4">Land</td></tr>';
        body += '<tr><td></td><td>Rent</td>';
        body += '<td class="num">' + fmtMoney(b.rentPerCropAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.rentTotal) + '</td></tr>';
        body += '<tr class="subtotal-row"><td></td><td>Land Subtotal</td>';
        body += '<td class="num">' + fmtMoney(b.rentPerCropAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.rentTotal) + '</td></tr>';

        // Inputs group
        body += '<tr class="group-header-row"><td colspan="4">Inputs</td></tr>';
        body += '<tr><td></td><td>Spring Fertilizer</td>';
        body += '<td class="num">' + fmtMoney(b.springFertPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.springFertTotal) + '</td></tr>';
        body += '<tr><td></td><td>Fall Fertilizer</td>';
        body += '<td class="num">' + fmtMoney(b.fallFertPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.fallFertTotal) + '</td></tr>';
        if (b.unassignedFertPerAcre > 0) {
          body += '<tr><td></td><td>Other Inputs</td>';
          body += '<td class="num">' + fmtMoney(b.unassignedFertPerAcre) + '</td>';
          body += '<td class="num">' + fmtMoney(b.unassignedFertPerAcre * (b.effectiveAcres || 0)) + '</td></tr>';
        }
        body += '<tr><td></td><td>Seed</td>';
        body += '<td class="num">' + fmtMoney(b.seedCostPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.seedTotal) + '</td></tr>';
        var inputsSubAc = (b.totalFertPerAcre || 0) + (b.seedCostPerAcre || 0);
        var inputsSubTot = (b.totalFertCost || 0) + (b.seedTotal || 0);
        body += '<tr class="subtotal-row"><td></td><td>Inputs Subtotal</td>';
        body += '<td class="num">' + fmtMoney(inputsSubAc) + '</td>';
        body += '<td class="num">' + fmtMoney(inputsSubTot) + '</td></tr>';

        // Operations group
        body += '<tr class="group-header-row"><td colspan="4">Operations</td></tr>';
        body += '<tr><td></td><td>Machinery</td>';
        body += '<td class="num">' + fmtMoney(b.machineryPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.machineryTotal) + '</td></tr>';
        body += '<tr><td></td><td>Labor</td>';
        body += '<td class="num">' + fmtMoney(b.laborPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.laborTotal) + '</td></tr>';
        body += '<tr><td></td><td>Overhead</td>';
        body += '<td class="num">' + fmtMoney(b.overheadPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.overheadTotal) + '</td></tr>';
        body += '<tr><td></td><td>Fuel</td>';
        body += '<td class="num">' + fmtMoney(b.fuelPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.fuelTotal) + '</td></tr>';
        var opsSubAc = (b.machineryPerAcre || 0) + (b.laborPerAcre || 0) + (b.overheadPerAcre || 0) + (b.fuelPerAcre || 0);
        var opsSubTot = (b.machineryTotal || 0) + (b.laborTotal || 0) + (b.overheadTotal || 0) + (b.fuelTotal || 0);
        body += '<tr class="subtotal-row"><td></td><td>Operations Subtotal</td>';
        body += '<td class="num">' + fmtMoney(opsSubAc) + '</td>';
        body += '<td class="num">' + fmtMoney(opsSubTot) + '</td></tr>';

        // Other group
        body += '<tr class="group-header-row"><td colspan="4">Other</td></tr>';
        body += '<tr><td></td><td>Drying</td>';
        body += '<td class="num">' + fmtMoney(b.dryingPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.dryingTotal) + '</td></tr>';
        body += '<tr><td></td><td>Interest</td>';
        body += '<td class="num">' + fmtMoney(b.interestPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.interestTotal) + '</td></tr>';
        body += '<tr><td></td><td>Crop Insurance</td>';
        body += '<td class="num">' + fmtMoney(b.cropInsurancePerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.cropInsuranceTotal) + '</td></tr>';
        var otherSubAc = (b.dryingPerAcre || 0) + (b.interestPerAcre || 0) + (b.cropInsurancePerAcre || 0);
        var otherSubTot = (b.dryingTotal || 0) + (b.interestTotal || 0) + (b.cropInsuranceTotal || 0);
        body += '<tr class="subtotal-row"><td></td><td>Other Subtotal</td>';
        body += '<td class="num">' + fmtMoney(otherSubAc) + '</td>';
        body += '<td class="num">' + fmtMoney(otherSubTot) + '</td></tr>';

        // Totals
        body += '<tr class="total-row"><td colspan="2">Total Expense</td>';
        body += '<td class="num">' + fmtMoney(b.expPerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.expTotal) + '</td></tr>';

        body += '<tr><td colspan="2">Income</td>';
        body += '<td class="num">' + fmtMoney(b.cropIncomePerAcre) + '</td>';
        body += '<td class="num">' + fmtMoney(b.cropIncomeTotal) + '</td></tr>';

        var profitAc = b.profitPerAcre || 0;
        var profitTot = b.profitFarmWithoutPayments || 0;
        var profitWithPayAc = (b.profitPerAcre || 0) + (b.auxTotalPerAcre || 0);
        var profitWithPayTot = b.profitFarmWithPayments || 0;

        body += '<tr class="total-row"><td colspan="2">Profit/AC</td>';
        body += '<td class="num">' + formatPrintMoney(profitAc) + '</td>';
        body += '<td class="num">' + formatPrintMoney(profitTot) + '</td></tr>';

        body += '<tr class="total-row"><td colspan="2">Profit (w/ Payments)</td>';
        body += '<td class="num">' + formatPrintMoney(profitWithPayAc) + '</td>';
        body += '<td class="num">' + formatPrintMoney(profitWithPayTot) + '</td></tr>';

        var copClass = (b.cop || 0) > 0 && (b.pricePerUnit || 0) > 0
          ? ((b.cop > b.pricePerUnit) ? ' class="profit-neg"' : ' class="profit-pos"')
          : '';
        body += '<tr><td colspan="2">COP</td>';
        body += '<td class="num"' + copClass + '>' + fmtMoney(b.cop) + '</td>';
        body += '<td></td></tr>';

        body += '</tbody></table>';

        // Product inputs detail — read directly from field.inputs[] for actuals support
        var rawInputs = (field.inputs || []).filter(function (i) {
          return i.passStatus !== 'disregarded' && (i.productName || '').trim();
        });
        var hasConfirmed = rawInputs.some(function (i) { return i.passStatus === 'confirmed'; });

        if (rawInputs.length > 0) {
          body += '<table style="margin-top:0.25em">';
          if (hasConfirmed) {
            body += '<thead><tr><th>Product</th><th>Season</th><th>Status</th>' +
              '<th class="num">Plan/Ac</th><th class="num">Act/Ac</th><th>Unit</th>' +
              '<th class="num">Invoice $</th><th>Invoice #</th></tr></thead>';
          } else {
            body += '<thead><tr><th>Product</th><th>Season</th>' +
              '<th class="num">Rate/Ac</th><th>Unit</th></tr></thead>';
          }
          body += '<tbody>';
          rawInputs.forEach(function (inp) {
            var prod = window.refData && (window.refData.products || []).find(function (p) {
              return p.name.trim().toLowerCase() === (inp.productName || '').trim().toLowerCase();
            });
            var unit = prod ? (prod.unit || '') : '';
            var planQty = fmtNum(inp.quantity || 0, 2);
            var confirmed = inp.passStatus === 'confirmed';
            var statusChar = confirmed ? '&#10003;' : '&mdash;';
            if (hasConfirmed) {
              var actQty = confirmed ? fmtNum(inp.actualQuantity != null ? inp.actualQuantity : (inp.quantity || 0), 2) : '&mdash;';
              var invCost = confirmed && inp.invoiceCostTotal != null ? fmtMoney(inp.invoiceCostTotal) : '&mdash;';
              var invNum  = confirmed && inp.invoiceNumber ? esc(inp.invoiceNumber) : '&mdash;';
              body += '<tr' + (confirmed ? ' class="confirmed-row"' : '') + '>';
              body += '<td>' + esc(inp.productName || '') + '</td>';
              body += '<td>' + esc(inp.season || '') + '</td>';
              body += '<td style="text-align:center">' + statusChar + '</td>';
              body += '<td class="num">' + planQty + '</td>';
              body += '<td class="num">' + actQty + '</td>';
              body += '<td>' + esc(unit) + '</td>';
              body += '<td class="num">' + invCost + '</td>';
              body += '<td>' + invNum + '</td>';
              body += '</tr>';
            } else {
              body += '<tr>';
              body += '<td>' + esc(inp.productName || '') + '</td>';
              body += '<td>' + esc(inp.season || '') + '</td>';
              body += '<td class="num">' + planQty + '</td>';
              body += '<td>' + esc(unit) + '</td>';
              body += '</tr>';
            }
          });
          body += '</tbody></table>';
        }
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

  // ================================================================
  // Report 6: Crop Plan — Config modal + dynamic column report
  // ================================================================
  var CROP_PLAN_CFG_KEY = 'cropPlanConfig_v3';

  function loadCropPlanConfig() {
    try { return JSON.parse(localStorage.getItem(CROP_PLAN_CFG_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveCropPlanConfig(cfg) {
    try { localStorage.setItem(CROP_PLAN_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  function showCropPlanConfig() {
    api.get('/api/fields?all=true').then(function (fields) {
      var enterprises = (window.refData && window.refData.enterprises) || [];
      var products    = (window.refData && window.refData.products) || [];

      // Product lookup for unit hints
      var prodMap = {};
      products.forEach(function (p) { if (p.name) prodMap[p.name.trim()] = p; });

      // Enterprise → unique product names used across its fields
      var entProdMap = {};
      enterprises.forEach(function (e) { entProdMap[e.id] = {}; });
      fields.forEach(function (f) {
        if (!f.enterpriseId) return;
        if (!entProdMap[f.enterpriseId]) entProdMap[f.enterpriseId] = {};
        (f.inputs || []).forEach(function (inp) {
          if (inp.productName) entProdMap[f.enterpriseId][inp.productName] = true;
        });
      });

      // Enterprise → unique varieties (in first-seen order from fields)
      var entVarietyMap = {};
      enterprises.forEach(function (e) { entVarietyMap[e.id] = []; });
      fields.forEach(function (f) {
        if (!f.enterpriseId) return;
        var vs = [];
        if (f.seeds && f.seeds.length > 0) {
          vs = f.seeds.map(function (s) { return s.variety || ''; }).filter(Boolean);
        } else if (f.seed && f.seed.variety) {
          vs = [f.seed.variety];
        }
        if (!entVarietyMap[f.enterpriseId]) entVarietyMap[f.enterpriseId] = [];
        vs.forEach(function (v) {
          if (entVarietyMap[f.enterpriseId].indexOf(v) === -1) entVarietyMap[f.enterpriseId].push(v);
        });
      });

      // Enterprise → fields (for field planting order section)
      var entFieldMap = {};
      enterprises.forEach(function (e) { entFieldMap[e.id] = []; });
      fields.forEach(function (f) {
        if (!f.enterpriseId) return;
        if (!entFieldMap[f.enterpriseId]) entFieldMap[f.enterpriseId] = [];
        if (f.seeds && f.seeds.length > 1) {
          f.seeds.forEach(function (s) {
            var vf = Object.assign({}, f, {
              id: f.id + '::' + (s.variety || ''),
              seed: { variety: s.variety || '', population: s.population || 0 },
              seeds: [s],
              acres: s.acres > 0 ? s.acres : f.acres,
              plantedAcres: s.acres > 0 ? s.acres : (f.plantedAcres || f.acres),
            });
            entFieldMap[f.enterpriseId].push(vf);
          });
        } else {
          entFieldMap[f.enterpriseId].push(f);
        }
      });

      var config = loadCropPlanConfig();

      // Remove stale modal
      var stale = document.getElementById('crop-plan-cfg-overlay');
      if (stale) stale.parentNode.removeChild(stale);

      var overlay = document.createElement('div');
      overlay.id = 'crop-plan-cfg-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.78);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto';

      var panel = document.createElement('div');
      panel.style.cssText = 'background:var(--bg-raised,#1a1212);border:1px solid var(--border,#2a2218);border-radius:8px;padding:1.5rem;width:100%;max-width:680px';
      panel.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem">' +
          '<div>' +
            '<div style="font-size:1.05rem;font-weight:bold;color:var(--text,#e8d8c0)">Crop Plan Report</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted,#6a5a4a);margin-top:0.2rem">Select which inputs to show as columns for each enterprise. Selection is saved.</div>' +
          '</div>' +
          '<button id="cpc-x" style="background:none;border:none;color:var(--text-muted,#6a5a4a);font-size:1.4rem;line-height:1;cursor:pointer;padding:0;margin-left:1rem">&times;</button>' +
        '</div>' +
        '<div id="cpc-body"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border,#2a2218)">' +
          '<button id="cpc-cancel" style="padding:0.5rem 1.25rem;background:none;border:1px solid var(--border,#2a2218);color:var(--text,#e8d8c0);border-radius:4px;cursor:pointer;font-size:0.85rem">Cancel</button>' +
          '<button id="cpc-generate" style="padding:0.5rem 1.5rem;background:var(--primary,#C8860A);border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:0.85rem;font-weight:bold">Generate Report</button>' +
        '</div>';

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      var cpcBody = document.getElementById('cpc-body');

      var sortedEnts = enterprises.slice()
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); })
        .filter(function (e) { return Object.keys(entProdMap[e.id] || {}).length > 0; });

      // Default: include all enterprises that have fields
      if (!config.__included) {
        config.__included = sortedEnts.map(function (e) { return e.id; });
      }

      sortedEnts.forEach(function (ent) {
        var available = Object.keys(entProdMap[ent.id] || {}).sort();
        if (!config[ent.id]) config[ent.id] = [];

        var isIncluded = config.__included.indexOf(ent.id) !== -1;

        var section = document.createElement('div');
        section.style.cssText = 'margin-bottom:1rem;border:1px solid var(--border,#2a2218);border-radius:6px;overflow:hidden';

        var hdr = document.createElement('div');
        hdr.style.cssText = 'background:var(--bg-surface,#0e0c0b);padding:0.45rem 0.75rem;display:flex;align-items:center;gap:0.6rem;cursor:pointer';

        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = isIncluded;
        chk.style.cssText = 'width:14px;height:14px;cursor:pointer;accent-color:var(--accent,#C8860A)';

        var lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:0.8rem;font-weight:bold;color:var(--accent,#C8860A);text-transform:uppercase;letter-spacing:0.04em;flex:1';
        lbl.textContent = ent.name;

        hdr.appendChild(chk);
        hdr.appendChild(lbl);

        chk.addEventListener('change', function () {
          if (chk.checked) {
            if (config.__included.indexOf(ent.id) === -1) config.__included.push(ent.id);
          } else {
            config.__included = config.__included.filter(function (id) { return id !== ent.id; });
          }
        });
        hdr.addEventListener('click', function (e) {
          if (e.target !== chk) chk.click();
        });

        section.appendChild(hdr);

        var body = document.createElement('div');
        body.style.cssText = 'padding:0.75rem';

        var listEl = document.createElement('div');
        listEl.style.cssText = 'margin-bottom:0.6rem';
        body.appendChild(listEl);

        var addRow = document.createElement('div');
        addRow.style.cssText = 'display:flex;gap:0.5rem;align-items:center';

        var sel = document.createElement('select');
        sel.style.cssText = 'flex:1;font-size:0.8rem;padding:0.3rem 0.5rem;background:var(--bg,#080604);border:1px solid var(--border,#2a2218);color:var(--text,#e8d8c0);border-radius:4px';

        var addBtn = document.createElement('button');
        addBtn.textContent = '+ Add';
        addBtn.style.cssText = 'padding:0.3rem 0.85rem;background:var(--bg-surface,#0e0c0b);border:1px solid var(--border,#2a2218);color:var(--accent,#C8860A);border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap';

        addRow.appendChild(sel);
        addRow.appendChild(addBtn);
        body.appendChild(addRow);
        section.appendChild(body);
        cpcBody.appendChild(section);

        function rebuildSelect() {
          var already = config[ent.id] || [];
          sel.innerHTML = '<option value="">— add input column —</option>' +
            available
              .filter(function (p) { return already.indexOf(p) === -1; })
              .map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; })
              .join('');
        }

        function renderSelected() {
          var selected = config[ent.id] || [];
          if (selected.length === 0) {
            listEl.innerHTML = '<p style="color:var(--text-muted,#6a5a4a);font-size:0.78rem;margin:0 0 0.5rem;font-style:italic">No inputs selected — pick from the dropdown below.</p>';
          } else {
            listEl.innerHTML = selected.map(function (p, i) {
              var prod = prodMap[p.trim()];
              var unitHint = prod ? ' <span style="color:var(--text-muted,#6a5a4a);font-size:0.7rem">(' + esc(prod.unit || prod.purchaseUnit || '') + '/ac)</span>' : '';
              return '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.28rem 0.5rem;margin-bottom:0.2rem;background:var(--bg,#080604);border-radius:4px;font-size:0.82rem">' +
                '<span style="flex:1;color:var(--text,#e8d8c0)">' + esc(p) + unitHint + '</span>' +
                '<button data-eid="' + esc(ent.id) + '" data-idx="' + i + '" class="cpc-rm" style="background:none;border:none;color:var(--text-muted,#6a5a4a);cursor:pointer;font-size:1rem;line-height:1;padding:0 0.2rem">&times;</button>' +
              '</div>';
            }).join('');
            listEl.querySelectorAll('.cpc-rm').forEach(function (btn) {
              btn.addEventListener('click', function () {
                config[btn.dataset.eid].splice(parseInt(btn.dataset.idx), 1);
                renderSelected();
                rebuildSelect();
              });
            });
          }
          rebuildSelect();
        }

        addBtn.addEventListener('click', function () {
          var val = sel.value;
          if (!val) return;
          if (!config[ent.id]) config[ent.id] = [];
          if (config[ent.id].indexOf(val) === -1) config[ent.id].push(val);
          renderSelected();
        });

        renderSelected();

        // --- Variety Planting Order ---
        var entVars = entVarietyMap[ent.id] || [];
        if (entVars.length > 1) {
          var varOrderKey = '__varOrder_' + ent.id;

          // Initialize order from saved config, pruning/adding as varieties change
          if (!config[varOrderKey]) config[varOrderKey] = entVars.slice();
          entVars.forEach(function (v) {
            if (config[varOrderKey].indexOf(v) === -1) config[varOrderKey].push(v);
          });
          config[varOrderKey] = config[varOrderKey].filter(function (v) { return entVars.indexOf(v) !== -1; });

          var varSection = document.createElement('div');
          varSection.style.cssText = 'margin-top:0.75rem;padding-top:0.6rem;border-top:1px solid var(--border,#2a2218)';

          var varLabel = document.createElement('div');
          varLabel.style.cssText = 'font-size:0.72rem;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#6a5a4a);margin-bottom:0.4rem';
          varLabel.textContent = 'Variety Planting Order';
          varSection.appendChild(varLabel);

          var varHint = document.createElement('div');
          varHint.style.cssText = 'font-size:0.7rem;color:var(--text-muted,#6a5a4a);margin-bottom:0.5rem;font-style:italic';
          varHint.textContent = 'Drag ↑↓ to set the order fields print on the report.';
          varSection.appendChild(varHint);

          var varList = document.createElement('div');
          varSection.appendChild(varList);
          body.insertBefore(varSection, addRow);

          function renderVarOrder() {
            var order = config[varOrderKey];
            varList.innerHTML = order.map(function (v, i) {
              return '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.22rem 0.4rem;margin-bottom:0.2rem;background:var(--bg,#080604);border-radius:4px;font-size:0.8rem">' +
                '<span style="flex:1;color:var(--text,#e8d8c0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(v) + '</span>' +
                '<button data-vi="' + i + '" class="vor-up" title="Move earlier" style="background:none;border:1px solid var(--border,#2a2218);color:var(--accent,#C8860A);cursor:pointer;font-size:0.75rem;padding:1px 6px;border-radius:3px;line-height:1.4"' + (i === 0 ? ' disabled style="opacity:0.3;cursor:default"' : '') + '>&uarr;</button>' +
                '<button data-vi="' + i + '" class="vor-dn" title="Move later" style="background:none;border:1px solid var(--border,#2a2218);color:var(--accent,#C8860A);cursor:pointer;font-size:0.75rem;padding:1px 6px;border-radius:3px;line-height:1.4"' + (i === order.length - 1 ? ' disabled style="opacity:0.3;cursor:default"' : '') + '>&darr;</button>' +
              '</div>';
            }).join('');
            varList.querySelectorAll('.vor-up').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-vi'));
                if (i <= 0) return;
                var tmp = config[varOrderKey][i - 1];
                config[varOrderKey][i - 1] = config[varOrderKey][i];
                config[varOrderKey][i] = tmp;
                renderVarOrder();
              });
            });
            varList.querySelectorAll('.vor-dn').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var i = parseInt(btn.getAttribute('data-vi'));
                if (i >= config[varOrderKey].length - 1) return;
                var tmp = config[varOrderKey][i + 1];
                config[varOrderKey][i + 1] = config[varOrderKey][i];
                config[varOrderKey][i] = tmp;
                renderVarOrder();
              });
            });
          }
          renderVarOrder();
        }

        // --- Field Planting Order (variety-grouped, drag-and-drop) ---
        var entFields = entFieldMap[ent.id] || [];
        if (entFields.length > 1) {
          var fieldOrderKey = '__fieldOrder_' + ent.id;

          // Map each field to its primary variety key
          var fieldVarKeyMap = {};
          entFields.forEach(function (f) {
            var v = '';
            if (f.seeds && f.seeds.length > 0) v = f.seeds[0].variety || '';
            else if (f.seed) v = f.seed.variety || '';
            fieldVarKeyMap[f.id] = v || '__none__';
          });

          // Variety order key — shared with the Variety Planting Order section above
          var foVarOrderKey = '__varOrder_' + ent.id;

          // Named variety order: read saved config first, fall back to discovery order
          var namedVars = entVarietyMap[ent.id] || [];
          var savedVarArr = (config[foVarOrderKey] || []).filter(function (v) { return namedVars.indexOf(v) !== -1; });
          namedVars.forEach(function (v) { if (savedVarArr.indexOf(v) === -1) savedVarArr.push(v); });
          // groupVarOrder is mutable — arrow clicks splice it and write back to config
          var groupVarOrder = savedVarArr.slice();
          var hasNoVar = entFields.some(function (f) { return fieldVarKeyMap[f.id] === '__none__'; });
          // __none__ always appended last and is not reorderable

          // Colors tied to original discovery index so they stay stable when user reorders
          var VAR_PALETTE = ['#cce5cc','#cce0f0','#f5e4b8','#e2cff0','#f0cccc','#c8f0e4','#f0e8cc','#ccd0f0','#f0cce4','#ccf0d8','#f0d8cc','#ccecf0'];
          var groupColorMap = { '__none__': '#e8e8e8' };
          namedVars.forEach(function (v, i) { groupColorMap[v] = VAR_PALETTE[i % VAR_PALETTE.length]; });

          // Init / prune saved order
          var savedFieldIds = (config[fieldOrderKey] || []).filter(function (id) {
            return entFields.some(function (f) { return f.id === id; });
          });
          var unseenFields = entFields.filter(function (f) {
            return savedFieldIds.indexOf(f.id) === -1;
          }).sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
          config[fieldOrderKey] = savedFieldIds.concat(unseenFields.map(function (f) { return f.id; }));

          var fieldIdMap = {};
          entFields.forEach(function (f) { fieldIdMap[f.id] = f; });

          // Full ordered key list for iteration: named varieties (user-ordered) + __none__ last
          function allGroupKeys() {
            return groupVarOrder.concat(hasNoVar ? ['__none__'] : []);
          }

          // Build variety-grouped structure from flat order
          function buildVarGroups() {
            var groups = {};
            allGroupKeys().forEach(function (vk) { groups[vk] = []; });
            config[fieldOrderKey].forEach(function (id) {
              var vk = fieldVarKeyMap[id] || '__none__';
              if (!groups[vk]) groups[vk] = [];
              groups[vk].push(id);
            });
            return groups;
          }

          // Flatten groups back to a single ordered array
          function flattenVarGroups(groups) {
            var flat = [];
            allGroupKeys().forEach(function (vk) {
              (groups[vk] || []).forEach(function (id) { flat.push(id); });
            });
            return flat;
          }

          var fieldSection = document.createElement('div');
          fieldSection.style.cssText = 'margin-top:0.75rem;padding-top:0.6rem;border-top:1px solid var(--border,#2a2218)';

          var fieldLabel = document.createElement('div');
          fieldLabel.style.cssText = 'font-size:0.72rem;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#6a5a4a);margin-bottom:0.25rem';
          fieldLabel.textContent = 'Field Planting Order';
          fieldSection.appendChild(fieldLabel);

          var fieldHint = document.createElement('div');
          fieldHint.style.cssText = 'font-size:0.7rem;color:var(--text-muted,#6a5a4a);margin-bottom:0.5rem;font-style:italic';
          fieldHint.textContent = 'Drag fields within each variety group to set planting order.';
          fieldSection.appendChild(fieldHint);

          var fieldListContainer = document.createElement('div');
          fieldSection.appendChild(fieldListContainer);
          body.appendChild(fieldSection);

          // Drag state — shared across re-renders via closure
          var dnd = { id: null, variety: null };

          function renderFieldOrder() {
            var groups = buildVarGroups();
            fieldListContainer.innerHTML = '';

            allGroupKeys().forEach(function (vk) {
              var groupIds = groups[vk];
              if (!groupIds || groupIds.length === 0) return;

              var vLabel = vk !== '__none__' ? vk : 'No Variety';
              var vColor = groupColorMap[vk];
              var isNamed = vk !== '__none__';
              var vIdx = isNamed ? groupVarOrder.indexOf(vk) : -1;

              // Variety group header row: colored chip + optional ↑↓ buttons
              var chipRow = document.createElement('div');
              chipRow.style.cssText = 'display:flex;align-items:center;gap:0.3rem;margin-bottom:4px';

              var chip = document.createElement('span');
              chip.style.cssText = 'font-size:0.68rem;font-weight:bold;padding:2px 7px;border-radius:3px;color:#1a1a1a;background:' + vColor;
              chip.textContent = vLabel + ' \u2014 ' + groupIds.length + ' field' + (groupIds.length !== 1 ? 's' : '');
              chipRow.appendChild(chip);

              if (isNamed) {
                var btnStyle = 'background:none;border:1px solid var(--border,#2a2218);color:var(--accent,#C8860A);cursor:pointer;font-size:0.7rem;padding:1px 5px;border-radius:3px;line-height:1.3';
                var upBtn = document.createElement('button');
                upBtn.innerHTML = '\u2191';
                upBtn.title = 'Move variety earlier in planting order';
                upBtn.style.cssText = btnStyle + (vIdx === 0 ? ';opacity:0.3;cursor:default' : '');
                upBtn.disabled = vIdx === 0;
                upBtn.addEventListener('click', function () {
                  var i = groupVarOrder.indexOf(vk);
                  if (i <= 0) return;
                  var tmp = groupVarOrder[i - 1];
                  groupVarOrder[i - 1] = groupVarOrder[i];
                  groupVarOrder[i] = tmp;
                  config[foVarOrderKey] = groupVarOrder.slice();
                  renderFieldOrder();
                });
                var dnBtn = document.createElement('button');
                dnBtn.innerHTML = '\u2193';
                dnBtn.title = 'Move variety later in planting order';
                dnBtn.style.cssText = btnStyle + (vIdx === groupVarOrder.length - 1 ? ';opacity:0.3;cursor:default' : '');
                dnBtn.disabled = vIdx === groupVarOrder.length - 1;
                dnBtn.addEventListener('click', function () {
                  var i = groupVarOrder.indexOf(vk);
                  if (i >= groupVarOrder.length - 1) return;
                  var tmp = groupVarOrder[i + 1];
                  groupVarOrder[i + 1] = groupVarOrder[i];
                  groupVarOrder[i] = tmp;
                  config[foVarOrderKey] = groupVarOrder.slice();
                  renderFieldOrder();
                });
                chipRow.appendChild(upBtn);
                chipRow.appendChild(dnBtn);
              }
              fieldListContainer.appendChild(chipRow);

              // Drop zone container for this variety
              var zoneEl = document.createElement('div');
              zoneEl.setAttribute('data-zone', vk);
              zoneEl.style.cssText = 'margin-bottom:0.55rem;border:1px solid var(--border,#2a2218);border-radius:4px;padding:2px;min-height:30px';
              fieldListContainer.appendChild(zoneEl);

              groupIds.forEach(function (id) {
                var f = fieldIdMap[id];
                if (!f) return;
                var acres = ((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

                var row = document.createElement('div');
                row.setAttribute('draggable', 'true');
                row.setAttribute('data-drag-id', id);
                row.style.cssText = [
                  'display:flex;align-items:center;gap:0.4rem',
                  'padding:0.22rem 0.5rem;margin-bottom:2px',
                  'background:var(--bg,#080604);border-radius:4px',
                  'font-size:0.8rem;cursor:grab;user-select:none',
                  'border:1px solid transparent;transition:border-color 0.1s',
                ].join(';');
                row.innerHTML =
                  '<span style="color:var(--text-muted,#6a5a4a);font-size:0.8rem;line-height:1;flex-shrink:0">\u283f</span>' +
                  '<span style="flex:1;color:var(--text,#e8d8c0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(f.name || id) + '</span>' +
                  '<span style="color:var(--text-muted,#6a5a4a);font-size:0.72rem;flex-shrink:0">' + acres + ' ac</span>';

                row.addEventListener('dragstart', function (e) {
                  dnd.id = id;
                  dnd.variety = vk;
                  e.dataTransfer.effectAllowed = 'move';
                  setTimeout(function () { row.style.opacity = '0.35'; }, 0);
                });
                row.addEventListener('dragend', function () {
                  row.style.opacity = '';
                  // Clear any lingering indicators
                  fieldListContainer.querySelectorAll('[data-zone]').forEach(function (z) {
                    z.style.borderColor = 'var(--border,#2a2218)';
                  });
                  fieldListContainer.querySelectorAll('[data-drag-id]').forEach(function (r) {
                    r.style.borderColor = 'transparent';
                  });
                });
                row.addEventListener('dragenter', function (e) {
                  if (dnd.variety !== vk || dnd.id === id) return;
                  e.preventDefault();
                  row.style.borderTopColor = 'var(--accent,#C8860A)';
                });
                row.addEventListener('dragleave', function () {
                  row.style.borderTopColor = 'transparent';
                });
                row.addEventListener('dragover', function (e) {
                  if (dnd.variety !== vk) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                });
                row.addEventListener('drop', function (e) {
                  e.preventDefault();
                  row.style.borderTopColor = 'transparent';
                  if (!dnd.id || dnd.variety !== vk || dnd.id === id) return;
                  var g = buildVarGroups();
                  var grp = g[vk];
                  var from = grp.indexOf(dnd.id);
                  var to   = grp.indexOf(id);
                  if (from !== -1 && to !== -1) {
                    grp.splice(from, 1);
                    grp.splice(to, 0, dnd.id);
                    g[vk] = grp;
                    config[fieldOrderKey] = flattenVarGroups(g);
                  }
                  dnd.id = null; dnd.variety = null;
                  renderFieldOrder();
                });

                zoneEl.appendChild(row);
              });

              // Drop at end of group (empty space below last row)
              zoneEl.addEventListener('dragover', function (e) {
                if (dnd.variety !== vk) return;
                e.preventDefault();
                zoneEl.style.borderColor = 'var(--accent,#C8860A)';
              });
              zoneEl.addEventListener('dragleave', function () {
                zoneEl.style.borderColor = 'var(--border,#2a2218)';
              });
              zoneEl.addEventListener('drop', function (e) {
                e.preventDefault();
                zoneEl.style.borderColor = 'var(--border,#2a2218)';
                if (!dnd.id || dnd.variety !== vk) return;
                var g = buildVarGroups();
                var grp = g[vk];
                var from = grp.indexOf(dnd.id);
                if (from !== -1) {
                  grp.splice(from, 1);
                  grp.push(dnd.id);
                  g[vk] = grp;
                  config[fieldOrderKey] = flattenVarGroups(g);
                }
                dnd.id = null; dnd.variety = null;
                renderFieldOrder();
              });
            });
          }
          renderFieldOrder();
        }
      });

      if (sortedEnts.length === 0) {
        cpcBody.innerHTML = '<p style="color:var(--text-muted,#6a5a4a);font-size:0.85rem">No enterprises with fields found.</p>';
      }

      function closeModal() {
        var el = document.getElementById('crop-plan-cfg-overlay');
        if (el) el.parentNode.removeChild(el);
      }

      document.getElementById('cpc-x').addEventListener('click', closeModal);
      document.getElementById('cpc-cancel').addEventListener('click', closeModal);

      document.getElementById('cpc-generate').addEventListener('click', function () {
        saveCropPlanConfig(config);
        // Increment print revision counter
        var rev = parseInt(localStorage.getItem('cropPlanPrintRev') || '0', 10) + 1;
        localStorage.setItem('cropPlanPrintRev', String(rev));
        config.__printRev = rev;
        closeModal();
        var win = window.open('', '_blank');
        if (!win) { util.showToast('Enable popups to print reports', 4000, 'error'); return; }
        win.document.write('<!DOCTYPE html><html><head><title>Loading...</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#666}</style></head><body><p>Building crop plan...</p></body></html>');
        Promise.all([
          api.get('/api/fields?all=true'),
          api.get('/api/settings')
        ]).then(function (res) {
          var html = buildCropPlanReport(res[0], res[1], config);
          win.document.open();
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
        }).catch(function (err) {
          win.document.open();
          win.document.write('<!DOCTYPE html><html><head><title>Error</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#c00}</style></head><body><h1>Report failed</h1><p>' + esc(err.message) + '</p></body></html>');
          win.document.close();
        });
      });

    }).catch(function (err) {
      util.showToast('Failed to load fields: ' + err.message, 4000, 'error');
    });
  }

  function buildCropPlanReport(fields, settings, config) {
    config = config || {};
    var year = getYear();
    var farmName = getFarmName(settings);
    var title = 'Crop Plan by Enterprise \u2014 ' + year;

    var enterprises = (window.refData && window.refData.enterprises) || [];
    var seedRefs    = (window.refData && window.refData.seeds) || [];
    var products    = (window.refData && window.refData.products) || [];

    var entMap = {};
    enterprises.forEach(function (e) { entMap[e.id] = e; });

    var seedMap = {};
    seedRefs.forEach(function (s) {
      if (s.variety) seedMap[s.variety.trim().toLowerCase()] = s;
    });

    var prodMap = {};
    products.forEach(function (p) { if (p.name) prodMap[p.name.trim()] = p; });

    // Group fields by enterprise
    var entGroups = {}, entOrder = [];
    (fields || []).forEach(function (f) {
      var key = f.enterpriseId || '__none__';
      if (!entGroups[key]) { entGroups[key] = []; entOrder.push(key); }
      entGroups[key].push(f);
    });
    entOrder.sort(function (a, b) {
      return (entMap[a] ? entMap[a].name : a).localeCompare(entMap[b] ? entMap[b].name : b);
    });

    // Filter to only included enterprises
    var included = config.__included;
    if (included && included.length > 0) {
      entOrder = entOrder.filter(function (id) { return included.indexOf(id) !== -1; });
    }

    // Assign a distinct pastel color to each unique seed variety (consistent across enterprises)
    var VARIETY_PALETTE = [
      '#cce5cc', // sage green
      '#cce0f0', // sky blue
      '#f5e4b8', // amber wheat
      '#e2cff0', // lavender
      '#f0cccc', // rose
      '#c8f0e4', // mint
      '#f0e8cc', // cream
      '#ccd0f0', // periwinkle
      '#f0cce4', // blush pink
      '#ccf0d8', // light green
      '#f0d8cc', // peach
      '#ccecf0', // pale teal
    ];
    var varietyColorMap = {};
    var colorIdx = 0;
    entOrder.forEach(function (entId) {
      (entGroups[entId] || []).forEach(function (f) {
        var vs = [];
        if (f.seeds && f.seeds.length > 0) {
          vs = f.seeds.map(function (s) { return s.variety || ''; }).filter(Boolean);
        } else if (f.seed && f.seed.variety) {
          vs = [f.seed.variety];
        }
        vs.forEach(function (v) {
          if (!varietyColorMap[v]) {
            varietyColorMap[v] = VARIETY_PALETTE[colorIdx % VARIETY_PALETTE.length];
            colorIdx++;
          }
        });
      });
    });

    var body = '';

    entOrder.forEach(function (entId) {
      var ent = entMap[entId];
      var entName = ent ? ent.name : 'Unassigned';
      var selectedInputs = config[entId] || [];
      var varOrderKey = '__varOrder_' + entId;
      var savedVarOrder = config[varOrderKey] || [];

      // All fields for this enterprise sorted by name within each variety group
      var allFields = entGroups[entId].slice();

      // Group fields by variety — multi-seed fields produce one virtual row per seed
      var varGroups = {};  // variety key → { variety, fields[] }
      allFields.forEach(function (f) {
        if (f.seeds && f.seeds.length > 1) {
          // Field has multiple varieties: expand into one virtual row per seed
          f.seeds.forEach(function (s) {
            var v = s.variety || '';
            var key = v || '__none__';
            if (!varGroups[key]) varGroups[key] = { variety: v, fields: [] };
            var seedAcres = s.acres > 0 ? s.acres : 0;
            var virtualField = Object.assign({}, f, {
              id: f.id + '::' + (s.variety || ''),
              seed: { variety: s.variety || '', population: s.population || 0 },
              seeds: [s],
              acres: seedAcres || f.acres,
              plantedAcres: seedAcres || f.plantedAcres || f.acres,
            });
            varGroups[key].fields.push(virtualField);
          });
        } else {
          var v = '';
          if (f.seeds && f.seeds.length > 0) v = f.seeds[0].variety || '';
          else if (f.seed) v = f.seed.variety || '';
          var key = v || '__none__';
          if (!varGroups[key]) varGroups[key] = { variety: v, fields: [] };
          varGroups[key].fields.push(f);
        }
      });
      // Sort fields within each variety group by saved planting order, falling back to alphabetical
      var fieldOrderKey = '__fieldOrder_' + entId;
      var savedFieldOrder = config[fieldOrderKey] || [];
      var fieldOrderMap = {};
      savedFieldOrder.forEach(function (id, i) { fieldOrderMap[id] = i; });
      Object.keys(varGroups).forEach(function (k) {
        varGroups[k].fields.sort(function (a, b) {
          var ai = fieldOrderMap[a.id] !== undefined ? fieldOrderMap[a.id] : 9999;
          var bi = fieldOrderMap[b.id] !== undefined ? fieldOrderMap[b.id] : 9999;
          return ai !== bi ? ai - bi : (a.name || '').localeCompare(b.name || '');
        });
      });

      // Build ordered variety list from saved order, then append any not listed
      var orderedVarietyKeys = [];
      savedVarOrder.forEach(function (v) {
        if (varGroups[v]) orderedVarietyKeys.push(v);
      });
      Object.keys(varGroups).forEach(function (k) {
        if (k !== '__none__' && orderedVarietyKeys.indexOf(k) === -1) orderedVarietyKeys.push(k);
      });
      if (varGroups['__none__']) orderedVarietyKeys.push('__none__');

      // Total column count: Field | Crop Ac | Tillage | Pop | Seed Units | [inputs]
      var totalCols = 5 + selectedInputs.length;

      // Reusable column header builder — used in every variety table's <thead>
      function colHeadersHtml(varietyLabel, vColor) {
        var html = '';
        // Row 1: variety name + enterprise context (both repeat on every page of this table)
        html += '<tr style="-webkit-print-color-adjust:exact;print-color-adjust:exact;background:' + vColor + '">' +
          '<th colspan="' + totalCols + '" style="background:' + vColor + ';color:#1a1a1a;text-align:left;' +
          'font-size:9pt;font-weight:bold;padding:5px 8px;border:1px solid #aaa;letter-spacing:0.02em;' +
          '-webkit-print-color-adjust:exact;print-color-adjust:exact">' +
          varietyLabel +
          '<span style="font-size:7pt;font-weight:normal;color:#555;margin-left:10px">' +
          esc(entName.toUpperCase()) + '</span></th></tr>';
        // Row 2: column labels
        html += '<tr>';
        html += '<th>Field</th>';
        html += '<th class="num">Crop Ac</th>';
        html += '<th>Tillage</th>';
        html += '<th class="num">Population<br>(seeds/ac)</th>';
        html += '<th class="num">Seed Units<br>Needed</th>';
        selectedInputs.forEach(function (prodName) {
          var prod = prodMap[prodName.trim()];
          var unitLabel = prod ? esc(prod.unit || '') + '/ac' : '/ac';
          html += '<th class="num" style="font-size:8.5pt">' + esc(prodName) +
                  '<br><span style="font-weight:normal;font-size:7pt">(' + unitLabel + ')</span></th>';
        });
        html += '</tr>';
        return html;
      }

      body += '<h2>' + esc(entName) + '</h2>';

      var entTotalAcres = 0, entTotalSeedUnits = 0;
      var entInputTotals = {}, entInputAcres = {};
      selectedInputs.forEach(function (p) { entInputTotals[p] = 0; entInputAcres[p] = 0; });

      // Each variety group gets its own <table> with its own <thead>
      // so column + variety headers repeat natively on every printed page
      orderedVarietyKeys.forEach(function (vKey) {
        var group = varGroups[vKey];
        if (!group) return;
        var variety = group.variety;
        var vColor = variety ? (varietyColorMap[variety] || '#e8e8e8') : '#e8e8e8';

        var groupAcres = group.fields.reduce(function (s, f) {
          return s + ((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0);
        }, 0);
        var fieldCount = group.fields.length;
        var varietyLabel = variety
          ? esc(variety) + ' <span style="font-weight:normal;font-size:7.5pt;color:#333">' +
            '(' + fieldCount + ' field' + (fieldCount !== 1 ? 's' : '') + ', ' + fmtNum(groupAcres, 1) + ' ac)</span>'
          : 'No Variety Assigned';

        body += '<table style="margin-bottom:0.5em">';
        body += '<thead style="display:table-header-group">';
        body += colHeadersHtml(varietyLabel, vColor);
        body += '</thead>';
        body += '<tfoot style="display:table-footer-group">';  // empty footer keeps spacing consistent
        body += '</tfoot>';
        body += '<tbody>';

        var varTotalAcres = 0, varTotalSeedUnits = 0;
        var varInputTotals = {}, varInputAcres = {};
        selectedInputs.forEach(function (p) { varInputTotals[p] = 0; varInputAcres[p] = 0; });

        group.fields.forEach(function (f) {
          var acres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
          var tillage = f.tillage || 'Till';
          var inputs = f.inputs || [];
          var population = 0;
          if (f.seeds && f.seeds.length > 0) {
            var matchSeed = f.seeds.find(function (s) { return s.variety === variety; });
            population = matchSeed ? (matchSeed.population || 0) : (f.seeds[0].population || 0);
          } else if (f.seed) {
            population = f.seed.population || 0;
          }

          var seedUnits = 0;
          if (population > 0 && acres > 0 && variety) {
            var sr = seedMap[variety.trim().toLowerCase()];
            var spu = sr ? (sr.seedsPerUnit || 0) : 0;
            if (spu > 0) seedUnits = Math.ceil(population * acres / spu);
          }

          varTotalAcres += acres;
          varTotalSeedUnits += seedUnits;
          entTotalAcres += acres;
          entTotalSeedUnits += seedUnits;

          body += '<tr>';
          body += '<td>' + esc(f.name || '') + '</td>';
          body += '<td class="num">' + fmtNum(acres, 1) + '</td>';
          body += '<td>' + esc(tillage) + '</td>';
          body += '<td class="num">' + (population > 0 ? fmtNum(population, 0) : '\u2014') + '</td>';
          body += '<td class="num">' + (seedUnits > 0 ? fmtNum(seedUnits, 2) : '\u2014') + '</td>';

          selectedInputs.forEach(function (prodName) {
            var rate = 0;
            inputs.forEach(function (inp) {
              if ((inp.productName || '').trim() === prodName.trim()) rate += inp.quantity || 0;
            });
            var fieldTotal = rate * acres;
            varInputTotals[prodName] += fieldTotal;
            entInputTotals[prodName] += fieldTotal;
            if (rate > 0) {
              varInputAcres[prodName] += acres;
              entInputAcres[prodName] += acres;
              var prod = prodMap[prodName.trim()];
              var appUnit = prod ? (prod.unit || '') : '';
              var convRate = prod ? (prod.conversionRate || 1) : 1;
              var purchUnit = prod ? (prod.purchaseUnit || appUnit) : appUnit;
              var showBilled = convRate > 1 && purchUnit && purchUnit !== appUnit;
              body += '<td class="num" style="font-size:8.5pt">' +
                fmtNum(rate, 0) + (appUnit ? ' ' + appUnit : '') + '/ac' +
                '<br><span style="font-weight:normal;font-size:7.5pt">' +
                fmtNum(fieldTotal, 0) + (appUnit ? ' ' + appUnit : '') + '</span>' +
                (showBilled ? '<br><span style="font-weight:normal;font-size:7pt;color:#666">' +
                  fmtNum(fieldTotal / convRate, 2) + ' ' + purchUnit + '</span>' : '') +
                '</td>';
            } else {
              body += '<td class="num">\u2014</td>';
            }
          });

          body += '</tr>';

          // Field note row
          if (f.notes && f.notes.trim()) {
            body += '<tr style="background:#fffde8 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact">' +
              '<td colspan="' + totalCols + '" style="font-size:7.5pt;font-style:italic;color:#555;' +
              'padding:2px 8px 4px 22px;border-top:1px dashed #ccc;background:#fffde8;' +
              '-webkit-print-color-adjust:exact;print-color-adjust:exact">' +
              '\u21b3 ' + esc(f.notes.trim()) + '</td></tr>';
          }
        });

        // Variety subtotal row (only if more than one field)
        if (group.fields.length > 1) {
          body += '<tr class="subtotal-row">';
          body += '<td style="font-size:7.5pt"><em>' + esc(variety || 'No Variety') + ' subtotal</em></td>';
          body += '<td class="num">' + fmtNum(varTotalAcres, 1) + '</td>';
          body += '<td></td><td></td>';
          body += '<td class="num">' + (varTotalSeedUnits > 0 ? fmtNum(varTotalSeedUnits, 2) : '\u2014') + '</td>';
          selectedInputs.forEach(function (prodName) {
            var total = varInputTotals[prodName] || 0;
            var iAc   = varInputAcres[prodName] || 0;
            var prod  = prodMap[prodName.trim()];
            if (total > 0 && iAc > 0) {
              var appUnit = prod ? (prod.unit || '') : '';
              var convRate = prod ? (prod.conversionRate || 1) : 1;
              var purchUnit = prod ? (prod.purchaseUnit || appUnit) : appUnit;
              var showBilled = convRate > 1 && purchUnit && purchUnit !== appUnit;
              body += '<td class="num" style="font-size:8pt">' +
                fmtNum(total / iAc, 0) + (appUnit ? ' ' + appUnit : '') + '/ac' +
                '<br><span style="font-weight:normal;font-size:7.5pt">' +
                fmtNum(total, 0) + (appUnit ? ' ' + appUnit : '') + ' total</span>' +
                (showBilled ? '<br><span style="font-weight:normal;font-size:7pt;color:#666">' +
                  fmtNum(total / convRate, 2) + ' ' + purchUnit + ' total</span>' : '') +
                '</td>';
            } else {
              body += '<td class="num">\u2014</td>';
            }
          });
          body += '</tr>';
        }

        body += '</tbody></table>';
      });

      // --- Enterprise grand total — separate small table so it always sits below all variety tables ---
      body += '<table style="margin-top:0.2em;margin-bottom:1.4em"><tbody>';
      body += '<tr class="total-row">';
      body += '<td><strong>' + esc(entName) + ' Total</strong></td>';
      body += '<td class="num"><strong>' + fmtNum(entTotalAcres, 1) + '</strong></td>';
      body += '<td></td><td></td>';
      body += '<td class="num"><strong>' + (entTotalSeedUnits > 0 ? fmtNum(entTotalSeedUnits, 2) : '\u2014') + '</strong></td>';
      selectedInputs.forEach(function (prodName) {
        var total = entInputTotals[prodName] || 0;
        var iAc   = entInputAcres[prodName]  || 0;
        var prod  = prodMap[prodName.trim()];
        var cell  = '\u2014';
        if (total > 0 && iAc > 0) {
          var appUnit = prod ? (prod.unit || '') : '';
          var convRate = prod ? (prod.conversionRate || 1) : 1;
          var purchUnit = prod ? (prod.purchaseUnit || appUnit) : appUnit;
          var showBilled = convRate > 1 && purchUnit && purchUnit !== appUnit;
          cell = fmtNum(total / iAc, 0) + (appUnit ? ' ' + appUnit : '') + '/ac' +
                 '<br><span style="font-weight:normal;font-size:7.5pt">' +
                 fmtNum(total, 0) + (appUnit ? ' ' + appUnit : '') + ' total</span>' +
                 (showBilled ? '<br><span style="font-weight:normal;font-size:7pt;color:#666">' +
                   fmtNum(total / convRate, 2) + ' ' + purchUnit + ' total</span>' : '');
        }
        body += '<td class="num" style="font-size:8.5pt">' + cell + '</td>';
      });
      body += '</tr>';
      body += '</tbody></table>';
    });

    if (entOrder.length === 0) {
      body += '<p>No fields found. Add fields to enterprises in the Field Editor first.</p>';
    }

    // Landscape for wide input tables — override page size and tighten font
    return reportWrapper(title, farmName, body,
      '@page { size: letter landscape; margin: 0.65in 0.65in 0.75in 0.65in; }' +
      'th { font-size: 7.5pt; } td { font-size: 8pt; }' +
      '.group-header-row td { background-color: inherit !important; }',
      config.__printRev || null);
  }


  // ================================================================
  // Report 7: Field History Report — per-field ops, yield & history
  // ================================================================

  function showFieldHistoryConfig() {
    api.get('/api/fields?all=true').then(function (fields) {
      var enterprises = (window.refData && window.refData.enterprises) || [];
      var entMap = {};
      enterprises.forEach(function (e) { entMap[e.id] = e; });

      // Group fields by enterprise, sorted
      var entOrder = [];
      var entFields = {};
      enterprises.forEach(function (e) { entFields[e.id] = []; });
      fields.forEach(function (f) {
        if (f.enterpriseId && entFields[f.enterpriseId]) entFields[f.enterpriseId].push(f);
      });
      entOrder = enterprises
        .filter(function (e) { return (entFields[e.id] || []).length > 0; })
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); })
        .map(function (e) { return e.id; });
      entOrder.forEach(function (id) {
        entFields[id].sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
      });

      var stale = document.getElementById('fh-cfg-overlay');
      if (stale) stale.parentNode.removeChild(stale);

      var overlay = document.createElement('div');
      overlay.id = 'fh-cfg-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.78);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto';

      var panel = document.createElement('div');
      panel.style.cssText = 'background:var(--bg-raised,#1a1212);border:1px solid var(--border,#2a2218);border-radius:8px;padding:1.5rem;width:100%;max-width:480px';

      var bodyHtml =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem">' +
          '<div>' +
            '<div style="font-size:1.05rem;font-weight:bold;color:var(--text,#e8d8c0)">Field History Report</div>' +
            '<div style="font-size:0.78rem;color:var(--text-muted,#6a5a4a);margin-top:0.2rem">Select fields to include &mdash; one page per field.</div>' +
          '</div>' +
          '<button id="fh-cfg-x" style="background:none;border:none;color:var(--text-muted,#6a5a4a);font-size:1.4rem;line-height:1;cursor:pointer;padding:0;margin-left:1rem">&times;</button>' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;margin-bottom:0.6rem">' +
          '<button id="fh-check-all" style="font-size:0.72rem;padding:0.18rem 0.5rem;background:none;border:1px solid var(--border,#2a2218);color:var(--text,#e8d8c0);border-radius:3px;cursor:pointer">Select All</button>' +
          '<button id="fh-uncheck-all" style="font-size:0.72rem;padding:0.18rem 0.5rem;background:none;border:1px solid var(--border,#2a2218);color:var(--text,#e8d8c0);border-radius:3px;cursor:pointer">Clear All</button>' +
        '</div>' +
        '<div id="fh-field-list" style="max-height:52vh;overflow-y:auto;border:1px solid var(--border,#2a2218);border-radius:4px;padding:0.5rem 0.6rem">';

      entOrder.forEach(function (entId) {
        var ent = entMap[entId] || {};
        bodyHtml +=
          '<div style="margin-bottom:0.7rem">' +
          '<div style="font-size:0.69rem;font-weight:bold;color:var(--primary,#C8860A);text-transform:uppercase;letter-spacing:0.05em;padding:0.18rem 0.25rem;background:rgba(200,134,10,0.08);border-radius:3px;margin-bottom:0.25rem">' +
          esc(ent.name || entId) + '</div>';
        entFields[entId].forEach(function (f) {
          var ac = f.plantedAcres > 0 ? f.plantedAcres : (f.acres || 0);
          bodyHtml +=
            '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.18rem 0.25rem;cursor:pointer;font-size:0.82rem;color:var(--text,#e8d8c0)">' +
            '<input type="checkbox" class="fh-field-cb" data-field-id="' + esc(f.id) + '" checked style="accent-color:var(--primary,#C8860A)">' +
            esc(f.name) +
            '<span style="font-size:0.68rem;color:var(--text-muted,#6a5a4a);margin-left:auto">' + fmtNum(ac, 1) + ' ac &middot; ' + esc(f.crop || '—') + '</span>' +
            '</label>';
        });
        bodyHtml += '</div>';
      });

      bodyHtml +=
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.1rem;padding-top:1rem;border-top:1px solid var(--border,#2a2218)">' +
          '<button id="fh-cfg-cancel" style="padding:0.45rem 1.1rem;background:none;border:1px solid var(--border,#2a2218);color:var(--text,#e8d8c0);border-radius:4px;cursor:pointer;font-size:0.85rem">Cancel</button>' +
          '<button id="fh-cfg-generate" style="padding:0.45rem 1.4rem;background:var(--primary,#C8860A);border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:0.85rem;font-weight:bold">Generate Report</button>' +
        '</div>';

      panel.innerHTML = bodyHtml;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      function closeModal() { overlay.parentNode && overlay.parentNode.removeChild(overlay); }
      document.getElementById('fh-cfg-x').addEventListener('click', closeModal);
      document.getElementById('fh-cfg-cancel').addEventListener('click', closeModal);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });

      document.getElementById('fh-check-all').addEventListener('click', function () {
        overlay.querySelectorAll('.fh-field-cb').forEach(function (cb) { cb.checked = true; });
      });
      document.getElementById('fh-uncheck-all').addEventListener('click', function () {
        overlay.querySelectorAll('.fh-field-cb').forEach(function (cb) { cb.checked = false; });
      });

      document.getElementById('fh-cfg-generate').addEventListener('click', function () {
        var selectedIds = [];
        overlay.querySelectorAll('.fh-field-cb:checked').forEach(function (cb) {
          selectedIds.push(cb.getAttribute('data-field-id'));
        });
        if (!selectedIds.length) { util.showToast('Select at least one field', 3000, 'error'); return; }
        closeModal();
        doPrintFieldHistory(fields, selectedIds);
      });

    }).catch(function (err) {
      util.showToast('Failed to load fields: ' + err.message, 4000, 'error');
    });
  }

  function doPrintFieldHistory(allFields, selectedIds) {
    var win = window.open('', '_blank');
    if (!win) { util.showToast('Enable popups to print reports', 4000, 'error'); return; }
    win.document.write('<!DOCTYPE html><html><head><title>Loading...</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#666}</style></head><body><p>Loading field history report...</p></body></html>');

    api.get('/api/settings').then(function (settings) {
      var html = buildFieldHistoryReport(allFields, settings, selectedIds);
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }).catch(function (err) {
      win.document.open();
      win.document.write('<!DOCTYPE html><html><head><title>Error</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#c00}</style></head><body><h1>Failed to generate report</h1><p>' + esc(err.message) + '</p></body></html>');
      win.document.close();
    });
  }

  function buildFieldHistoryReport(allFields, settings, selectedIds) {
    var farmName = getFarmName(settings);
    var year = getYear();
    var title = 'Field History Report \u2014 ' + year;
    var enterprises = (window.refData && window.refData.enterprises) || [];
    var entMap = {};
    enterprises.forEach(function (e) { entMap[e.id] = e; });
    var refs = window.refData || {};

    var selectedFields = allFields.filter(function (f) {
      return selectedIds.indexOf(f.id) !== -1;
    }).sort(function (a, b) {
      var ea = entMap[a.enterpriseId] ? (entMap[a.enterpriseId].name || '') : '';
      var eb = entMap[b.enterpriseId] ? (entMap[b.enterpriseId].name || '') : '';
      return ea !== eb ? ea.localeCompare(eb) : (a.name || '').localeCompare(b.name || '');
    });

    if (!selectedFields.length) return reportWrapper(title, farmName, '<p>No fields selected.</p>');

    var body = '';
    selectedFields.forEach(function (field, idx) {
      var isLast = idx === selectedFields.length - 1;
      var ent = entMap[field.enterpriseId] || {};
      var acres = field.plantedAcres > 0 ? field.plantedAcres : (field.acres || 0);

      body += '<div' + (isLast ? '' : ' style="page-break-after:always"') + '>';

      // Field header
      body +=
        '<div style="border-bottom:2px solid #2c2c2c;padding-bottom:6px;margin-bottom:12px">' +
          '<div style="font-size:12pt;font-weight:bold">' + esc(field.name) + '</div>' +
          '<div style="font-size:8.5pt;color:#555;margin-top:2px">' +
            esc(ent.name || 'No Enterprise') + ' &nbsp;&bull;&nbsp; ' +
            esc(field.crop || '—') + ' &nbsp;&bull;&nbsp; ' +
            fmtNum(acres, 1) + ' ac &nbsp;&bull;&nbsp; ' +
            esc(field.systemCode || '') +
            (field.registryFieldName ? ' &nbsp;&bull;&nbsp; Registry: ' + esc(field.registryFieldName) : '') +
          '</div>' +
        '</div>';

      // Operations
      body += '<h2>Current Season Operations</h2>';
      body += buildFhOpsTable(field, refs, acres);

      // Yield & income
      body += '<h2>Yield &amp; Income</h2>';
      body += buildFhYieldSummary(field, acres);

      // Yield history
      var yieldHistory = (field._fieldops && field._fieldops.yieldHistory) || [];
      body += '<h2>Yield History (Case IH FieldOps Sync)</h2>';
      if (yieldHistory.length) {
        body += '<table><thead><tr><th>Season</th><th>Crop</th><th class="num">Yield/ac</th><th>Unit</th><th class="num">Moisture %</th><th>Harvest Date</th></tr></thead><tbody>';
        yieldHistory.slice().reverse().forEach(function (y) {
          body += '<tr>' +
            '<td>' + esc(String(y.season || '')) + '</td>' +
            '<td>' + esc(y.crop || '') + '</td>' +
            '<td class="num">' + fmtNum(y.yieldPerAcre, 1) + '</td>' +
            '<td>' + esc(y.unit || 'Bu') + '</td>' +
            '<td class="num">' + (y.moisture ? fmtNum(y.moisture, 1) : '--') + '</td>' +
            '<td>' + fmtDate(y.harvestDate) + '</td>' +
            '</tr>';
        });
        body += '</tbody></table>';
      } else {
        body += '<p style="color:#888;font-size:8.5pt;font-style:italic">No yield history from Case IH FieldOps sync.</p>';
      }

      // Application history
      var applications = (field._fieldops && field._fieldops.applications) || [];
      body += '<h2>Application History (Case IH FieldOps Sync)</h2>';
      if (applications.length) {
        var sortedApps = applications.slice().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
        body += '<table><thead><tr><th>Date</th><th>Type</th><th>Products / Notes</th><th class="num">Area (ac)</th><th>Applicator</th></tr></thead><tbody>';
        sortedApps.forEach(function (a) {
          var prods = (a.products || []).map(function (p) {
            return (p.productName || p.name || '') + (p.appliedRate ? ' @ ' + p.appliedRate + ' ' + (p.appliedRateUnit || '') : '');
          }).filter(Boolean).join('; ') || a.notes || '—';
          body += '<tr>' +
            '<td>' + fmtDate(a.date) + '</td>' +
            '<td>' + esc(a.type || '') + '</td>' +
            '<td>' + esc(prods) + '</td>' +
            '<td class="num">' + (a.area ? fmtNum(a.area, 1) : '--') + '</td>' +
            '<td>' + esc(a.applicator || '') + '</td>' +
            '</tr>';
        });
        body += '</tbody></table>';
      } else {
        body += '<p style="color:#888;font-size:8.5pt;font-style:italic">No application history from Case IH FieldOps sync.</p>';
      }

      body += '</div>';
    });

    return reportWrapper(title, farmName, body, 'h2:first-of-type { margin-top:0.5em; }');
  }

  function buildFhOpsTable(field, refs, acres) {
    var inputs = field.inputs || [];
    var machinery = field.machinery || [];
    if (!inputs.length && !machinery.length) {
      return '<p style="color:#888;font-size:8.5pt;font-style:italic">No operations recorded for this field.</p>';
    }

    var GROUP_ORDER = window.FieldOpsGroups ? window.FieldOpsGroups.GROUP_ORDER : ['Other'];
    var groupMap = {};
    GROUP_ORDER.forEach(function (g) { groupMap[g] = []; });
    if (!groupMap['Other']) groupMap['Other'] = [];

    function addRows(arr, isInput) {
      arr.forEach(function (item) {
        var name = isInput ? (item.productName || '') : (item.implementName || '');
        var itemType = isInput ? (name.toLowerCase().indexOf('application -') === 0 ? 'custom' : 'input') : 'pass';
        var group = item.operationGroup ||
          (window.FieldOpsGroups ? window.FieldOpsGroups.classifyItem(name, itemType) : 'Other');
        if (!groupMap[group]) group = 'Other';

        var costPerAc = 0;
        var rateStr = '';
        if (isInput) {
          var prod = (refs.products || []).find(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
          var appPrice = prod ? (prod.unitBilledPrice || 0) / (prod.conversionRate || 1) : 0;
          costPerAc = (item.quantity || 0) * appPrice;
          rateStr = (item.quantity || 0) + (prod ? ' ' + (prod.unit || '') : '');
          if ((item.passStatus || 'planned') === 'confirmed' && item.actualQuantity !== null && item.actualQuantity !== undefined) {
            var pq = item.quantity || 0;
            if (Math.abs(item.actualQuantity - pq) > 0.001) rateStr += ' \u2192 actual: ' + item.actualQuantity;
          }
        } else {
          var impl = (refs.implements || []).find(function (i) { return i.name.toLowerCase() === name.toLowerCase(); });
          var useHire = item.useHire !== undefined ? item.useHire : (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0);
          costPerAc = useHire && impl && impl.customHireRate > 0 ? impl.customHireRate * (item.passes || 1) : (impl ? impl.costPerAcre * (item.passes || 1) : 0);
          rateStr = (item.passes || 1) + ' pass' + ((item.passes || 1) !== 1 ? 'es' : '');
        }

        var status = item.passStatus || 'planned';
        groupMap[group].push({
          name: name,
          badge: itemType,
          rateStr: rateStr,
          costPerAc: costPerAc,
          fieldTotal: costPerAc * acres,
          statusLabel: status === 'confirmed' ? '\u2713 confirmed' : status === 'disregarded' ? '\u2014 disregarded' : '\u25cb planned',
          confirmedDate: item.confirmedDate ? item.confirmedDate.slice(0, 10) : '',
          confirmedBy: item.confirmedBy || '',
          statusNote: item.statusNote || '',
          isDisregarded: status === 'disregarded'
        });
      });
    }

    addRows(inputs, true);
    addRows(machinery, false);

    var html = '<table><thead><tr><th>Name</th><th>Type</th><th>Rate</th><th class="num">$/ac</th><th class="num">Total $</th><th>Status</th><th>Date</th><th>By</th></tr></thead><tbody>';
    var grandAcTotal = 0;
    var grandFldTotal = 0;
    var hasRows = false;

    GROUP_ORDER.forEach(function (groupName) {
      var rows = groupMap[groupName];
      if (!rows || !rows.length) return;
      hasRows = true;
      var groupAcSub = rows.reduce(function (s, r) { return s + (r.isDisregarded ? 0 : r.costPerAc); }, 0);
      grandAcTotal += groupAcSub;
      grandFldTotal += groupAcSub * acres;

      html += '<tr class="group-header-row"><td colspan="8">' + esc(groupName) + ' &nbsp;&mdash;&nbsp; ' + fmtMoney(groupAcSub) + '/ac</td></tr>';
      rows.forEach(function (r) {
        html += '<tr' + (r.isDisregarded ? ' style="opacity:0.5"' : '') + '>' +
          '<td>' + esc(r.name) + '</td>' +
          '<td style="font-size:8pt">' + esc(r.badge) + '</td>' +
          '<td>' + esc(r.rateStr) + '</td>' +
          '<td class="num">' + (r.isDisregarded ? '<s>' + fmtMoney(r.costPerAc) + '</s>' : fmtMoney(r.costPerAc)) + '</td>' +
          '<td class="num">' + (r.isDisregarded ? '<s>' + fmtMoney(r.fieldTotal) + '</s>' : fmtMoney(r.fieldTotal)) + '</td>' +
          '<td style="font-size:8pt">' + esc(r.statusLabel) + '</td>' +
          '<td style="font-size:8pt">' + esc(r.confirmedDate) + '</td>' +
          '<td style="font-size:8pt">' + esc(r.confirmedBy) + (r.statusNote ? ' (' + esc(r.statusNote) + ')' : '') + '</td>' +
          '</tr>';
      });
    });

    if (!hasRows) return '<p style="color:#888;font-size:8.5pt;font-style:italic">No operations recorded.</p>';

    html += '<tr class="total-row">' +
      '<td colspan="3">Total Operations Cost</td>' +
      '<td class="num">' + fmtMoney(grandAcTotal) + '/ac</td>' +
      '<td class="num">' + fmtMoney(grandFldTotal) + '</td>' +
      '<td colspan="3"></td>' +
      '</tr></tbody></table>';
    return html;
  }

  function buildFhYieldSummary(field, acres) {
    var html = '<table><thead><tr>' +
      '<th class="num">Yield/ac</th><th>Unit</th><th class="num">Rent/ac</th><th class="num">Crop Ins/ac</th><th class="num">Ins Income/ac</th>' +
      '</tr></thead><tbody><tr>' +
      '<td class="num">' + fmtNum(field.yieldPerAcre || 0, 1) + '</td>' +
      '<td>' + esc(field.yieldUnit || 'Bu') + '</td>' +
      '<td class="num">' + fmtMoney(field.rentPerAcre || 0) + '</td>' +
      '<td class="num">' + fmtMoney(field.cropInsurancePerAcre || 0) + '</td>' +
      '<td class="num">' + fmtMoney(field.insuranceIncomePerAcre || 0) + '</td>' +
      '</tr></tbody></table>';

    var aux = field.auxPayments || [];
    if (aux.length) {
      html += '<table style="margin-top:0"><thead><tr><th>Payment</th><th class="num">$/ac</th><th class="num">Total $</th></tr></thead><tbody>';
      aux.forEach(function (a) {
        html += '<tr>' +
          '<td>' + esc(a.label || '') + '</td>' +
          '<td class="num">' + fmtMoney(a.perAcre) + '</td>' +
          '<td class="num">' + fmtMoney((a.perAcre || 0) * acres) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }
    return html;
  }

})();
