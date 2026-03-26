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
        '<td style="text-align:center"><span class="seed-og-toggle" data-id="' + s.id + '" data-og="' + (s.organicGround ? '1' : '0') + '" style="cursor:pointer;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.65rem;font-weight:600;' + (s.organicGround ? 'background:#16a34a;color:#fff' : 'background:var(--bg-alt);color:var(--text-light)') + '">' + (s.organicGround ? 'OG' : '—') + '</span></td>' +
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

    // Organic Ground toggle
    tbody.querySelectorAll('.seed-og-toggle').forEach(function (span) {
      span.addEventListener('click', function () {
        var id = span.getAttribute('data-id');
        var current = span.getAttribute('data-og') === '1';
        api.put('/api/seeds/' + id, { organicGround: !current }).then(function () {
          loaded = false;
          loadSeeds();
          util.showToast(current ? 'Removed organic ground designation' : 'Designated for organic ground');
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

  // === SEED DEMAND — EXPANDABLE FIELD VIEW ===

  function renderSeedDemand(fields, seeds) {
    var enterprises = window.refData.enterprises;
    var container = document.getElementById('seed-demand-container');
    if (!container) return;
    if (!fields.length) {
      container.innerHTML = '<p style="color:var(--text-light)">No field data</p>';
      return;
    }

    // Build seed index by lowercase variety
    var seedIndex = {};
    seeds.forEach(function (s) {
      seedIndex[(s.variety || '').trim().toLowerCase()] = s;
    });

    // Build enterprise index by id
    var entMap = {};
    enterprises.forEach(function (e) { entMap[e.id] = e; });

    // Build supplier map
    var supplierMap = {};
    (window.refData.suppliers || []).forEach(function (s) { supplierMap[s.id] = s.name; });

    // demand[variety] = { crop, brand, pricePerUnit, totalUnits, totalCost, fields: [...] }
    var demand = {};
    fields.forEach(function (f) {
      var fieldAcres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
      var ent = entMap[f.enterpriseId];
      // Support multi-variety seeds array, fall back to legacy single seed
      var seedEntries = f.seeds && f.seeds.length > 0
        ? f.seeds
        : (f.seed && f.seed.variety ? [f.seed] : []);
      seedEntries.forEach(function (se) {
        if (!se.variety) return;
        var key = se.variety.trim().toLowerCase();
        var seed = seedIndex[key];
        var pop = se.population || 0;
        var seedAcres = se.acres > 0 ? se.acres : fieldAcres;
        var seedsPerUnit = seed ? (seed.seedsPerUnit || 1) : 1;
        var unitsNeeded = seedsPerUnit > 0 ? Math.ceil(pop * seedAcres / seedsPerUnit) : 0;
        var cost = seed ? unitsNeeded * (seed.pricePerUnit || 0) : 0;

        if (!demand[se.variety]) {
          demand[se.variety] = {
            crop: seed ? (seed.crop || '--') : '--',
            brand: seed ? (seed.brand || '--') : '--',
            pricePerUnit: seed ? (seed.pricePerUnit || 0) : 0,
            supplier: seed && seed.supplierId ? (supplierMap[seed.supplierId] || '') : '',
            totalUnits: 0, totalCost: 0, fields: []
          };
        }
        demand[se.variety].totalUnits += unitsNeeded;
        demand[se.variety].totalCost += cost;
        demand[se.variety].fields.push({
          name: f.name,
          acres: seedAcres,
          population: pop,
          units: unitsNeeded,
          cost: cost,
          enterprise: ent ? (ent.shortName || ent.name) : '--'
        });
      });
    });

    var usedVarieties = Object.keys(demand).sort();
    var grandCost = 0;
    usedVarieties.forEach(function (v) { grandCost += demand[v].totalCost; });

    var html = '';
    usedVarieties.forEach(function (variety) {
      var d = demand[variety];
      var safeId = variety.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Sort fields by units descending
      d.fields.sort(function (a, b) { return b.units - a.units; });

      html += '<details class="demand-expand" id="seed-exp-' + safeId + '">';
      html += '<summary class="demand-summary">';
      html += '<span class="demand-name">' + util.escHtml(variety) + '</span>';
      html += '<span class="demand-supplier">' + util.escHtml(d.crop) + (d.brand !== '--' ? ' &middot; ' + util.escHtml(d.brand) : '') + '</span>';
      html += '<span class="demand-totals">' + util.formatNum(d.totalUnits, 0) + ' units &middot; ' + util.formatMoney(d.totalCost, 0) + '</span>';
      html += '<span class="demand-field-count">' + d.fields.length + ' field' + (d.fields.length !== 1 ? 's' : '') + '</span>';
      html += '</summary>';

      html += '<table class="demand-fields-table"><thead><tr>' +
        '<th>Field</th><th>Enterprise</th><th>Acres</th><th>Population</th>' +
        '<th>Units Needed</th><th>Cost</th>' +
        '</tr></thead><tbody>';

      d.fields.forEach(function (f) {
        html += '<tr>' +
          '<td>' + util.escHtml(f.name) + '</td>' +
          '<td>' + util.escHtml(f.enterprise) + '</td>' +
          '<td class="number">' + util.formatNum(f.acres, 1) + '</td>' +
          '<td class="number">' + util.formatNum(f.population, 0) + '</td>' +
          '<td class="number">' + util.formatNum(f.units, 0) + '</td>' +
          '<td class="number">' + util.formatMoney(f.cost, 0) + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></details>';
    });

    container.innerHTML = html;
    document.getElementById('seed-demand-info').textContent =
      usedVarieties.length + ' varieties in use, ' + util.formatMoney(grandCost, 0) + ' total seed cost';
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
