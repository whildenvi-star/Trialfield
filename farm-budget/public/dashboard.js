// Dashboard view — charts, crop tables, cost category rollup
(function () {
  'use strict';

  var charts = {};
  var yieldMode = 'projected';

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

  window.addEventListener('ref-data-loaded', function () {
    var s = window.refData.settings;
    document.getElementById('set-fixed-mach').checked = s.useFixedMachineryRate;
    document.getElementById('set-mach-rate').value = s.fixedMachineryRate || 100;
    document.getElementById('set-fuel-price').value = s.fuelPricePerGal || 5;
    document.getElementById('set-wage-rate').value = s.wageRate || 25;
    document.getElementById('set-carry-months').value = s.carryMonths || 6;
    document.getElementById('dash-year').textContent = s.year || 2026;
    loadDashboard();
  });

  // --- Settings controls ---
  document.getElementById('set-fixed-mach').addEventListener('change', saveSettings);
  document.getElementById('set-mach-rate').addEventListener('change', saveSettings);
  document.getElementById('set-fuel-price').addEventListener('change', saveSettings);
  document.getElementById('set-wage-rate').addEventListener('change', saveSettings);
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
    api.get('/api/dashboard?yieldMode=' + yieldMode).then(function (data) {
      var mode = data.yieldMode || 'projected';
      renderCropTable('dash-conv-tbody', 'dash-conv-info', 'chart-conv-acres', 'convAcres', data.conventional, mode);
      renderCropTable('dash-org-tbody', 'dash-org-info', 'chart-org-acres', 'orgAcres', data.organic, mode);
      renderRollup(data);
      renderSummaryCharts(data);
      renderProductionByType(data);
      updateYieldHeaders(mode);
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
    var cropAcres = [];

    entries.forEach(function (entry) {
      entry.cropRows.forEach(function (row) {
        totalAcres += row.acres;
        cropCount++;
        cropLabels.push(row.crop);
        cropAcres.push(row.acres);
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

        html += '<tr>' +
          '<td>' + util.escHtml(row.crop) + '</td>' +
          '<td class="number">' + util.formatNum(row.acres, 1) + '</td>' +
          '<td class="number">' + yieldText + '</td>' +
          '<td class="number ' + profitCls + '">' + util.formatMoney(row.profitPerAcre) + '</td>' +
          '<td class="number ' + copCls + '">' + util.formatMoney(row.cop) + '/' + util.escHtml(row.unit) + '</td>' +
          '</tr>';
      });
    });

    html += '<tr class="total-row"><td>TOTAL</td><td class="number">' +
      util.formatNum(totalAcres, 1) + '</td><td colspan="3"></td></tr>';

    tbody.innerHTML = html;
    document.getElementById(infoId).textContent = cropCount + ' crops, ' + util.formatNum(totalAcres, 0) + ' total acres';

    // Doughnut chart — acres by crop
    if (cropLabels.length > 0) {
      var t = ct();
      var pal = getPalette();
      upsertChart(chartKey, chartId, 'doughnut', {
        labels: cropLabels,
        datasets: [{
          data: cropAcres,
          backgroundColor: cropLabels.map(function (label, i) {
            return typeof CropColors !== 'undefined' ? CropColors.getCropColor(label) : pal[i % pal.length];
          }),
          borderWidth: 1,
          borderColor: t.sliceBorder
        }]
      }, {
        responsive: false,
        cutout: '55%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 8, font: { size: 9 }, color: t.legendColor, padding: 5 } },
          tooltip: {
            backgroundColor: t.tooltipBg,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            titleColor: t.tooltipTitle,
            bodyColor: t.tooltipBody,
            callbacks: {
              label: function (ctx) { return ctx.label + ': ' + util.formatNum(ctx.raw, 1) + ' ac'; }
            }
          }
        }
      });
    }
  }

  // --- Cost Category Rollup ---
  function renderRollup(data) {
    var enterprises = data.enterpriseSummaries;

    // Build column headers dynamically
    var theadRow = document.getElementById('dash-rollup-thead-row');
    if (theadRow) {
      var hHtml = '<th>Category</th>';
      for (var h = 0; h < enterprises.length; h++) {
        hHtml += '<th>' + util.escHtml(enterprises[h].enterprise.shortName) + '</th>';
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
      { label: 'Total Fert', key: 'fert', bold: true, group: 'fert', groupLast: true, subtotal: true },
      // Seed
      { label: 'Seed', key: 'seed', group: 'seed', groupFirst: true, groupLast: true },
      // Operations group
      { label: 'Machinery', key: 'machinery', group: 'ops', groupFirst: true },
      { label: 'Labor & Overhead', key: 'laborOverhead', group: 'ops' },
      { label: 'Fuel', key: 'fuel', group: 'ops' },
      { label: 'Drying', key: 'drying', group: 'ops', groupLast: true },
      // Carrying costs group
      { label: 'Interest', key: 'interest', group: 'carry', groupFirst: true },
      { label: 'Crop Insurance Premiums', key: 'insurance', group: 'carry', groupLast: true },
      // Summary totals (core farming KPIs: crop revenue − expenses)
      { label: 'Total Expenses', key: 'expTotal', highlight: true, group: 'summary', groupFirst: true },
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
      // Build row classes
      var classes = ['rollup-row'];
      if (cat.group) classes.push('rg-' + cat.group);
      if (cat.groupFirst) classes.push('rg-first');
      if (cat.groupLast) classes.push('rg-last');
      if (cat.highlight) classes.push('row-highlight');
      if (cat.subtotal) classes.push('rg-subtotal');

      html += '<tr class="' + classes.join(' ') + '">';

      // Label cell
      var labelCls = '';
      if (cat.indent) labelCls = 'rg-indent';
      else if (cat.bold || cat.highlight) labelCls = 'bold';
      html += '<td class="' + labelCls + '">' + cat.label + '</td>';

      var total = 0;
      for (var i = 0; i < enterprises.length; i++) {
        var val = enterprises[i].totals[cat.key] || 0;
        total += val;
        var cellCls = 'number';
        if (cat.profit) cellCls += ' ' + util.profitClass(val);
        if (cat.bold || cat.highlight) cellCls += ' bold';
        if (cat.fmt === 'num') {
          html += '<td class="' + cellCls + '">' + util.formatNum(val, 1) + '</td>';
        } else {
          html += '<td class="' + cellCls + '">' + util.formatMoney(val, 0) + '</td>';
        }
      }

      var totalCls = 'number bold';
      if (cat.profit) totalCls += ' ' + util.profitClass(total);
      if (cat.fmt === 'num') {
        html += '<td class="' + totalCls + '">' + util.formatNum(total, 1) + '</td>';
      } else {
        html += '<td class="' + totalCls + '">' + util.formatMoney(total, 0) + '</td>';
      }
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  // --- Summary Charts ---
  function renderSummaryCharts(data) {
    var enterprises = data.enterpriseSummaries;
    var grand = data.grandTotals;

    // Bar chart: expenses vs income by enterprise
    var labels = enterprises.map(function (e) { return e.enterprise.shortName; });
    var expData = enterprises.map(function (e) { return e.totals.expTotal; });
    var incData = enterprises.map(function (e) { return e.totals.incomeWithPayments; });

    var t = ct();
    upsertChart('entBars', 'chart-ent-bars', 'bar', {
      labels: labels,
      datasets: [
        { label: 'Expenses', data: expData, backgroundColor: t.expBar, borderColor: t.expBorder, borderWidth: 1, borderRadius: 2 },
        { label: 'Income', data: incData, backgroundColor: t.incBar, borderColor: t.incBorder, borderWidth: 1, borderRadius: 2 }
      ]
    }, {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 }, color: t.legendColor } },
        tooltip: {
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          borderWidth: 1,
          titleColor: t.tooltipTitle,
          bodyColor: t.tooltipBody,
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ': ' + util.formatMoney(ctx.raw, 0); }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: function (v) { return v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + v; },
            font: { size: 10 },
            color: t.tickColor
          },
          grid: { color: t.gridColor }
        },
        x: {
          ticks: { font: { size: 9 }, color: t.tickColor },
          grid: { display: false }
        }
      }
    });

    // Doughnut: expense breakdown by category (farm-wide)
    var expCategories = [
      { label: 'Rent', val: grand.rent },
      { label: 'Fertilizer', val: grand.fert },
      { label: 'Seed', val: grand.seed },
      { label: 'Machinery', val: grand.machinery },
      { label: 'Labor & OH', val: grand.laborOverhead },
      { label: 'Fuel', val: grand.fuel },
      { label: 'Drying', val: grand.drying },
      { label: 'Interest', val: grand.interest },
      { label: 'Crop Ins.', val: grand.insurance }
    ];

    var pal = getPalette();
    upsertChart('expDoughnut', 'chart-exp-doughnut', 'doughnut', {
      labels: expCategories.map(function (c) { return c.label; }),
      datasets: [{
        data: expCategories.map(function (c) { return Math.round(c.val || 0); }),
        backgroundColor: pal.slice(0, expCategories.length),
        borderWidth: 1,
        borderColor: t.sliceBorder
      }]
    }, {
      responsive: false,
      cutout: '45%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 8, font: { size: 10 }, color: t.legendColor, padding: 6 } },
        tooltip: {
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          borderWidth: 1,
          titleColor: t.tooltipTitle,
          bodyColor: t.tooltipBody,
          callbacks: {
            label: function (ctx) { return ctx.label + ': ' + util.formatMoney(ctx.raw, 0); }
          }
        }
      }
    });
  }
  // --- Production by Crop Type ---
  function renderProductionByType(data) {
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

      // Type header row
      html += '<tr class="prod-type-row" data-type="' + util.escHtml(typeName) + '">';
      html += '<td class="prod-type-name">' +
        (hasMultiple ? '<span class="prod-type-toggle" title="Expand">&#9654;</span>' : '<span class="prod-type-toggle-spacer"></span>') +
        '<span class="prod-type-swatch" style="background:' + typeColor + ';color:' + textColor + '">' + util.escHtml(typeName) + '</span></td>';
      html += '<td class="number bold">' + util.formatNum(g.totalAcres, 1) + '</td>';
      html += '<td class="number bold">' + util.formatNum(g.totalBu, 0) + ' ' + util.escHtml(g.unit) + '</td>';
      html += '<td class="number bold">' + util.formatNum(avgYield, 1) + ' ' + util.escHtml(g.unit) + '/ac</td>';
      html += '</tr>';

      // Sub-crop rows (hidden by default if multiple)
      g.subCrops.sort(function (a, b) { return b.acres - a.acres; });
      g.subCrops.forEach(function (sc) {
        var scColor = hasCropColors ? CropColors.getCropColor(sc.crop) : '#999';
        var scAvg = sc.acres > 0 ? sc.totalBu / sc.acres : 0;
        html += '<tr class="prod-sub-row' + (hasMultiple ? ' hidden' : '') + '" data-parent="' + util.escHtml(typeName) + '">';
        html += '<td class="prod-sub-name"><span class="prod-sub-dot" style="background:' + scColor + '"></span>' + util.escHtml(sc.crop) + '</td>';
        html += '<td class="number">' + util.formatNum(sc.acres, 1) + '</td>';
        html += '<td class="number">' + util.formatNum(sc.totalBu, 0) + ' ' + util.escHtml(sc.unit) + '</td>';
        html += '<td class="number">' + util.formatNum(scAvg, 1) + ' ' + util.escHtml(sc.unit) + '/ac</td>';
        html += '</tr>';
      });
    });

    // Farm total row
    html += '<tr class="total-row"><td>TOTAL</td>';
    html += '<td class="number">' + util.formatNum(farmTotalAcres, 1) + '</td>';
    html += '<td class="number">' + util.formatNum(farmTotalBu, 0) + '</td>';
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
          subDetail = '<div style="font-size:0.7rem;color:#888;margin-top:0.15rem">' +
            r.subFields.map(function (sf) { return sf.name + ': ' + util.formatNum(sf.acres, 1); }).join(', ') +
            '</div>';
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
})();
