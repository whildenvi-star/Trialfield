// Meristem Malt Cost Calculator — Application Logic
(function () {
  'use strict';

  // =============================================
  // API HELPER
  // =============================================
  var B = window.__BASE || '';
  var api = {
    get: function (url) {
      return fetch(B + url).then(function (r) {
        if (!r.ok) throw new Error('API error ' + r.status);
        return r.json();
      });
    },
    put: function (url, data) {
      return fetch(B + url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error('Save error ' + r.status);
        return r.json();
      });
    },
    post: function (url, data) {
      return fetch(B + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error('Sync error ' + r.status);
        return r.json();
      });
    }
  };

  // =============================================
  // UTILITIES
  // =============================================
  function formatMoney(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return '$' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: dec === undefined ? 2 : dec,
      maximumFractionDigits: dec === undefined ? 2 : dec
    });
  }

  function formatNum(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: dec || 0,
      maximumFractionDigits: dec || 0
    });
  }

  function formatPct(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toFixed(1) + '%';
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function generateId(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg, duration, type) {
    var icons = { success: '\u2713', error: '\u2717' };
    var t = type || 'success';
    toastEl.className = 'toast' + (t === 'error' ? ' toast-error' : '');
    toastEl.innerHTML = '<span class="toast-icon">' + (icons[t] || '\u2713') + '</span><span>' + escHtml(msg) + '</span>';
    toastEl.offsetHeight;
    toastEl.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('visible'); }, duration || 2000);
  }

  // =============================================
  // CONSTANTS
  // =============================================
  var BUSHEL_WEIGHTS = { corn: 56, barley: 48, wheat: 60, rye: 56 };

  var GRAIN_TYPE_LABELS = {
    conv_corn: 'Conventional Corn', conv_barley: 'Conventional Barley',
    conv_wheat: 'Conventional Wheat', conv_rye: 'Conventional Rye',
    org_corn: 'Organic Corn', org_barley: 'Organic Barley',
    org_wheat: 'Organic Wheat', org_rye: 'Organic Rye'
  };

  function getGrainBase(grainType) {
    return (grainType || '').replace('conv_', '').replace('org_', '');
  }

  function isOrganic(grainType) {
    return (grainType || '').indexOf('org_') === 0;
  }

  // =============================================
  // STATE
  // =============================================
  var config = null;
  var pricing = null;
  var pricingSync = { lastSyncedAt: null, syncedPrices: {}, manualOverrides: {} };

  // =============================================
  // CALCULATION ENGINE
  // =============================================
  function calcGrainCostPerBatch(cfg) {
    var base = getGrainBase(cfg.grainType);
    var lbsPerBu = BUSHEL_WEIGHTS[base] || 56;
    var bushelsNeeded = (cfg.batchSizeLbs || 0) / lbsPerBu;
    return bushelsNeeded * (cfg.grainCostPerBushel || 0);
  }

  function calcMaltOutputLbs(cfg) {
    return (cfg.batchSizeLbs || 0) * ((cfg.maltYieldPct || 80) / 100);
  }

  function calcTotalEquipmentValue(cfg) {
    var total = 0;
    (cfg.equipment || []).forEach(function (eq) { total += eq.cost || 0; });
    return total;
  }

  function calcEffectiveMaltOutput(cfg) {
    var output = calcMaltOutputLbs(cfg);
    (cfg.forgottenCosts || []).forEach(function (hc) {
      if (hc.id === 'hc_shrink' && hc.enabled && hc.isPercent) {
        output = output * (1 - (hc.amount || 0) / 100);
      }
    });
    return output;
  }

  function calcVariableCostsPerBatch(cfg) {
    var total = 0;
    (cfg.variableCosts || []).forEach(function (vc) {
      if (vc.autoCalc) {
        total += calcGrainCostPerBatch(cfg);
      } else if (vc.laborRate !== undefined && vc.laborHours !== undefined) {
        total += (vc.laborRate || 0) * (vc.laborHours || 0);
      } else {
        total += vc.amount || 0;
      }
    });
    return total;
  }

  function calcFixedCostsAnnual(cfg) {
    var annual = 0;
    (cfg.fixedCosts || []).forEach(function (fc) { annual += fc.amount || 0; });
    return annual;
  }

  function calcEquipmentAnnualAmort(cfg) {
    var annual = 0;
    (cfg.equipment || []).forEach(function (eq) {
      annual += (eq.cost || 0) / (eq.usefulLife || 1);
    });
    return annual;
  }

  function calcForgottenCosts(cfg) {
    var perBatch = 0;
    var annual = 0;
    (cfg.forgottenCosts || []).forEach(function (hc) {
      if (!hc.enabled) return;
      if (hc.isPercent) return; // shrink handled in output reduction
      if (hc.autoCalcPct) {
        annual += calcTotalEquipmentValue(cfg) * (hc.autoCalcPct || 0);
      } else if (hc.perBatch) {
        perBatch += hc.amount || 0;
      } else {
        annual += hc.amount || 0;
      }
    });
    return { perBatch: perBatch, annual: annual };
  }

  function calcFullBreakdown(cfg, pricingData, overrides) {
    var c = JSON.parse(JSON.stringify(cfg));
    if (overrides) {
      if (overrides.batchesPerYear !== undefined) c.batchesPerYear = overrides.batchesPerYear;
      if (overrides.batchSizeLbs !== undefined) c.batchSizeLbs = overrides.batchSizeLbs;
    }

    var bpy = c.batchesPerYear || 1;
    var variablePerBatch = calcVariableCostsPerBatch(c);
    var fixedAnnual = calcFixedCostsAnnual(c);
    var equipAnnual = calcEquipmentAnnualAmort(c);
    var forgotten = calcForgottenCosts(c);

    var fixedPerBatch = fixedAnnual / bpy;
    var equipPerBatch = equipAnnual / bpy;
    var forgottenPerBatch = forgotten.perBatch + (forgotten.annual / bpy);

    var totalCostPerBatch = variablePerBatch + fixedPerBatch + equipPerBatch + forgottenPerBatch;
    var maltOutputLbs = calcEffectiveMaltOutput(c);
    var costPerLb = maltOutputLbs > 0 ? totalCostPerBatch / maltOutputLbs : 0;

    var sellingPricePerLb = (overrides && overrides.sellingPricePerLb !== undefined)
      ? overrides.sellingPricePerLb
      : (pricingData ? (pricingData[c.grainType] || 3) : 3);

    var marginPerLb = sellingPricePerLb - costPerLb;
    var marginPct = sellingPricePerLb > 0 ? (marginPerLb / sellingPricePerLb) * 100 : 0;

    // Break-even batches
    var revenuePerBatch = sellingPricePerLb * maltOutputLbs;
    var contributionPerBatch = revenuePerBatch - variablePerBatch - forgotten.perBatch;
    var totalAnnualFixed = fixedAnnual + equipAnnual + forgotten.annual;
    var breakevenBatches = contributionPerBatch > 0
      ? Math.ceil(totalAnnualFixed / contributionPerBatch) : Infinity;

    // Annual profit
    var annualRevenue = revenuePerBatch * bpy;
    var annualVariableCost = (variablePerBatch + forgotten.perBatch) * bpy;
    var annualProfit = annualRevenue - annualVariableCost - totalAnnualFixed;

    return {
      variablePerBatch: variablePerBatch,
      fixedPerBatch: fixedPerBatch,
      equipPerBatch: equipPerBatch,
      forgottenPerBatch: forgottenPerBatch,
      totalCostPerBatch: totalCostPerBatch,
      maltOutputLbs: maltOutputLbs,
      costPerLb: costPerLb,
      sellingPricePerLb: sellingPricePerLb,
      marginPerLb: marginPerLb,
      marginPct: marginPct,
      breakevenBatches: breakevenBatches,
      annualProfit: annualProfit,
      batchesPerYear: bpy,
      batchSizeLbs: c.batchSizeLbs
    };
  }

  // Impact of a single forgotten cost item on break-even ($/lb)
  function calcForgottenCostImpact(cfg, hc) {
    var output = calcEffectiveMaltOutput(cfg);
    if (output <= 0) return 0;
    var bpy = cfg.batchesPerYear || 1;
    if (hc.isPercent) {
      // Shrink: how much does reducing output raise cost/lb?
      var baseOutput = calcMaltOutputLbs(cfg);
      var reducedOutput = baseOutput * (1 - (hc.amount || 0) / 100);
      if (reducedOutput <= 0 || baseOutput <= 0) return 0;
      var baseCostPerLb = 1 / baseOutput; // normalized
      var newCostPerLb = 1 / reducedOutput;
      var totalCost = calcVariableCostsPerBatch(cfg) +
        calcFixedCostsAnnual(cfg) / bpy +
        calcEquipmentAnnualAmort(cfg) / bpy;
      return totalCost * (newCostPerLb - baseCostPerLb);
    }
    if (hc.autoCalcPct) {
      var annualAmt = calcTotalEquipmentValue(cfg) * (hc.autoCalcPct || 0);
      return (annualAmt / bpy) / output;
    }
    if (hc.perBatch) {
      return (hc.amount || 0) / output;
    }
    return ((hc.amount || 0) / bpy) / output;
  }

  // =============================================
  // RENDERING
  // =============================================

  // --- Dashboard ---
  function renderDashboard(bd) {
    document.getElementById('dash-cost-batch').textContent = formatMoney(bd.totalCostPerBatch);
    document.getElementById('dash-cost-lb').textContent = formatMoney(bd.costPerLb);
    document.getElementById('dash-breakeven').textContent = formatMoney(bd.costPerLb);
    document.getElementById('dash-selling').textContent = formatMoney(bd.sellingPricePerLb);
    document.getElementById('dash-margin-lb').textContent = formatMoney(bd.marginPerLb);
    document.getElementById('dash-margin-pct').textContent = formatPct(bd.marginPct);
    document.getElementById('dash-be-batches').textContent =
      bd.breakevenBatches === Infinity ? 'N/A' : formatNum(bd.breakevenBatches, 0);
    document.getElementById('dash-annual-profit').textContent = formatMoney(bd.annualProfit, 0);

    // Color coding
    setCardClass('card-margin-lb', bd.marginPerLb);
    setCardClass('card-margin-pct', bd.marginPerLb);
    setCardClass('card-be-batches', bd.breakevenBatches <= (config.batchesPerYear || 12) ? 1 : -1);
    setCardClass('card-annual-profit', bd.annualProfit);
  }

  function setCardClass(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('card-positive', 'card-negative');
    if (val > 0) el.classList.add('card-positive');
    else if (val < 0) el.classList.add('card-negative');
  }

  // --- Batch Config ---
  function renderBatchConfig() {
    document.getElementById('cfg-grain-type').value = config.grainType || 'conv_barley';
    document.getElementById('cfg-batch-size').value = config.batchSizeLbs || 500;
    document.getElementById('cfg-yield-pct').value = config.maltYieldPct || 80;
    document.getElementById('cfg-batches-year').value = config.batchesPerYear || 12;
    document.getElementById('cfg-grain-cost').value = config.grainCostPerBushel || 17;
    updateOutputDisplay();
  }

  function updateOutputDisplay() {
    var output = calcMaltOutputLbs(config);
    document.getElementById('cfg-output-lbs').textContent = formatNum(output, 0) + ' lbs';
  }

  ['cfg-grain-type', 'cfg-batch-size', 'cfg-yield-pct', 'cfg-batches-year', 'cfg-grain-cost'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', function () {
      config.grainType = document.getElementById('cfg-grain-type').value;
      config.batchSizeLbs = parseFloat(document.getElementById('cfg-batch-size').value) || 500;
      config.maltYieldPct = parseFloat(document.getElementById('cfg-yield-pct').value) || 80;
      config.batchesPerYear = parseInt(document.getElementById('cfg-batches-year').value) || 12;
      config.grainCostPerBushel = parseFloat(document.getElementById('cfg-grain-cost').value) || 0;
      updateOutputDisplay();
      recalcAll();
    });
  });

  // --- Variable Costs ---
  function renderVariableCosts() {
    var tbody = document.getElementById('var-costs-tbody');
    var html = '';
    var total = 0;

    (config.variableCosts || []).forEach(function (vc, idx) {
      var amt;
      var detailHtml = '';
      if (vc.autoCalc) {
        amt = calcGrainCostPerBatch(config);
        var base = getGrainBase(config.grainType);
        var lbsPerBu = BUSHEL_WEIGHTS[base] || 56;
        var bu = (config.batchSizeLbs || 0) / lbsPerBu;
        detailHtml = '<span class="auto-calc">' + formatNum(bu, 1) + ' bu @ ' + formatMoney(config.grainCostPerBushel) + '/bu</span>';
      } else if (vc.laborRate !== undefined) {
        amt = (vc.laborRate || 0) * (vc.laborHours || 0);
        detailHtml = '<span class="labor-detail">' +
          '$<input type="number" value="' + (vc.laborRate || 0) + '" data-idx="' + idx + '" data-field="laborRate" class="vc-labor-input" step="0.5" min="0">/hr' +
          ' x <input type="number" value="' + (vc.laborHours || 0) + '" data-idx="' + idx + '" data-field="laborHours" class="vc-labor-input" step="0.5" min="0"> hrs</span>';
      } else {
        amt = vc.amount || 0;
        detailHtml = '';
      }
      total += amt;

      var amtClass = vc.autoCalc ? ' class="number auto-calc"' : ' class="number editable" data-idx="' + idx + '" data-field="amount"';
      html += '<tr>' +
        '<td class="editable" data-idx="' + idx + '" data-field="name">' + escHtml(vc.name) + '</td>' +
        '<td>' + detailHtml + '</td>' +
        '<td' + amtClass + '>' + formatMoney(amt) + '</td>' +
        '<td>' + (vc.autoCalc ? '' : '<button class="btn-danger vc-del" data-idx="' + idx + '">X</button>') + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    document.getElementById('var-subtotal').textContent = formatMoney(total);
    document.getElementById('var-total').textContent = formatMoney(total) + '/batch';

    // Event: labor inputs
    tbody.querySelectorAll('.vc-labor-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var idx = parseInt(inp.getAttribute('data-idx'));
        var field = inp.getAttribute('data-field');
        config.variableCosts[idx][field] = parseFloat(inp.value) || 0;
        recalcAll();
      });
    });

    // Event: editable cells
    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('click', function () { startCellEdit(td, 'variableCosts'); });
    });

    // Event: delete
    tbody.querySelectorAll('.vc-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        config.variableCosts.splice(parseInt(btn.getAttribute('data-idx')), 1);
        recalcAll();
      });
    });
  }

  document.getElementById('var-add-btn').addEventListener('click', function () {
    config.variableCosts.push({ id: generateId('vc'), name: 'New Cost', amount: 0, perBatch: true });
    recalcAll();
  });

  // --- Fixed Costs ---
  function renderFixedCosts() {
    var tbody = document.getElementById('fixed-costs-tbody');
    var html = '';
    var totalAnnual = 0;
    var bpy = config.batchesPerYear || 1;

    (config.fixedCosts || []).forEach(function (fc, idx) {
      var amt = fc.amount || 0;
      totalAnnual += amt;
      html += '<tr>' +
        '<td class="editable" data-idx="' + idx + '" data-field="name">' + escHtml(fc.name) + '</td>' +
        '<td class="number editable" data-idx="' + idx + '" data-field="amount">' + formatMoney(amt) + '</td>' +
        '<td class="number">' + formatMoney(amt / bpy) + '</td>' +
        '<td><button class="btn-danger fc-del" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    document.getElementById('fixed-subtotal-annual').textContent = formatMoney(totalAnnual);
    document.getElementById('fixed-subtotal-batch').textContent = formatMoney(totalAnnual / bpy);
    document.getElementById('fixed-total').textContent = formatMoney(totalAnnual) + '/yr';

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('click', function () { startCellEdit(td, 'fixedCosts'); });
    });
    tbody.querySelectorAll('.fc-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        config.fixedCosts.splice(parseInt(btn.getAttribute('data-idx')), 1);
        recalcAll();
      });
    });
  }

  document.getElementById('fixed-add-btn').addEventListener('click', function () {
    config.fixedCosts.push({ id: generateId('fc'), name: 'New Cost', amount: 0 });
    recalcAll();
  });

  // --- Equipment ---
  function renderEquipment() {
    var tbody = document.getElementById('equip-tbody');
    var html = '';
    var totalCost = 0;
    var totalAnnual = 0;
    var bpy = config.batchesPerYear || 1;

    (config.equipment || []).forEach(function (eq, idx) {
      var cost = eq.cost || 0;
      var life = eq.usefulLife || 1;
      var annual = cost / life;
      var perBatch = annual / bpy;
      totalCost += cost;
      totalAnnual += annual;

      html += '<tr>' +
        '<td class="editable" data-idx="' + idx + '" data-field="name">' + escHtml(eq.name) + '</td>' +
        '<td class="number editable" data-idx="' + idx + '" data-field="cost">' + formatMoney(cost) + '</td>' +
        '<td class="number editable" data-idx="' + idx + '" data-field="usefulLife">' + formatNum(life, 0) + '</td>' +
        '<td class="number">' + formatMoney(annual) + '</td>' +
        '<td class="number">' + formatMoney(perBatch) + '</td>' +
        '<td><button class="btn-danger eq-del" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    document.getElementById('equip-total-cost').textContent = formatMoney(totalCost);
    document.getElementById('equip-total-annual').textContent = formatMoney(totalAnnual);
    document.getElementById('equip-total-batch').textContent = formatMoney(totalAnnual / bpy);
    document.getElementById('equip-total').textContent = formatMoney(totalAnnual) + '/yr';

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('click', function () { startCellEdit(td, 'equipment'); });
    });
    tbody.querySelectorAll('.eq-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        config.equipment.splice(parseInt(btn.getAttribute('data-idx')), 1);
        recalcAll();
      });
    });
  }

  document.getElementById('equip-add-btn').addEventListener('click', function () {
    config.equipment.push({ id: generateId('eq'), name: 'New Equipment', cost: 0, usefulLife: 5 });
    recalcAll();
  });

  // --- Forgotten Costs ---
  function renderForgottenCosts() {
    var container = document.getElementById('forgotten-costs-list');
    var html = '';

    (config.forgottenCosts || []).forEach(function (hc, idx) {
      var disabledCls = hc.enabled ? '' : ' disabled';
      var impact = calcForgottenCostImpact(config, hc);
      var impactCls = hc.enabled ? ' active' : '';

      var displayAmt = hc.autoCalcPct
        ? formatMoney(calcTotalEquipmentValue(config) * (hc.autoCalcPct || 0))
        : (hc.isPercent ? (hc.amount || 0) : formatMoney(hc.amount || 0));

      var typeBadge, typeLabel;
      if (hc.isPercent) {
        typeBadge = 'fc-type-percent';
        typeLabel = '% loss';
      } else if (hc.perBatch) {
        typeBadge = 'fc-type-batch';
        typeLabel = '/batch';
      } else {
        typeBadge = 'fc-type-annual';
        typeLabel = '/year';
      }

      html += '<div class="forgotten-cost-item' + disabledCls + '">' +
        '<input type="checkbox" data-idx="' + idx + '"' + (hc.enabled ? ' checked' : '') + '>' +
        '<span class="fc-name">' + escHtml(hc.name) + '</span>';

      if (hc.autoCalcPct) {
        html += '<span class="fc-value-input" style="border:none;background:none;color:var(--text-light)">' + displayAmt + '</span>';
      } else if (hc.isPercent) {
        html += '<input type="number" class="fc-value-input fc-val" data-idx="' + idx + '" value="' + (hc.amount || 0) + '" step="0.5" min="0" max="50">%';
      } else {
        html += '$<input type="number" class="fc-value-input fc-val" data-idx="' + idx + '" value="' + (hc.amount || 0) + '" step="1" min="0">';
      }

      html += '<span class="fc-type-badge ' + typeBadge + '">' + typeLabel + '</span>' +
        '<span class="fc-impact' + impactCls + '">' +
        (hc.enabled ? '+' + formatMoney(impact, 4) + '/lb' : '--') +
        '</span>' +
        '</div>';
    });

    container.innerHTML = html;

    // Toggle checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var idx = parseInt(cb.getAttribute('data-idx'));
        config.forgottenCosts[idx].enabled = cb.checked;
        recalcAll();
      });
    });

    // Value inputs
    container.querySelectorAll('.fc-val').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var idx = parseInt(inp.getAttribute('data-idx'));
        config.forgottenCosts[idx].amount = parseFloat(inp.value) || 0;
        recalcAll();
      });
    });
  }

  // --- What-If ---
  var whatifBatches = document.getElementById('whatif-batches');
  var whatifSize = document.getElementById('whatif-size');
  var whatifPrice = document.getElementById('whatif-price');

  function renderWhatIf() {
    // Sync sliders with config
    whatifBatches.value = config.batchesPerYear || 12;
    whatifSize.value = config.batchSizeLbs || 500;
    whatifPrice.value = pricing ? (pricing[config.grainType] || 3) : 3;
    updateWhatIfDisplay();
    renderScenarios();
    renderOrgConvComparison();
  }

  function updateWhatIfDisplay() {
    var batches = parseInt(whatifBatches.value) || 12;
    var size = parseInt(whatifSize.value) || 500;
    var price = parseFloat(whatifPrice.value) || 3;

    document.getElementById('whatif-batches-display').textContent = batches;
    document.getElementById('whatif-size-display').textContent = formatNum(size, 0) + ' lbs';
    document.getElementById('whatif-price-display').textContent = formatMoney(price);

    var bd = calcFullBreakdown(config, pricing, {
      batchesPerYear: batches,
      batchSizeLbs: size,
      sellingPricePerLb: price
    });

    var profitCls = bd.annualProfit >= 0 ? 'profit-pos' : 'profit-neg';
    var marginCls = bd.marginPerLb >= 0 ? 'profit-pos' : 'profit-neg';

    document.getElementById('whatif-result').innerHTML =
      '<div class="whatif-result-item">' +
        '<div class="whatif-result-label">Cost/Lb</div>' +
        '<div class="whatif-result-value">' + formatMoney(bd.costPerLb) + '</div>' +
      '</div>' +
      '<div class="whatif-result-item">' +
        '<div class="whatif-result-label">Margin/Lb</div>' +
        '<div class="whatif-result-value ' + marginCls + '">' + formatMoney(bd.marginPerLb) + '</div>' +
      '</div>' +
      '<div class="whatif-result-item">' +
        '<div class="whatif-result-label">Annual Profit</div>' +
        '<div class="whatif-result-value ' + profitCls + '">' + formatMoney(bd.annualProfit, 0) + '</div>' +
      '</div>';
  }

  whatifBatches.addEventListener('input', updateWhatIfDisplay);
  whatifSize.addEventListener('input', updateWhatIfDisplay);
  whatifPrice.addEventListener('input', updateWhatIfDisplay);

  // --- Scenarios ---
  function renderScenarios() {
    var tbody = document.getElementById('scenario-tbody');
    var html = '';
    var scenarios = config.scenarios || {};
    var names = ['pessimistic', 'base', 'optimistic'];
    var labels = ['Pessimistic', 'Base', 'Optimistic'];

    names.forEach(function (name, i) {
      var sc = scenarios[name] || {};
      var bd = calcFullBreakdown(config, pricing, {
        batchesPerYear: sc.batchesPerYear,
        batchSizeLbs: sc.batchSizeLbs,
        sellingPricePerLb: sc.sellingPricePerLb
      });

      var profitCls = bd.annualProfit >= 0 ? 'profit-pos' : 'profit-neg';
      var marginCls = bd.marginPerLb >= 0 ? 'profit-pos' : 'profit-neg';
      var rowCls = name === 'base' ? ' class="row-highlight"' : '';

      html += '<tr' + rowCls + '>' +
        '<td class="bold">' + labels[i] + '</td>' +
        '<td class="number">' + formatNum(sc.batchesPerYear, 0) + '</td>' +
        '<td class="number">' + formatNum(sc.batchSizeLbs, 0) + ' lbs</td>' +
        '<td class="number">' + formatMoney(sc.sellingPricePerLb) + '</td>' +
        '<td class="number">' + formatMoney(bd.costPerLb) + '</td>' +
        '<td class="number ' + marginCls + '">' + formatMoney(bd.marginPerLb) + '</td>' +
        '<td class="number ' + profitCls + '">' + formatMoney(bd.annualProfit, 0) + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
  }

  // --- Organic vs Conventional ---
  function renderOrgConvComparison() {
    var base = getGrainBase(config.grainType);
    var convType = 'conv_' + base;
    var orgType = 'org_' + base;
    var convPrice = pricing ? (pricing[convType] || 3) : 3;
    var orgPrice = pricing ? (pricing[orgType] || 5) : 5;

    var convBd = calcFullBreakdown(config, pricing, { sellingPricePerLb: convPrice });
    var orgBd = calcFullBreakdown(config, pricing, { sellingPricePerLb: orgPrice });

    var convCls = convBd.marginPerLb >= 0 ? 'profit-pos' : 'profit-neg';
    var orgCls = orgBd.marginPerLb >= 0 ? 'profit-pos' : 'profit-neg';

    document.getElementById('org-conv-comparison').innerHTML =
      '<div class="comparison-card">' +
        '<h4>Conventional ' + escHtml(base) + '</h4>' +
        '<div class="big-number">' + formatMoney(convPrice) + '/lb</div>' +
        '<div class="detail">Cost: ' + formatMoney(convBd.costPerLb) + '/lb</div>' +
        '<div class="detail ' + convCls + '">Margin: ' + formatMoney(convBd.marginPerLb) + '/lb</div>' +
        '<div class="detail ' + convCls + '">Annual: ' + formatMoney(convBd.annualProfit, 0) + '</div>' +
      '</div>' +
      '<div class="comparison-card">' +
        '<h4>Organic ' + escHtml(base) + '</h4>' +
        '<div class="big-number">' + formatMoney(orgPrice) + '/lb</div>' +
        '<div class="detail">Cost: ' + formatMoney(orgBd.costPerLb) + '/lb</div>' +
        '<div class="detail ' + orgCls + '">Margin: ' + formatMoney(orgBd.marginPerLb) + '/lb</div>' +
        '<div class="detail ' + orgCls + '">Annual: ' + formatMoney(orgBd.annualProfit, 0) + '</div>' +
      '</div>';
  }

  // --- Malt Pricing ---
  function renderSyncBar() {
    var container = document.getElementById('pricing-sync-bar');
    if (!container) return;
    var statusText = '';
    if (pricingSync.lastSyncedAt) {
      statusText = 'Last synced from grain tickets: ' + new Date(pricingSync.lastSyncedAt).toLocaleDateString();
    }
    container.innerHTML =
      '<button id="sync-grain-prices" class="btn btn-sm" style="padding:4px 10px;font-size:12px;">Sync from Grain Tickets</button>' +
      '<span id="sync-status" class="sync-status" style="font-size:12px;color:var(--text-muted,#6a5a4a);margin-left:8px;">' + escHtml(statusText) + '</span>';

    document.getElementById('sync-grain-prices').addEventListener('click', function () {
      var btn = this;
      var statusEl = document.getElementById('sync-status');
      btn.disabled = true;
      btn.textContent = 'Syncing...';
      api.post('/api/grain-prices/sync', { cropYear: new Date().getFullYear() })
        .then(function (result) {
          pricingSync.lastSyncedAt = result.lastSyncedAt;
          Object.assign(pricingSync.syncedPrices, result.synced);
          Object.keys(result.synced).forEach(function (k) { pricing[k] = result.synced[k]; });
          var count = Object.keys(result.synced).length;
          statusEl.textContent = count > 0
            ? 'Synced ' + count + ' price' + (count !== 1 ? 's' : '') + ' — ' + new Date(result.lastSyncedAt).toLocaleDateString()
            : 'No matching prices found';
          renderPricing();
          recalcAll();
          showToast('Grain prices synced', 2000);
        })
        .catch(function (err) {
          statusEl.textContent = 'Sync failed: ' + (err.message || 'unknown error');
          showToast('Sync failed', 2000, 'error');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = 'Sync from Grain Tickets';
        });
    });
  }

  function renderPricing() {
    var tbody = document.getElementById('pricing-tbody');
    var html = '';
    var types = Object.keys(GRAIN_TYPE_LABELS);

    types.forEach(function (key) {
      var price = pricing ? (pricing[key] || 0) : 0;
      var isSynced = !!(pricingSync.syncedPrices && pricingSync.syncedPrices[key]);
      var isManual = !!(pricingSync.manualOverrides && pricingSync.manualOverrides[key]);
      var syncDate = isSynced && pricingSync.lastSyncedAt
        ? new Date(pricingSync.lastSyncedAt).toLocaleDateString()
        : '';

      var badgeHtml = '';
      if (isManual) {
        badgeHtml = '<span class="badge badge-manual" title="Manual override — sync will not change this price">Manual</span>';
      } else if (isSynced) {
        badgeHtml = '<span class="badge badge-gt" title="Synced from grain tickets' + (syncDate ? ' ' + syncDate : '') + '">GT</span>';
      }

      var overrideTip = isManual ? 'Remove manual override (allow sync)' : 'Lock price (prevent sync overwrite)';
      var overrideIcon = isManual ? '\uD83D\uDD13' : '\uD83D\uDD12';
      var overrideBtn = '<button class="btn-icon pricing-override-toggle" data-pricing-key="' + key + '" title="' + overrideTip + '" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;opacity:0.7;">' + overrideIcon + '</button>';

      html += '<tr>' +
        '<td>' + escHtml(GRAIN_TYPE_LABELS[key]) + '</td>' +
        '<td class="number editable" data-pricing-key="' + key + '">' + formatMoney(price) + '</td>' +
        '<td class="sync-indicator" style="width:60px;">' + badgeHtml + '</td>' +
        '<td class="override-toggle" style="width:36px;">' + overrideBtn + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('click', function () { startPricingEdit(td); });
    });

    tbody.querySelectorAll('.pricing-override-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-pricing-key');
        var currentlyManual = !!(pricingSync.manualOverrides && pricingSync.manualOverrides[key]);
        var newManual = !currentlyManual;
        api.put('/api/grain-prices/override/' + key, { manual: newManual })
          .then(function (result) {
            if (!pricingSync.manualOverrides) pricingSync.manualOverrides = {};
            if (result.manual) {
              pricingSync.manualOverrides[key] = true;
            } else {
              delete pricingSync.manualOverrides[key];
            }
            renderPricing();
            showToast(result.manual ? 'Price locked (manual)' : 'Override removed', 1500);
          })
          .catch(function () {
            showToast('Failed to update override', 2000, 'error');
          });
      });
    });
  }

  // =============================================
  // INLINE EDITING
  // =============================================
  function startCellEdit(td, collection) {
    if (td.classList.contains('editing')) return;
    var idx = parseInt(td.getAttribute('data-idx'));
    var field = td.getAttribute('data-field');
    var item = config[collection][idx];
    if (!item) return;

    var isNum = (field === 'amount' || field === 'cost' || field === 'usefulLife');
    var currentVal = isNum ? (item[field] || 0) : (item[field] || '');
    if (isNum) currentVal = String(currentVal).replace(/[$,]/g, '');

    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = isNum ? 'number' : 'text';
    if (isNum) { input.step = '0.01'; input.min = '0'; }
    input.value = currentVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var newVal = isNum ? (parseFloat(input.value) || 0) : input.value;
      config[collection][idx][field] = newVal;
      td.classList.remove('editing');
      recalcAll();
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { td.classList.remove('editing'); recalcAll(); }
    });
  }

  function startPricingEdit(td) {
    if (td.classList.contains('editing')) return;
    var key = td.getAttribute('data-pricing-key');
    var currentVal = pricing[key] || 0;

    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = 'number';
    input.step = '0.25';
    input.min = '0';
    input.value = currentVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      pricing[key] = parseFloat(input.value) || 0;
      td.classList.remove('editing');
      // Auto-enable manual override when user edits a price directly
      if (!pricingSync.manualOverrides) pricingSync.manualOverrides = {};
      pricingSync.manualOverrides[key] = true;
      api.put('/api/grain-prices/override/' + key, { manual: true }).catch(function () {});
      schedulePricingSave();
      recalcAll();
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { td.classList.remove('editing'); renderPricing(); }
    });
  }

  // =============================================
  // AUTO-SAVE
  // =============================================
  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      api.put('/api/config', config).then(function () {
        showToast('Saved', 1500);
      }).catch(function () {
        showToast('Save failed', 2000, 'error');
      });
    }, 800);
  }

  var pricingSaveTimer = null;
  function schedulePricingSave() {
    clearTimeout(pricingSaveTimer);
    pricingSaveTimer = setTimeout(function () {
      api.put('/api/pricing', pricing).then(function () {
        showToast('Pricing saved', 1500);
      });
    }, 800);
  }

  // =============================================
  // MASTER RECALCULATE
  // =============================================
  function recalcAll() {
    // Update equipment maintenance auto-calc
    (config.forgottenCosts || []).forEach(function (hc) {
      if (hc.autoCalcPct) {
        hc.amount = Math.round(calcTotalEquipmentValue(config) * (hc.autoCalcPct || 0) * 100) / 100;
      }
    });

    var bd = calcFullBreakdown(config, pricing);
    renderDashboard(bd);
    renderVariableCosts();
    renderFixedCosts();
    renderEquipment();
    renderForgottenCosts();
    renderWhatIf();
    renderPricing();
    scheduleSave();
  }

  // =============================================
  // INITIALIZATION
  // =============================================
  function init() {
    Promise.all([
      api.get('/api/config'),
      api.get('/api/pricing'),
      api.get('/api/grain-prices/status').catch(function () { return null; })
    ]).then(function (results) {
      config = results[0];
      pricing = results[1];
      if (results[2]) pricingSync = results[2];
      renderSyncBar();
      recalcAll();
    }).catch(function (err) {
      console.error('Failed to load:', err);
    });
  }

  init();
})();
