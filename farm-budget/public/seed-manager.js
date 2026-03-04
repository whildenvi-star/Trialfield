// Seeds Manager — CRUD for seed varieties + Enterprise Demand
(function () {
  'use strict';

  var allSeeds = [];
  var allSeedFields = [];
  var loaded = false;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'seeds') loadSeeds();
  });

  function loadSeeds() {
    Promise.all([
      api.get('/api/seeds'),
      api.get('/api/fields?all=true')
    ]).then(function (results) {
      allSeeds = results[0];
      allSeedFields = results[1];
      renderTable(allSeeds);
      renderSeedDemand(allSeedFields, allSeeds);
      loaded = true;
    });
  }

  document.getElementById('seed-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allSeeds.filter(function (s) {
      return (s.crop || '').toLowerCase().includes(q) ||
             (s.brand || '').toLowerCase().includes(q) ||
             (s.variety || '').toLowerCase().includes(q);
    });
    renderTable(filtered);
  });

  document.getElementById('seed-add').addEventListener('click', function () {
    api.post('/api/seeds', {
      crop: '',
      brand: '',
      variety: 'New Variety',
      pricePerUnit: 0,
      seedsPerUnit: 80000
    }).then(function () {
      loaded = false;
      loadSeeds();
      util.showToast('Seed added');
    });
  });

  function getSupplierName(id) {
    if (!id) return '--';
    var suppliers = window.refData.suppliers || [];
    var sup = suppliers.find(function (s) { return s.id === id; });
    return sup ? sup.name : '--';
  }

  function renderTable(seeds) {
    var tbody = document.getElementById('seed-tbody');
    var html = '';
    seeds.forEach(function (s) {
      var supplierName = getSupplierName(s.supplierId);
      html += '<tr>' +
        '<td class="editable" data-id="' + s.id + '" data-field="crop">' + util.escHtml(s.crop) + '</td>' +
        '<td class="supplier-cell" data-id="' + s.id + '" data-supplier-id="' + (s.supplierId || '') + '" style="cursor:pointer">' + util.escHtml(supplierName) + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="brand">' + util.escHtml(s.brand) + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="variety">' + util.escHtml(s.variety) + '</td>' +
        '<td class="editable number" data-id="' + s.id + '" data-field="pricePerUnit">' + util.formatMoney(s.pricePerUnit) + '</td>' +
        '<td class="editable number" data-id="' + s.id + '" data-field="seedsPerUnit">' + util.formatNum(s.seedsPerUnit, 0) + '</td>' +
        '<td><button class="btn-danger" data-del-id="' + s.id + '">Del</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    document.getElementById('seed-count').textContent = seeds.length + ' seed varieties';

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () { startEdit(td, 'seeds'); });
    });

    tbody.querySelectorAll('[data-del-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this seed?')) return;
        api.del('/api/seeds/' + btn.getAttribute('data-del-id')).then(function () {
          loaded = false;
          loadSeeds();
          util.showToast('Seed deleted');
        });
      });
    });

    // Supplier select
    tbody.querySelectorAll('.supplier-cell').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        td.classList.add('editing');
        var id = td.getAttribute('data-id');
        var currentVal = td.getAttribute('data-supplier-id') || '';
        var suppliers = (window.refData.suppliers || []).filter(function (s) { return s.type === 'seed'; });

        var select = document.createElement('select');
        select.style.width = '140px';
        select.innerHTML = '<option value="">— none —</option>';
        suppliers.forEach(function (s) {
          var opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          if (s.id === currentVal) opt.selected = true;
          select.appendChild(opt);
        });
        var addOpt = document.createElement('option');
        addOpt.value = '__add__';
        addOpt.textContent = '+ Add New';
        select.appendChild(addOpt);

        td.textContent = '';
        td.appendChild(select);
        select.focus();

        function save() {
          var val = select.value;
          if (val === '__add__') {
            var name = prompt('New seed supplier name:');
            if (!name) { loaded = false; loadSeeds(); return; }
            api.post('/api/suppliers', { name: name, type: 'seed', contact: '', notes: '' }).then(function (newSup) {
              return api.put('/api/seeds/' + id, { supplierId: newSup.id });
            }).then(function () {
              window.reloadRefDataSelective('seeds,suppliers').then(function () { loaded = false; loadSeeds(); });
              util.showToast('Supplier created & assigned');
            });
            return;
          }
          api.put('/api/seeds/' + id, { supplierId: val }).then(function () {
            loaded = false;
            loadSeeds();
          });
        }

        select.addEventListener('change', save);
        select.addEventListener('blur', function () {
          if (select.parentNode === td) { loaded = false; loadSeeds(); }
        });
      });
    });
  }

  // === SEED DEMAND BY ENTERPRISE ===

  function renderSeedDemand(fields, seeds) {
    var enterprises = window.refData.enterprises;
    if (!enterprises.length || !fields.length) {
      document.getElementById('seed-demand-tbody').innerHTML = '<tr><td>No data</td></tr>';
      return;
    }

    // Build seed index by lowercase variety
    var seedIndex = {};
    seeds.forEach(function (s) {
      seedIndex[(s.variety || '').trim().toLowerCase()] = s;
    });

    // demand[variety][entIdx] = { units, cost }
    var demand = {};
    fields.forEach(function (f) {
      if (!f.seed || !f.seed.variety) return;
      var entIdx = enterprises.findIndex(function (e) { return e.id === f.enterpriseId; });
      if (entIdx < 0) return;
      var fieldAcres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
      var key = f.seed.variety.trim().toLowerCase();
      var seed = seedIndex[key];
      var pop = f.seed.population || 0;
      var seedsPerUnit = seed ? (seed.seedsPerUnit || 1) : 1;
      var unitsNeeded = seedsPerUnit > 0 ? Math.ceil(pop * fieldAcres / seedsPerUnit) : 0;
      var cost = seed ? unitsNeeded * (seed.pricePerUnit || 0) : 0;

      if (!demand[f.seed.variety]) demand[f.seed.variety] = {};
      if (!demand[f.seed.variety][entIdx]) demand[f.seed.variety][entIdx] = { units: 0, cost: 0 };
      demand[f.seed.variety][entIdx].units += unitsNeeded;
      demand[f.seed.variety][entIdx].cost += cost;
    });

    // Build header
    var thead = '<tr><th>Crop</th><th>Variety</th><th>Brand</th><th>Price/Unit</th>';
    enterprises.forEach(function (e) {
      thead += '<th title="' + util.escHtml(e.name) + '">' + util.escHtml(e.shortName) + '</th>';
    });
    thead += '<th>FARM TOTAL</th></tr>';
    document.getElementById('seed-demand-thead').innerHTML = thead;

    // Build rows
    var usedVarieties = Object.keys(demand).sort();
    var html = '';
    var grandTotals = {};
    var grandTotal = { units: 0, cost: 0 };
    enterprises.forEach(function (e, idx) { grandTotals[idx] = { units: 0, cost: 0 }; });

    usedVarieties.forEach(function (variety) {
      var key = variety.trim().toLowerCase();
      var seed = seedIndex[key];
      var crop = seed ? (seed.crop || '--') : '--';
      var brand = seed ? (seed.brand || '--') : '--';
      var pricePerUnit = seed ? util.formatMoney(seed.pricePerUnit) : '--';

      html += '<tr><td>' + util.escHtml(crop) + '</td>';
      html += '<td>' + util.escHtml(variety) + '</td>';
      html += '<td>' + util.escHtml(brand) + '</td>';
      html += '<td class="number">' + pricePerUnit + '</td>';

      var rowTotal = { units: 0, cost: 0 };

      enterprises.forEach(function (e, idx) {
        var d = demand[variety] && demand[variety][idx];
        if (d) {
          rowTotal.units += d.units;
          rowTotal.cost += d.cost;
          grandTotals[idx].units += d.units;
          grandTotals[idx].cost += d.cost;

          html += '<td class="number">' + util.formatNum(d.units, 0) + ' units' +
            '<br><small style="color:var(--text-light)">' + util.formatMoney(d.cost, 0) + '</small></td>';
        } else {
          html += '<td class="number" style="color:var(--text-light)">--</td>';
        }
      });

      grandTotal.units += rowTotal.units;
      grandTotal.cost += rowTotal.cost;
      html += '<td class="number bold">' + util.formatNum(rowTotal.units, 0) + ' units' +
        '<br><small style="color:var(--text-light)">' + util.formatMoney(rowTotal.cost, 0) + '</small></td></tr>';
    });

    // Grand total row
    html += '<tr class="total-row"><td class="bold" colspan="4">TOTAL</td>';
    enterprises.forEach(function (e, idx) {
      var t = grandTotals[idx];
      html += '<td class="number bold">' + util.formatNum(t.units, 0) + ' units' +
        '<br><small>' + util.formatMoney(t.cost, 0) + '</small></td>';
    });
    html += '<td class="number bold">' + util.formatNum(grandTotal.units, 0) + ' units' +
      '<br><small>' + util.formatMoney(grandTotal.cost, 0) + '</small></td></tr>';

    document.getElementById('seed-demand-tbody').innerHTML = html;
    document.getElementById('seed-demand-info').textContent =
      usedVarieties.length + ' varieties in use, ' + util.formatMoney(grandTotal.cost, 0) + ' total seed cost';
  }

  function startEdit(td, type) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var oldVal = td.textContent.replace(/[$,]/g, '').trim();

    td.classList.add('editing');
    var input = document.createElement('input');
    var isNum = (field === 'pricePerUnit' || field === 'seedsPerUnit');
    input.type = isNum ? 'number' : 'text';
    if (isNum) input.step = '0.01';
    input.value = oldVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var data = {};
      data[field] = isNum ? (parseFloat(input.value) || 0) : input.value;
      api.put('/api/' + type + '/' + id, data).then(function () {
        loaded = false;
        loadSeeds();
        window.reloadRefDataSelective('seeds,suppliers');
        // Notify other tabs that seed data changed (Task 3: reactive data flow)
        window.dispatchEvent(new CustomEvent('seeds-data-changed'));
      });
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { loaded = false; loadSeeds(); }
    });
  }

  // Also fire event after seed add/delete
  var origAddHandler = document.getElementById('seed-add');
  // The event is already bound above, but we add a listener for the reactive event
  window.addEventListener('ref-data-loaded', function () {
    // Whenever ref data reloads, seed varieties become available upstream automatically
    // because field-editor reads from window.refData.seedVarieties
  });
})();
