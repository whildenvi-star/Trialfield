// Dashboard view — charts, crop tables, cost category rollup
(function () {
  'use strict';

  var charts = {};
  var yieldMode = 'projected';

  // --- Grain Yield Overlay (Phase 52) ---
  // Cached grain-ticket yield data fetched from /api/yield-from-grain on each dashboard load.
  // Map keyed by "registryFieldId|registryCropId" (same key as grain-tickets uses).
  // Falls back to {} if fetch fails — dashboard renders budget estimates unchanged.
  var grainYields = {};

  // fetchGrainYields: loads cached yield summaries from farm-budget server memory.
  // The server caches data pushed from grain-tickets — no direct grain-tickets dependency here.
  function fetchGrainYields() {
    return fetch('/api/yield-from-grain').then(function (r) {
      if (!r.ok) return {};
      return r.json().then(function (d) { return d.yields || {}; });
    }).catch(function () { return {}; });
  }

  // findGrainYieldForCrop: looks up grain yield for a crop name string.
  // Matches on cropName (case-insensitive) across all keys in the yields map.
  // Returns { yieldPerAcre, ticketCount, syncedAt } or null if no match.
  function findGrainYieldForCrop(cropName) {
    if (!cropName || !grainYields || typeof grainYields !== 'object') return null;
    var normCrop = (cropName || '').toLowerCase().trim();
    var keys = Object.keys(grainYields);
    for (var i = 0; i < keys.length; i++) {
      var entry = grainYields[keys[i]];
      if (entry && (entry.cropName || '').toLowerCase().trim() === normCrop) {
        return entry;
      }
    }
    return null;
  }

  // --- Chart.js setup ---
  var DARK_COLORS = {
    primary: '#4af626', success: '#4af626', blue: '#4a9eff', orange: '#ff6e40',
    purple: '#b388ff', teal: '#64ffda', yellow: '#ffb800', danger: '#ff3b30',
    grey: '#5c6e54', brown: '#8d6e63', muted: '#283828', pink: '#ff80ab'
  };
  var LIGHT_COLORS = {
    primary: '#1a6b10', success: '#2e7d32', blue: '#1565c0', orange: '#e65100',
    purple: '#7b1fa2', teal: '#00796b', yellow: '#9a6200', danger: '#c62828',
    grey: '#6b7d65', brown: '#6d4c41', muted: '#d8d4c8', pink: '#ad1457'
  };

  function isLight() { return document.body.classList.contains('light'); }

  function getColors() { return isLight() ? LIGHT_COLORS : DARK_COLORS; }

  function getPalette() {
    var C = getColors();
    return [C.primary, C.blue, C.yellow, C.orange,
      C.purple, C.teal, C.pink, C.danger,
      C.grey, C.brown, C.success, C.muted];
  }

  // Chart theme colors (tooltips, grids, ticks)
  function ct() {
    var light = isLight();
    return {
      tooltipBg: light ? '#ffffff' : '#111611',
      tooltipBorder: light ? '#e0e0e0' : '#1e2e1a',
      tooltipTitle: light ? '#1a1a1a' : '#4af626',
      tooltipBody: light ? '#333333' : '#a8b8a0',
      gridColor: light ? '#eeeeee' : '#1e2e1a',
      tickColor: light ? '#666666' : '#5c6e54',
      legendColor: light ? '#666666' : '#5c6e54',
      sliceBorder: light ? '#ffffff' : '#0a0e09',
      expBar: light ? 'rgba(198, 40, 40, 0.7)' : 'rgba(255, 59, 48, 0.65)',
      expBorder: light ? '#c62828' : '#ff3b30',
      incBar: light ? 'rgba(46, 125, 50, 0.6)' : 'rgba(74, 246, 38, 0.45)',
      incBorder: light ? '#2e7d32' : '#4af626'
    };
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace";
    Chart.defaults.color = '#5c6e54';
    Chart.defaults.borderColor = '#1e2e1a';
  }

  function upsertChart(key, canvasId, type, chartData, opts) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;
    // Always destroy + recreate so options (tooltip colors, grids) update on theme change
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
    charts[key] = new Chart(canvas.getContext('2d'), {
      type: type, data: chartData, options: opts
    });
    return charts[key];
  }

  // --- Theme change: destroy charts and re-render ---
  window.addEventListener('theme-change', function () {
    if (typeof Chart !== 'undefined') {
      var t = ct();
      Chart.defaults.color = t.tickColor;
      Chart.defaults.borderColor = t.gridColor;
    }
    loadDashboard();
  });

  // --- Tab activation ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'dashboard') loadDashboard();
  });

  var settingsInitialized = false;

  window.addEventListener('ref-data-loaded', function () {
    var s = window.refData.settings;
    document.getElementById('dash-year').textContent = s.year || 2026;
    // Only populate inputs on first load — not on every reloadRefData() call
    // (reloadRefData fires ref-data-loaded after saveSettings, which would reset
    // the inputs mid-edit before the server round-trip completes)
    if (!settingsInitialized) {
      settingsInitialized = true;
      document.getElementById('set-fixed-mach').checked = s.useFixedMachineryRate;
      document.getElementById('set-mach-rate').value = s.fixedMachineryRate || 100;
      document.getElementById('set-fuel-price').value = s.fuelPricePerGal || 5;
      document.getElementById('set-wage-rate').value = s.wageRate || 25;
      document.getElementById('set-interest-rate').value = s.interestRate != null ? s.interestRate * 100 : 6;
      document.getElementById('set-carry-months').value = s.carryMonths || 6;
    }
    loadDashboard();
  });

  // --- Settings controls ---
  document.getElementById('set-fixed-mach').addEventListener('change', saveSettings);
  document.getElementById('set-mach-rate').addEventListener('change', saveSettings);
  document.getElementById('set-fuel-price').addEventListener('change', saveSettings);
  document.getElementById('set-wage-rate').addEventListener('change', saveSettings);
  document.getElementById('set-interest-rate').addEventListener('change', saveSettings);
  document.getElementById('set-carry-months').addEventListener('change', saveSettings);

  // --- Yield Mode Toggle ---
  document.querySelectorAll('#yield-mode-toggle .toggle-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      yieldMode = btn.getAttribute('data-yield-mode');
      document.querySelectorAll('#yield-mode-toggle .toggle-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      loadDashboard();
    });
  });

  function saveSettings() {
    var data = {
      useFixedMachineryRate: document.getElementById('set-fixed-mach').checked,
      fixedMachineryRate: parseFloat(document.getElementById('set-mach-rate').value) || 100,
      fuelPricePerGal: parseFloat(document.getElementById('set-fuel-price').value) || 5,
      wageRate: parseFloat(document.getElementById('set-wage-rate').value) || 25,
      interestRate: (parseFloat(document.getElementById('set-interest-rate').value) || 6) / 100,
      carryMonths: parseInt(document.getElementById('set-carry-months').value) || 6
    };
    api.put('/api/settings', data).then(function () {
      window.reloadRefData().then(function () {
        loadDashboard();
      });
    });
  }

  // --- Load dashboard ---
  function loadDashboard() {
    // Use actuals-aware endpoint when in actual mode to overlay Sandy's entered costs
    var endpoint = yieldMode === 'actual'
      ? '/api/dashboard-with-actuals?yieldMode=actual'
      : '/api/dashboard?yieldMode=projected';

    // Fetch dashboard data, grain yields, sales, forecast, and local invoice totals in parallel
    Promise.all([
      api.get(endpoint),
      fetchGrainYields(),
      api.get('/api/sales').catch(function () { return { sales: [] }; }),
      api.get('/api/forecast').catch(function () { return { categories: [] }; }),
      api.get('/api/enterprise-invoice-totals').catch(function () { return { byEnterprise: {} }; })
    ]).then(function (results) {
      var data = results[0];
      grainYields = results[1] || {};
      var salesData = results[2] || {};
      var forecastData = results[3] || { categories: [] };
      var invoiceTotals = results[4] || { byEnterprise: {} };
      var soldByCrop = {};
      (salesData.sales || []).forEach(function (s) {
        if (s.crop) {
          var key = s.crop.toLowerCase();
          soldByCrop[key] = (soldByCrop[key] || 0) + (s.amount || 0);
        }
      });
      var mode = data.yieldMode || 'projected';
      renderCropTable('dash-conv-tbody', 'dash-conv-info', 'chart-conv-acres', 'convAcres', data.conventional, mode);
      renderCropTable('dash-org-tbody', 'dash-org-info', 'chart-org-acres', 'orgAcres', data.organic, mode);
      renderRollup(data, invoiceTotals);
      renderStatBar(data, invoiceTotals);
      renderPendingBar(invoiceTotals);
      renderProductionByType(data, soldByCrop);
      renderSupplyCard(data, forecastData);
      updateYieldHeaders(mode);
    }).catch(function (err) {
      console.error('loadDashboard error:', err);
    });
  }

  function updateYieldHeaders(mode) {
    var label = mode === 'actual' ? 'Act Avg Yield' : 'Proj Avg Yield';
    var convH = document.getElementById('dash-conv-yield-header');
    var orgH = document.getElementById('dash-org-yield-header');
    if (convH) convH.textContent = label;
    if (orgH) orgH.textContent = label;
  }

  // --- Crop table: Crop, Acres, Avg Yield (with unit + coverage), Avg Profit/Ac, COP ---
  function renderCropTable(tbodyId, infoId, chartId, chartKey, entries, mode) {
    var tbody = document.getElementById(tbodyId);
    var html = '';
    var totalAcres = 0;
    var cropCount = 0;
    var cropLabels = [];
    var cropProfits = [];

    entries.forEach(function (entry) {
      // Find enterprise index for click navigation
      var entIdx = -1;
      var enterprises = window.refData.enterprises;
      for (var ei = 0; ei < enterprises.length; ei++) {
        if (enterprises[ei].id === entry.enterprise.id) { entIdx = ei; break; }
      }

      entry.cropRows.forEach(function (row) {
        totalAcres += row.acres;
        cropCount++;
        cropLabels.push(row.crop);
        cropProfits.push(row.profitPerAcre || 0);
        var profitCls = util.profitClass(row.profitPerAcre);
        // COP coloring: red when losing money (negative profit = COP > price), green when profitable
        var copCls = row.cop > 0 ? util.profitClass(-row.profitPerAcre) : '';

        // Build yield cell — show coverage indicator in actual mode
        var yieldText = util.formatNum(row.avgYield, 1) + ' ' + util.escHtml(row.unit);
        if (mode === 'actual' && row.totalCount > 0) {
          var coverageCls = row.actualCount >= row.totalCount ? 'full' : 'partial';
          yieldText += ' <span class="yield-coverage ' + coverageCls + '" title="' +
            row.actualCount + ' of ' + row.totalCount +
            ' fields have actual yield data">(' + row.actualCount + '/' + row.totalCount + ')</span>';
        }

        // Grain-ticket actual yield overlay — takes priority over budget yield when present
        // Matches by crop name (case-insensitive) across all cached grain yield entries
        var grainMatch = findGrainYieldForCrop(row.crop);
        var actualYieldText = '';
        if (grainMatch && grainMatch.yieldPerAcre > 0) {
          var actualYield = grainMatch.yieldPerAcre;
          var budgetYield = row.avgYield || 0;
          var variance = actualYield - budgetYield;
          var varSign = variance >= 0 ? '+' : '';
          var varCls = variance >= 0 ? 'color:#4af626' : 'color:#ff6e40';
          actualYieldText = ' <span style="font-size:0.78em;opacity:0.9;" title="Measured yield from grain tickets (' + grainMatch.ticketCount + ' tickets)">' +
            '<span style="color:#4af626;font-size:0.8em;vertical-align:middle;margin-right:2px;">GT</span>' +
            'Actual ' + util.formatNum(actualYield, 1) + ' ' + util.escHtml(row.unit) + '/ac ' +
            'vs Budget ' + util.formatNum(budgetYield, 1) + ' ' +
            '<span style="' + varCls + '">(' + varSign + util.formatNum(variance, 1) + ')</span>' +
            '</span>';
        } else {
          actualYieldText = ' <span style="font-size:0.7em;opacity:0.5;font-style:italic;" title="No yield data yet">(no GT data)</span>';
        }

        var isRestricted = window.APP_ROLE === 'office' || window.APP_ROLE === 'operator';
        html += '<tr class="dash-clickable-row" data-enterprise-idx="' + entIdx + '">' +
          '<td>' + util.escHtml(row.crop) + '</td>' +
          '<td class="number">' + util.formatNum(row.acres, 1) + '</td>' +
          '<td class="number">' + yieldText + actualYieldText + '</td>' +
          (isRestricted ? '' : '<td class="number ' + profitCls + '">' + util.formatMoney(row.profitPerAcre) + '</td>') +
          (isRestricted ? '' : '<td class="number ' + copCls + '">' + util.formatMoney(row.cop) + '/' + util.escHtml(row.unit) + '</td>') +
          '</tr>';
      });
    });

    var colspanTotal = (window.APP_ROLE === 'office' || window.APP_ROLE === 'operator') ? 1 : 3;
    html += '<tr class="total-row"><td>TOTAL</td><td class="number">' +
      util.formatNum(totalAcres, 1) + '</td><td colspan="' + colspanTotal + '"></td></tr>';

    tbody.innerHTML = html;
    document.getElementById(infoId).textContent = cropCount + ' crops, ' + util.formatNum(totalAcres, 0) + ' total acres';

    // Horizontal bar chart — profit/acre by crop
    if (cropLabels.length > 0) {
      var t = ct();
      var C = getColors();
      var canvas = document.getElementById(chartId);
      if (canvas) {
        // Size height to fit crops: 28px per bar + 20px padding
        var barH = Math.max(120, cropLabels.length * 32 + 24);
        canvas.height = barH;
        canvas.width = 160;
      }
      upsertChart(chartKey, chartId, 'bar', {
        labels: cropLabels,
        datasets: [{
          data: cropProfits,
          backgroundColor: cropProfits.map(function (v) { return v >= 0 ? C.teal + 'cc' : C.danger + 'cc'; }),
          borderColor: cropProfits.map(function (v) { return v >= 0 ? C.teal : C.danger; }),
          borderWidth: 1,
          borderRadius: 2
        }]
      }, {
        indexAxis: 'y',
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            titleColor: t.tooltipTitle,
            bodyColor: t.tooltipBody,
            callbacks: {
              label: function (ctx) { return util.formatMoney(ctx.raw) + '/ac'; }
            }
          }
        },
        scales: {
          x: {
            grid: { color: t.gridColor },
            ticks: {
              font: { size: 9 },
              color: t.tickColor,
              callback: function (v) {
                var abs = Math.abs(v);
                var s = abs >= 1000 ? '$' + Math.round(abs / 1000) + 'k' : '$' + abs;
                return v < 0 ? '-' + s : s;
              }
            }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 9 }, color: t.tickColor }
          }
        }
      });
    }
  }

  // --- Cost Category Rollup ---
  function renderRollup(data, invoiceTotals) {
    var enterprises = data.enterpriseSummaries;
    invoiceTotals = invoiceTotals || { byEnterprise: {} };

    // Check if any enterprise has actuals data from portal
    var hasActuals = enterprises.some(function (es) {
      return es.budgets && es.budgets.some(function (fb) { return fb.actuals; });
    });

    // Check if any enterprise has local confirmed invoice data
    var hasInvoiced = enterprises.some(function (es) {
      var inv = invoiceTotals.byEnterprise[es.enterprise.id];
      return inv && inv.inputs > 0;
    });

    // Build column headers dynamically
    var theadRow = document.getElementById('dash-rollup-thead-row');
    if (theadRow) {
      var hHtml = '<th>Category</th>';
      for (var h = 0; h < enterprises.length; h++) {
        // Find enterprise index for click navigation
        var ridx = -1;
        var refEnts = window.refData.enterprises;
        for (var ri = 0; ri < refEnts.length; ri++) {
          if (refEnts[ri].id === enterprises[h].enterprise.id) { ridx = ri; break; }
        }
        hHtml += '<th class="dash-clickable-header" data-enterprise-idx="' + ridx + '">' +
          util.escHtml(enterprises[h].enterprise.shortName) + '</th>';
      }
      hHtml += '<th>TOTAL</th>';
      theadRow.innerHTML = hHtml;
    }

    // Build rows — grouped for visual hierarchy
    var categories = [
      // Land group
      { label: 'Acres', key: 'acres', fmt: 'num', group: 'land', groupFirst: true },
      { label: 'Rent', key: 'rent', group: 'land', groupLast: true },
      // Fertilizer group
      { label: 'Spring Fert', key: 'springFert', group: 'fert', groupFirst: true, indent: true },
      { label: 'Fall Fert', key: 'fallFert', group: 'fert', indent: true },
      { label: 'Other Fert', key: 'unassignedFert', group: 'fert', indent: true, skipIfZero: true },
      { label: 'Total Fert', key: 'fert', bold: true, group: 'fert', subtotal: true },
      { label: '  Invoiced', key: '_invoicedInputs', group: 'fert', indent: true, invoiceRow: true },
      // Actuals rows for fert (only when data exists)
      { label: '  Actual Fert', key: '_actualFert', group: 'fert', indent: true, actualRow: true, actualKey: 'fertTotal', groupLast: true },
      // Seed
      { label: 'Seed', key: 'seed', group: 'seed', groupFirst: true },
      { label: '  Actual Seed', key: '_actualSeed', group: 'seed', indent: true, actualRow: true, actualKey: 'seedTotal', groupLast: true },
      // Operations group
      { label: 'Machinery', key: 'machinery', group: 'ops', groupFirst: true },
      { label: 'Labor & Overhead', key: 'laborOverhead', group: 'ops' },
      { label: 'Fuel', key: 'fuel', group: 'ops' },
      { label: 'Drying', key: 'drying', group: 'ops' },
      { label: '  Actual Ops', key: '_actualOps', group: 'ops', indent: true, actualRow: true, actualKey: 'opsTotal', groupLast: true },
      // Carrying costs group
      { label: 'Interest', key: 'interest', group: 'carry', groupFirst: true },
      { label: 'Crop Insurance Premiums', key: 'insurance', group: 'carry', groupLast: true },
      // Summary totals (core farming KPIs: crop revenue − expenses)
      { label: 'Total Expenses', key: 'expTotal', highlight: true, group: 'summary', groupFirst: true },
      { label: 'Actual Total', key: '_actualTotal', highlight: true, actualRow: true, actualKey: 'total', group: 'summary' },
      { label: 'Gross Income', key: 'cropIncome', highlight: true, group: 'summary' },
      { label: 'Operating Profit', key: 'cropProfit', highlight: true, profit: true, group: 'summary', groupLast: true },
      // Supplemental income (not included in operating KPIs above)
      { label: 'Crop Ins. Claim Payments', key: 'insIncome', group: 'payments', groupFirst: true },
      { label: 'AUX Payments (Gov/Cons)', key: 'govPayments', group: 'payments' },
      { label: 'Profit w/ All Payments', key: 'profitWithPayments', group: 'payments', profit: true, groupLast: true }
    ];

    var tbody = document.getElementById('dash-rollup-tbody');
    var html = '';

    categories.forEach(function (cat) {
      // Skip actual rows when no actuals data exists
      if (cat.actualRow && !hasActuals) return;
      // Skip invoice rows when no confirmed invoices exist
      if (cat.invoiceRow && !hasInvoiced) return;
      // Skip zero rows when flagged (e.g. Other Fert when all inputs are spring/fall)
      if (cat.skipIfZero) {
        var rowTotal = enterprises.reduce(function (s, e) { return s + (e.totals[cat.key] || 0); }, 0);
        if (!rowTotal) return;
      }

      // When Actual Fert (portal) is hidden but Invoiced row is the last in its group, mark it groupLast
      var isGroupLast = cat.groupLast || (cat.invoiceRow && !hasActuals);

      // Build row classes
      var classes = ['rollup-row'];
      if (cat.group) classes.push('rg-' + cat.group);
      if (cat.groupFirst) classes.push('rg-first');
      if (isGroupLast) classes.push('rg-last');
      if (cat.highlight) classes.push('row-highlight');
      if (cat.subtotal) classes.push('rg-subtotal');
      if (cat.actualRow) classes.push('rg-actual');
      if (cat.invoiceRow) classes.push('rg-actual');

      html += '<tr class="' + classes.join(' ') + '">';

      // Label cell
      var labelCls = '';
      if (cat.indent) labelCls = 'rg-indent';
      else if (cat.bold || cat.highlight) labelCls = 'bold';
      if (cat.actualRow || cat.invoiceRow) labelCls += ' actual-label';
      html += '<td class="' + labelCls + '">' + cat.label + '</td>';

      var total = 0;
      for (var i = 0; i < enterprises.length; i++) {
        var val;
        if (cat.actualRow) {
          // Sum actuals across all budgets in this enterprise (portal source)
          val = 0;
          var budgets = enterprises[i].budgets || [];
          budgets.forEach(function (fb) {
            if (fb.actuals && fb.actuals[cat.actualKey] != null) {
              val += fb.actuals[cat.actualKey];
            }
          });
        } else if (cat.invoiceRow) {
          // Sum confirmed invoice totals from local farm-budget data
          var entId = enterprises[i].enterprise.id;
          var inv = invoiceTotals.byEnterprise[entId];
          val = inv ? (inv.inputs || 0) : 0;
        } else {
          val = enterprises[i].totals[cat.key] || 0;
        }
        total += val;
        var cellCls = 'number';
        if (cat.profit) cellCls += ' ' + util.profitClass(val);
        if (cat.bold || cat.highlight) cellCls += ' bold';
        if (cat.actualRow) cellCls += ' actual-cell';
        if (cat.invoiceRow) cellCls += ' actual-cell';
        if (cat.fmt === 'num') {
          html += '<td class="' + cellCls + '">' + util.formatNum(val, 1) + '</td>';
        } else {
          html += '<td class="' + cellCls + '">' + (val ? util.formatMoney(val, 0) : '—') + '</td>';
        }
      }

      var totalCls = 'number bold';
      if (cat.profit) totalCls += ' ' + util.profitClass(total);
      if (cat.actualRow) totalCls += ' actual-cell';
      if (cat.invoiceRow) totalCls += ' actual-cell';
      if (cat.fmt === 'num') {
        html += '<td class="' + totalCls + '">' + util.formatNum(total, 1) + '</td>';
      } else {
        html += '<td class="' + totalCls + '">' + (total ? util.formatMoney(total, 0) : '—') + '</td>';
      }
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  // --- Pending Invoices Bar ---
  function renderPendingBar(invoiceTotals) {
    var el = document.getElementById('dash-pending-bar');
    if (!el) return;
    var pending = (invoiceTotals && invoiceTotals.pendingFields) || [];
    if (!pending.length) { el.style.display = 'none'; return; }

    var collapsed = localStorage.getItem('dash-pending-collapsed') === '1';
    var totalPending = pending.reduce(function (s, pf) { return s + pf.pendingCount; }, 0);

    // Build wrapper
    var wrap = document.createElement('div');
    wrap.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:4px';

    // Build header row
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem';

    var label = document.createElement('span');
    label.style.cssText = 'font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-light);white-space:nowrap';
    label.textContent = 'Pending invoices';

    var summary = document.createElement('span');
    summary.style.cssText = 'font-size:0.68rem;color:var(--text-light);opacity:0.7';
    summary.textContent = pending.length + ' field' + (pending.length !== 1 ? 's' : '') + ' · ' + totalPending + ' input' + (totalPending !== 1 ? 's' : '');

    var spacer = document.createElement('span');
    spacer.style.flex = '1';

    var toggleBtn = document.createElement('button');
    toggleBtn.style.cssText = 'background:none;border:1px solid var(--border);border-radius:3px;padding:0.1rem 0.4rem;cursor:pointer;font-size:0.65rem;font-family:inherit;color:var(--text-light);line-height:1.4';
    toggleBtn.textContent = collapsed ? 'show' : 'hide';

    header.appendChild(label);
    header.appendChild(summary);
    header.appendChild(spacer);
    header.appendChild(toggleBtn);

    // Build chips container
    var chipsDiv = document.createElement('div');
    chipsDiv.style.cssText = 'flex-wrap:wrap;gap:0.4rem;padding:0 0.75rem 0.5rem';
    chipsDiv.style.display = collapsed ? 'none' : 'flex';

    pending.forEach(function (pf) {
      var chip = document.createElement('button');
      chip.className = 'dash-pending-chip';
      chip.setAttribute('data-field-id', pf.fieldId);

      var nameSpan = document.createElement('span');
      nameSpan.textContent = pf.fieldName;
      chip.appendChild(nameSpan);

      if (pf.crop) {
        var cropSpan = document.createElement('span');
        cropSpan.style.cssText = 'opacity:0.7;font-size:0.68rem';
        cropSpan.textContent = ' (' + pf.crop + ')';
        chip.appendChild(cropSpan);
      }

      var countSpan = document.createElement('span');
      countSpan.className = 'dash-pending-count';
      countSpan.textContent = pf.pendingCount;
      chip.appendChild(countSpan);

      chip.addEventListener('click', function () {
        api.get('/api/fields/' + pf.fieldId).then(function (field) {
          if (field && window.openFieldEditor) {
            window.openFieldEditor(field, null, null, 'fieldops-unified');
          }
        });
      });

      chipsDiv.appendChild(chip);
    });

    // Toggle handler
    toggleBtn.addEventListener('click', function () {
      var isVisible = chipsDiv.style.display !== 'none';
      chipsDiv.style.display = isVisible ? 'none' : 'flex';
      toggleBtn.textContent = isVisible ? 'show' : 'hide';
      localStorage.setItem('dash-pending-collapsed', isVisible ? '1' : '0');
    });

    wrap.appendChild(header);
    wrap.appendChild(chipsDiv);

    el.innerHTML = '';
    el.appendChild(wrap);
    el.style.display = 'block';
  }

  // --- Whole-Farm Stat Bar ---
  function renderStatBar(data, invoiceTotals) {
    var el = document.getElementById('dash-stat-bar');
    if (!el) return;
    var g = data.grandTotals || {};
    var acres     = g.acres     || 0;
    var expTotal  = g.expTotal  || 0;
    var cropProfit = g.cropProfit || 0;
    var cropIncome = g.cropIncome || 0;

    // Sum confirmed invoice totals across all enterprises
    var invMap = (invoiceTotals && invoiceTotals.byEnterprise) || {};
    var totalInvoiced = Object.keys(invMap).reduce(function (s, id) { return s + (invMap[id].inputs || 0); }, 0);
    var invoicedPct = expTotal > 0 ? Math.round(totalInvoiced / expTotal * 100) : 0;

    var expPerAcre    = acres > 0 ? util.formatMoney(expTotal / acres, 0) : '—';
    var profitPerAcre = acres > 0 ? util.formatMoney(cropProfit / acres, 0) : '—';
    var profitColor   = cropProfit >= 0 ? 'var(--primary)' : 'var(--danger, #e53e3e)';

    function stat(label, value, color) {
      return '<div class="summary-item">' +
        '<span class="summary-label">' + label + '</span>' +
        '<span class="summary-value" style="' + (color ? 'color:' + color : '') + '">' + value + '</span>' +
        '</div>';
    }

    var divider = '<div style="width:1px;background:var(--border);align-self:stretch;margin:0 0.25rem"></div>';

    el.innerHTML =
      stat('Total Acres', util.formatNum(acres, 1)) +
      divider +
      stat('Budgeted Exp', util.formatMoney(expTotal, 0)) +
      stat('Exp / Ac', expPerAcre) +
      divider +
      stat('Invoiced', totalInvoiced > 0 ? util.formatMoney(totalInvoiced, 0) : '—') +
      stat('% Confirmed', totalInvoiced > 0 ? invoicedPct + '%' : '—') +
      divider +
      stat('Proj Income', util.formatMoney(cropIncome, 0)) +
      stat('Profit / Ac', profitPerAcre, profitColor);

    el.style.display = 'flex';
  }

  // --- Production by Crop Type ---
  function renderProductionByType(data, soldByCrop) {
    soldByCrop = soldByCrop || {};
    var tbody = document.getElementById('dash-production-tbody');
    if (!tbody) return;

    // Gather all crop rows across all enterprises
    var allRows = [];
    (data.conventional || []).forEach(function (entry) {
      (entry.cropRows || []).forEach(function (r) { allRows.push(r); });
    });
    (data.organic || []).forEach(function (entry) {
      (entry.cropRows || []).forEach(function (r) { allRows.push(r); });
    });

    // Merge duplicate sub-crops (same crop across enterprises)
    var byCrop = {};
    allRows.forEach(function (r) {
      if (!byCrop[r.crop]) {
        byCrop[r.crop] = { crop: r.crop, acres: 0, totalBu: 0, unit: r.unit || 'Bu' };
      }
      byCrop[r.crop].acres += r.acres || 0;
      byCrop[r.crop].totalBu += r.projectedTotal || 0;
    });

    // Group by crop type
    var hasCropColors = typeof CropColors !== 'undefined';
    var typeGroups = {};
    var typeOrder = [];
    Object.keys(byCrop).forEach(function (crop) {
      var typeName = (hasCropColors && CropColors.getCropTypeName(crop)) || 'Other';
      if (!typeGroups[typeName]) {
        typeGroups[typeName] = { name: typeName, subCrops: [], totalAcres: 0, totalBu: 0, unit: '' };
        typeOrder.push(typeName);
      }
      var g = typeGroups[typeName];
      var entry = byCrop[crop];
      g.subCrops.push(entry);
      g.totalAcres += entry.acres;
      g.totalBu += entry.totalBu;
      g.unit = entry.unit;
    });

    // Sort type groups by total acres descending
    typeOrder.sort(function (a, b) { return typeGroups[b].totalAcres - typeGroups[a].totalAcres; });

    var html = '';
    var farmTotalAcres = 0;
    var farmTotalBu = 0;

    typeOrder.forEach(function (typeName) {
      var g = typeGroups[typeName];
      farmTotalAcres += g.totalAcres;
      farmTotalBu += g.totalBu;

      var typeColor = hasCropColors ? CropColors.getCropTypeColor(typeName) : '#455a64';
      var textColor = hasCropColors ? CropColors.textColorFor(typeColor) : '#fff';
      var avgYield = g.totalAcres > 0 ? g.totalBu / g.totalAcres : 0;
      var hasMultiple = g.subCrops.length > 1;

      // Compute sold bushels for this type group (sum across sub-crops)
      var typeSoldBu = 0;
      g.subCrops.forEach(function (sc) {
        typeSoldBu += soldByCrop[sc.crop.toLowerCase()] || 0;
      });
      var typeSoldPct = g.totalBu > 0 ? typeSoldBu / g.totalBu * 100 : 0;
      var typeSoldCell = g.totalBu > 0
        ? '<span style="color:' + (typeSoldPct >= 100 ? '#4af626' : typeSoldPct >= 50 ? '#ffb800' : 'inherit') + '">' +
            util.formatNum(typeSoldPct, 0) + '%</span>'
        : '—';

      // Type header row
      html += '<tr class="prod-type-row" data-type="' + util.escHtml(typeName) + '">';
      html += '<td class="prod-type-name">' +
        (hasMultiple ? '<span class="prod-type-toggle" title="Expand">&#9654;</span>' : '<span class="prod-type-toggle-spacer"></span>') +
        '<span class="prod-type-swatch" style="background:' + typeColor + ';color:' + textColor + '">' + util.escHtml(typeName) + '</span></td>';
      html += '<td class="number bold">' + util.formatNum(g.totalAcres, 1) + '</td>';
      html += '<td class="number bold">' + util.formatNum(g.totalBu, 0) + ' ' + util.escHtml(g.unit) + '</td>';
      html += '<td class="number bold">' + util.formatNum(avgYield, 1) + ' ' + util.escHtml(g.unit) + '/ac</td>';
      html += '<td class="number bold">' + typeSoldCell + '</td>';
      html += '</tr>';

      // Sub-crop rows (hidden by default if multiple)
      g.subCrops.sort(function (a, b) { return b.acres - a.acres; });
      g.subCrops.forEach(function (sc) {
        var scColor = hasCropColors ? CropColors.getCropColor(sc.crop) : '#999';
        var scAvg = sc.acres > 0 ? sc.totalBu / sc.acres : 0;
        var scSoldBu = soldByCrop[sc.crop.toLowerCase()] || 0;
        var scSoldPct = sc.totalBu > 0 ? scSoldBu / sc.totalBu * 100 : 0;
        var scSoldCell = sc.totalBu > 0
          ? '<span style="color:' + (scSoldPct >= 100 ? '#4af626' : scSoldPct >= 50 ? '#ffb800' : 'inherit') + '">' +
              util.formatNum(scSoldPct, 0) + '%</span>'
          : '—';
        html += '<tr class="prod-sub-row' + (hasMultiple ? ' hidden' : '') + '" data-parent="' + util.escHtml(typeName) + '">';
        html += '<td class="prod-sub-name"><span class="prod-sub-dot" style="background:' + scColor + '"></span>' + util.escHtml(sc.crop) + '</td>';
        html += '<td class="number">' + util.formatNum(sc.acres, 1) + '</td>';
        html += '<td class="number">' + util.formatNum(sc.totalBu, 0) + ' ' + util.escHtml(sc.unit) + '</td>';
        html += '<td class="number">' + util.formatNum(scAvg, 1) + ' ' + util.escHtml(sc.unit) + '/ac</td>';
        html += '<td class="number">' + scSoldCell + '</td>';
        html += '</tr>';
      });
    });

    // Farm total row
    html += '<tr class="total-row"><td>TOTAL</td>';
    html += '<td class="number">' + util.formatNum(farmTotalAcres, 1) + '</td>';
    html += '<td class="number">' + util.formatNum(farmTotalBu, 0) + '</td>';
    html += '<td class="number"></td>';
    html += '<td class="number"></td></tr>';

    tbody.innerHTML = html;

    // Toggle expand/collapse
    tbody.querySelectorAll('.prod-type-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var typeName = row.getAttribute('data-type');
        var toggle = row.querySelector('.prod-type-toggle');
        if (!toggle) return;
        var subRows = tbody.querySelectorAll('.prod-sub-row[data-parent="' + typeName + '"]');
        var isExpanded = !subRows[0].classList.contains('hidden');
        subRows.forEach(function (sr) { sr.classList.toggle('hidden', isExpanded); });
        toggle.innerHTML = isExpanded ? '&#9654;' : '&#9660;';
      });
    });
  }

  // --- Supply Planning Card ---
  var SP_CONV  = 'var(--primary)';     // teal — conventional
  var SP_ORG   = 'var(--success)';     // green — organic
  var SP_SPLIT = 'var(--amber)';       // amber — split/both

  function renderSupplyCard(data, forecastData) {
    var el = document.getElementById('dash-supply-card');
    if (!el) return;
    var fuelPrice = (window.refData && window.refData.settings && window.refData.settings.fuelPricePerGal) || 5;

    // Fuel by enterprise type
    var convFuel    = (data.conventional || []).reduce(function (s, e) { return s + ((e.totals && e.totals.fuel) || 0); }, 0);
    var orgFuel     = (data.organic || []).reduce(function (s, e) { return s + ((e.totals && e.totals.fuel) || 0); }, 0);
    var fuelDollars = convFuel + orgFuel;
    var convFuelGal = fuelPrice > 0 ? Math.round(convFuel / fuelPrice) : 0;
    var orgFuelGal  = fuelPrice > 0 ? Math.round(orgFuel  / fuelPrice) : 0;
    var totalFuelGal = convFuelGal + orgFuelGal;

    var categories = forecastData.categories || [];
    function getProducts(catName) {
      var cat = categories.filter(function (c) { return c.name === catName; })[0];
      return cat ? (cat.products || []) : [];
    }

    // Build fields lookup map — keyed by sanitized productName
    var fieldsMap = {};
    categories.forEach(function (cat) {
      (cat.products || []).forEach(function (p) {
        if (p.fields && p.fields.length) {
          var pkey = (p.productName || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
          fieldsMap[pkey] = { fields: p.fields, unit: p.unit || p.billedUnit || '' };
        }
      });
    });

    var fertProducts  = getProducts('Fertilizer');
    var chemProducts  = getProducts('Chemical');
    var bioProducts   = getProducts('Biological');
    var seedProducts  = getProducts('Seed');
    var otherProducts = getProducts('Other');

    var fertTotal  = fertProducts.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
    var chemTotal  = chemProducts.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
    var bioTotal   = bioProducts.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
    var seedTotal  = seedProducts.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
    var otherTotal = otherProducts.reduce(function (s, p) { return s + (p.totalCost || 0); }, 0);
    var inputTotal = fertTotal + chemTotal + bioTotal + seedTotal + otherTotal;

    // ── Summary stat strip ──
    var statStripHtml =
      '<div class="sp-stat-strip">' +
        '<div class="sp-stat"><span class="sp-stat-lbl">Fuel</span><span class="sp-stat-val" style="color:' + SP_SPLIT + '">' + util.formatMoney(fuelDollars) + '</span></div>' +
        '<div class="sp-stat-sep"></div>' +
        '<div class="sp-stat"><span class="sp-stat-lbl">Seed</span><span class="sp-stat-val" style="color:var(--amber)">' + util.formatMoney(seedTotal) + '</span></div>' +
        '<div class="sp-stat"><span class="sp-stat-lbl">Fert</span><span class="sp-stat-val" style="color:' + SP_CONV + '">' + util.formatMoney(fertTotal) + '</span></div>' +
        '<div class="sp-stat"><span class="sp-stat-lbl">Chem</span><span class="sp-stat-val" style="color:#b388ff">' + util.formatMoney(chemTotal) + '</span></div>' +
        (bioTotal > 0 ? '<div class="sp-stat"><span class="sp-stat-lbl">Bio</span><span class="sp-stat-val" style="color:' + SP_ORG + '">' + util.formatMoney(bioTotal) + '</span></div>' : '') +
        (otherTotal > 0 ? '<div class="sp-stat"><span class="sp-stat-lbl">Other</span><span class="sp-stat-val">' + util.formatMoney(otherTotal) + '</span></div>' : '') +
        '<div class="sp-stat-sep"></div>' +
        '<div class="sp-stat sp-stat-total"><span class="sp-stat-lbl">Total</span><span class="sp-stat-val">' + util.formatMoney(fuelDollars + inputTotal) + '</span></div>' +
      '</div>';

    // ── Filter bar ──
    var filterBarHtml =
      '<div class="sp-filter-bar" id="sp-filter-bar">' +
        '<div class="sp-filter-group">' +
          '<button class="sp-fbtn sp-fbtn-ent sp-fbtn-active" data-ent="all">ALL</button>' +
          '<button class="sp-fbtn sp-fbtn-ent" data-ent="conventional" style="--sp-btn-active:' + SP_CONV + '">CONV</button>' +
          '<button class="sp-fbtn sp-fbtn-ent" data-ent="organic" style="--sp-btn-active:' + SP_ORG + '">ORG</button>' +
        '</div>' +
        '<div class="sp-filter-sep"></div>' +
        '<div class="sp-filter-group sp-filter-cats">' +
          '<button class="sp-fbtn sp-fbtn-cat sp-fbtn-active" data-cat="all">All</button>' +
          '<button class="sp-fbtn sp-fbtn-cat" data-cat="Fuel">Fuel</button>' +
          '<button class="sp-fbtn sp-fbtn-cat" data-cat="Fertilizer">Fert</button>' +
          '<button class="sp-fbtn sp-fbtn-cat" data-cat="Chemical">Chem</button>' +
          '<button class="sp-fbtn sp-fbtn-cat" data-cat="Seed">Seed</button>' +
          (bioProducts.length ? '<button class="sp-fbtn sp-fbtn-cat" data-cat="Biological">Bio</button>' : '') +
          (otherProducts.length ? '<button class="sp-fbtn sp-fbtn-cat" data-cat="Other">Other</button>' : '') +
        '</div>' +
      '</div>';

    // ── Table rows ──
    function fuelRowHtml(label, splitType, gal, cost) {
      if (cost <= 0) return '';
      var dotClass = splitType === 'conventional' ? 'sp-dot-conv' : 'sp-dot-org';
      var galStr = gal.toLocaleString() + ' gal';
      return '<tr class="sp-tr" data-split-type="' + splitType + '" data-category="Fuel">' +
        '<td class="sp-td-dot"><span class="sp-dot ' + dotClass + '"></span></td>' +
        '<td class="sp-td-cat">Fuel</td>' +
        '<td class="sp-td-name">' + label + '</td>' +
        '<td class="sp-td-qty">' + galStr + '</td>' +
        '<td class="sp-td-conv">' + (splitType === 'conventional' ? util.formatMoney(cost) : '—') + '</td>' +
        '<td class="sp-td-org">'  + (splitType === 'organic'      ? util.formatMoney(cost) : '—') + '</td>' +
        '<td class="sp-td-total">' + util.formatMoney(cost) + '</td>' +
        '</tr>';
    }

    function productRowHtml(p, catName) {
      var splitType = p.splitType || 'split';
      var dotClass = splitType === 'conventional' ? 'sp-dot-conv' : splitType === 'organic' ? 'sp-dot-org' : 'sp-dot-split';
      var convCost  = p.convCost  != null ? p.convCost  : (splitType === 'conventional' ? (p.totalCost || 0) : 0);
      var orgCost   = p.orgCost   != null ? p.orgCost   : (splitType === 'organic'      ? (p.totalCost || 0) : 0);
      var totalCost = p.totalCost || 0;
      var qtyStr = p.billedQty > 0
        ? (p.billedQty % 1 === 0 ? p.billedQty.toLocaleString() : p.billedQty.toLocaleString(undefined, { maximumFractionDigits: 1 })) + '\u00a0' + (p.billedUnit || p.unit || '')
        : '—';
      // for filtering: split products match both ent filters
      var entAttr = splitType === 'split' ? 'split' : splitType;
      var pkey = (p.productName || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
      var hasBreakdown = !!(fieldsMap[pkey]);
      var expandCls = hasBreakdown ? ' sp-tr-expandable' : '';
      var pkeyAttr = hasBreakdown ? ' data-pkey="' + util.escHtml(pkey) + '"' : '';
      var caretHtml = hasBreakdown ? '<span class="sp-caret">&#9654;</span>' : '';
      return '<tr class="sp-tr' + expandCls + '" data-split-type="' + entAttr + '" data-category="' + util.escHtml(catName) + '"' + pkeyAttr + '>' +
        '<td class="sp-td-dot">' + caretHtml + '<span class="sp-dot ' + dotClass + '"></span></td>' +
        '<td class="sp-td-cat">' + util.escHtml(catName) + '</td>' +
        '<td class="sp-td-name">' + util.escHtml(p.productName) + '</td>' +
        '<td class="sp-td-qty">' + qtyStr + '</td>' +
        '<td class="sp-td-conv">' + (convCost > 0 ? util.formatMoney(convCost) : '—') + '</td>' +
        '<td class="sp-td-org">'  + (orgCost  > 0 ? util.formatMoney(orgCost)  : '—') + '</td>' +
        '<td class="sp-td-total">' + util.formatMoney(totalCost) + '</td>' +
        '</tr>';
    }

    var allRows =
      fuelRowHtml('Conv Fuel', 'conventional', convFuelGal, convFuel) +
      fuelRowHtml('Org Fuel',  'organic',      orgFuelGal,  orgFuel) +
      fertProducts.map(function (p) { return productRowHtml(p, 'Fertilizer'); }).join('') +
      chemProducts.map(function (p) { return productRowHtml(p, 'Chemical'); }).join('') +
      seedProducts.map(function (p) { return productRowHtml(p, 'Seed'); }).join('') +
      bioProducts.map(function (p)  { return productRowHtml(p, 'Biological'); }).join('') +
      otherProducts.map(function (p) { return productRowHtml(p, 'Other'); }).join('');

    var tableHtml =
      '<div class="sp-table-wrap">' +
        '<table class="sp-table">' +
          '<thead><tr>' +
            '<th class="sp-th-dot"></th>' +
            '<th class="sp-th-cat">Cat</th>' +
            '<th class="sp-th-name">Product</th>' +
            '<th class="sp-th-qty">Qty</th>' +
            '<th class="sp-th-num">Conv $</th>' +
            '<th class="sp-th-num">Org $</th>' +
            '<th class="sp-th-num">Total</th>' +
          '</tr></thead>' +
          '<tbody id="sp-tbody">' + allRows + '</tbody>' +
        '</table>' +
        '<div class="sp-no-results" id="sp-no-results" style="display:none">No products match the current filter.</div>' +
      '</div>';

    el.innerHTML =
      '<h3 style="margin-bottom:0.5rem">Supply Planning</h3>' +
      statStripHtml +
      filterBarHtml +
      tableHtml;

    // ── Wire up filter logic ──
    var activeEnt = 'all';
    var activeCat = 'all';

    function applyFilters() {
      var tbody = document.getElementById('sp-tbody');
      var noResults = document.getElementById('sp-no-results');
      if (!tbody) return;
      // Close all open breakdowns when filter changes
      tbody.querySelectorAll('.sp-breakdown-row').forEach(function (br) { br.remove(); });
      tbody.querySelectorAll('.sp-caret').forEach(function (c) { c.innerHTML = '&#9654;'; });
      var rows = tbody.querySelectorAll('.sp-tr');
      var visible = 0;
      rows.forEach(function (tr) {
        var splitType = tr.getAttribute('data-split-type');
        var cat = tr.getAttribute('data-category');
        var entMatch = activeEnt === 'all' ||
          splitType === activeEnt ||
          splitType === 'split';  // split rows always visible under ent filter
        var catMatch = activeCat === 'all' || cat === activeCat;
        var show = entMatch && catMatch;
        tr.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (noResults) noResults.style.display = visible === 0 ? '' : 'none';
    }

    var bar = document.getElementById('sp-filter-bar');
    if (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('.sp-fbtn');
        if (!btn) return;
        if (btn.classList.contains('sp-fbtn-ent')) {
          bar.querySelectorAll('.sp-fbtn-ent').forEach(function (b) { b.classList.remove('sp-fbtn-active'); });
          btn.classList.add('sp-fbtn-active');
          activeEnt = btn.getAttribute('data-ent');
        } else if (btn.classList.contains('sp-fbtn-cat')) {
          bar.querySelectorAll('.sp-fbtn-cat').forEach(function (b) { b.classList.remove('sp-fbtn-active'); });
          btn.classList.add('sp-fbtn-active');
          activeCat = btn.getAttribute('data-cat');
        }
        applyFilters();
      });
    }

    // ── Wire up row expand/collapse ──
    var spTbody = document.getElementById('sp-tbody');
    if (spTbody) {
      spTbody.addEventListener('click', function (e) {
        var tr = e.target.closest('.sp-tr-expandable');
        if (!tr) return;
        var pkey = tr.getAttribute('data-pkey');
        var entry = fieldsMap[pkey];
        if (!entry) return;

        var caret = tr.querySelector('.sp-caret');
        var next = tr.nextElementSibling;
        if (next && next.classList.contains('sp-breakdown-row')) {
          // Collapse
          next.remove();
          if (caret) caret.innerHTML = '&#9654;';
          return;
        }

        // Expand — build breakdown table
        var fields = entry.fields.slice().sort(function (a, b) { return (b.acres || 0) - (a.acres || 0); });
        var unit = entry.unit;
        var _showCost = window.APP_ROLE !== 'operator';
        var bdHtml = '<tr class="sp-breakdown-row"><td colspan="7">' +
          '<table class="sp-breakdown-table">' +
          '<thead><tr>' +
            '<th>Field</th><th>Enterprise</th><th>Acres</th><th>Rate/Ac</th>' +
            '<th>Total ' + util.escHtml(unit) + '</th>' +
            (_showCost ? '<th>Cost</th>' : '') +
            '<th>Season</th>' +
          '</tr></thead><tbody>';
        fields.forEach(function (f) {
          bdHtml += '<tr>' +
            '<td>' + util.escHtml(f.fieldName || '') + '</td>' +
            '<td>' + util.escHtml(f.enterprise || '—') + '</td>' +
            '<td>' + util.formatNum(f.acres, 1) + '</td>' +
            '<td>' + util.formatNum(f.rate, 2) + '</td>' +
            '<td>' + util.formatNum(f.qty, 0) + '</td>' +
            (_showCost ? '<td>' + util.formatMoney(f.cost || 0, 0) + '</td>' : '') +
            '<td>' + util.escHtml(f.season || '') + '</td>' +
            '</tr>';
        });
        bdHtml += '</tbody></table></td></tr>';
        tr.insertAdjacentHTML('afterend', bdHtml);
        if (caret) caret.innerHTML = '&#9660;';
      });
    }
  }

  // --- Dashboard row click → navigate to enterprise ---
  document.getElementById('tab-dashboard').addEventListener('click', function (e) {
    var row = e.target.closest('.dash-clickable-row, .dash-clickable-header');
    if (!row) return;
    var idx = parseInt(row.getAttribute('data-enterprise-idx'), 10);
    if (idx >= 0 && window.refData.enterprises[idx]) {
      if (typeof window.activateEnterprise === 'function') {
        window.activateEnterprise(idx);
      } else {
        location.hash = 'enterprise-' + idx;
        window.dispatchEvent(new CustomEvent('tab-activate', {
          detail: { tab: 'enterprise', enterpriseIdx: idx }
        }));
      }
    }
  });

  // --- Acre Reconciliation ---
  function loadReconciliation() {
    api.get('/api/dashboard/reconciliation').then(function (data) {
      var tbody = document.getElementById('dash-recon-tbody');
      var badge = document.getElementById('dash-recon-badge');
      var summary = document.getElementById('dash-recon-summary');
      if (!tbody) return;

      var html = '';
      data.rows.forEach(function (r) {
        var statusBadge = '';
        var statusColor = '';
        if (r.status === 'matched') { statusBadge = 'Matched'; statusColor = '#4af626'; }
        else if (r.status === 'under') { statusBadge = 'Under'; statusColor = '#ff9800'; }
        else if (r.status === 'over') { statusBadge = 'Over'; statusColor = '#ff6e40'; }
        else if (r.status === 'missing') { statusBadge = 'No Budget'; statusColor = '#888'; }

        var subDetail = '';
        if (r.subFields.length > 1) {
          // Double-crop: same field name repeated — show crops instead of names
          var isDoubleCrop = r.cropCount > 1;
          var parts = isDoubleCrop
            ? r.subFields.filter(function (sf) { return !sf.splitGroupId; }).map(function (sf) { return util.escHtml(sf.crop || sf.name); })
            : r.subFields.map(function (sf) { return util.escHtml(sf.name) + ': ' + util.formatNum(sf.acres, 1) + ' ac'; });
          var label = isDoubleCrop ? ' <span style="color:#8ab4cc;font-size:0.68rem">(double crop: ' + parts.join(' + ') + ')</span>' : '';
          subDetail = isDoubleCrop
            ? '<div style="font-size:0.7rem;color:#8ab4cc;margin-top:0.1rem">double crop: ' + parts.join(' + ') + '</div>'
            : '<div style="font-size:0.7rem;color:#888;margin-top:0.15rem">' + parts.join(', ') + '</div>';
        }

        html += '<tr>' +
          '<td>' + util.escHtml(r.registryField) + subDetail + '</td>' +
          '<td class="number">' + util.formatNum(r.registryAcres, 2) + '</td>' +
          '<td class="number">' + util.formatNum(r.budgetAcres, 2) + '</td>' +
          '<td class="number" style="color:' + (Math.abs(r.delta) < 0.02 ? 'inherit' : r.delta > 0 ? '#ff6e40' : '#ff9800') + '">' +
            (r.delta > 0 ? '+' : '') + util.formatNum(r.delta, 2) + '</td>' +
          '<td><span style="color:' + statusColor + ';font-size:0.75rem;font-weight:600">' + statusBadge + '</span></td>' +
        '</tr>';
      });
      tbody.innerHTML = html;

      if (badge) {
        badge.textContent = '(' + data.matched + ' of ' + data.total + ' matched)';
        badge.style.color = data.matched === data.total ? '#4af626' : '#ff9800';
      }
      if (summary) {
        var totalRegAcres = data.rows.reduce(function (s, r) { return s + r.registryAcres; }, 0);
        var totalBudgetAcres = data.rows.reduce(function (s, r) { return s + r.budgetAcres; }, 0);
        summary.textContent = data.matched + ' of ' + data.total + ' fields reconciled | Registry: ' +
          util.formatNum(totalRegAcres, 1) + ' ac | Budget: ' + util.formatNum(totalBudgetAcres, 1) + ' ac';
      }
    }).catch(function () {
      var tbody = document.getElementById('dash-recon-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="color:#888">Registry unavailable</td></tr>';
    });
  }

  // Load reconciliation when dashboard tab activates
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'dashboard') {
      loadReconciliation();
    }
  });

  // --- Sync All from Registry ---
  document.getElementById('btn-sync-all-registry').addEventListener('click', function () {
    var btn = document.getElementById('btn-sync-all-registry');
    btn.disabled = true;
    btn.textContent = 'Syncing...';
    api.post('/api/fields/sync-registry').then(function (result) {
      var msg = 'Synced ' + result.synced.length + ' fields';
      if (result.unmatched.length) {
        msg += ', ' + result.unmatched.length + ' unmatched';
      }
      if (result.unchanged.length) {
        msg += ', ' + result.unchanged.length + ' unchanged';
      }
      if (result.splitWarnings && result.splitWarnings.length) {
        msg += ', ' + result.splitWarnings.length + ' split allocation warning(s)';
      }
      util.showToast(msg);
      // Reload reference data and refresh dashboard
      if (window.reloadRefData) {
        window.reloadRefData().then(function () {
          window.dispatchEvent(new CustomEvent('tab-activate', { detail: { tab: 'dashboard' } }));
        });
      }
    }).catch(function () {
      util.showToast('Registry sync failed — is Farm Registry running?');
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'Sync All from Registry';
    });
  });

  // --- Export Production by Crop Type as CSV ---
  document.getElementById('btn-export-production').addEventListener('click', function () {
    var tbody = document.getElementById('dash-production-tbody');
    if (!tbody) return;

    var rows = [['Type', 'Crop', 'Acres', 'Total Production', 'Avg Yield']];

    tbody.querySelectorAll('tr').forEach(function (tr) {
      if (tr.classList.contains('total-row')) return;

      var cells = tr.querySelectorAll('td');
      if (!cells.length) return;

      var isType = tr.classList.contains('prod-type-row');
      var isSub = tr.classList.contains('prod-sub-row');

      var typeName = '';
      var cropName = '';

      if (isType) {
        var swatch = cells[0].querySelector('.prod-type-swatch');
        typeName = swatch ? swatch.textContent.trim() : cells[0].textContent.trim();
        cropName = typeName;
      } else if (isSub) {
        typeName = tr.getAttribute('data-parent') || '';
        cropName = cells[0].textContent.trim();
      }

      var acres = cells[1] ? cells[1].textContent.trim() : '';
      var production = cells[2] ? cells[2].textContent.trim() : '';
      var avgYield = cells[3] ? cells[3].textContent.trim() : '';

      rows.push([typeName, cropName, acres, production, avgYield]);
    });

    var csv = rows.map(function (r) {
      return r.map(function (c) {
        return '"' + String(c).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');

    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'production-by-crop-type-' + (window.refData.settings.year || 2026) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    util.showToast('CSV exported');
  });
})();
