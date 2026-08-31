// Straw — small-grain straw baled off after grain harvest.
// Three logs on one screen: the work (mow / rake / bale / stack / haul), the
// bales made, and the tons sold to the straw buyer. Nets to $/ac per farm and
// writes back to the field budget as STRAW + STRAW COST aux lines.
(function () {
  'use strict';

  var summary = null;   // { year, settingsYear, fields, sales, ops, production }
  var loaded = false;
  var year = null;      // resolved from server settings on first load

  var OPS = ['Mow', 'Rake', 'Bale', 'Stack', 'Haul'];
  var BASES = ['/ac', '/bale', '/ton', 'flat'];
  // Seed rates for a fresh op row from the implements table when a match exists.
  var OP_IMPLEMENT = { Mow: 'Mow and Condition', Rake: 'Windrow Merge', Haul: 'Chop/Haul' };
  var OP_BASIS = { Mow: '/ac', Rake: '/ac', Bale: '/bale', Stack: '/bale', Haul: '/ton' };

  window.addEventListener('tab-activate', function (e) {
    if (e.detail && e.detail.tab === 'straw' && !loaded) load();
  });

  function load() {
    var q = year ? ('?year=' + year) : '';
    api.get('/api/straw/summary' + q).then(function (data) {
      summary = data;
      year = data.year;
      loaded = true;
      render();
    }).catch(function (err) {
      console.error('[straw] load failed', err);
      var root = document.getElementById('straw-root');
      if (root) root.innerHTML = '<p style="padding:1rem;color:var(--danger)">Failed to load straw data — check server logs.</p>';
    });
  }

  function fieldRow(fieldId) {
    return (summary.fields || []).find(function (x) { return x.fieldId === fieldId; }) || null;
  }
  function farmName(fieldId) {
    var f = fieldRow(fieldId);
    return f ? f.farm : null;
  }
  function defaultRate(opName) {
    var implName = OP_IMPLEMENT[opName];
    if (!implName || !window.refData || !window.refData.implements) return 0;
    var impl = window.refData.implements.find(function (i) { return i.name === implName; });
    return impl ? (Number(impl.costPerAcre) || 0) : 0;
  }

  function farmOptions(selectedId) {
    return (summary.fields || []).map(function (f) {
      return '<option value="' + f.fieldId + '"' + (f.fieldId === selectedId ? ' selected' : '') + '>' +
        util.escHtml(f.farm) + ' (' + util.escHtml(f.crop || '') + ')</option>';
    }).join('');
  }

  function render() {
    var root = document.getElementById('straw-root');
    if (!root) return;
    var fields = summary.fields || [];
    var byDate = function (a, b) { return (b.date || '').localeCompare(a.date || ''); };
    var sales = (summary.sales || []).slice().sort(byDate);
    var ops = (summary.ops || []).slice().sort(byDate);

    // ── Header: year selector + farm picker + add controls ──
    var html =
      '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">' +
        '<div style="display:flex;align-items:center;gap:0.4rem">' +
          '<button class="btn-secondary" id="straw-year-prev" title="Previous year">←</button>' +
          '<span id="straw-year-label" style="min-width:3.5rem;text-align:center;font-weight:600">' + year + '</span>' +
          '<button class="btn-secondary" id="straw-year-next" title="Next year">→</button>' +
        '</div>' +
        '<select id="straw-add-farm" style="min-width:180px">' +
          '<option value="">— pick farm —</option>' + farmOptions(null) +
        '</select>' +
        '<button class="btn-secondary" id="straw-add-op">+ Add Work</button>' +
        '<button class="btn-secondary" id="straw-add-set" title="Add Mow, Rake, Bale, Stack and Haul rows at once">+ Full Set</button>' +
        '<button class="btn-primary" id="straw-add">+ Add Sale</button>' +
        '<span style="color:var(--text-dim);font-size:0.85rem">Small-grain farms only · dbl-click a cell to edit</span>' +
      '</div>';

    // ── By-farm rollup ──
    html += '<h3 style="margin:0.5rem 0">By Farm — ' + year + '</h3>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Farm</th><th>Crop</th><th class="number">Acres</th><th class="number">Bales</th>' +
      '<th class="number">Bales/AC</th><th class="number">Tons</th><th class="number">Avg $/Ton</th>' +
      '<th class="number">Rev $/AC</th><th class="number">Cost $/AC</th><th class="number">Cost $/Bale</th>' +
      '<th class="number">Net $/AC</th><th class="number">In Budget $/AC</th><th></th>' +
      '</tr></thead><tbody>';

    var tAcres = 0, tBales = 0, tTons = 0, tRev = 0, tCost = 0, tAcresActive = 0;
    fields.forEach(function (f) {
      var active = f.tons > 0 || f.bales > 0 || f.opCount > 0;
      tAcres += f.acres;
      if (active) { tBales += f.bales; tTons += f.tons; tRev += f.dollars; tCost += f.costTotal; tAcresActive += f.acres; }
      var applied = f.budgetStrawPerAcre !== null || f.budgetStrawCostPerAcre !== null;
      var budgetNet = (f.budgetStrawPerAcre || 0) + (f.budgetStrawCostPerAcre || 0);
      var inSync = applied &&
        Math.abs((f.budgetStrawPerAcre || 0) - f.dollarsPerAcre) < 0.5 &&
        Math.abs(Math.abs(f.budgetStrawCostPerAcre || 0) - f.costPerAcre) < 0.5;
      html += '<tr' + (active ? '' : ' style="opacity:0.55"') + '>' +
        '<td>' + util.escHtml(f.farm) + '</td>' +
        '<td>' + util.escHtml(f.crop || '') + '</td>' +
        '<td class="number">' + util.formatNum(f.acres, 1) + '</td>' +
        '<td class="number">' + (f.bales || '--') + '</td>' +
        '<td class="number">' + (f.balesPerAcre ? util.formatNum(f.balesPerAcre, 2) : '--') + '</td>' +
        '<td class="number">' + util.formatNum(f.tons, 2) + '</td>' +
        '<td class="number">' + (f.avgPricePerTon ? util.formatMoney(f.avgPricePerTon) : '--') + '</td>' +
        '<td class="number">' + (f.dollarsPerAcre ? util.formatMoney(f.dollarsPerAcre) : '--') + '</td>' +
        '<td class="number">' + (f.costPerAcre ? util.formatMoney(f.costPerAcre) : '--') + '</td>' +
        '<td class="number">' + (f.costPerBale ? util.formatMoney(f.costPerBale) : '--') + '</td>' +
        '<td class="number"><strong>' + (active ? util.formatMoney(f.netPerAcre) : '--') + '</strong></td>' +
        '<td class="number">' + (applied ? util.formatMoney(budgetNet) : '--') + '</td>' +
        '<td>' + (active
          ? '<button class="btn-secondary straw-apply" data-field-id="' + f.fieldId + '"' +
            ' data-per-acre="' + f.dollarsPerAcre + '" data-cost-per-acre="' + f.costPerAcre + '"' +
            (inSync ? ' disabled title="Budget matches"' : ' title="Write STRAW + STRAW COST $/AC to the field budget"') + '>' +
            (inSync ? '✓ Applied' : 'Apply → Budget') + '</button>'
          : '') + '</td>' +
        '</tr>';
    });
    var tNet = tRev - tCost;
    html += '<tr class="total-row"><td>TOTAL</td><td></td>' +
      '<td class="number">' + util.formatNum(tAcres, 1) + '</td>' +
      '<td class="number">' + (tBales || '--') + '</td>' +
      '<td class="number">' + (tAcresActive > 0 && tBales ? util.formatNum(tBales / tAcresActive, 2) : '--') + '</td>' +
      '<td class="number">' + util.formatNum(tTons, 2) + '</td>' +
      '<td class="number">' + (tTons > 0 ? util.formatMoney(tRev / tTons) : '--') + '</td>' +
      '<td class="number">' + (tAcresActive > 0 ? util.formatMoney(tRev / tAcresActive) : '--') + '</td>' +
      '<td class="number">' + (tAcresActive > 0 ? util.formatMoney(tCost / tAcresActive) : '--') + '</td>' +
      '<td class="number">' + (tBales > 0 ? util.formatMoney(tCost / tBales) : '--') + '</td>' +
      '<td class="number"><strong>' + (tAcresActive > 0 ? util.formatMoney(tNet / tAcresActive) : '--') + '</strong></td>' +
      '<td></td><td></td></tr>';
    html += '</tbody></table></div>';
    if (tAcresActive > 0 && Math.abs(tAcresActive - tAcres) > 0.05) {
      html += '<p style="color:var(--text-dim);font-size:0.8rem;margin:0.25rem 0 1rem">' +
        'TOTAL per-acre figures use only farms with straw activity (' + util.formatNum(tAcresActive, 1) + ' ac).</p>';
    }

    // ── Bales made ──
    html += '<h3 style="margin:1.25rem 0 0.5rem">Bales Made — ' + year + '</h3>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Farm</th><th>Crop</th><th class="number">Acres</th><th class="number">Bales</th>' +
      '<th class="number">Avg Bale lbs</th><th class="number">Tons Made</th><th class="number">Tons Sold</th>' +
      '<th class="number">Unsold Tons</th>' +
      '</tr></thead><tbody>';
    fields.forEach(function (f) {
      var unsold = f.tonsMade - f.tons;
      html += '<tr' + (f.bales > 0 ? '' : ' style="opacity:0.55"') + '>' +
        '<td>' + util.escHtml(f.farm) + '</td>' +
        '<td>' + util.escHtml(f.crop || '') + '</td>' +
        '<td class="number">' + util.formatNum(f.acres, 1) + '</td>' +
        '<td class="editable number" data-prod-field="bales" data-field-id="' + f.fieldId + '">' + (f.bales || 0) + '</td>' +
        '<td class="editable number" data-prod-field="avgBaleLbs" data-field-id="' + f.fieldId + '">' + (f.avgBaleLbs || 0) + '</td>' +
        '<td class="number">' + util.formatNum(f.tonsMade, 2) + '</td>' +
        '<td class="number">' + util.formatNum(f.tons, 2) + '</td>' +
        '<td class="number">' + (Math.abs(unsold) > 0.01 ? util.formatNum(unsold, 2) : '--') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p style="color:var(--text-dim);font-size:0.8rem;margin:0.25rem 0 1rem">' +
      'Bales × avg weight gives tons made — that\'s what per-ton work costs out against. ' +
      'Farms with no bale count fall back to tons sold.</p>';

    // ── Straw work log ──
    html += '<h3 style="margin:1.25rem 0 0.5rem">Straw Work — ' + year + '</h3>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Date</th><th>Farm</th><th>Operation</th><th>Own / Custom</th><th>Basis</th>' +
      '<th class="number">Rate</th><th class="number">Qty</th><th class="number">Cost</th><th>Notes</th><th></th>' +
      '</tr></thead><tbody>';
    if (!ops.length) {
      html += '<tr><td colspan="10" style="color:var(--text-dim);padding:1rem">No straw work logged for ' + year + ' yet — pick a farm above and Add Work, or Full Set for all five passes.</td></tr>';
    }
    var opCost = 0;
    ops.forEach(function (o) {
      var fr = fieldRow(o.fieldId);
      var priced = (fr ? (fr.ops || []).find(function (x) { return x.id === o.id; }) : null) || { qty: 0, cost: 0 };
      opCost += priced.cost || 0;
      html += '<tr>' +
        '<td class="editable" data-kind="op" data-id="' + o.id + '" data-field="date">' + util.escHtml(o.date || '') + '</td>' +
        '<td class="straw-farm-cell" data-kind="op" data-id="' + o.id + '" data-field-id="' + (o.fieldId || '') + '" style="cursor:pointer" title="dbl-click to change farm">' + util.escHtml(farmName(o.fieldId) || o.farm || '?') + '</td>' +
        '<td class="straw-pick" data-kind="op" data-id="' + o.id + '" data-field="op" data-choices="ops" style="cursor:pointer">' + util.escHtml(o.op || '') + '</td>' +
        '<td class="straw-pick" data-kind="op" data-id="' + o.id + '" data-field="mode" data-choices="modes" style="cursor:pointer">' + (o.mode === 'custom' ? 'Custom hire' : 'Own') + '</td>' +
        '<td class="straw-pick" data-kind="op" data-id="' + o.id + '" data-field="basis" data-choices="bases" style="cursor:pointer">' + util.escHtml(o.basis || '/ac') + '</td>' +
        '<td class="editable number" data-kind="op" data-id="' + o.id + '" data-field="rate">' + util.formatMoney(o.rate || 0) + '</td>' +
        '<td class="editable number" data-kind="op" data-id="' + o.id + '" data-field="qtyOverride" title="Blank = from the farm (acres, bales or tons)">' +
          (o.qtyOverride !== undefined && o.qtyOverride !== null && o.qtyOverride !== '' ? util.formatNum(o.qtyOverride, 2) : util.formatNum(priced.qty, 2)) + '</td>' +
        '<td class="number">' + util.formatMoney(priced.cost || 0) + '</td>' +
        '<td class="editable" data-kind="op" data-id="' + o.id + '" data-field="notes">' + util.escHtml(o.notes || '') + '</td>' +
        '<td><button class="btn-danger straw-del" data-kind="op" data-id="' + o.id + '">Del</button></td>' +
        '</tr>';
    });
    if (ops.length) {
      html += '<tr class="total-row"><td>TOTAL</td><td></td><td></td><td></td><td></td><td></td><td></td>' +
        '<td class="number">' + util.formatMoney(opCost) + '</td><td></td><td></td></tr>';
    }
    html += '</tbody></table></div>';
    html += '<p style="color:var(--text-dim);font-size:0.8rem;margin:0.25rem 0 1rem">' +
      'Qty shown in grey comes from the farm — acres for /ac, bales for /bale, tons made for /ton. Type a number to override it.</p>';

    // ── Sales log ──
    html += '<h3 style="margin:1.25rem 0 0.5rem">Straw Sales — ' + year + '</h3>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Date</th><th>Farm</th><th>Buyer</th><th class="number">Tons</th>' +
      '<th class="number">$/Ton</th><th class="number">Total $</th><th>Notes</th><th></th>' +
      '</tr></thead><tbody>';
    if (!sales.length) {
      html += '<tr><td colspan="8" style="color:var(--text-dim);padding:1rem">No straw sales logged for ' + year + ' yet — pick a farm above and Add Sale.</td></tr>';
    }
    var logTons = 0, logDollars = 0;
    sales.forEach(function (s) {
      var total = (Number(s.tons) || 0) * (Number(s.pricePerTon) || 0);
      logTons += Number(s.tons) || 0;
      logDollars += total;
      html += '<tr>' +
        '<td class="editable" data-kind="sale" data-id="' + s.id + '" data-field="date">' + util.escHtml(s.date || '') + '</td>' +
        '<td class="straw-farm-cell" data-kind="sale" data-id="' + s.id + '" data-field-id="' + (s.fieldId || '') + '" style="cursor:pointer" title="dbl-click to change farm">' + util.escHtml(farmName(s.fieldId) || s.farm || '?') + '</td>' +
        '<td class="editable" data-kind="sale" data-id="' + s.id + '" data-field="buyer" data-list="straw-buyers">' + util.escHtml(s.buyer || '') + '</td>' +
        '<td class="editable number" data-kind="sale" data-id="' + s.id + '" data-field="tons">' + util.formatNum(s.tons || 0, 2) + '</td>' +
        '<td class="editable number" data-kind="sale" data-id="' + s.id + '" data-field="pricePerTon">' + util.formatMoney(s.pricePerTon || 0) + '</td>' +
        '<td class="number">' + util.formatMoney(total) + '</td>' +
        '<td class="editable" data-kind="sale" data-id="' + s.id + '" data-field="notes">' + util.escHtml(s.notes || '') + '</td>' +
        '<td><button class="btn-danger straw-del" data-kind="sale" data-id="' + s.id + '">Del</button></td>' +
        '</tr>';
    });
    if (sales.length) {
      html += '<tr class="total-row"><td>TOTAL</td><td></td><td></td>' +
        '<td class="number">' + util.formatNum(logTons, 2) + '</td><td></td>' +
        '<td class="number">' + util.formatMoney(logDollars) + '</td><td></td><td></td></tr>';
    }
    html += '</tbody></table></div>';

    // Straw buyers are their own crowd — not the grain buyer list. Suggest names already used.
    var buyerNames = [];
    (summary.sales || []).forEach(function (s) {
      if (s.buyer && buyerNames.indexOf(s.buyer) === -1) buyerNames.push(s.buyer);
    });
    html += '<datalist id="straw-buyers">' +
      buyerNames.map(function (n) { return '<option value="' + util.escHtml(n) + '">'; }).join('') +
      '</datalist>';

    root.innerHTML = html;
    wireEvents(root);
  }

  // --- Mutations -----------------------------------------------------------

  function endpoint(kind, id) {
    return (kind === 'op' ? '/api/straw-ops/' : '/api/straw-sales/') + id;
  }

  function pickedFarm() {
    var sel = document.getElementById('straw-add-farm');
    var fieldId = sel ? sel.value : '';
    if (!fieldId) { util.showToast('Pick a farm first', 2000, 'error'); return null; }
    return fieldId;
  }

  function newOp(fieldId, opName) {
    return api.post('/api/straw-ops', {
      fieldId: fieldId,
      farm: farmName(fieldId) || '',
      date: new Date().toISOString().slice(0, 10),
      op: opName,
      mode: 'own',
      basis: OP_BASIS[opName] || '/ac',
      rate: defaultRate(opName),
      qtyOverride: '',
      notes: '',
      cropYear: year
    });
  }

  function wireEvents(root) {
    document.getElementById('straw-year-prev').addEventListener('click', function () { year--; load(); });
    document.getElementById('straw-year-next').addEventListener('click', function () { year++; load(); });

    document.getElementById('straw-add').addEventListener('click', function () {
      var fieldId = pickedFarm();
      if (!fieldId) return;
      api.post('/api/straw-sales', {
        fieldId: fieldId,
        farm: farmName(fieldId) || '',
        date: new Date().toISOString().slice(0, 10),
        buyer: '',
        tons: 0,
        pricePerTon: 0,
        notes: '',
        cropYear: year
      }).then(function () {
        load();
        util.showToast('Straw sale added');
      });
    });

    document.getElementById('straw-add-op').addEventListener('click', function () {
      var fieldId = pickedFarm();
      if (!fieldId) return;
      newOp(fieldId, 'Mow').then(function () {
        load();
        util.showToast('Work row added — set the operation and rate');
      });
    });

    document.getElementById('straw-add-set').addEventListener('click', function () {
      var fieldId = pickedFarm();
      if (!fieldId) return;
      // Sequential so ids stay in pass order rather than racing.
      OPS.reduce(function (chain, opName) {
        return chain.then(function () { return newOp(fieldId, opName); });
      }, Promise.resolve()).then(function () {
        load();
        util.showToast('Mow, Rake, Bale, Stack, Haul added — fill in the rates');
      });
    });

    root.querySelectorAll('td.editable[data-kind]').forEach(function (td) {
      td.addEventListener('dblclick', function () { startEdit(td); });
    });

    root.querySelectorAll('td.editable[data-prod-field]').forEach(function (td) {
      td.addEventListener('dblclick', function () { startProdEdit(td); });
    });

    root.querySelectorAll('.straw-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-kind');
        if (!confirm(kind === 'op' ? 'Delete this work row?' : 'Delete this straw sale?')) return;
        api.del(endpoint(kind, btn.getAttribute('data-id'))).then(function () {
          load();
          util.showToast('Deleted');
        });
      });
    });

    root.querySelectorAll('.straw-apply').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var perAcre = parseFloat(btn.getAttribute('data-per-acre')) || 0;
        var costPerAcre = parseFloat(btn.getAttribute('data-cost-per-acre')) || 0;
        api.post('/api/straw/apply/' + btn.getAttribute('data-field-id'), {
          perAcre: perAcre, costPerAcre: costPerAcre
        }).then(function () {
          load();
          util.showToast('STRAW ' + util.formatMoney(perAcre) + '/ac and STRAW COST -' +
            util.formatMoney(costPerAcre) + '/ac written to field budget');
        });
      });
    });

    // Dropdown cells: operation, own/custom, basis
    root.querySelectorAll('.straw-pick').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        var which = td.getAttribute('data-choices');
        var choices = which === 'ops' ? OPS.map(function (o) { return [o, o]; })
          : which === 'modes' ? [['own', 'Own'], ['custom', 'Custom hire']]
          : (summary.bases || BASES).map(function (b) { return [b, b]; });
        var current = td.textContent.trim();
        openSelect(td, choices, current, function (val) {
          var data = {};
          data[td.getAttribute('data-field')] = val;
          api.put(endpoint(td.getAttribute('data-kind'), td.getAttribute('data-id')), data).then(load);
        });
      });
    });

    // Farm reassignment
    root.querySelectorAll('.straw-farm-cell').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        var choices = (summary.fields || []).map(function (f) {
          return [f.fieldId, f.farm + ' (' + (f.crop || '') + ')'];
        });
        openSelect(td, choices, td.getAttribute('data-field-id') || '', function (val) {
          api.put(endpoint(td.getAttribute('data-kind'), td.getAttribute('data-id')),
            { fieldId: val, farm: farmName(val) || '' }).then(load);
        });
      });
    });
  }

  function openSelect(td, choices, currentValue, onPick) {
    td.classList.add('editing');
    var select = document.createElement('select');
    choices.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c[0];
      opt.textContent = c[1];
      if (c[0] === currentValue || c[1] === currentValue) opt.selected = true;
      select.appendChild(opt);
    });
    td.textContent = '';
    td.appendChild(select);
    select.focus();
    select.addEventListener('change', function () { onPick(select.value); });
    select.addEventListener('blur', function () {
      if (select.parentNode === td) load();
    });
  }

  function startEdit(td) {
    if (td.classList.contains('editing')) return;
    var kind = td.getAttribute('data-kind');
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var oldVal = td.textContent.replace(/[$,]/g, '').trim();
    var isNum = (field === 'tons' || field === 'pricePerTon' || field === 'rate' || field === 'qtyOverride');

    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = isNum ? 'number' : (field === 'date' ? 'date' : 'text');
    if (isNum) input.step = '0.01';
    if (td.getAttribute('data-list')) input.setAttribute('list', td.getAttribute('data-list'));
    input.value = oldVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    function save() {
      var data = {};
      if (field === 'qtyOverride') {
        // Blank means "back to the farm's own acres / bales / tons".
        data[field] = input.value === '' ? '' : (parseFloat(input.value) || 0);
      } else {
        data[field] = isNum ? (parseFloat(input.value) || 0) : input.value;
      }
      api.put(endpoint(kind, id), data).then(load);
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') load();
    });
  }

  function startProdEdit(td) {
    if (td.classList.contains('editing')) return;
    var fieldId = td.getAttribute('data-field-id');
    var field = td.getAttribute('data-prod-field');
    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = 'number';
    input.step = field === 'bales' ? '1' : '0.1';
    input.value = td.textContent.replace(/[$,]/g, '').trim();
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    function save() {
      var body = { fieldId: fieldId, cropYear: year };
      body[field] = parseFloat(input.value) || 0;
      api.post('/api/straw-production', body).then(load);
    }
    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') load();
    });
  }
})();
