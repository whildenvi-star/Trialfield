// Straw Sales — small-grain straw sold by the ton, back-calculated to $/ac per farm
(function () {
  'use strict';

  var summary = null;   // { year, settingsYear, fields, sales }
  var loaded = false;
  var year = null;      // resolved from server settings on first load

  var tabBtn = document.querySelector('.mkt-tab-btn[data-mtab="straw"]');
  if (tabBtn) tabBtn.addEventListener('click', function () { if (!loaded) load(); });

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

  function farmName(fieldId) {
    var f = (summary.fields || []).find(function (x) { return x.fieldId === fieldId; });
    return f ? f.farm : null;
  }

  function render() {
    var root = document.getElementById('straw-root');
    if (!root) return;
    var fields = summary.fields || [];
    var sales = (summary.sales || []).slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });

    // ── Header: year selector + add-sale controls ──
    var html =
      '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">' +
        '<div class="mkt-year-bar" style="margin:0">' +
          '<button class="mkt-year-btn" id="straw-year-prev" title="Previous year">←</button>' +
          '<span id="straw-year-label">' + year + '</span>' +
          '<button class="mkt-year-btn" id="straw-year-next" title="Next year">→</button>' +
        '</div>' +
        '<select id="straw-add-farm" style="min-width:180px">' +
          '<option value="">— pick farm —</option>' +
          fields.map(function (f) {
            return '<option value="' + f.fieldId + '">' + util.escHtml(f.farm) + ' (' + util.escHtml(f.crop || '') + ')</option>';
          }).join('') +
        '</select>' +
        '<button class="btn-primary" id="straw-add">+ Add Sale</button>' +
        '<span style="color:var(--text-dim);font-size:0.85rem">Small-grain farms only · dbl-click a cell to edit</span>' +
      '</div>';

    // ── By-farm rollup ──
    html += '<h3 style="margin:0.5rem 0">By Farm — ' + year + '</h3>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Farm</th><th>Crop</th><th class="number">Acres</th><th class="number">Sales</th>' +
      '<th class="number">Tons</th><th class="number">Tons/AC</th><th class="number">Avg $/Ton</th>' +
      '<th class="number">Total $</th><th class="number">$/AC</th><th class="number">In Budget $/AC</th><th></th>' +
      '</tr></thead><tbody>';

    var tAcres = 0, tTons = 0, tDollars = 0, tAcresSold = 0;
    fields.forEach(function (f) {
      tAcres += f.acres; tTons += f.tons; tDollars += f.dollars;
      if (f.tons > 0) tAcresSold += f.acres;
      var applied = f.budgetStrawPerAcre !== null;
      var inSync = applied && Math.abs(f.budgetStrawPerAcre - f.dollarsPerAcre) < 0.5;
      html += '<tr' + (f.tons > 0 ? '' : ' style="opacity:0.55"') + '>' +
        '<td>' + util.escHtml(f.farm) + '</td>' +
        '<td>' + util.escHtml(f.crop || '') + '</td>' +
        '<td class="number">' + util.formatNum(f.acres, 1) + '</td>' +
        '<td class="number">' + f.saleCount + '</td>' +
        '<td class="number">' + util.formatNum(f.tons, 2) + '</td>' +
        '<td class="number">' + (f.tonsPerAcre ? util.formatNum(f.tonsPerAcre, 2) : '--') + '</td>' +
        '<td class="number">' + (f.avgPricePerTon ? util.formatMoney(f.avgPricePerTon) : '--') + '</td>' +
        '<td class="number">' + util.formatMoney(f.dollars) + '</td>' +
        '<td class="number"><strong>' + (f.dollarsPerAcre ? util.formatMoney(f.dollarsPerAcre) : '--') + '</strong></td>' +
        '<td class="number">' + (applied ? util.formatMoney(f.budgetStrawPerAcre) : '--') + '</td>' +
        '<td>' + (f.tons > 0
          ? '<button class="btn-secondary straw-apply" data-field-id="' + f.fieldId + '" data-per-acre="' + f.dollarsPerAcre + '"' +
            (inSync ? ' disabled title="Budget matches"' : ' title="Write $/AC to field as STRAW aux payment"') + '>' +
            (inSync ? '✓ Applied' : 'Apply → Budget') + '</button>'
          : '') + '</td>' +
        '</tr>';
    });
    html += '<tr class="total-row"><td>TOTAL</td><td></td>' +
      '<td class="number">' + util.formatNum(tAcres, 1) + '</td><td></td>' +
      '<td class="number">' + util.formatNum(tTons, 2) + '</td>' +
      '<td class="number">' + (tAcresSold > 0 ? util.formatNum(tTons / tAcresSold, 2) : '--') + '</td>' +
      '<td class="number">' + (tTons > 0 ? util.formatMoney(tDollars / tTons) : '--') + '</td>' +
      '<td class="number">' + util.formatMoney(tDollars) + '</td>' +
      '<td class="number">' + (tAcresSold > 0 ? util.formatMoney(tDollars / tAcresSold) : '--') + '</td>' +
      '<td></td><td></td></tr>';
    html += '</tbody></table></div>';
    if (tAcresSold > 0 && tAcresSold !== tAcres) {
      html += '<p style="color:var(--text-dim);font-size:0.8rem;margin:0.25rem 0 1rem">' +
        'TOTAL Tons/AC and $/AC use only farms with sales (' + util.formatNum(tAcresSold, 1) + ' ac).</p>';
    }

    // ── Sales log ──
    html += '<h3 style="margin:1.25rem 0 0.5rem">Sales Log — ' + year + '</h3>';
    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Date</th><th>Farm</th><th>Buyer</th><th class="number">Tons</th>' +
      '<th class="number">$/Ton</th><th class="number">Total $</th><th>Notes</th><th></th>' +
      '</tr></thead><tbody id="straw-log-tbody">';
    if (!sales.length) {
      html += '<tr><td colspan="8" style="color:var(--text-dim);padding:1rem">No straw sales logged for ' + year + ' yet — pick a farm above and Add Sale.</td></tr>';
    }
    var logTons = 0, logDollars = 0;
    sales.forEach(function (s) {
      var total = (Number(s.tons) || 0) * (Number(s.pricePerTon) || 0);
      logTons += Number(s.tons) || 0;
      logDollars += total;
      var fName = farmName(s.fieldId) || s.farm || '?';
      html += '<tr>' +
        '<td class="editable" data-id="' + s.id + '" data-field="date">' + util.escHtml(s.date || '') + '</td>' +
        '<td class="straw-farm-cell" data-id="' + s.id + '" data-field-id="' + (s.fieldId || '') + '" style="cursor:pointer" title="dbl-click to change farm">' + util.escHtml(fName) + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="buyer">' + util.escHtml(s.buyer || '') + '</td>' +
        '<td class="editable number" data-id="' + s.id + '" data-field="tons">' + util.formatNum(s.tons || 0, 2) + '</td>' +
        '<td class="editable number" data-id="' + s.id + '" data-field="pricePerTon">' + util.formatMoney(s.pricePerTon || 0) + '</td>' +
        '<td class="number">' + util.formatMoney(total) + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="notes">' + util.escHtml(s.notes || '') + '</td>' +
        '<td><button class="btn-danger straw-del" data-id="' + s.id + '">Del</button></td>' +
        '</tr>';
    });
    if (sales.length) {
      html += '<tr class="total-row"><td>TOTAL</td><td></td><td></td>' +
        '<td class="number">' + util.formatNum(logTons, 2) + '</td><td></td>' +
        '<td class="number">' + util.formatMoney(logDollars) + '</td><td></td><td></td></tr>';
    }
    html += '</tbody></table></div>';

    root.innerHTML = html;
    wireEvents(root);
  }

  function wireEvents(root) {
    document.getElementById('straw-year-prev').addEventListener('click', function () { year--; load(); });
    document.getElementById('straw-year-next').addEventListener('click', function () { year++; load(); });

    document.getElementById('straw-add').addEventListener('click', function () {
      var sel = document.getElementById('straw-add-farm');
      var fieldId = sel.value;
      if (!fieldId) { util.showToast('Pick a farm first', 2000, 'error'); return; }
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

    root.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () { startEdit(td); });
    });

    root.querySelectorAll('.straw-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this straw sale?')) return;
        api.del('/api/straw-sales/' + btn.getAttribute('data-id')).then(function () {
          load();
          util.showToast('Sale deleted');
        });
      });
    });

    root.querySelectorAll('.straw-apply').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var perAcre = parseFloat(btn.getAttribute('data-per-acre')) || 0;
        api.post('/api/straw/apply/' + btn.getAttribute('data-field-id'), { perAcre: perAcre }).then(function () {
          load();
          util.showToast('STRAW ' + util.formatMoney(perAcre) + '/ac written to field budget');
        });
      });
    });

    // Farm reassignment via select
    root.querySelectorAll('.straw-farm-cell').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        td.classList.add('editing');
        var id = td.getAttribute('data-id');
        var current = td.getAttribute('data-field-id') || '';
        var select = document.createElement('select');
        (summary.fields || []).forEach(function (f) {
          var opt = document.createElement('option');
          opt.value = f.fieldId;
          opt.textContent = f.farm + ' (' + (f.crop || '') + ')';
          if (f.fieldId === current) opt.selected = true;
          select.appendChild(opt);
        });
        td.textContent = '';
        td.appendChild(select);
        select.focus();
        select.addEventListener('change', function () {
          api.put('/api/straw-sales/' + id, { fieldId: select.value, farm: farmName(select.value) || '' })
            .then(load);
        });
        select.addEventListener('blur', function () {
          if (select.parentNode === td) load();
        });
      });
    });
  }

  function startEdit(td) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var oldVal = td.textContent.replace(/[$,]/g, '').trim();
    var isNum = (field === 'tons' || field === 'pricePerTon');

    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = isNum ? 'number' : (field === 'date' ? 'date' : 'text');
    if (isNum) input.step = '0.01';
    input.value = oldVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    function save() {
      var data = {};
      data[field] = isNum ? (parseFloat(input.value) || 0) : input.value;
      api.put('/api/straw-sales/' + id, data).then(load);
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') load();
    });
  }
})();
