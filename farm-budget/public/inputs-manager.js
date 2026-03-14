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
      computeProductDemandTotals(allFields, allProducts);
      renderProductTable(allProducts);
      renderProductDemand(allFields, allProducts);
      renderImplTable(allImplements);
      renderMachMode();
      renderImplUsage(allFields, allImplements);
      renderLaborOverhead(allLaborOverhead);
      renderSupplierTable(allSuppliers);
      loaded = true;
    });
  }

  // === PRODUCTS ===

  var CATEGORY_ORDER = ['Fertilizer', 'Chemical', 'Biological', 'Seed', 'Other'];
  // Default unit lists — augmented dynamically from unit-packs config
  var DEFAULT_PURCHASE_UNITS = ['Ton', 'Gal', 'Lb', 'OZ', 'Bu', 'Each', 'Acre', 'Acres', 'Pts', 'Quart', 'Pack', 'UNIT', 'Tons'];
  var DEFAULT_APP_UNITS = ['Lbs', 'OZ', 'Gal', 'Pts', 'Quart', 'Acre', 'Acres', 'Each', 'Tons', 'Pack', 'UNIT', 'lbs', 'oz', 'Bu'];
  var UNIT_CONVERSIONS = {
    'Ton:Lbs': 2000, 'Ton:lbs': 2000, 'Gal:OZ': 128, 'Gal:oz': 128,
    'Gal:Pts': 8, 'Gal:Quart': 4, 'Lb:OZ': 16, 'Lb:oz': 16, 'Bu:Lbs': 56, 'Bu:lbs': 56
  };

  // Dynamic unit lists: merge defaults + unit-pack names from config
  function getPurchaseUnits() {
    var packs = (window.refData.unitPacks || []).map(function (up) { return up.name; });
    var merged = DEFAULT_PURCHASE_UNITS.slice();
    packs.forEach(function (name) {
      if (merged.indexOf(name) === -1) merged.push(name);
    });
    return merged;
  }
  function getAppUnits() {
    var packs = (window.refData.unitPacks || []).map(function (up) { return up.name; });
    var merged = DEFAULT_APP_UNITS.slice();
    packs.forEach(function (name) {
      if (merged.indexOf(name) === -1) merged.push(name);
    });
    return merged;
  }
  var selectedProductIds = new Set();
  var simulatorPct = 0;
  var collapsedCategories = new Set(CATEGORY_ORDER);
  var productDemandTotals = {}; // productId → { qty (app units), purchaseQty }

  document.getElementById('inp-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allProducts.filter(function (p) {
      return p.name.toLowerCase().includes(q) ||
        (p.unit || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        getSupplierName(p.supplierId, 'product').toLowerCase().includes(q);
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
      purchaseUnit: 'Lbs',
      organic: false,
      category: 'Other',
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

  // Compute total demand per product from field input assignments
  function computeProductDemandTotals(fields, products) {
    productDemandTotals = {};
    var productIndex = {};
    products.forEach(function (p) {
      productIndex[(p.name || '').trim().toLowerCase()] = p;
    });
    fields.forEach(function (f) {
      var fieldAcres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
      (f.inputs || []).forEach(function (inp) {
        if (!inp.productName) return;
        var key = inp.productName.trim().toLowerCase();
        var product = productIndex[key];
        if (!product) return;
        var appQty = (inp.quantity || 0) * fieldAcres;
        if (!productDemandTotals[product.id]) productDemandTotals[product.id] = 0;
        productDemandTotals[product.id] += appQty;
      });
    });
  }

  function renderProductTable(products) {
    var container = document.getElementById('products-container');
    // Group by category
    var grouped = {};
    CATEGORY_ORDER.forEach(function (cat) { grouped[cat] = []; });
    products.forEach(function (p) {
      var cat = p.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    var html = '';
    CATEGORY_ORDER.forEach(function (cat) {
      var items = grouped[cat];
      if (!items || !items.length) return;
      var isCollapsed = collapsedCategories.has(cat);
      html += '<div class="prod-category' + (isCollapsed ? ' collapsed' : '') + '" data-category="' + cat + '">';
      html += '<div class="prod-category-header">';
      html += '<span class="prod-category-name">' + util.escHtml(cat) + '</span>';
      html += '<span class="prod-category-count">' + items.length + '</span>';
      html += '<span class="prod-category-toggle">&#9660;</span>';
      html += '</div>';
      html += '<div class="prod-category-body">';
      html += '<table class="prod-table"><thead><tr>';
      html += '<th><input type="checkbox" class="cat-select-all" data-category="' + cat + '"></th>';
      html += '<th>Product Name</th>';
      html += '<th>Supplier</th>';
      html += '<th>Purchase Price</th>';
      html += '<th>Purch Unit</th>';
      html += '<th title="Computed from purchase price / conversion rate">App Price</th>';
      html += '<th>App Unit</th>';
      html += '<th title="Total demand across all enterprises in purchase units">Demand</th>';
      html += '<th title="Organic / OMRI approved">ORG</th>';
      html += '<th title="Used on certified organic ground">OG</th>';
      html += '<th></th>';
      html += '</tr></thead><tbody>';
      items.forEach(function (p) {
        var appPrice = Calc.computeApplicationPrice(p);
        var supplierName = getSupplierName(p.supplierId, 'product');
        var isSelected = selectedProductIds.has(p.id);
        var priceDisplay = util.formatMoney(p.unitBilledPrice);
        var appDisplay = util.formatMoney(appPrice, 4);
        var previewCls = '';
        if (isSelected && simulatorPct > 0) {
          var simPrice = p.unitBilledPrice * (1 + simulatorPct / 100);
          var simApp = p.conversionRate ? simPrice / p.conversionRate : 0;
          priceDisplay = util.formatMoney(simPrice);
          appDisplay = util.formatMoney(simApp, 4);
          previewCls = ' sim-preview';
        }
        html += '<tr data-prod-id="' + p.id + '">';
        html += '<td><input type="checkbox" class="prod-select" data-prod-id="' + p.id + '"' + (isSelected ? ' checked' : '') + '></td>';
        html += '<td class="prod-name-cell" data-id="' + p.id + '">' + util.escHtml(p.name) + '</td>';
        html += '<td class="supplier-cell" data-id="' + p.id + '" data-supplier-id="' + (p.supplierId || '') + '" data-type="products" style="cursor:pointer">' + util.escHtml(supplierName) + '</td>';
        html += '<td class="editable number' + previewCls + '" data-id="' + p.id + '" data-field="unitBilledPrice" data-type="products">' + priceDisplay + '</td>';
        html += '<td>' + util.escHtml(p.purchaseUnit || '--') + '</td>';
        html += '<td class="number' + previewCls + '">' + appDisplay + '</td>';
        html += '<td class="editable" data-id="' + p.id + '" data-field="unit" data-type="products">' + util.escHtml(p.unit) + '</td>';
        var demandAppQty = productDemandTotals[p.id] || 0;
        var demandPurchQty = demandAppQty && p.conversionRate ? demandAppQty / p.conversionRate : demandAppQty;
        var demandLabel = demandPurchQty > 0
          ? util.formatNum(demandPurchQty, 1) + ' ' + util.escHtml(p.purchaseUnit || p.unit || '')
          : '<span style="color:var(--text-light)">--</span>';
        html += '<td class="number">' + demandLabel + '</td>';
        html += '<td>' + (p.organic ? '<span class="prod-organic-badge">ORG</span>' : '') + '</td>';
        html += '<td>' + (p.organicGround ? '<span class="prod-og-badge" style="background:#16a34a;color:#fff;padding:0.1rem 0.35rem;border-radius:3px;font-size:0.65rem;font-weight:600">OG</span>' : '') + '</td>';
        html += '<td><button class="btn-danger" data-del-id="' + p.id + '" data-del-type="products" style="font-size:0.7rem;padding:0.15rem 0.4rem">Del</button></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div></div>';
    });

    container.innerHTML = html;

    // Bind events for each category table
    container.querySelectorAll('.prod-table tbody').forEach(function (tbody) {
      bindEditing(tbody, 'products');
      bindDelete(tbody, 'products');
      bindSupplierSelect(tbody, 'products', 'supplierId', 'product');
    });

    // Category collapse/expand
    container.querySelectorAll('.prod-category-header').forEach(function (hdr) {
      hdr.addEventListener('click', function (e) {
        if (e.target.tagName === 'INPUT') return;
        var catDiv = hdr.parentElement;
        var cat = catDiv.getAttribute('data-category');
        catDiv.classList.toggle('collapsed');
        if (catDiv.classList.contains('collapsed')) collapsedCategories.add(cat);
        else collapsedCategories.delete(cat);
      });
    });

    // Product name click — open detail panel
    container.querySelectorAll('.prod-name-cell').forEach(function (td) {
      td.addEventListener('click', function () {
        var id = td.getAttribute('data-id');
        var product = allProducts.find(function (p) { return p.id === id; });
        if (product) openProductPanel(product);
      });
    });

    // Checkbox selection
    container.querySelectorAll('.prod-select').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-prod-id');
        if (cb.checked) selectedProductIds.add(id);
        else selectedProductIds.delete(id);
        updateSimulatorUI();
        if (simulatorPct > 0) renderProductTable(getCurrentFilteredProducts());
      });
    });

    // Category select-all checkboxes
    container.querySelectorAll('.cat-select-all').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var cat = cb.getAttribute('data-category');
        var catProducts = allProducts.filter(function (p) { return (p.category || 'Other') === cat; });
        catProducts.forEach(function (p) {
          if (cb.checked) selectedProductIds.add(p.id);
          else selectedProductIds.delete(p.id);
        });
        updateSimulatorUI();
        renderProductTable(getCurrentFilteredProducts());
      });
    });

    document.getElementById('inp-count').textContent = products.length + ' products';
  }

  function getCurrentFilteredProducts() {
    var q = document.getElementById('inp-search').value.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(function (p) {
      return p.name.toLowerCase().includes(q) ||
        (p.unit || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        getSupplierName(p.supplierId, 'product').toLowerCase().includes(q);
    });
  }

  // === PRODUCT DETAIL PANEL ===

  var peOverlay = document.getElementById('product-editor-overlay');
  var peCurrentId = null;

  function populateSelectOptions(selectEl, options, selectedVal) {
    selectEl.innerHTML = '';
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (opt === selectedVal) o.selected = true;
      selectEl.appendChild(o);
    });
  }

  function openProductPanel(product) {
    peCurrentId = product.id;
    document.getElementById('pe-name').value = product.name || '';
    document.getElementById('pe-category').value = product.category || 'Other';
    document.getElementById('pe-purchasePrice').value = product.unitBilledPrice || 0;
    document.getElementById('pe-convRate').value = product.conversionRate || 1;
    document.getElementById('pe-p205').value = product.p205 || 0;
    document.getElementById('pe-k20').value = product.k20 || 0;

    // Organic checkbox
    var orgCb = document.getElementById('pe-organic');
    orgCb.checked = !!product.organic;
    document.getElementById('pe-organic-label').textContent = orgCb.checked ? 'Yes' : 'No';

    // Organic Ground checkbox
    var ogCb = document.getElementById('pe-organicGround');
    ogCb.checked = !!product.organicGround;
    document.getElementById('pe-organicGround-label').textContent = ogCb.checked ? 'Yes' : 'No';

    // Supplier dropdown
    var supSelect = document.getElementById('pe-supplier');
    supSelect.innerHTML = '<option value="">-- none --</option>';
    (window.refData.suppliers || []).filter(function (s) { return s.type === 'product'; }).forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name;
      if (s.id === product.supplierId) opt.selected = true;
      supSelect.appendChild(opt);
    });

    // Purchase unit dropdown
    populateSelectOptions(document.getElementById('pe-purchaseUnit'), getPurchaseUnits(), product.purchaseUnit || product.unit);
    // App unit dropdown
    populateSelectOptions(document.getElementById('pe-appUnit'), getAppUnits(), product.unit || 'Lbs');

    updatePanelConvHint();
    updatePanelAppPrice();

    // Show/hide nutrient section
    var cat = product.category || 'Other';
    var nutrientSec = document.getElementById('pe-nutrient-section');
    nutrientSec.style.display = (cat === 'Fertilizer' || cat === 'Biological') ? '' : 'none';

    // Show overlay
    peOverlay.style.display = 'flex';
    requestAnimationFrame(function () { peOverlay.classList.add('visible'); });
  }

  function closeProductPanel() {
    peOverlay.classList.remove('visible');
    setTimeout(function () { peOverlay.style.display = 'none'; }, 300);
    peCurrentId = null;
  }

  function updatePanelConvHint() {
    var pu = document.getElementById('pe-purchaseUnit').value;
    var au = document.getElementById('pe-appUnit').value;
    var key = pu + ':' + au;
    var hint = document.getElementById('pe-conv-hint');
    if (UNIT_CONVERSIONS[key]) {
      hint.textContent = '(auto: ' + UNIT_CONVERSIONS[key] + ' ' + au + '/' + pu + ')';
      document.getElementById('pe-convRate').value = UNIT_CONVERSIONS[key];
    } else if (pu === au) {
      hint.textContent = '(same unit)';
      document.getElementById('pe-convRate').value = 1;
    } else {
      hint.textContent = '(custom)';
    }
  }

  function updatePanelAppPrice() {
    var price = parseFloat(document.getElementById('pe-purchasePrice').value) || 0;
    var conv = parseFloat(document.getElementById('pe-convRate').value) || 1;
    var appPrice = price / conv;
    var au = document.getElementById('pe-appUnit').value;
    document.getElementById('pe-appPrice').textContent = util.formatMoney(appPrice, 4) + ' / ' + au;
  }

  // Panel event bindings
  document.getElementById('prod-editor-close').addEventListener('click', closeProductPanel);
  document.getElementById('pe-cancel').addEventListener('click', closeProductPanel);
  peOverlay.addEventListener('click', function (e) { if (e.target === peOverlay) closeProductPanel(); });

  document.getElementById('pe-organic').addEventListener('change', function () {
    document.getElementById('pe-organic-label').textContent = this.checked ? 'Yes' : 'No';
  });
  document.getElementById('pe-organicGround').addEventListener('change', function () {
    document.getElementById('pe-organicGround-label').textContent = this.checked ? 'Yes' : 'No';
  });

  document.getElementById('pe-category').addEventListener('change', function () {
    var cat = this.value;
    document.getElementById('pe-nutrient-section').style.display =
      (cat === 'Fertilizer' || cat === 'Biological') ? '' : 'none';
  });

  document.getElementById('pe-purchaseUnit').addEventListener('change', function () {
    updatePanelConvHint(); updatePanelAppPrice();
  });
  document.getElementById('pe-appUnit').addEventListener('change', function () {
    updatePanelConvHint(); updatePanelAppPrice();
  });
  document.getElementById('pe-purchasePrice').addEventListener('input', updatePanelAppPrice);
  document.getElementById('pe-convRate').addEventListener('input', updatePanelAppPrice);

  document.getElementById('pe-save').addEventListener('click', function () {
    if (!peCurrentId) return;
    var data = {
      name: document.getElementById('pe-name').value,
      category: document.getElementById('pe-category').value,
      supplierId: document.getElementById('pe-supplier').value,
      organic: document.getElementById('pe-organic').checked,
      organicGround: document.getElementById('pe-organicGround').checked,
      unitBilledPrice: parseFloat(document.getElementById('pe-purchasePrice').value) || 0,
      purchaseUnit: document.getElementById('pe-purchaseUnit').value,
      unit: document.getElementById('pe-appUnit').value,
      conversionRate: parseFloat(document.getElementById('pe-convRate').value) || 1,
      p205: parseFloat(document.getElementById('pe-p205').value) || 0,
      k20: parseFloat(document.getElementById('pe-k20').value) || 0
    };
    api.put('/api/products/' + peCurrentId, data).then(function () {
      closeProductPanel();
      loaded = false;
      loadAll();
      window.reloadRefDataSelective('products');
      util.showToast('Product saved');
    });
  });

  document.getElementById('pe-delete').addEventListener('click', function () {
    if (!peCurrentId) return;
    if (!confirm('Delete this product?')) return;
    api.del('/api/products/' + peCurrentId).then(function () {
      closeProductPanel();
      loaded = false;
      loadAll();
      util.showToast('Product deleted');
    });
  });

  // === PRICE INCREASE SIMULATOR ===

  var simSlider = document.getElementById('sim-slider');
  var simPctInput = document.getElementById('sim-pct-input');
  var simPctLabel = document.getElementById('sim-pct-label');
  var simApplyBtn = document.getElementById('sim-apply');

  function updateSimulatorUI() {
    var count = selectedProductIds.size;
    document.getElementById('sim-sel-count').textContent = count ? count + ' selected' : '';
    simApplyBtn.disabled = !count || simulatorPct <= 0;
  }

  simSlider.addEventListener('input', function () {
    simulatorPct = parseFloat(this.value) || 0;
    simPctInput.value = simulatorPct;
    simPctLabel.textContent = simulatorPct + '%';
    updateSimulatorUI();
    renderProductTable(getCurrentFilteredProducts());
  });

  simPctInput.addEventListener('input', function () {
    simulatorPct = Math.max(0, Math.min(100, parseFloat(this.value) || 0));
    simSlider.value = Math.min(50, simulatorPct);
    simPctLabel.textContent = simulatorPct + '%';
    updateSimulatorUI();
    renderProductTable(getCurrentFilteredProducts());
  });

  document.getElementById('sim-select-all').addEventListener('click', function () {
    allProducts.forEach(function (p) { selectedProductIds.add(p.id); });
    updateSimulatorUI();
    renderProductTable(getCurrentFilteredProducts());
  });

  document.getElementById('sim-clear').addEventListener('click', function () {
    selectedProductIds.clear();
    updateSimulatorUI();
    renderProductTable(getCurrentFilteredProducts());
  });

  // Category filter buttons
  document.querySelectorAll('.sim-cat-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-cat');
      var catProducts = allProducts.filter(function (p) { return (p.category || 'Other') === cat; });
      var allSelected = catProducts.every(function (p) { return selectedProductIds.has(p.id); });
      catProducts.forEach(function (p) {
        if (allSelected) selectedProductIds.delete(p.id);
        else selectedProductIds.add(p.id);
      });
      btn.classList.toggle('active', !allSelected);
      updateSimulatorUI();
      renderProductTable(getCurrentFilteredProducts());
    });
  });

  simApplyBtn.addEventListener('click', function () {
    if (!selectedProductIds.size || simulatorPct <= 0) return;
    var count = selectedProductIds.size;
    if (!confirm('Apply +' + simulatorPct + '% price increase to ' + count + ' products?')) return;
    var updates = [];
    allProducts.forEach(function (p) {
      if (!selectedProductIds.has(p.id)) return;
      var newPrice = Math.round(p.unitBilledPrice * (1 + simulatorPct / 100) * 100) / 100;
      updates.push(api.put('/api/products/' + p.id, { unitBilledPrice: newPrice }));
    });
    Promise.all(updates).then(function () {
      util.showToast('Applied +' + simulatorPct + '% to ' + count + ' products');
      simulatorPct = 0;
      simSlider.value = 0;
      simPctInput.value = 0;
      simPctLabel.textContent = '0%';
      selectedProductIds.clear();
      document.querySelectorAll('.sim-cat-btn').forEach(function (b) { b.classList.remove('active'); });
      updateSimulatorUI();
      loaded = false;
      loadAll();
      window.reloadRefDataSelective('products');
    });
  });

  document.getElementById('sim-reset').addEventListener('click', function () {
    simulatorPct = 0;
    simSlider.value = 0;
    simPctInput.value = 0;
    simPctLabel.textContent = '0%';
    selectedProductIds.clear();
    document.querySelectorAll('.sim-cat-btn').forEach(function (b) { b.classList.remove('active'); });
    updateSimulatorUI();
    renderProductTable(getCurrentFilteredProducts());
  });

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

  // === PRODUCT DEMAND — EXPANDABLE FIELD VIEW ===

  function renderProductDemand(fields, products) {
    var enterprises = window.refData.enterprises;
    var container = document.getElementById('prod-demand-container');
    if (!container) return;
    if (!fields.length) {
      container.innerHTML = '<p style="color:var(--text-light)">No field data</p>';
      return;
    }

    // Build product index by lowercase name
    var productIndex = {};
    products.forEach(function (p) {
      productIndex[(p.name || '').trim().toLowerCase()] = p;
    });

    // Build enterprise index by id
    var entMap = {};
    enterprises.forEach(function (e) { entMap[e.id] = e; });

    // demand[productName] = { totalQty, totalCost, fields: [{ name, acres, qty, cost, enterprise, season }] }
    var demand = {};
    fields.forEach(function (f) {
      var fieldAcres = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
      var ent = entMap[f.enterpriseId];
      (f.inputs || []).forEach(function (inp) {
        if (!inp.productName) return;
        var key = inp.productName.trim().toLowerCase();
        var product = productIndex[key];
        var appPrice = product ? Calc.computeApplicationPrice(product) : 0;
        var fieldQty = (inp.quantity || 0) * fieldAcres;
        var fieldCost = fieldQty * appPrice;

        if (!demand[inp.productName]) demand[inp.productName] = { totalQty: 0, totalCost: 0, fields: [] };
        demand[inp.productName].totalQty += fieldQty;
        demand[inp.productName].totalCost += fieldCost;
        demand[inp.productName].fields.push({
          name: f.name,
          acres: fieldAcres,
          rate: inp.quantity || 0,
          qty: fieldQty,
          cost: fieldCost,
          enterprise: ent ? (ent.shortName || ent.name) : '--',
          season: inp.season || '--'
        });
      });
    });

    var usedNames = Object.keys(demand).sort();
    var grandTotal = 0;
    usedNames.forEach(function (n) { grandTotal += demand[n].totalCost; });

    var html = '';
    usedNames.forEach(function (name) {
      var d = demand[name];
      var key = name.trim().toLowerCase();
      var product = productIndex[key];
      var unit = product ? (product.unit || 'units') : 'units';
      var supplierName = product ? getSupplierName(product.supplierId, 'product') : '';
      var safeId = key.replace(/[^a-z0-9]/g, '-');

      // Sort fields by qty descending
      d.fields.sort(function (a, b) { return b.qty - a.qty; });

      html += '<details class="demand-expand" id="prod-exp-' + safeId + '">';
      html += '<summary class="demand-summary">';
      html += '<span class="demand-name">' + util.escHtml(name) + '</span>';
      if (supplierName) html += '<span class="demand-supplier">' + util.escHtml(supplierName) + '</span>';
      html += '<span class="demand-totals">' + util.formatNum(d.totalQty, 0) + ' ' + util.escHtml(unit) +
        ' &middot; ' + util.formatMoney(d.totalCost, 0) + '</span>';
      html += '<span class="demand-field-count">' + d.fields.length + ' field' + (d.fields.length !== 1 ? 's' : '') + '</span>';
      html += '</summary>';

      html += '<table class="demand-fields-table"><thead><tr>' +
        '<th>Field</th><th>Enterprise</th><th>Acres</th><th>Rate/' + util.escHtml(unit === 'Lbs' ? 'Ac' : 'Ac') + '</th>' +
        '<th>Total ' + util.escHtml(unit) + '</th><th>Cost</th><th>Season</th>' +
        '</tr></thead><tbody>';

      d.fields.forEach(function (f) {
        html += '<tr>' +
          '<td>' + util.escHtml(f.name) + '</td>' +
          '<td>' + util.escHtml(f.enterprise) + '</td>' +
          '<td class="number">' + util.formatNum(f.acres, 1) + '</td>' +
          '<td class="number">' + util.formatNum(f.rate, 1) + '</td>' +
          '<td class="number">' + util.formatNum(f.qty, 0) + '</td>' +
          '<td class="number">' + util.formatMoney(f.cost, 0) + '</td>' +
          '<td>' + util.escHtml(f.season) + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></details>';
    });

    container.innerHTML = html;
    document.getElementById('prod-demand-info').textContent =
      usedNames.length + ' products in use, ' + util.formatMoney(grandTotal, 0) + ' total input cost';
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

  // === UNIT/PACK DEFINITIONS ===

  var allUnitPacks = [];

  function loadUnitPacks() {
    api.get('/api/unit-packs').then(function (data) {
      allUnitPacks = data;
      renderUnitPackTable(allUnitPacks);
    });
  }

  // Load unit packs when tab activates (along with everything else)
  var _origLoadAll = loadAll;
  loadAll = function () {
    _origLoadAll();
    loadUnitPacks();
  };

  document.getElementById('up-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allUnitPacks.filter(function (up) {
      return (up.name || '').toLowerCase().includes(q) ||
             (up.packDesc || '').toLowerCase().includes(q) ||
             (up.packUom || '').toLowerCase().includes(q);
    });
    renderUnitPackTable(filtered);
  });

  document.getElementById('up-add').addEventListener('click', function () {
    api.post('/api/unit-packs', {
      name: 'New Unit',
      packQty: 1,
      packDesc: '1 unit',
      packUom: 'units'
    }).then(function () {
      loadUnitPacks();
      window.reloadRefDataSelective('unit-packs');
      util.showToast('Unit/Pack added');
    });
  });

  function renderUnitPackTable(unitPacks) {
    var tbody = document.getElementById('up-tbody');
    if (!tbody) return;
    var html = '';
    unitPacks.forEach(function (up) {
      html += '<tr>' +
        '<td class="editable" data-id="' + up.id + '" data-field="name" data-type="unit-packs">' + util.escHtml(up.name) + '</td>' +
        '<td class="editable number" data-id="' + up.id + '" data-field="packQty" data-type="unit-packs">' + util.formatNum(up.packQty, up.packQty % 1 === 0 ? 0 : 2) + '</td>' +
        '<td class="editable" data-id="' + up.id + '" data-field="packDesc" data-type="unit-packs">' + util.escHtml(up.packDesc) + '</td>' +
        '<td class="editable" data-id="' + up.id + '" data-field="packUom" data-type="unit-packs">' + util.escHtml(up.packUom) + '</td>' +
        '<td><button class="btn-danger" data-del-id="' + up.id + '" data-del-type="unit-packs">Del</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    bindEditing(tbody, 'unit-packs');
    bindDelete(tbody, 'unit-packs');

    var el = document.getElementById('up-count');
    if (el) el.textContent = unitPacks.length + ' unit/pack definitions';
  }

  // Override startEdit to handle unit-packs isText fields
  var _origStartEdit = startEdit;
  startEdit = function (td, type) {
    if (type === 'unit-packs') {
      var field = td.getAttribute('data-field');
      if (field === 'name' || field === 'packDesc' || field === 'packUom') {
        // Force text treatment
        if (td.classList.contains('editing')) return;
        var id = td.getAttribute('data-id');
        var oldVal = td.textContent.trim();
        td.classList.add('editing');
        var input = document.createElement('input');
        input.type = 'text';
        input.value = oldVal;
        td.textContent = '';
        td.appendChild(input);
        input.focus();
        input.select();

        function save() {
          var data = {};
          data[field] = input.value;
          api.put('/api/unit-packs/' + id, data).then(function () {
            loadUnitPacks();
            window.reloadRefDataSelective('unit-packs');
          });
        }
        input.addEventListener('blur', save);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') input.blur();
          if (e.key === 'Escape') loadUnitPacks();
        });
        return;
      }
    }
    _origStartEdit(td, type);
  };

  // === REACTIVE DATA EVENTS ===
  // Dispatch events when products or suppliers change so other tabs can react
  var _origLoadAllReactive = loadAll;
  loadAll = function () {
    _origLoadAllReactive();
    // After loading, notify other tabs that reference data may have changed
    window.dispatchEvent(new CustomEvent('inputs-data-changed'));
  };
})();
