// Inputs Manager — Products + Implements CRUD + Enterprise Usage + Labor/Overhead + Machinery Mode
(function () {
  'use strict';

  var allProducts = [];
  var allImplements = [];
  var allLaborOverhead = [];
  var allFields = [];
  var showFuelInUsage = false;
  var loaded = false;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'reference') loadAll();
  });

  var allSuppliers = [];

  function loadAll() {
    Promise.all([
      api.get('/api/products'),
      api.get('/api/implements'),
      api.get('/api/fields?all=true'),
      api.get('/api/labor-overhead'),
      api.get('/api/suppliers')
    ]).then(function (results) {
      allProducts = results[0];
      allImplements = results[1];
      allFields = results[2];
      allLaborOverhead = results[3];
      allSuppliers = results[4];
      renderProductTable(allProducts);
      renderImplTable(allImplements);
      renderMachMode();
      renderImplUsage(allFields, allImplements);
      renderLaborOverhead(allLaborOverhead);
      renderSupplierTable(allSuppliers);
      loaded = true;
    });
  }

  // === PRODUCTS ===

  document.getElementById('inp-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allProducts.filter(function (p) {
      return p.name.toLowerCase().includes(q) || (p.unit || '').toLowerCase().includes(q);
    });
    renderProductTable(filtered);
  });

  document.getElementById('inp-add').addEventListener('click', function () {
    api.post('/api/products', {
      name: 'New Product',
      unitBilledPrice: 0,
      conversionRate: 1,
      increasePercent: 1,
      unit: 'Lbs',
      p205: 0,
      k20: 0
    }).then(function () {
      loaded = false;
      loadAll();
      util.showToast('Product added');
    });
  });

  // Supplier select helper — creates inline select on dblclick
  function getSupplierName(id, type) {
    if (!id) return '--';
    var suppliers = window.refData.suppliers || [];
    var sup = suppliers.find(function (s) { return s.id === id; });
    return sup ? sup.name : '--';
  }

  function bindSupplierSelect(tbody, apiType, idField, supplierType) {
    tbody.querySelectorAll('.supplier-cell[data-type="' + apiType + '"]').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        td.classList.add('editing');
        var id = td.getAttribute('data-id');
        var currentVal = td.getAttribute('data-supplier-id') || '';
        var suppliers = (window.refData.suppliers || []).filter(function (s) {
          return !supplierType || s.type === supplierType;
        });

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
            var name = prompt('New supplier name:');
            if (!name) { loadAll(); return; }
            api.post('/api/suppliers', { name: name, type: supplierType || 'product', contact: '', notes: '' }).then(function (newSup) {
              var data = {};
              data[idField] = newSup.id;
              return api.put('/api/' + apiType + '/' + id, data);
            }).then(function () {
              window.reloadRefDataSelective('products,implements,suppliers').then(function () { loaded = false; loadAll(); });
              util.showToast('Supplier created & assigned');
            });
            return;
          }
          var data = {};
          data[idField] = val;
          api.put('/api/' + apiType + '/' + id, data).then(function () {
            loaded = false;
            loadAll();
          });
        }

        select.addEventListener('change', save);
        select.addEventListener('blur', function () {
          if (select.parentNode === td) { loaded = false; loadAll(); }
        });
      });
    });
  }

  function renderProductTable(products) {
    var tbody = document.getElementById('inp-tbody');
    var html = '';
    products.forEach(function (p) {
      var appPrice = Calc.computeApplicationPrice(p);
      var supplierName = getSupplierName(p.supplierId, 'product');
      html += '<tr>' +
        '<td class="editable" data-id="' + p.id + '" data-field="name" data-type="products">' + util.escHtml(p.name) + '</td>' +
        '<td class="supplier-cell" data-id="' + p.id + '" data-supplier-id="' + (p.supplierId || '') + '" data-type="products" style="cursor:pointer">' + util.escHtml(supplierName) + '</td>' +
        '<td class="editable number" data-id="' + p.id + '" data-field="unitBilledPrice" data-type="products">' + util.formatMoney(p.unitBilledPrice) + '</td>' +
        '<td class="editable number" data-id="' + p.id + '" data-field="conversionRate" data-type="products">' + util.formatNum(p.conversionRate, 2) + '</td>' +
        '<td class="editable number" data-id="' + p.id + '" data-field="increasePercent" data-type="products">' + util.formatNum(p.increasePercent, 2) + '</td>' +
        '<td class="number">' + util.formatMoney(appPrice, 4) + '</td>' +
        '<td class="editable" data-id="' + p.id + '" data-field="unit" data-type="products">' + util.escHtml(p.unit) + '</td>' +
        '<td><button class="btn-danger" data-del-id="' + p.id + '" data-del-type="products">Del</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    bindEditing(tbody, 'products');
    bindDelete(tbody, 'products');
    bindSupplierSelect(tbody, 'products', 'supplierId', 'product');
    document.getElementById('inp-count').textContent = products.length + ' products';
  }

  // === IMPLEMENTS ===

  document.getElementById('impl-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allImplements.filter(function (i) {
      return i.name.toLowerCase().includes(q);
    });
    renderImplTable(filtered);
  });

  document.getElementById('impl-add').addEventListener('click', function () {
    api.post('/api/implements', {
      name: 'New Implement',
      costPerAcre: 0,
      fuelGalPerAcre: 0,
      laborHoursPerAcre: 0,
      customHireRate: 0,
      defaultMode: 'owned',
      unit: '/Ac'
    }).then(function () {
      loaded = false;
      loadAll();
      util.showToast('Implement added');
    });
  });

  function renderImplTable(implements_) {
    var fuelPrice = (window.refData.settings && window.refData.settings.fuelPricePerGal) || 5;
    var tbody = document.getElementById('impl-tbody');
    var html = '';
    implements_.forEach(function (imp) {
      var fuelCost = (imp.fuelGalPerAcre || 0) * fuelPrice;
      var ownedTotal = (imp.costPerAcre || 0) + fuelCost;
      var hasHire = imp.customHireRate > 0;
      var modeLabel = (imp.defaultMode === 'hire' && hasHire) ? 'Custom Hire' : 'Owned';
      var modeCls = (imp.defaultMode === 'hire' && hasHire) ? 'status-open' : 'status-done';
      var effectiveCost = (imp.defaultMode === 'hire' && hasHire) ? imp.customHireRate : ownedTotal;

      html += '<tr>' +
        '<td class="editable" data-id="' + imp.id + '" data-field="name" data-type="implements">' + util.escHtml(imp.name) + '</td>' +
        '<td class="editable number" data-id="' + imp.id + '" data-field="costPerAcre" data-type="implements">' + util.formatMoney(imp.costPerAcre) + '</td>' +
        '<td class="editable number" data-id="' + imp.id + '" data-field="fuelGalPerAcre" data-type="implements">' + util.formatNum(imp.fuelGalPerAcre, 2) + '</td>' +
        '<td class="number">' + util.formatMoney(fuelCost) + '</td>' +
        '<td class="number">' + util.formatMoney(ownedTotal) + '</td>' +
        '<td class="editable number" data-id="' + imp.id + '" data-field="laborHoursPerAcre" data-type="implements">' + util.formatNum(imp.laborHoursPerAcre || 0, 2) + '</td>' +
        '<td class="editable number" data-id="' + imp.id + '" data-field="customHireRate" data-type="implements">' +
          (hasHire ? util.formatMoney(imp.customHireRate) : '--') + '</td>' +
        '<td class="mode-toggle" data-id="' + imp.id + '" data-mode="' + (imp.defaultMode || 'owned') + '">' +
          '<span class="status-badge ' + modeCls + '">' + modeLabel + '</span></td>' +
        '<td class="number">' + util.formatMoney(effectiveCost) + '</td>' +
        '<td><button class="btn-danger" data-del-id="' + imp.id + '" data-del-type="implements">Del</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    bindEditing(tbody, 'implements');
    bindDelete(tbody, 'implements');

    // Mode toggle
    tbody.querySelectorAll('.mode-toggle').forEach(function (td) {
      td.addEventListener('click', function () {
        var id = td.getAttribute('data-id');
        var current = td.getAttribute('data-mode') || 'owned';
        var newMode = current === 'owned' ? 'hire' : 'owned';
        api.put('/api/implements/' + id, { defaultMode: newMode }).then(function () {
          loaded = false;
          loadAll();
          util.showToast(newMode === 'hire' ? 'Switched to Custom Hire' : 'Switched to Owned');
        });
      });
    });

    document.getElementById('impl-count').textContent = implements_.length + ' implements';
  }

  // === MACHINERY COSTING MODE (Feature 2) ===

  var machFlatBtn = document.getElementById('mach-mode-flat');
  var machItemBtn = document.getElementById('mach-mode-itemized');

  machFlatBtn.addEventListener('click', function () {
    if (window.refData.settings.useFixedMachineryRate) return;
    window.refData.settings.useFixedMachineryRate = true;
    api.put('/api/settings', { useFixedMachineryRate: true }).then(function () {
      renderMachMode();
      util.showToast('Switched to flat rate');
    });
  });

  machItemBtn.addEventListener('click', function () {
    if (!window.refData.settings.useFixedMachineryRate) return;
    window.refData.settings.useFixedMachineryRate = false;
    api.put('/api/settings', { useFixedMachineryRate: false }).then(function () {
      renderMachMode();
      util.showToast('Switched to itemized costs');
    });
  });

  function renderMachMode() {
    var isFlat = window.refData.settings.useFixedMachineryRate;
    var flatRate = window.refData.settings.fixedMachineryRate || 100;

    machFlatBtn.classList.toggle('active', isFlat);
    machItemBtn.classList.toggle('active', !isFlat);

    // Calculate average itemized cost across all fields
    var totalItemized = 0;
    var totalAcres = 0;
    var fieldCount = 0;
    allFields.forEach(function (f) {
      var acres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
      if (!acres) return;
      var machCost = 0;
      (f.machinery || []).forEach(function (m) {
        var impl = allImplements.find(function (i) {
          return (i.name || '').toLowerCase() === (m.implementName || '').toLowerCase();
        });
        if (impl) {
          var effectiveCost;
          if (impl.defaultMode === 'hire' && impl.customHireRate > 0) {
            effectiveCost = impl.customHireRate;
          } else {
            effectiveCost = impl.costPerAcre || 0;
          }
          machCost += effectiveCost * (m.passes || 1);
        }
      });
      totalItemized += machCost * acres;
      totalAcres += acres;
      fieldCount++;
    });

    var avgItemized = totalAcres > 0 ? totalItemized / totalAcres : 0;
    var delta = flatRate - avgItemized;
    var info = document.getElementById('mach-mode-info');

    if (isFlat) {
      var cls = delta > 0 ? 'profit-neg' : 'profit-pos';
      info.innerHTML =
        '<div class="mach-comparison">' +
          '<span>Currently using <strong>' + util.formatMoney(flatRate) + '/ac flat rate</strong> for all fields.</span>' +
          '<span>Your itemized costs average <strong>' + util.formatMoney(avgItemized) + '/ac</strong> across ' + fieldCount + ' fields.</span>' +
          '<span class="' + cls + '">Difference: <strong>' + util.formatMoney(Math.abs(delta)) + '/ac</strong> ' +
            (delta > 0 ? '(flat rate is higher — you may be over-budgeting)' : '(flat rate is lower — you may be under-budgeting)') +
          '</span>' +
        '</div>';
    } else {
      info.innerHTML =
        '<div class="mach-comparison">' +
          '<span>Using <strong>itemized costs</strong> — each field\'s machinery cost is the sum of its implement passes.</span>' +
          '<span>Average across ' + fieldCount + ' fields: <strong>' + util.formatMoney(avgItemized) + '/ac</strong></span>' +
          '<span>Previous flat rate was: ' + util.formatMoney(flatRate) + '/ac</span>' +
        '</div>';
    }
  }

  // === IMPLEMENT USAGE & COST BY ENTERPRISE (Feature 4) ===

  document.getElementById('impl-usage-fuel-toggle').addEventListener('click', function () {
    showFuelInUsage = !showFuelInUsage;
    this.textContent = showFuelInUsage ? 'Hide Fuel Costs' : 'Show Fuel Costs';
    renderImplUsage(allFields, allImplements);
  });

  function renderImplUsage(fields, implements_) {
    var enterprises = window.refData.enterprises;
    var fuelPrice = (window.refData.settings && window.refData.settings.fuelPricePerGal) || 5;
    if (!enterprises.length || !fields.length) {
      document.getElementById('impl-usage-tbody').innerHTML = '<tr><td>No data</td></tr>';
      return;
    }

    // Build usage map: implName -> { entIdx -> { acres, passes, fields, cost, fuelCost } }
    var usage = {};
    fields.forEach(function (f) {
      var entIdx = enterprises.findIndex(function (e) { return e.id === f.enterpriseId; });
      if (entIdx < 0) return;
      var fieldAcres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
      (f.machinery || []).forEach(function (m) {
        var name = m.implementName;
        if (!name) return;
        var impl = implements_.find(function (i) {
          return (i.name || '').toLowerCase() === name.toLowerCase();
        });
        var passes = m.passes || 1;
        var costPerAcre = impl ? impl.costPerAcre || 0 : 0;
        var fuelGal = impl ? impl.fuelGalPerAcre || 0 : 0;

        // Use custom hire if applicable
        if (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0) {
          costPerAcre = impl.customHireRate;
          fuelGal = 0; // custom hire includes fuel
        }

        if (!usage[name]) usage[name] = {};
        if (!usage[name][entIdx]) usage[name][entIdx] = { acres: 0, passes: 0, fields: 0, cost: 0, fuelCost: 0 };
        var acresWorked = fieldAcres * passes;
        usage[name][entIdx].acres += acresWorked;
        usage[name][entIdx].passes += passes;
        usage[name][entIdx].fields += 1;
        usage[name][entIdx].cost += costPerAcre * acresWorked;
        usage[name][entIdx].fuelCost += fuelGal * fuelPrice * acresWorked;
      });
    });

    // Build header
    var colCount = enterprises.length + 3; // impl name + cost/ac + enterprises + total
    var thead = '<tr><th>Implement</th><th>Cost/AC</th>';
    enterprises.forEach(function (e) {
      thead += '<th title="' + util.escHtml(e.name) + '">' + util.escHtml(e.shortName) + '</th>';
    });
    thead += '<th>TOTAL</th></tr>';
    document.getElementById('impl-usage-thead').innerHTML = thead;

    // Build rows
    var usedNames = Object.keys(usage).sort();
    var html = '';
    var grandTotals = {};
    var grandTotal = { cost: 0, fuelCost: 0, acres: 0 };

    enterprises.forEach(function (e, idx) {
      grandTotals[idx] = { cost: 0, fuelCost: 0, acres: 0 };
    });

    usedNames.forEach(function (name) {
      var impl = implements_.find(function (i) {
        return (i.name || '').toLowerCase() === name.toLowerCase();
      });
      var isHire = impl && impl.defaultMode === 'hire' && impl.customHireRate > 0;
      var displayCost = isHire ? impl.customHireRate : (impl ? impl.costPerAcre : 0);

      html += '<tr><td>' + util.escHtml(name) +
        (isHire ? ' <span class="status-badge status-open" style="font-size:0.65rem">Hire</span>' : '') +
        '</td>';
      html += '<td class="number">' + util.formatMoney(displayCost) + '</td>';

      var rowTotal = { cost: 0, fuelCost: 0, acres: 0 };

      enterprises.forEach(function (e, idx) {
        var u = usage[name] && usage[name][idx];
        if (u) {
          rowTotal.cost += u.cost;
          rowTotal.fuelCost += u.fuelCost;
          rowTotal.acres += u.acres;
          grandTotals[idx].cost += u.cost;
          grandTotals[idx].fuelCost += u.fuelCost;
          grandTotals[idx].acres += u.acres;

          var cellVal = util.formatMoney(u.cost, 0);
          var tip = util.formatNum(u.acres, 0) + ' ac, ' + u.fields + ' fields';
          if (showFuelInUsage) {
            cellVal += '<br><small style="color:var(--text-light)">' + util.formatMoney(u.fuelCost, 0) + ' fuel</small>';
          }
          html += '<td class="number" title="' + tip + '">' + cellVal + '</td>';
        } else {
          html += '<td class="number" style="color:var(--text-light)">--</td>';
        }
      });

      grandTotal.cost += rowTotal.cost;
      grandTotal.fuelCost += rowTotal.fuelCost;
      grandTotal.acres += rowTotal.acres;

      var totalCell = util.formatMoney(rowTotal.cost, 0);
      if (showFuelInUsage) {
        totalCell += '<br><small style="color:var(--text-light)">' + util.formatMoney(rowTotal.fuelCost, 0) + ' fuel</small>';
      }
      html += '<td class="number bold">' + totalCell + '</td></tr>';
    });

    // Grand total row
    html += '<tr class="total-row"><td class="bold" colspan="2">TOTAL</td>';
    enterprises.forEach(function (e, idx) {
      var t = grandTotals[idx];
      var val = util.formatMoney(t.cost, 0);
      if (showFuelInUsage) {
        val += '<br><small>' + util.formatMoney(t.fuelCost, 0) + ' fuel</small>';
      }
      html += '<td class="number bold">' + val + '</td>';
    });
    var grandVal = util.formatMoney(grandTotal.cost, 0);
    if (showFuelInUsage) {
      grandVal += '<br><small>' + util.formatMoney(grandTotal.fuelCost, 0) + ' fuel</small>';
    }
    html += '<td class="number bold">' + grandVal + '</td></tr>';

    document.getElementById('impl-usage-tbody').innerHTML = html;
    document.getElementById('impl-usage-info').textContent =
      usedNames.length + ' implements, ' + util.formatMoney(grandTotal.cost, 0) + ' total machinery cost' +
      (showFuelInUsage ? ' + ' + util.formatMoney(grandTotal.fuelCost, 0) + ' fuel' : '');
  }

  // === LABOR & OVERHEAD (Features 1 + 3) ===

  function renderLaborOverhead(loRecords) {
    var enterprises = window.refData.enterprises;
    var tbody = document.getElementById('lo-tbody');
    var html = '';

    // Build system code -> enterprise name mapping
    var codeToEnts = {};
    enterprises.forEach(function (ent) {
      (ent.systemCodes || []).forEach(function (code) {
        if (!codeToEnts[code]) codeToEnts[code] = [];
        codeToEnts[code].push(ent.shortName);
      });
    });

    loRecords.forEach(function (lo) {
      // Skip the fuel price row
      if ((lo.systemCode || '').toLowerCase().includes('fuel')) return;

      var cropIns = lo.cropInsurance || 0;
      var propTax = lo.propertyTax || 0;
      var mgmt = lo.management || 0;
      var utilities = lo.utilities || 0;
      var misc = lo.misc || 0;
      var subTotal = cropIns + propTax + mgmt + utilities + misc;
      var overhead = lo.overheadPerAcre || 0;
      var total = (lo.laborPerAcre || 0) + overhead;

      var usedBy = codeToEnts[lo.systemCode] || [];
      var usedByStr = usedBy.length ? usedBy.join(', ') : '--';

      // If subcategories don't sum to overhead, show overhead directly
      var hasBreakdown = subTotal > 0;

      html += '<tr>' +
        '<td>' + util.escHtml(lo.systemCode) + '</td>' +
        '<td style="font-size:0.78rem;color:var(--text-light);max-width:200px;white-space:normal">' + util.escHtml(usedByStr) + '</td>' +
        '<td class="editable number" data-id="' + lo.id + '" data-field="laborPerAcre" data-type="labor-overhead">' + util.formatMoney(lo.laborPerAcre) + '</td>' +
        '<td class="number bold">' + util.formatMoney(overhead) + '</td>' +
        '<td class="editable number" data-id="' + lo.id + '" data-field="cropInsurance" data-type="labor-overhead">' + util.formatMoney(cropIns) + '</td>' +
        '<td class="editable number" data-id="' + lo.id + '" data-field="propertyTax" data-type="labor-overhead">' + util.formatMoney(propTax) + '</td>' +
        '<td class="editable number" data-id="' + lo.id + '" data-field="management" data-type="labor-overhead">' + util.formatMoney(mgmt) + '</td>' +
        '<td class="editable number" data-id="' + lo.id + '" data-field="utilities" data-type="labor-overhead">' + util.formatMoney(utilities) + '</td>' +
        '<td class="editable number" data-id="' + lo.id + '" data-field="misc" data-type="labor-overhead">' + util.formatMoney(misc) + '</td>' +
        '<td class="number bold">' + util.formatMoney(total) + '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
    bindEditing(tbody, 'labor-overhead');

    var count = loRecords.filter(function (lo) {
      return !(lo.systemCode || '').toLowerCase().includes('fuel');
    }).length;
    document.getElementById('lo-count').textContent = count + ' system codes';
  }

  // === SUPPLIERS ===

  document.getElementById('sup-search').addEventListener('input', filterSuppliers);
  document.getElementById('sup-filter-type').addEventListener('change', filterSuppliers);

  function filterSuppliers() {
    var q = (document.getElementById('sup-search').value || '').trim().toLowerCase();
    var typeFilter = document.getElementById('sup-filter-type').value;
    var filtered = allSuppliers.filter(function (s) {
      if (typeFilter && s.type !== typeFilter) return false;
      if (q && (s.name || '').toLowerCase().indexOf(q) < 0 &&
          (s.contact || '').toLowerCase().indexOf(q) < 0 &&
          (s.notes || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    renderSupplierTable(filtered);
  }

  document.getElementById('sup-add').addEventListener('click', function () {
    var typeFilter = document.getElementById('sup-filter-type').value;
    api.post('/api/suppliers', {
      name: 'New Supplier',
      type: typeFilter || 'product',
      contact: '',
      notes: ''
    }).then(function () {
      loaded = false;
      loadAll();
      util.showToast('Supplier added');
    });
  });

  function renderSupplierTable(suppliers) {
    var tbody = document.getElementById('sup-tbody');
    var html = '';
    suppliers.forEach(function (s) {
      // Count linked items
      var linked = 0;
      if (s.type === 'product') {
        linked = allProducts.filter(function (p) { return p.supplierId === s.id; }).length;
      } else if (s.type === 'seed') {
        linked = (window.refData.seeds || []).filter(function (sd) { return sd.supplierId === s.id; }).length;
      } else if (s.type === 'landlord') {
        linked = (window.refData.rent || allRent || []).filter(function (r) { return r.landlordId === s.id; }).length;
      }

      var typeBadge = s.type === 'product' ? 'status-done' :
                      s.type === 'seed' ? 'status-open' : 'status-pending';

      html += '<tr>' +
        '<td class="editable" data-id="' + s.id + '" data-field="name" data-type="suppliers">' + util.escHtml(s.name) + '</td>' +
        '<td class="sup-type-toggle" data-id="' + s.id + '" data-current-type="' + s.type + '">' +
          '<span class="status-badge ' + typeBadge + '">' + util.escHtml(s.type) + '</span></td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="contact" data-type="suppliers">' + util.escHtml(s.contact || '') + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="notes" data-type="suppliers">' + util.escHtml(s.notes || '') + '</td>' +
        '<td class="number">' + linked + '</td>' +
        '<td><button class="btn-danger" data-del-id="' + s.id + '" data-del-type="suppliers">Del</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    bindEditing(tbody, 'suppliers');
    bindDelete(tbody, 'suppliers');

    // Type toggle
    tbody.querySelectorAll('.sup-type-toggle').forEach(function (td) {
      td.addEventListener('click', function () {
        var id = td.getAttribute('data-id');
        var current = td.getAttribute('data-current-type');
        var types = ['product', 'seed', 'landlord'];
        var nextIdx = (types.indexOf(current) + 1) % types.length;
        api.put('/api/suppliers/' + id, { type: types[nextIdx] }).then(function () {
          loaded = false;
          loadAll();
          window.reloadRefDataSelective('products,implements,suppliers');
          util.showToast('Type changed to ' + types[nextIdx]);
        });
      });
    });

    document.getElementById('sup-count').textContent = suppliers.length + ' suppliers';
  }

  // === SHARED EDITING HELPERS ===

  function bindEditing(tbody, type) {
    tbody.querySelectorAll('td.editable[data-type="' + type + '"]').forEach(function (td) {
      td.addEventListener('dblclick', function () { startEdit(td, type); });
    });
  }

  function bindDelete(tbody, type) {
    tbody.querySelectorAll('[data-del-type="' + type + '"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this item?')) return;
        api.del('/api/' + type + '/' + btn.getAttribute('data-del-id')).then(function () {
          loaded = false;
          loadAll();
          util.showToast('Item deleted');
        });
      });
    });
  }

  function startEdit(td, type) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var oldVal = td.textContent.replace(/[$,]/g, '').replace(/\s*ac$/, '').trim();
    if (oldVal === '--') oldVal = '0';

    td.classList.add('editing');
    var input = document.createElement('input');
    var isText = (field === 'name' || field === 'unit' || field === 'systemCode');
    input.type = isText ? 'text' : 'number';
    if (!isText) input.step = '0.01';
    input.value = oldVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var data = {};
      var newVal = isText ? input.value : (parseFloat(input.value) || 0);
      data[field] = newVal;

      // For labor-overhead overhead subcategories, also recalculate overheadPerAcre
      if (type === 'labor-overhead' && ['cropInsurance', 'propertyTax', 'management', 'utilities', 'misc'].indexOf(field) >= 0) {
        var lo = allLaborOverhead.find(function (r) { return r.id === id; });
        if (lo) {
          var updated = Object.assign({}, lo);
          updated[field] = newVal;
          data.overheadPerAcre = (updated.cropInsurance || 0) + (updated.propertyTax || 0) +
            (updated.management || 0) + (updated.utilities || 0) + (updated.misc || 0);
        }
      }

      api.put('/api/' + type + '/' + id, data).then(function () {
        loaded = false;
        loadAll();
        window.reloadRefDataSelective('products,implements,suppliers');
      });
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { loaded = false; loadAll(); }
    });
  }
})();
