/* settlement-summary.js — Settlement financial summary UI module
 * Follows the same vanilla JS IIFE pattern as settlements.js and farms.js
 * Renders a per-buyer-per-crop revenue table with contract price variance
 * in the #settlement-summary-container div at the top of the settlements tab.
 */
(function () {
  'use strict';

  var summaryInitialized = false;

  // --- Crop year helper (same harvest-season logic as settlements.js) ---
  function getCropYear() {
    var now = new Date();
    var month = now.getMonth() + 1; // 1-12
    var year = now.getFullYear();
    // Jan-May = late delivery from prior harvest season
    return (month >= 1 && month <= 5) ? year - 1 : year;
  }

  // --- Formatting helpers ---
  function fmtBu(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function fmtDollars(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPrice(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + Number(n).toFixed(4);
  }

  function fmtVariance(n) {
    if (n == null || isNaN(n)) return null;
    var v = Number(n);
    var sign = v >= 0 ? '+' : '';
    return sign + '$' + Math.abs(v).toFixed(4);
  }

  // --- Listen for tab-activate event ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'settlements') {
      initSettlementSummary();
    }
  });

  // --- One-time initialization ---
  function initSettlementSummary() {
    if (summaryInitialized) return;
    summaryInitialized = true;

    var container = document.getElementById('settlement-summary-container');
    if (!container) return;

    // Inject styles once
    var styleEl = document.createElement('style');
    styleEl.textContent = [
      '#settlement-summary-container { font-family: inherit; }',
      '#settlement-summary-container .ss-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }',
      '#settlement-summary-container .ss-header h3 { margin: 0; font-size: 1rem; color: var(--accent, #C8860A); font-weight: 600; letter-spacing: 0.03em; }',
      '#settlement-summary-container .ss-year-select { background: var(--surface, #0e0c0b); color: var(--text, #e8d8c0); border: 1px solid var(--border, #2a2218); padding: 4px 8px; font-size: 0.85rem; border-radius: 3px; cursor: pointer; }',
      '#settlement-summary-container .ss-table-wrap { overflow-x: auto; }',
      '#settlement-summary-container .ss-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }',
      '#settlement-summary-container .ss-table th { background: var(--surface, #0e0c0b); color: var(--text, #e8d8c0); font-weight: 600; padding: 7px 10px; border-bottom: 2px solid var(--border, #2a2218); white-space: nowrap; }',
      '#settlement-summary-container .ss-table th.num { text-align: right; }',
      '#settlement-summary-container .ss-table td { padding: 6px 10px; border-bottom: 1px solid var(--border, #2a2218); color: var(--text, #e8d8c0); white-space: nowrap; }',
      '#settlement-summary-container .ss-table td.num { text-align: right; font-variant-numeric: tabular-nums; }',
      '#settlement-summary-container .ss-table tr:last-child td { border-bottom: none; }',
      '#settlement-summary-container .ss-table tr:hover td { background: rgba(200,134,10,0.06); }',
      '#settlement-summary-container .variance-positive { color: var(--green, #7A9E7E); font-weight: 600; }',
      '#settlement-summary-container .variance-negative { color: #c44; font-weight: 600; }',
      '#settlement-summary-container .variance-none { color: var(--muted, #6a5a4a); }',
      '#settlement-summary-container .ss-totals { display: flex; gap: 24px; margin-top: 10px; padding: 8px 10px; border-top: 2px solid var(--accent, #C8860A); background: var(--surface, #0e0c0b); font-size: 0.85rem; font-weight: 600; color: var(--text, #e8d8c0); }',
      '#settlement-summary-container .ss-totals span { white-space: nowrap; }',
      '#settlement-summary-container .ss-note { font-size: 0.78rem; color: var(--muted, #6a5a4a); margin-top: 6px; }',
      '#settlement-summary-container .ss-empty { color: var(--muted, #6a5a4a); font-size: 0.9rem; padding: 16px 0; }',
      '#settlement-summary-container .ss-loading { color: var(--muted, #6a5a4a); font-size: 0.85rem; padding: 12px 0; }'
    ].join('\n');
    document.head.appendChild(styleEl);

    // Header row: title + year selector
    var header = document.createElement('div');
    header.className = 'ss-header';

    var title = document.createElement('h3');
    title.textContent = 'Financial Summary';
    header.appendChild(title);

    var yearSelect = document.createElement('select');
    yearSelect.className = 'ss-year-select';
    yearSelect.setAttribute('aria-label', 'Crop year');
    var currentYear = getCropYear();
    for (var y = currentYear; y >= 2023; y--) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y + ' Crop Year';
      if (y === currentYear) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    header.appendChild(yearSelect);
    container.appendChild(header);

    // Table container
    var tableWrap = document.createElement('div');
    tableWrap.className = 'ss-table-wrap';
    tableWrap.id = 'ss-table-wrap';
    container.appendChild(tableWrap);

    // Totals row (below table)
    var totalsDiv = document.createElement('div');
    totalsDiv.className = 'ss-totals';
    totalsDiv.id = 'ss-totals';
    totalsDiv.style.display = 'none';
    container.appendChild(totalsDiv);

    // Notes area (portal offline message)
    var noteDiv = document.createElement('div');
    noteDiv.className = 'ss-note';
    noteDiv.id = 'ss-note';
    container.appendChild(noteDiv);

    // Wire year selector
    yearSelect.addEventListener('change', function () {
      loadSummary(parseInt(yearSelect.value, 10));
    });

    // Initial load
    loadSummary(currentYear);
  }

  // --- Load summary data from API ---
  function loadSummary(cropYear) {
    var tableWrap = document.getElementById('ss-table-wrap');
    var totalsDiv = document.getElementById('ss-totals');
    var noteDiv = document.getElementById('ss-note');
    if (!tableWrap) return;

    // Show loading state
    tableWrap.innerHTML = '';
    var loading = document.createElement('div');
    loading.className = 'ss-loading';
    loading.textContent = 'Loading...';
    tableWrap.appendChild(loading);
    if (totalsDiv) totalsDiv.style.display = 'none';
    if (noteDiv) noteDiv.textContent = '';

    var url = '/api/settlement-summary?cropYear=' + cropYear;
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderSummaryTable(data.summary || [], data.contractsAvailable !== false);
      })
      .catch(function (err) {
        tableWrap.innerHTML = '';
        var errMsg = document.createElement('div');
        errMsg.className = 'ss-empty';
        errMsg.textContent = 'Unable to load settlement summary.';
        tableWrap.appendChild(errMsg);
        console.warn('[settlement-summary] fetch error:', err);
      });
  }

  // --- Render the summary table ---
  function renderSummaryTable(rows, contractsAvailable) {
    var tableWrap = document.getElementById('ss-table-wrap');
    var totalsDiv = document.getElementById('ss-totals');
    var noteDiv = document.getElementById('ss-note');

    tableWrap.innerHTML = '';

    if (!rows || rows.length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.className = 'ss-empty';
      emptyMsg.textContent = 'No settlement data for this crop year.';
      tableWrap.appendChild(emptyMsg);
      if (totalsDiv) totalsDiv.style.display = 'none';
      if (noteDiv) noteDiv.textContent = '';
      return;
    }

    // Sort rows: buyer asc, then crop asc
    var sorted = rows.slice().sort(function (a, b) {
      var buyerCmp = (a.buyerName || '').localeCompare(b.buyerName || '');
      if (buyerCmp !== 0) return buyerCmp;
      return (a.crop || '').localeCompare(b.crop || '');
    });

    // Build table
    var table = document.createElement('table');
    table.className = 'ss-table';

    // Header
    var thead = document.createElement('thead');
    var hrow = document.createElement('tr');
    var headers = [
      { label: 'Buyer', cls: '' },
      { label: 'Crop', cls: '' },
      { label: 'Delivered BU', cls: 'num' },
      { label: 'Avg Price/BU', cls: 'num' },
      { label: 'Contract Price', cls: 'num' },
      { label: 'Variance', cls: 'num' },
      { label: 'Deductions', cls: 'num' },
      { label: 'Net Payment', cls: 'num' }
    ];
    headers.forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h.label;
      if (h.cls) th.className = h.cls;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement('tbody');
    sorted.forEach(function (row) {
      var tr = document.createElement('tr');

      // Buyer
      var tdBuyer = document.createElement('td');
      tdBuyer.textContent = row.buyerName || '—';
      tr.appendChild(tdBuyer);

      // Crop
      var tdCrop = document.createElement('td');
      tdCrop.textContent = row.crop || '—';
      tr.appendChild(tdCrop);

      // Delivered BU
      var tdBu = document.createElement('td');
      tdBu.className = 'num';
      tdBu.textContent = fmtBu(row.deliveredBushels);
      tr.appendChild(tdBu);

      // Avg Price/BU
      var tdAvg = document.createElement('td');
      tdAvg.className = 'num';
      tdAvg.textContent = fmtPrice(row.avgPricePerBushel);
      tr.appendChild(tdAvg);

      // Contract Price
      var tdContract = document.createElement('td');
      tdContract.className = 'num';
      tdContract.textContent = row.contractPricePerBushel != null ? fmtPrice(row.contractPricePerBushel) : '—';
      if (row.contractPricePerBushel == null) {
        tdContract.style.color = 'var(--muted, #6a5a4a)';
      }
      tr.appendChild(tdContract);

      // Variance
      var tdVariance = document.createElement('td');
      tdVariance.className = 'num';
      if (row.priceVariance != null) {
        var varText = fmtVariance(row.priceVariance);
        tdVariance.textContent = varText;
        if (Number(row.priceVariance) >= 0) {
          tdVariance.className += ' variance-positive';
        } else {
          tdVariance.className += ' variance-negative';
        }
      } else {
        tdVariance.textContent = '—';
        tdVariance.className += ' variance-none';
      }
      tr.appendChild(tdVariance);

      // Deductions
      var tdDeductions = document.createElement('td');
      tdDeductions.className = 'num';
      tdDeductions.textContent = fmtDollars(row.totalDeductions);
      tr.appendChild(tdDeductions);

      // Net Payment
      var tdNet = document.createElement('td');
      tdNet.className = 'num';
      tdNet.textContent = fmtDollars(row.netPayment);
      tr.appendChild(tdNet);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    // Compute grand totals
    var totalBu = 0;
    var totalDeductions = 0;
    var totalNet = 0;
    sorted.forEach(function (row) {
      totalBu += Number(row.deliveredBushels) || 0;
      totalDeductions += Number(row.totalDeductions) || 0;
      totalNet += Number(row.netPayment) || 0;
    });

    // Render totals
    if (totalsDiv) {
      totalsDiv.innerHTML = '';

      var spanBu = document.createElement('span');
      spanBu.textContent = 'Total: ' + fmtBu(totalBu) + ' BU';
      totalsDiv.appendChild(spanBu);

      var spanDed = document.createElement('span');
      spanDed.textContent = 'Total Deductions: ' + fmtDollars(totalDeductions);
      totalsDiv.appendChild(spanDed);

      var spanNet = document.createElement('span');
      spanNet.textContent = 'Net Payment: ' + fmtDollars(totalNet);
      totalsDiv.appendChild(spanNet);

      totalsDiv.style.display = 'flex';
    }

    // Portal offline note
    if (noteDiv) {
      noteDiv.textContent = contractsAvailable
        ? ''
        : 'Contract prices unavailable — portal unreachable';
    }
  }

})();
