// Hedging Strategy Assessment Tool
(function () {
  'use strict';

  var dashData = null;
  var salesData = [];
  var buyersData = [];
  var cropAggregates = {};
  var orphanCrops = {};

  // hedging.js now renders into mtab-whatif / mtab-basis (managed by sales-marketing.js tab switcher)
  // The old .hedging-tab-btn / .htab-content selectors are no longer used.

  // Listen for data from sales module
  window.addEventListener('hedging-data-ready', function (e) {
    dashData = e.detail.dashboard;
    salesData = e.detail.sales;
    buildAggregates();
    renderCoverage();
    populateCropSelectors();
    loadBuyersAndRenderBasis();
  });

  function buildAggregates() {
    cropAggregates = {};

    // Build from dashboard cropRows across all enterprises
    dashData.enterpriseSummaries.forEach(function (es) {
      es.cropRows.forEach(function (cr) {
        if (!cropAggregates[cr.crop]) {
          cropAggregates[cr.crop] = {
            crop: cr.crop,
            projectedTotal: 0,
            acres: 0,
            unit: cr.unit,
            totalExpense: 0,
            amountSold: 0,
            totalSaleValue: 0,
            contractCount: 0,
            cop: 0,
            avgPrice: 0,
            remaining: 0,
            pctSold: 0,
            margin: 0,
            breakeven: 0
          };
        }
        cropAggregates[cr.crop].projectedTotal += cr.projectedTotal;
        cropAggregates[cr.crop].acres += cr.acres;
      });
    });

    // COP = weighted average across enterprises (cop * projectedTotal)
    Object.keys(cropAggregates).forEach(function (crop) {
      var agg = cropAggregates[crop];
      var totalExpense = 0;
      var totalYield = 0;
      dashData.enterpriseSummaries.forEach(function (es) {
        es.cropRows.forEach(function (cr) {
          if (cr.crop === crop) {
            totalExpense += cr.cop * cr.projectedTotal;
            totalYield += cr.projectedTotal;
          }
        });
      });
      agg.cop = totalYield > 0 ? totalExpense / totalYield : 0;
      agg.totalExpense = totalExpense;
    });

    // Merge sales data + detect orphan contracts
    orphanCrops = {};
    salesData.forEach(function (s) {
      var crop = s.crop || 'Unknown';
      if (!cropAggregates[crop]) {
        // Contract for a crop with no planted acres
        if (!orphanCrops[crop]) orphanCrops[crop] = { crop: crop, contractCount: 0, amountSold: 0 };
        orphanCrops[crop].contractCount++;
        orphanCrops[crop].amountSold += s.amount || 0;
        return;
      }
      cropAggregates[crop].amountSold += s.amount || 0;
      cropAggregates[crop].totalSaleValue += (s.amount || 0) * (s.price || 0);
      cropAggregates[crop].contractCount++;
    });

    // Derived values
    Object.keys(cropAggregates).forEach(function (crop) {
      var a = cropAggregates[crop];
      a.avgPrice = a.amountSold > 0 ? a.totalSaleValue / a.amountSold : 0;
      a.remaining = a.projectedTotal - a.amountSold;
      a.pctSold = a.projectedTotal > 0 ? (a.amountSold / a.projectedTotal) * 100 : 0;
      a.margin = a.avgPrice - a.cop;
      // Breakeven = (totalExpense - revenueAlreadySold) / remainingBushels
      a.breakeven = a.remaining > 0 ? (a.totalExpense - a.totalSaleValue) / a.remaining : 0;
    });
  }

  // =============================================
  // CONTRACT COVERAGE
  // =============================================
  function renderCoverage() {
    var grid = document.getElementById('coverage-grid');
    var tbody = document.getElementById('coverage-detail-tbody');
    var gridHtml = '';
    var tableHtml = '';
    var crops = Object.keys(cropAggregates).sort();

    crops.forEach(function (crop) {
      var a = cropAggregates[crop];
      if (a.projectedTotal <= 0) return;

      var pct = Math.min(a.pctSold, 100);
      var barColor = pct >= 75 ? 'var(--success)' : pct >= 40 ? '#ffb800' : '#ff3b30';

      gridHtml += '<div class="coverage-card">' +
        '<div class="coverage-card-title">' + util.escHtml(crop) + '</div>' +
        '<div class="coverage-bar">' +
          '<div class="coverage-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div>' +
          '<span class="coverage-bar-label">' + util.formatNum(pct, 1) + '% sold</span>' +
        '</div>' +
        '<div class="coverage-card-stats">' +
          '<span>' + util.formatNum(a.amountSold, 0) + ' / ' + util.formatNum(a.projectedTotal, 0) + ' ' + a.unit + '</span>' +
          '<span>Avg: ' + util.formatMoney(a.avgPrice) + '</span>' +
        '</div>' +
      '</div>';

      var marginCls = a.margin >= 0 ? 'profit-pos' : 'profit-neg';
      var breakevenCls = a.breakeven > 0 && a.breakeven <= a.cop ? 'profit-pos' :
                         a.breakeven > a.cop * 1.2 ? 'profit-neg' : '';

      tableHtml += '<tr>' +
        '<td>' + util.escHtml(crop) + '</td>' +
        '<td class="number">' + util.formatNum(a.projectedTotal, 0) + '</td>' +
        '<td class="number">' + util.formatNum(a.amountSold, 0) + '</td>' +
        '<td class="number">' + util.formatNum(a.pctSold, 1) + '%</td>' +
        '<td class="number">' + util.formatMoney(a.avgPrice) + '</td>' +
        '<td class="number">' + util.formatMoney(a.cop) + '</td>' +
        '<td class="number ' + marginCls + '">' + (a.amountSold > 0 ? util.formatMoney(a.margin) : '--') + '</td>' +
        '<td class="number">' + util.formatNum(a.remaining, 0) + '</td>' +
        '<td class="number ' + breakevenCls + '">' + (a.remaining > 0 ? util.formatMoney(a.breakeven) : '--') + '</td>' +
        '</tr>';
    });

    // Orphan contract warnings
    Object.keys(orphanCrops).sort().forEach(function (crop) {
      var o = orphanCrops[crop];
      gridHtml += '<div class="coverage-card coverage-warning">' +
        '<div class="coverage-card-title" style="color:#e65100">&#9888; ' + util.escHtml(crop) + '</div>' +
        '<div class="coverage-warning-text">' + o.contractCount + ' contract(s) for ' +
        util.formatNum(o.amountSold, 0) + ' units — no acres planted</div></div>';
      tableHtml += '<tr class="warning-row">' +
        '<td style="color:#e65100">&#9888; ' + util.escHtml(crop) + '</td>' +
        '<td class="number">0</td>' +
        '<td class="number">' + util.formatNum(o.amountSold, 0) + '</td>' +
        '<td colspan="6" style="color:#e65100;font-style:italic">No acres planted for this crop</td>' +
        '</tr>';
    });

    grid.innerHTML = gridHtml || util.emptyState('', 'No crop data', 'Check dashboard for projected yields');
    tbody.innerHTML = tableHtml;
  }

  // =============================================
  // WHAT-IF SCENARIOS
  // =============================================
  function populateCropSelectors() {
    var crops = Object.keys(cropAggregates).sort();
    var opts = crops.map(function (c) {
      return '<option value="' + util.escHtml(c) + '">' + util.escHtml(c) + '</option>';
    }).join('');

    document.getElementById('whatif-crop').innerHTML = opts;
    document.getElementById('basis-crop').innerHTML = opts;
    renderWhatIf();
  }

  var whatifCrop = document.getElementById('whatif-crop');
  var whatifSlider = document.getElementById('whatif-cbot-slider');
  var whatifDisplay = document.getElementById('whatif-cbot-display');

  whatifCrop.addEventListener('change', renderWhatIf);
  whatifSlider.addEventListener('input', function () {
    whatifDisplay.textContent = parseFloat(whatifSlider.value).toFixed(2);
    renderWhatIf();
  });
  document.getElementById('whatif-bear').addEventListener('change', renderWhatIf);
  document.getElementById('whatif-base').addEventListener('change', renderWhatIf);
  document.getElementById('whatif-bull').addEventListener('change', renderWhatIf);

  function getDefaultBasis(crop) {
    var basisSum = 0;
    var basisCount = 0;
    salesData.forEach(function (s) {
      if (s.crop === crop && s.basis) {
        basisSum += s.basis;
        basisCount++;
      }
    });
    return basisCount > 0 ? basisSum / basisCount : -0.25;
  }

  function computeScenario(crop, cbotPrice) {
    var a = cropAggregates[crop];
    if (!a) return null;
    var basis = getDefaultBasis(crop);
    var cashPrice = cbotPrice + basis;
    var unsoldRevenue = a.remaining * cashPrice;
    var totalRevenue = a.totalSaleValue + unsoldRevenue;
    var totalProfit = totalRevenue - a.totalExpense;
    var profitPerAcre = a.acres > 0 ? totalProfit / a.acres : 0;
    return {
      cbot: cbotPrice,
      cashPrice: cashPrice,
      unsoldRevenue: unsoldRevenue,
      totalRevenue: totalRevenue,
      totalProfit: totalProfit,
      profitPerAcre: profitPerAcre
    };
  }

  function renderWhatIf() {
    var crop = whatifCrop.value;
    if (!crop || !cropAggregates[crop]) return;

    var cbot = parseFloat(whatifSlider.value) || 4.50;

    // Scenario table: 7 price levels around slider value
    var tbody = document.getElementById('whatif-tbody');
    var html = '';
    var steps = [-1.00, -0.50, -0.25, 0, 0.25, 0.50, 1.00];
    steps.forEach(function (offset) {
      var price = Math.round((cbot + offset) * 100) / 100;
      if (price <= 0) return;
      var s = computeScenario(crop, price);
      if (!s) return;
      var isActive = offset === 0 ? ' class="row-highlight"' : '';
      var profitCls = util.profitClass(s.totalProfit);
      html += '<tr' + isActive + '>' +
        '<td class="number">' + util.formatMoney(s.cbot) + '</td>' +
        '<td class="number">' + util.formatMoney(s.cashPrice) + '</td>' +
        '<td class="number">' + util.formatMoney(s.unsoldRevenue, 0) + '</td>' +
        '<td class="number">' + util.formatMoney(s.totalRevenue, 0) + '</td>' +
        '<td class="number ' + profitCls + '">' + util.formatMoney(s.totalProfit, 0) + '</td>' +
        '<td class="number ' + profitCls + '">' + util.formatMoney(s.profitPerAcre) + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    // Bear / Base / Bull
    var bear = parseFloat(document.getElementById('whatif-bear').value) || 3.50;
    var base = parseFloat(document.getElementById('whatif-base').value) || 4.50;
    var bull = parseFloat(document.getElementById('whatif-bull').value) || 5.50;
    var baseScenario = computeScenario(crop, base);

    var compTbody = document.getElementById('whatif-compare-tbody');
    var compHtml = '';
    [{ name: 'Bear', price: bear }, { name: 'Base', price: base }, { name: 'Bull', price: bull }].forEach(function (sc) {
      var s = computeScenario(crop, sc.price);
      if (!s) return;
      var diff = baseScenario ? s.totalProfit - baseScenario.totalProfit : 0;
      var profitCls = util.profitClass(s.totalProfit);
      var diffCls = util.profitClass(diff);
      compHtml += '<tr>' +
        '<td class="bold">' + sc.name + '</td>' +
        '<td class="number">' + util.formatMoney(sc.price) + '</td>' +
        '<td class="number ' + profitCls + '">' + util.formatMoney(s.totalProfit, 0) + '</td>' +
        '<td class="number ' + profitCls + '">' + util.formatMoney(s.profitPerAcre) + '</td>' +
        '<td class="number ' + diffCls + '">' + (sc.name === 'Base' ? '--' : util.formatMoney(diff, 0)) + '</td>' +
        '</tr>';
    });
    compTbody.innerHTML = compHtml;
  }

  // =============================================
  // BASIS COMPARISON
  // =============================================
  function loadBuyersAndRenderBasis() {
    api.get('/api/buyers').then(function (buyers) {
      buyersData = buyers;
      renderBasis();
    });
  }

  document.getElementById('basis-crop').addEventListener('change', renderBasis);

  function renderBasis() {
    var crop = document.getElementById('basis-crop').value;
    if (!crop) return;
    if (!buyersData.length) {
      document.getElementById('basis-tbody').innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:var(--text-light)">No buyers configured. Add buyers in Sales contracts.</td></tr>';
      return;
    }

    // CBOT reference from crop pricing
    var pricing = window.refData.cropPricing.find(function (cp) {
      return (cp.crop || '').toLowerCase() === crop.toLowerCase();
    });
    var cbotRef = pricing ? pricing.pricePerUnit : 0;

    var tbody = document.getElementById('basis-tbody');
    var bestNet = -Infinity;
    var bestIdx = -1;

    var rows = buyersData.map(function (buyer, idx) {
      var basis = buyer.basis || 0;
      var netPrice = cbotRef + basis;
      var loadSize = buyer.loadSize || 1000;
      var rtHours = buyer.rtHours || 1;
      var truckingRate = buyer.truckingRate || 0;
      var truckingPerBu = loadSize > 0 ? (truckingRate * rtHours) / loadSize : 0;
      var dryingRate = buyer.dryingRate || 0;
      var shrinkPct = buyer.shrinkPct || 0;
      var shrinkCost = netPrice * (shrinkPct / 100);
      var netOfCosts = netPrice - truckingPerBu - dryingRate - shrinkCost;

      if (netOfCosts > bestNet) {
        bestNet = netOfCosts;
        bestIdx = idx;
      }

      return {
        buyer: buyer,
        basis: basis,
        netPrice: netPrice,
        loadSize: loadSize,
        rtHours: rtHours,
        truckingPerBu: truckingPerBu,
        dryingRate: dryingRate,
        shrinkPct: shrinkPct,
        netOfCosts: netOfCosts
      };
    });

    var html = '';
    rows.forEach(function (r, idx) {
      var highlight = idx === bestIdx ? ' class="basis-best"' : '';
      html += '<tr' + highlight + '>' +
        '<td>' + util.escHtml(r.buyer.name || 'Buyer ' + (idx + 1)) + '</td>' +
        '<td class="number">' + util.formatMoney(r.basis) + '</td>' +
        '<td class="number">' + util.formatMoney(r.netPrice) + '</td>' +
        '<td class="number">' + util.formatNum(r.loadSize, 0) + '</td>' +
        '<td class="number">' + util.formatNum(r.rtHours, 1) + '</td>' +
        '<td class="number">' + util.formatMoney(r.truckingPerBu, 4) + '</td>' +
        '<td class="number">' + util.formatMoney(r.dryingRate, 4) + '</td>' +
        '<td class="number">' + util.formatNum(r.shrinkPct, 2) + '%</td>' +
        '<td class="number bold">' + util.formatMoney(r.netOfCosts) + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
  }
})();
