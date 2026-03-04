// Enterprise view — card view + field-by-field budget grid
(function () {
  'use strict';

  var currentEntId = null;
  var fieldsData = [];
  var currentView = 'cards';
  var isLoading = false;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'enterprise') {
      var idx = e.detail.enterpriseIdx || 0;
      var ent = window.refData.enterprises[idx];
      if (ent) {
        currentEntId = ent.id;
        document.getElementById('ent-title').textContent = ent.name;
        loadEnterprise(ent.id);
      }
    }
  });

  document.getElementById('ent-add-field').addEventListener('click', function () {
    if (!currentEntId) return;
    var ent = window.refData.enterprises.find(function (e) { return e.id === currentEntId; });
    window.openFieldEditor(null, currentEntId, ent ? ent.systemCodes[0] : 'CON');
  });

  // View toggle — scope to enterprise controls only
  var entControls = document.querySelector('.enterprise-controls');
  entControls.querySelectorAll('.toggle-btn[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentView = btn.getAttribute('data-view');
      entControls.querySelectorAll('.toggle-btn[data-view]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      updateViewVisibility();
      renderCurrentView();
    });
  });

  // Sort control
  document.getElementById('ent-sort').addEventListener('change', function () {
    renderCurrentView();
  });

  function sortFields(fields) {
    var mode = document.getElementById('ent-sort').value;
    return fields.slice().sort(function (a, b) {
      if (mode === 'profit') {
        var pa = a._computed ? a._computed.profitPerAcre || 0 : 0;
        var pb = b._computed ? b._computed.profitPerAcre || 0 : 0;
        return pb - pa;
      } else if (mode === 'crop') {
        return (a.crop || '').localeCompare(b.crop || '');
      } else if (mode === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });
  }

  function renderCurrentView() {
    if (!fieldsData.length) return;
    var sorted = sortFields(fieldsData);
    if (currentView === 'cards') renderCards(sorted);
    else if (currentView === 'grid') renderGrid(sorted);
    else if (currentView === 'modules') renderModules(sorted);
  }

  function updateViewVisibility() {
    var cards = document.getElementById('ent-cards');
    var grid = document.getElementById('ent-grid-view');
    var modules = document.getElementById('ent-module-view');
    cards.classList.add('hidden');
    grid.classList.add('hidden');
    modules.classList.add('hidden');
    if (currentView === 'cards') cards.classList.remove('hidden');
    else if (currentView === 'grid') grid.classList.remove('hidden');
    else if (currentView === 'modules') modules.classList.remove('hidden');
  }

  function loadEnterprise(entId) {
    isLoading = true;
    api.get('/api/fields?enterpriseId=' + entId).then(function (fields) {
      fieldsData = fields;
      isLoading = false;
      renderSummaryBar(fields);
      renderCurrentView();
      updateViewVisibility();
    }).catch(function () {
      isLoading = false;
    });
  }

  function renderSummaryBar(fields) {
    var totalAcres = 0;
    var totalExpense = 0;
    var totalIncome = 0;
    var totalProfit = 0;
    var weightedExp = 0;
    var weightedProfit = 0;

    fields.forEach(function (f) {
      var b = f._computed || {};
      var a = b.effectiveAcres !== undefined ? b.effectiveAcres : ((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0);
      totalAcres += a;
      totalExpense += b.expTotal || 0;
      totalIncome += b.cropIncomeTotal || 0;
      totalProfit += b.profitFarmWithoutPayments || 0;
      weightedExp += (b.expPerAcre || 0) * a;
      weightedProfit += (b.profitPerAcre || 0) * a;
    });

    var avgExp = totalAcres > 0 ? weightedExp / totalAcres : 0;
    var avgProfit = totalAcres > 0 ? weightedProfit / totalAcres : 0;

    var profitCls = avgProfit >= 0 ? 'profit-pos' : 'profit-neg';
    var totalProfitCls = totalProfit >= 0 ? 'profit-pos' : 'profit-neg';

    document.getElementById('ent-summary-bar').innerHTML =
      '<div class="summary-item"><span class="summary-label">Fields</span><span class="summary-value">' + fields.length + '</span></div>' +
      '<div class="summary-item"><span class="summary-label">Total Acres</span><span class="summary-value">' + util.formatNum(totalAcres, 1) + '</span></div>' +
      '<div class="summary-item"><span class="summary-label">Avg Expense/AC</span><span class="summary-value">' + util.formatMoney(avgExp) + '</span></div>' +
      '<div class="summary-item"><span class="summary-label">Avg Profit/AC</span><span class="summary-value ' + profitCls + '">' + util.formatMoney(avgProfit) + '</span></div>' +
      '<div class="summary-item"><span class="summary-label">Total Profit</span><span class="summary-value ' + totalProfitCls + '">' + util.formatMoney(totalProfit, 0) + '</span></div>';
  }

  function renderFieldCard(f) {
    var b = f._computed || {};
    var profitPerAcre = b.profitPerAcre || 0;
    var profitCls = profitPerAcre >= 0 ? 'profit-positive' : 'profit-negative';
    var profitColor = profitPerAcre >= 0 ? 'profit-pos' : 'profit-neg';

    var foBadge = f._fieldops ? ' <span class="fieldops-badge" title="Synced from FieldOps">FO</span>' : '';
    var progBadge = '';
    if (f.templateId) {
      var prog = (window.refData.programs || []).find(function (p) { return p.id === f.templateId; });
      if (prog) progBadge = ' <span class="prog-badge" title="Program: ' + util.escHtml(prog.name) + '">' + util.escHtml(prog.name) + '</span>';
    }

    return '<div class="field-card ' + profitCls + '" data-field-id="' + f.id + '">' +
      '<div class="field-card-header">' +
        '<h4>' + util.escHtml(f.name) + foBadge + progBadge + '</h4>' +
        (function () {
          var cc = typeof CropColors !== 'undefined' ? CropColors.getCropColor(f.crop) : '#283828';
          var tc = typeof CropColors !== 'undefined' ? CropColors.textColorFor(cc) : 'var(--text-light)';
          return '<span class="field-crop-badge" style="background:' + cc + ';color:' + tc + '">' + util.escHtml(f.crop) + '</span>';
        })() +
      '</div>' +
      '<div class="field-card-metrics">' +
        '<div class="metric"><span class="metric-label">Acres</span><span class="metric-value">' + util.formatNum((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0, 1) + '</span></div>' +
        '<div class="metric"><span class="metric-label">Expense/AC</span><span class="metric-value">' + util.formatMoney(b.expPerAcre) + '</span></div>' +
        '<div class="metric"><span class="metric-label">Income/AC</span><span class="metric-value">' + util.formatMoney(b.cropIncomePerAcre) + '</span></div>' +
        '<div class="metric"><span class="metric-label">Profit/AC</span><span class="metric-value ' + profitColor + '">' + util.formatMoney(profitPerAcre) + '</span></div>' +
        '<div class="metric"><span class="metric-label">Yield/AC</span><span class="metric-value">' + util.formatNum(b.yieldPerAcre, 1) + ' ' + util.escHtml(b.yieldUnit || '') + '</span></div>' +
        '<div class="metric"><span class="metric-label">COP</span><span class="metric-value">' + util.formatMoney(b.cop) + '</span></div>' +
      '</div>' +
      '<div class="field-card-footer">' +
        '<span>' + util.escHtml(f.systemCode || '') + ' &middot; ' + util.escHtml(f.cropType || '') + '</span>' +
        '<span style="display:inline-flex;gap:0.75rem;align-items:center">' +
          '<span class="field-delete-btn" data-field-id="' + f.id + '" style="color:var(--danger);cursor:pointer">Delete</span>' +
          '<span style="color:var(--blue);cursor:pointer">Edit &rarr;</span>' +
        '</span>' +
      '</div>' +
    '</div>';
  }

  function renderCards(fields) {
    if (!fields.length) {
      document.getElementById('ent-cards').innerHTML = '<p style="color:var(--text-light)">No fields in this enterprise. Click "+ Add Field" to create one.</p>';
      return;
    }

    // Group split fields, keep standalone fields as-is
    var splitGroups = {};
    var standalone = [];
    var groupOrder = [];
    fields.forEach(function (f) {
      if (f.splitGroupId) {
        if (!splitGroups[f.splitGroupId]) {
          splitGroups[f.splitGroupId] = [];
          groupOrder.push(f.splitGroupId);
        }
        splitGroups[f.splitGroupId].push(f);
      } else {
        standalone.push(f);
      }
    });

    var html = '';

    // Render split groups with headers
    groupOrder.forEach(function (sgId) {
      var group = splitGroups[sgId];
      var regName = group[0].registryFieldName || group[0].name;
      var totalAcres = group.reduce(function (sum, f) { return sum + (f.acres || 0); }, 0);
      html += '<div class="split-group-header" style="padding:0.5rem 0.75rem;margin:0.5rem 0 0.25rem;background:#1a2a1a;border:1px solid #2d4a2d;border-radius:4px;font-size:0.8rem;display:flex;align-items:center;gap:0.5rem">' +
        '<span style="color:var(--primary);font-weight:600">' + util.escHtml(regName) + '</span>' +
        '<span style="color:var(--text-light)">' + util.formatNum(totalAcres, 1) + ' ac total</span>' +
        '<span style="color:#888;font-size:0.7rem">(' + group.length + ' sub-fields)</span>' +
      '</div>';
      html += '<div class="split-group-cards" style="padding-left:1rem;border-left:2px solid #2d4a2d;margin-left:0.5rem;margin-bottom:0.75rem">';
      group.forEach(function (f) {
        html += renderFieldCard(f);
      });
      html += '</div>';
    });

    // Render standalone fields
    standalone.forEach(function (f) {
      html += renderFieldCard(f);
    });

    document.getElementById('ent-cards').innerHTML = html;

    // Attach click handlers
    document.querySelectorAll('.field-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (isLoading) return; // prevent opening with stale data during reload
        var fid = card.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (field) window.openFieldEditor(field);
      });
    });

    // Attach delete handlers
    document.querySelectorAll('.field-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var fid = btn.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (!field) return;
        if (!confirm('Delete "' + field.name + '"? This cannot be undone.')) return;
        fetch('/api/fields/' + fid, { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function () { loadEnterprise(currentEntIdx); });
      });
    });
  }

  // Helper: get effective acres for a field
  function fieldAcres(f) {
    if (f._computed && f._computed.effectiveAcres !== undefined) return f._computed.effectiveAcres;
    return (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
  }

  // Helper: compute category subtotal for a group of fields
  function catSubtotal(row, catFields) {
    var isPerAcre = row.key.endsWith('PerAcre') || row.key === 'pricePerUnit' || row.key === 'cop';
    if (isPerAcre) {
      var sw = 0, sa = 0;
      catFields.forEach(function (f) {
        var a = fieldAcres(f);
        var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
        sw += (parseFloat(v) || 0) * a;
        sa += a;
      });
      return sa > 0 ? sw / sa : 0;
    } else {
      var sum = 0;
      catFields.forEach(function (f) {
        var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
        sum += parseFloat(v) || 0;
      });
      return sum;
    }
  }

  function renderGrid(fields) {
    if (!fields.length) {
      document.getElementById('ent-thead').innerHTML = '';
      document.getElementById('ent-tbody').innerHTML = '<tr><td>No fields in this enterprise. Click "+ Add Field" to create one.</td></tr>';
      return;
    }

    // Group fields by systemCode — sort to cluster categories
    var codeOrder = {};
    var codeIndex = 0;
    fields.forEach(function (f) {
      var code = f.systemCode || 'OTHER';
      if (!(code in codeOrder)) codeOrder[code] = codeIndex++;
    });
    var sortedFields = fields.slice().sort(function (a, b) {
      var ca = a.systemCode || 'OTHER', cb = b.systemCode || 'OTHER';
      return (codeOrder[ca] || 0) - (codeOrder[cb] || 0);
    });

    // Build category groups: [{code, fields}]
    var categories = [];
    var catMap = {};
    sortedFields.forEach(function (f) {
      var code = f.systemCode || 'OTHER';
      if (!catMap[code]) {
        catMap[code] = { code: code, fields: [] };
        categories.push(catMap[code]);
      }
      catMap[code].fields.push(f);
    });
    var multiCat = categories.length > 1;

    // Total columns: field columns + (category subtotal columns if >1 cat) + grand total
    var totalCols = sortedFields.length + (multiCat ? categories.length : 0) + 2; // +1 label, +1 grand total

    // Build header row
    var thead = '<tr><th>Budget Item</th>';
    categories.forEach(function (cat) {
      cat.fields.forEach(function (f) {
        thead += '<th class="field-name-header" data-field-id="' + f.id + '">' +
          util.escHtml(f.name) + '<br><small>' + util.escHtml(f.crop) + '</small></th>';
      });
      if (multiCat) {
        thead += '<th class="cat-subtotal-header">' + util.escHtml(cat.code) + '</th>';
      }
    });
    thead += '<th class="total-row">TOTALS</th></tr>';
    document.getElementById('ent-thead').innerHTML = thead;

    // Add click handlers on field names
    document.querySelectorAll('.field-name-header').forEach(function (th) {
      th.addEventListener('click', function () {
        var fid = th.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (field) window.openFieldEditor(field);
      });
    });

    // Build body rows
    var rows = [
      { label: 'Acres', key: 'effectiveAcres', src: 'budget', num: true, dec: 1 },
      { type: 'header', label: 'EXPENSES' },
      { label: 'Rent / AC', key: 'rentPerAcre', src: 'budget', num: true, money: true },
      { label: 'Rent Total', key: 'rentTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Spring Fert / AC', key: 'springFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Fall Fert / AC', key: 'fallFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Total Fert / AC', key: 'totalFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Fert Total', key: 'totalFertCost', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Seed / AC', key: 'seedCostPerAcre', src: 'budget', num: true, money: true },
      { label: 'Seed Total', key: 'seedTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Machinery / AC', key: 'machineryPerAcre', src: 'budget', num: true, money: true },
      { label: 'Mach Total', key: 'machineryTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Labor / AC', key: 'laborPerAcre', src: 'budget', num: true, money: true },
      { label: 'Overhead / AC', key: 'overheadPerAcre', src: 'budget', num: true, money: true },
      { label: 'L&O Total', key: 'laborOverheadTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Fuel / AC', key: 'fuelPerAcre', src: 'budget', num: true, money: true },
      { label: 'Fuel Total', key: 'fuelTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Drying / AC', key: 'dryingPerAcre', src: 'budget', num: true, money: true },
      { label: 'Drying Total', key: 'dryingTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Interest / AC', key: 'interestPerAcre', src: 'budget', num: true, money: true },
      { label: 'Interest Total', key: 'interestTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Crop Ins / AC', key: 'cropInsurancePerAcre', src: 'budget', num: true, money: true },
      { label: 'Ins Total', key: 'cropInsuranceTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'EXP / AC', key: 'expPerAcre', src: 'budget', num: true, money: true, highlight: true },
      { label: 'EXP TOTAL', key: 'expTotal', src: 'budget', num: true, money: true, highlight: true },
      { type: 'header', label: 'INCOME' },
      { label: 'Yield / AC', key: 'yieldPerAcre', src: 'budget', num: true, dec: 1 },
      { label: 'Total Yield', key: 'totalYield', src: 'budget', num: true, dec: 0 },
      { label: 'Price / Unit', key: 'pricePerUnit', src: 'budget', num: true, money: true },
      { label: 'Income / AC', key: 'cropIncomePerAcre', src: 'budget', num: true, money: true },
      { label: 'Income Total', key: 'cropIncomeTotal', src: 'budget', num: true, money: true },
      { label: 'Gov Payments / AC', key: 'govPaymentsPerAcre', src: 'budget', num: true, money: true },
      { type: 'header', label: 'PROFIT' },
      { label: 'Profit / AC', key: 'profitPerAcre', src: 'budget', num: true, money: true, highlight: true, profit: true },
      { label: 'Profit Farm (w/ Payments)', key: 'profitFarmWithPayments', src: 'budget', num: true, money: true, highlight: true, profit: true },
      { label: 'COP', key: 'cop', src: 'budget', num: true, money: true }
    ];

    var html = '';
    rows.forEach(function (row) {
      if (row.type === 'header') {
        html += '<tr class="row-group-header"><td colspan="' + totalCols + '">' + row.label + '</td></tr>';
        return;
      }

      var trClasses = [];
      if (row.highlight) trClasses.push('row-highlight');
      if (row.subtotal) trClasses.push('row-subtotal');
      var cls = trClasses.length ? ' class="' + trClasses.join(' ') + '"' : '';
      html += '<tr' + cls + '><td class="row-label">' + row.label + '</td>';

      var grandTotal = 0;
      var isPerAcre = row.key.endsWith('PerAcre') || row.key === 'pricePerUnit' || row.key === 'cop';

      // Render field cells grouped by category, with subtotal column after each group
      categories.forEach(function (cat) {
        cat.fields.forEach(function (f) {
          var val;
          if (row.src === 'field') {
            val = f[row.key];
          } else {
            val = f._computed ? f._computed[row.key] : '';
          }

          var cellContent;
          if (row.money) {
            cellContent = util.formatMoney(val);
          } else if (row.num) {
            cellContent = util.formatNum(val, row.dec !== undefined ? row.dec : 2);
          } else {
            cellContent = util.escHtml(String(val || ''));
          }

          var profitCls = row.profit ? ' ' + util.profitClass(val) : '';
          html += '<td class="number' + profitCls + '">' + cellContent + '</td>';
        });

        // Category subtotal column
        if (multiCat && row.num) {
          var sv = catSubtotal(row, cat.fields);
          var formatted = row.money ? util.formatMoney(sv, isPerAcre ? undefined : 0) : util.formatNum(sv, row.dec || (isPerAcre ? 2 : 0));
          var profitCls4 = row.profit ? ' ' + util.profitClass(sv) : '';
          html += '<td class="number bold cat-subtotal-cell' + profitCls4 + '">' + formatted + '</td>';
        } else if (multiCat) {
          html += '<td class="cat-subtotal-cell"></td>';
        }
      });

      // Grand totals column
      if (row.num) {
        var grandVal;
        if (isPerAcre) {
          var sw = 0, sa = 0;
          sortedFields.forEach(function (f) {
            var a = fieldAcres(f);
            var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
            sw += (parseFloat(v) || 0) * a;
            sa += a;
          });
          grandVal = sa > 0 ? sw / sa : 0;
          var formatted2 = row.money ? util.formatMoney(grandVal) : util.formatNum(grandVal, row.dec || 2);
          var profitCls5 = row.profit ? ' ' + util.profitClass(grandVal) : '';
          html += '<td class="number bold' + profitCls5 + '">' + formatted2 + '</td>';
        } else {
          sortedFields.forEach(function (f) {
            var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
            grandTotal += parseFloat(v) || 0;
          });
          var formatted3 = row.money ? util.formatMoney(grandTotal, 0) : util.formatNum(grandTotal, row.dec || 0);
          var profitCls6 = row.profit ? ' ' + util.profitClass(grandTotal) : '';
          html += '<td class="number bold' + profitCls6 + '">' + formatted3 + '</td>';
        }
      } else {
        html += '<td></td>';
      }

      html += '</tr>';
    });

    document.getElementById('ent-tbody').innerHTML = html;
  }

  // === MODULE VIEW ===
  function renderModules(fields) {
    var container = document.getElementById('ent-module-view');
    if (!fields.length) {
      container.innerHTML = '<p style="color:var(--text-light);padding:2rem">No fields in this enterprise.</p>';
      return;
    }

    var html = '<div class="module-fields-list">';
    fields.forEach(function (f) {
      var b = f._computed || {};
      var profitCls = util.profitClass(b.profitPerAcre || 0);
      // COP coloring: red when COP > price (losing money), green when profitable
      var copCls = (b.cop || 0) > 0 ? (b.cop > (b.pricePerUnit || 0) ? 'profit-neg' : 'profit-pos') : '';

      html += '<div class="module-field-card" data-field-id="' + f.id + '">';

      // Header
      html += '<div class="module-field-header">';
      html += '<div class="module-field-name">' + util.escHtml(f.name) + '</div>';
      html += (function () {
            var cc = typeof CropColors !== 'undefined' ? CropColors.getCropColor(f.crop) : '#283828';
            var tc = typeof CropColors !== 'undefined' ? CropColors.textColorFor(cc) : 'var(--text-light)';
            return '<span class="field-crop-badge" style="background:' + cc + ';color:' + tc + '">' + util.escHtml(f.crop) + '</span>';
          })();
      if (f.templateId) {
        var mProg = (window.refData.programs || []).find(function (p) { return p.id === f.templateId; });
        if (mProg) html += '<span class="prog-badge">' + util.escHtml(mProg.name) + '</span>';
      }
      html += '<span class="module-field-acres">' + util.formatNum((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0, 1) + ' ac</span>';
      html += '<span class="module-field-code">' + util.escHtml(f.systemCode || '') + '</span>';
      html += '</div>';

      // Module grid: 3 columns x 2 rows + full-width bottom
      html += '<div class="module-grid">';

      // Row 1: Land & Rent | Seed | Fertilizer
      // Land & Rent
      html += '<div class="mod-card mod-land">';
      html += '<div class="mod-header">Land & Rent</div>';
      html += '<div class="mod-row"><span>Rent/AC</span><span>' + util.formatMoney(b.rentPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Rent Total</span><span>' + util.formatMoney(b.rentTotal) + '</span></div>';
      html += '</div>';

      // Seed
      html += '<div class="mod-card mod-seed">';
      html += '<div class="mod-header">Seed</div>';
      var seedVar = f.seed ? f.seed.variety || '--' : '--';
      var seedPop = f.seed ? util.formatNum(f.seed.population, 0) : '--';
      html += '<div class="mod-row"><span>Variety</span><span class="mod-val-sm">' + util.escHtml(seedVar) + '</span></div>';
      html += '<div class="mod-row"><span>Pop</span><span>' + seedPop + '</span></div>';
      html += '<div class="mod-row"><span>Cost/AC</span><span>' + util.formatMoney(b.seedCostPerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total</span><span>' + util.formatMoney(b.seedTotal) + '</span></div>';
      html += '</div>';

      // Fertilizer
      html += '<div class="mod-card mod-fert">';
      html += '<div class="mod-header">Fertilizer</div>';
      html += '<div class="mod-row"><span>Spring/AC</span><span>' + util.formatMoney(b.springFertPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Fall/AC</span><span>' + util.formatMoney(b.fallFertPerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total/AC</span><span>' + util.formatMoney(b.totalFertPerAcre) + '</span></div>';
      html += '</div>';

      // Row 2: Machinery | Labor & Overhead | Other Costs
      // Machinery
      html += '<div class="mod-card mod-mach">';
      html += '<div class="mod-header">Machinery</div>';
      (b.machineryDetails || []).forEach(function (md) {
        var hireTag = md.isHire ? ' <small style="opacity:0.7">(hire)</small>' : '';
        html += '<div class="mod-row mod-row-sm">' +
          '<span>' + util.escHtml(md.implementName) + ' ' + md.passes + '×' + hireTag + '</span>' +
          '<span>' + util.formatMoney(md.costPerAcre) + '</span></div>';
      });
      html += '<div class="mod-row mod-total"><span>Total/AC</span><span>' + util.formatMoney(b.machineryPerAcre) + '</span></div>';
      html += '<div class="mod-row mod-row-sm" style="opacity:0.7"><span>Fuel</span><span>' + b.fuelGallonsPerAcre + ' gal · ' + util.formatMoney(b.fuelPerAcre) + '</span></div>';
      html += '</div>';

      // Labor & Overhead
      html += '<div class="mod-card mod-labor">';
      html += '<div class="mod-header">Labor & Overhead</div>';
      if (b.laborHoursPerAcre > 0) {
        html += '<div class="mod-row"><span>Hours/AC</span><span>' + util.formatNum(b.laborHoursPerAcre, 2) + '</span></div>';
      }
      html += '<div class="mod-row"><span>Labor/AC</span><span>' + util.formatMoney(b.laborPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Overhead/AC</span><span>' + util.formatMoney(b.overheadPerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total/AC</span><span>' + util.formatMoney((b.laborPerAcre || 0) + (b.overheadPerAcre || 0)) + '</span></div>';
      html += '</div>';

      // Other Costs
      html += '<div class="mod-card mod-other">';
      html += '<div class="mod-header">Other Costs</div>';
      html += '<div class="mod-row"><span>Drying/AC</span><span>' + util.formatMoney(b.dryingPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Interest/AC</span><span>' + util.formatMoney(b.interestPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Crop Ins/AC</span><span>' + util.formatMoney(b.cropInsurancePerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total</span><span>' + util.formatMoney((b.dryingPerAcre || 0) + (b.interestPerAcre || 0) + (b.cropInsurancePerAcre || 0)) + '</span></div>';
      html += '</div>';

      // Full-width: Income & Profit
      html += '<div class="mod-card mod-income" style="grid-column:1/-1">';
      html += '<div class="mod-header">Income & Profit</div>';
      html += '<div class="mod-income-row">';
      html += '<div class="mod-income-item"><span class="mod-income-label">Yield/AC</span><span class="mod-income-val">' + util.formatNum(b.yieldPerAcre, 1) + ' ' + util.escHtml(b.yieldUnit || 'Bu') + '</span></div>';
      html += '<div class="mod-income-item"><span class="mod-income-label">Price</span><span class="mod-income-val">' + util.formatMoney(b.pricePerUnit) + '</span></div>';
      html += '<div class="mod-income-item"><span class="mod-income-label">Income/AC</span><span class="mod-income-val">' + util.formatMoney(b.cropIncomePerAcre) + '</span></div>';
      html += '<div class="mod-income-item"><span class="mod-income-label">EXP/AC</span><span class="mod-income-val">' + util.formatMoney(b.expPerAcre) + '</span></div>';
      html += '<div class="mod-income-item"><span class="mod-income-label">Profit/AC</span><span class="mod-income-val ' + profitCls + '" style="font-weight:700">' + util.formatMoney(b.profitPerAcre) + '</span></div>';
      html += '<div class="mod-income-item"><span class="mod-income-label">COP</span><span class="mod-income-val ' + copCls + '">' + util.formatMoney(b.cop) + '</span></div>';
      html += '</div>';
      html += '</div>';

      html += '</div>'; // module-grid
      html += '</div>'; // module-field-card
    });

    html += '</div>'; // module-fields-list
    container.innerHTML = html;

    // Click handlers
    container.querySelectorAll('.module-field-header').forEach(function (header) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', function () {
        var card = header.closest('.module-field-card');
        var fid = card.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (field) window.openFieldEditor(field);
      });
    });
  }

  // Expose reload for field editor
  window.reloadEnterprise = function () {
    if (currentEntId) loadEnterprise(currentEntId);
  };
})();
